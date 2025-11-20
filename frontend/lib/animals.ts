/**
 * Animal Marketplace API Service
 * Handles all API calls for animal listings, verification, reviews, and breeders
 */

import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api';

// ============================================================================
// ANIMAL CATEGORIES
// ============================================================================

/**
 * Get all animal categories
 * @returns Categories with state-specific legal information
 */
export async function getAnimalCategories() {
  return apiGet('/animals/categories/');
}

/**
 * Get single category by ID
 * @param id Category ID
 */
export async function getAnimalCategory(id: string) {
  return apiGet(`/animals/categories/${id}/`);
}

/**
 * Check legal status of category in specific state
 * @param state State abbreviation (e.g., 'CA', 'NY')
 * @returns Legal status and restrictions
 */
export async function checkCategoryLegality(categoryId: string, state: string) {
  return apiGet(`/animals/categories/${categoryId}/check_legality/?state=${state}`);
}

// ============================================================================
// ANIMAL LISTINGS
// ============================================================================

export interface AnimalListingFilters {
  category_id?: string;
  state?: string;
  listing_type?: 'sale' | 'adoption' | 'rehoming';
  price_min?: number;
  price_max?: number;
  breed?: string;
  status?: 'available' | 'pending' | 'sold';
  seller_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Get animal listings with optional filters
 * @param filters Filter parameters
 * @returns Paginated list of listings
 */
export async function getAnimalListings(filters?: AnimalListingFilters) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
  }
  const queryString = params.toString();
  return apiGet(`/animals/listings/${queryString ? '?' + queryString : ''}`);
}

/**
 * Get single animal listing by ID
 * @param id Listing ID
 * @returns Listing with all details
 */
export async function getAnimalListing(id: string) {
  return apiGet(`/animals/listings/${id}/`);
}

export interface CreateListingPayload {
  title: string;
  category: string; // Category ID
  breed: string;
  gender: 'male' | 'female' | 'unknown';
  age_years: number;
  age_months: number;
  color: string;
  listing_type: 'sale' | 'adoption' | 'rehoming';
  price?: number;
  description: string;
  state_code: string;
  location: string;
}

/**
 * Create new animal listing
 * @param data Listing data
 * @returns Created listing
 */
export async function createAnimalListing(data: CreateListingPayload) {
  return apiPost('/animals/listings/', data);
}

/**
 * Update existing listing
 * @param id Listing ID
 * @param data Updated listing data
 */
export async function updateAnimalListing(
  id: string,
  data: Partial<CreateListingPayload>
) {
  return apiPatch(`/animals/listings/${id}/`, data);
}

/**
 * Delete listing (soft delete - changes status)
 * @param id Listing ID
 */
export async function deleteAnimalListing(id: string) {
  return apiDelete(`/animals/listings/${id}/`);
}

/**
 * Increment view count for listing
 * @param id Listing ID
 */
export async function incrementListingView(id: string) {
  return apiPost(`/animals/listings/${id}/increment_view/`, {});
}

/**
 * Get seller profile information
 * @param id Listing ID
 * @returns Seller profile with ratings and verification status
 */
export async function getSellerProfile(id: string) {
  return apiGet(`/animals/listings/${id}/seller_profile/`);
}

// ============================================================================
// LISTING MEDIA
// ============================================================================

export interface ListingMediaPayload {
  listing: string; // Listing ID
  image: File;
  media_type: 'image' | 'video';
  is_featured?: boolean;
}

/**
 * Upload media for listing
 * @param formData Form data with file and metadata
 */
