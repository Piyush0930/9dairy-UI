// navigation/NavigationHandler.jsx
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSegments } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";

export default function NavigationHandler() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  
  const [navigationReady, setNavigationReady] = useState(false);
  const redirected = useRef(false);

  const getCurrentRoute = () => {
    if (!segments || segments.length === 0) return "/";
    return `/${segments.join("/")}`;
  };

  useEffect(() => {
    if (isLoading) return;

    const currentRoute = getCurrentRoute();
    console.log("🔍 NavigationHandler → Current route:", currentRoute, "User role:", user?.role);

    // ✅ FIXED: Add this check for initial route
    const isInitialRoute = currentRoute === "/" || segments.length === 0;

    const isProtected =
      segments[0] === "(tabs)" ||
      segments[0] === "(admin)" ||
      segments[0] === "(superadmin)" ||
      segments[0] === "checkout" ||
      segments[0] === "order-success" ||
      segments[0] === "categories" ||
      segments[0] === "cart";

    const isAuthRoute =
      segments[0] === "Login" ||
      segments[0] === "Signup" ||
      segments[0] === "GetStarted";

    // 🚨 CRITICAL FIX: Handle initial route ("/") for authenticated users
    if (isAuthenticated && (isInitialRoute || !isProtected)) {
      const role = user?.role?.toLowerCase();
      
      if (role === "superadmin" && currentRoute !== "/(superadmin)") {
        console.log("👑 SuperAdmin on initial route → redirect → /(superadmin)");
        redirected.current = true;
        router.replace("/(superadmin)");
        setNavigationReady(true);
        return;
      } else if ((role === "admin" || role === "retailer") && currentRoute !== "/(admin)") {
        console.log("🔧 Admin/Retailer on initial route → redirect → /(admin)");
        redirected.current = true;
        router.replace("/(admin)");
        setNavigationReady(true);
        return;
      } else if (role === "customer" && currentRoute !== "/(tabs)") {
        console.log("🛒 Customer on initial route → redirect → /(tabs)");
        redirected.current = true;
        router.replace("/(tabs)");
        setNavigationReady(true);
        return;
      }
    }

    // -----------------------------
    // RULE 1: User NOT logged in → redirect from PROTECTED routes
    // -----------------------------
    if (!isAuthenticated && isProtected) {
      if (currentRoute !== "/Login") {
        console.log("🔐 Not logged in → redirect → /Login");
        redirected.current = true;
        router.replace("/Login");
        setNavigationReady(true);
      }
      return;
    }

    // -----------------------------
    // RULE 2: Logged in user visiting auth screens → redirect to dashboard
    // -----------------------------
    if (isAuthenticated && isAuthRoute) {
      const role = user?.role?.toLowerCase();
      
      if (role === "superadmin" && currentRoute !== "/(superadmin)") {
        console.log("👑 SuperAdmin on auth route → redirect → /(superadmin)");
        redirected.current = true;
        router.replace("/(superadmin)");
        setNavigationReady(true);
      } else if ((role === "admin" || role === "retailer") && currentRoute !== "/(admin)") {
        console.log("🔧 Admin/Retailer on auth route → redirect → /(admin)");
        redirected.current = true;
        router.replace("/(admin)");
        setNavigationReady(true);
      } else if (currentRoute !== "/(tabs)") {
        console.log("🛒 Customer on auth route → redirect → /(tabs)");
        redirected.current = true;
        router.replace("/(tabs)");
        setNavigationReady(true);
      }
      return;
    }

    // -----------------------------
    // RULE 3: Authenticated users on wrong role routes
    // -----------------------------
    if (isAuthenticated && isProtected) {
      const role = user?.role?.toLowerCase();
      const currentPath = getCurrentRoute();
      
      if (role === "superadmin" && !currentPath.startsWith("/(superadmin)")) {
        console.log("👑 SuperAdmin on wrong route → redirect → /(superadmin)");
        redirected.current = true;
        router.replace("/(superadmin)");
        setNavigationReady(true);
        return;
      }
      
      if ((role === "admin" || role === "retailer") && !currentPath.startsWith("/(admin)")) {
        console.log("🔧 Admin/Retailer on wrong route → redirect → /(admin)");
        redirected.current = true;
        router.replace("/(admin)");
        setNavigationReady(true);
        return;
      }
      
      if (role === "customer" && !currentPath.startsWith("/(tabs)") && 
          !["/checkout", "/order-success", "/categories", "/cart"].some(route => 
            currentPath.startsWith(route))) {
        console.log("🛒 Customer on wrong route → redirect → /(tabs)");
        redirected.current = true;
        router.replace("/(tabs)");
        setNavigationReady(true);
        return;
      }
    }

    // If we reach here, navigation is ready and no redirect is needed
    console.log("✅ Navigation ready, no redirect needed");
    setNavigationReady(true);
    redirected.current = false;
  }, [isAuthenticated, isLoading, user, segments]);

  // 🚨 CRITICAL: Show loading until navigation is decided
  if (isLoading || !navigationReady) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: "center", 
        alignItems: "center",
        backgroundColor: '#fff'
      }}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ marginTop: 10 }}>Setting up your dashboard...</Text>
      </View>
    );
  }

  return null;
}