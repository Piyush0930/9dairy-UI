// contexts/AuthContext.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useRef, useState } from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Changed from 'loading' to 'isLoading'
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState(null);

  // Single ref to track redirects across the app
  const hasRedirected = useRef(false);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      console.log("🔐 Checking auth state...");

      const [token, userData] = await Promise.all([
        SecureStore.getItemAsync("userToken"),
        AsyncStorage.getItem("userData"),
      ]);

      console.log("📱 Auth check results:", { 
        token: !!token, 
        userData: !!userData 
      });

      if (token && userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setAuthToken(token);
        setIsAuthenticated(true);
        console.log("✅ User authenticated from storage");
        console.log("👤 User role from storage:", parsedUser.role);
        
        // Note: Navigation is handled by NavigationHandler
      } else {
        console.log("❌ No valid auth data found");
        setIsAuthenticated(false);
        // Clear any partial/invalid data
        await clearAuthData();
      }
    } catch (error) {
      console.error("❌ Error checking auth state:", error);
      await clearAuthData();
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (userData, token) => {
    try {
      console.log("🔐 Starting login process...");

      // Reset redirect guard for new login
      hasRedirected.current = false;

      // Update state immediately
      setUser(userData);
      setAuthToken(token);
      setIsAuthenticated(true);

      // Persist to storage
      await Promise.all([
        SecureStore.setItemAsync("userToken", token),
        AsyncStorage.setItem("userData", JSON.stringify(userData)),
      ]);

      console.log("✅ Login successful, state updated");
      console.log("👤 User role:", userData.role);

      // Navigation will be handled by NavigationHandler
      // This prevents double redirects
      
    } catch (error) {
      console.error("❌ Login error:", error);
      // Rollback state on error
      await clearAuthData();
      setUser(null);
      setAuthToken(null);
      setIsAuthenticated(false);
      throw new Error("Failed to save login data");
    }
  };

  const clearAuthData = async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync("userToken"),
        AsyncStorage.removeItem("userData"),
      ]);
      setAuthToken(null);
      console.log("🧹 Auth data cleared");
    } catch (error) {
      console.error("Error clearing auth data:", error);
    }
  };

  const logout = async () => {
    try {
      // Reset redirect guard
      hasRedirected.current = false;

      setUser(null);
      setAuthToken(null);
      setIsAuthenticated(false);
      await clearAuthData();
      console.log("👋 Logout successful");

      // Navigate to login
      router.replace("/Login");
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  const validateToken = async () => {
    try {
      const token = await SecureStore.getItemAsync("userToken");
      if (!token) return false;
      
      // Add your token validation logic here
      // For now, just check existence
      return true;
    } catch (error) {
      console.error("Token validation error:", error);
      return false;
    }
  };

  const getAuthHeaders = async () => {
    try {
      const token = await SecureStore.getItemAsync("userToken");
      return {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };
    } catch (error) {
      console.error("Error getting auth headers:", error);
      return { "Content-Type": "application/json" };
    }
  };

  const updateUser = async (updatedUserData) => {
    try {
      setUser(updatedUserData);
      await AsyncStorage.setItem("userData", JSON.stringify(updatedUserData));
    } catch (error) {
      console.error("Error updating user data:", error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading, // Consistent naming
        authToken,
        login,
        logout,
        validateToken,
        getAuthHeaders,
        updateUser,
        hasRedirected, // Expose the ref for NavigationHandler
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};