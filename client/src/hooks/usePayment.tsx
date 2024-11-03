import { useState, useCallback } from "react";

// usePayment.tsx
export function usePayment() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPaymentIntent = useCallback(async (videoId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ videoId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create payment intent');
      }

      const data = await response.json();
      return data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyPurchase = useCallback(async (videoId: string) => {
    try {
      const response = await fetch(`/api/payments/verify/${videoId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to verify purchase');
      }

      const data = await response.json();
      return data.data?.verified || false;
    } catch (err) {
      console.error('Verification error:', err);
      return false;
    }
  }, []);

  return {
    isLoading,
    error,
    createPaymentIntent,
    verifyPurchase
  };
}