// navigation/NavigationHandler.jsx
import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSegments } from "expo-router";
import { View, Text } from "react-native";

export default function NavigationHandler() {
  const { isAuthenticated, loading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Avoid duplicate redirects
  const redirected = useRef(false);

  const getCurrentRoute = () => {
    if (!segments || segments.length === 0) return "/";
    return `/${segments.join("/")}`;
  };

  useEffect(() => {
    if (loading) return; // wait for auth to finish
    if (redirected.current) return; // prevent loop

    const currentRoute = getCurrentRoute();
    console.log("🔍 NavigationHandler → Current route:", currentRoute);

    const isProtected =
      segments[0] === "(tabs)" ||
      segments[0] === "(admin)" ||
      segments[0] === "checkout" ||
      segments[0] === "order-success";

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
      if (user?.role === "admin") {
        if (currentRoute !== "/(admin)") {
          console.log("🔧 Admin logged in → redirect → /(admin)");
          redirected.current = true;
          router.replace("/(admin)");
        }
      } else {
        if (currentRoute !== "/(tabs)") {
          console.log("🛒 Customer logged in → redirect → /(tabs)");
          redirected.current = true;
          router.replace("/(tabs)");
        }
      }
      return;
    }

    // If no redirect is needed → allow navigation normally
    redirected.current = false;
  }, [isAuthenticated, loading, user, segments]);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Checking authentication...</Text>
      </View>
    );

  return null;
}
