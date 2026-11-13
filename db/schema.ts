import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
export const exams = sqliteTable('exams', { id:text('id').primaryKey(), owner:text('owner').notNull(), title:text('title').notNull(), level:text('level').notNull(), instructions:text('instructions').notNull(), body:text('body').notNull(), created:text('created').notNull(), gradingMode:text('grading_mode').notNull().default('exact'), audioJson:text('audio_json'),accepting:integer('accepting').notNull().default(1),durationMinutes:integer('duration_minutes') });
export const submissions = sqliteTable('submissions', { id:text('id').primaryKey(), examId:text('exam_id').notNull().references(()=>exams.id), name:text('name').notNull(), course:text('course'), answers:text('answers').notNull(), score:integer('score').notNull(), total:integer('total').notNull(), created:text('created').notNull(), gradingStatus:text('grading_status').notNull().default('graded'), feedback:text('feedback'), gradingError:text('grading_error'), gradingStarted:text('grading_started') });

export const audioFiles = sqliteTable('audio_files', {id:text('id').primaryKey(),owner:text('owner').notNull(),uploaderId:text('uploader_id').notNull(),objectKey:text('object_key').notNull(),name:text('name').notNull(),mime:text('mime').notNull(),size:integer('size').notNull(),created:text('created').notNull()});
export const teacherLegacyClaims=sqliteTable('teacher_legacy_claims',{legacyHash:text('legacy_hash').primaryKey(),userId:text('user_id').notNull(),created:text('created').notNull()});
export const teacherDrafts=sqliteTable('teacher_drafts',{userId:text('user_id').primaryKey(),payload:text('payload').notNull(),revision:integer('revision').notNull().default(0),updated:text('updated').notNull()});
export const schoolSettings=sqliteTable('school_settings',{id:text('id').primaryKey(),name:text('name').notNull(),created:integer('created').notNull(),setupClaim:text('setup_claim').notNull()});
export const schoolUsers=sqliteTable('school_users',{id:text('id').primaryKey(),schoolId:text('school_id').notNull(),email:text('email').notNull().unique(),displayName:text('display_name').notNull(),passwordHash:text('password_hash').notNull(),role:text('role').notNull(),active:integer('active').notNull().default(1),created:integer('created').notNull()});
export const schoolSessions=sqliteTable('school_sessions',{tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull(),expires:integer('expires').notNull(),created:integer('created').notNull()});
export const schoolInvites=sqliteTable('school_invites',{id:text('id').primaryKey(),schoolId:text('school_id').notNull(),email:text('email').notNull(),displayName:text('display_name').notNull(),role:text('role').notNull(),kind:text('kind').notNull(),tokenHash:text('token_hash').notNull().unique(),expires:integer('expires').notNull(),usedAt:integer('used_at'),revoked:integer('revoked').notNull().default(0),created:integer('created').notNull(),createdBy:text('created_by').notNull(),claimId:text('claim_id')});
export const schoolAuthLimits=sqliteTable('school_auth_limits',{keyHash:text('key_hash').primaryKey(),attempts:integer('attempts').notNull(),resetAt:integer('reset_at').notNull()});

export const submissionReviews=sqliteTable('submission_reviews',{
 submissionId:text('submission_id').primaryKey().references(()=>submissions.id),
 finalGrade:real('final_grade').notNull(),feedback:text('feedback').notNull(),
 writingFeedback:text('writing_feedback').notNull(),reviewedBy:text('reviewed_by').notNull(),
 updated:text('updated').notNull(),revision:integer('revision').notNull().default(1)
});

export const examAttempts=sqliteTable('exam_attempts',{
 id:text('id').primaryKey(),examId:text('exam_id').notNull().references(()=>exams.id),tokenHash:text('token_hash').notNull(),
 name:text('name').notNull(),course:text('course').notNull(),started:integer('started').notNull(),deadline:integer('deadline').notNull(),
 answers:text('answers').notNull().default('{}'),revision:integer('revision').notNull().default(0)
});
export const submissionAccess=sqliteTable('submission_access',{submissionId:text('submission_id').primaryKey().references(()=>submissions.id),tokenHash:text('token_hash').notNull()});
export const submissionPublications=sqliteTable('submission_publications',{
 submissionId:text('submission_id').primaryKey().references(()=>submissions.id),payload:text('payload').notNull(),reviewRevision:integer('review_revision').notNull(),
 published:text('published').notNull(),shareHash:text('share_hash')
});
export const backupImports=sqliteTable('backup_imports',{id:text('id').primaryKey(),created:text('created').notNull(),summary:text('summary').notNull()});
