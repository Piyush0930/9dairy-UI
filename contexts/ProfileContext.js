// contexts/ProfileContext.js
import React, { createContext, useState, useContext } from 'react';

const ProfileContext = createContext();

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

export const ProfileProvider = ({ children }) => {
  const [profile, setProfile] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Use number instead of boolean

  const updateProfile = (newProfile) => {
    setProfile(newProfile);
  };

  const refreshProfile = () => {
    setRefreshTrigger(prev => prev + 1); // Increment to trigger refresh
  };

  const value = {
    profile,
    updateProfile,
    refreshTrigger, // Export refreshTrigger instead of needsRefresh
    refreshProfile
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};