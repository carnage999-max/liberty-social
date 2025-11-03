import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthTokens } from '../types';
import { storage } from '../utils/storage';
import { apiClient } from '../utils/api';

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (tokens: AuthTokens, userData?: User) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      const token = await storage.getAccessToken();
      const userId = await storage.getUserId();
      
      if (token && userId) {
        setAccessToken(token);
        // Fetch user data
        try {
          const userData = await apiClient.get<User>(`/auth/user/${userId}/`);
          setUser(userData);
        } catch (error) {
          // Token might be invalid, clear storage
          await storage.clearTokens();
        }
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (tokens: AuthTokens, userData?: User) => {
    await storage.setAccessToken(tokens.access_token);
    await storage.setRefreshToken(tokens.refresh_token);
    await storage.setUserId(tokens.user_id);
    setAccessToken(tokens.access_token);

    try {
      const resolvedUser =
        userData ?? (await apiClient.get<User>(`/auth/user/${tokens.user_id}/`));
      setUser(resolvedUser);
    } catch (error) {
      await storage.clearTokens();
      setAccessToken(null);
      setUser(null);
      throw error;
    }
  };

  const logout = async () => {
    await storage.clearTokens();
    setAccessToken(null);
    setUser(null);
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        isAuthenticated: !!user && !!accessToken,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
