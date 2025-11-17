// app/components/NavigationHandler.jsx
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from './AuthContext';

export default function NavigationHandler() {
  const { isLoading, isAuthenticated, user, hasRedirected } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    // Wait for auth to initialize
    if (isLoading) return;

    // Prevent multiple redirects
    if (hasRedirected.current) return;
    
    const currentPath = '/' + segments.join('/');
    
    console.log('🧭 Navigation Handler:', {
      isAuthenticated,
      userRole: user?.role,
      currentPath,
      hasRedirected: hasRedirected.current
    });

    // Define route patterns
    const authRoutes = ['/login', '/signup', '/getstarted'];
    const protectedRoutes = ['/(tabs)', '/(admin)', '/(superadmin)', '/checkout', '/order-success'];
    const publicRoutes = ['/welcome', '/about']; // Add any public routes here

    const isAuthRoute = authRoutes.some(route => 
      currentPath.toLowerCase().includes(route.toLowerCase())
    );
    const isProtectedRoute = protectedRoutes.some(route => 
      currentPath.toLowerCase().includes(route.toLowerCase())
    );
    const isPublicRoute = publicRoutes.some(route => 
      currentPath.toLowerCase().includes(route.toLowerCase())
    );

    // Unauthenticated user trying to access protected route
    if (!isAuthenticated && isProtectedRoute) {
      console.log('🚫 Access denied - redirecting to login');
      hasRedirected.current = true;
      router.replace('/Login');
      return;
    }

    // Authenticated user on auth route - redirect to appropriate home
    if (isAuthenticated && isAuthRoute) {
      const role = String(user?.role || '').toLowerCase();
      let targetRoute = '/(tabs)';
      
      if (role === 'superadmin') targetRoute = '/(superadmin)/dashboard';
      else if (role === 'admin') targetRoute = '/(admin)/dashboard';
      
      console.log(`✅ Authenticated ${role} - redirecting to ${targetRoute}`);
      hasRedirected.current = true;
      router.replace(targetRoute);
      return;
    }

    // Authenticated user with no specific route - redirect to appropriate home
    if (isAuthenticated && (currentPath === '/' || isPublicRoute)) {
      const role = String(user?.role || '').toLowerCase();
      let targetRoute = '/(tabs)';
      
      if (role === 'superadmin') targetRoute = '/(superadmin)/dashboard';
      else if (role === 'admin') targetRoute = '/(admin)/dashboard';
      
      console.log(`🏠 Redirecting ${role} to home: ${targetRoute}`);
      hasRedirected.current = true;
      router.replace(targetRoute);
      return;
    }

    // Allowed access
    hasRedirected.current = false;
    
  }, [isLoading, isAuthenticated, user, segments, router, hasRedirected]);

  return null;
}