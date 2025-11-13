// contexts/AuthContext.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState(null);

  useEffect(() => {
    checkAuthState();
  }, []);

const checkAuthState = async () => {
  try {
    console.log('🔐 Checking auth state...');
    
    const [token, userData] = await Promise.all([
      SecureStore.getItemAsync('userToken'),
      AsyncStorage.getItem('userData'),
    ]);
    
    console.log('📱 Auth check results:', { token: !!token, userData: !!userData });
    
    if (token && userData) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      setAuthToken(token);
      setIsAuthenticated(true);
      console.log('✅ User authenticated from storage');
      console.log('👤 User role from storage:', parsedUser.role);
      
      // ✅ CORRECTED: Proper role-based routing
      if (parsedUser.role === 'admin') {
        console.log('🔧 Admin user detected, redirecting to ADMIN app...');
        router.replace('/(admin)');
      } else if (parsedUser.role === 'superadmin') {
        console.log('👑 SuperAdmin detected, redirecting to SUPERADMIN dashboard...');
        router.replace('/supadmin'); // 👈 SUPERADMIN ROUTE
      } else {
        console.log('🛒 Customer user detected, redirecting to CUSTOMER app...');
        router.replace('/(tabs)');
      }
      
    } else {
      console.log('❌ No valid auth data found');
      setIsAuthenticated(false);
    }
  } catch (error) {
    console.error('❌ Error checking auth state:', error);
    await clearAuthData();
  } finally {
    setLoading(false);
  }
};

const login = async (userData, token) => {
  try {
    console.log('🔐 Starting login process...');
    
    // First update the state synchronously
    setUser(userData);
    setAuthToken(token);
    setIsAuthenticated(true);
    
    // Then save to storage
    await Promise.all([
      SecureStore.setItemAsync('userToken', token),
      AsyncStorage.setItem('userData', JSON.stringify(userData)),
    ]);
    
    console.log('✅ Login successful, state updated');
    console.log('👤 User role:', userData.role);
    
    // ✅ CORRECTED: Same routing logic as checkAuthState
    if (userData.role === 'admin') {
      console.log('🔧 Admin user detected, redirecting to ADMIN app...');
      router.replace('/(admin)');
    } else if (userData.role === 'superadmin') {
      console.log('👑 SuperAdmin detected, redirecting to SUPERADMIN dashboard...');
      router.replace('/supadmin'); // 👈 SUPERADMIN ROUTE
    } else {
      console.log('🛒 Customer user detected, redirecting to CUSTOMER app...');
      router.replace('/(tabs)');
    }
    
  } catch (error) {
    console.error('❌ Login error:', error);
    // Rollback state on error
    setUser(null);
    setAuthToken(null);
    setIsAuthenticated(false);
    throw new Error('Failed to save login data');
  }
};

  const clearAuthData = async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync('userToken'),
        AsyncStorage.removeItem('userData'),
      ]);
      setAuthToken(null);
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
      const token = await SecureStore.getItemAsync('userToken');
      if (!token) return false;
      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  };

  const getAuthHeaders = async () => {
    try {
      const token = await SecureStore.getItemAsync('userToken');
      return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    } catch (error) {
      console.error('Error getting auth headers:', error);
      return { 'Content-Type': 'application/json' };
    }
  };

  const updateUser = async (updatedUserData) => {
    try {
      setUser(updatedUserData);
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUserData));
    } catch (error) {
      console.error('Error updating user data:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        loading,
        authToken,
        login,
        logout,
        validateToken,
        getAuthHeaders,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};