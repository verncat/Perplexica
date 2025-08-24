ALTER TABLE `chats` ADD `optimizationMode` text DEFAULT 'speed' NOT NULL;--> statement-breakpoint
ALTER TABLE `chats` ADD `maxIterations` integer DEFAULT 2 NOT NULL;