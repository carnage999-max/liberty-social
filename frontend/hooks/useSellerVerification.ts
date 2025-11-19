/**
 * Hook: useSellerVerification
 * Manages seller KYC verification workflow
 */

import { useState, useCallback } from 'react';
import * as animalService from '@/lib/animals';

export interface VerificationState {
  data: any | null;
  status: 'pending' | 'verified' | 'rejected' | 'not_started';
  loading: boolean;
  error: string | null;
  isVerified: boolean;
}

export function useSellerVerification() {
  const [state, setState] = useState<VerificationState>({
    data: null,
    status: 'not_started',
    loading: true,
    error: null,
    isVerified: false,
  });

  // Check current verification status on mount
  const checkVerification = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const verification = await animalService.getMyVerification();

      if (!verification) {
        setState({
          data: null,
          status: 'not_started',
          loading: false,
          error: null,
          isVerified: false,
        });
        return;
      }

      setState({
        data: verification,
        status: verification.status || 'pending',
        loading: false,
        error: null,
        isVerified: verification.status === 'verified',
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Failed to check verification',
      }));
    }
  }, []);

  // Submit or update verification
  const submitVerification = useCallback(
    async (data: animalService.VerificationPayload) => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const result = await animalService.submitVerification(data);
        setState({
          data: result,
          status: result.status || 'pending',
          loading: false,
          error: null,
          isVerified: result.status === 'verified',
        });
        return result;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to submit verification';
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        throw err;
      }
    },
    []
  );

  // Resubmit rejected verification
  const resubmit = useCallback(
    async (data: animalService.VerificationPayload) => {
      if (!state.data?.id) {
        throw new Error('No verification record found');
      }

      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const result = await animalService.resubmitVerification(
          state.data.id,
          data
        );
        setState({
          data: result,
          status: result.status || 'pending',
          loading: false,
          error: null,
          isVerified: result.status === 'verified',
        });
        return result;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to resubmit verification';
        setState((prev) => ({
          ...prev,
          loading: false,
          error: errorMessage,
        }));
        throw err;
      }
    },
    [state.data?.id]
  );

  return {
    ...state,
    checkVerification,
    submitVerification,
    resubmit,
  };
}
