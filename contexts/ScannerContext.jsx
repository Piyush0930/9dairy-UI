import React, { createContext, useContext, useState } from 'react';

const ScannerContext = createContext();

export const useScanner = () => {
  const context = useContext(ScannerContext);
  if (!context) {
    throw new Error('useScanner must be used within a ScannerProvider');
  }
  return context;
};

export const ScannerProvider = ({ children }) => {
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const openScanner = () => {
    setIsScannerOpen(true);
  };

  const closeScanner = () => {
    setIsScannerOpen(false);
  };

  return (
    <ScannerContext.Provider value={{ isScannerOpen, openScanner, closeScanner }}>
      {children}
    </ScannerContext.Provider>
  );
};
