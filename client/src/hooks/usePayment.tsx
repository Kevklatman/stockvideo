// usePayment.tsx
import { useState, useCallback } from "react";

interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
  amount: number;
  currency: string;
  purchaseId: string;
}

interface VerificationResult {
  verified: boolean;
  purchase?: {
    id: string;
    status: 'pending' | 'completed' | 'failed';
    completedAt?: string;
  };
}

export function usePayment() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPaymentIntent = useCallback(async (videoId: string): Promise<PaymentIntentResponse | null> => {
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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create payment intent');
      }
      
      if (!data.data?.clientSecret || !data.data?.paymentIntentId) {
        throw new Error('Invalid response from server');
      }

      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyPayment = useCallback(async (
    videoId: string,
    paymentIntentId: string
  ): Promise<VerificationResult | null> => {
    if (!videoId) {
      throw new Error('Video ID is required');
    }

    if (!paymentIntentId) {
      throw new Error('Payment Intent ID is required');
    }

    try {
      const response = await fetch(`/api/payments/verify/${videoId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          videoId,
          paymentIntentId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to verify payment');
      }

      return data.data;
    } catch (err) {
      console.error('Verification error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify payment';
      setError(errorMessage);
      return null;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isLoading,
    error,
    createPaymentIntent,
    verifyPayment,
    clearError
  };
}