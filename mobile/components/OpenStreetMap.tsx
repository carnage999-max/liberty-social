import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface Marker {
  id: number;
  latitude: number;
  longitude: number;
  title: string;
  description: string;
  color?: string;
  pinColor?: string;
}

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

interface OpenStreetMapProps {
  region: Region;
  markers: Marker[];
  userLocation?: { latitude: number; longitude: number };
  radius?: number;
  onRegionChangeComplete?: (region: Region) => void;
  onMarkerPress?: (marker: Marker) => void;
  searchRadius?: number;
}

export default function OpenStreetMap({
  region,
  markers,
  userLocation,
  radius = 25,
  onRegionChangeComplete,
  onMarkerPress,
  searchRadius = 25,
}: OpenStreetMapProps) {
  const webViewRef = useRef<WebView>(null);
  const [mapReady, setMapReady] = useState(false);

  // Expose panToUser method
  useEffect(() => {
    const mapPanToUser = () => {
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript('window.panToUser(); true;');
      }
    };
    (global as any).mapPanToUser = mapPanToUser;
    return () => {
      (global as any).mapPanToUser = undefined;
    };
  }, []);

  const generateHTML = () => {
    const radiusMeters = searchRadius * 1609.34; // miles to meters
    const initialZoom = 12;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html { width: 100%; height: 100%; }
    body { width: 100%; height: 100%; margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; background: #f0f0f0; }
    #map { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
    .leaflet-container { background: #fff; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    (function() {
      console.log('Script starting');
      let map = null;
      let markersLayer = [];
      let circleLayer = null;
      let userLocationMarker = null;
      let mapInitialized = false;
      let lastUserLat = ${userLocation ? userLocation.latitude : region.latitude};
      let lastUserLon = ${userLocation ? userLocation.longitude : region.longitude};

      function initMap() {
        if (mapInitialized) {
          console.log('Map already initialized, skipping init');
          return;
        }
        console.log('initMap called');
        try {
          const mapDiv = document.getElementById('map');
          console.log('Map container found:', !!mapDiv);
          if (!mapDiv) {
            console.error('Map container not found');
            return;
          }
          
          const centerLat = ${userLocation ? userLocation.latitude : region.latitude};
          const centerLon = ${userLocation ? userLocation.longitude : region.longitude};
          console.log('Creating Leaflet map at', centerLat, centerLon);
          
          map = L.map('map', {
            center: [centerLat, centerLon],
            zoom: ${initialZoom},
            zoomControl: true,
            attributionControl: true
          });
          console.log('Map created successfully');
          
          // Use CARTO Voyager tiles (same as website)
          const tileUrl = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
          console.log('Adding tile layer');
          
          L.tileLayer(tileUrl, {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            subdomains: 'abcd',
            maxZoom: 20,
            minZoom: 1,
            crossOrigin: true
          }).addTo(map);
          
          console.log('Tile layer added');

          // Track region changes but don't reset map
          map.on('moveend', function() {
            const center = map.getCenter();
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'regionChange',
                latitude: center.lat,
                longitude: center.lng
              }));
            }
          });

          // Add user location marker at user location, not region
          if (${!!userLocation}) {
            console.log('Adding user location marker');
            userLocationMarker = L.circleMarker([${userLocation?.latitude}, ${userLocation?.longitude}], {
              radius: 8,
              fillColor: "#4CAF50",
              color: "#fff",
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8
            }).addTo(map);
            
            userLocationMarker.bindPopup('<b>Your Location</b>');
          }

          // Draw circle around USER location, not region
          console.log('Adding search radius circle');
          circleLayer = L.circle([lastUserLat, lastUserLon], {
            radius: ${radiusMeters},
            fillColor: "rgba(33, 150, 243, 0.07)",
            color: "rgba(33, 150, 243, 0.5)",
            weight: 2,
            fillOpacity: 0.1
          }).addTo(map);

          updateMarkers();
          mapInitialized = true;
          window.mapReady = true;
          console.log('Map initialization complete');
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
          }
        } catch(e) {
          console.error('Error initializing map:', e.toString(), e.stack);
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: e.toString() }));
          }
        }
      }

      function updateMarkers() {
        console.log('updateMarkers called');
        if (!map) {
          console.log('Map not ready for updateMarkers');
          return;
        }
        markersLayer.forEach(marker => map.removeLayer(marker));
        markersLayer = [];

        const markersData = ${JSON.stringify(markers)};
        console.log('Total markers to add:', markersData.length);
        
        markersData.forEach(m => {
          const pinColor = m.pinColor || m.color || '#d32f2f';
          const marker = L.circleMarker([m.latitude, m.longitude], {
            radius: 10,
            fillColor: pinColor,
            color: "#fff",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
          }).addTo(map);

          marker.bindPopup('<b>' + m.title + '<\/b><br/>' + m.description);
          
          marker.on('click', function() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'markerPress',
                id: m.id
              }));
            }
          });

          markersLayer.push(marker);
        });
        console.log('Markers added:', markersLayer.length);
      }

      function updateRadius() {
        console.log('updateRadius called');
        if (!map || !circleLayer) return;
        
        // Remove old circle
        map.removeLayer(circleLayer);
        
        // Add new circle with updated radius, centered on user location
        const userLat = ${userLocation ? userLocation.latitude : region.latitude};
        const userLon = ${userLocation ? userLocation.longitude : region.longitude};
        circleLayer = L.circle([userLat, userLon], {
          radius: ${radiusMeters},
          fillColor: "rgba(33, 150, 243, 0.07)",
          color: "rgba(33, 150, 243, 0.5)",
          weight: 2,
          fillOpacity: 0.1
        }).addTo(map);
        console.log('Search radius updated:', ${radiusMeters}, 'meters');
      }

      // Initialize when Leaflet is available
      console.log('Checking Leaflet availability...');
      if (typeof L !== 'undefined') {
        console.log('Leaflet found, initializing map');
        setTimeout(initMap, 100);
      } else {
        console.log('Leaflet not found, waiting...');
        var attempts = 0;
        var checkInterval = setInterval(function() {
          attempts++;
          if (typeof L !== 'undefined') {
            console.log('Leaflet is now available');
            clearInterval(checkInterval);
            initMap();
          } else if (attempts > 50) {
            console.error('Leaflet failed to load');
            clearInterval(checkInterval);
          }
        }, 100);
      }

      window.updateMap = function(data) {
        console.log('updateMap called from React with data:', data);
        updateMarkers();
        updateRadius();
      };

      window.panToUser = function() {
        if (map && ${!!userLocation}) {
          console.log('Panning to user location');
          map.panTo([${userLocation?.latitude}, ${userLocation?.longitude}], { animate: true });
        }
      };
    })();
  </script>
