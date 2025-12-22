'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { color } from 'framer-motion';

interface CreateYardSaleFormProps {
  onSuccess?: () => void;
}

export const CreateYardSaleForm: React.FC<CreateYardSaleFormProps> = ({ onSuccess }) => {
  const router = useRouter();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    address: '',
    latitude: 0,
    longitude: 0,
    start_date: '',
    end_date: '',
    hours: '9am - 4pm',
    phone: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1); // 1: Details, 2: Review, 3: Payment

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const geocodeAddress = async () => {
    if (!formData.address) {
      setError('Please enter an address');
      return;
    }

    try {
      // Using OpenStreetMap Nominatim (free, no API key needed)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.address)}`
      );
      const data = await response.json();

      if (data.length === 0) {
        setError('Address not found. Please try a different address.');
        return;
      }

      const { lat, lon } = data[0];
      setFormData(prev => ({
        ...prev,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
      }));
      setError(null);
    } catch (err) {
      setError('Failed to geocode address');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step < 3) {
      if (step === 1) {
        if (!formData.title || !formData.address || !formData.start_date || !formData.end_date) {
          setError('Please fill in all required fields');
          return;
        }
        // Check if coordinates are still at default (0,0)
        if (formData.latitude === 0 && formData.longitude === 0) {
          await geocodeAddress();
          return;
        }
      }
      setStep(step + 1);
      return;
    }

    // Submit to backend
    setLoading(true);
    try {
      // Get token from auth context storage
      let token = null;
      try {
        const raw = localStorage.getItem('liberty_auth_v1');
        if (raw) {
          const data = JSON.parse(raw);
          token = data.accessToken;
        }
      } catch (e) {
        console.error('Failed to retrieve token:', e);
      }

      if (!token) {
        setError('Authentication failed. Please log in again.');
        setLoading(false);
        return;
      }

      // Prepare data for submission - only include non-empty phone and round coordinates to 6 decimal places
      const submitData = {
        ...formData,
        phone: formData.phone || null,
        latitude: Math.round(parseFloat(formData.latitude.toString()) * 1000000) / 1000000,
        longitude: Math.round(parseFloat(formData.longitude.toString()) * 1000000) / 1000000,
      };

      console.log('Submitting yard sale:', submitData);

      const response = await fetch(`${API_BASE}/yard-sales/create/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Server error response:', errorData);
        throw new Error(JSON.stringify(errorData) || 'Failed to create listing');
      }

      setError(null);
      if (onSuccess) onSuccess();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      console.error('Form submission error:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: '600px',
      margin: '0 auto',
      padding: '2rem',
      backgroundColor: '#fff',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => router.push('/app/yard-sales')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0.5rem',
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = '#333'}
          onMouseLeave={(e) => e.currentTarget.style.color = '#666'}
          title="Back to yard sales"
        >
          <ArrowLeft size={24} />
        </button>
        <h1 style={{ margin: 0, color: 'gray'}}>Post a Yard Sale</h1>
      </div>
      <p style={{ color: '#999', marginBottom: '2rem' }}>
        Step {step} of 3 - $0.99 listing fee
      </p>

      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: '#ffebee',
          border: '1px solid #ef5350',
          borderRadius: '4px',
          color: '#c62828',
          fontSize: '0.875rem'
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <div className='text-(--color-text-dark)'>
            <h2 style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>Sale Details</h2>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Sale Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., Multi-Family Yard Sale"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  color: '#333'
                }}
                required
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Address *
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                placeholder="e.g., 123 Main St, City, State"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  color: '#333'
                }}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  Start Date *
                </label>
                <input
                  type="date"
                  name="start_date"
                  value={formData.start_date}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    color: '#333',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                  End Date *
                </label>
                <input
                  type="date"
                  name="end_date"
                  value={formData.end_date}
                  onChange={handleInputChange}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '1rem',
                    boxSizing: 'border-box',
                    color: '#333'
                  }}
                  required
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Hours
              </label>
              <input
                type="text"
                name="hours"
                value={formData.hours}
                onChange={handleInputChange}
                placeholder="e.g., 9am - 4pm"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  color: '#333'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Items for sale, special notes..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  color: '#333'
                }}
              />
            </div>

            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="(555) 123-4567"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box',
                  color: '#333'
                }}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{ fontSize: '1.125rem', marginBottom: '1.5rem', color: '#2B2B2B' }}>Review Your Listing</h2>

            <div style={{
              padding: '1.5rem',
              backgroundColor: '#f9f9f9',
              borderRadius: '6px',
              marginBottom: '1.5rem',
              color: '#333'
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ color: '#999', fontSize: '0.875rem' }}>Title</div>
                <div style={{ fontWeight: 'bold', fontSize: '1.125rem' }}>{formData.title}</div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ color: '#999', fontSize: '0.875rem' }}>Address</div>
                <div>{formData.address}</div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <div style={{ color: '#999', fontSize: '0.875rem' }}>When</div>
                <div>{formData.start_date} to {formData.end_date}</div>
                <div style={{ fontSize: '0.875rem', color: '#666' }}>{formData.hours}</div>
              </div>

              {formData.description && (
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ color: '#999', fontSize: '0.875rem' }}>Description</div>
                  <div>{formData.description}</div>
                </div>
              )}

              {formData.phone && (
                <div>
                  <div style={{ color: '#999', fontSize: '0.875rem' }}>Contact</div>
                  <div>{formData.phone}</div>
                </div>
              )}
            </div>

            <div style={{
              padding: '1rem',
              backgroundColor: '#e8f5e9',
              border: '1px solid #81c784',
              borderRadius: '4px',
              marginBottom: '2rem',
              fontSize: '0.875rem',
              color: '#2e7d32'
            }}>
              ✓ Listing will appear on the map immediately after payment
            </div>
          </div>
        )}

        {step === 3 && (
          <div style={{ color: '#333' }}>
            <h2 style={{ fontSize: '1.125rem', marginBottom: '1.5rem' }}>Payment</h2>

            <div style={{
              padding: '2rem',
              backgroundColor: '#f9f9f9',
              border: '2px solid #2196F3',
              borderRadius: '8px',
              textAlign: 'center',
              marginBottom: '2rem'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💳</div>
              <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                Listing Fee
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2196F3' }}>
                $0.99
              </div>
              <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '1rem' }}>
                One-time payment. No subscriptions or renewals.
              </div>
            </div>

            <div style={{
              padding: '1rem',
              backgroundColor: '#fff3e0',
              border: '1px solid #ffb74d',
              borderRadius: '4px',
              fontSize: '0.875rem',
              marginBottom: '2rem'
            }}>
              ℹ️ Payment integration coming soon. For now, listing will be created directly.
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: step === 1 ? '#f0f0f0' : '#e0e0e0',
              border: 'none',
              borderRadius: '4px',
              cursor: step === 1 ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              color: step === 1 ? '#ccc' : '#333'
            }}
          >
            ← Back
          </button>

          <button
            type="submit"
            disabled={loading}
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              backgroundColor: loading ? 'var(--color-deep-navy)' : step === 3 ? '#1D2B4F' : '#1D2B4F',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '1rem'
            }}
            className='btn btn--primary'
          >
            {loading ? 'Processing...' : step === 3 ? 'Pay $0.99' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
};
