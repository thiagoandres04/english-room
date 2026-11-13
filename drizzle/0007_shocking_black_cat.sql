CREATE TABLE `backup_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`created` text NOT NULL,
	`summary` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exam_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`exam_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`name` text NOT NULL,
	`course` text NOT NULL,
	`started` integer NOT NULL,
	`deadline` integer NOT NULL,
	`answers` text DEFAULT '{}' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `submission_access` (
	`submission_id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `submission_publications` (
	`submission_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`review_revision` integer NOT NULL,
	`published` text NOT NULL,
	`share_hash` text,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `exams` ADD `accepting` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `exams` ADD `duration_minutes` integer;