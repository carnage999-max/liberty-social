import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Metallic colors based on spec
const COLOR_GOLD_DARK = '#a8862a';
const COLOR_GOLD_LIGHT = '#d7b756';
const COLOR_SILVER_DARK = '#c8c8c8';
const COLOR_SILVER_LIGHT = '#f0f0f0';
const COLOR_DEEP_NAVY = '#1D2B4F';
const COLOR_DEEPER_NAVY = '#121A33';

export default function WelcomeScreen() {
  return (
    <LinearGradient
      colors={[COLOR_DEEPER_NAVY, COLOR_DEEP_NAVY, '#2D3E5F', '#3A4A6B']}
      locations={[0, 0.4, 0.7, 1]}
      style={styles.container}
    >
      {/* Logo Section */}
      <View style={styles.logoSection}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.brandName}>Liberty Social</Text>
        <Text style={styles.tagline}>Connect. Share. Thrive.</Text>
      </View>

      {/* Features Section */}
      <View style={styles.featuresSection}>
        <FeatureItem
          icon="chatbubbles"
          title="Connect with Friends"
          description="Stay in touch with people you care about"
        />
        <FeatureItem
          icon="images"
          title="Share Your Moments"
          description="Post photos, videos, and stories"
        />
        <FeatureItem
          icon="globe"
          title="Explore the World"
          description="Discover new content and communities"
        />
      </View>

      {/* Buttons Section */}
      <View style={styles.buttonSection}>
        {/* Metallic Gold Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/(auth)?mode=register')}
        >
          <LinearGradient
            colors={[COLOR_GOLD_DARK, COLOR_GOLD_LIGHT, COLOR_GOLD_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.metallicButton}
          >
            <View style={styles.buttonInner}>
              <View style={styles.buttonContent}>
                <Ionicons name="rocket" size={20} color="#192A4A" />
                <Text style={styles.metallicButtonText}>GET STARTED</Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Metallic Silver Button */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/(auth)?mode=login')}
        >
          <LinearGradient
            colors={[COLOR_SILVER_DARK, COLOR_SILVER_LIGHT, COLOR_SILVER_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.metallicButton}
          >
            <View style={styles.buttonInner}>
              <View style={styles.buttonContent}>
                <Ionicons name="log-in" size={20} color="#1a2335" />
                <Text style={[styles.metallicButtonText, styles.silverText]}>
                  I ALREADY HAVE AN ACCOUNT
                </Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          By continuing, you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </LinearGradient>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconContainer}>
        <Ionicons name={icon} size={24} color={COLOR_GOLD_LIGHT} />
      </View>
      <View style={styles.featureTextContainer}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 60,
  },
  logoContainer: {
    width: 120,
    height: 120,
    marginBottom: 20,
    shadowColor: COLOR_GOLD_LIGHT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
    borderRadius: 30,
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '400',
  },
  featuresSection: {
    flex: 1,
    justifyContent: 'center',
    gap: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  featureIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(200, 162, 95, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(200, 162, 95, 0.3)',
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  buttonSection: {
    gap: 16,
    marginTop: 20,
  },
  // Metallic button styles based on spec
  metallicButton: {
    borderRadius: 18,
    padding: 4, // Outer padding for bevel effect
    shadowColor: 'rgba(0, 0, 0, 0.5)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 8,
  },
  buttonInner: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    // Inner bevel effect
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  metallicButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#192A4A', // Dark navy for gold buttons
    textTransform: 'uppercase',
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  silverText: {
    color: '#1a2335', // Slightly different dark for silver
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 18,
  },
});
