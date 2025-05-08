/**
 * Service for managing scraper AI session data
 * This service is used to track progress through the multi-phase AI scraper generation process
 */

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { SiteAnalysisResult } from "@/lib/services/scraper-analysis-service";
import { UrlCollectionResult } from "@/lib/services/scraper-url-collection-service";
import { DataExtractionResult } from "@/lib/services/scraper-data-extraction-service";
import { ScriptAssemblyResult } from "@/lib/services/scraper-assembly-service";
import { v4 as uuidv4 } from 'uuid';

// Define a type for API endpoint info
interface ApiEndpointInfo {
  url: string;
  method: string;
  description?: string;
  isProductList?: boolean;
  isProductDetail?: boolean;
  headers?: Record<string, string>;
  parameters?: Record<string, string>;
}

// Define a type for extracted product data
interface ExtractedProductData {
  url: string;
  name: string;
  price: number | null;
  currency: string | null;
  sku?: string | null;
  brand?: string | null;
  ean?: string | null;
  description?: string | null;
  image_url?: string | null;
  is_available: boolean;
  raw_price?: string | null;
  [key: string]: unknown;
}

// Define a type for the database record
interface DbScraperAISession {
  id: string;
  user_id: string;
  competitor_id: string;
  url: string;
  created_at: string;
  updated_at: string;
  current_phase: ScraperAIPhase;
  analysis_data: ScraperAIAnalysisData;
  url_collection_data: ScraperAIUrlCollectionData;
  data_extraction_data: ScraperAIDataExtractionData;
  assembly_data: ScraperAIAssemblyData;
}

/**
 * Represents the current phase of the AI scraper generation process
 */
export type ScraperAIPhase = 'analysis' | 'data-validation' | 'assembly' | 'complete';

/**
 * Legacy phases - kept for backward compatibility
 */
export type LegacyScraperAIPhase = 'analysis' | 'url-collection' | 'data-extraction' | 'assembly' | 'complete';

/**
 * Represents the analysis data for a scraper AI session
 */
export interface ScraperAIAnalysisData {
  analysisId?: string;
  sitemapUrls?: string[];
  brandPages?: string[];
  categoryPages?: string[];
  productListingPages?: string[]; // Original field name from database
  productPages?: string[]; // New field name for UI consistency
  apiEndpoints?: ApiEndpointInfo[];
  proposedStrategy?: string;
  strategyDescription?: string;
  userFeedback?: string;
  approved: boolean;
}

/**
 * Represents the URL collection data for a scraper AI session
 */
export interface ScraperAIUrlCollectionData {
  collectionId?: string;
  generatedCode?: string;
  collectedUrls?: string[];
  totalUrlCount?: number;
  sampleUrls?: string[];
  userFeedback?: string;
  approved: boolean;
}

/**
 * Represents the data extraction data for a scraper AI session
 */
export interface ScraperAIDataExtractionData {
  extractionId?: string;
  generatedCode?: string;
  extractedProducts?: ExtractedProductData[];
  userFeedback?: string;
  approved: boolean;
}

/**
 * Represents the assembly data for a scraper AI session
 */
export interface ScraperAIAssemblyData {
  assemblyId?: string;
  assembledScript?: string;
  validationResult?: {
    valid: boolean;
    error?: string;
  };
  scraperId?: string;
}

/**
 * Represents a scraper AI session
 */
export interface ScraperAISession {
  id: string;
  userId: string;
  competitorId: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  currentPhase: ScraperAIPhase;
  analysisData?: ScraperAIAnalysisData;
  urlCollectionData?: ScraperAIUrlCollectionData;
  dataExtractionData?: ScraperAIDataExtractionData;
  assemblyData?: ScraperAIAssemblyData;
}

/**
 * Service for managing scraper AI session data
 */
