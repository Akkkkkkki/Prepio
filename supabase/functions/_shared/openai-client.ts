// Shared OpenAI client utility for consistent API interactions across functions
import { RESEARCH_CONFIG } from "./config.ts";

export interface OpenAIRequest {
  model: string;
  prompt: string;
  systemPrompt: string;
  maxTokens: number;
  useJsonMode?: boolean;
}

export interface OpenAIResponse {
  content: string;
  raw: any;
}

export async function callOpenAI(
  apiKey: string,
  request: OpenAIRequest
): Promise<OpenAIResponse> {
  const body: any = {
    model: request.model,
    messages: [
      {
        role: 'system',
        content: request.systemPrompt
      },
      {
        role: 'user',
        content: request.prompt
      }
    ],
    max_tokens: request.maxTokens,
  };

  // Add JSON mode if requested (default from config)
  if (request.useJsonMode ?? RESEARCH_CONFIG.openai.useJsonMode) {
    body.response_format = { type: "json_object" };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  return {
    content,
    raw: data
  };
}

/**
 * Strip markdown code blocks from JSON response
 * Handles cases where AI returns ```json ... ``` or ``` ... ```
 */
function stripMarkdownCodeBlocks(content: string): string {
  // Remove markdown code blocks (```json ... ``` or ``` ... ```)
  let cleaned = content.trim();
  
  // Remove opening ```json or ```
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.substring(7).trim();
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.substring(3).trim();
  }
  
  // Remove closing ```
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.substring(0, cleaned.length - 3).trim();
  }
  
  return cleaned;
}

export function parseJsonResponse<T>(content: string, fallback: T): T {
  try {
    // Strip markdown code blocks if present
    const cleaned = stripMarkdownCodeBlocks(content);
    return JSON.parse(cleaned);
  } catch (parseError) {
    // Bound the logged raw response to a short preview. The model output can
    // echo user PII (CV text, interview answers, imported profile data) for the
    // cv-analysis / answer-feedback / profile-import callers, so we log only a
    // sample rather than the whole payload — matching the "first 500 chars"
    // content-sampling convention in RESEARCH_CONFIG.logging.logContentSamples.
    const RAW_PREVIEW_CHARS = 500;
    const preview =
      content.length > RAW_PREVIEW_CHARS
        ? `${content.slice(0, RAW_PREVIEW_CHARS)}… [truncated, ${content.length} chars total]`
        : content;
    console.error("Failed to parse OpenAI JSON response:", parseError);
    console.error("Raw response (preview):", preview);
    return fallback;
  }
}