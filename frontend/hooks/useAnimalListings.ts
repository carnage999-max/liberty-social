/**
 * Hook: useAnimalListings
 * Manages animal listing data fetching and state
 */

import { useState, useEffect, useCallback } from 'react';
import * as animalService from '@/lib/animals';

export interface UseAnimalListingsState {
  listings: any[];
  total: number;
  count: number;
  next: string | null;
  previous: string | null;
  loading: boolean;
  error: string | null;
}

export function useAnimalListings(
  initialFilters?: animalService.AnimalListingFilters
) {
  const [state, setState] = useState<UseAnimalListingsState>({
    listings: [],
    total: 0,
    count: 0,
    next: null,
    previous: null,
    loading: true,
    error: null,
  });

  const fetchListings = useCallback(
    async (filters?: animalService.AnimalListingFilters) => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const data = await animalService.getAnimalListings(filters);
        setState((prev) => ({
          ...prev,
          listings: data.results || data,
          total: data.count || 0,
          count: data.results?.length || 0,
          next: data.next || null,
          previous: data.previous || null,
          loading: false,
        }));
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          error: err.message || 'Failed to fetch listings',
          loading: false,
        }));
      }
    },
    []
  );

  useEffect(() => {
    fetchListings(initialFilters);
  }, [JSON.stringify(initialFilters), fetchListings]);

  const refetch = useCallback(() => {
    fetchListings(initialFilters);
  }, [initialFilters, fetchListings]);

  const loadMore = useCallback(async () => {
    if (!state.next || state.loading) return;
    try {
      setState((prev) => ({ ...prev, loading: true }));
      // Extract page number from next URL
      const url = new URL(state.next);
      const page = url.searchParams.get('page');
      const data = await animalService.getAnimalListings({
        ...initialFilters,
        page: page ? parseInt(page) : 2,
      });
      setState((prev) => ({
        ...prev,
        listings: [...prev.listings, ...(data.results || [])],
        next: data.next || null,
        loading: false,
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        error: err.message,
        loading: false,
      }));
    }
  }, [state.next, state.loading, initialFilters]);

  return {
    ...state,
    refetch,
    loadMore,
  };
}
