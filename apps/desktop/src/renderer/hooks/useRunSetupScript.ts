import { toast } from "@superset/ui/sonner";
import { useCallback, useState } from "react";
import { useCreateOrAttachWithTheme } from "renderer/hooks/useCreateOrAttachWithTheme";
import { electronTrpc } from "renderer/lib/electron-trpc";
import { writeCommandsInPane } from "renderer/lib/terminal/launch-command";
import { useTabsStore } from "renderer/stores/tabs/store";

export function useRunSetupScript() {
	const utils = electronTrpc.useUtils();
	const createOrAttach = useCreateOrAttachWithTheme();
	const terminalWrite = electronTrpc.terminal.write.useMutation();
	const addTab = useTabsStore((state) => state.addTab);
	const setTabAutoTitle = useTabsStore((state) => state.setTabAutoTitle);
	const [isPending, setIsPending] = useState(false);

	const run = useCallback(
		async (workspaceId: string) => {
			setIsPending(true);
			try {
				const result = await utils.workspaces.getSetupCommands.fetch({
					workspaceId,
				});

				if (!result?.initialCommands?.length) {
					toast.info("No setup script configured");
					return;
				}

				const { tabId, paneId } = addTab(workspaceId);
				setTabAutoTitle(tabId, "Setup Script");

				await createOrAttach.mutateAsync({
					paneId,
					tabId,
					workspaceId,
				});

				await writeCommandsInPane({
					paneId,
					commands: result.initialCommands,
					write: (input) => terminalWrite.mutateAsync(input),
				});
			} catch (error) {
				toast.error(
					`Failed to run setup script: ${error instanceof Error ? error.message : "Unknown error"}`,
				);
			} finally {
				setIsPending(false);
			}
		},
		[utils, addTab, setTabAutoTitle, createOrAttach, terminalWrite],
	);

	return { run, isPending };
}
