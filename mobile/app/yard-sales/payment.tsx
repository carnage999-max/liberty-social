import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient } from '../../utils/api';
import { useTheme } from '../../../mobile/contexts/ThemeContext';
import { useStripe } from '@stripe/stripe-react-native';

export default function YardSalePayment() {
  const { payload } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  useEffect(() => {
    if (!payload) return;
    try {
      const payloadStr = Array.isArray(payload) ? payload[0] : payload;
      setData(JSON.parse(decodeURIComponent(payloadStr)));
    } catch (e) {
      console.error('Invalid payload', e);
    }
  }, [payload]);

  const setupPaymentSheet = async () => {
    if (!data) return null;
    try {
      setLoading(true);
      // Create a PaymentIntent on the backend
      const res = await apiClient.post<{
        client_secret: string;
        intent_id: string;
      }>('/yard-sales/create-payment-intent/', {
        metadata: { payload: JSON.stringify(data) },
      });

      console.log('Payment intent response:', res);

      const { client_secret, intent_id } = res;

      if (!client_secret) {
        throw new Error('client_secret not found in response: ' + JSON.stringify(res));
      }

      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: client_secret,
        merchantDisplayName: 'Liberty Social',
      });

      setLoading(false);
      if (initError) throw initError;

      return intent_id;
    } catch (err: any) {
      setLoading(false);
      console.error('Setup PaymentSheet error', err.response?.data || err.message || err);
      Alert.alert('Error', err?.message || 'Unable to initialize payment');
      return null;
    }
  };

  const handlePay = async () => {
    if (!data) return;
    setLoading(true);
    try {
      const intentId = await setupPaymentSheet();
      if (!intentId) return;

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        setLoading(false);
        console.error('PaymentSheet present error', presentError);
        Alert.alert('Payment failed', presentError.message || 'Unable to complete payment');
        return;
      }

      // After success, confirm on backend: send payment_intent_id and payload to create listing
      console.log('Confirming payment with intentId:', intentId);
      const confirmRes = await apiClient.post('/yard-sales/confirm-payment/', {
        payment_intent_id: intentId,
        payload: data,
      });

      console.log('Payment confirmed, response:', confirmRes);
      setLoading(false);
      
      // Redirect immediately, then show success alert
      router.replace('/(tabs)/yard-sales');
      Alert.alert('Success', 'Your yard sale is now live');
    } catch (err: any) {
      setLoading(false);
      console.error('Payment/create error', err.response?.data || err.message || err);
      Alert.alert('Error', err?.response?.data?.error || err?.message || 'Payment confirmation failed');
    }
  };

  if (!data) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Preparing payment...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Text style={[styles.h1, { color: colors.text }]}>Pay $0.99 to Post</Text>

      <View style={{ padding: 12, backgroundColor: colors.backgroundSecondary, borderRadius: 8, marginTop: 12 }}>
        <Text style={{ fontWeight: '700', marginBottom: 6, color: colors.text }}>{data.title}</Text>
        <Text style={{ color: colors.textSecondary }}>{data.address}</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 6 }}>{data.start_date} — {data.end_date}</Text>
      </View>

      <TouchableOpacity style={[styles.payBtn, { backgroundColor: '#192A4A', borderColor: '#C8A25F' }]} onPress={handlePay} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>Pay $0.99 & Post</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  h1: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  payBtn: { marginTop: 16, padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  payText: { color: '#fff', fontWeight: '800' }
});