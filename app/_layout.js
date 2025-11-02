// app/_layout.js
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { ProfileProvider } from '@/contexts/ProfileContext'; // Add this import
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

// Navigation handler component with debug logs
function NavigationHandler() {
  const { isAuthenticated, loading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    console.log('🔍 Navigation Debug:', {
      loading,
      isAuthenticated,
      user: user ? { ...user, role: user.role } : null,
      segments,
      currentPath: segments.join('/')
    });

    if (loading) {
      console.log('⏳ Still loading auth state...');
      return;
    }

    // Define protected routes (require authentication)
    const isProtectedRoute = 
      segments[0] === '(tabs)' || 
      segments[0] === '(admin)' || 
      segments[0] === 'checkout' ||
      segments[0] === 'order-success';

    // Define auth routes (should not be accessible when authenticated)
    const isAuthRoute = 
      segments[0] === 'Login' || 
      segments[0] === 'Signup' || 
      segments[0] === 'GetStarted';

    console.log('🛣️ Route Analysis:', {
      isProtectedRoute,
      isAuthRoute,
      shouldRedirectToLogin: !isAuthenticated && isProtectedRoute,
      shouldRedirectToHome: isAuthenticated && isAuthRoute,
      userRole: user?.role
    });

    if (!isAuthenticated && isProtectedRoute) {
      console.log('🚫 Not authenticated - redirecting to Login');
      router.replace('/Login');
    } else if (isAuthenticated && isAuthRoute) {
      console.log('✅ Authenticated - redirecting based on role:', user?.role);
      
      // ✅ FIXED: Redirect based on user role
      if (user?.role === 'admin') {
        console.log('🔧 Redirecting admin to admin dashboard');
        router.replace('/(admin)');
      } else {
        console.log('🛒 Redirecting customer to tabs');
        router.replace('/(tabs)');
      }
    }
  }, [isAuthenticated, segments, loading, user]);

  // Show loading state
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Checking authentication...</Text>
      </View>
    );
  }

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ProfileProvider>
      <CartProvider>
        <NavigationHandler />
        <Slot />
      </CartProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}