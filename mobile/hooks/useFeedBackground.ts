import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type FeedBackgroundType = 
  | "default"
  | "american"
  | "christmas"
  | "halloween"
  | "clouds"
  | "nature"
  | "space"
  | "ocean"
  | "forest"
  | "sunset"
  | "stars"
  | "butterflies"
  | "dragons"
  | "christmas-trees"
  | "music-notes"
  | "pixel-hearts"
  | string; // For custom image/video URLs

const STORAGE_KEY = '@feed_background_theme';

export function useFeedBackground() {
  const [theme, setTheme] = useState<FeedBackgroundType>('default');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load saved theme from storage
    AsyncStorage.getItem(STORAGE_KEY)
      .then((savedTheme: string | null) => {
        if (savedTheme) {
          setTheme(savedTheme);
        }
        setMounted(true);
      })
      .catch(() => {
        setMounted(true);
      });
  }, []);

  const changeTheme = async (newTheme: FeedBackgroundType) => {
    console.log('Changing theme to:', newTheme);
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newTheme);
      console.log('Theme saved successfully:', newTheme);
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  return {
    theme,
    changeTheme,
    mounted,
  };
}
