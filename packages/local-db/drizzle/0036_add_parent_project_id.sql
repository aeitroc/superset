ALTER TABLE `projects` ADD `parent_project_id` text REFERENCES projects(id);--> statement-breakpoint
CREATE INDEX `projects_parent_project_id_idx` ON `projects` (`parent_project_id`);