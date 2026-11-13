ALTER TABLE `exams` ADD `grading_mode` text DEFAULT 'exact' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `grading_status` text DEFAULT 'graded' NOT NULL;--> statement-breakpoint
ALTER TABLE `submissions` ADD `feedback` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `grading_error` text;--> statement-breakpoint
ALTER TABLE `submissions` ADD `grading_started` text;