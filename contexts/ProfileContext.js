import React, { createContext, useState, useContext } from "react";

const ProfileContext = createContext();

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
};

export const ProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(null);

  // 🔥 Location & Retailer (Fixed structure)
  const [currentLocation, setCurrentLocation] = useState(null);
  const [assignedRetailer, setAssignedRetailer] = useState(null);

  // NEW — Normalizes and stores location properly
  const updateCurrentLocation = (loc) => {
    console.log("🔥 Normalizing Location:", loc);

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
