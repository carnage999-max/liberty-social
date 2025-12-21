'use client';

import React, { useState, useMemo } from 'react';

interface CountryData {
  country: string;
  total: number;
  male: number;
  female: number;
  active: number;
}

interface CountryHeatmapProps {
  data: CountryData[];
}

// Country bounding boxes for world map [minLon, minLat, maxLon, maxLat]
const countryBounds: Record<string, { name: string; bounds: [number, number, number, number] }> = {
  'United States': { name: 'USA', bounds: [-125, 25, -66, 49] },
  'Canada': { name: 'CAN', bounds: [-141, 42, -52, 84] },
  'Mexico': { name: 'MEX', bounds: [-117, 15, -86, 33] },
  'Brazil': { name: 'BRA', bounds: [-74, -34, -34, 5] },
  'Argentina': { name: 'ARG', bounds: [-76, -56, -53, -21] },
  'United Kingdom': { name: 'GBR', bounds: [-9, 49, 2, 59] },
  'France': { name: 'FRA', bounds: [-6, 42, 8, 51] },
  'Germany': { name: 'DEU', bounds: [6, 47, 16, 56] },
  'Italy': { name: 'ITA', bounds: [7, 37, 19, 47] },
  'Spain': { name: 'ESP', bounds: [-10, 36, 4, 44] },
  'Netherlands': { name: 'NLD', bounds: [3, 50, 8, 54] },
  'Poland': { name: 'POL', bounds: [14, 49, 24, 55] },
  'Russia': { name: 'RUS', bounds: [18, 40, 169, 81] },
  'India': { name: 'IND', bounds: [68, 8, 97, 35] },
  'China': { name: 'CHN', bounds: [73, 18, 135, 54] },
  'Japan': { name: 'JPN', bounds: [123, 29, 146, 45] },
  'South Korea': { name: 'KOR', bounds: [124, 33, 132, 39] },
  'Australia': { name: 'AUS', bounds: [112, -44, 154, -10] },
  'Indonesia': { name: 'IDN', bounds: [95, -11, 141, 6] },
  'Thailand': { name: 'THA', bounds: [98, 6, 106, 21] },
  'Vietnam': { name: 'VNM', bounds: [102, 8, 109, 24] },
  'Philippines': { name: 'PHL', bounds: [121, 5, 127, 19] },
  'Singapore': { name: 'SGP', bounds: [103, 1, 104, 2] },
  'Malaysia': { name: 'MYS', bounds: [100, 1, 120, 7] },
  'Pakistan': { name: 'PAK', bounds: [61, 24, 77, 37] },
  'Bangladesh': { name: 'BGD', bounds: [88, 22, 93, 29] },
  'Turkey': { name: 'TUR', bounds: [26, 36, 45, 42] },
  'Saudi Arabia': { name: 'SAU', bounds: [34, 16, 56, 33] },
  'United Arab Emirates': { name: 'ARE', bounds: [51, 22, 57, 26] },
  'Israel': { name: 'ISR', bounds: [34, 29, 36, 34] },
  'Egypt': { name: 'EGY', bounds: [25, 22, 35, 32] },
  'South Africa': { name: 'ZAF', bounds: [17, -35, 33, -22] },
  'Nigeria': { name: 'NGA', bounds: [2, 4, 15, 14] },
  'Kenya': { name: 'KEN', bounds: [29, -5, 42, 5] },
  'Greece': { name: 'GRC', bounds: [20, 35, 29, 42] },
  'Portugal': { name: 'PRT', bounds: [-10, 37, -6, 42] },
  'Sweden': { name: 'SWE', bounds: [11, 55, 24, 69] },
  'Norway': { name: 'NOR', bounds: [4, 57, 32, 72] },
  'Denmark': { name: 'DNK', bounds: [8, 55, 13, 58] },
  'Finland': { name: 'FIN', bounds: [19, 60, 32, 71] },
  'Ireland': { name: 'IRL', bounds: [-11, 52, -6, 55] },
};

