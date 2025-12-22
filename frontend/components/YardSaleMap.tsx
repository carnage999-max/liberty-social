'use client';

import React, { useState, useEffect, useRef } from 'react';

interface YardSaleListing {
  id: number;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  start_date: string;
  end_date: string;
  hours: string;
  phone: string | null;
  is_active: boolean;
  is_today_only: boolean;
  pin_color: string;
  distance_miles?: number;
}

interface YardSaleMapProps {
  center?: { latitude: number; longitude: number };
}

export const YardSaleMap: React.FC<YardSaleMapProps> = ({ center }) => {
  const [listings, setListings] = useState<YardSaleListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState(25);
  const [userLocation, setUserLocation] = useState(
    center || { latitude: 40.7128, longitude: -74.006 }
  );
  const [selectedListing, setSelectedListing] = useState<YardSaleListing | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  // Fetch listings based on current location and radius
  const fetchListings = async (lat: number, lon: number, radiusValue: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/yard-sales/search/?latitude=${lat}&longitude=${lon}&radius=${radiusValue}`
      );
      if (response.ok) {
        const data = await response.json();
        setListings(data.results || []);
      }
    } catch (error) {
      console.error('Error fetching yard sales:', error);
    } finally {
      setLoading(false);
    }
  };

  // Get user's GPS location on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation({ latitude, longitude });
          fetchListings(latitude, longitude, radius);
        },
        () => {
          // Fallback to default or center prop
          if (center) {
            fetchListings(center.latitude, center.longitude, radius);
          }
        }
      );
    }
  }, []);

  // Fetch when radius changes
  useEffect(() => {
    fetchListings(userLocation.latitude, userLocation.longitude, radius);
  }, [radius]);

  const getColorStyle = (color: string): string => {
    const colors: Record<string, string> = {
      red: '#d32f2f',
      blue: '#2196F3',
      orange: '#FF9800',
    };
    return colors[color] || '#d32f2f';
  };

  const handleDirections = (lat: number, lon: number, address: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    window.open(url, '_blank');
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  return (
    <div style={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: '#fff',
        borderBottom: '1px solid #e0e0e0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ margin: '0 0 1rem 0', fontSize: '1.75rem' }}>Yard Sales Near You</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: '#666' }}>
            {listings.length} sales found within {radius} miles
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value))}
              style={{ width: '150px' }}
            />
            <span style={{ minWidth: '50px', fontWeight: 'bold' }}>{radius} mi</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Map Container */}
        <div
          ref={mapRef}
          style={{
            flex: 1,
            backgroundColor: '#f0f0f0',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center' }}>
              <div>Loading yard sales...</div>
            </div>
          ) : (
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 800 600"
              style={{ backgroundColor: '#e8f4f8' }}
            >
              {/* User location marker */}
              <circle
                cx="400"
                cy="300"
                r="8"
                fill="#4CAF50"
                stroke="#fff"
                strokeWidth="2"
              />

              {/* Radius circle */}
              <circle
                cx="400"
                cy="300"
                r="150"
                fill="none"
                stroke="#2196F3"
                strokeWidth="1"
                strokeDasharray="5,5"
                opacity="0.3"
              />

              {/* Yard sale pins */}
              {listings.map((listing) => {
                // Simple projection for demo (would use actual map library in production)
                const offsetX = (parseFloat(listing.longitude.toString()) - userLocation.longitude) * 1000;
                const offsetY = (userLocation.latitude - parseFloat(listing.latitude.toString())) * 1000;
                const x = 400 + offsetX;
                const y = 300 + offsetY;

                const isSelected = selectedListing?.id === listing.id;

                return (
                  <g
                    key={listing.id}
                    onClick={() => setSelectedListing(listing)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Pin marker */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isSelected ? 12 : 8}
                      fill={getColorStyle(listing.pin_color)}
                      stroke="#fff"
                      strokeWidth={isSelected ? 3 : 2}
                      style={{
                        transition: 'all 0.2s ease',
                        filter: isSelected ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' : 'none'
                      }}
                    />
                    {/* Label */}
                    {isSelected && (
                      <text
                        x={x}
                        y={y - 15}
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="bold"
                        fill="#333"
                      >
                        {listing.title.substring(0, 20)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* Listings Sidebar */}
        <div style={{
          width: '350px',
          backgroundColor: '#fff',
          borderLeft: '1px solid #e0e0e0',
          overflowY: 'auto',
          boxShadow: '-2px 0 4px rgba(0,0,0,0.05)'
        }}>
          {selectedListing ? (
            <div style={{ padding: '1.5rem' }}>
              {/* Close button */}
              <button
                onClick={() => setSelectedListing(null)}
                style={{
                  float: 'right',
                  background: 'none',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: '#999'
                }}
              >
                ✕
              </button>

              {/* Listing Details */}
              <h2 style={{ marginTop: 0, marginBottom: '0.5rem' }}>
                {selectedListing.title}
              </h2>

              <div style={{
                display: 'inline-block',
                padding: '0.25rem 0.75rem',
                backgroundColor: '#e8f5e9',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: '#2e7d32',
                marginBottom: '1rem'
              }}>
                {selectedListing.is_today_only ? 'TODAY ONLY' : 'MULTI-DAY'}
              </div>

              <div style={{ marginBottom: '1rem', fontSize: '0.875rem', color: '#666' }}>
                <div style={{ fontWeight: 'bold', color: '#333', marginBottom: '0.25rem' }}>
                  📍 {selectedListing.address}
                </div>
                {selectedListing.distance_miles && (
                  <div style={{ color: '#999' }}>
                    {selectedListing.distance_miles} miles away
                  </div>
                )}
              </div>

              <div style={{
                padding: '1rem',
                backgroundColor: '#f5f5f5',
                borderRadius: '6px',
                marginBottom: '1rem',
                fontSize: '0.875rem'
              }}>
                <div style={{ marginBottom: '0.5rem' }}>
                  <strong>Dates:</strong> {selectedListing.start_date} to {selectedListing.end_date}
                </div>
                <div>
                  <strong>Hours:</strong> {selectedListing.hours}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  onClick={() => handleDirections(
                    parseFloat(selectedListing.latitude.toString()),
                    parseFloat(selectedListing.longitude.toString()),
                    selectedListing.address
                  )}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '0.875rem'
                  }}
                >
                  📍 Directions
                </button>
                {selectedListing.phone && (
                  <button
                    onClick={() => handleCall(selectedListing.phone!)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      backgroundColor: '#4CAF50',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '0.875rem'
                    }}
                  >
                    📞 Call
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#999' }}>
              {listings.length === 0 ? (
                <div>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📍</div>
                  <p>No yard sales found in this radius</p>
                  <p style={{ fontSize: '0.875rem' }}>Try expanding the search radius</p>
                </div>
              ) : (
                <div>
                  <p>Click on a pin to see details</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{
        padding: '1rem',
        backgroundColor: '#f9f9f9',
        borderTop: '1px solid #e0e0e0',
        fontSize: '0.875rem',
        display: 'flex',
        gap: '2rem',
        justifyContent: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#d32f2f'
          }} />
          <span>Multi-day</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#2196F3'
          }} />
          <span>Today only</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#FF9800'
          }} />
          <span>Starting soon</span>
        </div>
      </div>
    </div>
  );
};
