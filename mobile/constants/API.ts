// Update this with your backend URL
// For local development, use your machine's IP address or localhost
// For Android emulator, use 10.0.2.2 instead of localhost
// For iOS simulator, use localhost or your machine's IP

export const API_BASE = 'https://yyhfmnzpfk.us-east-1.awsapprunner.com/api';

// Helper to get the correct API base for mobile emulators
export const getApiBase = () => {
  if (__DEV__) {
    // Android emulator uses 10.0.2.2 to access host machine
    if (process.env.EXPO_PUBLIC_API_BASE_URL) {
      return process.env.EXPO_PUBLIC_API_BASE_URL.replace(/\/$/, '');
    }
    return API_BASE;
  }
  return API_BASE;
};
