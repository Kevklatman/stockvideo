import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStripeFields1730681309542 implements MigrationInterface {
    name = 'AddStripeFields1730681309542'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "videos" ADD "stripeProductId" character varying`);
        await queryRunner.query(`ALTER TABLE "videos" ADD "stripePriceId" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "stripePriceId"`);
        await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "stripeProductId"`);
    }

}
