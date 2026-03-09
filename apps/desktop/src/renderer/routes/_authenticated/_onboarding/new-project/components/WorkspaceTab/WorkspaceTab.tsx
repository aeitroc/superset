import { Button } from "@superset/ui/button";
import { Input } from "@superset/ui/input";
import { useState } from "react";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { useProjectCreationHandler } from "../../hooks/useProjectCreationHandler";

interface WorkspaceTabProps {
	onError: (error: string) => void;
}

export function WorkspaceTab({ onError }: WorkspaceTabProps) {
	const [sourceDir, setSourceDir] = useState("");
	const [workspaceName, setWorkspaceName] = useState("");
	const selectDirectory = electronTrpc.projects.selectDirectory.useMutation();
	const createWorkspace = electronTrpc.projects.createWorkspace.useMutation();
	const { handleResult, handleError } = useProjectCreationHandler(onError);
	const isLoading = createWorkspace.isPending || selectDirectory.isPending;

	const handleBrowse = async () => {
		const result = await selectDirectory.mutateAsync({
			defaultPath: sourceDir || undefined,
		});
		if (!result.canceled && result.path) {
			setSourceDir(result.path);
		}
	};

	const handleCreate = () => {
		if (!sourceDir.trim()) {
			onError("Please select a source project");
			return;
		}
		const trimmedName = workspaceName.trim();
		if (!trimmedName) {
			onError("Please enter a workspace name");
			return;
		}

		createWorkspace.mutate(
			{ sourceDir: sourceDir.trim(), workspaceName: trimmedName },
			{
				onSuccess: (result) =>
					handleResult(result, () => {
						setSourceDir("");
						setWorkspaceName("");
					}),
				onError: handleError,
			},
		);
	};

	return (
		<div className="flex flex-col gap-5">
			<div>
				<label
					htmlFor="source-dir"
					className="block text-sm font-medium text-foreground mb-2"
				>
					Source project
				</label>
				<div className="flex gap-2">
					<Input
						id="source-dir"
						value={sourceDir}
						onChange={(e) => setSourceDir(e.target.value)}
						placeholder="/path/to/existing/project"
						disabled={isLoading}
						className="font-mono text-xs cursor-default"
						readOnly
					/>
					<Button
						variant="outline"
						size="sm"
						onClick={handleBrowse}
						disabled={isLoading}
					>
						Browse
					</Button>
				</div>
			</div>
			<div>
				<label
					htmlFor="workspace-name"
					className="block text-sm font-medium text-foreground mb-2"
				>
					Workspace name
				</label>
				<Input
					id="workspace-name"
					value={workspaceName}
					onChange={(e) => setWorkspaceName(e.target.value)}
					placeholder="my-workspace"
					disabled={isLoading}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !isLoading) {
							handleCreate();
						}
					}}
					autoFocus
				/>
			</div>
			<div className="flex justify-end pt-2 border-t border-border/40">
				<Button onClick={handleCreate} disabled={isLoading} size="sm">
					{isLoading ? "Creating..." : "Create workspace"}
				</Button>
			</div>
		</div>
	);
}
