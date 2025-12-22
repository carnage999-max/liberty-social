'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Plus } from 'lucide-react';

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

// Dynamically import to avoid SSR issues with Leaflet
const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then(mod => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then(mod => mod.Popup),
  { ssr: false }
);
const Circle = dynamic(
  () => import('react-leaflet').then(mod => mod.Circle),
  { ssr: false }
);

export const YardSaleMap: React.FC<YardSaleMapProps> = ({ center }) => {
  const [listings, setListings] = useState<YardSaleListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState(25);
  const [userLocation, setUserLocation] = useState(
    center || { latitude: 40.7128, longitude: -74.006 }
  );
  const [selectedListing, setSelectedListing] = useState<YardSaleListing | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const leafletRef = useRef(null);

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
    } else if (center) {
      fetchListings(center.latitude, center.longitude, radius);
    }
  }, []);

  // Fetch when radius changes
  useEffect(() => {
    fetchListings(userLocation.latitude, userLocation.longitude, radius);
  }, [radius]);

  const getMarkerColor = (color: string) => {
    const colors: Record<string, { bg: string; icon: string }> = {
      red: { bg: '#d32f2f', icon: '🏠' },
      blue: { bg: '#2196F3', icon: '⭐' },
      orange: { bg: '#FF9800', icon: '🔄' },
    };
    return colors[color] || colors.red;
  };

  const handleDirections = (lat: number, lon: number, address: string) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    window.open(url, '_blank');
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const MapContent = () => {
    if (!listings.length && !loading) {
      return (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '2rem',
          borderRadius: '8px',
          textAlign: 'center',
          zIndex: 400,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📍</div>
          <p>No yard sales found in this radius</p>
          <p style={{ fontSize: '0.875rem', color: '#666' }}>Try expanding the search radius</p>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 70px)', flexDirection: 'column', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem',
        backgroundColor: '#fff',
        borderBottom: '1px solid #e0e0e0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>🏪 Yard Sales Near You</h1>
          <Link href="/app/create-yard-sale">
            <button style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.875rem',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#45a049'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4CAF50'}
            >
              <Plus size={18} />
              Post Yard Sale
            </button>
          </Link>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.875rem', color: '#666' }}>
            {listings.length} sales found within {radius} miles
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ fontSize: '0.875rem', color: '#666' }}>Radius:</label>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value))}
              style={{ width: '150px' }}
            />
            <span style={{ minWidth: '50px', fontWeight: 'bold', color: '#2196F3' }}>{radius} mi</span>
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
        {typeof window !== 'undefined' && (
          <MapContainer
            center={[userLocation.latitude, userLocation.longitude]}
            zoom={12}
            style={{ width: '100%', height: '100%' }}
            ref={leafletRef}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap contributors'
            />

            {/* User location marker */}
            <Marker
              position={[userLocation.latitude, userLocation.longitude]}
              title="Your Location"
            >
              <Popup>📍 Your Location</Popup>
            </Marker>

            {/* Radius circle */}
            <Circle
              center={[userLocation.latitude, userLocation.longitude]}
              radius={radius * 1609.34} // Convert miles to meters
              fillColor="#2196F3"
              color="#2196F3"
              weight={1}
              opacity={0.15}
              fillOpacity={0.05}
            />

            {/* Yard sale markers */}
            {listings.map((listing) => (
              <Marker
                key={listing.id}
                position={[parseFloat(listing.latitude.toString()), parseFloat(listing.longitude.toString())]}
                title={listing.title}
              >
                <Popup>
                  <div style={{ minWidth: '250px' }}>
                    <h3 style={{ margin: '0 0 0.5rem 0' }}>{listing.title}</h3>
                    <div style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                      <strong>{listing.address}</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.75rem' }}>
                      {listing.start_date} to {listing.end_date} | {listing.hours}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleDirections(
                          parseFloat(listing.latitude.toString()),
                          parseFloat(listing.longitude.toString()),
                          listing.address
                        )}
                        style={{
                          flex: 1,
                          padding: '0.5rem',
                          backgroundColor: '#2196F3',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 'bold'
                        }}
                      >
                        📍 Map
                      </button>
                      {listing.phone && (
                        <button
                          onClick={() => handleCall(listing.phone!)}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            backgroundColor: '#4CAF50',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}
                        >
                          📞 Call
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            <MapContent />
          </MapContainer>
        )}

        {/* Legend - Always Visible */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          zIndex: 500,
          fontSize: '0.875rem',
          minWidth: '200px',
          color: '#333'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '0.75rem', fontSize: '0.95rem', color: '#333' }}>
            📋 Legend
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#333' }}>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#d32f2f',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}>
                🏠
              </div>
              <span>Multi-day sale</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#333' }}>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#2196F3',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}>
                ⭐
              </div>
              <span>Today only</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#333' }}>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#FF9800',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}>
                🔄
              </div>
              <span>Starting soon</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem', color: '#333' }}>
              <div style={{
                width: '24px',
                height: '24px',
                backgroundColor: '#4CAF50',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}>
                📍
              </div>
              <span>Your location</span>
            </div>
          </div>
        </div>

        {/* Sidebar - Listing Details */}
        {selectedListing && (
          <div style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '350px',
            backgroundColor: '#fff',
            borderLeft: '1px solid #e0e0e0',
            overflowY: 'auto',
            boxShadow: '-2px 0 4px rgba(0,0,0,0.05)',
            zIndex: 600,
            animation: 'slideIn 0.3s ease-out'
          }}>
            <style>{`
              @keyframes slideIn {
                from {
                  transform: translateX(100%);
                }
                to {
                  transform: translateX(0);
                }
              }
            `}</style>

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
                  color: '#999',
                  padding: '0.25rem',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
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
                backgroundColor: selectedListing.is_today_only ? '#e3f2fd' : '#f3e5f5',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: selectedListing.is_today_only ? '#1976d2' : '#7b1fa2',
                marginBottom: '1rem'
              }}>
                {selectedListing.is_today_only ? '⭐ TODAY ONLY' : '🏠 MULTI-DAY'}
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
                  <strong>📅 Dates:</strong> {selectedListing.start_date} to {selectedListing.end_date}
                </div>
                <div>
                  <strong>🕐 Hours:</strong> {selectedListing.hours}
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
          </div>
        )}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          color: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          zIndex: 999,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>⏳</div>
          <div>Finding yard sales...</div>
        </div>
      )}
    </div>
  );
};
