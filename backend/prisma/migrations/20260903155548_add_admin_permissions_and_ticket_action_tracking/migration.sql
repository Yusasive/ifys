-- CreateEnum
CREATE TYPE "TicketActionType" AS ENUM ('reissued', 'voided', 'restored', 'withdrawn');

-- AlterTable
ALTER TABLE "admin_users" ADD COLUMN     "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "last_action_at" TIMESTAMP(3),
ADD COLUMN     "last_action_by_admin_id" TEXT,
ADD COLUMN     "last_action_reason" TEXT,
ADD COLUMN     "last_action_type" "TicketActionType";
