import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { PrestashopClient } from '@/workers/ts-util-worker/src/prestashop-client';

export async function POST(request: NextRequest) {
  try {
    // Get the current user from the session
    const session = await getServerSession(authOptions);

    // Check if the user is authenticated
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the credentials from the request body
    const body = await request.json();
    const { platform, api_url, api_key } = body;

    // Validate required fields
    if (!platform || !api_url || !api_key) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Test the credentials based on the platform
    let success = false;
    let message = '';

    switch (platform.toLowerCase()) {
      case 'prestashop':
        try {
          console.log(`Testing Prestashop connection with URL: ${api_url}`);

          // Try with different URL formats if the original one fails
          let client = new PrestashopClient(api_url, api_key);
          let result = await client.testConnection();

          // If the first attempt fails, try with a different URL format
          if (!result) {
            console.log('First attempt failed, trying with alternative URL format...');

            // Try with URL without /api suffix
            if (api_url.endsWith('/api') || api_url.endsWith('/api/')) {
              const baseUrl = api_url.replace(/\/api\/?$/, '/');
              console.log(`Trying with base URL: ${baseUrl}`);
              client = new PrestashopClient(baseUrl, api_key);
              result = await client.testConnection();
            }

            // Try with URL with /api suffix if it doesn't have it
            if (!result && !api_url.includes('/api')) {
              const apiUrl = api_url.endsWith('/') ? `${api_url}api/` : `${api_url}/api/`;
              console.log(`Trying with API URL: ${apiUrl}`);
              client = new PrestashopClient(apiUrl, api_key);
              result = await client.testConnection();
            }
          }

          if (result) {
            success = true;
            message = 'Successfully connected to Prestashop API';
          } else {
            message = 'Failed to connect to Prestashop API. Please check your credentials and URL format.';
          }
        } catch (error) {
          console.error('Detailed error testing Prestashop connection:', error);
          message = error instanceof Error
            ? `Connection error: ${error.message}`
            : 'Unknown error connecting to Prestashop';
        }
        break;

      default:
        message = `Unsupported platform: ${platform}`;
    }

    return NextResponse.json({
      success,
      message,
    });
  } catch (error) {
    console.error('Error in POST /api/integrations/test-credentials:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to test credentials',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
