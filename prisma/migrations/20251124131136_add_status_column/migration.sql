-- RedefineTables
PRAGMA defer_foreign_keys=ON;
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
INSERT INTO "new_Audit" ("accessibilityScore", "archived", "contentScore", "createdAt", "detailedSummary", "id", "onPageScore", "overallScore", "rawJson", "shortSummary", "technicalScore", "updatedAt", "url") SELECT "accessibilityScore", "archived", "contentScore", "createdAt", "detailedSummary", "id", "onPageScore", "overallScore", "rawJson", "shortSummary", "technicalScore", "updatedAt", "url" FROM "Audit";
DROP TABLE "Audit";
ALTER TABLE "new_Audit" RENAME TO "Audit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
