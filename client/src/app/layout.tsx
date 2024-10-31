// src/app/layout.tsx
import { AuthProvider } from '../providers/auth-provider';
import RootLayout from '@/components/features/layout/root-layout';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';

const inter = Inter({ subsets: ['latin'] });



export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <RootLayout>{children}</RootLayout>
        </AuthProvider>
      </body>
    </html>
  );
}