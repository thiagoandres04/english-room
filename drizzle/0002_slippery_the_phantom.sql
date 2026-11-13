CREATE TABLE `audio_files` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`uploader_id` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`created` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `exams` ADD `audio_json` text;