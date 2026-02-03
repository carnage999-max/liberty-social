import React, { useMemo, useState } from 'react';
import { Modal, Text, TextStyle, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Linking } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useToast } from '../../contexts/ToastContext';
import { openInAppBrowser } from '../../utils/inAppBrowser';

type LinkifiedTextProps = {
  text: string;
  textStyle?: TextStyle | TextStyle[];
  linkStyle?: TextStyle | TextStyle[];
  numberOfLines?: number;
};

type Segment =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string }
  | { type: 'email'; value: string; href: string }
  | { type: 'phone'; value: string; href: string };

const EMAIL_REGEX = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_REGEX = /\+?\d[\d\s\-().]{6,}\d/;
const URL_REGEX =
  /((https?:\/\/|www\.)[^\s/$.?#].[^\s]*)|(([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?)/i;

const buildSegments = (input: string): Segment[] => {
  if (!input) return [];
  const segments: Segment[] = [];
  let lastIndex = 0;
  const regex = new RegExp(
    `(${EMAIL_REGEX.source})|(${PHONE_REGEX.source})|(${URL_REGEX.source})`,
    'gi'
  );

  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    const raw = match[1] || match[2] || match[3];
    if (!raw) continue;
    const index = match.index;
    if (index > lastIndex) {
      segments.push({ type: 'text', value: input.slice(lastIndex, index) });
    }
    if (EMAIL_REGEX.test(raw)) {
      segments.push({ type: 'email', value: raw, href: `mailto:${raw}` });
    } else if (PHONE_REGEX.test(raw)) {
      const cleaned = raw.replace(/[^\d+]/g, '');
      segments.push({ type: 'phone', value: raw, href: `tel:${cleaned}` });
    } else {
      const href = raw.startsWith('http') ? raw : `https://${raw}`;
      segments.push({ type: 'link', value: raw, href });
    }
    lastIndex = index + raw.length;
  }
  if (lastIndex < input.length) {
    segments.push({ type: 'text', value: input.slice(lastIndex) });
  }
  return segments;
};

export default function LinkifiedText({
  text,
  textStyle,
  linkStyle,
  numberOfLines,
}: LinkifiedTextProps) {
  const { colors, isDark } = useTheme();
  const { showSuccess } = useToast();
  const segments = useMemo(() => buildSegments(text), [text]);
  const [action, setAction] = useState<null | {
    type: 'link' | 'email' | 'phone';
    value: string;
    href: string;
  }>(null);

  if (!text) return null;

  return (
    <>
      <Text style={textStyle} numberOfLines={numberOfLines}>
        {segments.map((segment, index) => {
          if (segment.type === 'text') {
            return <Text key={`text-${index}`}>{segment.value}</Text>;
          }
          return (
            <Text
              key={`link-${index}`}
              style={linkStyle}
              onPress={() => setAction({ type: segment.type, value: segment.value, href: segment.href })}
              suppressHighlighting
            >
              {segment.value}
            </Text>
          );
        })}
      </Text>
      <Modal
        visible={!!action}
        transparent
        animationType="slide"
        onRequestClose={() => setAction(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
          activeOpacity={1}
          onPress={() => setAction(null)}
        />
        <View
          style={{
            backgroundColor: isDark ? colors.backgroundSecondary : '#FFFFFF',
            padding: 16,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 12 }}>
            {action?.value}
          </Text>
          <View style={{ gap: 10 }}>
            <TouchableOpacity
              style={{
                paddingVertical: 12,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
              }}
              onPress={async () => {
                if (!action) return;
                await Clipboard.setStringAsync(action.value);
                showSuccess(
                  action.type === 'email'
                    ? 'Email copied'
                    : action.type === 'phone'
                    ? 'Phone number copied'
                    : 'Link copied'
                );
                setAction(null);
              }}
            >
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                {action?.type === 'email'
                  ? 'Copy email'
                  : action?.type === 'phone'
                  ? 'Copy phone'
                  : 'Copy link'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                paddingVertical: 12,
                borderRadius: 12,
                backgroundColor: '#192A4A',
                borderWidth: 1,
                borderColor: '#C8A25F',
                alignItems: 'center',
              }}
              onPress={async () => {
                if (!action) return;
                if (action.type === 'email' || action.type === 'phone') {
                  await Linking.openURL(action.href);
                } else {
                  await openInAppBrowser(action.href);
                }
                setAction(null);
              }}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>
                {action?.type === 'email'
                  ? 'Open email app'
                  : action?.type === 'phone'
                  ? 'Call number'
                  : 'Open link'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                paddingVertical: 10,
                alignItems: 'center',
              }}
              onPress={() => setAction(null)}
            >
              <Text style={{ color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
