/**
 * React hook for polling search progress in real-time
 * Supports async job processing with automatic status updates
 */

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SearchProgress {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress_step: string;
  progress_pct: number;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch search progress from database
 */
async function fetchSearchProgress(searchId: string): Promise<SearchProgress | null> {
  if (!searchId) {
    throw new Error('Search ID is required');
  }

  const { data, error } = await supabase
    .from('searches')
    .select(`
      id,
      status,
      progress_step,
      progress_pct,
      error_message,
      started_at,
      completed_at,
      created_at,
      updated_at
    `)
    .eq('id', searchId)
    .single();

  if (error) {
    console.error('Error fetching search progress:', error);
    throw error;
  }

  if (!data) return null;
  // Map DB row to SearchProgress interface
  return {
    id: (data as any).id,
    status: ((data as any).status || 'pending') as SearchProgress['status'],
    progress_step: (data as any).progress_step || '',
    progress_pct: (data as any).progress_pct || 0,
    error_message: (data as any).error_message || undefined,
    started_at: (data as any).started_at || undefined,
    completed_at: (data as any).completed_at || undefined,
    created_at: (data as any).created_at,
    updated_at: (data as any).updated_at,
  };
}

/**
 * Hook for real-time search progress tracking
 * 
 * @param searchId - The UUID of the search to track
 * @param options - Configuration options
 * @returns Query result with search progress data
 */
export function useSearchProgress(
  searchId: string | null,
  options: {
    enabled?: boolean;
    pollInterval?: number;
    retryOnFailure?: boolean;
  } = {}
) {
  const {
    enabled = true,
    pollInterval = 2000, // Poll every 2 seconds initially
    retryOnFailure = true
  } = options;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['search-progress', searchId],
    queryFn: () => fetchSearchProgress(searchId!),
    enabled: enabled && !!searchId,

    // Adaptive polling configuration (Phase 3 improvement)
    // Poll more frequently in first 30s, then back off to reduce load
    refetchInterval: (query) => {
      const current = query.state.data as SearchProgress | undefined;

      // Stop polling when search is completed or failed
      if (!current || current.status === 'completed' || current.status === 'failed') {
        return false;
      }

      // Adaptive polling: faster at start, slower as time goes on
      if (current.started_at) {
        const elapsedMs = Date.now() - new Date(current.started_at).getTime();

        // First 30 seconds: poll every 2 seconds (aggressive)
        if (elapsedMs < 30000) {
          return pollInterval;
        }

        // After 30 seconds: poll every 5 seconds (reduced load)
        if (elapsedMs < 60000) {
          return 5000;
        }

        // After 60 seconds: poll every 10 seconds (minimal load)
        return 10000;
      }

      // Default if no started_at
      return pollInterval;
    },

    // Retry configuration
    retry: retryOnFailure ? 3 : false,
    retryDelay: (attemptIndex) => {
      // Exponential backoff for retries: 1s, 2s, 4s
      return Math.min(1000 * Math.pow(2, attemptIndex), 8000);
    },

    // Cache configuration
    staleTime: 500, // Consider data fresh for 500ms
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes

    // Background refetch settings
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  // Realtime subscription to progress updates for this search row
  useEffect(() => {
    if (!searchId) return;
    
    let channel: ReturnType<typeof supabase.channel> | null = null;
    
    try {
      channel = supabase
        .channel(`searches-progress-${searchId}`, {
          config: {
            broadcast: { self: false },
            presence: { key: searchId }
          }
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'searches', filter: `id=eq.${searchId}` },
          (payload) => {
            try {
              const row: any = (payload as any).new ?? (payload as any).record;
              if (row) {
                // Map DB row to SearchProgress interface
                const progressData: SearchProgress = {
                  id: row.id,
                  status: (row.status || 'pending') as SearchProgress['status'],
                  progress_step: row.progress_step || '',
                  progress_pct: row.progress_pct || 0,
                  error_message: row.error_message || undefined,
                  started_at: row.started_at || undefined,
                  completed_at: row.completed_at || undefined,
                  created_at: row.created_at,
                  updated_at: row.updated_at,
                };
                queryClient.setQueryData(['search-progress', searchId], progressData);
              }
            } catch (error) {
              console.error('Error processing Realtime update:', error);
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            // Successfully subscribed
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('Realtime channel error, falling back to polling only');
          } else if (status === 'TIMED_OUT') {
            console.warn('Realtime subscription timed out, falling back to polling only');
          }
        });
    } catch (error) {
      console.error('Failed to set up Realtime subscription:', error);
      // Continue with polling only if Realtime fails
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          console.error('Error removing Realtime channel:', error);
        }
      }
    };
  }, [searchId, queryClient]);

  return query;
}

