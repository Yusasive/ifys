-- AlterEnum
ALTER TYPE "OrderProvider" ADD VALUE 'free';

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN "categories" "Category"[] DEFAULT ARRAY[]::"Category"[];
