"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddStripepay1731623714254 = void 0;
class AddStripepay1731623714254 {
    constructor() {
        this.name = 'AddStripepay1731623714254';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "stripeConnectAccountStatus"`);
        await queryRunner.query(`CREATE TYPE "public"."users_stripeconnectaccountstatus_enum" AS ENUM('none', 'pending', 'active', 'rejected')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "stripeConnectAccountStatus" "public"."users_stripeconnectaccountstatus_enum" NOT NULL DEFAULT 'none'`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "stripeConnectAccountStatus"`);
        await queryRunner.query(`DROP TYPE "public"."users_stripeconnectaccountstatus_enum"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "stripeConnectAccountStatus" character varying`);
    }
}
exports.AddStripepay1731623714254 = AddStripepay1731623714254;
