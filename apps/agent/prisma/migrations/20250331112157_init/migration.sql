-- CreateEnum
CREATE TYPE "EventCategory" AS ENUM ('NOTIFICATION_DISCORD', 'NOTIFICATION_SLACK', 'NOTIFICATION_EMAIL', 'ACTIVITY', 'ERROR');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('REMINDER_SENT', 'PR_NOTIFIED', 'COMMENT_NOTIFIED', 'MENTION_NOTIFIED', 'REPORT_PR_LIST', 'REPORT_PR_DETAILS', 'PR_CREATED', 'PR_UPDATED', 'PR_REVIEWED', 'PR_MERGED', 'PR_CLOSED', 'PR_STALLED', 'SYSTEM_STARTED', 'SYSTEM_STOPPED', 'SYSTEM_ERROR', 'CONFIG_CHANGED', 'USER_LOGIN', 'USER_LOGOUT', 'PERMISSION_CHANGED', 'USER_ACTION');

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "event_category" VARCHAR(100) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "actor_id" VARCHAR(255),
    "repository_id" VARCHAR(255),
    "workflow_id" VARCHAR(255),
    "organization_id" VARCHAR(255) NOT NULL,
    "event_data" JSONB NOT NULL,
    "metadata" JSONB,
    "context_id" VARCHAR(255),
    "parent_event_id" VARCHAR(255),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP,
    "resolved_at" TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_category_idx" ON "events"("event_category");

-- CreateIndex
CREATE INDEX "event_type_idx" ON "events"("event_type");

-- CreateIndex
CREATE INDEX "created_at_idx" ON "events"("created_at");

-- CreateIndex
CREATE INDEX "organization_id_idx" ON "events"("organization_id");

-- CreateIndex
CREATE INDEX "context_id_idx" ON "events"("context_id");

-- CreateIndex
CREATE INDEX "tags_idx" ON "events"("tags");

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_parent_event_id_fkey" FOREIGN KEY ("parent_event_id") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
