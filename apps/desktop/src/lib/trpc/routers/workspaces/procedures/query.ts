import { projects, workspaces, worktrees } from "@superset/local-db";
import { TRPCError } from "@trpc/server";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { localDb } from "main/lib/local-db";
import { z } from "zod";
import { publicProcedure, router } from "../../..";
import { getWorkspace } from "../utils/db-helpers";
import { getWorkspacePath } from "../utils/worktree";

type WorktreePathMap = Map<string, string>;

/** Returns workspace IDs in sidebar visual order (by project.tabOrder, then workspace.tabOrder). */
function getWorkspacesInVisualOrder(): string[] {
	const activeProjects = localDb
		.select()
		.from(projects)
		.where(
			and(isNotNull(projects.tabOrder), isNull(projects.parentProjectId)),
		)
		.all()
		.sort((a, b) => (a.tabOrder ?? 0) - (b.tabOrder ?? 0));

	const childProjects = localDb
		.select()
		.from(projects)
		.where(isNotNull(projects.parentProjectId))
		.all();

	const allWorkspaces = localDb
		.select()
		.from(workspaces)
		.where(isNull(workspaces.deletingAt))
		.all();

	const orderedIds: string[] = [];
	for (const project of activeProjects) {
		// Parent's own workspaces
		const projectWorkspaces = allWorkspaces
			.filter((w) => w.projectId === project.id)
			.sort((a, b) => a.tabOrder - b.tabOrder);
		for (const ws of projectWorkspaces) {
			orderedIds.push(ws.id);
		}

		// Child project workspaces
		const children = childProjects.filter(
			(c) => c.parentProjectId === project.id,
		);
		for (const child of children) {
			const childWorkspaces = allWorkspaces
				.filter((w) => w.projectId === child.id)
				.sort((a, b) => a.tabOrder - b.tabOrder);
			for (const ws of childWorkspaces) {
				orderedIds.push(ws.id);
			}
		}
	}

	return orderedIds;
}