export class ScraperSessionService {
  /**
   * Create a new scraper AI session
   * @param userId The ID of the user
   * @param competitorId The ID of the competitor
   * @param url The URL of the website to scrape
   * @returns The created session
   */
  static async createSession(
    userId: string,
    competitorId: string,
    url: string
  ): Promise<ScraperAISession> {
    console.log(`Creating scraper AI session for ${url}`);

    const supabase = createSupabaseAdminClient();

    // Create a new session
    const now = new Date().toISOString();
    const sessionId = uuidv4();

    const { data, error } = await supabase
      .from('scraper_ai_sessions')
      .insert({
        id: sessionId,
        user_id: userId,
        competitor_id: competitorId,
        url,
        created_at: now,
        updated_at: now,
        current_phase: 'analysis',
        analysis_data: { approved: false },
        url_collection_data: { approved: false }, // Kept for backward compatibility
        data_extraction_data: { approved: false }, // Used for data validation phase
        assembly_data: {}
      })
      .select()
      .single();

    if (error) {
      console.error(`Error creating scraper AI session: ${error.message}`);
      throw new Error(`Failed to create scraper AI session: ${error.message}`);
    }

    // Convert the database record to a ScraperAISession
    return this.mapDbRecordToSession(data);
  }

  /**
   * Get a scraper AI session by ID
   * @param sessionId The ID of the session
   * @returns The session
   */
  static async getSession(sessionId: string): Promise<ScraperAISession> {
    console.log(`Getting scraper AI session ${sessionId}`);

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('scraper_ai_sessions')
      .select()
      .eq('id', sessionId)
      .single();

    if (error) {
      console.error(`Error getting scraper AI session: ${error.message}`);
      throw new Error(`Failed to get scraper AI session: ${error.message}`);
    }

    // Convert the database record to a ScraperAISession
    return this.mapDbRecordToSession(data);
  }

  /**
   * Get all scraper AI sessions for a user
   * @param userId The ID of the user
   * @returns The sessions
   */
  static async getUserSessions(userId: string): Promise<ScraperAISession[]> {
    console.log(`Getting scraper AI sessions for user ${userId}`);

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('scraper_ai_sessions')
      .select()
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error(`Error getting scraper AI sessions: ${error.message}`);
      throw new Error(`Failed to get scraper AI sessions: ${error.message}`);
    }