</body>
</html>
`;
  };

  useEffect(() => {
    if (mapReady && webViewRef.current) {
      const script = `
        window.updateMap({
          radius: ${searchRadius},
          markers: ${JSON.stringify(markers)},
          userLocation: ${JSON.stringify(userLocation)}
        });
        true;
      `;
      webViewRef.current.injectJavaScript(script);
    }
  }, [markers, searchRadius, mapReady]);

  const handleMessage = (event: any) => {
    console.log('WebView message received:', event.nativeEvent.data);
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'mapReady') {
        console.log('Map is ready');
        setMapReady(true);
      } else if (data.type === 'error') {
        console.error('WebView error:', data.message);
      } else if (data.type === 'regionChange' && onRegionChangeComplete) {
        console.log('Region changed:', data);
        onRegionChangeComplete({
          latitude: data.latitude,
          longitude: data.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      } else if (data.type === 'markerPress' && onMarkerPress) {
        console.log('Marker pressed:', data.id);
        const marker = markers.find(m => m.id === data.id);
        if (marker) {
          onMarkerPress(marker);
        }
      }
    } catch (e) {
      console.error('Error handling WebView message:', e);
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: generateHTML() }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={handleMessage}
        scalesPageToFit={false}
        startInLoadingState={true}
        mixedContentMode="always"
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        onError={(error) => console.error('WebView error:', error)}
        onHttpError={(error) => console.error('WebView HTTP error:', error)}
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color="#C8A25F" />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
  loader: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
