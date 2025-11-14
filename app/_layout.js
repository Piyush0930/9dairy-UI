import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { ProfileProvider, useProfile } from "@/contexts/ProfileContext";
import { ScannerProvider } from "@/contexts/ScannerContext";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { LocationService } from "@/services/locationService";

function NavigationHandler() {
  const { isAuthenticated, loading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // 🔥 Profile context
  const { updateCurrentLocation, updateAssignedRetailer } = useProfile();

  useEffect(() => {
    if (loading) return;

    const isProtected =
      segments[0] === "(tabs)" ||
      segments[0] === "(admin)" ||
      segments[0] === "checkout" ||
      segments[0] === "order-success";

    const isAuthRoute =
      segments[0] === "Login" ||
      segments[0] === "Signup" ||
      segments[0] === "GetStarted";

    if (!isAuthenticated && isProtected) {
      router.replace("/Login");
    } else if (isAuthenticated && isAuthRoute) {
      if (user.role === "admin") {
        router.replace("/(admin)");
      } else {
        router.replace("/(tabs)");
      }
    }
  }, [isAuthenticated, loading, user]);

  // 🔥 Auto location sync
  useEffect(() => {
    const syncNow = async () => {
      if (!isAuthenticated || user?.role !== "customer") return;

      try {
        const gps = await LocationService.getLocationWithFallback();
        const backend = await LocationService.syncLocationToBackend(
          user.token,
          gps
        );

        updateCurrentLocation(gps);
        if (backend?.retailer) updateAssignedRetailer(backend.retailer);
      } catch (err) {
        console.log("GPS Sync Failed:", err);
      }
    };

    syncNow();
  }, [isAuthenticated]);

  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Checking authentication...</Text>
      </View>
    );

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
