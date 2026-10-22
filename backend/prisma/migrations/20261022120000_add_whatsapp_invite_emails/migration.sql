-- AlterEnum
ALTER TYPE "TicketEmailKind" ADD VALUE 'whatsapp_invite';

-- AlterTable
ALTER TABLE "events" ADD COLUMN "whatsapp_group_url" TEXT;
