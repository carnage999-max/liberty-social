import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function YardSaleListingModal({ listing, visible, onClose }: any) {
  if (!listing) return null;

  const openDirections = (lat: number, lon: number) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lon}`,
      android: `google.navigation:q=${lat},${lon}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
    });
    if (url) Linking.openURL(url).catch(() => null);
  };

  const callPhone = (phone?: string | null) => {
    if (!phone) return;
    const url = `tel:${phone}`;
    Linking.openURL(url).catch(() => null);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{listing.title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <Text style={styles.address}>{listing.address}</Text>
          <Text style={styles.meta}>{listing.start_date} — {listing.end_date} • {listing.hours}</Text>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#192A4A' }]} onPress={() => openDirections(listing.latitude, listing.longitude)}>
              <Ionicons name="navigate" size={18} color="#fff" />
              <Text style={styles.actionText}>Directions</Text>
            </TouchableOpacity>
            {listing.phone ? (
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#2E7D32' }]} onPress={() => callPhone(listing.phone)}>
                <Ionicons name="call" size={18} color="#fff" />
                <Text style={styles.actionText}>Call</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Posted by: {listing.user?.username ?? 'User'}</Text>
            <Text style={styles.footerText}>Price paid: ${listing.price_paid ?? '0.99'}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  container: { backgroundColor: '#fff', padding: 16, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 6 },
  address: { color: '#444', marginTop: 8 },
  meta: { color: '#666', marginTop: 6, fontSize: 13 },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 8 },
  actionText: { color: '#fff', marginLeft: 8, fontWeight: '700' },
  footer: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { color: '#666', fontSize: 12 }
});
