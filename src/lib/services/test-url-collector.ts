import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';

// Helper function to make HTTP requests
async function fetchUrl(urlToFetch: string): Promise<{ statusCode: number, data: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlToFetch);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    };
    
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode || 0, data });
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

// Simple function to collect product URLs
async function collectProductUrls(baseUrl: string): Promise<string[]> {
  console.log(`Collecting product URLs from ${baseUrl}`);
  
  try {
    // Fetch the main page
    const response = await fetchUrl(baseUrl);
    if (response.statusCode !== 200) {
      throw new Error(`Failed to fetch ${baseUrl}: Status code ${response.statusCode}`);
    }
    
    // Extract product URLs (this is a very simple example)
    const urls: string[] = [];
    const htmlContent = response.data;
    
    // Look for product links in the HTML
    const productLinkRegex = /<a[^>]*href=["']([^"']+\/product\/[^"']+)["'][^>]*>/gi;
    let match;
    while ((match = productLinkRegex.exec(htmlContent)) !== null) {
      let productUrl = match[1];
      
      // Make sure the URL is absolute
      if (productUrl.startsWith('/')) {
        const urlObj = new URL(baseUrl);
        productUrl = `${urlObj.protocol}//${urlObj.host}${productUrl}`;
      } else if (!productUrl.startsWith('http')) {
        productUrl = new URL(productUrl, baseUrl).href;
      }
      
      urls.push(productUrl);
    }
    
    // Remove duplicates
    const uniqueUrls = [...new Set(urls)];
    console.log(`Found ${uniqueUrls.length} unique product URLs`);
    
    return uniqueUrls;
  } catch (error) {
    console.error(`Error collecting product URLs: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

// Main function
async function main() {
  const baseUrl = 'https://www.ljusochmiljo.se/';
  const urls = await collectProductUrls(baseUrl);
  
  console.log(`Collected ${urls.length} URLs`);
  console.log('Sample URLs:');
  urls.slice(0, 5).forEach(url => console.log(`- ${url}`));
  
  // Write the result to a file
  const result = {
    success: true,
    urls,
    totalCount: urls.length,
    sampleUrls: urls.slice(0, 10),
    logs: ['Test URL collection completed']
  };
  
  fs.writeFileSync('url-collection-result.json', JSON.stringify(result, null, 2));
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
});
