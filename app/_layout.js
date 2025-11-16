// app/_layout.js

import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { ScannerProvider } from "@/contexts/ScannerContext";
import NavigationHandler from "@/navigation/NavigationHandler";
import { Slot } from "expo-router";

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












// import { AuthProvider, useAuth } from "@/contexts/AuthContext";
// import { CartProvider } from "@/contexts/CartContext";
// import { ProfileProvider, useProfile } from "@/contexts/ProfileContext";
// import { ScannerProvider } from "@/contexts/ScannerContext";
// import { Slot, useRouter, useSegments } from "expo-router";
// import { useEffect } from "react";
// import { Text, View } from "react-native";
// import { LocationService } from "@/services/locationService";

// function NavigationHandler() {
//   const { isAuthenticated, loading, user, authToken } = useAuth();
//   const { updateCurrentLocation, updateAssignedRetailer } = useProfile();
//   const segments = useSegments();
//   const router = useRouter();

//   // ------------------------------
//   // AUTH-BASED ROUTING
//   // ------------------------------
//   useEffect(() => {
//   const trySync = async () => {
//     console.log("🔍 NavigationHandler → Checking sync conditions...");

//     // Wait until AuthContext finishes restoring session
//     if (loading) {
//       console.log("⏳ Auth loading… waiting");
//       return;
//     }

//     if (!isAuthenticated) {
//       console.log("❌ Not authenticated, skipping sync");
//       return;
//     }

//     if (user?.role !== "customer") {
//       console.log("🚫 User is not a customer, skipping sync");
//       return;
//     }

//     if (!user?.authToken) {
//       console.log("❌ user.authToken missing in NavigationHandler");
//       return;
//     }

//     console.log("📍 Fetching GPS...");
//     const gps = await LocationService.getLocationWithFallback();

//     console.log("📡 Sending GPS to backend...");
//     const backend = await LocationService.syncLocationToBackend(
//       user.authToken,
//       gps
//     );

//     updateCurrentLocation(gps);

//     if (backend?.retailer) {
//       console.log("🔁 Updated retailer:", backend.retailer.shopName);
//       updateAssignedRetailer(backend.retailer);
//     }
//   };

//   trySync();
// }, [loading, isAuthenticated]);


//   // ------------------------------
//   // AUTO LOCATION SYNC (FIXED)
//   // ------------------------------
//   useEffect(() => {
//     const syncNow = async () => {
//       if (loading || !authToken || !isAuthenticated) return; // ✔ FIXED

//       try {
//         const gps = await LocationService.getLocationWithFallback();

//         const backend = await LocationService.syncLocationToBackend(
//           authToken, // ✔ Correct token ALWAYS
//           gps
//         );

//         updateCurrentLocation(gps);
//         if (backend?.retailer) updateAssignedRetailer(backend.retailer);
//       } catch (err) {
//         console.log("GPS Sync Failed:", err);
//       }
//     };

//     syncNow();
//   }, [authToken, loading, isAuthenticated]);

//   if (loading)
//     return (
//       <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
//         <Text>Checking authentication...</Text>
//       </View>
//     );

//   return null;
// }



// export default function RootLayout() {
//   return (
//     <AuthProvider>
//       <ProfileProvider>
//         <CartProvider>
//           <ScannerProvider>
//             <NavigationHandler />
//             <Slot />
//           </ScannerProvider>
//         </CartProvider>
//       </ProfileProvider>
//     </AuthProvider>
//   );
// }
