// @ts-nocheck
/**
 * Progress tracking utilities for async job processing
 * Provides real-time status updates for long-running research operations
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0'

export interface ProgressStep {
  step: string;
  percentage: number;
  message?: string;
}

export const PROGRESS_STEPS = {
  INITIALIZING: { step: 'Initializing research...', percentage: 5 },
  // Option B Redesign: Unified phases
  DATA_GATHERING_START: { step: 'Gathering research data...', percentage: 10 },
  DATA_GATHERING_COMPLETE: { step: 'Research data gathered', percentage: 35 },
  AI_SYNTHESIS_START: { step: 'Synthesizing interview preparation...', percentage: 40 },
  AI_SYNTHESIS_COMPLETE: { step: 'Synthesis complete', percentage: 70 },
  QUESTION_VALIDATION_START: { step: 'Validating question count...', percentage: 72 },
  // Legacy phases (kept for backward compatibility)
  COMPANY_RESEARCH_START: { step: 'Analyzing company background...', percentage: 15 },
  COMPANY_RESEARCH_COMPLETE: { step: 'Company research completed', percentage: 30 },
  COMPANY_RESEARCH_PARTIAL: { step: 'Company research partial (continuing)', percentage: 25 },
  JOB_ANALYSIS_START: { step: 'Processing job requirements...', percentage: 35 },
  JOB_ANALYSIS_COMPLETE: { step: 'Job analysis completed', percentage: 50 },
  JOB_ANALYSIS_PARTIAL: { step: 'Job analysis partial (continuing)', percentage: 45 },
  CV_ANALYSIS_START: { step: 'Evaluating CV match...', percentage: 55 },
  CV_ANALYSIS_COMPLETE: { step: 'CV analysis completed', percentage: 70 },
  CV_ANALYSIS_PARTIAL: { step: 'CV analysis partial (continuing)', percentage: 65 },
  QUESTION_GENERATION_START: { step: 'Generating interview questions...', percentage: 75 },
  QUESTION_GENERATION_COMPLETE: { step: 'Questions generated successfully', percentage: 90 },
  FINALIZING: { step: 'Finalizing results...', percentage: 95 },
  COMPLETED: { step: 'Research completed successfully!', percentage: 100 },
  STALLED: { step: 'Taking longer than expected, retrying...', percentage: 80 }
} as const;

/**
 * Progress tracker class for managing async job status
 */
export class ProgressTracker {
  private supabase: any;
  private searchId: string;

  constructor(searchId: string) {
    this.searchId = searchId;
    this.supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
  }

  /**
   * Update search progress with predefined step
   */
  async updateStep(stepKey: keyof typeof PROGRESS_STEPS, customMessage?: string): Promise<void> {
    const step = PROGRESS_STEPS[stepKey];
    await this.updateProgress('processing', step.step, step.percentage, customMessage);
  }

  /**
   * Update search progress with custom values
   */
  async updateProgress(
    status: 'pending' | 'processing' | 'completed' | 'failed',
    step: string,
    percentage: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('update_search_progress', {
        search_uuid: this.searchId,
        new_status: status,
        new_step: step,
        new_percentage: percentage,
        error_msg: errorMessage
      });

      if (error) {
        console.error('Failed to update progress:', error);
      } else {
        console.log(`Progress updated: ${step} (${percentage}%)`);
      }
    } catch (error) {
      console.error('Error updating search progress:', error);
      // Don't throw - progress updates shouldn't break the main flow
    }
  }

  /**
   * Mark search as completed
   */
  async markCompleted(finalMessage?: string): Promise<void> {
    await this.updateProgress(
      'completed', 
      finalMessage || PROGRESS_STEPS.COMPLETED.step, 
      100
    );
  }

  /**
   * Mark search as failed with error
   */
  async markFailed(errorMessage: string, step?: string): Promise<void> {
    await this.updateProgress(
      'failed',
      step || 'Research failed',
      0,
      errorMessage
    );
  }

  /**
   * Create a progress wrapper for async operations
   */
  async withProgress<T>(
    operation: () => Promise<T>,
    startStep: keyof typeof PROGRESS_STEPS,
    endStep: keyof typeof PROGRESS_STEPS,
    errorMessage?: string
  ): Promise<T> {
    try {
      await this.updateStep(startStep);
      const result = await operation();
      await this.updateStep(endStep);
      return result;
    } catch (error) {
      const message = errorMessage || `Failed during ${PROGRESS_STEPS[startStep].step}`;
      await this.markFailed(message, PROGRESS_STEPS[startStep].step);
      throw error;
    }
  }
}

/**
 * Concurrent processing timeout configuration.
 * Retrieval runs in the interview-research background job, so these are
 * stall guards for individual phases rather than user-facing request limits.
 */
export const CONCURRENT_TIMEOUTS = {
  companyResearch: 120000,
  jobAnalysis: 120000,
  cvAnalysis: 45000,
  questionGeneration: 120000,
  totalOperation: 300000,
} as const;

/**
 * Create timeout promise for concurrent operations
 */
export function createTimeoutPromise(ms: number, operation: string): Promise<never> {
  return new Promise((_, reject) => 
    setTimeout(() => reject(new Error(`${operation} timeout after ${ms}ms`)), ms)
  );
}

/**
 * Execute operation with timeout and progress tracking
 */
export async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  operationName: string,
  tracker?: ProgressTracker
): Promise<T> {
  try {
    return await Promise.race([
      operation(),
      createTimeoutPromise(timeoutMs, operationName)
    ]);
  } catch (error) {
    if (tracker) {
      await tracker.markFailed(`${operationName} failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Execute operation with timeout but DO NOT throw on failure.
 * This is useful for soft-fail concurrency where we want to continue with partial data.
 */
export async function executeWithTimeoutSafe<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
): Promise<{ ok: true; value: T } | { ok: false; error: Error }> {
  try {
    const value = await Promise.race([
      operation(),
      createTimeoutPromise(timeoutMs, 'operation')
    ]);
    return { ok: true, value: value as T };
  } catch (e: any) {
    return { ok: false, error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/**
 * Retry logic with exponential backoff
 * Useful for handling transient failures (network issues, timeouts)
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 2,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, etc.
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        console.log(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms. Error: ${lastError.message}`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  throw lastError || new Error('Operation failed after retries');
}

/**
 * Validate that data returned from a service is not empty
 * Returns true if data is meaningful, false if empty/null
 */
export function isValidData<T>(data: T | null | undefined): boolean {
  if (!data) return false;

  // Check if it's an object with no properties
  if (typeof data === 'object' && !Array.isArray(data)) {
    return Object.keys(data as object).length > 0;
  }

  // Check if it's an array with elements
  if (Array.isArray(data)) {
    return data.length > 0;
  }

  // String, number, boolean - treat as valid if present
  return true;
}

/**
 * Validate response from a fetch call
 * Returns data if valid, null if response is ok but data is empty
 */
export async function validateFetchResponse<T>(
  response: Response
): Promise<T | null> {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as T;

  // Check if response has actual data
  if (!isValidData(data)) {
    console.warn('Response received but contained no meaningful data');
    return null;
  }

  return data;
}
