/*
  Warnings:

  - You are about to drop the `RouteResource` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "RouteResource" DROP CONSTRAINT "RouteResource_resourceId_fkey";

-- DropForeignKey
ALTER TABLE "RouteResource" DROP CONSTRAINT "RouteResource_routeId_fkey";

-- AlterTable
ALTER TABLE "ChatSession" ADD COLUMN     "moduleId" INTEGER;

-- DropTable
DROP TABLE "RouteResource";

-- CreateTable
CREATE TABLE "Module" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "routeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModuleResource" (
    "id" SERIAL NOT NULL,
    "moduleId" INTEGER NOT NULL,
    "resourceId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "ModuleResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ModuleResource_moduleId_resourceId_key" ON "ModuleResource"("moduleId", "resourceId");

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "LearningRoute"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleResource" ADD CONSTRAINT "ModuleResource_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModuleResource" ADD CONSTRAINT "ModuleResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
