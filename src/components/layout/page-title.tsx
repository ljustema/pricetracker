"use client";

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Component that displays the current page title based on the URL path
 */
export default function PageTitle() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [pageTitle, setPageTitle] = useState('');

  useEffect(() => {
    // Extract the page name from the pathname
    if (pathname) {
      // Get the path segments
      const path = pathname.split('/').filter(Boolean);

      // Handle special cases for nested routes
      if (path.length > 0) {
        const lastSegment = path[path.length - 1];

        // Check if this is a product detail page
        if (path.includes('products') && path.length >= 3 && isUUID(lastSegment)) {
          // This is a product detail page, fetch the product name
          fetchProductName(lastSegment);
          return;
        }

        // Check if it's a UUID (dynamic route)
        if (isUUID(lastSegment)) {
          // Use the parent route name instead
          if (path.length > 1) {
            const parentSegment = path[path.length - 2];
            setPageTitle(formatTitle(parentSegment));
          } else {
            setPageTitle('Details');
          }
        } else {
          // Use the last segment as the page name
          setPageTitle(formatTitle(lastSegment));
        }
      } else {
        // Default to Dashboard if no path segments
        setPageTitle('Dashboard');
      }
    }
  }, [pathname, session]);

  // Check if a string is a UUID
  const isUUID = (str: string) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(str);
  };

  // Fetch product name for product detail pages
  const fetchProductName = async (productId: string) => {
    if (!session?.user) {
      setPageTitle('Product Details');
      return;
    }

    try {
      const response = await fetch(`/api/products/${productId}`);
      if (response.ok) {
        const product = await response.json();
        if (product?.name) {
          const title = product.brand ? `${product.name} - ${product.brand}` : product.name;
          setPageTitle(title);
        } else {
          setPageTitle('Product Details');
        }
      } else {
        setPageTitle('Product Details');
      }
    } catch (error) {
      console.error('Error fetching product name for page title:', error);
      setPageTitle('Product Details');
    }
  };

  // Format the title to be more readable
  const formatTitle = (title: string) => {
    // Replace hyphens and underscores with spaces
    let formattedTitle = title.replace(/[-_]/g, ' ');

    // Capitalize first letter of each word
    formattedTitle = formattedTitle
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    return formattedTitle;
  };

  return (
    <div className="flex items-center h-full">
      <div className="text-lg font-medium text-gray-800">
        {pageTitle}
      </div>
    </div>
  );
}
