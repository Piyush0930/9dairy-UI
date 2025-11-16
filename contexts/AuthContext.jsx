// contexts/AuthContext.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

// Storage keys (single source of truth)
const SECURE_TOKEN_KEY = 'userToken';
const ASYNC_TOKEN_KEY = 'authtoken';
const ASYNC_USER_KEY = 'userData';

export function AuthProvider({ children }) {
  const router = useRouter();

  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // "initializing" / "isLoading" indicates we are still reading storage
  const [initializing, setInitializing] = useState(true);

  // run once to load saved auth
  useEffect(() => {
    checkAuthState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkAuthState() {
    try {
      console.log('🔐 Checking auth state...');
      const [secureToken, storedUserJson, asyncToken] = await Promise.all([
        SecureStore.getItemAsync(SECURE_TOKEN_KEY),
        AsyncStorage.getItem(ASYNC_USER_KEY),
        AsyncStorage.getItem(ASYNC_TOKEN_KEY),
      ]);

      const token = secureToken || asyncToken || null;
      const userData = storedUserJson ? JSON.parse(storedUserJson) : null;

      console.log('📱 Auth check results:', { token: !!token, userData: !!userData });

      if (token && userData) {
        // normalize role to avoid case mismatch
        const normalizedUser = { ...userData, role: String(userData.role || '').toLowerCase() };

        setAuthToken(token);
        setUser(normalizedUser);
        setIsAuthenticated(true);

        console.log('✅ User authenticated from storage');
        console.log('👤 User role from storage:', normalizedUser.role);

        // NOTE: redirect to precise dashboard routes
        if (normalizedUser.role === 'admin') {
          router.replace('/(admin)/index');
        } else if (normalizedUser.role === 'superadmin') {
          router.replace('/supadmin/dashboard');
        } else {
          router.replace('/(tabs)/index');
        }
      } else {
        console.log('❌ No valid auth data found');
        setUser(null);
        setAuthToken(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('❌ Error checking auth state:', error);
      await clearAuthData();
      setUser(null);
      setAuthToken(null);
      setIsAuthenticated(false);
    } finally {
      setInitializing(false); // important: signal that init finished
    }
  }

  const login = async (userData, token) => {
    try {
      console.log('🔐 Starting login process...');
      const normalizedUser = { ...userData, role: String(userData?.role || '').toLowerCase() };

      // update in-memory state first
      setUser(normalizedUser);
      setAuthToken(token);
      setIsAuthenticated(true);

      // persist to secure storage + async fallback
      await Promise.all([
        SecureStore.setItemAsync(SECURE_TOKEN_KEY, token),
        AsyncStorage.setItem(ASYNC_TOKEN_KEY, token),
        AsyncStorage.setItem(ASYNC_USER_KEY, JSON.stringify(normalizedUser)),
      ]);

      console.log('✅ Login successful, state updated');
      console.log('👤 User role:', normalizedUser.role);

      // role-based routing (precise dashboard paths)
      if (normalizedUser.role === 'admin') {
        router.replace('/(admin)/index');
      } else if (normalizedUser.role === 'superadmin') {
        router.replace('/(supadmin)/dashboard');
      } else {
        router.replace('/(tabs)/index');
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      // rollback
      setUser(null);
      setAuthToken(null);
      setIsAuthenticated(false);
      throw new Error('Failed to save login data');
    }
  };

  const clearAuthData = async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(SECURE_TOKEN_KEY),
        AsyncStorage.removeItem(ASYNC_TOKEN_KEY),
        AsyncStorage.removeItem(ASYNC_USER_KEY),
      ]);
      console.log('🧹 Auth data cleared');
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      setAuthToken(null);
      setIsAuthenticated(false);
      await clearAuthData();
      console.log('👋 Logout successful');
      router.replace('/Login');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const validateToken = async () => {
    try {
      const token = authToken || (await SecureStore.getItemAsync(SECURE_TOKEN_KEY)) || (await AsyncStorage.getItem(ASYNC_TOKEN_KEY));
      if (!token) return false;
      // optional: call backend to verify
      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  };

  const getAuthHeaders = async () => {
    try {
      const token = authToken || (await SecureStore.getItemAsync(SECURE_TOKEN_KEY)) || (await AsyncStorage.getItem(ASYNC_TOKEN_KEY));
      if (token) {
        return {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };
      }
      return { 'Content-Type': 'application/json' };
    } catch (error) {
      console.error('Error getting auth headers:', error);
      return { 'Content-Type': 'application/json' };
    }
  };

  const updateUser = async (updatedUserData) => {
    try {
      const normalizedUser = { ...updatedUserData, role: String(updatedUserData.role || '').toLowerCase() };
      setUser(normalizedUser);
      await AsyncStorage.setItem(ASYNC_USER_KEY, JSON.stringify(normalizedUser));
    } catch (error) {
      console.error('Error updating user data:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authToken,
        isAuthenticated,
        isLoading: initializing, // other components expect isLoading
        login,
        logout,
        validateToken,
        getAuthHeaders,
        updateUser,
        checkAuthState, // only if you need manual re-check
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
