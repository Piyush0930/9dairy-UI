// app/_layout.js
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { ScannerProvider } from '@/contexts/ScannerContext';
import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

// Navigation handler component with robust checks
function NavigationHandler() {
  // NOTE: useAuth exposes isLoading (not loading) in the AuthContext
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments(); // e.g. ["(tabs)","home"] or []
  const router = useRouter();

  useEffect(() => {
    console.log('🔍 Navigation Debug:', {
      isLoading,
      isAuthenticated,
      user: user ? { ...user, role: user.role } : null,
      segments,
      currentPath: '/' + (segments.length ? segments.join('/') : ''),
    });

    // Wait until auth initialization completed
    if (isLoading) {
      console.log('⏳ Auth still initializing — delaying routing decisions');
      return;
    }

    // compute our "current path" for simple comparisons
    const currentPath = '/' + (segments.length ? segments.join('/') : '');

    // Helper: target path based on role
    const normalizedRole = String(user?.role || '').toLowerCase();

    // Decide target path for authenticated users when they hit an auth route
    const roleTargetPath = normalizedRole === 'superadmin'
      ? '/supadmin/dashboard'
      : normalizedRole === 'admin'
      ? '/(admin)/dashboard'
      : '/(tabs)/index';

    // Protected routes: paths that require authentication
    const protectedPrefixes = ['/(', '/checkout', '/order-success', '/supadmin', '/(admin)'];
    const isProtectedRoute = protectedPrefixes.some(prefix => currentPath.startsWith(prefix));

    // Auth routes: login/signup/getstarted (should redirect away when authenticated)
    const authPaths = ['/Login', '/Signup', '/GetStarted'];
    const isAuthRoute = authPaths.includes(currentPath) || authPaths.includes('/' + (segments[0] || ''));

    console.log('🛣️ Route Analysis:', {
      isProtectedRoute,
      isAuthRoute,
      shouldRedirectToLogin: !isAuthenticated && isProtectedRoute,
      shouldRedirectToHome: isAuthenticated && isAuthRoute,
      userRole: normalizedRole,
      currentPath,
      roleTargetPath,
    });

    // Not authenticated but trying to access protected area -> send to login
    if (!isAuthenticated && isProtectedRoute) {
      // Avoid replacing if already on Login
      if (currentPath !== '/Login') {
        console.log('🚫 Not authenticated - redirecting to /Login');
        router.replace('/Login');
      } else {
        console.log('ℹ️ Already on /Login');
      }
      return;
    }

    // Authenticated but on an auth route (GetStarted/Login/Signup) -> send to role target
    if (isAuthenticated && isAuthRoute) {
      // Avoid redirecting if already at the correct target
      if (currentPath !== roleTargetPath) {
        console.log('✅ Authenticated - redirecting based on role to', roleTargetPath);
        router.replace(roleTargetPath);
      } else {
        console.log('ℹ️ Already at role target', roleTargetPath);
      }
      return;
    }

    // No action needed otherwise
  }, [isAuthenticated, isLoading, user, segments, router]);

  // While auth initializes, show a guarded loading / splash UI to prevent wrong routing
  if (isLoading) {
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
          <ScannerProvider>
            <NavigationHandler />
            <Slot />
          </ScannerProvider>
        </CartProvider>
      </ProfileProvider>
    </AuthProvider>
  );
}