    // Convert the database records to ScraperAISessions
    return data.map(record => this.mapDbRecordToSession(record));
  }

  /**
   * Get all scraper AI sessions for a competitor
   * @param competitorId The ID of the competitor
   * @returns The sessions
   */
  static async getCompetitorSessions(competitorId: string): Promise<ScraperAISession[]> {
    console.log(`Getting scraper AI sessions for competitor ${competitorId}`);

    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('scraper_ai_sessions')
      .select()
      .eq('competitor_id', competitorId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error(`Error getting scraper AI sessions: ${error.message}`);
      throw new Error(`Failed to get scraper AI sessions: ${error.message}`);
    }

    // Convert the database records to ScraperAISessions
    return data.map(record => this.mapDbRecordToSession(record));
  }

  /**
   * Update the analysis data for a scraper AI session
   * @param sessionId The ID of the session
   * @param analysisResult The analysis result
   * @param analysisId The ID of the analysis record
   * @returns The updated session
   */
  static async updateAnalysisData(
    sessionId: string,
    analysisResult: SiteAnalysisResult,
    analysisId: string
  ): Promise<ScraperAISession> {
    console.log(`Updating analysis data for session ${sessionId}`);

    const supabase = createSupabaseAdminClient();

    // Note: We're not using the session data here, but keeping the code for reference
    // await this.getSession(sessionId);

    // Update the analysis data
    const analysisData: ScraperAIAnalysisData = {
      analysisId,
      sitemapUrls: analysisResult.sitemapUrls,
      brandPages: analysisResult.brandPages,
      categoryPages: analysisResult.categoryPages,
      productListingPages: analysisResult.productPages, // Use the new field name but store in the original DB field
      productPages: analysisResult.productPages, // Also set the new field name for UI consistency
      apiEndpoints: analysisResult.apiEndpoints,
      proposedStrategy: analysisResult.proposedStrategy,
      strategyDescription: analysisResult.strategyDescription,
      approved: false
    };

    // Update the session
    const { data, error } = await supabase
      .from('scraper_ai_sessions')
      .update({
        analysis_data: analysisData,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating analysis data: ${error.message}`);
      throw new Error(`Failed to update analysis data: ${error.message}`);
    }

    // Convert the database record to a ScraperAISession
    return this.mapDbRecordToSession(data);
  }

  /**
   * Approve the analysis data for a scraper AI session and advance to the next phase
   * @param sessionId The ID of the session
   * @param userFeedback Optional user feedback
   * @returns The updated session
   */
  static async approveAnalysisData(
    sessionId: string,
    userFeedback?: string
  ): Promise<ScraperAISession> {
    console.log(`Approving analysis data for session ${sessionId}`);

    const supabase = createSupabaseAdminClient();

    // Get the current session
    const session = await this.getSession(sessionId);

    // Update the analysis data
    const analysisData = {
      ...session.analysisData,
      userFeedback,
      approved: true
    };

    // Update the session to move to the data-validation phase
    const { data, error } = await supabase
      .from('scraper_ai_sessions')
      .update({
        analysis_data: analysisData,
        current_phase: 'data-validation',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error(`Error approving analysis data: ${error.message}`);
      throw new Error(`Failed to approve analysis data: ${error.message}`);
    }

    // Convert the database record to a ScraperAISession
    return this.mapDbRecordToSession(data);
  }

  /**
   * Update the URL collection data for a scraper AI session
   * @param sessionId The ID of the session
   * @param urlCollectionResult The URL collection result
   * @param collectionId The ID of the URL collection record
   * @returns The updated session
   */
  static async updateUrlCollectionData(
    sessionId: string,
    urlCollectionResult: UrlCollectionResult,
    collectionId: string
  ): Promise<ScraperAISession> {
    console.log(`Updating URL collection data for session ${sessionId}`);

    const supabase = createSupabaseAdminClient();

    // Note: We're not using the session data here, but keeping the code for reference
    // await this.getSession(sessionId);

    // Update the URL collection data
    const urlCollectionData: ScraperAIUrlCollectionData = {
      collectionId,
      generatedCode: urlCollectionResult.generatedCode,
      collectedUrls: urlCollectionResult.urls,
      totalUrlCount: urlCollectionResult.totalCount,
      sampleUrls: urlCollectionResult.sampleUrls,
      approved: false
    };

    // Update the session
    const { data, error } = await supabase
      .from('scraper_ai_sessions')
      .update({
        url_collection_data: urlCollectionData,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating URL collection data: ${error.message}`);
      throw new Error(`Failed to update URL collection data: ${error.message}`);
    }

    // Convert the database record to a ScraperAISession
    return this.mapDbRecordToSession(data);
  }

  /**
   * Approve the URL collection data for a scraper AI session and advance to the next phase
   * @param sessionId The ID of the session
   * @param userFeedback Optional user feedback
   * @returns The updated session
   */
  static async approveUrlCollectionData(
    sessionId: string,
    userFeedback?: string
  ): Promise<ScraperAISession> {
    console.log(`Approving URL collection data for session ${sessionId}`);

    const supabase = createSupabaseAdminClient();

    // Get the current session
    const session = await this.getSession(sessionId);

    // Update the URL collection data
    const urlCollectionData = {
      ...session.urlCollectionData,
      userFeedback,
      approved: true
    };

    // Update the session
    const { data, error } = await supabase
      .from('scraper_ai_sessions')
      .update({
        url_collection_data: urlCollectionData,
        current_phase: 'data-extraction',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error(`Error approving URL collection data: ${error.message}`);
      throw new Error(`Failed to approve URL collection data: ${error.message}`);
    }

    // Convert the database record to a ScraperAISession
    return this.mapDbRecordToSession(data);
  }

  /**
   * Update the data extraction data for a scraper AI session
   * @param sessionId The ID of the session
   * @param dataExtractionResult The data extraction result
   * @param extractionId The ID of the data extraction record
   * @returns The updated session
   */
  static async updateDataExtractionData(
    sessionId: string,
    dataExtractionResult: DataExtractionResult,
    extractionId: string
  ): Promise<ScraperAISession> {
    console.log(`Updating data extraction data for session ${sessionId}`);

    const supabase = createSupabaseAdminClient();

    // Note: We're not using the session data here, but keeping the code for reference
    // await this.getSession(sessionId);

    // Update the data extraction data
    const dataExtractionData: ScraperAIDataExtractionData = {
      extractionId,
      generatedCode: dataExtractionResult.generatedCode,
      // Type assertion to handle the compatibility between ScrapedProductData and ExtractedProductData
      extractedProducts: dataExtractionResult.products as unknown as ExtractedProductData[],
      approved: false
    };

    // Update the session
    const { data, error } = await supabase
      .from('scraper_ai_sessions')
      .update({
        data_extraction_data: dataExtractionData,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating data extraction data: ${error.message}`);
      throw new Error(`Failed to update data extraction data: ${error.message}`);
    }

    // Convert the database record to a ScraperAISession
    return this.mapDbRecordToSession(data);
  }

  /**
   * Approve the data extraction data for a scraper AI session and advance to the next phase
   * @param sessionId The ID of the session
   * @param userFeedback Optional user feedback
   * @returns The updated session
   */
  static async approveDataExtractionData(
    sessionId: string,
    userFeedback?: string
  ): Promise<ScraperAISession> {
    console.log(`Approving data extraction data for session ${sessionId}`);

    const supabase = createSupabaseAdminClient();

    // Get the current session
    const session = await this.getSession(sessionId);

    // Update the data extraction data
    const dataExtractionData = {
      ...session.dataExtractionData,
      userFeedback,
      approved: true
    };

    // Update the session
    const { data, error } = await supabase
      .from('scraper_ai_sessions')
      .update({
        data_extraction_data: dataExtractionData,
        current_phase: 'assembly',
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error(`Error approving data extraction data: ${error.message}`);
      throw new Error(`Failed to approve data extraction data: ${error.message}`);
    }

    // Convert the database record to a ScraperAISession
    return this.mapDbRecordToSession(data);
  }

  /**
   * Update the assembly data for a scraper AI session
   * @param sessionId The ID of the session
   * @param scriptAssemblyResult The script assembly result
   * @param assemblyId The ID of the script assembly record
   * @returns The updated session
   */
  static async updateAssemblyData(
    sessionId: string,
    scriptAssemblyResult: ScriptAssemblyResult,
    assemblyId: string
  ): Promise<ScraperAISession> {
    console.log(`Updating assembly data for session ${sessionId}`);

    const supabase = createSupabaseAdminClient();

    // Note: We're not using the session data here, but keeping the code for reference
    // await this.getSession(sessionId);

    // Update the assembly data
    const assemblyData: ScraperAIAssemblyData = {
      assemblyId,
      assembledScript: scriptAssemblyResult.assembledScript,
      validationResult: scriptAssemblyResult.validationResult,
      scraperId: scriptAssemblyResult.scraperId
    };

    // Determine the next phase
    const nextPhase: ScraperAIPhase = scriptAssemblyResult.validationResult.valid ? 'complete' : 'assembly';

    // Update the session
    const { data, error } = await supabase
      .from('scraper_ai_sessions')
      .update({
        assembly_data: assemblyData,
        current_phase: nextPhase,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error(`Error updating assembly data: ${error.message}`);
      throw new Error(`Failed to update assembly data: ${error.message}`);
    }

    // Convert the database record to a ScraperAISession
    return this.mapDbRecordToSession(data);
  }

  /**
   * Delete a scraper AI session
   * @param sessionId The ID of the session
   */
  static async deleteSession(sessionId: string): Promise<void> {
    console.log(`Deleting scraper AI session ${sessionId}`);

    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('scraper_ai_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.error(`Error deleting scraper AI session: ${error.message}`);
      throw new Error(`Failed to delete scraper AI session: ${error.message}`);
    }
  }

  /**
   * Map a database record to a ScraperAISession
   * @param record The database record
   * @returns The ScraperAISession
   */
  private static mapDbRecordToSession(record: DbScraperAISession): ScraperAISession {
    // Make a copy of the analysis data to modify it
    const analysisData = record.analysis_data ? { ...record.analysis_data } : undefined;

    // If we have analysis data with productListingPages, also set productPages to the same value
    if (analysisData && analysisData.productListingPages) {
      analysisData.productPages = analysisData.productListingPages;
    }

    // Map legacy phases to new phases if needed
    let currentPhase = record.current_phase as string;
    if (currentPhase === 'url-collection' || currentPhase === 'data-extraction') {
      console.log(`Mapping legacy phase ${currentPhase} to 'data-validation'`);
      currentPhase = 'data-validation';
    }

    return {
      id: record.id,
      userId: record.user_id,
      competitorId: record.competitor_id,
      url: record.url,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      currentPhase: currentPhase as ScraperAIPhase,
      analysisData: analysisData,
      urlCollectionData: record.url_collection_data,
      dataExtractionData: record.data_extraction_data,
      assemblyData: record.assembly_data
    };
  }
}