/**
 * Hook for checking if a search is still processing
 */
export function useIsSearchProcessing(searchId: string | null) {
  const { data: search } = useSearchProgress(searchId);
  
  return {
    isProcessing: search?.status === 'processing' || search?.status === 'pending',
    isCompleted: search?.status === 'completed',
    isFailed: search?.status === 'failed',
    progress: search?.progress_pct || 0,
    currentStep: search?.progress_step || 'Initializing...',
    errorMessage: search?.error_message
  };
}

/**
 * Hook for estimated completion time based on progress
 */
export function useEstimatedCompletionTime(searchId: string | null) {
  const { data: search } = useSearchProgress(searchId);

  if (!search || search.status !== 'processing' || !search.started_at) {
    return null;
  }

  const startTime = new Date(search.started_at).getTime();
  const currentTime = Date.now();
  const elapsedTime = currentTime - startTime;
  const progress = search.progress_pct || 0;

  if (progress <= 0) {
    return null;
  }

  // Estimate total time based on current progress
  const estimatedTotalTime = (elapsedTime / progress) * 100;
  const remainingTime = estimatedTotalTime - elapsedTime;

  // Cap at reasonable limits
  const remainingSeconds = Math.max(0, Math.min(60, Math.round(remainingTime / 1000)));

  return {
    remainingSeconds,
    estimatedCompletion: new Date(currentTime + remainingTime),
    elapsedSeconds: Math.round(elapsedTime / 1000)
  };
}

/**
 * Hook for detecting stalled jobs (Phase 3 improvement)
 * A job is considered stalled if:
 * - Status is 'processing'
 * - No updates for >30 seconds
 * Returns stalledfor how long (in seconds)
 */
export function useSearchStallDetection(searchId: string | null) {
  const { data: search } = useSearchProgress(searchId);

  if (!search || search.status !== 'processing') {
    return {
      isStalled: false,
      stalledSeconds: 0,
    };
  }

  const lastUpdateTime = new Date(search.updated_at).getTime();
  const currentTime = Date.now();
  const secondsSinceUpdate = Math.round((currentTime - lastUpdateTime) / 1000);
  const stallThresholdSeconds = 30;

  return {
    isStalled: secondsSinceUpdate > stallThresholdSeconds,
    stalledSeconds: Math.max(0, secondsSinceUpdate - stallThresholdSeconds),
    secondsSinceUpdate,
  };
}

/**
 * Utility function to format progress step for display
 */
export function formatProgressStep(step: string): string {
  // Remove technical prefixes and make user-friendly
  return step
    .replace(/^(Analyzing|Processing|Evaluating|Generating|Finalizing)/, '')
    .replace(/\.\.\.$/, '')
    .trim() || step;
}

/**
 * Utility function to get progress color based on status
 */
export function getProgressColor(status: SearchProgress['status']): string {
  switch (status) {
    case 'pending':
      return 'text-yellow-600';
    case 'processing':
      return 'text-blue-600';
    case 'completed':
      return 'text-green-600';
    case 'failed':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Utility function to get progress icon based on status
 */
export function getProgressIcon(status: SearchProgress['status']): string {
  switch (status) {
    case 'pending':
      return '⏳';
    case 'processing':
      return '🔄';
    case 'completed':
      return '✅';
    case 'failed':
      return '❌';
    default:
      return '⏸️';
  }
}