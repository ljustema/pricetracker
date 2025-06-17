import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing URL parameter', { status: 400 });
  }

  // Log environment info for debugging
  const isRailway = process.env.RAILWAY_ENVIRONMENT !== undefined;
  const environment = isRailway ? 'Railway' : 'Local';
  console.log(`[${environment}] Proxy-image request for URL:`, url);

  try {
    // Set up headers for the request
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,sv;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site'
    };

    // Get auth header from the request if provided
    const authHeader = request.headers.get('x-auth-header');
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    // Generate a list of possible URLs to try
    const urlsToTry: string[] = [];

    // Handle protocol-relative URLs (starting with //)
    let processedUrl = url;
    if (url.startsWith('//')) {
      // Add https protocol to protocol-relative URLs
      processedUrl = `https:${url}`;
      console.log('Converting protocol-relative URL to:', processedUrl);
    }

    // If it's an API URL like /api/images/products/{product_id}/{image_id}, convert to public URL
    if (processedUrl.includes('/api/images/products/')) {
      // Extract the image ID (we don't need the product ID for the public URL)
      const match = processedUrl.match(/\/api\/images\/products\/(?:\d+)\/(\d+)/);
      if (match && match.length === 2) {
        const imageId = match[1];

        // Base URL without the path
        const baseUrl = processedUrl.split('/api/')[0];

        // Try different image sizes
        const imageSizes = ['home_default', 'large_default', 'medium_default', 'small_default', 'thickbox_default'];

        // Try with a generic product name
        const productName = 'product';

        // Generate URLs with different image sizes
        for (const size of imageSizes) {
          urlsToTry.push(`${baseUrl}/${imageId}-${size}/${productName}.jpg`);
        }

        // Also try without size specification
        urlsToTry.push(`${baseUrl}/${imageId}/${productName}.jpg`);

        // Also try the original URL as a fallback with authentication
        urlsToTry.push(processedUrl);
      } else {
        // If we couldn't extract the IDs, just use the original URL
        urlsToTry.push(processedUrl);
      }
    } else if (processedUrl.includes('cloudinary.com')) {
      // Special handling for Cloudinary URLs
      urlsToTry.push(processedUrl);
    } else {
      // If it's not a Prestashop API URL, just use the original URL
      urlsToTry.push(processedUrl);
    }

    // Try each URL until one works
    let lastError: Response | null = null;

    for (const urlToTry of urlsToTry) {
      console.log('Attempting to fetch image from:', urlToTry);
      console.log('Request headers:', JSON.stringify(headers, null, 2));

      try {
        // Fetch the image from the URL with appropriate headers and timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(urlToTry, {
          headers,
          signal: controller.signal,
          // Add additional fetch options for better compatibility
          redirect: 'follow',
          referrerPolicy: 'no-referrer-when-downgrade'
        });

        clearTimeout(timeoutId);

        console.log(`Response status: ${response.status} ${response.statusText}`);
        console.log('Response headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));

        if (response.ok) {
          // Get the image data as an array buffer
          const imageBuffer = await response.arrayBuffer();
          console.log(`Successfully fetched image, size: ${imageBuffer.byteLength} bytes`);

          // Get the content type from the response
          const contentType = response.headers.get('content-type') || 'image/jpeg';
          console.log(`Content type: ${contentType}`);

          // Return the image with the appropriate content type
          return new NextResponse(imageBuffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
            },
          });
        }

        // Store the last error response
        lastError = response;
        console.error(`Failed to fetch from ${urlToTry}: ${response.status} ${response.statusText}`);

        // Try to get response text for more details
        try {
          const responseText = await response.text();
          console.error('Error response body:', responseText.substring(0, 500)); // Log first 500 chars
        } catch (textError) {
          console.error('Could not read error response body:', textError);
        }
      } catch (fetchError) {
        console.error(`Error fetching from ${urlToTry}:`, fetchError);

        // Log specific error types
        if (fetchError instanceof Error) {
          console.error('Error name:', fetchError.name);
          console.error('Error message:', fetchError.message);
          if (fetchError.name === 'AbortError') {
            console.error('Request timed out after 10 seconds');
          }
        }
      }
    }

    // If we get here, all URLs failed
    if (lastError) {
      // Try to get the response text for more details
      const responseText = await lastError.text();
      console.error('Last error response text:', responseText);

      return new NextResponse(`Failed to fetch image: ${lastError.statusText}`, {
        status: lastError.status
      });
    }

    return new NextResponse('Failed to fetch image from any of the attempted URLs', {
      status: 404
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return new NextResponse(`Error proxying image: ${error instanceof Error ? error.message : String(error)}`, {
      status: 500
    });
  }
}
