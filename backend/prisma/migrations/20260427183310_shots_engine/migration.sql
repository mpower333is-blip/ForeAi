/*
  Warnings:

  - You are about to drop the column `distance` on the `Shot` table. All the data in the column will be lost.
  - Added the required column `yardage` to the `Shot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Shot" DROP COLUMN "distance",
ADD COLUMN     "dispersion" TEXT,
ADD COLUMN     "elevation" INTEGER,
ADD COLUMN     "expectedStrokes" DOUBLE PRECISION,
ADD COLUMN     "strokesGained" DOUBLE PRECISION,
ADD COLUMN     "wind" INTEGER,
ADD COLUMN     "yardage" INTEGER NOT NULL;
