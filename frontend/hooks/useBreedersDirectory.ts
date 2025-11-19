/**
 * Hook: useBreedersDirectory
 * Manages breeder directory data and search
 */

import { useState, useEffect, useCallback } from 'react';
import * as animalService from '@/lib/animals';

export interface UseBreederDirectoryState {
  breeders: any[];
  total: number;
  loading: boolean;
  error: string | null;
}

export function useBreedersDirectory(
  filters?: {
    subscription_tier?: string;
    specialty?: string;
    page?: number;
  }
) {
  const [state, setState] = useState<UseBreederDirectoryState>({
    breeders: [],
    total: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchBreeders = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const data = await animalService.getBreedersDirectory(filters);
        setState({
          breeders: data.results || data,
          total: data.count || 0,
          loading: false,
          error: null,
        });
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err.message || 'Failed to fetch breeders',
        }));
      }
    };

    fetchBreeders();
  }, [JSON.stringify(filters)]);

  const searchBreeders = useCallback(async (query: string) => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const data = await animalService.searchBreeders(query);
      setState({
        breeders: data.results || data,
        total: data.count || 0,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Search failed',
      }));
    }
  }, []);

  const refetch = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const data = await animalService.getBreedersDirectory(filters);
      setState({
        breeders: data.results || data,
        total: data.count || 0,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to fetch breeders',
      }));
    }
  }, [JSON.stringify(filters)]);

  return {
    ...state,
    searchBreeders,
    refetch,
  };
}
