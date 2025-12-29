import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Platform } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
// Optional clustering support
let ClusteredMapView: any = null;
try {
  // react-native-map-clustering exports default component
  // require at runtime so app doesn't crash if dep missing
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ClusteredMapView = require('react-native-map-clustering').default;
} catch (e) {
  ClusteredMapView = null;
}
import * as Location from 'expo-location';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { apiClient } from '../../utils/api';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AppNavbar from '../../components/layout/AppNavbar';

interface YardSaleListing {
  id: number;
  title: string;
  address: string;
  latitude: number;
  longitude: number;
  start_date: string;
  end_date: string;
  hours: string;
  phone?: string | null;
  pin_color?: string;
}

const RADIUS_PRESETS = [5, 10, 25, 35, 50];

export default function YardSalesScreen() {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [region, setRegion] = useState<any>(null);
  const [radius, setRadius] = useState<number>(25);
  const [listings, setListings] = useState<YardSaleListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [selectedListing, setSelectedListing] = useState<YardSaleListing | null>(null);

  const fetchListings = useCallback(async (lat: number, lon: number, r: number) => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>(`/yard-sales/search/?latitude=${lat}&longitude=${lon}&radius=${r}`);
      setListings(data.results || []);
    } catch (err) {
      console.error('Failed to fetch yard sales', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionGranted(false);
        // fallback coordinates (center of US)
        const fallback = { latitude: 40.7128, longitude: -74.006, latitudeDelta: 0.0922, longitudeDelta: 0.0421 };
        setRegion(fallback);
        await fetchListings(fallback.latitude, fallback.longitude, radius);
        return;
      }

      setPermissionGranted(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const rgn = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.0922, longitudeDelta: 0.0421 };
      setRegion(rgn);
      await fetchListings(rgn.latitude, rgn.longitude, radius);
    })();
  }, []);

  useEffect(() => {
    if (!region) return;
    fetchListings(region.latitude, region.longitude, radius);
  }, [radius]);

  const openDirections = (lat: number, lon: number) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lon}`,
      android: `google.navigation:q=${lat},${lon}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
    });
    if (url) Linking.openURL(url);
  };

  const makeCall = (phone?: string | null) => {
    if (!phone) return;
    const url = `tel:${phone}`;
    Linking.openURL(url).catch(() => null);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <AppNavbar title="Yard Sales" showProfileImage={false} />

      {!region ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.mapWrap}>
          <MapView
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            region={region}
            onRegionChangeComplete={(r) => setRegion(r)}
            showsUserLocation
            showsMyLocationButton
          >
            {/* Use cluster view when available */}
            {ClusteredMapView ? (
              <ClusteredMapView
                region={region}
                style={{ flex: 1 }}
                onRegionChangeComplete={(r: any) => setRegion(r)}
                clusteringEnabled
                clusterColor={"#C8A25F"}
              >
                {listings.map((l) => (
                  <Marker
                    key={l.id}
                    coordinate={{ latitude: Number(l.latitude), longitude: Number(l.longitude) }}
                    title={l.title}
                    description={l.address}
                    onPress={() => setSelectedListing(l)}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: l.pin_color || '#d32f2f', borderWidth: 2, borderColor: '#fff' }} />
                    </View>
                  </Marker>
                ))}
              </ClusteredMapView>
            ) : (
              <>
                {listings.map((l) => (
                  <Marker
                    key={l.id}
                    coordinate={{ latitude: Number(l.latitude), longitude: Number(l.longitude) }}
                    title={l.title}
                    description={l.address}
                    onPress={() => setSelectedListing(l)}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: l.pin_color || '#d32f2f', borderWidth: 2, borderColor: '#fff' }} />
                    </View>
                  </Marker>
                ))}
              </>
            )}

            <Circle
              center={{ latitude: region.latitude, longitude: region.longitude }}
              radius={radius * 1609.34}
              strokeColor="rgba(33,150,243,0.5)"
              fillColor="rgba(33,150,243,0.07)"
            />
          </MapView>

          {/* Floating controls */}
          <View style={styles.floatingTopRight}>
            <View style={[styles.radiusPill, { backgroundColor: isDark ? '#0f1720' : '#fff', borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)' }]}>
              <Text style={{ fontWeight: '700', marginRight: 8, color: colors.text }}>{radius} mi</Text>
              <View style={{ flexDirection: 'row' }}>
                {RADIUS_PRESETS.map((p) => (
                  <TouchableOpacity key={p} onPress={() => setRadius(p)} style={[styles.presetBtn, p === radius ? { borderColor: '#C8A25F' } : {}]}>
                    <Text style={{ fontSize: 12, color: p === radius ? '#C8A25F' : colors.textSecondary }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          <AnimatedPostButton onPress={() => router.push('/yard-sales/create')} isDark={isDark} colors={colors} />

          {/* Listings preview strip */}
          <View style={styles.listingStrip}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : listings.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>No yard sales nearby</Text>
            ) : (
              listings.slice(0, 6).map((l) => (
                <TouchableOpacity key={l.id} style={styles.listingItem} onPress={() => { setRegion({ ...region, latitude: Number(l.latitude), longitude: Number(l.longitude) }); setSelectedListing(l); }}>
                  <Text style={{ fontWeight: '700' }}>{l.title}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{l.address}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
          
          {/* Listing modal */}
          {selectedListing && (
            // Lazy load modal component
            <React.Suspense fallback={null}>
              {/* import locally to avoid circular / bundle issues */}
              <YardSaleListingModal listing={selectedListing} visible={!!selectedListing} onClose={() => setSelectedListing(null)} />
            </React.Suspense>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  floatingTopRight: { position: 'absolute', top: 100, right: 12 },
  radiusPill: { padding: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.12, elevation: 3 },
  presetBtn: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: 'transparent', marginLeft: 6 },
  floatingButton: { position: 'absolute', right: 12, bottom: 90, backgroundColor: '#192A4A', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#C8A25F', shadowColor: '#000', shadowOpacity: 0.3, elevation: 20, zIndex: 100 },
  floatingButtonText: { color: '#fff', fontWeight: '700', marginLeft: 8 },
  listingStrip: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 8, flexDirection: 'row', gap: 8, alignItems: 'center' },
  listingItem: { padding: 8, borderRadius: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', minWidth: 140 }
});


// Animated compact/expand post button component
function AnimatedPostButton({ onPress, isDark, colors }: { onPress: () => void; isDark: boolean; colors: any }) {
  const [expanded, setExpanded] = useState(true);
  const anim = useRef(new (require('react-native').Animated).Value(1)).current; // 1 = expanded, 0 = compact
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Start expanded then collapse after 3s
    timeoutRef.current = setTimeout(() => {
      setExpanded(false);
      (require('react-native').Animated).timing(anim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
    }, 3000);
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const expand = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setExpanded(true);
    (require('react-native').Animated).timing(anim, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  };

  const collapse = () => {
    // collapse after a short delay
    timeoutRef.current = setTimeout(() => {
      setExpanded(false);
      (require('react-native').Animated).timing(anim, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    }, 200);
  };

  const width = anim.interpolate({ inputRange: [0, 1], outputRange: [56, 160] });
  const textOpacity = anim;

  return (
    <require('react-native').Pressable
      onPress={onPress}
      onPressIn={expand}
      onPressOut={collapse}
      onMouseEnter={expand as any}
      onMouseLeave={collapse as any}
      style={{ position: 'absolute', right: 12, bottom: 90 }}
    >
      <require('react-native').Animated.View style={{ width, backgroundColor: '#192A4A', paddingVertical: 10, borderRadius: 28, borderWidth: 1, borderColor: '#C8A25F', alignItems: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 12, elevation: 20, zIndex: 100 }}>
        {/* Icon + small plus badge */}
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#1f3358', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="map-outline" size={16} color="#fff" />
          <View style={{ position: 'absolute', right: -2, top: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#C8A25F', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={12} color="#1a2335" />
          </View>
        </View>

        <require('react-native').Animated.View style={{ opacity: textOpacity, marginLeft: 8 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Post Yard Sale</Text>
        </require('react-native').Animated.View>
      </require('react-native').Animated.View>
    </require('react-native').Pressable>
  );
}
