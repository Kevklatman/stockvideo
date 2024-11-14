"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Purchase = void 0;
// src/models/purchase.model.ts
const typeorm_1 = require("typeorm");
const user_model_1 = require("./user.model");
const video_model_1 = require("./video.model");
let Purchase = class Purchase {
};
exports.Purchase = Purchase;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Purchase.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Purchase.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Purchase.prototype, "videoId", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", { precision: 10, scale: 2 }),
    __metadata("design:type", Number)
], Purchase.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "enum",
        enum: ["pending", "completed", "failed"],
        default: "pending"
    }),
    __metadata("design:type", String)
], Purchase.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Purchase.prototype, "stripePaymentId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_model_1.User, {
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
    }),
    (0, typeorm_1.JoinColumn)({
        name: "userId",
        referencedColumnName: "id",
        foreignKeyConstraintName: "FK_purchase_user"
    }),
    __metadata("design:type", user_model_1.User)
], Purchase.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => video_model_1.Video, {
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
    }),
    (0, typeorm_1.JoinColumn)({
        name: "videoId",
        referencedColumnName: "id",
        foreignKeyConstraintName: "FK_purchase_video"
    }),
    __metadata("design:type", video_model_1.Video)
], Purchase.prototype, "video", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Purchase.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Purchase.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'timestamptz',
        nullable: true,
        precision: 3 // Microsecond precision
    }),
    __metadata("design:type", Date)
], Purchase.prototype, "completedAt", void 0);
exports.Purchase = Purchase = __decorate([
    (0, typeorm_1.Entity)("purchases"),
    (0, typeorm_1.Index)(["userId"]),
    (0, typeorm_1.Index)(["videoId"]),
    (0, typeorm_1.Index)(["userId", "videoId"])
], Purchase);
