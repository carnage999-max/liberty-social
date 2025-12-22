'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Plus } from 'lucide-react';
import L from 'leaflet';

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
  { ssr: false, loading: () => <div>Loading map...</div> }
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

// Fix Leaflet marker icons for Next.js
const createCustomIcon = (color: string, iconType: 'home' | 'star' | 'refresh') => {
  let iconPath = '';

  switch(iconType) {
    case 'home':
      iconPath = '<path d="M10 14h4v4h-4v-4zm-2-2v8h8v-8l-4-3-4 3z" fill="white"/><path d="M12 7l6 4.5v6.5h-3v-4h-6v4h-3v-6.5l6-4.5z" fill="white"/>';
      break;
    case 'star':
      iconPath = '<path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" fill="white"/>';
      break;
    case 'refresh':
      iconPath = '<path d="M17.65 6.35c-1.63-1.63-4.29-1.63-5.93 0-1.63 1.63-1.63 4.29 0 5.93l-2.12 2.12c-2.73-2.73-2.73-7.17 0-9.9 2.73-2.73 7.17-2.73 9.9 0l1.42-1.42 1.42 4.24-4.24-1.42 1.55-1.55z" fill="white"/><path d="M6.35 17.65c1.63 1.63 4.29 1.63 5.93 0 1.63-1.63 1.63-4.29 0-5.93l2.12-2.12c2.73 2.73 2.73 7.17 0 9.9-2.73 2.73-7.17 2.73-9.9 0l-1.42 1.42-1.42-4.24 4.24 1.42-1.55 1.55z" fill="white"/>';
      break;
  }

  const svgString = `
    <svg width="32" height="40" viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 0C9.37 0 4 5.37 4 12c0 10 12 28 12 28s12-18 12-28c0-6.63-5.37-12-12-12z" fill="${color}" stroke="white" stroke-width="2"/>
      <g transform="translate(8, 6) scale(0.67)">
        ${iconPath}
      </g>
    </svg>
  `;
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  return L.icon({
    iconUrl: url,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40]
  });
};

