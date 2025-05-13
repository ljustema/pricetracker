"use client";

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * Component that displays the current page title based on the URL path
 */
export default function PageTitle() {
  const pathname = usePathname();
  const [pageTitle, setPageTitle] = useState('');

  useEffect(() => {
    // Extract the page name from the pathname
    if (pathname) {
      // Get the last segment of the path (after the last /)
      let path = pathname.split('/').filter(Boolean);
      
      // Handle special cases for nested routes
      if (path.length > 0) {
        const lastSegment = path[path.length - 1];
        
        // Check if it's a dynamic route with [param]
        if (lastSegment.startsWith('[') && lastSegment.endsWith(']')) {
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
  }, [pathname]);

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
