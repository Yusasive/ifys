-- CreateTable
CREATE TABLE "email_broadcast_failures" (
    "id" TEXT NOT NULL,
    "broadcast_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "failed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_broadcast_failures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_broadcast_failures_broadcast_id_email_key" ON "email_broadcast_failures"("broadcast_id", "email");

-- AddForeignKey
ALTER TABLE "email_broadcast_failures" ADD CONSTRAINT "email_broadcast_failures_broadcast_id_fkey" FOREIGN KEY ("broadcast_id") REFERENCES "email_broadcasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
