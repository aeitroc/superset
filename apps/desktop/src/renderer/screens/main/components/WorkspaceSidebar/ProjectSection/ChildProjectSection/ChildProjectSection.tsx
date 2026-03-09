import { cn } from "@superset/ui/utils";
import { AnimatePresence, motion } from "framer-motion";
import { HiChevronRight } from "react-icons/hi2";
import { useWorkspaceSidebarStore } from "renderer/stores";
import { WorkspaceListItem } from "../../WorkspaceListItem";
import { ProjectThumbnail } from "../ProjectThumbnail";

interface Workspace {
	id: string;
	projectId: string;
	worktreePath: string;
	type: "worktree" | "branch";
	branch: string;
	name: string;
	tabOrder: number;
	isUnread: boolean;
}

interface ChildProjectSectionProps {
	projectId: string;
	projectName: string;
	projectColor: string;
	githubOwner: string | null;
	mainRepoPath: string;
	hideImage: boolean;
	iconUrl: string | null;
	workspaces: Workspace[];
	shortcutBaseIndex: number;
}

export function ChildProjectSection({
	projectId,
	projectName,
	projectColor,
	githubOwner,
	mainRepoPath,
	hideImage,
	iconUrl,
	workspaces,
	shortcutBaseIndex,
}: ChildProjectSectionProps) {
	const { isProjectCollapsed, toggleProjectCollapsed } =
		useWorkspaceSidebarStore();

	const isCollapsed = isProjectCollapsed(projectId);

	return (
		<div className="pl-4">
			<button
				type="button"
				onClick={() => toggleProjectCollapsed(projectId)}
				className={cn(
					"flex items-center gap-2 w-full pl-2 pr-2 py-1 text-sm",
					"hover:bg-muted/50 transition-colors text-left cursor-pointer",
				)}
			>
				<HiChevronRight
					className={cn(
						"size-3 text-muted-foreground transition-transform duration-150 shrink-0",
						!isCollapsed && "rotate-90",
					)}
				/>
				<ProjectThumbnail
					projectId={projectId}
					projectName={projectName}
					projectColor={projectColor}
					githubOwner={githubOwner}
					hideImage={hideImage}
					iconUrl={iconUrl}
				/>
				<span className="truncate text-muted-foreground">
					{projectName}
				</span>
				<span className="text-xs text-muted-foreground/60 tabular-nums font-normal">
					({workspaces.length})
				</span>
			</button>

			<AnimatePresence initial={false}>
				{!isCollapsed && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.15, ease: "easeOut" }}
						className="overflow-hidden"
					>
						<div className="pb-1">
							{workspaces.map((workspace, wsIndex) => (
								<WorkspaceListItem
									key={workspace.id}
									id={workspace.id}
									projectId={workspace.projectId}
									worktreePath={workspace.worktreePath}
									name={workspace.name}
									branch={workspace.branch}
									type={workspace.type}
									isUnread={workspace.isUnread}
									index={wsIndex}
									shortcutIndex={
										shortcutBaseIndex + wsIndex
									}
								/>
							))}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
