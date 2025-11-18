// navigation/NavigationHandler.jsx
import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSegments } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";

export default function NavigationHandler() {
  const { isAuthenticated, isLoading, user } = useAuth(); // ✅ Use isLoading instead of loading
  const segments = useSegments();
  const router = useRouter();

  // Avoid duplicate redirects
  const redirected = useRef(false);

  const getCurrentRoute = () => {
    if (!segments || segments.length === 0) return "/";
    return `/${segments.join("/")}`;
  };

  useEffect(() => {
    if (isLoading) return; // wait for auth to finish
    if (redirected.current) return; // prevent loop

    const currentRoute = getCurrentRoute();
    console.log("🔍 NavigationHandler → Current route:", currentRoute);

    // ✅ FIXED: Include all protected routes
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

    // -----------------------------
    // RULE 1: User NOT logged in → redirect from PROTECTED routes
    // -----------------------------
    if (!isAuthenticated && isProtected) {
      if (currentRoute !== "/Login") {
        console.log("🔐 Not logged in → redirect → /Login");
        redirected.current = true;
        router.replace("/Login");
      }
      return;
    }

    // -----------------------------
    // RULE 2: Logged in user visiting auth screens → redirect to dashboard
    // -----------------------------
    if (isAuthenticated && isAuthRoute) {
      const role = user?.role?.toLowerCase();
      
      if (role === "superadmin") {
        if (currentRoute !== "/(superadmin)") {
          console.log("👑 SuperAdmin logged in → redirect → /(superadmin)");
          redirected.current = true;
          router.replace("/(superadmin)");
        }
      } else if (role === "admin" || role === "retailer") {
        if (currentRoute !== "/(admin)") {
          console.log("🔧 Admin/Retailer logged in → redirect → /(admin)");
          redirected.current = true;
          router.replace("/(admin)");
        }
      } else {
        // Customer or any other role
        if (currentRoute !== "/(tabs)") {
          console.log("🛒 Customer logged in → redirect → /(tabs)");
          redirected.current = true;
          router.replace("/(tabs)");
        }
      }
      return;
    }

    // -----------------------------
    // RULE 3: Authenticated users on wrong role routes
    // -----------------------------
    if (isAuthenticated && isProtected) {
      const role = user?.role?.toLowerCase();
      const currentPath = getCurrentRoute();
      
      // Check if user is on wrong route for their role
      if (role === "superadmin" && !currentPath.startsWith("/(superadmin)")) {
        console.log("👑 SuperAdmin on wrong route → redirect → /(superadmin)");
        redirected.current = true;
        router.replace("/(superadmin)");
        return;
      }
      
      if ((role === "admin" || role === "retailer") && !currentPath.startsWith("/(admin)")) {
        console.log("🔧 Admin/Retailer on wrong route → redirect → /(admin)");
        redirected.current = true;
        router.replace("/(admin)");
        return;
      }
      
      if (role === "customer" && !currentPath.startsWith("/(tabs)") && 
          !["/checkout", "/order-success", "/categories", "/cart"].some(route => 
            currentPath.startsWith(route))) {
        console.log("🛒 Customer on wrong route → redirect → /(tabs)");
        redirected.current = true;
        router.replace("/(tabs)");
        return;
      }
    }

    // If no redirect is needed → allow navigation normally
    redirected.current = false;
  }, [isAuthenticated, isLoading, user, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ marginTop: 10 }}>Checking authentication...</Text>
      </View>
    );
  }

  return null;
}