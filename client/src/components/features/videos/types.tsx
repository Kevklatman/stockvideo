// src/components/features/videos/types.ts
export interface PaymentModalProps {
    videoId: string;
    price: number;
    onClose: () => void;
    onSuccess: () => void;
    isLoading?: boolean;
  }
  
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
    price: number; // in dollars
    onClose: () => void;
    onSuccess: () => void;
    isLoading?: boolean;
  }