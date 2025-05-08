import { GoogleGenerativeAI } from '@google/generative-ai';

// Default model to use
const DEFAULT_MODEL = 'gemini-2.5-flash-preview-04-17';

/**
 * Initialize the Google Generative AI client
 */
function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('Missing GOOGLE_GEMINI_API_KEY environment variable');
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Generate content using the Gemini API
 * @param prompt The prompt to send to the model
 * @param modelName Optional model name (default: 'gemini-2.5-flash-preview-04-17')
 * @returns The generated content
 */
export async function generateWithGemini(prompt: string, modelName = DEFAULT_MODEL): Promise<string> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: modelName });

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (error: unknown) {
    console.error('Error generating content with Gemini:', error);

    let errorMessage: string;
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'object' && error !== null) {
      // Try to extract error message from API error response
      const errorObj = error as Record<string, unknown>;
      if ('message' in errorObj && typeof errorObj.message === 'string') {
        errorMessage = errorObj.message;
      } else {
        errorMessage = JSON.stringify(error);
      }
    } else {
      errorMessage = String(error);
    }

    throw new Error(`Gemini API error: ${errorMessage}`);
  }
}

/**
 * Generate content with a structured prompt
 * @param systemPrompt The system instructions
 * @param userPrompt The user's specific request
 * @param modelName Optional model name (default: 'gemini-2.5-flash-preview-04-17')
 * @returns The generated content
 */
export async function generateWithStructuredPrompt(
  systemPrompt: string,
  userPrompt: string,
  modelName = DEFAULT_MODEL
): Promise<string> {
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  return generateWithGemini(fullPrompt, modelName);
}
