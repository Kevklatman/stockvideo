// src/components/features/videos/types.ts

  export interface VideoCardProps {
    id: string;
    title: string;
    thumbnailUrl: string;
    videoUrl: string;
    authorName: string;
    likes: number;
    duration: number;
    views: number;
    price: number;
    description: string;
    createdAt: Date;
    authorId: string;
    purchased?: boolean;
  }

  export interface PaymentModalProps {
    videoId: string;
    price: number;
    onClose: () => void;
    onSuccess: (paymentIntentId: string) => Promise<void>;
    isLoading?: boolean;
  }