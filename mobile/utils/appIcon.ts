import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const STORAGE_KEY = 'app_icon_preference';

type IconColor = 'white' | 'blue';
type IconShape = 'square' | 'round';

export type AppIconPreference = {
  color: IconColor;
  shape: IconShape;
};

const DEFAULT_PREFERENCE: AppIconPreference = {
  color: 'white',
  shape: 'square',
};

const getIconKey = (preference: AppIconPreference) => {
  if (Platform.OS === 'ios') {
    // iOS ignores shape, keep color only.
    return preference.color;
  }
  return preference.shape === 'round'
    ? `${preference.color}_round`
    : preference.color;
};

const getDynamicModule = () => {
  try {
    if (Constants.appOwnership === 'expo') {
      return null;
    }
    const moduleName = 'expo-dynamic-app-icon';
    const dynamicRequire = require;
    return dynamicRequire(moduleName);
  } catch (error) {
    return null;
  }
};

export const loadAppIconPreference = async (): Promise<AppIconPreference> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_PREFERENCE;
  try {
    const parsed = JSON.parse(raw) as AppIconPreference;
    if (!parsed || !parsed.color || !parsed.shape) {
      return DEFAULT_PREFERENCE;
    }
    return parsed;
  } catch (error) {
    return DEFAULT_PREFERENCE;
  }
};

export const saveAppIconPreference = async (preference: AppIconPreference) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
};

export const applyAppIconPreference = async (preference: AppIconPreference) => {
  const module = getDynamicModule();
  const iconKey = getIconKey(preference);
  if (module?.setAppIconAsync) {
    await module.setAppIconAsync(iconKey);
    return;
  }
  if (module?.setAppIcon) {
    await module.setAppIcon(iconKey);
    return;
  }
  // If the module is missing, just store preference for later.
};
