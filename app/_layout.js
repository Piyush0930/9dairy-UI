// app/_layout.js
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { ScannerProvider } from '@/contexts/ScannerContext';
import NavigationHandler from '@/navigation/NavigationHandler';
import { Slot } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';

// Simple loading component
function LoadingScreen() {
  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: '#fff'
    }}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={{ marginTop: 10 }}>Loading...</Text>
    </View>
  );
}

function RootLayoutNav() {
  const { isLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);

  // Wait a frame to ensure the layout is mounted
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  // Show loading while checking auth or not ready
  if (isLoading || !isReady) {
    return <LoadingScreen />;
  }

  return (
    <>
      <NavigationHandler />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <CartProvider>
          <ScannerProvider>
            <RootLayoutNav />
          </ScannerProvider>
        </CartProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}