import React, { useState, useEffect, useRef } from 'react';
import { usePayment } from '@/hooks/usePayment';
import {
  CardElement,
  Elements,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { StripeCardElementChangeEvent } from '@stripe/stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { X } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PaymentModalProps {
  videoId: string;
  price: number;
  onClose: () => void;
  onSuccess: (paymentIntentId: string) => Promise<void>;
  isLoading?: boolean;
}

const PaymentForm = ({ videoId, price, onClose, onSuccess }: PaymentModalProps) => {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const { createPaymentIntent, error: paymentError } = usePayment();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  
  const isSubmittingRef = useRef(false);
  const lastSubmissionTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      isSubmittingRef.current = false;
      setProcessing(false);
      setError(null);
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!stripe || !elements) {
      setError('Payment system not initialized');
      return;
    }

    if (isSubmittingRef.current) {
      console.log('Blocked: Submission already in progress');
      return;
    }

    const now = Date.now();
    if (now - lastSubmissionTimeRef.current < 2000) {
      console.log('Blocked: Too many attempts');
      return;
    }

    try {
      isSubmittingRef.current = true;
      lastSubmissionTimeRef.current = now;
      setProcessing(true);
      setError(null);

      const { clientSecret } = await createPaymentIntent(videoId);
      
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
          },
        }
      );

      if (stripeError) {
        setError(stripeError.message || 'Payment failed');
      } else if (paymentIntent.status === 'succeeded') {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setProcessing(false);
      isSubmittingRef.current = false;
    }
  };

  const isDisabled = !stripe || processing || isLoading || isSubmittingRef.current;

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">Purchase Video</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <div className="p-4 bg-gray-50 rounded-lg mb-4">
        <p className="text-lg font-semibold">${price.toFixed(2)}</p>
      </div>

      <div className="space-y-4">
        <div className="rounded-md border border-gray-300 p-4">
          <CardElement 
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
              hidePostalCode: true,
            }}
            onChange={handleCardChange}
            className="min-h-[20px]"
          />
        </div>

        {(error || paymentError) && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm">
            {error || paymentError}
          </div>
        )}

        <button
          type="submit"
          disabled={isDisabled}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 
                   transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {(processing || isLoading || isSubmittingRef.current) ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Processing...</span>
            </div>
          ) : (
            `Pay $${price.toFixed(2)}`
          )}
        </button>

        <p className="text-xs text-gray-500 text-center mt-4">
          Secure payment processed by Stripe
        </p>
      </div>
    </form>
  );
};

export function PaymentModal(props: PaymentModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        props.onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [props.onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={props.onClose}
        aria-hidden="true"
      />
      
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md p-6 m-4">
        <Elements stripe={stripePromise}>
          <PaymentForm {...props} />
        </Elements>
      </div>
    </div>
  );
}