"use strict";
// src/utils/price.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromCents = exports.toCents = void 0;
exports.toDollars = toDollars;
exports.isValidPrice = isValidPrice;
exports.formatPrice = formatPrice;
exports.parsePrice = parsePrice;
exports.calculateStripeFee = calculateStripeFee;
exports.calculateTotalWithFee = calculateTotalWithFee;
/**
 * Converts a price to cents for Stripe
 */
/**
 * Converts cents to dollars
 */
function toDollars(cents) {
    return cents / 100;
}
/**
 * Validates a price value
 */
function isValidPrice(price) {
    return (typeof price === 'number' &&
        !isNaN(price) &&
        price >= 0 &&
        price <= 1000000 // $1M max price
    );
}
/**
 * Formats a price for display
 */
function formatPrice(price) {
    if (!isValidPrice(price)) {
        return '$0.00';
    }
    return `$${price.toFixed(2)}`;
}
/**
 * Safely parses a price from various input types
 */
function parsePrice(input) {
    if (typeof input === 'string') {
        const parsed = parseFloat(input);
        return isValidPrice(parsed) ? parsed : 0;
    }
    if (typeof input === 'number' && isValidPrice(input)) {
        return input;
    }
    return 0;
}
/**
 * Calculates the Stripe fee for a given price
 */
function calculateStripeFee(price) {
    // Stripe fee is 2.9% + $0.30
    const fee = price * 0.029 + 0.30;
    return Math.round(fee * 100) / 100;
}
/**
 * Calculates the total amount including Stripe fee
 */
function calculateTotalWithFee(price) {
    const fee = calculateStripeFee(price);
    return Math.round((price + fee) * 100) / 100;
}
const toCents = (amount) => Math.round(amount * 100);
exports.toCents = toCents;
const fromCents = (cents) => cents / 100;
exports.fromCents = fromCents;
