-- AlterTable
ALTER TABLE "check_ins" ADD COLUMN "client_scan_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "check_ins_client_scan_id_key" ON "check_ins"("client_scan_id");
