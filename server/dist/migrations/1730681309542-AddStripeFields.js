"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddStripeFields1730681309542 = void 0;
class AddStripeFields1730681309542 {
    constructor() {
        this.name = 'AddStripeFields1730681309542';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "videos" ADD "stripeProductId" character varying`);
        await queryRunner.query(`ALTER TABLE "videos" ADD "stripePriceId" character varying`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "stripePriceId"`);
        await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN "stripeProductId"`);
    }
}
exports.AddStripeFields1730681309542 = AddStripeFields1730681309542;
