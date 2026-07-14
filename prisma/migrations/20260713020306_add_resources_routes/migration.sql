/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `Resource` table. All the data in the column will be lost.
  - You are about to drop the column `uploaderId` on the `Resource` table. All the data in the column will be lost.
  - Added the required column `authorId` to the `Resource` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `Resource` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `Resource` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "ResourceType" AS ENUM ('LINK', 'PDF', 'VIDEO', 'IMAGE');

-- CreateEnum
CREATE TYPE "RouteDifficulty" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- DropForeignKey
ALTER TABLE "Resource" DROP CONSTRAINT "Resource_uploaderId_fkey";

-- AlterTable
ALTER TABLE "Resource" DROP COLUMN "fileUrl",
DROP COLUMN "uploaderId",
ADD COLUMN     "authorId" INTEGER NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "url" TEXT NOT NULL,
DROP COLUMN "type",
ADD COLUMN     "type" "ResourceType" NOT NULL;

-- CreateTable
CREATE TABLE "LearningRoute" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "estimatedTime" INTEGER,
    "difficulty" "RouteDifficulty" NOT NULL DEFAULT 'BEGINNER',
    "authorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteResource" (
    "id" SERIAL NOT NULL,
    "routeId" INTEGER NOT NULL,
    "resourceId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "RouteResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RouteResource_routeId_resourceId_key" ON "RouteResource"("routeId", "resourceId");

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningRoute" ADD CONSTRAINT "LearningRoute_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteResource" ADD CONSTRAINT "RouteResource_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "LearningRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteResource" ADD CONSTRAINT "RouteResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
