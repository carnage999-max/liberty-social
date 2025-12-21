'use client';

import React, { useState } from 'react';

export interface AnalyticsFilters {
  gender?: string;
  country?: string;
  state?: string;
  ageMin?: number;
  ageMax?: number;
  activeOnly?: boolean;
}

interface AnalyticsFilterProps {
  onFilterChange: (filters: AnalyticsFilters) => void;
  countries: string[];
}

export function AnalyticsFilter({ onFilterChange, countries }: AnalyticsFilterProps) {
  const [filters, setFilters] = useState({} as AnalyticsFilters);

  const handleChange = (key: keyof AnalyticsFilters, value: string | number | boolean | undefined) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleGenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleChange('gender', e.target.value || undefined);
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleChange('country', e.target.value || undefined);
  };

  const handleAgeMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange('ageMin', e.target.value ? parseInt(e.target.value, 10) : undefined);
  };

  const handleAgeMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange('ageMax', e.target.value ? parseInt(e.target.value, 10) : undefined);
  };

  const handleActiveOnlyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleChange('activeOnly', e.target.checked);
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '1rem',
      padding: '1rem',
      backgroundColor: '#f5f5f5',
      borderRadius: '8px',
      marginBottom: '2rem'
    }}>
      <div>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Gender
        </label>
        <select
          value={filters.gender || ''}
          onChange={handleGenderChange}
          style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}
        >
          <option value="">All Genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Country
        </label>
        <select
          value={filters.country || ''}
          onChange={handleCountryChange}
          style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}
        >
          <option value="">All Countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Min Age
        </label>
        <input
          type="number"
          min="0"
          max="150"
          value={filters.ageMin || ''}
          onChange={handleAgeMinChange}
          style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}
          placeholder="Min age"
        />
      </div>

      <div>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          Max Age
        </label>
        <input
          type="number"
          min="0"
          max="150"
          value={filters.ageMax || ''}
          onChange={handleAgeMaxChange}
          style={{
            width: '100%',
            padding: '0.5rem',
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}
          placeholder="Max age"
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filters.activeOnly || false}
            onChange={handleActiveOnlyChange}
          />
          <span>Active Users Only</span>
        </label>
      </div>
    </div>
  );
}
