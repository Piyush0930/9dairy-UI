// app/_layout.js
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { ScannerProvider } from '@/contexts/ScannerContext';
import NavigationHandler from '../navigation/NavigationHandler';
import { Slot } from 'expo-router';
import { View, Text, ActivityIndicator } from 'react-native';

// Loading component for better UX
function AuthLoadingScreen() {
  return (
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: '#fff'
    }}>
      <ActivityIndicator size="large" color="#0000ff" />
      <Text style={{ marginTop: 10 }}>Checking authentication...</Text>
    </View>
  );
}

function RootLayoutNav() {
  const { isLoading } = useAuth();

  // Show loading screen while checking auth state
  if (isLoading) {
    return <AuthLoadingScreen />;
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