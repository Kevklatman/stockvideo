// PaymentModal.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  const [cardComplete, setCardComplete] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState(0);
  
  const isSubmittingRef = useRef(false);
  const lastSubmissionTimeRef = useRef(0);

  useEffect(() => {
    return () => {
      isSubmittingRef.current = false;
      setProcessing(false);
      setError(null);
    };
  }, []);

  useEffect(() => {
    if (paymentError) {
      setError(paymentError);
    }
  }, [paymentError]);

  const handleCardChange = (event: StripeCardElementChangeEvent) => {
    setCardComplete(event.complete);
    if (event.error) {
      setError(event.error.message);
    } else {
      setError(null);
    }
  };

  const verifyPaymentCompletion = async (paymentIntentId: string): Promise<boolean> => {
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
  
        return data.data.verified;
      } catch (error) {
        console.error('Verification error:', error);
        attempt++;
        if (attempt < maxRetries) {
          await delay(retryDelay); // wait before retrying
        }
      }
    }
  
    return false;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (!videoId) {
      setError('Video ID is required');
      return;
    }

    if (!stripe || !elements) {
      setError('Payment system not initialized');
      return;
    }

    if (isSubmittingRef.current) {
      console.log('Blocked: Submission already in progress');
      return;
    }

    if (!cardComplete) {
      setError('Please enter complete card details');
      return;
    }

    try {
      isSubmittingRef.current = true;
      lastSubmissionTimeRef.current = Date.now();
      setProcessing(true);
      setError(null);
      setVerificationProgress(0);

      // Create payment intent
      console.log('Creating payment intent for video:', videoId);
      const paymentData = await createPaymentIntent(videoId);
      
      if (!paymentData) {
        throw new Error('Failed to create payment intent');
      }

      // Confirm the payment with Stripe
      console.log('Confirming card payment...');
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        paymentData.clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
          },
        }
      );

      if (stripeError) {
        throw stripeError;
      }

      if (!paymentIntent) {
        throw new Error('No payment intent returned from Stripe');
      }

      if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing') {
        // Wait for webhook to process and set completedAt
        const verified = await verifyPaymentCompletion(paymentIntent.id);
        
        if (verified) {
          await onSuccess(paymentIntent.id);
          router.push(`/payment/success?payment_intent=${paymentIntent.id}&video_id=${videoId}`);
        } else {
          throw new Error('Payment verification timed out. The payment may have succeeded - please check your purchase history.');
        }
      } else {
        throw new Error(`Payment failed with status: ${paymentIntent.status}`);
      }
    } catch (err) {
      console.error('Payment error:', err);
      
      if (err instanceof Error) {
        if ('type' in err && typeof err.type === 'string') {
          switch (err.type) {
            case 'card_error':
            case 'validation_error':
              setError('Your card was declined. Please try another card.');
              break;
            case 'invalid_request_error':
              setError('Invalid payment request. Please try again.');
              break;
            default:
              setError(err.message);
          }
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setProcessing(false);
      isSubmittingRef.current = false;
    }
  };

  const isDisabled = !stripe || processing || isSubmittingRef.current || !cardComplete;

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

        {processing && verificationProgress > 0 && (
          <div className="space-y-2">
            <div className="h-2 bg-gray-200 rounded-full">
              <div 
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${verificationProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 text-center">
              Verifying payment... {Math.round(verificationProgress)}%
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isDisabled}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 
                   transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? (
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