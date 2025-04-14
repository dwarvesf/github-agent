-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('discord', 'slack');


-- CreateTable
CREATE TABLE "organizations" (
    "id" SERIAL NOT NULL,
    "github_token_id" VARCHAR(255),
    "github_name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "members" (
    "id" SERIAL NOT NULL,
    "github_id" VARCHAR(255) NOT NULL,
    "platform_id" VARCHAR(255) NOT NULL,
    "platform_type" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP,

    CONSTRAINT "members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channels" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "platform" "Platform" NOT NULL DEFAULT 'discord',
    "platform_channel_id" VARCHAR(255) NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP,

    CONSTRAINT "channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" SERIAL NOT NULL,
    "github_repo_name" VARCHAR(255) NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "channel_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_github_name_key" ON "organizations"("github_name");

-- CreateIndex
CREATE UNIQUE INDEX "members_github_id_platform_id_platform_type_key" ON "members"("github_id", "platform_id", "platform_type");

-- CreateIndex
CREATE INDEX "channels_organization_id_idx" ON "channels"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "channels_platform_platform_channel_id_key" ON "channels"("platform", "platform_channel_id");

-- CreateIndex
CREATE INDEX "repositories_channel_id_idx" ON "repositories"("channel_id");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_organization_id_github_repo_name_key" ON "repositories"("organization_id", "github_repo_name");

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
