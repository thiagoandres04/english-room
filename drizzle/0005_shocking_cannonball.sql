CREATE TABLE `school_auth_limits` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `school_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`kind` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires` integer NOT NULL,
	`used_at` integer,
	`revoked` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	`created_by` text NOT NULL,
	`claim_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_invites_token_hash_unique` ON `school_invites` (`token_hash`);--> statement-breakpoint
CREATE TABLE `school_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `school_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created` integer NOT NULL,
	`setup_claim` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `school_users` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `school_users_email_unique` ON `school_users` (`email`);