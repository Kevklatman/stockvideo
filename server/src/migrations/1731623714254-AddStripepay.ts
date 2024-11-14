import { MigrationInterface, QueryRunner } from "typeorm";

export class AddStripepay1731623714254 implements MigrationInterface {
    name = 'AddStripepay1731623714254'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "stripeConnectAccountStatus"`);
        await queryRunner.query(`CREATE TYPE "public"."users_stripeconnectaccountstatus_enum" AS ENUM('none', 'pending', 'active', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "stripeConnectAccountStatus" "public"."users_stripeconnectaccountstatus_enum" NOT NULL DEFAULT 'none'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "stripeConnectAccountStatus"`);
        await queryRunner.query(`DROP TYPE "public"."users_stripeconnectaccountstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "stripeConnectAccountStatus" character varying`);
    }

}
