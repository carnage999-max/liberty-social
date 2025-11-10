import { Slot } from 'expo-router';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';
import { AuthProvider } from '../contexts/AuthContext';
import { AlertProvider } from '../contexts/AlertContext';
import { ToastProvider } from '../contexts/ToastContext';
import { StatusBar } from 'expo-status-bar';

function RootLayoutNav() {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AlertProvider>
          <ToastProvider>
            <RootLayoutNav />
          </ToastProvider>
        </AlertProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

