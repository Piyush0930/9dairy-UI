// navigation/NavigationHandler.jsx
import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSegments } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";

export default function NavigationHandler() {
  const { isAuthenticated, isLoading, user, hasRedirected } = useAuth(); // ✅ Use hasRedirected from AuthContext
  const segments = useSegments();
  const router = useRouter();
  const isMounted = useRef(false);

  const getCurrentRoute = useCallback(() => {
    if (!segments || segments.length === 0) return "/";
    return `/${segments.join("/")}`;
  }, [segments]);

  // Define isOnCorrectRoute outside useEffect to avoid scope issues
  const isOnCorrectRoute = useCallback((route) => {
    if (!isAuthenticated) return route === '/Login';
    
    const role = user?.role?.toLowerCase();
    const expectedRoutes = {
      'superadmin': ['/(superadmin)', '/(superadmin)/'],
      'admin': ['/(admin)', '/(admin)/'],
      'customer': ['/(tabs)', '/(tabs)/']
    };
    
    const userExpectedRoutes = expectedRoutes[role] || expectedRoutes.customer;
    return userExpectedRoutes.some(expected => route.startsWith(expected));
  }, [isAuthenticated, user]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    // Don't run until component is mounted
    if (!isMounted.current) return;

    console.log("🧭 NavigationHandler State:", {
      isLoading,
      isAuthenticated,
      userRole: user?.role,
      segments,
      hasRedirected: hasRedirected.current,
      currentRoute: getCurrentRoute()
    });

    if (isLoading) {
      console.log("⏳ Auth still loading, waiting...");
      return;
    }

    const currentRoute = getCurrentRoute();
    
    // Reset redirected flag if we're on the correct route for our auth state
    if (isAuthenticated && isOnCorrectRoute(currentRoute)) {
      console.log(`✅ ${user?.role} on correct route, resetting redirect flag`);
      hasRedirected.current = false;
      return;
    } else if (!isAuthenticated && currentRoute === '/Login') {
      console.log("✅ On login page, resetting redirect flag");
      hasRedirected.current = false;
      return;
    }

    // If we've already redirected but we're not where we should be, allow redirect again
    if (hasRedirected.current && !isOnCorrectRoute(currentRoute)) {
      console.log("🔄 Already redirected but not on target route, allowing redirect");
      hasRedirected.current = false;
    }

    if (hasRedirected.current) {
      console.log("↪️ Already redirected, skipping...");
      return;
    }

    console.log("📍 Current route:", currentRoute);

    // Route analysis
    const isProtected = 
      segments[0] === "(tabs)" ||
      segments[0] === "(admin)" ||
      segments[0] === "(superadmin)" ||
      segments[0] === "checkout" ||
      segments[0] === "order-success";

    const isAuthRoute =
      segments[0] === "Login" ||
      segments[0] === "Signup" ||
      segments[0] === "GetStarted";

    const isRootRoute = currentRoute === "/";

    console.log("🛣️ Route Analysis:", {
      isProtected,
      isAuthRoute,
      isRootRoute,
      currentRoute,
      isOnCorrectRoute: isOnCorrectRoute(currentRoute)
    });

    // Safe navigation function
    const safeNavigate = (targetRoute) => {
      if (!isMounted.current) {
        console.log("🚫 Navigation skipped - component unmounted");
        return;
      }
      
      console.log(`🔄 Safe navigating to: ${targetRoute}`);
      hasRedirected.current = true;
      
      // Use requestAnimationFrame to ensure React is ready
      requestAnimationFrame(() => {
        if (isMounted.current) {
          router.replace(targetRoute);
        }
      });
    };

    // RULE 1: Not authenticated on protected route → Login
    if (!isAuthenticated && (isProtected || isRootRoute)) {
      if (currentRoute !== "/Login") {
        console.log("🚫 Not authenticated - redirecting to /Login");
        safeNavigate("/Login");
      }
      return;
    }

    // RULE 2: Authenticated on auth route or root → redirect to appropriate home
    if (isAuthenticated && (isAuthRoute || isRootRoute || !isOnCorrectRoute(currentRoute))) {
      const role = user?.role?.toLowerCase();
      let targetRoute = "/(tabs)";
      
      if (role === "superadmin") targetRoute = "/(superadmin)";
      else if (role === "admin") targetRoute = "/(admin)";
      
      if (currentRoute !== targetRoute) {
        console.log(`✅ Authenticated ${role} - redirecting to ${targetRoute}`);
        safeNavigate(targetRoute);
      }
      return;
    }

    // RULE 3: Authenticated but on wrong protected route
    if (isAuthenticated && isProtected && !isOnCorrectRoute(currentRoute)) {
      const role = user?.role?.toLowerCase();
      let targetRoute = "/(tabs)";
      
      if (role === "superadmin") targetRoute = "/(superadmin)";
      else if (role === "admin") targetRoute = "/(admin)";
      
      console.log(`🔄 Wrong route for ${role} - redirecting to ${targetRoute}`);
      safeNavigate(targetRoute);
      return;
    }

    // All good - reset redirect flag
    console.log("✅ Navigation state is correct");
    hasRedirected.current = false;

  }, [isAuthenticated, isLoading, user, segments, router, isOnCorrectRoute, getCurrentRoute, hasRedirected]);

  if (isLoading) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: "center", 
        alignItems: "center",
        backgroundColor: '#fff'
      }}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ marginTop: 10 }}>Checking authentication...</Text>
      </View>
    );
  }

  return null;
}