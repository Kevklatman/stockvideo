import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdatePurchaseCompletedAt1699123456789 implements MigrationInterface {
    name = 'UpdatePurchaseCompletedAt1699123456789'

    public async up(queryRunner: QueryRunner): Promise<void> {
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

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "purchases" 
            ALTER COLUMN "completedAt" TYPE TIMESTAMP,
            ALTER COLUMN "completedAt" DROP NOT NULL
        `);
    }
}