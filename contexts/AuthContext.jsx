import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [authToken, setAuthToken] = useState(null);
  const [userData, setUserData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize auth state on app start
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const [token, user] = await Promise.all([
          AsyncStorage.getItem('authToken'),
          AsyncStorage.getItem('userData')
        ]);

        if (token && user) {
          const parsedUser = JSON.parse(user);
          // Check if token is expired
          if (isTokenExpired(parsedUser)) {
            await clearAuthData();
          } else {
            setAuthToken(token);
            setUserData(parsedUser);
            setIsAuthenticated(true);
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Clear potentially corrupted data
        await clearAuthData();
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const clearAuthData = useCallback(async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem('authToken'),
        AsyncStorage.removeItem('userData')
      ]);
      setAuthToken(null);
      setUserData(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  }, []);

  const login = useCallback(async (token, user) => {
    try {
      await Promise.all([
        AsyncStorage.setItem('authToken', token),
        AsyncStorage.setItem('userData', JSON.stringify(user))
      ]);
      setAuthToken(token);
      setUserData(user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Login storage error:', error);
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
    await clearAuthData();
  }, [clearAuthData]);

  const updateUserData = useCallback(async (newUserData) => {
    try {
      const updatedUser = { ...userData, ...newUserData };
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));
      setUserData(updatedUser);
    } catch (error) {
      console.error('Update user data error:', error);
      throw error;
    }
  }, [userData]);

  const getAuthHeaders = useCallback(() => {
    if (!authToken) return {};
    return {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };
  }, [authToken]);

  const isTokenExpired = useCallback(() => {
    if (!userData?.tokenExpiry) return false;
    return new Date() > new Date(userData.tokenExpiry);
  }, [userData]);

  const validateToken = useCallback(async () => {
    if (!authToken || isTokenExpired()) {
      await logout();
      return false;
    }

    try {
      // Optional: Add a lightweight token validation endpoint
      // const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/validate`, {
      //   headers: getAuthHeaders()
      // });
      // return response.ok;

      return true; // Assume valid if not expired
    } catch (error) {
      console.error('Token validation error:', error);
      await logout();
      return false;
    }
  }, [authToken, isTokenExpired, logout, getAuthHeaders]);

  return (
    <AuthContext.Provider value={{
      // State
      authToken,
      userData,
      isLoading,
      isAuthenticated,

      // Methods
      login,
      logout,
      updateUserData,
      getAuthHeaders,
      validateToken,
      clearAuthData,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
