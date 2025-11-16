// contexts/ProfileContext.js - ASKS LOCATION EVERY TIME ON APP OPEN AND LOGIN
import React, { createContext, useState, useContext, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LocationService } from "@/services/locationService";
import * as Location from 'expo-location';
import { AppState } from 'react-native';

const ProfileContext = createContext();
export const useProfile = () => useContext(ProfileContext);

export const ProfileProvider = ({ children }) => {
  const { user, authToken, isAuthenticated, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [assignedRetailer, setAssignedRetailer] = useState(null);

  // ⭐ NEW: store if user used current location OR skipped
  const [usedLocationType, setUsedLocationType] = useState("signup"); 
  const [cartItemsStatus, setCartItemsStatus] = useState([]);

  const hasInitializedFromProfile = useRef(false);
  const appState = useRef(AppState.currentState);
  const lastLocationRequestTime = useRef(0); // ⭐ NEW: Track last request time

  // ---------------------------------------------------
  // NORMALIZE LOCATION
  // ---------------------------------------------------
  const updateCurrentLocation = (loc) => {
    const lat =
      loc?.coordinates?.latitude ??
      loc?.coords?.latitude ??
      loc?.latitude ??
      null;

    const lon =
      loc?.coordinates?.longitude ??
      loc?.coords?.longitude ??
      loc?.longitude ??
      null;

    setCurrentLocation({
      latitude: Number(lat),
      longitude: Number(lon),
      formattedAddress:
        loc?.formattedAddress ||
        loc?.address ||
        loc?.name ||
        "Current Location",
    });
  };

  // ---------------------------------------------------
  // UPDATE LOCATION AND RETAILER (NEW FUNCTION)
  // ---------------------------------------------------
  const updateLocationAndRetailer = (location, retailer, locationType) => {
    setCurrentLocation(location);
    setAssignedRetailer(retailer);
    setUsedLocationType(locationType);
    
    // ⭐ IMPORTANT: Clear cart status when location changes
    setCartItemsStatus([]);
  };

  // ---------------------------------------------------
  // CHECK CART ITEMS AVAILABILITY (NEW FUNCTION) - FIXED
  // ---------------------------------------------------
  const checkCartItemsAvailability = async (cartItems) => {
    if (!authToken || !cartItems || cartItems.length === 0) return [];

    try {
      const API_BASE = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") || "";
      const response = await fetch(`${API_BASE}/api/customer/inventory`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      const data = await response.json();
      const inventory = data.data?.inventory ?? [];

      // Check each cart item against inventory
      const updatedStatus = cartItems.map(item => {
        const product = item.product;
        const inventoryItem = inventory.find(inv => 
          inv.product?._id === product._id || 
          inv.product?.id === product.id ||
          inv.product?.productId === product.productId
        );

        const isAvailable = inventoryItem && inventoryItem.currentStock > 0;
        const availableStock = inventoryItem?.currentStock || 0;

        return {
          productId: product._id || product.id,
          isAvailable,
          availableStock,
          requestedQuantity: item.quantity,
          isOutOfStock: !isAvailable,
          outOfStockMessage: !isAvailable ? "Product not available at this location" : 
                            (availableStock < item.quantity ? `Only ${availableStock} available` : null)
        };
      });

      setCartItemsStatus(updatedStatus);
      return updatedStatus;
    } catch (error) {
      console.error("Error checking cart items:", error);
      return [];
    }
  };

  // Clear cart status
  const clearCartStatus = () => {
    setCartItemsStatus([]);
  };

  // ⭐ NEW: Initialize from user profile (FIRST PRIORITY)
  const initializeFromProfile = () => {
    if (user?.profile && !hasInitializedFromProfile.current) {
      console.log("🔄 ProfileContext → Initializing from user profile...");
      
      setProfile(user.profile);
      hasInitializedFromProfile.current = true;

      // ⭐ FIX: Pehle signup location set karo
      if (user.profile.currentLocation) {
        console.log("📍 Setting location from profile (signup location)");
        updateCurrentLocation(user.profile.currentLocation);
        setUsedLocationType("signup"); // ⭐ IMPORTANT: Set type as signup
      }

      if (user.profile.currentRetailer) {
        setAssignedRetailer(user.profile.currentRetailer);
      }

      return true; // Successfully initialized from profile
    }
    return false; // No profile data available
  };

  // ⭐ NEW: Get current location with permission request - ALWAYS ASKS
  const getCurrentLocationWithPermission = async () => {
    try {
      console.log("📍 Requesting location permission...");
      
      // ALWAYS request permission when called
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        console.log("❌ Location permission denied");
        throw new Error('Location permission denied');
      }

      console.log("✅ Location permission granted, getting current location...");
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000, // 10 second timeout
      });

      const address = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const formattedLocation = {
        coordinates: {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        },
        formattedAddress: address[0] 
          ? `${address[0].name || ''} ${address[0].street || ''} ${address[0].city || ''}`.trim()
          : `Near ${location.coords.latitude}, ${location.coords.longitude}`,
        accuracy: location.coords.accuracy,
        timestamp: Date.now(),
      };

      return formattedLocation;
    } catch (error) {
      console.log("❌ Failed to get current location:", error);
      throw error;
    }
  };

  // ---------------------------------------------------
  // LOAD USER PROFILE FROM auth.user - FIXED
  // ---------------------------------------------------
  useEffect(() => {
    initializeFromProfile();
  }, [user]);

  // ⭐ NEW: Main location sync function - CALLED EVERY TIME
  const syncLocation = async (source = 'unknown') => {
    if (authLoading) {
      console.log("⏳ Auth still loading, skipping location sync");
      return;
    }
    
    if (!isAuthenticated || !authToken) {
      console.log("⏳ Not authenticated, skipping location sync");
      return;
    }
    
    if (user?.role !== "customer") {
      console.log("⏳ Not a customer, skipping location sync");
      return;
    }

    // ⭐ NEW: Prevent too frequent requests (min 30 seconds between requests)
    const now = Date.now();
    if (now - lastLocationRequestTime.current < 30000) {
      console.log("⏳ Location request too soon, skipping");
      return;
    }

    lastLocationRequestTime.current = now;
    console.log(`📍 [${source}] Starting location sync...`);

    try {
      // ALWAYS try to get fresh current location
      console.log("📍 Getting fresh GPS location...");
      const freshLocation = await getCurrentLocationWithPermission();
      
      console.log("📍 Fresh location obtained:", {
        lat: freshLocation.coordinates.latitude,
        lon: freshLocation.coordinates.longitude,
        address: freshLocation.formattedAddress
      });
      
      updateCurrentLocation(freshLocation);
      setUsedLocationType("current");

      console.log("📡 Sending fresh location to backend...");
      const backend = await LocationService.syncLocationToBackend(authToken, freshLocation);

      console.log("📍 Location Sync Response:", backend);

      if (backend?.retailer) {
        setAssignedRetailer(backend.retailer);
      }

      console.log("✅ Location sync completed successfully");

    } catch (err) {
      console.log(`❌ Fresh location failed (${source}):`, err.message);

      // Fallback to profile location if current location fails
      if (user?.profile?.currentLocation) {
        console.log("🔄 Falling back to profile location");
        updateCurrentLocation(user.profile.currentLocation);
        setUsedLocationType("signup");
        
        // Also sync the profile location to backend
        try {
          await LocationService.syncLocationToBackend(authToken, user.profile.currentLocation);
        } catch (syncError) {
          console.log("❌ Failed to sync profile location:", syncError);
        }
      }
    }
  };

  // ---------------------------------------------------
  // EFFECT 1: Sync location when app becomes active (EVERY TIME APP OPENS)
  // ---------------------------------------------------
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log('🔄 App state changed:', appState.current, '→', nextAppState);
      
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - SYNC LOCATION
        console.log('📱 App opened/returned to foreground - syncing location');
        setTimeout(() => {
          syncLocation('app_foreground');
        }, 1000);
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, authToken, user]);

  // ---------------------------------------------------
  // EFFECT 2: Sync location when user logs in (EVERY TIME LOGIN)
  // ---------------------------------------------------
  useEffect(() => {
    if (isAuthenticated && authToken && user?.role === 'customer') {
      console.log('🔑 User authenticated - syncing location on login');
      
      // Small delay to ensure smooth UX
      const timer = setTimeout(() => {
        syncLocation('user_login');
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, authToken, user]);

  // ---------------------------------------------------
  // EFFECT 3: Initial sync when component mounts (FIRST APP OPEN)
  // ---------------------------------------------------
  useEffect(() => {
    if (isAuthenticated && authToken && user?.role === 'customer') {
      console.log('🚀 First mount - syncing location');
      
      const timer = setTimeout(() => {
        syncLocation('first_mount');
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, []);

  // ⭐ NEW: Manual function to force use current location
  const useCurrentLocation = async () => {
    try {
      console.log("📍 Manually switching to current location...");
      const gps = await getCurrentLocationWithPermission();
      
      updateCurrentLocation(gps);
      setUsedLocationType("current");
      
      // Sync to backend
      const backend = await LocationService.syncLocationToBackend(authToken, gps);
      if (backend?.retailer) {
        setAssignedRetailer(backend.retailer);
      }
      
      return backend;
    } catch (error) {
      console.log("❌ Failed to use current location:", error);
      throw error;
    }
  };

  // ⭐ NEW: Manual function to use signup location
  const useSignupLocation = () => {
    if (user?.profile?.currentLocation) {
      console.log("📍 Switching back to signup location...");
      updateCurrentLocation(user.profile.currentLocation);
      setUsedLocationType("signup");
      
      if (user.profile.currentRetailer) {
        setAssignedRetailer(user.profile.currentRetailer);
      }
    }
  };

  // ⭐ NEW: Function to manually refresh location
  const refreshLocation = async () => {
    try {
      console.log("🔄 Manually refreshing location...");
      await syncLocation('manual_refresh');
    } catch (error) {
      console.log("❌ Manual location refresh failed:", error);
      throw error;
    }
  };

  // ---------------------------------------------------
  // RETURN CONTEXT - FIXED
  // ---------------------------------------------------
  return (
    <ProfileContext.Provider
      value={{
        profile,
        updateProfile: setProfile,

        currentLocation,
        updateCurrentLocation,

        assignedRetailer,
        updateAssignedRetailer: setAssignedRetailer,

        // ⭐ expose new location-type flag and cart functions
        usedLocationType,
        setUsedLocationType,
        cartItemsStatus,
        checkCartItemsAvailability,
        clearCartStatus,
        updateLocationAndRetailer,
        
        // ⭐ NEW: Manual location control functions
        useCurrentLocation,
        useSignupLocation,
        refreshLocation
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};