// Simple circular marker for user location
const createUserLocationIcon = () => {
  const svgString = `
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" fill="#4CAF50" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
      <circle cx="16" cy="16" r="3" fill="#4CAF50"/>
    </svg>
  `;
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  return L.icon({
    iconUrl: url,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

export const YardSaleMap: React.FC<YardSaleMapProps> = ({ center }) => {
  const [listings, setListings] = useState<YardSaleListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [radius, setRadius] = useState(25);
  const [mounted, setMounted] = useState(false);
  const [userLocation, setUserLocation] = useState(
    center || { latitude: 40.7128, longitude: -74.006 }
  );
  const [selectedListing, setSelectedListing] = useState<YardSaleListing | null>(null);
  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const leafletRef = useRef(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';

  // Ensure we only render map on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch listings based on current location and radius
  const fetchListings = async (lat: number, lon: number, radiusValue: number) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/yard-sales/search/?latitude=${lat}&longitude=${lon}&radius=${radiusValue}`
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

  const handleDirections = (lat: number, lon: number) => {
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
          background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
          padding: '3rem 2.5rem',
          borderRadius: '16px',
          textAlign: 'center',
          zIndex: 400,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          border: '1px solid rgba(102, 126, 234, 0.1)',
          maxWidth: '400px'
        }}>
          <div style={{
            fontSize: '4rem',
            marginBottom: '1rem',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
          }}>
            📍
          </div>
          <h3 style={{
            color: '#2d3748',
            fontSize: '1.25rem',
            fontWeight: '600',
            marginBottom: '0.5rem',
            margin: 0
          }}>
            No yard sales found
          </h3>
          <p style={{
            fontSize: '0.95rem',
            color: '#718096',
            marginTop: '0.75rem',
            lineHeight: '1.6'
          }}>
            Try expanding the search radius or check back later for new listings
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 70px)', flexDirection: 'column', background: 'linear-gradient(180deg, #1D2B4F 0%, #121A33 100%)' }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem 2rem',
        background: 'linear-gradient(180deg, #A31717 0%, #6E0E0E 100%)',
        borderBottom: '2px solid #C8A25F',
        boxShadow: '0 2px 4px rgba(0,0,0,0.4)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h1 style={{
            margin: 0,
            fontSize: '2rem',
            fontWeight: '700',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            textShadow: '0 -1px 0 rgba(0,0,0,0.25)'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="#C8A25F" stroke="#C8A25F" strokeWidth="1.5">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            Yard Sales Near You
          </h1>
          <Link href="/app/create-yard-sale">
            <button style={{
              padding: '0.875rem 1.75rem',
              background: 'linear-gradient(180deg, #2F406B 0%, #192A4A 100%)',
              color: '#fff',
              border: '1px solid #C8A25F',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '0.9rem',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
              textShadow: '0 -1px 0 rgba(0,0,0,0.25)',
              transform: 'translateY(0)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.95';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            >
              <Plus size={20} strokeWidth={2.5} />
              Post Yard Sale
            </button>
          </Link>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'linear-gradient(180deg, #C0C0C0, #EDEDED)',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            border: '1px solid #C8A25F',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}>
            <span style={{
              fontSize: '1.125rem',
              fontWeight: '700',
              color: '#2B2B2B'
            }}>
              {listings.length}
            </span>
            <span style={{
              fontSize: '0.875rem',
              color: '#2B2B2B',
              fontWeight: '600'
            }}>
              sales within {radius} miles
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            background: 'linear-gradient(180deg, #C0C0C0, #EDEDED)',
            padding: '0.5rem 1.25rem',
            borderRadius: '20px',
            border: '1px solid #C8A25F',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
          }}>
            <label style={{
              fontSize: '0.875rem',
              color: '#2B2B2B',
              fontWeight: '600'
            }}>
              Search Radius:
            </label>
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={radius}
              onChange={(e) => setRadius(parseInt(e.target.value))}
              style={{
                width: '150px',
                cursor: 'pointer',
                accentColor: '#A31717'
              }}
            />
            <span style={{
              minWidth: '55px',
              fontWeight: '700',
              color: '#2B2B2B',
              fontSize: '0.95rem'
            }}>
              {radius} mi
            </span>
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden', width: '100%', minHeight: 0 }}>
        <style>{`
          .leaflet-container {
            background: #c5cad1 !important;
            width: 100%;
            height: 100%;
            z-index: 1;
          }
          .leaflet-pane {
            z-index: 2;
          }
          .leaflet-tile-pane {
            z-index: 2;
          }
          .leaflet-marker-pane {
            z-index: 4;
          }
          .leaflet-popup-pane {
            z-index: 7;
          }
          .leaflet-attribution-control {
            z-index: 7;
          }
        `}</style>
        {mounted && typeof window !== 'undefined' && (
          <MapContainer
            center={[userLocation.latitude, userLocation.longitude]}
            zoom={12}
            style={{ width: '100%', height: '100%', display: 'block' }}
            ref={leafletRef}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              subdomains="abcd"
              maxZoom={20}
              minZoom={1}
            />

            {/* User location marker */}
            <Marker
              position={[userLocation.latitude, userLocation.longitude]}
              title="Your Location"
              icon={createUserLocationIcon()}
            >
              <Popup>
                <div style={{ minWidth: '220px', color: '#333' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>📍 Your Location</h3>
                  <div style={{ fontSize: '0.8rem', marginBottom: '0.75rem', lineHeight: '1.5' }}>
                    <div><strong>Latitude:</strong> {userLocation.latitude.toFixed(4)}</div>
                    <div><strong>Longitude:</strong> {userLocation.longitude.toFixed(4)}</div>
                    <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #ddd' }}>
                      <strong>Search Radius:</strong> {radius} miles
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                      <strong>Yard Sales Found:</strong> {listings.length}
                    </div>
                  </div>
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: '#f0f7ff',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    color: '#1976d2'
                  }}>
                    💡 Adjust the radius slider to find more or fewer yard sales nearby.
                  </div>
                </div>
              </Popup>
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
            {listings.map((listing) => {
              const colorMap: Record<string, string> = {
                red: '#d32f2f',
                blue: '#2196F3',
                orange: '#FF9800'
              };
              const iconTypeMap: Record<string, 'home' | 'star' | 'refresh'> = {
                red: 'home',
                blue: 'star',
                orange: 'refresh'
              };
              const color = colorMap[listing.pin_color] || '#d32f2f';
              const iconType = iconTypeMap[listing.pin_color] || 'home';

              return (
                <Marker
                  key={listing.id}
                  position={[parseFloat(listing.latitude.toString()), parseFloat(listing.longitude.toString())]}
                  title={listing.title}
                  icon={createCustomIcon(color, iconType)}
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
                            parseFloat(listing.longitude.toString())
                          )}
                          style={{
                            flex: 1,
                            padding: '0.5rem',
                            background: 'linear-gradient(180deg, #2F406B 0%, #192A4A 100%)',
                            color: '#fff',
                            border: '1px solid #C8A25F',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                            textShadow: '0 -1px 0 rgba(0,0,0,0.25)'
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
                              background: 'linear-gradient(180deg, #A31717 0%, #6E0E0E 100%)',
                              color: '#fff',
                              border: '1px solid #C8A25F',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                              textShadow: '0 -1px 0 rgba(0,0,0,0.25)'
                            }}
                          >
                            📞 Call
                          </button>
                        )}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            <MapContent />
          </MapContainer>
        )}

        {/* Legend - Collapsible Modern Glassmorphism Design */}
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '24px',
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          padding: legendCollapsed ? '0.75rem 1rem' : '1.25rem',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          zIndex: 500,
          fontSize: '0.875rem',
          minWidth: legendCollapsed ? 'auto' : '220px',
          border: '1px solid rgba(255,255,255,0.5)',
          transition: 'all 0.3s ease'
        }}>
          <div
            onClick={() => setLegendCollapsed(!legendCollapsed)}
            style={{
              fontWeight: '700',
              marginBottom: legendCollapsed ? '0' : '1rem',
              fontSize: '1rem',
              color: '#2d3748',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <span>📋</span>
            {!legendCollapsed && 'Legend'}
            <span style={{
              fontSize: '0.75rem',
              marginLeft: legendCollapsed ? '0' : 'auto',
              transition: 'transform 0.3s ease',
              transform: legendCollapsed ? 'rotate(180deg)' : 'rotate(0deg)'
            }}>
              ▼
            </span>
          </div>
          {!legendCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  background: 'linear-gradient(135deg, #d32f2f 0%, #c62828 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(211, 47, 47, 0.3)'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <path d="M12 7l6 4.5v6.5h-3v-4h-6v4h-3v-6.5l6-4.5z"/>
                  </svg>
                </div>
                <span style={{ color: '#4a5568', fontWeight: '500' }}>Multi-day sale</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  background: 'linear-gradient(135deg, #2196F3 0%, #1976d2 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <path d="M12 2l2.4 7.4h7.6l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z"/>
                  </svg>
                </div>
                <span style={{ color: '#4a5568', fontWeight: '500' }}>Today only</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  background: 'linear-gradient(135deg, #FF9800 0%, #f57c00 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(255, 152, 0, 0.3)'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                    <path d="M17.65 6.35c-1.63-1.63-4.29-1.63-5.93 0a4.17 4.17 0 000 5.93M6.35 17.65a4.17 4.17 0 005.93 0 4.17 4.17 0 000-5.93"/>
                    <path d="M15.5 4.5l3 3m-12 12l3 3"/>
                  </svg>
                </div>
                <span style={{ color: '#4a5568', fontWeight: '500' }}>Starting soon</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                marginTop: '0.25rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid rgba(0,0,0,0.08)'
              }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  background: 'linear-gradient(135deg, #4CAF50 0%, #388e3c 100%)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(76, 175, 80, 0.3)'
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2">
                    <circle cx="12" cy="12" r="8" fill="white"/>
                    <circle cx="12" cy="12" r="3" fill="#4CAF50"/>
                  </svg>
                </div>
                <span style={{ color: '#4a5568', fontWeight: '600' }}>Your location</span>
              </div>
            </div>
          )}
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
                    parseFloat(selectedListing.longitude.toString())
                  )}
                  style={{
                    flex: 1,
                    padding: '0.75rem',
                    background: 'linear-gradient(180deg, #2F406B 0%, #192A4A 100%)',
                    color: '#fff',
                    border: '1px solid #C8A25F',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '700',
                    fontSize: '0.875rem',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                    textShadow: '0 -1px 0 rgba(0,0,0,0.25)'
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
                      background: 'linear-gradient(180deg, #A31717 0%, #6E0E0E 100%)',
                      color: '#fff',
                      border: '1px solid #C8A25F',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: '700',
                      fontSize: '0.875rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                      textShadow: '0 -1px 0 rgba(0,0,0,0.25)'
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

      {/* Loading indicator - Modern Spinner */}
      {loading && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%)',
          backdropFilter: 'blur(10px)',
          color: '#fff',
          padding: '2.5rem 3rem',
          borderRadius: '16px',
          zIndex: 999,
          textAlign: 'center',
          boxShadow: '0 12px 48px rgba(102, 126, 234, 0.4)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          <div style={{
            fontSize: '2.5rem',
            marginBottom: '1.25rem',
            animation: 'pulse 1.5s ease-in-out infinite'
          }}>
            🔍
          </div>
          <div style={{
            fontSize: '1.125rem',
            fontWeight: '600',
            letterSpacing: '0.5px'
          }}>
            Finding yard sales nearby...
          </div>
          <style>{`
            @keyframes pulse {
              0%, 100% { transform: scale(1); opacity: 1; }
              50% { transform: scale(1.1); opacity: 0.8; }
            }
          `}</style>
        </div>
      )}

      {/* Listings List Below Map */}
      <div style={{
        backgroundColor: '#fff',
        borderTop: '2px solid #C8A25F',
        maxHeight: '350px',
        overflowY: 'auto',
        padding: '1.5rem 2rem'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: '700',
          color: '#1D2B4F',
          marginBottom: '1rem',
          margin: 0
        }}>
          Available Listings ({listings.length})
        </h2>

        {listings.length === 0 ? (
          <p style={{
            color: '#718096',
            fontSize: '0.95rem',
            fontStyle: 'italic'
          }}>
            No yard sales found in this radius. Try expanding your search distance.
          </p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '1rem'
          }}>
            {listings.map((listing) => (
              <div
                key={listing.id}
                onClick={() => setSelectedListing(listing)}
                style={{
                  padding: '1rem',
                  backgroundColor: selectedListing?.id === listing.id ? '#f0f7ff' : '#f9f9f9',
                  border: selectedListing?.id === listing.id ? '2px solid #2196F3' : '1px solid #e0e0e0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: selectedListing?.id === listing.id ? '0 4px 12px rgba(33, 150, 243, 0.2)' : '0 2px 4px rgba(0,0,0,0.05)'
                }}
                onMouseEnter={(e) => {
                  if (selectedListing?.id !== listing.id) {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                    e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedListing?.id !== listing.id) {
                    e.currentTarget.style.backgroundColor = '#f9f9f9';
                    e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '0.95rem',
                    fontWeight: '700',
                    color: '#1D2B4F',
                    flex: 1
                  }}>
                    {listing.title}
                  </h3>
                  {listing.distance_miles && (
                    <span style={{
                      backgroundColor: '#2196F3',
                      color: '#fff',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                      marginLeft: '0.5rem'
                    }}>
                      {listing.distance_miles}mi
                    </span>
                  )}
                </div>

                <p style={{
                  margin: '0.5rem 0',
                  fontSize: '0.85rem',
                  color: '#666'
                }}>
                  📍 {listing.address}
                </p>

                <p style={{
                  margin: '0.5rem 0',
                  fontSize: '0.85rem',
                  color: '#666'
                }}>
                  📅 {listing.start_date} to {listing.end_date}
                </p>

                <p style={{
                  margin: '0.5rem 0',
                  fontSize: '0.85rem',
                  color: '#666'
                }}>
                  🕐 {listing.hours}
                </p>

                <div style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.75rem',
                  backgroundColor: listing.is_today_only ? '#e3f2fd' : '#f3e5f5',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  color: listing.is_today_only ? '#1976d2' : '#7b1fa2',
                  marginTop: '0.5rem'
                }}>
                  {listing.is_today_only ? '⭐ TODAY ONLY' : '🏠 MULTI-DAY'}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDirections(
                        parseFloat(listing.latitude.toString()),
                        parseFloat(listing.longitude.toString()),
                        listing.address
                      );
                    }}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      backgroundColor: '#2196F3',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.7rem',
                      fontWeight: '600'
                    }}
                  >
                    📍 Map
                  </button>
                  {listing.phone && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCall(listing.phone!);
                      }}
                      style={{
                        flex: 1,
                        padding: '0.5rem',
                        backgroundColor: '#4CAF50',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        fontWeight: '600'
                      }}
                    >
                      📞 Call
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
