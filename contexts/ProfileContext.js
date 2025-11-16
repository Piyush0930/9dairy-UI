// contexts/ProfileContext.js
import React, { createContext, useState, useContext, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { LocationService } from "@/services/locationService";

const ProfileContext = createContext();
export const useProfile = () => useContext(ProfileContext);

export const ProfileProvider = ({ children }) => {
  const { user, authToken, isAuthenticated, loading: authLoading } = useAuth();

  const [profile, setProfile] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [assignedRetailer, setAssignedRetailer] = useState(null);

  // ⭐ NEW: store if user used current location OR skipped
  const [usedLocationType, setUsedLocationType] = useState("signup"); 
  const [cartItemsStatus, setCartItemsStatus] = useState([]); // ⭐ NEW: Track cart items availability

  const hasSyncedLocation = useRef(false);

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
  // CHECK CART ITEMS AVAILABILITY (NEW FUNCTION)
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

  // ---------------------------------------------------
  // LOAD USER PROFILE FROM auth.user
  // ---------------------------------------------------
  useEffect(() => {
    if (user?.profile) {
      setProfile(user.profile);

      if (user.profile.currentLocation) {
        updateCurrentLocation(user.profile.currentLocation);
      }

      if (user.profile.currentRetailer) {
        setAssignedRetailer(user.profile.currentRetailer);
      }
    }
  }, [user]);

  // ---------------------------------------------------
  // SYNC LOCATION TO BACKEND ONLY ONCE AFTER LOGIN
  // ---------------------------------------------------
  useEffect(() => {
    const syncLocation = async () => {
      if (authLoading) return;
      if (!isAuthenticated || !authToken) return;
      if (user?.role !== "customer") return;

      if (hasSyncedLocation.current) return;
      hasSyncedLocation.current = true;

      try {
        console.log("📍 ProfileContext → Fetching GPS...");
        const gps = await LocationService.getLocationWithFallback();

        updateCurrentLocation(gps);

        // ⭐ user allowed location → mark type = current
        setUsedLocationType("current");

        console.log("📡 Sending location to backend...");
        const backend = await LocationService.syncLocationToBackend(authToken, gps);

        console.log("📍 Location Sync Response:", backend);

        if (backend?.retailer) {
          setAssignedRetailer(backend.retailer);
        }
      } catch (err) {
        console.log("❌ Location sync failed:", err);

        // ⭐ user denied / failed GPS → fallback to signup address
        setUsedLocationType("signup");
      }
    };

    syncLocation();
  }, [authLoading, isAuthenticated, authToken, user]);

  // ---------------------------------------------------
  // RETURN CONTEXT
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
        updateLocationAndRetailer // ⭐ NEW
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};