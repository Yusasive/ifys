-- CreateEnum
CREATE TYPE "SponsorType" AS ENUM ('sponsor', 'partner');

-- CreateEnum
CREATE TYPE "SponsorApplicationStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "sponsors" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "type" "SponsorType" NOT NULL,
    "name" TEXT NOT NULL,
    "website_url" TEXT,
    "logo_key" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sponsor_applications" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "type" "SponsorType" NOT NULL,
    "organization_name" TEXT NOT NULL,
    "contact_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "message" TEXT,
    "logo_key" TEXT,
    "status" "SponsorApplicationStatus" NOT NULL DEFAULT 'pending',
    "reviewed_at" TIMESTAMP(3),
    "sponsor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sponsor_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sponsor_applications_sponsor_id_key" ON "sponsor_applications"("sponsor_id");

-- AddForeignKey
ALTER TABLE "sponsors" ADD CONSTRAINT "sponsors_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsor_applications" ADD CONSTRAINT "sponsor_applications_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sponsor_applications" ADD CONSTRAINT "sponsor_applications_sponsor_id_fkey" FOREIGN KEY ("sponsor_id") REFERENCES "sponsors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
