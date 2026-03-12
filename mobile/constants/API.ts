// Update this with your backend URL
// For local development, use your machine's IP address or localhost
// For Android emulator, use 10.0.2.2 instead of localhost
// For iOS simulator, use localhost or your machine's IP

export const API_BASE = 'https://api.mylibertysocial.com/api';

// Use the configured API base in all environments when provided. This keeps
// EAS builds and local development aligned instead of hardcoding production.
export const getApiBase = () => {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL.replace(/\/$/, '');
  }
  return API_BASE;
};

export const getWsBase = () => {
  if (process.env.EXPO_PUBLIC_WS_BASE_URL) {
    return process.env.EXPO_PUBLIC_WS_BASE_URL
      .replace(/\/$/, '')
      .replace(/\/ws\/notifications\/?$/, '')
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://');
  }

  return getApiBase()
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://')
    .replace(/\/api\/?$/, '');
};
