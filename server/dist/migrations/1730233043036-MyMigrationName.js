"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdatePurchaseCompletedAt1699123456789 = void 0;
class UpdatePurchaseCompletedAt1699123456789 {
    constructor() {
        this.name = 'UpdatePurchaseCompletedAt1699123456789';
    }
    async up(queryRunner) {
        // First ensure the column exists with the correct type
        await queryRunner.query(`
            ALTER TABLE "purchases" 
            ALTER COLUMN "completedAt" TYPE TIMESTAMP WITH TIME ZONE,
            ALTER COLUMN "completedAt" DROP NOT NULL
        `);
        // Update any existing completed purchases that don't have completedAt set
        await queryRunner.query(`
            UPDATE "purchases"
            SET "completedAt" = "updatedAt"
            WHERE "status" = 'completed' AND "completedAt" IS NULL
        `);
    }
    async down(queryRunner) {
        await queryRunner.query(`
            ALTER TABLE "purchases" 
            ALTER COLUMN "completedAt" TYPE TIMESTAMP,
            ALTER COLUMN "completedAt" DROP NOT NULL
        `);
    }
}
exports.UpdatePurchaseCompletedAt1699123456789 = UpdatePurchaseCompletedAt1699123456789;
