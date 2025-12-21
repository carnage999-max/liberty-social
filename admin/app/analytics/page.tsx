'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AnalyticsFilter, AnalyticsFilters } from '@/components/AnalyticsFilter';
import { MetricCard } from '@/components/MetricCard';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

interface AnalyticsSummary {
  total: number;
  male: number;
  female: number;
  active: number;
  average_age: number | null;
}

interface GenderBreakdown {
  gender: string;
  count: number;
}

interface CountryData {
  country: string;
  total: number;
  male: number;
  female: number;
  active: number;
}

interface AnalyticsResponse {
  filters: AnalyticsFilters;
  summary: AnalyticsSummary;
  breakdown: {
    by_gender: GenderBreakdown[];
    by_age: Array<{ age: number; count: number }>;
  };
}

interface TopCountriesResponse extends Array<CountryData> {}

export default function AnalyticsDashboard() {
  const [token, setToken] = useState(null as string | null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({} as AnalyticsFilters);

  const [summary, setSummary] = useState(null as AnalyticsSummary | null);
  const [genderBreakdown, setGenderBreakdown] = useState([] as GenderBreakdown[]);
  const [topCountries, setTopCountries] = useState([] as CountryData[]);
  const [countries, setCountries] = useState([] as string[]);

  const [error, setError] = useState(null as string | null);

  const fetchAnalytics = useCallback(async (accessToken: string, newFilters: AnalyticsFilters) => {
    try {
      setLoading(true);

      // Build query string
      const params = new URLSearchParams();
      if (newFilters.gender) params.append('gender', newFilters.gender);
      if (newFilters.country) params.append('country', newFilters.country);
      if (newFilters.state) params.append('state', newFilters.state);
      if (newFilters.ageMin) params.append('age_min', newFilters.ageMin.toString());
      if (newFilters.ageMax) params.append('age_max', newFilters.ageMax.toString());
      if (newFilters.activeOnly) params.append('active_only', 'true');

      const queryString = params.toString();
      const url = `${API_BASE}/users/admin/analytics/micro-segmentation/${queryString ? '?' + queryString : ''}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (res.ok) {
        const data = await res.json() as AnalyticsResponse;
        setSummary(data.summary);
        setGenderBreakdown(data.breakdown.by_gender);
        setError(null);
      } else {
        setError('Failed to fetch analytics');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Error fetching analytics: ${errorMessage}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInitialData = useCallback(async (accessToken: string) => {
    try {
      setLoading(true);

      // Fetch top countries to populate the filter dropdown
      const countriesUrl = `${API_BASE}/users/admin/analytics/top-countries/?limit=50`;
      const countriesRes = await fetch(countriesUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (countriesRes.ok) {
        const countriesData = await countriesRes.json() as TopCountriesResponse;
        setTopCountries(countriesData);
        setCountries(countriesData.map(c => c.country));
      }

      // Fetch overview
      await fetchAnalytics(accessToken, {});
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Error loading analytics: ${errorMessage}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [fetchAnalytics]);

  // Get token from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('liberty-social-admin-access-token');
    if (stored) {
      setToken(stored);
    }
  }, []);

  // Fetch data when token is set
  useEffect(() => {
    if (token) {
      fetchInitialData(token);
    }
  }, [token, fetchInitialData]);

  const handleFilterChange = (newFilters: AnalyticsFilters) => {
    setFilters(newFilters);
    if (token) {
      fetchAnalytics(token, newFilters);
    }
  };

  if (!token) {
    return <div style={{ padding: '2rem' }}>Please log in first</div>;
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>User Analytics</h1>

      {error && (
        <div style={{
          padding: '1rem',
          marginBottom: '1rem',
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: '4px'
        }}>
          {error}
        </div>
      )}

      <AnalyticsFilter onFilterChange={handleFilterChange} countries={countries} />

      {loading && <div>Loading analytics...</div>}

      {summary && !loading && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            <MetricCard title="Total Users" value={summary.total.toString()} />
            <MetricCard title="Active Users" value={summary.active.toString()} />
            <MetricCard title="Male" value={summary.male.toString()} />
            <MetricCard title="Female" value={summary.female.toString()} />
            {summary.average_age && (
              <MetricCard title="Average Age" value={summary.average_age.toFixed(1)} />
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem',
            marginBottom: '2rem'
          }}>
            {/* Gender Breakdown Chart */}
            <div style={{
              padding: '1rem',
              backgroundColor: '#fff',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h2>Gender Breakdown</h2>
              {genderBreakdown.length > 0 ? (
                <div>
                  {genderBreakdown.map((item: GenderBreakdown) => (
                    <div key={item.gender} style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ textTransform: 'capitalize' }}>{item.gender}</span>
                        <span style={{ fontWeight: 'bold' }}>{item.count}</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '24px',
                        backgroundColor: '#f0f0f0',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${summary.total > 0 ? (item.count / summary.total) * 100 : 0}%`,
                          backgroundColor: item.gender === 'male' ? '#2196F3' : '#FF69B4',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No data available</p>
              )}
            </div>

            {/* Top Countries */}
            <div style={{
              padding: '1rem',
              backgroundColor: '#fff',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <h2>Top Countries</h2>
              {topCountries.length > 0 ? (
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {topCountries.slice(0, 10).map((country: CountryData) => (
                    <div key={country.country} style={{
                      padding: '0.75rem',
                      borderBottom: '1px solid #eee',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{country.country}</div>
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>
                          {country.male}M / {country.female}F • {country.active} active
                        </div>
                      </div>
                      <div style={{ fontWeight: 'bold' }}>{country.total}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No data available</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