export async function uploadListingMedia(formData: FormData) {
  const response = await fetch('/api/animals/media/', {
    method: 'POST',
    body: formData,
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to upload media');
  }

  return response.json();
}

/**
 * Delete media from listing
 * @param id Media ID
 */
export async function deleteListingMedia(id: string) {
  return apiDelete(`/animals/media/${id}/`);
}

// ============================================================================
// SELLER VERIFICATION (KYC)
// ============================================================================

export interface VerificationPayload {
  identity_document_url?: string;
  address_proof_url?: string;
  phone_number?: string;
  business_name?: string;
  business_license_url?: string;
  years_of_experience?: number;
}

/**
 * Get current user's verification status
 * @returns Verification record or null if not started
 */
export async function getMyVerification() {
  try {
    return await apiGet('/animals/verification/');
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get verification status summary
 * @returns Status enum and details
 */
export async function getVerificationStatus() {
  try {
    return await apiGet('/animals/verification/status/');
  } catch (error) {
    return null;
  }
}

/**
 * Submit or update seller verification
 * @param data Verification information
 * @returns Updated verification record
 */
export async function submitVerification(data: VerificationPayload) {
  try {
    // Check if verification exists
    const existing = await getMyVerification();
    if (existing) {
      return apiPatch(`/animals/verification/${existing.id}/`, data);
    }
  } catch (error) {
    // Verification doesn't exist yet, create new
  }
  return apiPost('/animals/verification/', data);
}

/**
 * Get verification details by ID (admin/self only)
 * @param id Verification ID
 */
export async function getVerificationDetails(id: string) {
  return apiGet(`/animals/verification/${id}/`);
}

/**
 * Resubmit rejected verification
 * @param id Verification ID
 * @param data Updated verification data
 */
export async function resubmitVerification(id: string, data: VerificationPayload) {
  return apiPatch(`/animals/verification/${id}/resubmit/`, data);
}

// ============================================================================
// REVIEWS & RATINGS
// ============================================================================

export interface ReviewPayload {
  listing: string; // Listing ID
  seller: string; // Seller user ID
  buyer: string; // Buyer user ID
  rating: number; // 1-5
  review_text: string;
  transaction_completed: boolean;
}

/**
 * Get reviews with optional filters
 * @param filters Filter by listing, seller, or rating
 * @returns List of reviews
 */
export async function getAnimalReviews(filters?: {
  listing_id?: string;
  seller_id?: string;
  min_rating?: number;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.listing_id) params.append('listing', filters.listing_id);
    if (filters.seller_id) params.append('seller', filters.seller_id);
    if (filters.min_rating) params.append('rating__gte', String(filters.min_rating));
    if (filters.page) params.append('page', String(filters.page));
  }
  const queryString = params.toString();
  return apiGet(`/animals/reviews/${queryString ? '?' + queryString : ''}`);
}

/**
 * Get reviews for specific listing
 * @param listingId Listing ID
 */
export async function getListingReviews(listingId: string) {
  return apiGet(`/animals/reviews/?listing=${listingId}`);
}

/**
 * Get reviews for specific seller
 * @param sellerId Seller user ID
 */
export async function getSellerReviews(sellerId: string) {
  return apiGet(`/animals/reviews/?seller=${sellerId}`);
}

/**
 * Create new review
 * @param data Review information
 */
export async function createReview(data: ReviewPayload) {
  return apiPost('/animals/reviews/', data);
}

/**
 * Update existing review
 * @param id Review ID
 * @param data Updated review data
 */
export async function updateReview(id: string, data: Partial<ReviewPayload>) {
  return apiPatch(`/animals/reviews/${id}/`, data);
}

/**
 * Delete review (soft delete - keeps record for audit)
 * @param id Review ID
 */
export async function deleteReview(id: string) {
  return apiDelete(`/animals/reviews/${id}/`);
}

// ============================================================================
// SUSPICIOUS ACTIVITY REPORTING
// ============================================================================

export interface ActivityReportPayload {
  activity_type:
    | 'reported_scam'
    | 'reported_fraud'
    | 'reported_animal_abuse'
    | 'reported_false_info'
    | 'reported_copyright';
  description: string;
  evidence_url?: string;
}

/**
 * Report suspicious activity for listing
 * @param listingId Listing ID
 * @param data Report information
 */
export async function reportSuspiciousListing(
  listingId: string,
  data: ActivityReportPayload
) {
  return apiPost(`/animals/listings/${listingId}/report_suspicious/`, data);
}

/**
 * Get activity logs (admin/owner only)
 * @param listingId Listing ID
 */
export async function getActivityLogs(listingId: string) {
  return apiGet(`/animals/listings/${listingId}/activity_logs/`);
}

// ============================================================================
// BREEDER DIRECTORY
// ============================================================================

export interface BreederPayload {
  seller_verification: string; // SellerVerification ID
  business_type: 'hobby' | 'commercial' | 'rescue';
  subscription_tier: 'standard' | 'premium' | 'platinum';
  specialties: string[]; // Array of breed names
  years_active: number;
  bio: string;
  contact_phone?: string;
  website?: string;
}

/**
 * Get all breeders in directory
 * @param filters Optional filters
 */
export async function getBreedersDirectory(filters?: {
  subscription_tier?: string;
  specialty?: string;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (filters) {
    if (filters.subscription_tier) {
      params.append('subscription_tier', filters.subscription_tier);
    }
    if (filters.specialty) params.append('specialties__icontains', filters.specialty);
    if (filters.page) params.append('page', String(filters.page));
  }
  const queryString = params.toString();
  return apiGet(`/animals/breeders/${queryString ? '?' + queryString : ''}`);
}

/**
 * Search breeders by name or specialty
 * @param query Search query
 */
export async function searchBreeders(query: string) {
  return apiGet(`/animals/breeders/search/?q=${encodeURIComponent(query)}`);
}

/**
 * Get breeder profile
 * @param id Breeder ID (BreederDirectory ID)
 */
export async function getBreederProfile(id: string) {
  return apiGet(`/animals/breeders/${id}/`);
}

/**
 * Apply to breeder directory
 * @param data Breeder application data
 */
export async function applyToBreederDirectory(data: BreederPayload) {
  return apiPost('/animals/breeders/', data);
}

/**
 * Update breeder directory listing
 * @param id Breeder ID
 * @param data Updated breeder data
 */
export async function updateBreederProfile(id: string, data: Partial<BreederPayload>) {
  return apiPatch(`/animals/breeders/${id}/`, data);
}

/**
 * Get breeder listings
 * @param breederId Breeder ID
 */
export async function getBreederListings(breederId: string) {
  return apiGet(`/animals/breeders/${breederId}/listings/`);
}

// ============================================================================
// VET DOCUMENTATION
// ============================================================================

export interface VetDocumentationPayload {
  animal_listing: string; // Listing ID
  vet_name: string;
  vet_clinic: string;
  vet_phone: string;
  health_report_url: string;
  vaccination_records_url?: string;
  microchip_number?: string;
  last_checkup_date: string; // ISO date
}

/**
 * Upload vet documentation for listing
 * @param data Vet documentation data
 */
export async function uploadVetDocumentation(data: VetDocumentationPayload) {
  return apiPost('/animals/vet-documentation/', data);
}

/**
 * Get vet documentation for listing
 * @param listingId Listing ID
 */
export async function getVetDocumentation(listingId: string) {
  try {
    return await apiGet(`/animals/vet-documentation/?listing=${listingId}`);
  } catch (error) {
    return null;
  }
}

/**
 * Update vet documentation
 * @param id Documentation ID
 * @param data Updated documentation
 */
export async function updateVetDocumentation(
  id: string,
  data: Partial<VetDocumentationPayload>
) {
  return apiPatch(`/animals/vet-documentation/${id}/`, data);
}

// ============================================================================
// STATISTICS & ANALYTICS
// ============================================================================

/**
 * Get marketplace statistics
 * @returns Total listings, categories, verified sellers, etc.
 */
export async function getMarketplaceStats() {
  return apiGet('/animals/statistics/');
}

/**
 * Get user's listing statistics
 * @returns Own listings count, total views, reviews, etc.
 */
export async function getUserListingStats() {
  return apiGet('/animals/statistics/user/');
}

/**
 * Get category popularity
 * @returns Categories with listing counts and trends
 */
export async function getCategoryPopularity() {
  return apiGet('/animals/statistics/categories/');
}
