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
}

const PaymentForm = ({ videoId, price, onClose }: PaymentModalProps) => {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();
  const { createPaymentIntent, error: paymentError } = usePayment();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  
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

// In PaymentModal.tsx
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

  if (!cardComplete) {
    setError('Please enter complete card details');
    return;
  }

  try {
    isSubmittingRef.current = true;
    lastSubmissionTimeRef.current = Date.now();
    setProcessing(true);
    setError(null);

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
      // Redirect to success page with payment intent ID
      router.push(`/payment/success?payment_intent=${paymentIntent.id}`);
    } else {
      throw new Error(`Payment status: ${paymentIntent.status}. Please try again.`);
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