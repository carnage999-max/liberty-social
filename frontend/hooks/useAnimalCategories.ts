/**
 * Hook: useAnimalCategories
 * Manages animal category data and state legality checks
 */

import { useState, useEffect, useCallback } from 'react';
import * as animalService from '@/lib/animals';

export interface Category {
  id: string;
  name: string;
  description: string;
  icon?: string;
  state_restrictions?: Record<string, any>;
}

export interface UseAnimalCategoriesState {
  categories: Category[];
  loading: boolean;
  error: string | null;
}

export function useAnimalCategories() {
  const [state, setState] = useState<UseAnimalCategoriesState>({
    categories: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const data = await animalService.getAnimalCategories();
        setState({
          categories: data.results || data,
          loading: false,
          error: null,
        });
      } catch (err: any) {
        setState({
          categories: [],
          loading: false,
          error: err.message || 'Failed to fetch categories',
        });
      }
    };

    fetchCategories();
  }, []);

  const checkCategoryLegalStatus = useCallback(
    async (categoryId: string, state: string) => {
      try {
        return await animalService.checkCategoryLegality(categoryId, state);
      } catch (err: any) {
        throw new Error(
          err.message || 'Failed to check legal status'
        );
      }
    },
    []
  );

  return {
    ...state,
    checkCategoryLegalStatus,
  };
}
