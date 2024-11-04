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
    const maxRetries = 5; // Increase the number of retries
    const retryDelay = 5000; // Increase the delay between retries to 5 seconds
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await fetch(
          `/api/payments/verify?videoId=${encodeURIComponent(videoId)}&paymentIntentId=${encodeURIComponent(paymentIntentId)}`, 
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
    
        console.log('Verification result', data.data);
    
        return data.data;
      } catch (err) {
        console.error('Verification error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Failed to verify payment';
        setError(errorMessage);
        attempt++;
        if (attempt < maxRetries) {
          await delay(retryDelay); // wait before retrying
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