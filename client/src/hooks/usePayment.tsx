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
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    const maxRetries = 10;
    const retryDelay = 2000;
    let attempt = 0;
  
    while (attempt < maxRetries) {
      try {
        const response = await fetch(
          `/api/payments/verify/${encodeURIComponent(videoId)}?paymentIntentId=${encodeURIComponent(paymentIntentId)}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
              'Content-Type': 'application/json'
            }
          }
        );
  
        const data = await response.json();
  
        if (!response.ok) {
          throw new Error(data.message || 'Failed to verify payment');
        }
  
        if (data.data.verified) {
          return data.data;
        }
  
        // Only retry if payment is still pending
        if (data.data.purchase?.status === 'pending') {
          attempt++;
          await delay(retryDelay);
          continue;
        }
  
        // If payment failed or is in another state, return the result
        return data.data;
      } catch (err) {
        console.error('Verification error:', err);
        attempt++;
        if (attempt < maxRetries) {
          await delay(retryDelay);
        }
      }
    }
  
    return null;
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