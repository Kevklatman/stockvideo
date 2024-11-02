import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export function usePayment() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createPaymentIntent = useCallback(async (videoId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.post<{ data: { clientSecret: string } }>('/api/payments/create-intent', {
        videoId
      });

      return response.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const processPayment = useCallback(async (
    clientSecret: string,
    paymentMethodId: string
  ) => {
    const stripe = await stripePromise;
    if (!stripe) throw new Error('Stripe not loaded');

    const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
      clientSecret,
      {
        payment_method: paymentMethodId
      }
    );

    if (confirmError) {
      throw new Error(confirmError.message);
    }

    return paymentIntent;
  }, []);

  const verifyPurchase = useCallback(async (videoId: string) => {
    try {
      const response = await api.get<{ verified: boolean }>(`/api/payments/verify/${videoId}`);
      return response.verified;
    } catch (err) {
      console.error('Verify purchase error:', err);
      return false;
    }
  }, []);

  return {
    isLoading,
    error,
    createPaymentIntent,
    processPayment,
    verifyPurchase
  };
}