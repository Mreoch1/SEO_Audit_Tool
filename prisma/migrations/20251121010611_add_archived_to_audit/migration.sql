-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Audit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "overallScore" INTEGER NOT NULL,
    "technicalScore" INTEGER NOT NULL,
    "onPageScore" INTEGER NOT NULL,
    "contentScore" INTEGER NOT NULL,
    "accessibilityScore" INTEGER NOT NULL,
    "shortSummary" TEXT NOT NULL,
    "detailedSummary" TEXT NOT NULL,
    "rawJson" TEXT NOT NULL
);
INSERT INTO "new_Audit" ("accessibilityScore", "contentScore", "createdAt", "detailedSummary", "id", "onPageScore", "overallScore", "rawJson", "shortSummary", "technicalScore", "updatedAt", "url") SELECT "accessibilityScore", "contentScore", "createdAt", "detailedSummary", "id", "onPageScore", "overallScore", "rawJson", "shortSummary", "technicalScore", "updatedAt", "url" FROM "Audit";
DROP TABLE "Audit";
ALTER TABLE "new_Audit" RENAME TO "Audit";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