export const createQueryProcedures = () => {
	return router({
		get: publicProcedure
			.input(z.object({ id: z.string() }))
			.query(async ({ input }) => {
				const workspace = getWorkspace(input.id);
				if (!workspace) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message: `Workspace ${input.id} not found`,
					});
				}

				const project = localDb
					.select()
					.from(projects)
					.where(eq(projects.id, workspace.projectId))
					.get();
				const worktree = workspace.worktreeId
					? localDb
							.select()
							.from(worktrees)
							.where(eq(worktrees.id, workspace.worktreeId))
							.get()
					: null;

				return {
					...workspace,
					type: workspace.type as "worktree" | "branch",
					worktreePath: getWorkspacePath(workspace) ?? "",
					project: project
						? {
								id: project.id,
								name: project.name,
								mainRepoPath: project.mainRepoPath,
								githubOwner: project.githubOwner ?? null,
								defaultBranch: project.defaultBranch ?? null,
							}
						: null,
					worktree: worktree
						? {
								branch: worktree.branch,
								// Normalize to null to ensure consistent "incomplete init" detection in UI
								gitStatus: worktree.gitStatus ?? null,
							}
						: null,
				};
			}),

		getAll: publicProcedure.query(() => {
			return localDb
				.select()
				.from(workspaces)
				.where(isNull(workspaces.deletingAt))
				.all()
				.sort((a, b) => a.tabOrder - b.tabOrder);
		}),

		getAllGrouped: publicProcedure.query(() => {
			// Top-level active projects only (exclude children)
			const activeProjects = localDb
				.select()
				.from(projects)
				.where(
					and(
						isNotNull(projects.tabOrder),
						isNull(projects.parentProjectId),
					),
				)
				.all();

			// Child projects (regardless of tabOrder)
			const childProjectRows = localDb
				.select()
				.from(projects)
				.where(isNotNull(projects.parentProjectId))
				.all();

			const allWorktrees = localDb.select().from(worktrees).all();
			const worktreePathMap: WorktreePathMap = new Map(
				allWorktrees.map((wt) => [wt.id, wt.path]),
			);

			type WorkspaceEntry = {
				id: string;
				projectId: string;
				worktreeId: string | null;
				worktreePath: string;
				type: "worktree" | "branch";
				branch: string;
				name: string;
				tabOrder: number;
				createdAt: number;
				updatedAt: number;
				lastOpenedAt: number;
				isUnread: boolean;
				isUnnamed: boolean;
			};

			type ChildProject = {
				project: {
					id: string;
					name: string;
					color: string;
					githubOwner: string | null;
					mainRepoPath: string;
					hideImage: boolean;
					iconUrl: string | null;
				};
				workspaces: WorkspaceEntry[];
			};

			const groupsMap = new Map<
				string,
				{
					project: {
						id: string;
						name: string;
						color: string;
						tabOrder: number;
						githubOwner: string | null;
						mainRepoPath: string;
						hideImage: boolean;
						iconUrl: string | null;
					};
					workspaces: WorkspaceEntry[];
					childProjects: ChildProject[];
				}
			>();

			for (const project of activeProjects) {
				groupsMap.set(project.id, {
					project: {
						id: project.id,
						name: project.name,
						color: project.color,
						// biome-ignore lint/style/noNonNullAssertion: filter guarantees tabOrder is not null
						tabOrder: project.tabOrder!,
						githubOwner: project.githubOwner ?? null,
						mainRepoPath: project.mainRepoPath,
						hideImage: project.hideImage ?? false,
						iconUrl: project.iconUrl ?? null,
					},
					workspaces: [],
					childProjects: [],
				});
			}

			// Build child project entries grouped by parent
			const childProjectMap = new Map<string, ChildProject[]>();
			for (const child of childProjectRows) {
				const parentId = child.parentProjectId!;
				if (!childProjectMap.has(parentId)) {
					childProjectMap.set(parentId, []);
				}
				childProjectMap.get(parentId)!.push({
					project: {
						id: child.id,
						name: child.name,
						color: child.color,
						githubOwner: child.githubOwner ?? null,
						mainRepoPath: child.mainRepoPath,
						hideImage: child.hideImage ?? false,
						iconUrl: child.iconUrl ?? null,
					},
					workspaces: [],
				});
			}

			// Attach children to parent groups
			for (const [parentId, children] of childProjectMap) {
				const group = groupsMap.get(parentId);
				if (group) {
					group.childProjects = children;
				}
			}

			const allWorkspaces = localDb
				.select()
				.from(workspaces)
				.where(isNull(workspaces.deletingAt))
				.all()
				.sort((a, b) => a.tabOrder - b.tabOrder);

			// Build a lookup for child project entries by project ID
			const childProjectById = new Map<string, ChildProject>();
			for (const children of childProjectMap.values()) {
				for (const child of children) {
					childProjectById.set(child.project.id, child);
				}
			}

			for (const workspace of allWorkspaces) {
				// Try parent group first
				const group = groupsMap.get(workspace.projectId);
				// Then try child project
				const childProject = childProjectById.get(workspace.projectId);

				const targetProject = group || childProject;
				if (!targetProject) continue;

				let worktreePath = "";
				if (workspace.type === "worktree" && workspace.worktreeId) {
					worktreePath =
						worktreePathMap.get(workspace.worktreeId) ?? "";
				} else if (workspace.type === "branch") {
					worktreePath = targetProject.project.mainRepoPath;
				}

				targetProject.workspaces.push({
					...workspace,
					type: workspace.type as "worktree" | "branch",
					worktreePath,
					isUnread: workspace.isUnread ?? false,
					isUnnamed: workspace.isUnnamed ?? false,
				});
			}

			return Array.from(groupsMap.values()).sort(
				(a, b) => a.project.tabOrder - b.project.tabOrder,
			);
		}),

		getPreviousWorkspace: publicProcedure
			.input(z.object({ id: z.string() }))
			.query(({ input }) => {
				const orderedWorkspaceIds = getWorkspacesInVisualOrder();
				if (orderedWorkspaceIds.length === 0) return null;

				const currentIndex = orderedWorkspaceIds.indexOf(input.id);
				if (currentIndex === -1) return null;

				const prevIndex =
					currentIndex === 0
						? orderedWorkspaceIds.length - 1
						: currentIndex - 1;
				return orderedWorkspaceIds[prevIndex];
			}),

		getNextWorkspace: publicProcedure
			.input(z.object({ id: z.string() }))
			.query(({ input }) => {
				const orderedWorkspaceIds = getWorkspacesInVisualOrder();
				if (orderedWorkspaceIds.length === 0) return null;

				const currentIndex = orderedWorkspaceIds.indexOf(input.id);
				if (currentIndex === -1) return null;

				const nextIndex =
					currentIndex === orderedWorkspaceIds.length - 1
						? 0
						: currentIndex + 1;
				return orderedWorkspaceIds[nextIndex];
			}),
	});
};
