// usePayment.tsx
import { api } from "@/lib/api";
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

// In usePayment.tsx
const verifyPayment = useCallback(async (
  videoId: string,
  paymentIntentId: string
): Promise<VerificationResult | null> => {
  console.log('Starting payment verification:', { videoId, paymentIntentId });
  
  if (!videoId || !paymentIntentId) {
    setError('Missing verification parameters');
    return null;
  }

  try {
    const result = await api.payments.verifyPurchase(videoId, paymentIntentId);
    console.log('Verification result:', result);
    return result;
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