/*
  Warnings:

  - The values [queued,generating,ready,approved,failed] on the enum `AudioStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [pending,approved,suspended,archived] on the enum `ChurchStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [service,special,bible_study,community,other] on the enum `EventCategory` will be removed. If these variants are still used in the database, this will fail.
  - The values [pending,running,succeeded,failed] on the enum `JobState` will be removed. If these variants are still used in the database, this will fail.
  - The values [image,voice_sample,consent_evidence,generated_audio] on the enum `MediaPurpose` will be removed. If these variants are still used in the database, this will fail.
  - The values [pending,ready,rejected] on the enum `MediaStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [global,country,diocese,deanery,church] on the enum `OrgNodeKind` will be removed. If these variants are still used in the database, this will fail.
  - The values [unregistered,queued,registering,verification_required,ready,failed,registration_unknown,disabled] on the enum `RegistrationState` will be removed. If these variants are still used in the database, this will fail.
  - The values [private,standard] on the enum `RequestClassification` will be removed. If these variants are still used in the database, this will fail.
  - The values [prayer,pastoral,meeting] on the enum `RequestKind` will be removed. If these variants are still used in the database, this will fail.
  - The values [draft,submitted,approved,rejected] on the enum `ReviewState` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AudioStatus_new" AS ENUM ('QUEUED', 'GENERATING', 'READY', 'APPROVED', 'FAILED');
ALTER TABLE "public"."prayer_audio" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "prayer_audio" ALTER COLUMN "status" TYPE "AudioStatus_new" USING ("status"::text::"AudioStatus_new");
ALTER TYPE "AudioStatus" RENAME TO "AudioStatus_old";
ALTER TYPE "AudioStatus_new" RENAME TO "AudioStatus";
DROP TYPE "public"."AudioStatus_old";
ALTER TABLE "prayer_audio" ALTER COLUMN "status" SET DEFAULT 'QUEUED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ChurchStatus_new" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED', 'ARCHIVED');
ALTER TABLE "public"."churches" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "churches" ALTER COLUMN "status" TYPE "ChurchStatus_new" USING ("status"::text::"ChurchStatus_new");
ALTER TYPE "ChurchStatus" RENAME TO "ChurchStatus_old";
ALTER TYPE "ChurchStatus_new" RENAME TO "ChurchStatus";
DROP TYPE "public"."ChurchStatus_old";
ALTER TABLE "churches" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "EventCategory_new" AS ENUM ('SERVICE', 'SPECIAL', 'BIBLE_STUDY', 'COMMUNITY', 'OTHER');
ALTER TABLE "events" ALTER COLUMN "category" TYPE "EventCategory_new" USING ("category"::text::"EventCategory_new");
ALTER TYPE "EventCategory" RENAME TO "EventCategory_old";
ALTER TYPE "EventCategory_new" RENAME TO "EventCategory";
DROP TYPE "public"."EventCategory_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "JobState_new" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');
ALTER TABLE "public"."outbox_jobs" ALTER COLUMN "state" DROP DEFAULT;
ALTER TABLE "outbox_jobs" ALTER COLUMN "state" TYPE "JobState_new" USING ("state"::text::"JobState_new");
ALTER TYPE "JobState" RENAME TO "JobState_old";
ALTER TYPE "JobState_new" RENAME TO "JobState";
DROP TYPE "public"."JobState_old";
ALTER TABLE "outbox_jobs" ALTER COLUMN "state" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "MediaPurpose_new" AS ENUM ('IMAGE', 'VOICE_SAMPLE', 'CONSENT_EVIDENCE', 'GENERATED_AUDIO');
ALTER TABLE "media_assets" ALTER COLUMN "purpose" TYPE "MediaPurpose_new" USING ("purpose"::text::"MediaPurpose_new");
ALTER TYPE "MediaPurpose" RENAME TO "MediaPurpose_old";
ALTER TYPE "MediaPurpose_new" RENAME TO "MediaPurpose";
DROP TYPE "public"."MediaPurpose_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "MediaStatus_new" AS ENUM ('PENDING', 'READY', 'REJECTED');
ALTER TABLE "public"."media_assets" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "media_assets" ALTER COLUMN "status" TYPE "MediaStatus_new" USING ("status"::text::"MediaStatus_new");
ALTER TYPE "MediaStatus" RENAME TO "MediaStatus_old";
ALTER TYPE "MediaStatus_new" RENAME TO "MediaStatus";
DROP TYPE "public"."MediaStatus_old";
ALTER TABLE "media_assets" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OrgNodeKind_new" AS ENUM ('GLOBAL', 'COUNTRY', 'DIOCESE', 'DEANERY', 'CHURCH');
ALTER TABLE "org_nodes" ALTER COLUMN "kind" TYPE "OrgNodeKind_new" USING ("kind"::text::"OrgNodeKind_new");
ALTER TYPE "OrgNodeKind" RENAME TO "OrgNodeKind_old";
ALTER TYPE "OrgNodeKind_new" RENAME TO "OrgNodeKind";
DROP TYPE "public"."OrgNodeKind_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "RegistrationState_new" AS ENUM ('UNREGISTERED', 'QUEUED', 'REGISTERING', 'VERIFICATION_REQUIRED', 'READY', 'FAILED', 'REGISTRATION_UNKNOWN', 'DISABLED');
ALTER TABLE "public"."voice_profiles" ALTER COLUMN "registration_state" DROP DEFAULT;
ALTER TABLE "voice_profiles" ALTER COLUMN "registration_state" TYPE "RegistrationState_new" USING ("registration_state"::text::"RegistrationState_new");
ALTER TYPE "RegistrationState" RENAME TO "RegistrationState_old";
ALTER TYPE "RegistrationState_new" RENAME TO "RegistrationState";
DROP TYPE "public"."RegistrationState_old";
ALTER TABLE "voice_profiles" ALTER COLUMN "registration_state" SET DEFAULT 'UNREGISTERED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "RequestClassification_new" AS ENUM ('PRIVATE', 'STANDARD');
ALTER TABLE "requests" ALTER COLUMN "classification" TYPE "RequestClassification_new" USING ("classification"::text::"RequestClassification_new");
ALTER TYPE "RequestClassification" RENAME TO "RequestClassification_old";
ALTER TYPE "RequestClassification_new" RENAME TO "RequestClassification";
DROP TYPE "public"."RequestClassification_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "RequestKind_new" AS ENUM ('PRAYER', 'PASTORAL', 'MEETING');
ALTER TABLE "requests" ALTER COLUMN "kind" TYPE "RequestKind_new" USING ("kind"::text::"RequestKind_new");
ALTER TYPE "RequestKind" RENAME TO "RequestKind_old";
ALTER TYPE "RequestKind_new" RENAME TO "RequestKind";
DROP TYPE "public"."RequestKind_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ReviewState_new" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
ALTER TABLE "public"."voice_profiles" ALTER COLUMN "review_state" DROP DEFAULT;
ALTER TABLE "voice_profiles" ALTER COLUMN "review_state" TYPE "ReviewState_new" USING ("review_state"::text::"ReviewState_new");
ALTER TYPE "ReviewState" RENAME TO "ReviewState_old";
ALTER TYPE "ReviewState_new" RENAME TO "ReviewState";
DROP TYPE "public"."ReviewState_old";
ALTER TABLE "voice_profiles" ALTER COLUMN "review_state" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterTable
ALTER TABLE "churches" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "media_assets" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "outbox_jobs" ALTER COLUMN "state" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "prayer_audio" ALTER COLUMN "status" SET DEFAULT 'QUEUED';

-- AlterTable
ALTER TABLE "voice_profiles" ALTER COLUMN "review_state" SET DEFAULT 'DRAFT',
ALTER COLUMN "registration_state" SET DEFAULT 'UNREGISTERED';
