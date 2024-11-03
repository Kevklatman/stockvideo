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
  purchaseId?: string;
  purchaseDate?: string;
}

export function usePayment() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPaymentIntent = useCallback(async (videoId: string): Promise<PaymentIntentResponse> => {
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

      return {
        clientSecret: data.data.clientSecret,
        paymentIntentId: data.data.paymentIntentId,
        amount: data.data.amount,
        currency: data.data.currency,
        purchaseId: data.data.purchaseId
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Payment failed';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyPayment = useCallback(async (paymentIntentId: string): Promise<VerificationResult> => {
    try {
      const response = await fetch(`/api/payments/verify/${paymentIntentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to verify payment');
      }

      return {
        verified: data.data?.verified || false,
        purchaseId: data.data?.purchase?.id,
        purchaseDate: data.data?.purchase?.completedAt
      };
    } catch (err) {
      console.error('Verification error:', err);
      throw err; // Let the calling component handle the error
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