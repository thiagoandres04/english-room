CREATE TABLE `submission_reviews` (
	`submission_id` text PRIMARY KEY NOT NULL,
	`final_grade` real NOT NULL,
	`feedback` text NOT NULL,
	`writing_feedback` text NOT NULL,
	`reviewed_by` text NOT NULL,
	`updated` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON UPDATE no action ON DELETE no action
);
