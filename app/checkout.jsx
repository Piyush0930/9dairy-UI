// ===================== CHECKOUT SCREEN ===================== //

import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "@/contexts/ProfileContext";

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { items, getTotalPrice, clearCart } = useCart();
  const { authToken, isAuthenticated, validateToken, logout } = useAuth();

  const {
    currentLocation,
    profile,
    usedLocationType,   // ⭐ This tells us what user selected on home screen
  } = useProfile();

  const [profileData, setProfileData] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState("upi");
  const [addressType, setAddressType] = useState("signup"); // default
  const [loading, setLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);

  const [orderSuccess, setOrderSuccess] = useState(false);

  // =========================================
  // FETCH PROFILE WITH SIGNUP ADDRESS
  // =========================================
  const fetchProfile = async () => {
    try {
      setFetchingProfile(true);

      const response = await fetch(`${API_BASE_URL}/customer/profile`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const data = await response.json();
      setProfileData(data);

      // 🔥 AUTO-SELECT BASED ON usedLocationType
      if (usedLocationType === "signup" && data.deliveryAddress) {
        // User selected "Skip - Use Saved Address" on home screen
        setAddressType("signup");
        setSelectedAddress({
          ...data.deliveryAddress,
          coordinates: {
            latitude: Number(data.deliveryAddress?.coordinates?.latitude),
            longitude: Number(data.deliveryAddress?.coordinates?.longitude),
          },
        });
      } else if (usedLocationType === "current" && currentLocation) {
        // User selected "Use Current Location" on home screen
        setAddressType("current");
        const latitude =
          currentLocation?.coordinates?.latitude ??
          currentLocation?.latitude ??
          null;
        const longitude =
          currentLocation?.coordinates?.longitude ??
          currentLocation?.longitude ??
          null;

        setSelectedAddress({
          addressLine1: currentLocation.formattedAddress || "Current Location",
          city: "",
          state: "",
          pincode: "",
          landmark: "",
          coordinates: {
            latitude: Number(latitude),
            longitude: Number(longitude),
          },
        });
      } else if (data.deliveryAddress) {
        // Default fallback to signup address
        setAddressType("signup");
        setSelectedAddress({
          ...data.deliveryAddress,
          coordinates: {
            latitude: Number(data.deliveryAddress?.coordinates?.latitude),
            longitude: Number(data.deliveryAddress?.coordinates?.longitude),
          },
        });
      }
    } catch (err) {
      console.log("Profile fetch error:", err);
    } finally {
      setFetchingProfile(false);
    }
  };

  // =========================================
  // INIT AUTH + PROFILE LOAD
  // =========================================
  useEffect(() => {
    const init = async () => {
      if (!authToken || !isAuthenticated) {
        router.replace("/Login");
        return;
      }

      const valid = await validateToken();
      if (!valid) {
        logout();
        return;
      }

      await fetchProfile();
    };

    init();
  }, [authToken, isAuthenticated]);

  // =========================================
  // AUTO-SELECT ADDRESS BASED ON user action (HOME SCREEN)
  // =========================================
  useEffect(() => {
    if (!profileData) return;

    console.log("🌎 usedLocationType =", usedLocationType);
    console.log("📍 currentLocation =", currentLocation);

    // 🔵 If user selected saved address (Skip button initially)
    if (usedLocationType === "signup" && profileData.deliveryAddress) {
      setAddressType("signup");
      setSelectedAddress({
        ...profileData.deliveryAddress,
        coordinates: {
          latitude: Number(profileData.deliveryAddress?.coordinates?.latitude),
          longitude: Number(profileData.deliveryAddress?.coordinates?.longitude),
        },
      });
    }

    // 🟢 If user selected "Use Current Location"
    if (usedLocationType === "current" && currentLocation) {
      setAddressType("current");

      const latitude =
        currentLocation?.coordinates?.latitude ??
        currentLocation?.latitude ??
        null;

      const longitude =
        currentLocation?.coordinates?.longitude ??
        currentLocation?.longitude ??
        null;

      setSelectedAddress({
        addressLine1: currentLocation.formattedAddress || "Current Location",
        city: "",
        state: "",
        pincode: "",
        landmark: "",
        coordinates: {
          latitude: Number(latitude),
          longitude: Number(longitude),
        },
      });
    }
  }, [usedLocationType, currentLocation, profileData]);

  // =========================================
  // MANUAL SWITCHING OF ADDRESS TYPE
  // (User taps the cards in checkout screen)
  // =========================================
  useEffect(() => {
    if (!profileData) return;

    if (addressType === "signup" && profileData.deliveryAddress) {
      setSelectedAddress({
        ...profileData.deliveryAddress,
        coordinates: {
          latitude: Number(profileData.deliveryAddress?.coordinates?.latitude),
          longitude: Number(profileData.deliveryAddress?.coordinates?.longitude),
        },
      });
    }

    if (addressType === "current" && currentLocation) {
      const latitude =
        currentLocation?.coordinates?.latitude ??
        currentLocation?.latitude ??
        null;

      const longitude =
        currentLocation?.coordinates?.longitude ??
        currentLocation?.longitude ??
        null;

      setSelectedAddress({
        addressLine1: currentLocation.formattedAddress || "Current Location",
        city: "",
        state: "",
        pincode: "",
        landmark: "",
        coordinates: {
          latitude: Number(latitude),
          longitude: Number(longitude),
        },
      });
    }
  }, [addressType]);

  // =========================================
  // PLACE ORDER
  // =========================================
  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      return Alert.alert("Missing Address", "Please select a delivery address.");
    }

    if (!selectedAddress?.coordinates?.latitude) {
      return Alert.alert("Missing Coordinates", "Address does not have coordinates");
    }

    try {
      const valid = await validateToken();
      if (!valid) return logout();

      setLoading(true);

      const body = {
        items: items.map((i) => ({
          productId: i.product._id,
          quantity: i.quantity,
        })),
        deliveryAddress: selectedAddress,
        paymentMethod: selectedPayment,
      };

      const res = await fetch(`${API_BASE_URL}/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      clearCart();
      setOrderSuccess(true);

      setTimeout(() => router.push("/(tabs)/orders"), 3000);
    } catch (err) {
      Alert.alert("Order Failed", err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const formatAddress = (addr) => {
    if (!addr) return "";
    return [
      addr.addressLine1,
      addr.addressLine2,
      addr.landmark,
      `${addr.city}, ${addr.state} - ${addr.pincode}`,
    ]
      .filter(Boolean)
      .join(", ");
  };

  // =========================================
  // UI LOADING / EMPTY STATES
  // =========================================
  if (fetchingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading addresses...</Text>
      </View>
    );
  }

  if (!profileData?.deliveryAddress) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.noAddressContainer}>
          <Ionicons name="location-outline" size={70} color={Colors.light.border} />
          <Text style={styles.noAddressTitle}>No Address Found</Text>
          <TouchableOpacity
            style={styles.addAddressButton}
            onPress={() => router.push("/profile")}
          >
            <Text style={styles.addAddressButtonText}>Add Address</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // =========================================
  // MAIN UI
  // =========================================

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* DELIVERY ADDRESS SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <TouchableOpacity onPress={() => router.push("/profile")}>
              <Text style={styles.manageBtn}>+ Manage</Text>
            </TouchableOpacity>
          </View>

          {/* SIGNUP ADDRESS */}
          <TouchableOpacity
            style={[
              styles.addressCard,
              addressType === "signup" && styles.addressCardSelected,
            ]}
            onPress={() => setAddressType("signup")}
          >
            <View style={styles.addressHeader}>
              <View style={styles.addressIconContainer}>
                <Ionicons name="location-outline" size={20} color={Colors.light.accent} />
              </View>

              <View style={styles.addressInfo}>
                <Text style={styles.addressName}>
                  {profileData.personalInfo?.fullName}
                </Text>
                <Text style={styles.addressText}>
                  {formatAddress(profileData.deliveryAddress)}
                </Text>
              </View>

              {addressType === "signup" && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.light.accent} />
              )}
            </View>
          </TouchableOpacity>

          {/* CURRENT LOCATION */}
          <TouchableOpacity
            style={[
              styles.currentLocCard,
              addressType === "current" && styles.addressCardSelected,
              !currentLocation && styles.disabledCard,
            ]}
            onPress={() => {
              if (currentLocation) {
                setAddressType("current");
              } else {
                Alert.alert("No Current Location", "Please enable location services.");
              }
            }}
            disabled={!currentLocation}
          >
            <View style={styles.currentLocHeader}>
              <View style={styles.currentLocIconContainer}>
                <Ionicons name="navigate-outline" size={20} color={Colors.light.accent} />
              </View>
              
              <View style={styles.currentLocInfo}>
                <Text style={styles.currentLocTitle}>Use Current Location</Text>
                
                {currentLocation?.formattedAddress ? (
                  <Text style={styles.currentLocText}>
                    {currentLocation.formattedAddress}
                  </Text>
                ) : (
                  <Text style={styles.currentLocText}>
                    Location not available
                  </Text>
                )}
              </View>

              {addressType === "current" && currentLocation && (
                <Ionicons name="checkmark-circle" size={24} color={Colors.light.accent} />
              )}
            </View>
          </TouchableOpacity>

          {/* AUTO-SELECTION INFO */}
          {usedLocationType && (
            <View style={styles.autoSelectInfo}>
              <Ionicons name="information-circle-outline" size={16} color="#666" />
              <Text style={styles.autoSelectText}>
                {usedLocationType === "signup" 
                  ? "Automatically selected your saved address" 
                  : "Automatically selected your current location"}
              </Text>
            </View>
          )}
        </View>

        {/* PAYMENT */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>

          {["upi", "card", "cod"].map((method) => (
            <TouchableOpacity
              key={method}
              style={[
                styles.paymentCard,
                selectedPayment === method && styles.paymentCardSelected,
              ]}
              onPress={() => setSelectedPayment(method)}
            >
              <View style={styles.paymentIconContainer}>
                <Ionicons
                  name={
                    method === "upi"
                      ? "wallet-outline"
                      : method === "card"
                      ? "card-outline"
                      : "cash-outline"
                  }
                  size={24}
                  color={Colors.light.accent}
                />
              </View>

              <View style={styles.paymentInfo}>
                <Text style={styles.paymentName}>
                  {method === "upi"
                    ? "UPI"
                    : method === "card"
                    ? "Card"
                    : "Cash on Delivery"}
                </Text>
              </View>

              {selectedPayment === method && (
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={Colors.light.accent}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ORDER SUMMARY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>

          <View style={styles.summaryCard}>
            {items.map((item) => (
              <View key={item.product._id} style={styles.summaryItem}>
                <Text style={styles.summaryItemName}>
                  {item.product.name} x {item.quantity}
                </Text>
                <Text style={styles.summaryItemPrice}>
                  ₹{item.product.price * item.quantity}
                </Text>
              </View>
            ))}

            <View style={styles.summaryDivider} />

            <View style={styles.summaryItem}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalAmount}>₹{getTotalPrice()}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* FOOTER */}
      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalAmount}>₹{getTotalPrice()}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            loading && styles.buttonDisabled,
          ]}
          onPress={handlePlaceOrder}
          disabled={loading}
        >
          <Text style={styles.placeOrderButtonText}>
            {loading ? "Placing Order..." : `Place Order - ₹${getTotalPrice()}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ===================== STYLES ===================== //
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  content: { flex: 1 },

  section: { marginTop: 16, paddingHorizontal: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between" },
  sectionTitle: { fontSize: 18, fontWeight: "700" },

  addressCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    marginBottom: 10,
  },
  currentLocCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  addressCardSelected: {
    borderColor: Colors.light.accent,
  },
  disabledCard: {
    opacity: 0.6,
  },

  addressHeader: { 
    flexDirection: "row",
    alignItems: "center",
  },
  currentLocHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  addressIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: Colors.light.backgroundLight,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  currentLocIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: Colors.light.backgroundLight,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  addressInfo: { flex: 1 },
  currentLocInfo: { flex: 1 },
  addressName: { fontSize: 16, fontWeight: "700" },
  addressText: { fontSize: 14, color: Colors.light.textSecondary },
  currentLocTitle: { fontWeight: "700", fontSize: 15 },
  currentLocText: { marginTop: 4, fontSize: 13, color: "#6B7280" },

  manageBtn: { fontSize: 14, color: Colors.light.tint },

  // Auto-selection info
  autoSelectInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  autoSelectText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 6,
  },

  paymentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  paymentCardSelected: { borderColor: Colors.light.accent },

  paymentIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: Colors.light.backgroundLight,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  paymentInfo: { flex: 1 },
  paymentName: { fontSize: 16, fontWeight: "700" },

  summaryCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  summaryItemName: { fontSize: 14, color: Colors.light.textSecondary },
  summaryItemPrice: { fontSize: 14, fontWeight: "600" },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  summaryTotalLabel: { fontSize: 16, fontWeight: "700" },
  summaryTotalAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.accent,
  },

  footer: {
    padding: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: Colors.light.border,
  },
  totalContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  totalLabel: { fontSize: 15, color: Colors.light.textSecondary },
  totalAmount: { fontSize: 22, fontWeight: "700" },

  placeOrderButton: {
    backgroundColor: Colors.light.tint,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  placeOrderButtonText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noAddressContainer: { alignItems: "center", marginTop: 50 },
  addAddressButton: {
    backgroundColor: Colors.light.tint,
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  addAddressButtonText: { color: "#fff", fontWeight: "700" },
});