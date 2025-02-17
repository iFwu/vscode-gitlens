import { TreeItem, TreeItemCollapsibleState } from 'vscode';
import { ViewFilesLayout } from '../../config';
import { CommitFormatter } from '../../git/formatters';
import { GitStashCommit, GitStashReference } from '../../git/models';
import { makeHierarchical } from '../../system/array';
import { joinPaths, normalizePath } from '../../system/path';
import { sortCompare } from '../../system/string';
import { ContextValues, FileNode, FolderNode, RepositoryNode, StashFileNode, ViewNode, ViewRefNode } from '../nodes';
import { RepositoriesView } from '../repositoriesView';
import { StashesView } from '../stashesView';

export class StashNode extends ViewRefNode<StashesView | RepositoriesView, GitStashReference> {
	static key = ':stash';
	static getId(repoPath: string, ref: string): string {
		return `${RepositoryNode.getId(repoPath)}${this.key}(${ref})`;
	}

	constructor(view: StashesView | RepositoriesView, parent: ViewNode, public readonly commit: GitStashCommit) {
		super(commit.getGitUri(), view, parent);
	}

	override toClipboard(): string {
		return this.commit.stashName;
	}

	override get id(): string {
		return StashNode.getId(this.commit.repoPath, this.commit.sha);
	}

	get ref(): GitStashReference {
		return this.commit;
	}

	async getChildren(): Promise<ViewNode[]> {
		// Ensure we have checked for untracked files (inside the getCommitsForFiles call)
		const commits = await this.commit.getCommitsForFiles();
		let children: FileNode[] = commits.map(c => new StashFileNode(this.view, this, c.file!, c as GitStashCommit));

		if (this.view.config.files.layout !== ViewFilesLayout.List) {
			const hierarchy = makeHierarchical(
				children,
				n => n.uri.relativePath.split('/'),
				(...parts: string[]) => normalizePath(joinPaths(...parts)),
				this.view.config.files.compact,
			);

			const root = new FolderNode(this.view, this, this.repoPath, '', hierarchy);
			children = root.getChildren() as FileNode[];
		} else {
			children.sort((a, b) => sortCompare(a.label!, b.label!));
		}
		return children;
	}

	getTreeItem(): TreeItem {
		const item = new TreeItem(
			CommitFormatter.fromTemplate(this.view.config.formats.stashes.label, this.commit, {
				messageTruncateAtNewLine: true,
				dateFormat: this.view.container.config.defaultDateFormat,
			}),
			TreeItemCollapsibleState.Collapsed,
		);
		item.id = this.id;
		item.description = CommitFormatter.fromTemplate(this.view.config.formats.stashes.description, this.commit, {
			messageTruncateAtNewLine: true,
			dateFormat: this.view.container.config.defaultDateFormat,
		});
		item.contextValue = ContextValues.Stash;
		item.tooltip = CommitFormatter.fromTemplate(
			`\${'On 'stashOnRef\n}\${ago} (\${date})\n\n\${message}`,
			this.commit,
			{
				dateFormat: this.view.container.config.defaultDateFormat,
				// messageAutolinks: true,
			},
		);

		return item;
	}
}
