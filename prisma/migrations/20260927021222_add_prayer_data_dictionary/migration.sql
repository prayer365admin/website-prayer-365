/*
  Warnings:

  - A unique constraint covering the columns `[subject,actions,scope]` on the table `permission` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "OrgNodeKind" AS ENUM ('global', 'country', 'diocese', 'deanery', 'church');

-- CreateEnum
CREATE TYPE "ChurchStatus" AS ENUM ('pending', 'approved', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "ReviewState" AS ENUM ('draft', 'submitted', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "RegistrationState" AS ENUM ('unregistered', 'queued', 'registering', 'verification_required', 'ready', 'failed', 'registration_unknown', 'disabled');

-- CreateEnum
CREATE TYPE "AudioStatus" AS ENUM ('queued', 'generating', 'ready', 'approved', 'failed');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('image', 'voice_sample', 'consent_evidence', 'generated_audio');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('pending', 'ready', 'rejected');

-- CreateEnum
CREATE TYPE "RequestKind" AS ENUM ('prayer', 'pastoral', 'meeting');

-- CreateEnum
CREATE TYPE "RequestClassification" AS ENUM ('private', 'standard');

-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('service', 'special', 'bible_study', 'community', 'other');

-- CreateEnum
CREATE TYPE "JobState" AS ENUM ('pending', 'running', 'succeeded', 'failed');

-- AlterTable
ALTER TABLE "role" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "auth_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "locale" CHAR(10),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "role_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "countries" (
    "code" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "languages" (
    "code" CHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "languages_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "org_nodes" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "kind" "OrgNodeKind" NOT NULL,
    "name" TEXT NOT NULL,
    "country_code" CHAR(2),

    CONSTRAINT "org_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "churches" (
    "id" TEXT NOT NULL,
    "org_node_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ChurchStatus" NOT NULL DEFAULT 'pending',
    "timezone" TEXT NOT NULL,
    "description" TEXT,
    "denomination" TEXT,
    "cover_asset_id" TEXT,
    "address" JSONB NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "contacts" JSONB NOT NULL,
    "website" TEXT,
    "social_links" JSONB NOT NULL,
    "accessibility" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "churches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "church_languages" (
    "church_id" TEXT NOT NULL,
    "language_code" TEXT NOT NULL,

    CONSTRAINT "church_languages_pkey" PRIMARY KEY ("church_id","language_code")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "org_node_id" TEXT NOT NULL,
    "granted_by" TEXT NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_churches" (
    "user_id" TEXT NOT NULL,
    "church_id" TEXT NOT NULL,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "is_followed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_churches_pkey" PRIMARY KEY ("user_id","church_id")
);

-- CreateTable
CREATE TABLE "pastors" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "introduction" TEXT,

    CONSTRAINT "pastors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "church_pastors" (
    "church_id" TEXT NOT NULL,
    "pastor_id" TEXT NOT NULL,
    "pastoral_role" TEXT NOT NULL,
    "image_asset_id" TEXT,
    "active_voice_profile_id" TEXT,

    CONSTRAINT "church_pastors_pkey" PRIMARY KEY ("church_id","pastor_id")
);

-- CreateTable
CREATE TABLE "service_times" (
    "id" TEXT NOT NULL,
    "church_id" TEXT NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "local_time" TIME NOT NULL,
    "label" TEXT,
    "language_code" TEXT,

    CONSTRAINT "service_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayers" (
    "id" TEXT NOT NULL,
    "church_id" TEXT NOT NULL,
    "current_version_id" TEXT,
    "published_version_id" TEXT,
    "scheduled_version_id" TEXT,
    "scheduled_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "prayers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayer_versions" (
    "id" TEXT NOT NULL,
    "prayer_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "pastor_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "introduction" TEXT,
    "body" TEXT NOT NULL,
    "language_code" TEXT NOT NULL,
    "text_hash" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "selected_audio_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prayer_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_profiles" (
    "id" TEXT NOT NULL,
    "pastor_id" TEXT NOT NULL,
    "church_id" TEXT NOT NULL,
    "submitted_by" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "replaces_profile_id" TEXT,
    "provider" TEXT NOT NULL,
    "cloning_method" TEXT NOT NULL DEFAULT 'instant',
    "provider_voice_id" TEXT,
    "consent_id" TEXT NOT NULL,
    "sample_asset_id" TEXT NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "review_state" "ReviewState" NOT NULL DEFAULT 'draft',
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_reason" TEXT,
    "approved_sample_checksum" TEXT,
    "registration_state" "RegistrationState" NOT NULL DEFAULT 'unregistered',
    "requires_verification" BOOLEAN,
    "registration_attempt_id" TEXT,
    "last_error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "voice_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "pastor_id" TEXT,
    "purpose" TEXT NOT NULL,
    "terms_version" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" TEXT,
    "evidence_asset_id" TEXT,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prayer_audio" (
    "id" TEXT NOT NULL,
    "prayer_version_id" TEXT NOT NULL,
    "voice_profile_id" TEXT NOT NULL,
    "status" "AudioStatus" NOT NULL DEFAULT 'queued',
    "asset_id" TEXT,
    "provider_request_id" TEXT,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "prayer_audio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "church_id" TEXT NOT NULL,
    "object_key" TEXT NOT NULL,
    "purpose" "MediaPurpose" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "checksum" TEXT,
    "status" "MediaStatus" NOT NULL DEFAULT 'pending',
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "church_id" TEXT NOT NULL,
    "category" "EventCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL,
    "registration_url" TEXT,
    "language_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "church_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "church_id" TEXT NOT NULL,
    "user_id" TEXT,
    "kind" "RequestKind" NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "classification" "RequestClassification",
    "contact_method" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "availability" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_accounts" (
    "id" TEXT NOT NULL,
    "church_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "payment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_subscriptions" (
    "id" TEXT NOT NULL,
    "payment_account_id" TEXT NOT NULL,
    "user_id" TEXT,
    "provider_subscription_id" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "provider_status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "donation_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "payment_account_id" TEXT NOT NULL,
    "user_id" TEXT,
    "subscription_id" TEXT,
    "provider_payment_id" TEXT NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3),
    "refunded_minor" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL,
    "church_id" TEXT NOT NULL,
    "user_id" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "local_date" DATE NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "event_key" TEXT NOT NULL,
    "church_id" TEXT,
    "user_id" TEXT,
    "event_type" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resource_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "installation_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "token_ciphertext" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "disabled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id","type")
);

-- CreateTable
CREATE TABLE "notification_rules" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "offset_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "notification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_token_id" TEXT,
    "event_key" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_jobs" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "resource_id" TEXT,
    "payload" JSONB,
    "available_at" TIMESTAMP(3) NOT NULL,
    "state" "JobState" NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lease_until" TIMESTAMP(3),
    "last_error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "outbox_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_receipts" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "state" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "actor_key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "resource_id" TEXT,
    "state" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "church_id" TEXT,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "outcome" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "privacy_jobs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "result_object_key" TEXT,
    "result_expires_at" TIMESTAMP(3),

    CONSTRAINT "privacy_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "org_nodes_country_code_key" ON "org_nodes"("country_code");

-- CreateIndex
CREATE INDEX "org_nodes_parent_id_idx" ON "org_nodes"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_nodes_kind_country_code_key" ON "org_nodes"("kind", "country_code");

-- CreateIndex
CREATE UNIQUE INDEX "churches_org_node_id_key" ON "churches"("org_node_id");

-- CreateIndex
CREATE INDEX "role_assignments_user_id_org_node_id_idx" ON "role_assignments"("user_id", "org_node_id");

-- CreateIndex
CREATE INDEX "user_churches_church_id_idx" ON "user_churches"("church_id");

-- CreateIndex
CREATE UNIQUE INDEX "pastors_user_id_key" ON "pastors"("user_id");

-- CreateIndex
CREATE INDEX "service_times_church_id_idx" ON "service_times"("church_id");

-- CreateIndex
CREATE INDEX "prayers_church_id_created_at_id_idx" ON "prayers"("church_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "prayers_church_id_published_at_id_idx" ON "prayers"("church_id", "published_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "prayer_versions_selected_audio_id_key" ON "prayer_versions"("selected_audio_id");

-- CreateIndex
CREATE INDEX "prayer_versions_prayer_id_idx" ON "prayer_versions"("prayer_id");

-- CreateIndex
CREATE UNIQUE INDEX "prayer_versions_prayer_id_version_number_key" ON "prayer_versions"("prayer_id", "version_number");

-- CreateIndex
CREATE INDEX "voice_profiles_church_id_idx" ON "voice_profiles"("church_id");

-- CreateIndex
CREATE INDEX "voice_profiles_pastor_id_idx" ON "voice_profiles"("pastor_id");

-- CreateIndex
CREATE INDEX "prayer_audio_prayer_version_id_idx" ON "prayer_audio"("prayer_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_object_key_key" ON "media_assets"("object_key");

-- CreateIndex
CREATE INDEX "media_assets_church_id_idx" ON "media_assets"("church_id");

-- CreateIndex
CREATE INDEX "events_church_id_starts_at_id_idx" ON "events"("church_id", "starts_at", "id");

-- CreateIndex
CREATE INDEX "announcements_church_id_published_at_idx" ON "announcements"("church_id", "published_at");

-- CreateIndex
CREATE INDEX "requests_church_id_created_at_id_idx" ON "requests"("church_id", "created_at", "id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_accounts_church_id_key" ON "payment_accounts"("church_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_accounts_provider_account_id_key" ON "payment_accounts"("provider_account_id");

-- CreateIndex
CREATE INDEX "donation_subscriptions_payment_account_id_provider_status_idx" ON "donation_subscriptions"("payment_account_id", "provider_status");

-- CreateIndex
CREATE UNIQUE INDEX "donation_subscriptions_payment_account_id_provider_subscrip_key" ON "donation_subscriptions"("payment_account_id", "provider_subscription_id");

-- CreateIndex
CREATE INDEX "donations_payment_account_id_paid_at_idx" ON "donations"("payment_account_id", "paid_at");

-- CreateIndex
CREATE UNIQUE INDEX "donations_payment_account_id_provider_payment_id_key" ON "donations"("payment_account_id", "provider_payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_dedupe_key_key" ON "check_ins"("dedupe_key");

-- CreateIndex
CREATE INDEX "check_ins_church_id_occurred_at_idx" ON "check_ins"("church_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_events_event_key_key" ON "analytics_events"("event_key");

-- CreateIndex
CREATE INDEX "analytics_events_church_id_occurred_at_idx" ON "analytics_events"("church_id", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "device_tokens_token_hash_key" ON "device_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "notification_rules_type_key" ON "notification_rules"("type");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_created_at_idx" ON "notification_deliveries"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_event_key_user_id_device_token_id_key" ON "notification_deliveries"("event_key", "user_id", "device_token_id");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_jobs_dedupe_key_key" ON "outbox_jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "outbox_jobs_state_available_at_idx" ON "outbox_jobs"("state", "available_at");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_receipts_provider_account_id_event_id_key" ON "webhook_receipts"("provider", "account_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_actor_key_operation_key_key" ON "idempotency_records"("actor_key", "operation", "key");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_church_id_idx" ON "audit_logs"("church_id");

-- CreateIndex
CREATE INDEX "privacy_jobs_user_id_idx" ON "privacy_jobs"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "permission_subject_actions_scope_key" ON "permission"("subject", "actions", "scope");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_locale_fkey" FOREIGN KEY ("locale") REFERENCES "languages"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_nodes" ADD CONSTRAINT "org_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "org_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_nodes" ADD CONSTRAINT "org_nodes_country_code_fkey" FOREIGN KEY ("country_code") REFERENCES "countries"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "churches" ADD CONSTRAINT "churches_org_node_id_fkey" FOREIGN KEY ("org_node_id") REFERENCES "org_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "churches" ADD CONSTRAINT "churches_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "churches" ADD CONSTRAINT "churches_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "church_languages" ADD CONSTRAINT "church_languages_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "church_languages" ADD CONSTRAINT "church_languages_language_code_fkey" FOREIGN KEY ("language_code") REFERENCES "languages"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_org_node_id_fkey" FOREIGN KEY ("org_node_id") REFERENCES "org_nodes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_churches" ADD CONSTRAINT "user_churches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_churches" ADD CONSTRAINT "user_churches_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pastors" ADD CONSTRAINT "pastors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "church_pastors" ADD CONSTRAINT "church_pastors_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "church_pastors" ADD CONSTRAINT "church_pastors_pastor_id_fkey" FOREIGN KEY ("pastor_id") REFERENCES "pastors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "church_pastors" ADD CONSTRAINT "church_pastors_image_asset_id_fkey" FOREIGN KEY ("image_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "church_pastors" ADD CONSTRAINT "church_pastors_active_voice_profile_id_fkey" FOREIGN KEY ("active_voice_profile_id") REFERENCES "voice_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_times" ADD CONSTRAINT "service_times_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayers" ADD CONSTRAINT "prayers_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayers" ADD CONSTRAINT "prayers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_versions" ADD CONSTRAINT "prayer_versions_prayer_id_fkey" FOREIGN KEY ("prayer_id") REFERENCES "prayers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_versions" ADD CONSTRAINT "prayer_versions_pastor_id_fkey" FOREIGN KEY ("pastor_id") REFERENCES "pastors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_versions" ADD CONSTRAINT "prayer_versions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_versions" ADD CONSTRAINT "prayer_versions_selected_audio_id_fkey" FOREIGN KEY ("selected_audio_id") REFERENCES "prayer_audio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_pastor_id_fkey" FOREIGN KEY ("pastor_id") REFERENCES "pastors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_replaces_profile_id_fkey" FOREIGN KEY ("replaces_profile_id") REFERENCES "voice_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "consents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_sample_asset_id_fkey" FOREIGN KEY ("sample_asset_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_pastor_id_fkey" FOREIGN KEY ("pastor_id") REFERENCES "pastors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_evidence_asset_id_fkey" FOREIGN KEY ("evidence_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_audio" ADD CONSTRAINT "prayer_audio_prayer_version_id_fkey" FOREIGN KEY ("prayer_version_id") REFERENCES "prayer_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_audio" ADD CONSTRAINT "prayer_audio_voice_profile_id_fkey" FOREIGN KEY ("voice_profile_id") REFERENCES "voice_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_audio" ADD CONSTRAINT "prayer_audio_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prayer_audio" ADD CONSTRAINT "prayer_audio_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_subscriptions" ADD CONSTRAINT "donation_subscriptions_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_subscriptions" ADD CONSTRAINT "donation_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "donation_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_church_id_fkey" FOREIGN KEY ("church_id") REFERENCES "churches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "notification_rules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_device_token_id_fkey" FOREIGN KEY ("device_token_id") REFERENCES "device_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "privacy_jobs" ADD CONSTRAINT "privacy_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
