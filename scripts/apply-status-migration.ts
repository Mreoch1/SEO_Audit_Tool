import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

async function applyMigration() {
  try {
    console.log('Applying status field migration...')
    
    // Use Prisma's raw SQL to alter the table
    await prisma.$executeRaw`
      PRAGMA foreign_keys=OFF;
      CREATE TABLE "new_Audit" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "url" TEXT NOT NULL,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL,
        "archived" BOOLEAN NOT NULL DEFAULT false,
        "status" TEXT NOT NULL DEFAULT 'completed',
        "overallScore" INTEGER NOT NULL DEFAULT 0,
        "technicalScore" INTEGER NOT NULL DEFAULT 0,
        "onPageScore" INTEGER NOT NULL DEFAULT 0,
        "contentScore" INTEGER NOT NULL DEFAULT 0,
        "accessibilityScore" INTEGER NOT NULL DEFAULT 0,
        "shortSummary" TEXT NOT NULL DEFAULT '',
        "detailedSummary" TEXT NOT NULL DEFAULT '',
        "rawJson" TEXT
      );
    `
    
    await prisma.$executeRaw`
      INSERT INTO "new_Audit" 
      ("accessibilityScore", "archived", "contentScore", "createdAt", "detailedSummary", "id", "onPageScore", "overallScore", "rawJson", "shortSummary", "technicalScore", "updatedAt", "url") 
      SELECT 
        COALESCE("accessibilityScore", 0),
        COALESCE("archived", false),
        COALESCE("contentScore", 0),
        "createdAt",
        COALESCE("detailedSummary", ''),
        "id",
        COALESCE("onPageScore", 0),
        COALESCE("overallScore", 0),
        "rawJson",
        COALESCE("shortSummary", ''),
        COALESCE("technicalScore", 0),
        "updatedAt",
        "url"
      FROM "Audit";
    `
    
    await prisma.$executeRaw`DROP TABLE "Audit";`
    await prisma.$executeRaw`ALTER TABLE "new_Audit" RENAME TO "Audit";`
    await prisma.$executeRaw`PRAGMA foreign_keys=ON;`
    
    console.log('✅ Migration applied successfully!')
    console.log('Now run: npx prisma generate')
  } catch (error) {
    console.error('Migration error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

applyMigration()

