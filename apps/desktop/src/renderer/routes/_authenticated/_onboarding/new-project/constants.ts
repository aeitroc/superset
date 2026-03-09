export const NEW_PROJECT_MODES = [
	"empty",
	"clone",
	"template",
	"workspace",
] as const;

export type NewProjectMode = (typeof NEW_PROJECT_MODES)[number];
