/**
 * Service for analyzing website structure to determine the best scraping strategy
 * This service is used in the first phase of the multi-phase AI scraper generation process
 */

import { fetchHtml, getBaseUrl } from "@/lib/utils/html-fetcher";
import { generateWithStructuredPrompt } from "@/lib/ai/gemini-client";
// Import but mark as unused with underscore prefix
import { SITE_ANALYSIS_SYSTEM_PROMPT as _SITE_ANALYSIS_SYSTEM_PROMPT } from "@/lib/ai/site-analysis-prompts";
import { URL } from "url";
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import { createSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Represents a discovered API endpoint
 */
export interface ApiEndpointInfo {
  url: string;
  method: string;
  parameters?: Record<string, string>;
  headers?: Record<string, string>;
  description: string;
  testResponse?: string;
  isProductList?: boolean;
  isProductDetail?: boolean;
}

/**
 * Represents the result of a website structure analysis
 */
export interface SiteAnalysisResult {
  url: string;
  baseUrl: string;
  hostname: string;
  title: string;
  sitemapUrls: string[];
  brandPages: string[];
  categoryPages: string[];
  productPages: string[]; // Renamed from productListingPages for clarity
  apiEndpoints: ApiEndpointInfo[];
  proposedStrategy: 'api' | 'scraping';
  strategyDescription: string;
  htmlSample: string;
  productSelectors?: {
    listItem?: string;
    name?: string;
    price?: string;
    link?: string;
    brand?: string;
    sku?: string;
    ean13?: string;
    imageUrl?: string; // URL for the product image
  };
}

/**
 * Service for analyzing website structure to determine the best scraping strategy
 */
export class ScraperAnalysisService {
  /**
   * Analyze a website to determine the best scraping strategy
   * @param url The URL of the website to analyze
   * @param userId The ID of the user performing the analysis
   * @param competitorId The ID of the competitor
   * @param additionalUrls Optional additional URLs to help with analysis
   * @returns The analysis result
   */
  static async analyzeSite(
    url: string,
    _userId: string,
    _competitorId: string,
    additionalUrls?: {
      sitemapUrl?: string;
      categoryPageUrl?: string;
      productPageUrl?: string;
    }
  ): Promise<SiteAnalysisResult> {
    console.log(`Analyzing site: ${url}`);

    if (additionalUrls) {
      if (additionalUrls.sitemapUrl) console.log(`Using provided sitemap URL: ${additionalUrls.sitemapUrl}`);
      if (additionalUrls.categoryPageUrl) console.log(`Using provided category page URL: ${additionalUrls.categoryPageUrl}`);
      if (additionalUrls.productPageUrl) console.log(`Using provided product page URL: ${additionalUrls.productPageUrl}`);
    }

    // 1. Fetch the HTML content
    const html = await fetchHtml(url);
    const baseUrl = getBaseUrl(url);
    const hostname = new URL(url).hostname;

    // 2. Parse the HTML with Cheerio
    const $ = cheerio.load(html);
    const title = $('title').text().trim();

    // 3. Look for sitemap URLs
    const sitemapUrls = await this.findSitemapUrls(url, $, additionalUrls?.sitemapUrl) || [];
    console.log(`Found ${sitemapUrls.length} sitemap URLs`);

    // 4. Look for brand pages
    const brandPages = await this.findBrandPages(url, $) || [];
    console.log(`Found ${brandPages.length} brand pages`);

    // 5. Look for category pages
    const categoryPages = await this.findCategoryPages(url, $, additionalUrls?.categoryPageUrl) || [];
    console.log(`Found ${categoryPages.length} category pages`);

    // 6. Look for product pages
    const productPages = await this.findProductPages(url, $, additionalUrls?.productPageUrl) || [];
    console.log(`Found ${productPages.length} product pages`);

    // 7. Look for API endpoints
    const apiEndpoints = await this.findApiEndpoints(url, html) || [];
    console.log(`Found ${apiEndpoints.length} potential API endpoints`);

    // 8. Determine the best strategy based on the analysis
    const strategyResult = await this.determineStrategy(
      apiEndpoints,
      sitemapUrls,
      brandPages,
      categoryPages,
      productPages
    ) || { proposedStrategy: 'scraping', strategyDescription: 'Default web scraping approach' };

    const { proposedStrategy, strategyDescription } = strategyResult;

    // 9. Try to identify product selectors if using web scraping
    const productSelectors = proposedStrategy === 'scraping'
      ? await this.identifyProductSelectors(url, $, productPages)
      : undefined;

    // 10. Return the analysis result
    return {
      url,
      baseUrl,
      hostname,
      title,
      sitemapUrls,
      brandPages,
      categoryPages,
      productPages,
      apiEndpoints,
      proposedStrategy,
      strategyDescription,
      htmlSample: html.slice(0, 50000), // Limit to 50K characters
      productSelectors
    };
  }

  /**
   * Find sitemap URLs for a website
   * @param url The URL of the website
   * @param $ The Cheerio instance for the website's HTML
   * @param providedSitemapUrl Optional user-provided sitemap URL
   * @returns An array of sitemap URLs
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static async findSitemapUrls(url: string, $: any, providedSitemapUrl?: string): Promise<string[]> {
    const sitemapUrls: string[] = [];
    const processedSitemaps: string[] = []; // Track processed sitemaps to avoid duplicates
    const baseUrl = getBaseUrl(url);

    // Add the provided sitemap URL if it exists
    if (providedSitemapUrl) {
      try {
        // Ensure it's an absolute URL
        const absoluteSitemapUrl = providedSitemapUrl.startsWith('http')
          ? providedSitemapUrl
          : new URL(providedSitemapUrl, baseUrl).toString();

        sitemapUrls.push(absoluteSitemapUrl);
        console.log(`Using provided sitemap URL: ${absoluteSitemapUrl}`);
      } catch (error) {
        console.error(`Error processing provided sitemap URL: ${error}`);
      }
    }

    // 1. Check for sitemap link in robots.txt
    try {
      const robotsUrl = new URL('/robots.txt', baseUrl).toString();
      const robotsContent = await fetch(robotsUrl).then(res => res.text());

      // Extract sitemap URLs from robots.txt
      const sitemapMatches = robotsContent.match(/Sitemap:\s*(.+)/gi);
      if (sitemapMatches) {
        for (const match of sitemapMatches) {
          const sitemapUrl = match.replace(/Sitemap:\s*/i, '').trim();
          if (!sitemapUrls.includes(sitemapUrl)) {
            sitemapUrls.push(sitemapUrl);
          }
        }
      }
    } catch (error) {
      console.error(`Error fetching robots.txt: ${error}`);
    }

    // 2. Check for common sitemap locations
    const commonSitemapPaths = [
      '/sitemap.xml',
      '/sitemap_index.xml',
      '/sitemap/sitemap.xml',
      '/sitemaps/sitemap.xml',
      '/sitemap/product-sitemap.xml',
      '/sitemap/category-sitemap.xml',
      '/sitemap_products.xml'
    ];

    for (const path of commonSitemapPaths) {
      try {
        const sitemapUrl = new URL(path, baseUrl).toString();
        const response = await fetch(sitemapUrl, { method: 'HEAD' });

        if (response.ok && !sitemapUrls.includes(sitemapUrl)) {
          sitemapUrls.push(sitemapUrl);
        }
      } catch (_error) {
        // Ignore errors for common paths that don't exist
      }
    }

    // 3. Check for sitemap links in HTML
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $('link[rel="sitemap"]').each((_: number, element: any) => {
      const href = $(element).attr('href');
      if (href) {
        const sitemapUrl = new URL(href, baseUrl).toString();
        if (!sitemapUrls.includes(sitemapUrl)) {
          sitemapUrls.push(sitemapUrl);
        }
      }
    });

    // 4. Process sitemap index files to extract child sitemaps
    const allSitemaps = [...sitemapUrls]; // Create a copy to iterate through

    for (const sitemapUrl of allSitemaps) {
      if (processedSitemaps.includes(sitemapUrl)) {
        continue; // Skip already processed sitemaps
      }

      try {
        processedSitemaps.push(sitemapUrl);
        console.log(`Processing sitemap: ${sitemapUrl}`);

        const response = await fetch(sitemapUrl);
        if (!response.ok) {
          console.log(`Failed to fetch sitemap ${sitemapUrl}: ${response.status}`);
          continue;
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('xml')) {
          console.log(`Sitemap ${sitemapUrl} is not XML: ${contentType}`);
          continue;
        }

        const sitemapContent = await response.text();

        // Check if this is a sitemap index (contains <sitemapindex> tag)
        if (sitemapContent.includes('<sitemapindex')) {
          console.log(`Found sitemap index: ${sitemapUrl}`);

          // Parse the XML to extract child sitemap URLs
          const sitemapXml = cheerio.load(sitemapContent, { xmlMode: true });

          // Look for <sitemap> elements with <loc> children
          sitemapXml('sitemap loc').each((_: number, element: unknown) => {
            const childSitemapUrl = sitemapXml(element).text().trim();
            if (childSitemapUrl && !sitemapUrls.includes(childSitemapUrl)) {
              console.log(`Found child sitemap: ${childSitemapUrl}`);
              sitemapUrls.push(childSitemapUrl);
              allSitemaps.push(childSitemapUrl); // Add to processing queue
            }
          });
        }
      } catch (error) {
        console.error(`Error processing sitemap ${sitemapUrl}: ${error}`);
      }
    }

    return [...new Set(sitemapUrls)]; // Remove duplicates
  }

  /**
   * Find brand pages for a website
   * @param url The URL of the website
   * @param $ The Cheerio instance for the website's HTML
   * @returns An array of brand page URLs
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static async findBrandPages(url: string, $: any): Promise<string[]> {
    const brandPages: string[] = [];
    const baseUrl = getBaseUrl(url);

    // Common patterns for brand pages
    const brandPatterns = [
      // URL patterns
      'a[href*="/brand"]',
      'a[href*="/brands"]',
      'a[href*="/manufacturer"]',
      'a[href*="/manufacturers"]',
      'a[href*="/varumärke"]', // Swedish
      'a[href*="/varumarke"]',
      'a[href*="/leverantör"]', // Swedish
      'a[href*="/leverantor"]',
      'a[href*="/marke"]', // German/Swedish
      'a[href*="/marken"]', // German
      'a[href*="/fabricant"]', // French
      'a[href*="/fabricants"]', // French
      'a[href*="/marca"]', // Spanish/Italian
      'a[href*="/marcas"]', // Spanish
      'a[href*="/marchi"]', // Italian

      // Text content patterns
      'a:contains("Brands")',
      'a:contains("Manufacturers")',
      'a:contains("Varumärken")', // Swedish
      'a:contains("Leverantörer")', // Swedish
      'a:contains("Märken")', // Swedish
      'a:contains("Marken")', // German
      'a:contains("Hersteller")', // German
      'a:contains("Fabricants")', // French
      'a:contains("Marcas")', // Spanish
      'a:contains("Marchi")', // Italian

      // Common class/id patterns
      'a.brand',
      'a.brands',
      'a.manufacturer',
      'a.manufacturers',
      '.brands a',
      '.manufacturers a',
      '.brand-list a',
      '.manufacturer-list a',
      '#brands a',
      '#manufacturers a'
    ];

    // Try each pattern
    for (const pattern of brandPatterns) {
      $(pattern).each((_: number, element: unknown) => {
        const href = $(element).attr('href');
        if (href && !href.includes('javascript:') && !href.startsWith('#')) {
          try {
            const brandUrl = new URL(href, baseUrl).toString();
            if (!brandPages.includes(brandUrl)) {
              brandPages.push(brandUrl);
            }
          } catch (_error) {
            // Ignore invalid URLs
          }
        }
      });
    }

    // Check for brand pages in the footer
    $('footer a, .footer a').each((_: number, element: unknown) => {
      const href = $(element).attr('href');
      const text = $(element).text().toLowerCase();

      if (href &&
          !href.includes('javascript:') &&
          !href.startsWith('#') &&
          (text.includes('brand') ||
           text.includes('manufacturer') ||
           text.includes('varumärke') ||
           text.includes('leverantör') ||
           text.includes('märke'))) {
        try {
          const brandUrl = new URL(href, baseUrl).toString();
          if (!brandPages.includes(brandUrl)) {
            brandPages.push(brandUrl);
          }
        } catch (_error) {
          // Ignore invalid URLs
        }
      }
    });

    // If we still don't have any brand pages, try to check a few category pages
    if (brandPages.length === 0) {
      try {
        // Get category pages
        const categoryPages = await this.findCategoryPages(url, $);

        // Check a sample of category pages for brand links
        const samplesToCheck = categoryPages.slice(0, 2); // Check up to 2 category pages

        for (const categoryUrl of samplesToCheck) {
          try {
            console.log(`Checking category page for brand links: ${categoryUrl}`);
            const categoryHtml = await fetchHtml(categoryUrl);
            const $category = cheerio.load(categoryHtml);

            // Look for brand links in the category page
            for (const pattern of brandPatterns) {
              $category(pattern).each((_: number, element: unknown) => {
                const href = $category(element).attr('href');
                if (href && !href.includes('javascript:') && !href.startsWith('#')) {
                  try {
                    const brandUrl = new URL(href, baseUrl).toString();
                    if (!brandPages.includes(brandUrl)) {
                      brandPages.push(brandUrl);
                    }
                  } catch (_error) {
                    // Ignore invalid URLs
                  }
                }
              });
            }
          } catch (error) {
            console.error(`Error checking category page for brands ${categoryUrl}: ${error}`);
          }
        }
      } catch (error) {
        console.error(`Error finding brand pages from categories: ${error}`);
      }
    }

    return brandPages;
  }

  /**
   * Find category pages for a website
   * @param url The URL of the website
   * @param $ The Cheerio instance for the website's HTML
   * @param providedCategoryPageUrl Optional user-provided category page URL
   * @returns An array of category page URLs
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static async findCategoryPages(url: string, $: any, providedCategoryPageUrl?: string): Promise<string[]> {
    const categoryPages: string[] = [];
    const baseUrl = getBaseUrl(url);

    // Add the provided category page URL if it exists
    if (providedCategoryPageUrl) {
      try {
        // Ensure it's an absolute URL
        const absoluteCategoryPageUrl = providedCategoryPageUrl.startsWith('http')
          ? providedCategoryPageUrl
          : new URL(providedCategoryPageUrl, baseUrl).toString();

        categoryPages.push(absoluteCategoryPageUrl);
        console.log(`Using provided category page URL: ${absoluteCategoryPageUrl}`);
      } catch (error) {
        console.error(`Error processing provided category page URL: ${error}`);
      }
    }

    // Common patterns for category pages
    const categoryPatterns = [
      'a[href*="/category"]',
      'a[href*="/categories"]',
      'a[href*="/catalog"]',
      'a[href*="/department"]',
      'a[href*="/shop"]',
      'a[href*="/products"]',
      'a[href*="/collection"]',
      'a[href*="/kategori"]', // Swedish
      'a[href*="/avdelning"]', // Swedish
      '.category-menu a',
      '.categories a',
      '.category-list a',
      'nav.categories a',
      'nav.category a',
      '.main-menu a',
      '.main-navigation a'
    ];

    // Try each pattern
    for (const pattern of categoryPatterns) {
      $(pattern).each((_: number, element: unknown) => {
        const href = $(element).attr('href');
        if (href && !href.includes('javascript:') && !href.startsWith('#')) {
          try {
            const categoryUrl = new URL(href, baseUrl).toString();
            // Exclude URLs that are likely not category pages
            if (!categoryUrl.includes('/account') &&
                !categoryUrl.includes('/login') &&
                !categoryUrl.includes('/cart') &&
                !categoryUrl.includes('/checkout') &&
                !categoryPages.includes(categoryUrl)) {
              categoryPages.push(categoryUrl);
            }
          } catch (_error) {
            // Ignore invalid URLs
          }
        }
      });
    }

    return categoryPages;
  }

  /**
   * Find product pages for a website
   * @param url The URL of the website
   * @param $ The Cheerio instance for the website's HTML
   * @param providedProductPageUrl Optional user-provided product page URL
   * @returns An array of product page URLs
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private static async findProductPages(url: string, $: any, providedProductPageUrl?: string): Promise<string[]> {
    const productPages: string[] = [];
    const baseUrl = getBaseUrl(url);

    // Add the provided product page URL if it exists
    if (providedProductPageUrl) {
      try {
        // Ensure it's an absolute URL
        const absoluteProductPageUrl = providedProductPageUrl.startsWith('http')
          ? providedProductPageUrl
          : new URL(providedProductPageUrl, baseUrl).toString();

        productPages.push(absoluteProductPageUrl);
        console.log(`Using provided product page URL: ${absoluteProductPageUrl}`);
      } catch (error) {
        console.error(`Error processing provided product page URL: ${error}`);
      }
    }

    // 1. First, try to extract product URLs from sitemaps
    try {
      // Get sitemap URLs
      const sitemapUrls = await this.findSitemapUrls(url, $);

      // Look for product-specific sitemaps first
      const productSitemaps = sitemapUrls.filter(sitemapUrl =>
        sitemapUrl.includes('product') ||
        sitemapUrl.includes('produkt')
      );

      // If we have product-specific sitemaps, check them first
      const sitemapsToCheck = productSitemaps.length > 0 ?
        productSitemaps.slice(0, 2) : // Check up to 2 product sitemaps
        sitemapUrls.slice(0, 2);      // Or check up to 2 regular sitemaps

      for (const sitemapUrl of sitemapsToCheck) {
        try {
          console.log(`Checking sitemap for product URLs: ${sitemapUrl}`);
          const response = await fetch(sitemapUrl);

          if (!response.ok) {
            console.log(`Failed to fetch sitemap ${sitemapUrl}: ${response.status}`);
            continue;
          }

          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('xml')) {
            console.log(`Sitemap ${sitemapUrl} is not XML: ${contentType}`);
            continue;
          }

          const sitemapContent = await response.text();
          const sitemapXml = cheerio.load(sitemapContent, { xmlMode: true });

          // Look for <url> elements with <loc> children (standard sitemap format)
          sitemapXml('url loc').each((_: number, element: unknown) => {
            const productUrl = sitemapXml(element).text().trim();

            // Check if this looks like a product URL (contains product-related keywords)
            if (productUrl &&
                (productUrl.includes('/product/') ||
                 productUrl.includes('/products/') ||
                 productUrl.includes('/produkt/') ||
                 productUrl.includes('/produkter/') ||
                 productUrl.includes('/item/') ||
                 productUrl.includes('/artikel/'))) {

              if (!productPages.includes(productUrl)) {
                productPages.push(productUrl);

                // Log the first few product URLs for debugging
                if (productPages.length <= 5) {
                  console.log(`Found product URL from sitemap: ${productUrl}`);
                }
              }
            }
          });

          // If we found enough product pages, stop checking more sitemaps
          if (productPages.length >= 20) {
            console.log(`Found ${productPages.length} product pages from sitemaps, stopping sitemap search`);
            break;
          }
        } catch (error) {
          console.error(`Error checking sitemap ${sitemapUrl}: ${error}`);
        }
      }
    } catch (error) {
      console.error(`Error finding product pages from sitemaps: ${error}`);
    }

    // 2. If we still need more product pages, look for them on the homepage
    if (productPages.length < 20) {
      // Common patterns for product pages
      const productPatterns = [
        'a[href*="/product/"]',
        'a[href*="/products/"]',
        'a[href*="/produkt/"]', // Swedish
        'a[href*="/produkter/"]', // Swedish
        'a[href*="/item/"]',
        'a[href*="/artikel/"]', // Swedish
        '.product-card a',
        '.product-item a',
        '.product a',
        'a.product-link',
        'a.product-title',
        'a[data-product-id]',
        // Additional patterns
        '.products a',
        '.product-grid a',
        '.product-list a',
        '.product-container a',
        'a[href*="p="]', // Common in some e-commerce platforms
        'a[href*="pid="]'
      ];

      // Try each pattern
      for (const pattern of productPatterns) {
        $(pattern).each((_: number, element: unknown) => {
          const href = $(element).attr('href');
          if (href && !href.includes('javascript:') && !href.startsWith('#')) {
            try {
              const productUrl = new URL(href, baseUrl).toString();
              if (!productPages.includes(productUrl)) {
                productPages.push(productUrl);

                // If we found enough product pages, stop checking more patterns
                if (productPages.length >= 20) {
                  return false; // Break the each loop
                }
              }
            } catch (_error) {
              // Ignore invalid URLs
            }
          }
        });

        // If we found enough product pages, stop checking more patterns
        if (productPages.length >= 20) {
          console.log(`Found ${productPages.length} product pages from homepage, stopping pattern search`);
          break;
        }
      }
    }

    // 3. If we still need more product pages, check category pages
    if (productPages.length < 20) {
      try {
        // Get category pages
        const categoryPages = await this.findCategoryPages(url, $);

        // Add a sample of category pages to check for products
        // This is a fallback approach when we can't find product pages directly
        const samplesToCheck = categoryPages.slice(0, 3); // Check up to 3 category pages

        // Define product patterns for category pages
        const categoryProductPatterns = [
          'a[href*="/product/"]',
          'a[href*="/products/"]',
          'a[href*="/produkt/"]', // Swedish
          'a[href*="/produkter/"]', // Swedish
          'a[href*="/item/"]',
          'a[href*="/artikel/"]', // Swedish
          '.product-card a',
          '.product-item a',
          '.product a',
          'a.product-link',
          'a.product-title',
          'a[data-product-id]',
          '.products a',
          '.product-grid a',
          '.product-list a'
        ];

        for (const categoryUrl of samplesToCheck) {
          try {
            console.log(`Checking category page for products: ${categoryUrl}`);
            const categoryHtml = await fetchHtml(categoryUrl);
            const $category = cheerio.load(categoryHtml);

            // Look for product links in the category page
            for (const pattern of categoryProductPatterns) {
              $category(pattern).each((_: number, element: unknown) => {
                const href = $category(element).attr('href');
                if (href && !href.includes('javascript:') && !href.startsWith('#')) {
                  try {
                    const productUrl = new URL(href, baseUrl).toString();
                    if (!productPages.includes(productUrl)) {
                      productPages.push(productUrl);

                      // If we found enough product pages, stop checking more elements
                      if (productPages.length >= 20) {
                        return false; // Break the each loop
                      }
                    }
                  } catch (_error) {
                    // Ignore invalid URLs
                  }
                }
              });

              // If we found enough product pages, stop checking more patterns
              if (productPages.length >= 20) {
                break;
              }
            }

            // If we found enough product pages, stop checking more category pages
            if (productPages.length >= 20) {
              console.log(`Found ${productPages.length} product pages from category pages, stopping category search`);
              break;
            }
          } catch (error) {
            console.error(`Error checking category page ${categoryUrl}: ${error}`);
          }
        }
      } catch (error) {
        console.error(`Error finding product pages from categories: ${error}`);
      }
    }

    return productPages;
  }

  /**
   * Find potential API endpoints for a website
   * @param url The URL of the website
   * @param html The HTML content of the website
   * @returns An array of potential API endpoints
   */
  private static async findApiEndpoints(url: string, html: string): Promise<ApiEndpointInfo[]> {
    const apiEndpoints: ApiEndpointInfo[] = [];
    const baseUrl = getBaseUrl(url);

    // 1. Look for API endpoints in script tags
    const $ = cheerio.load(html);

    // Look for common API patterns in script tags
    const scriptContents: string[] = [];
    $('script').each((_: number, element: unknown) => {
      const content = $(element).html();
      if (content) {
        scriptContents.push(content);
      }
    });

    // Common patterns for API endpoints
    const apiPatterns = [
      /['"]https?:\/\/[^'"]*api[^'"]*['"]/g,
      /['"]https?:\/\/[^'"]*\/v\d+\/[^'"]*['"]/g,
      /['"]\/api\/[^'"]*['"]/g,
      /['"]\/rest\/[^'"]*['"]/g,
      /['"]\/graphql['"]/g,
      /['"]\/gql['"]/g,
      /['"]\/products\.json['"]/g,
      /['"]\/collections[^'"]*\.json['"]/g
    ];

    // Extract API endpoints from script contents
    for (const content of scriptContents) {
      for (const pattern of apiPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          for (const match of matches) {
            // Clean up the match
            const cleanUrl = match.replace(/['"]/g, '');

            // Create absolute URL if needed
            let apiUrl = cleanUrl;
            if (cleanUrl.startsWith('/')) {
              apiUrl = new URL(cleanUrl, baseUrl).toString();
            }

            // Add to the list if not already included
            if (!apiEndpoints.some(endpoint => endpoint.url === apiUrl)) {
              apiEndpoints.push({
                url: apiUrl,
                method: 'GET', // Default method
                description: 'API endpoint found in script tag',
                isProductList: apiUrl.includes('product') || apiUrl.includes('products'),
                isProductDetail: apiUrl.includes('product/') || apiUrl.includes('products/')
              });
            }
          }
        }
      }
    }

    // 2. Use AI to analyze the HTML and identify potential API endpoints
    try {
      const aiAnalysisPrompt = `
        Analyze this HTML from ${url} and identify potential API endpoints that could be used for scraping product data.
        Focus on:
        1. JavaScript variables or objects that contain API URLs
        2. Network requests that might fetch product data
        3. GraphQL endpoints
        4. REST API endpoints
        5. JSON endpoints (especially for product data)

        HTML sample:
        ${html.slice(0, 50000)}
      `;

      const aiAnalysis = await generateWithStructuredPrompt(
        "You are an expert at identifying API endpoints in e-commerce websites. Your task is to analyze HTML and JavaScript to find endpoints that could be used to fetch product data programmatically.",
        aiAnalysisPrompt
      );

      // Parse the AI analysis to extract API endpoints
      // This is a simplified approach - in a real implementation, we would parse the AI's structured output
      if (aiAnalysis && typeof aiAnalysis === 'string') {
        // Improved regex to avoid capturing invalid characters like backticks
        const aiEndpointMatches = aiAnalysis.match(/https?:\/\/[a-zA-Z0-9_\-\.\/]+(?:\?[a-zA-Z0-9_\-\.=&]+)?|\/api\/[a-zA-Z0-9_\-\.\/]+(?:\?[a-zA-Z0-9_\-\.=&]+)?|\/rest\/[a-zA-Z0-9_\-\.\/]+|\/graphql|\/gql|\/products\.json|\/collections[a-zA-Z0-9_\-\.\/]*\.json/g);

        if (aiEndpointMatches) {
          for (const match of aiEndpointMatches) {
            // Clean the URL - remove any trailing punctuation or invalid characters
            const cleanMatch = match.replace(/[`'")\]}]+$/, '');

            // Create absolute URL if needed
            let apiUrl = cleanMatch;
            if (cleanMatch.startsWith('/')) {
              apiUrl = new URL(cleanMatch, baseUrl).toString();
            }

            // Validate the URL format
            try {
              // This will throw if the URL is invalid
              new URL(apiUrl);

              // Add to the list if not already included and it's a valid URL
              if (!apiEndpoints.some(endpoint => endpoint.url === apiUrl)) {
                apiEndpoints.push({
                  url: apiUrl,
                  method: 'GET', // Default method
                  description: 'API endpoint identified by AI analysis',
                  isProductList: apiUrl.includes('product') || apiUrl.includes('products'),
                  isProductDetail: apiUrl.includes('product/') || apiUrl.includes('products/')
                });
              }
            } catch (_error) {
              console.error(`Invalid API URL format: ${apiUrl}`);
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error using AI to identify API endpoints: ${error}`);
    }

    // 3. Test the discovered API endpoints to see if they return valid JSON
    const testedEndpoints: ApiEndpointInfo[] = [];

    for (const endpoint of apiEndpoints) {
      try {
        // Skip testing if the URL contains invalid characters
        if (endpoint.url.includes('`') || endpoint.url.includes(')')) {
          console.log(`Skipping API endpoint with invalid characters: ${endpoint.url}`);
          continue;
        }

        console.log(`Testing API endpoint: ${endpoint.url}`);

        // Add a timeout to the fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        try {
          const response = await fetch(endpoint.url, {
            method: endpoint.method,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            signal: controller.signal
          });

          clearTimeout(timeoutId); // Clear the timeout if the request completes

          if (response.ok) {
            const contentType = response.headers.get('content-type');

            if (contentType && contentType.includes('application/json')) {
              const jsonData = await response.json();

              // Store a sample of the response
              const testResponse = JSON.stringify(jsonData).slice(0, 1000);

              // Update the endpoint with test results
              testedEndpoints.push({
                ...endpoint,
                testResponse,
                description: `${endpoint.description} (Verified JSON API)`
              });

              console.log(`API endpoint ${endpoint.url} returns valid JSON`);
            } else {
              // Not a JSON endpoint
              console.log(`API endpoint ${endpoint.url} does not return JSON: ${contentType}`);
            }
          } else {
            console.log(`API endpoint ${endpoint.url} returned status ${response.status}`);
          }
        } catch (error) {
          // Check if it's an AbortError (timeout)
          if (error instanceof Error && error.name === 'AbortError') {
            console.log(`API endpoint ${endpoint.url} request timed out`);
          } else {
            throw error; // Re-throw for the outer catch
          }
        }
      } catch (error) {
        console.error(`Error testing API endpoint ${endpoint.url}: ${error}`);
      }
    }

    // Return all endpoints, but mark the ones that were successfully tested
    return apiEndpoints.map(endpoint => {
      const testedEndpoint = testedEndpoints.find(tested => tested.url === endpoint.url);
      return testedEndpoint || endpoint;
    });
  }

  /**
   * Determine the best scraping strategy based on the analysis
   * @param apiEndpoints The discovered API endpoints
   * @param sitemapUrls The discovered sitemap URLs
   * @param brandPages The discovered brand pages
   * @param categoryPages The discovered category pages
   * @param productPages The discovered product pages
   * @returns The proposed strategy and description
   */
  private static async determineStrategy(
    apiEndpoints: ApiEndpointInfo[],
    sitemapUrls: string[],
    brandPages: string[],
    categoryPages: string[],
    productPages: string[]
  ): Promise<{ proposedStrategy: 'api' | 'scraping'; strategyDescription: string }> {
    // Check if we have valid API endpoints for product data
    const productApiEndpoints = apiEndpoints.filter(
      endpoint => endpoint.isProductList || endpoint.isProductDetail
    );

    if (productApiEndpoints.length > 0 && productApiEndpoints.some(endpoint => endpoint.testResponse)) {
      return {
        proposedStrategy: 'api',
        strategyDescription: `Use the API endpoints for product data. ${productApiEndpoints.length} potential API endpoints were found that could provide product data.`
      };
    }

    // If no valid API endpoints, determine the best web scraping approach
    let strategyDescription = 'Use web scraping to collect product data.';

    if (sitemapUrls.length > 0) {
      strategyDescription += ` Start with the sitemap (${sitemapUrls.length} found) to discover product URLs.`;
    } else if (brandPages.length > 0) {
      strategyDescription += ` Start with the brand pages (${brandPages.length} found) to discover product URLs.`;
    } else if (categoryPages.length > 0) {
      strategyDescription += ` Start with the category pages (${categoryPages.length} found) to discover product URLs.`;
    } else if (productPages.length > 0) {
      strategyDescription += ` Start with the product pages (${productPages.length} found).`;
    } else {
      strategyDescription += ' No structured navigation was found. Consider using a search-based approach or exploring the site structure further.';
    }

    return {
      proposedStrategy: 'scraping',
      strategyDescription
    };
  }

  /**
   * Identify product selectors for web scraping
   * @param _url The URL of the website (unused but kept for consistency)
   * @param $ The Cheerio instance for the website's HTML
   * @param productPages Array of product page URLs to analyze
   * @returns The identified product selectors
   */
  private static async identifyProductSelectors(
    _url: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $: any,
    productPages: string[] = []
  ): Promise<{
    listItem?: string;
    name?: string;
    price?: string;
    image?: string;
    link?: string;
    brand?: string;
    sku?: string;
    imageUrl?: string;
  }> {
    // Common selectors for product elements
    const selectors: {
      listItem?: string;
      name?: string;
      price?: string;
      link?: string;
      brand?: string;
      sku?: string;
      ean13?: string;
      imageUrl?: string;
    } = {};

    // First, try to analyze a product page if available
    if (productPages.length > 0) {
      try {
        // Get a sample product page to analyze
        const productUrl = productPages[0];
        console.log(`Analyzing product page for selectors: ${productUrl}`);

        const productHtml = await fetchHtml(productUrl);
        const $product = cheerio.load(productHtml);

        // Try to find name selector on product page
        const nameSelectors = [
          'h1',
          'h1.product-title',
          'h1.product-name',
          '.product-title h1',
          '.product-name h1',
          '[itemprop="name"]',
          '.product-info h1',
          '.product-details h1',
          '.product-title',
          '.product-name',
          '.product-info .title',
          '.product-details .title'
        ];

        for (const pattern of nameSelectors) {
          if ($product(pattern).length) {
            const text = $product(pattern).first().text().trim();
            if (text && text.length > 0) {
              selectors.name = pattern;
              console.log(`Found product name selector: ${pattern} with text: ${text}`);
              break;
            }
          }
        }

        // Try to find price selector on product page
        const priceSelectors = [
          '.price',
          '[itemprop="price"]',
          '.product-price',
          '.price-current',
          '.current-price',
          '.regular-price',
          '.sale-price',
          '.our-price',
          '.price-regular',
          '.price-sale',
          '.product-info .price',
          '.product-details .price',
          'span.price',
          'div.price'
        ];

        for (const pattern of priceSelectors) {
          if ($product(pattern).length) {
            const text = $product(pattern).first().text().trim();
            if (text && text.length > 0 && /[0-9]/.test(text)) { // Ensure it contains numbers
              selectors.price = pattern;
              console.log(`Found product price selector: ${pattern} with text: ${text}`);
              break;
            }
          }
        }

        // Try to find image URL on product page
        const imageSelectors = [
          '.product-image img',
          '.product-img img',
          '.product-photo img',
          '.product-gallery img',
          '.product-media img',
          '[itemprop="image"]',
          '.main-image img',
          '.primary-image img',
          '.featured-image img',
          '.product-featured-image',
          '#product-image',
          '#main-product-image'
        ];

        for (const pattern of imageSelectors) {
          if ($product(pattern).length) {
            const src = $product(pattern).first().attr('src');
            if (src) {
              selectors.imageUrl = src; // Store the actual image URL
              console.log(`Found product image URL: ${src}`);
              break;
            }
          }
        }

        // Try to find brand selector on product page
        const brandSelectors = [
          '.product-brand',
          '.brand',
          '[itemprop="brand"]',
          '.manufacturer',
          '.product-manufacturer',
          '.product-meta .brand',
          '.product-info .brand',
          '.product-details .brand',
          'meta[property="product:brand"]',
          'meta[name="brand"]'
        ];

        for (const pattern of brandSelectors) {
          if ($product(pattern).length) {
            const brandText = $product(pattern).first().text().trim() || $product(pattern).first().attr('content');
            if (brandText && brandText.length > 0) {
              selectors.brand = pattern;
              console.log(`Found product brand selector: ${pattern} with text: ${brandText}`);
              break;
            }
          }
        }

        // Try to find SKU selector on product page
        const skuSelectors = [
          '.product-sku',
          '.sku',
          '[itemprop="sku"]',
          '.product-meta .sku',
          '.product-info .sku',
          '.product-details .sku',
          '.product-reference',
          '.reference',
          '.product-id',
          'meta[property="product:sku"]',
          'meta[name="sku"]',
          '[data-product-sku]'
        ];

        for (const pattern of skuSelectors) {
          if ($product(pattern).length) {
            const skuText = $product(pattern).first().text().trim() || $product(pattern).first().attr('content') || $product(pattern).first().attr('data-product-sku');
            if (skuText && skuText.length > 0) {
              selectors.sku = pattern;
              console.log(`Found product SKU selector: ${pattern} with text: ${skuText}`);
              break;
            }
          }
        }

        // Try to find EAN13 selector on product page
        const ean13Selectors = [
          '.product-ean',
          '.ean',
          '.ean13',
          '.barcode',
          '[itemprop="gtin13"]',
          '[itemprop="gtin"]',
          '.product-meta .ean',
          '.product-info .ean',
          '.product-details .ean',
          'meta[property="product:ean"]',
          'meta[name="ean"]',
          '[data-product-ean]'
        ];

        for (const pattern of ean13Selectors) {
          if ($product(pattern).length) {
            const eanText = $product(pattern).first().text().trim() || $product(pattern).first().attr('content') || $product(pattern).first().attr('data-product-ean');
            if (eanText && eanText.length > 0) {
              selectors.ean13 = pattern;
              console.log(`Found product EAN13 selector: ${pattern} with text: ${eanText}`);
              break;
            }
          }
        }
      } catch (error) {
        console.error(`Error analyzing product page: ${error}`);
      }
    }

    // If we couldn't find selectors from a product page, try to find them on the homepage
    if (!selectors.name || !selectors.price) {
      console.log('Falling back to homepage analysis for product selectors');

      // Common patterns for product elements
      const productPatterns = [
        '.product',
        '.product-item',
        '.product-card',
        '.product-box',
        '.product-container',
        '.item',
        '.item-product',
        'article.product',
        'div[data-product-id]',
        'li[data-product-id]'
      ];

      // Try to find product elements
      let productSelector = '';
      for (const pattern of productPatterns) {
        if ($(pattern).length > 0) {
          productSelector = pattern;
          break;
        }
      }

      if (productSelector) {
        // Set the list item selector
        selectors.listItem = productSelector;

        // Find name selector if we don't have one yet
        if (!selectors.name) {
          const namePatterns = [
            '.product-name',
            '.product-title',
            '.name',
            '.title',
            'h2',
            'h3',
            'h4',
            'a.product-link'
          ];

          for (const pattern of namePatterns) {
            if ($(productSelector).find(pattern).length > 0) {
              selectors.name = `${productSelector} ${pattern}`;
              break;
            }
          }
        }

        // Find price selector if we don't have one yet
        if (!selectors.price) {
          const pricePatterns = [
            '.price',
            '.product-price',
            '.price-box',
            '.price-container',
            '.current-price',
            '.regular-price',
            '[data-price]'
          ];

          for (const pattern of pricePatterns) {
            if ($(productSelector).find(pattern).length > 0) {
              selectors.price = `${productSelector} ${pattern}`;
              break;
            }
          }
        }

        // Find image URL if we don't have one yet
        if (!selectors.imageUrl) {
          const imagePatterns = [
            'img',
            '.product-image img',
            '.image img',
            '.thumbnail img',
            '.product-thumbnail img'
          ];

          for (const pattern of imagePatterns) {
            if ($(productSelector).find(pattern).length > 0) {
              // Try to get the image URL
              const src = $(productSelector).find(pattern).first().attr('src');
              if (src) {
                selectors.imageUrl = src;
                break;
              }
            }
          }
        }

        // Find brand selector if we don't have one yet
        if (!selectors.brand) {
          const brandPatterns = [
            '.brand',
            '.product-brand',
            '.manufacturer',
            '.product-manufacturer',
            '[itemprop="brand"]'
          ];

          for (const pattern of brandPatterns) {
            if ($(productSelector).find(pattern).length > 0) {
              selectors.brand = `${productSelector} ${pattern}`;
              break;
            }
          }
        }

        // Find SKU selector if we don't have one yet
        if (!selectors.sku) {
          const skuPatterns = [
            '.sku',
            '.product-sku',
            '.product-id',
            '.reference',
            '.product-reference',
            '[itemprop="sku"]',
            '[data-product-sku]'
          ];

          for (const pattern of skuPatterns) {
            if ($(productSelector).find(pattern).length > 0) {
              selectors.sku = `${productSelector} ${pattern}`;
              break;
            }
          }
        }

        // Find EAN13 selector if we don't have one yet
        if (!selectors.ean13) {
          const ean13Patterns = [
            '.ean',
            '.ean13',
            '.barcode',
            '.product-ean',
            '[itemprop="gtin13"]',
            '[itemprop="gtin"]',
            '[data-product-ean]'
          ];

          for (const pattern of ean13Patterns) {
            if ($(productSelector).find(pattern).length > 0) {
              selectors.ean13 = `${productSelector} ${pattern}`;
              break;
            }
          }
        }

        // Find link selector if we don't have one yet
        if (!selectors.link) {
          const linkPatterns = [
            'a',
            'a.product-link',
            'a.product-url',
            'a.product-name',
            'a.name',
            'a.title'
          ];

          for (const pattern of linkPatterns) {
            if ($(productSelector).find(pattern).length > 0) {
              selectors.link = `${productSelector} ${pattern}`;
              break;
            }
          }
        }
      }
    }

    return selectors;
  }

  /**
   * Store the analysis result in the database
   * @param analysisResult The analysis result
   * @param userId The ID of the user
   * @param competitorId The ID of the competitor
   * @returns The ID of the stored analysis
   */
  static async storeAnalysisResult(
    analysisResult: SiteAnalysisResult,
    userId: string,
    competitorId: string
  ): Promise<string> {
    // Skip database operations in test environment
    if (process.env.NODE_ENV === 'test') {
      return 'mock-analysis-id';
    }

    const supabase = createSupabaseAdminClient();

    // Create a record in the scraper_analysis table
    const { data, error } = await supabase
      .from('scraper_analysis')
      .insert({
        user_id: userId,
        competitor_id: competitorId,
        url: analysisResult.url,
        base_url: analysisResult.baseUrl,
        hostname: analysisResult.hostname,
        title: analysisResult.title,
        sitemap_urls: analysisResult.sitemapUrls,
        brand_pages: analysisResult.brandPages,
        category_pages: analysisResult.categoryPages,
        product_listing_pages: analysisResult.productPages, // Using renamed field but keeping DB column name
        api_endpoints: analysisResult.apiEndpoints,
        proposed_strategy: analysisResult.proposedStrategy,
        strategy_description: analysisResult.strategyDescription,
        html_sample: analysisResult.htmlSample,
        product_selectors: analysisResult.productSelectors
      })
      .select('id')
      .single();

    if (error) {
      console.error(`Error storing analysis result: ${error.message}`);
      throw new Error(`Failed to store analysis result: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Get a stored analysis result by ID
   * @param analysisId The ID of the analysis
   * @returns The analysis result
   */
  static async getAnalysisResult(analysisId: string): Promise<SiteAnalysisResult> {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('scraper_analysis')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (error) {
      console.error(`Error getting analysis result: ${error.message}`);
      throw new Error(`Failed to get analysis result: ${error.message}`);
    }

    // Convert the database record to a SiteAnalysisResult
    return {
      url: data.url,
      baseUrl: data.base_url,
      hostname: data.hostname,
      title: data.title,
      sitemapUrls: data.sitemap_urls || [],
      brandPages: data.brand_pages || [],
      categoryPages: data.category_pages || [],
      productPages: data.product_listing_pages || [], // Map DB column to new field name
      apiEndpoints: data.api_endpoints || [],
      proposedStrategy: data.proposed_strategy,
      strategyDescription: data.strategy_description,
      htmlSample: data.html_sample,
      productSelectors: data.product_selectors
    };
  }
}
