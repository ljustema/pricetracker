'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { XIcon } from 'lucide-react';

export default function MobileSidebar() {
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
    <div className="md:hidden">
      {/* Mobile sidebar toggle button */}
      <button
        type="button"
        className="fixed left-4 top-4 z-20 rounded-md bg-indigo-600 p-2 text-white"
        onClick={() => setIsOpen(true)}
      >
        <svg
          className="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Mobile sidebar panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900/50 backdrop-blur-sm" aria-hidden="true">
          <div
            ref={menuRef}
            className="fixed inset-y-0 left-0 z-50 w-64 overflow-y-auto bg-indigo-700 px-4 py-4"
          >
            <div className="flex items-center justify-between mb-6">
              <Link href="/app-routes/dashboard" className="flex items-center" onClick={() => setIsOpen(false)}>
                <span className="text-xl font-bold text-white">PriceTracker</span>
              </Link>
              <button
                type="button"
                className="rounded-md p-2 text-indigo-200 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                <XIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 space-y-1">
              <Link
                href="/app-routes/dashboard"
                className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <svg
                  className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                Dashboard
              </Link>
              <Link
                href="/app-routes/competitors"
                className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <svg
                  className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Competitors
              </Link>
              <Link
                href="/app-routes/products"
                className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <svg
                  className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
                Products
              </Link>
              <Link
                href="/app-routes/brands"
                className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <svg
                  className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                Brands
              </Link>
              <Link
                href="/app-routes/insights"
                className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <svg
                  className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                Insights
              </Link>
              <Link
                href="/app-routes/scrapers"
                className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <svg
                  className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
                Scrapers
              </Link>
              <Link
                href="/app-routes/integrations"
                className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <svg
                  className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
                Integrations
              </Link>
              <Link
                href="/app-routes/support"
                className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <svg
                  className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                Support
              </Link>

              <Link
                href="/app-routes/settings"
                className="group flex items-center rounded-md px-2 py-2 text-sm font-medium text-indigo-100 hover:bg-indigo-600 hover:text-white"
                onClick={() => setIsOpen(false)}
              >
                <svg
                  className="mr-3 h-6 w-6 text-indigo-300 group-hover:text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Settings
              </Link>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
