// navigation/NavigationHandler.jsx
import { useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useRouter, useSegments } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";

export default function NavigationHandler() {
  const { isAuthenticated, isLoading, user } = useAuth(); // Changed from 'loading' to 'isLoading'
  const segments = useSegments();
  const router = useRouter();

  // Avoid duplicate redirects
  const redirected = useRef(false);

  const getCurrentRoute = () => {
    if (!segments || segments.length === 0) return "/";
    return `/${segments.join("/")}`;
  };

  useEffect(() => {
    console.log("🧭 NavigationHandler State:", {
      isLoading,
      isAuthenticated,
      userRole: user?.role,
      segments,
      redirected: redirected.current
    });

    if (isLoading) {
      console.log("⏳ Auth still loading, waiting...");
      return;
    }

    if (redirected.current) {
      console.log("↪️ Already redirected, skipping...");
      return;
    }

    const currentRoute = getCurrentRoute();
    console.log("📍 Current route:", currentRoute);

    // More comprehensive route checking
    const isProtected = 
      segments[0] === "(tabs)" ||
      segments[0] === "(admin)" ||
      segments[0] === "(superadmin)" ||
      segments[0] === "checkout" ||
      segments[0] === "order-success" ||
      currentRoute.includes("(tabs)") ||
      currentRoute.includes("(admin)") ||
      currentRoute.includes("(superadmin)");

    const isAuthRoute =
      segments[0] === "Login" ||
      segments[0] === "Signup" ||
      segments[0] === "GetStarted" ||
      currentRoute === "/Login" ||
      currentRoute === "/Signup" ||
      currentRoute === "/GetStarted";

    const isRootRoute = currentRoute === "/";

    console.log("🛣️ Route Analysis:", {
      isProtected,
      isAuthRoute,
      isRootRoute,
      currentRoute
    });

    // -----------------------------
    // RULE 1: User NOT logged in → redirect from PROTECTED routes to Login
    // -----------------------------
    if (!isAuthenticated && (isProtected || isRootRoute)) {
      if (currentRoute !== "/Login") {
        console.log("🚫 Not authenticated - redirecting to /Login");
        redirected.current = true;
        // Use setTimeout to avoid navigation during render
        setTimeout(() => {
          router.replace("/Login");
        }, 100);
      }
      return;
    }

    // -----------------------------
    // RULE 2: Logged in user visiting auth screens → redirect to appropriate home
    // -----------------------------
    if (isAuthenticated && (isAuthRoute || isRootRoute)) {
      const role = user?.role?.toLowerCase();
      let targetRoute = "/(tabs)";
      
      if (role === "superadmin") targetRoute = "/(superadmin)/dashboard";
      else if (role === "admin") targetRoute = "/(admin)/dashboard";
      
      if (currentRoute !== targetRoute) {
        console.log(`✅ Authenticated ${role} - redirecting to ${targetRoute}`);
        redirected.current = true;
        setTimeout(() => {
          router.replace(targetRoute);
        }, 100);
      }
      return;
    }

    // -----------------------------
    // RULE 3: Authenticated but no specific route match
    // -----------------------------
    if (isAuthenticated && !isProtected && !isAuthRoute && !isRootRoute) {
      console.log("✅ Authenticated user accessing allowed route:", currentRoute);
      redirected.current = false;
      return;
    }

    // Reset redirect flag for next navigation
    redirected.current = false;

  }, [isAuthenticated, isLoading, user, segments, router]);

  // Show loading while checking auth
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