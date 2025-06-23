import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/options';
import { PrestashopClient } from '@/workers/ts-util-worker/src/prestashop-client';
import { XMLParser } from 'fast-xml-parser';

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
    if (!platform || !api_url) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // For platforms other than google-feed, require API key
    if (platform !== 'google-feed' && !api_key) {
      return NextResponse.json(
        { error: 'Missing API key' },
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

      case 'google-feed':
        try {
          console.log(`Testing Google Feed XML connection with URL: ${api_url}`);

          // Fetch the XML feed
          const response = await fetch(api_url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
            }
          });

          if (!response.ok) {
            message = `Failed to fetch XML feed: ${response.status} ${response.statusText}`;
            break;
          }

          const xmlContent = await response.text();

          // Parse XML to validate structure
          const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '_',
            parseAttributeValue: true,
            processEntities: false,
            htmlEntities: false,
          });

          const parsedXml = parser.parse(xmlContent);

          // Check for valid Google Feed structure
          let itemCount = 0;
          if (parsedXml.rss?.channel?.item) {
            itemCount = Array.isArray(parsedXml.rss.channel.item)
              ? parsedXml.rss.channel.item.length
              : 1;
          } else if (parsedXml.feed?.entry) {
            itemCount = Array.isArray(parsedXml.feed.entry)
              ? parsedXml.feed.entry.length
              : 1;
          } else if (parsedXml.channel?.item) {
            itemCount = Array.isArray(parsedXml.channel.item)
              ? parsedXml.channel.item.length
              : 1;
          }

          if (itemCount > 0) {
            success = true;
            message = `Successfully connected to Google Feed XML. Found ${itemCount} product(s) in the feed.`;
          } else {
            message = 'XML feed is valid but contains no product items. Expected RSS/channel/item or feed/entry structure.';
          }
        } catch (error) {
          console.error('Detailed error testing Google Feed XML connection:', error);
          message = error instanceof Error
            ? `Connection error: ${error.message}`
            : 'Unknown error connecting to Google Feed XML';
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
