// src/utils/price.ts

/**
 * Converts a price to cents for Stripe
 */
export function toCents(price: number): number {
    return Math.round(price * 100);
  }
  
  /**
   * Converts cents to dollars
   */
  export function toDollars(cents: number): number {
    return cents / 100;
  }
  
  /**
   * Validates a price value
   */
  export function isValidPrice(price: unknown): price is number {
    return (
      typeof price === 'number' &&
      !isNaN(price) &&
      price >= 0 &&
      price <= 1000000 // $1M max price
    );
  }
  
  /**
   * Formats a price for display
   */
  export function formatPrice(price: number): string {
    if (!isValidPrice(price)) {
      return '$0.00';
    }
    return `$${price.toFixed(2)}`;
  }
  
  /**
   * Safely parses a price from various input types
   */
  export function parsePrice(input: unknown): number {
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
  export function calculateStripeFee(price: number): number {
    // Stripe fee is 2.9% + $0.30
    const fee = price * 0.029 + 0.30;
    return Math.round(fee * 100) / 100;
  }
  
  /**
   * Calculates the total amount including Stripe fee
   */
  export function calculateTotalWithFee(price: number): number {
    const fee = calculateStripeFee(price);
    return Math.round((price + fee) * 100) / 100;
  } 