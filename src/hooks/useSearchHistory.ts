import { useQuery } from "@tanstack/react-query";
import { searchService } from "@/services/searchService";

export const SEARCH_HISTORY_QUERY_KEY = ["search-history"];

export function useSearchHistory(enabled = true) {
  return useQuery({
    queryKey: SEARCH_HISTORY_QUERY_KEY,
    queryFn: async () => {
      const result = await searchService.getSearchHistory();
      if (!result.success) {
        throw result.error ?? new Error("Failed to load search history");
      }
      return result.searches ?? [];
    },
    enabled,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
  });
}
