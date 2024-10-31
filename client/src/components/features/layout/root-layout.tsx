// src/app/root-layout.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/providers/auth-provider';
import { Toast } from '@/components/Toast';

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
  const [showLogoutSuccess, setShowLogoutSuccess] = useState(false);
  const router = useRouter();
  const { user, isLoading, isInitialized, logout } = useAuth();

  // Debug auth state changes
  useEffect(() => {
    console.log('RootLayout auth state:', {
      isAuthenticated: !!user,
      user,
      isLoading,
      isInitialized
    });
  }, [user, isLoading, isInitialized]);

  // Close mobile menu when auth state changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [user]);

  const handleLogout = async () => {
    try {
      logout();
      setShowLogoutSuccess(true);
      setIsMobileMenuOpen(false);
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      router.push('/');
      setShowLogoutSuccess(false);
    } catch (error) {
      console.error('Logout error:', error);
      // Handle any logout errors here
    }
  };

  // Wait for auth to initialize
  if (!isInitialized || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-gray-600">
          {!isInitialized ? 'Initializing...' : 'Loading...'}
        </div>
      </div>
    );
  }

  const allNavigationItems = user 
    ? [...navigationItems, ...authNavigationItems]
    : navigationItems;

  const headerClasses = `
    border-b border-gray-200 
    ${user ? 'bg-white shadow-sm' : 'bg-transparent'}
    transition-colors duration-200
    sticky top-0 z-50
  `;

  const logoClasses = `
    text-xl font-semibold 
    ${user ? 'text-gray-900' : 'text-gray-800'}
    transition-colors duration-200
  `;

  const navLinkClasses = `
    px-3 py-2 rounded-md
    ${user ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-700 hover:bg-gray-50'}
    transition-colors duration-200
  `;

  const buttonClasses = `
    px-4 py-2 rounded-md
    transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  return (
    <div className={`min-h-screen ${user ? 'bg-gray-50' : 'bg-white'} transition-colors duration-200`}>
      {showLogoutSuccess && (
        <Toast 
          message="Successfully logged out!" 
          type="success"
          onClose={() => setShowLogoutSuccess(false)}
        />
      )}

      <header className={headerClasses}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {/* Left side */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-md hover:bg-gray-100 md:hidden"
                aria-label="Toggle menu"
              >
                <Menu className="h-6 w-6" />
              </button>
              <Link href="/" className={logoClasses}>
                Video Platform
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-4">
              {allNavigationItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={navLinkClasses}
                >
                  {item.label}
                </Link>
              ))}
              
              {user && (
                <Link
                  href="/videos/upload"
                  className={`${buttonClasses} bg-blue-600 text-white hover:bg-blue-700`}
                >
                  Upload Video
                </Link>
              )}
              
              {/* Auth Section */}
              <div className="pl-4 border-l border-gray-200">
                {user ? (
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-600">{user.email}</span>
                    <button
                      onClick={handleLogout}
                      className={`${buttonClasses} bg-red-600 text-white hover:bg-red-700`}
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className={`${buttonClasses} bg-blue-600 text-white hover:bg-blue-700`}
                  >
                    Login
                  </Link>
                )}
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div 
            className="fixed inset-0 bg-gray-600 bg-opacity-50 transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-full max-w-xs bg-white p-6 shadow-lg transform transition-transform">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-md hover:bg-gray-100"
                aria-label="Close menu"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <nav className="space-y-2">
              {allNavigationItems.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={navLinkClasses}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}

              {user && (
                <Link
                  href="/videos/upload"
                  className={`${buttonClasses} block w-full text-center bg-blue-600 text-white hover:bg-blue-700`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Upload Video
                </Link>
              )}
              
              {/* Mobile Auth Section */}
              {user ? (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="px-3 py-2 text-sm text-gray-600">
                    {user.email}
                  </div>
                  <button
                    onClick={handleLogout}
                    className={`${buttonClasses} w-full mt-2 bg-red-600 text-white hover:bg-red-700`}
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className={`${buttonClasses} block w-full text-center mt-4 bg-blue-600 text-white hover:bg-blue-700`}
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