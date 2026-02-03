import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../contexts/ThemeContext';
import { extractFirstUrl, fetchLinkPreview, type LinkPreviewData } from '../../utils/linkPreview';
import LinkifiedText from './LinkifiedText';

const previewCache = new Map<string, LinkPreviewData | null>();

type LinkPreviewCardProps = {
  text?: string | null;
};

export default function LinkPreviewCard({ text }: LinkPreviewCardProps) {
  const { colors, isDark } = useTheme();
  const url = useMemo(() => extractFirstUrl(text), [text]);
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!url) return;
      if (previewCache.has(url)) {
        const cached = previewCache.get(url) || null;
        if (cached) {
          setData(cached);
          return;
        }
      }
      setLoading(true);
      const result = await fetchLinkPreview(url);
      if (result) {
        previewCache.set(url, result);
      }
      if (mounted) {
        setData(result);
        setLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, [url]);

  if (!url || (!data && !loading)) {
    return null;
  }

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
          borderColor: colors.border,
        },
      ]}
    >
      {data?.image ? (
        <Image source={{ uri: data.image }} style={styles.image} contentFit="cover" />
      ) : (
        <View style={[styles.imageFallback, { backgroundColor: colors.border }]}>
          <Ionicons name="link-outline" size={20} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {data?.title || url}
        </Text>
        {data?.description ? (
          <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={2}>
            {data.description}
          </Text>
        ) : null}
        <LinkifiedText
          text={url}
          textStyle={[styles.url, { color: colors.textSecondary }]}
          linkStyle={{ color: '#3B82F6', textDecorationLine: 'underline' }}
          numberOfLines={1}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  image: {
    width: 90,
    height: 90,
  },
  imageFallback: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 10,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
  },
  url: {
    fontSize: 11,
  },
});