export const CountryHeatmap: React.FC<CountryHeatmapProps> = ({ data }) => {
  const [hoveredCountry, setHoveredCountry] = useState(null as string | null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const maxValue = useMemo(() => {
    return Math.max(...data.map(d => d.total), 1);
  }, [data]);

  const dataMap = useMemo(() => {
    const map: Record<string, CountryData> = {};
    data.forEach(item => {
      map[item.country] = item;
    });
    return map;
  }, [data]);

  const getColorIntensity = (value: number): string => {
    const ratio = value / maxValue;
    if (ratio > 0.8) return '#d32f2f';
    if (ratio > 0.6) return '#e84c3d';
    if (ratio > 0.4) return '#ff6f4e';
    if (ratio > 0.2) return '#ffb74d';
    return '#fff9c4';
  };

  const handleMouseEnter = (countryName: string, e: React.MouseEvent<SVGRectElement>) => {
    setHoveredCountry(countryName);
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
    });
  };

  const hoveredData = hoveredCountry ? dataMap[hoveredCountry] : null;

  const WIDTH = 1200;
  const HEIGHT = 600;
  const padding = 50;

  const scale = (value: number, min: number, max: number, outMin: number, outMax: number) => {
    return ((value - min) / (max - min)) * (outMax - outMin) + outMin;
  };

  const countriesWithData = Object.entries(countryBounds)
    .filter(([name]) => dataMap[name])
    .map(([countryName, shape]) => ({
      countryName,
      ...shape,
      data: dataMap[countryName]
    }));

  return (
    <div style={{
      padding: '1.5rem',
      backgroundColor: '#fff',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      marginBottom: '2rem'
    }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Global User Distribution Heatmap</h2>

      <div style={{
        backgroundColor: '#e3f2fd',
        borderRadius: '6px',
        padding: '1rem',
        marginBottom: '1.5rem',
        overflowX: 'auto',
        border: '1px solid #bbdefb'
      }}>
        <svg
          width="100%"
          height="600"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          style={{ minWidth: '900px', display: 'block' }}
        >
          {/* Background */}
          <rect width={WIDTH} height={HEIGHT} fill="#e3f2fd" />

          {/* Grid lines for reference */}
          <g stroke="#ccc" strokeWidth="0.5" opacity="0.3">
            {[-180, -120, -60, 0, 60, 120, 180].map(lon => (
              <line
                key={`lon-${lon}`}
                x1={scale(lon, -180, 180, padding, WIDTH - padding)}
                y1={padding}
                x2={scale(lon, -180, 180, padding, WIDTH - padding)}
                y2={HEIGHT - padding}
              />
            ))}
            {[-60, -30, 0, 30, 60].map(lat => (
              <line
                key={`lat-${lat}`}
                x1={padding}
                y1={scale(lat, 90, -90, padding, HEIGHT - padding)}
                x2={WIDTH - padding}
                y2={scale(lat, 90, -90, padding, HEIGHT - padding)}
              />
            ))}
          </g>

          {/* Country rectangles representing geographic areas */}
          {countriesWithData.map(country => {
            const [minLon, minLat, maxLon, maxLat] = country.bounds;
            const x1 = scale(minLon, -180, 180, padding, WIDTH - padding);
            const y1 = scale(maxLat, 90, -90, padding, HEIGHT - padding);
            const x2 = scale(maxLon, -180, 180, padding, WIDTH - padding);
            const y2 = scale(minLat, 90, -90, padding, HEIGHT - padding);
            const w = Math.abs(x2 - x1);
            const h = Math.abs(y2 - y1);
            const x = Math.min(x1, x2);
            const y = Math.min(y1, y2);

            const color = getColorIntensity(country.data.total);
            const isHovered = hoveredCountry === country.countryName;

            return (
              <g key={country.countryName}>
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  fill={color}
                  stroke={isHovered ? '#000' : '#999'}
                  strokeWidth={isHovered ? 2.5 : 0.5}
                  opacity={isHovered ? 1 : 0.85}
                  style={{
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    filter: isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none'
                  }}
                  onMouseEnter={(e: React.MouseEvent<SVGRectElement>) => handleMouseEnter(country.countryName, e)}
                  onMouseLeave={() => setHoveredCountry(null)}
                />
                {/* Country label */}
                {w > 25 && h > 18 && (
                  <text
                    x={x + w / 2}
                    y={y + h / 2 + 5}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="bold"
                    fill={country.data.total > maxValue * 0.5 ? '#fff' : '#333'}
                    pointerEvents="none"
                  >
                    {country.name}
                  </text>
                )}
                {/* User count for large countries */}
                {w > 40 && h > 30 && (
                  <text
                    x={x + w / 2}
                    y={y + h / 2 + 18}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="bold"
                    fill={country.data.total > maxValue * 0.5 ? '#fff' : '#666'}
                    pointerEvents="none"
                    opacity="0.8"
                  >
                    {country.data.total}
                  </text>
                )}
              </g>
            );
          })}

          {/* Axis labels */}
          <g fontSize="11" fill="#666" fontWeight="500">
            {[-180, -120, -60, 0, 60, 120, 180].map(lon => (
              <text
                key={`lon-label-${lon}`}
                x={scale(lon, -180, 180, padding, WIDTH - padding)}
                y={HEIGHT - 25}
                textAnchor="middle"
              >
                {lon}°
              </text>
            ))}
            {[-60, -30, 0, 30, 60].map(lat => (
              <text
                key={`lat-label-${lat}`}
                x={padding - 15}
                y={scale(lat, 90, -90, padding, HEIGHT - padding) + 4}
                textAnchor="end"
              >
                {lat}°
              </text>
            ))}
          </g>
        </svg>
      </div>

      {/* Tooltip */}
      {hoveredData && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: 'translate(-50%, -100%)',
            backgroundColor: 'rgba(0, 0, 0, 0.95)',
            color: '#fff',
            padding: '1rem',
            borderRadius: '6px',
            fontSize: '0.875rem',
            zIndex: 1000,
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            fontWeight: '500',
            maxWidth: '250px'
          }}
        >
          <div style={{ marginBottom: '0.75rem', fontWeight: 'bold', fontSize: '1rem' }}>
            {hoveredData.country}
          </div>
          <div style={{ marginBottom: '0.5rem', color: '#fff' }}>
            <strong>Total Users:</strong> {hoveredData.total.toLocaleString()}
          </div>
          <div style={{ marginBottom: '0.5rem', color: '#e0e0e0' }}>
            <strong>Gender:</strong> {hoveredData.male} M / {hoveredData.female} F
          </div>
          <div style={{ color: '#e0e0e0' }}>
            <strong>Active:</strong> {hoveredData.active}
          </div>
          <div style={{
            position: 'absolute',
            bottom: '-8px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid rgba(0, 0, 0, 0.95)'
          }} />
        </div>
      )}

      {/* Legend and Info Section */}
      <div style={{
        marginTop: '1.5rem',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.5rem'
      }}>
        {/* Legend */}
        <div style={{
          padding: '1.25rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '1rem', fontSize: '0.95rem' }}>Color Intensity Scale</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '35px', height: '35px', backgroundColor: '#d32f2f', borderRadius: '4px', border: '1px solid #999' }} />
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>High Activity</div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>80%+ of max users</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '35px', height: '35px', backgroundColor: '#ff6f4e', borderRadius: '4px', border: '1px solid #999' }} />
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>Medium Activity</div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>40-60% of max users</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '35px', height: '35px', backgroundColor: '#fff9c4', borderRadius: '4px', border: '1px solid #999' }} />
              <div>
                <div style={{ fontWeight: '600', fontSize: '0.875rem' }}>Low Activity</div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>Below 20% of max users</div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Countries Table */}
        <div style={{
          padding: '1.25rem',
          backgroundColor: '#f8f9fa',
          borderRadius: '6px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '1rem', fontSize: '0.95rem' }}>Top 10 Countries</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {data.slice(0, 10).map((country, idx) => (
              <div key={country.country} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '0.875rem',
                paddingBottom: '0.5rem',
                borderBottom: idx < 9 ? '1px solid #e0e0e0' : 'none'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '24px',
                    height: '24px',
                    backgroundColor: '#2196F3',
                    color: '#fff',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    {idx + 1}
                  </span>
                  {country.country}
                </span>
                <span style={{ fontWeight: 'bold', color: '#d32f2f' }}>{country.total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
