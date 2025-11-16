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

  // Prevent multiple sync calls
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
  // SYNC LOCATION ONLY ONCE AFTER LOGIN
  // ---------------------------------------------------
  useEffect(() => {
    const syncLocation = async () => {
      if (authLoading) return;
      if (!isAuthenticated || !authToken) return;
      if (user?.role !== "customer") return;

      // avoid duplicate sync calls
      if (hasSyncedLocation.current) return;
      hasSyncedLocation.current = true;

      try {
        console.log("📍 ProfileContext → Fetching GPS...");
        const gps = await LocationService.getLocationWithFallback();

        updateCurrentLocation(gps);

        console.log("📡 Sending location to backend...");
        const backend = await LocationService.syncLocationToBackend(authToken, gps);

        console.log("📍 Location Sync Response:", backend);

        if (backend?.retailer) {
          setAssignedRetailer(backend.retailer);
        }
      } catch (err) {
        console.log("❌ Location sync failed:", err);
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
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
};
