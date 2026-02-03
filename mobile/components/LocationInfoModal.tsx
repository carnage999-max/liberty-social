import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { openInAppBrowser } from '../utils/inAppBrowser';

interface LocationInfoModalProps {
  visible: boolean;
  latitude: number;
  longitude: number;
  onClose: () => void;
  colors: any;
}

export default function LocationInfoModal({
  visible,
  latitude,
  longitude,
  onClose,
  colors,
}: LocationInfoModalProps) {
  const openDirections = (lat: number, lon: number) => {
    const url = Platform.select({
      ios: `maps://app?daddr=${lat},${lon}`,
      android: `google.navigation:q=${lat},${lon}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`,
    });
    if (url) {
      if (url.startsWith('http')) {
        openInAppBrowser(url);
      } else {
        Linking.openURL(url).catch(() => null);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    require('react-native').Clipboard.setString(text);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>📍 Your Location</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Latitude</Text>
              <View style={styles.valueRow}>
                <Text style={[styles.value, { color: colors.text }]}>
                  {latitude.toFixed(4)}°
                </Text>
                <TouchableOpacity
                  style={[styles.copyBtn, { backgroundColor: colors.primary + '20' }]}
                  onPress={() => copyToClipboard(latitude.toFixed(4))}
                >
                  <Ionicons name="copy" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Longitude</Text>
              <View style={styles.valueRow}>
                <Text style={[styles.value, { color: colors.text }]}>
                  {longitude.toFixed(4)}°
                </Text>
                <TouchableOpacity
                  style={[styles.copyBtn, { backgroundColor: colors.primary + '20' }]}
                  onPress={() => copyToClipboard(longitude.toFixed(4))}
                >
                  <Ionicons name="copy" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Coordinates</Text>
              <View style={styles.valueRow}>
                <Text style={[styles.value, { color: colors.text }]}>
                  {latitude.toFixed(4)}, {longitude.toFixed(4)}
                </Text>
                <TouchableOpacity
                  style={[styles.copyBtn, { backgroundColor: colors.primary + '20' }]}
                  onPress={() =>
                    copyToClipboard(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`)
                  }
                >
                  <Ionicons name="copy" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={() => openDirections(latitude, longitude)}
            >
              <Ionicons name="navigate" size={18} color="#fff" />
              <Text style={styles.actionText}>Get Directions</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Tap on any value to copy it to clipboard
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  infoSection: {
    gap: 16,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    fontFamily: 'monospace',
  },
  copyBtn: {
    padding: 6,
    borderRadius: 6,
  },
  actionsRow: {
    gap: 8,
    marginBottom: 16,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontWeight: '700',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 12,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
});
