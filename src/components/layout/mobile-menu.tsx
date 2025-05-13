'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { XIcon } from 'lucide-react';

interface MobileMenuProps {
  isAuthenticated?: boolean;
}

export default function MobileMenu({ isAuthenticated = false }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent scrolling when menu is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      // Restore scrolling when menu is closed
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close menu when escape key is pressed
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  return (
    <div className="lg:hidden">
      {/* Mobile menu button */}
      <button
        type="button"
        className="inline-flex items-center justify-center rounded-md p-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
        onClick={() => setIsOpen(true)}
      >
        <span className="sr-only">Open main menu</span>
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
          />
        </svg>
      </button>

      {/* Mobile menu panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm" aria-hidden="true">
          <div
            ref={menuRef}
            className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-white px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-gray-900/10"
          >
            <div className="flex items-center justify-between">
              <Link href="/" className="-m-1.5 p-1.5" onClick={() => setIsOpen(false)}>
                <span className="sr-only">PriceTracker</span>
                <span className="text-xl font-bold text-indigo-600">PriceTracker</span>
              </Link>
              <button
                type="button"
                className="-m-2.5 rounded-md p-2.5 text-gray-700"
                onClick={() => setIsOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                <XIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-6 flow-root">
              <div className="-my-6 divide-y divide-gray-500/10">
                <div className="space-y-2 py-6">
                  <Link
                    href="/marketing-routes/features"
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                    onClick={() => setIsOpen(false)}
                  >
                    Features
                  </Link>
                  <Link
                    href="/marketing-routes/pricing"
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                    onClick={() => setIsOpen(false)}
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/marketing-routes/about"
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                    onClick={() => setIsOpen(false)}
                  >
                    About
                  </Link>
                </div>
                <div className="py-6">
                  {isAuthenticated ? (
                    <Link
                      href="/app-routes/dashboard"
                      className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                      onClick={() => setIsOpen(false)}
                    >
                      Dashboard
                    </Link>
                  ) : (
                    <>
                      <Link
                        href="/auth-routes/login"
                        className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-900 hover:bg-gray-50"
                        onClick={() => setIsOpen(false)}
                      >
                        Log in
                      </Link>
                      <Link
                        href="/auth-routes/register"
                        className="-mx-3 block rounded-lg bg-indigo-600 px-3 py-2.5 text-base font-semibold leading-7 text-white hover:bg-indigo-500 mt-3"
                        onClick={() => setIsOpen(false)}
                      >
                        Sign up
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
