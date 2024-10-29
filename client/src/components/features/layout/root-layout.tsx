// src/components/features/layout/root-layout.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';

const navigationItems = [
  { label: 'Home', href: '/' },
  { label: 'Videos', href: '/videos' },
];

const authNavigationItems = [
  { label: 'Profile', href: '/profile' },
  { label: 'My Videos', href: '/videos/my-videos' },
  { label: 'Purchases', href: '/purchases' },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const allNavigationItems = [
    ...navigationItems,
    ...(user ? authNavigationItems : []),
  ];

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md hover:bg-gray-100 md:hidden"
              >
                <Menu className="h-6 w-6" />
              </button>
              <Link href="/" className="text-xl font-semibold text-gray-900">
                Video Platform
              </Link>
            </div>

            <nav className="hidden md:flex items-center gap-4">
              {allNavigationItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100"
                >
                  {item.label}
                </Link>
              ))}
              {user ? (
                <button
                  onClick={logout}
                  className="px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100"
                >
                  Logout
                </button>
              ) : (
                <Link
                  href="/login"
                  className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                >
                  Login
                </Link>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-50" 
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-full max-w-xs bg-white p-6 shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-md hover:bg-gray-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="space-y-2">
              {allNavigationItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="block px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              {user ? (
                <button
                  onClick={() => {
                    logout();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-md text-gray-600 hover:bg-gray-100"
                >
                  Logout
                </button>
              ) : (
                <Link
                  href="/login"
                  className="block px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Login
                </Link>
              )}
            </nav>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}