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
exports.Video = void 0;
// src/models/video.model.ts
const typeorm_1 = require("typeorm");
const user_model_1 = require("./user.model");
// Price transformer to handle decimal/number conversion
const priceTransformer = {
    to: (value) => {
        if (typeof value !== 'number') {
            return 0;
        }
        return value;
    },
    from: (value) => {
        if (value === null) {
            return 0;
        }
        const parsed = parseFloat(value);
        return isNaN(parsed) ? 0 : parsed;
    }
};
let Video = class Video {
    // Helper method to get formatted price
    getFormattedPrice() {
        return this.price.toFixed(2);
    }
    // Helper method to validate price
    validatePrice() {
        return typeof this.price === 'number' &&
            !isNaN(this.price) &&
            this.price >= 0 &&
            this.price <= 1000000; // Example max price limit
    }
};
exports.Video = Video;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid"),
    __metadata("design:type", String)
], Video.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Video.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { nullable: true }),
    __metadata("design:type", String)
], Video.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)("decimal", {
        precision: 10,
        scale: 2,
        transformer: priceTransformer,
        default: 0
    }),
    __metadata("design:type", Number)
], Video.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Video.prototype, "previewUrl", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Video.prototype, "fullVideoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Video.prototype, "stripeProductId", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], Video.prototype, "stripePriceId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], Video.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_model_1.User, {
        onDelete: "CASCADE",
        onUpdate: "CASCADE"
    }),
    (0, typeorm_1.JoinColumn)({
        name: "userId",
        referencedColumnName: "id",
        foreignKeyConstraintName: "FK_video_user"
    }),
    __metadata("design:type", user_model_1.User)
], Video.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], Video.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)(),
    __metadata("design:type", Date)
], Video.prototype, "updatedAt", void 0);
exports.Video = Video = __decorate([
    (0, typeorm_1.Entity)("videos"),
    (0, typeorm_1.Index)(["userId"])
], Video);
