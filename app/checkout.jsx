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
    usedLocationType,
  } = useProfile();

  const [profileData, setProfileData] = useState(null);
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState("cash");
  const [addressType, setAddressType] = useState("signup");
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

      // Auto-select based on usedLocationType
      if (usedLocationType === "signup" && data.deliveryAddress) {
        setAddressType("signup");
        setSelectedAddress({
          ...data.deliveryAddress,
          coordinates: {
            latitude: Number(data.deliveryAddress?.coordinates?.latitude),
            longitude: Number(data.deliveryAddress?.coordinates?.longitude),
          },
        });
      } else if (usedLocationType === "current" && currentLocation) {
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
  // AUTO-SELECT ADDRESS BASED ON USER ACTION
  // =========================================
  useEffect(() => {
    if (!profileData) return;

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

      const validPaymentMethod = "cash";

      const body = {
        items: items.map((i) => ({
          productId: i.product._id,
          quantity: i.quantity,
        })),
        deliveryAddress: selectedAddress,
        paymentMethod: validPaymentMethod,
      };

      console.log("📦 Placing order with payment method:", validPaymentMethod);

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

      Alert.alert("Order Placed", "Your order has been placed successfully!", [
        { text: "OK", onPress: () => router.push("/(tabs)/orders") }
      ]);
    } catch (err) {
      console.error("Order error:", err);
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
        <Text style={styles.loadingText}>Loading addresses...</Text>
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

      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >

        {/* DELIVERY ADDRESS SECTION */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
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

        {/* PAYMENT METHOD SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>

          {[
            { key: "upi", label: "UPI", icon: "wallet-outline", status: "coming_soon" },
            { key: "card", label: "Card", icon: "card-outline", status: "coming_soon" },
            { key: "cash", label: "Cash on Delivery", icon: "cash-outline", status: "available" }
          ].map((method) => (
            <TouchableOpacity
              key={method.key}
              style={[
                styles.paymentCard,
                selectedPayment === method.key && styles.paymentCardSelected,
                method.status === "coming_soon" && styles.comingSoonCard
              ]}
              onPress={() => {
                if (method.status === "available") {
                  setSelectedPayment(method.key);
                } else {
                  Alert.alert("Coming Soon", `${method.label} payment will be available soon!`);
                }
              }}
              disabled={method.status === "coming_soon"}
            >
              <View style={styles.paymentIconContainer}>
                <Ionicons
                  name={method.icon}
                  size={24}
                  color={method.status === "coming_soon" ? Colors.light.textSecondary : Colors.light.accent}
                />
              </View>

              <View style={styles.paymentInfo}>
                <Text style={[
                  styles.paymentName,
                  method.status === "coming_soon" && styles.comingSoonText
                ]}>
                  {method.label}
                </Text>
                {method.status === "coming_soon" && (
                  <Text style={styles.comingSoonBadge}>Coming Soon</Text>
                )}
              </View>

              {selectedPayment === method.key && method.status === "available" && (
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={Colors.light.accent}
                />
              )}
              
              {method.status === "coming_soon" && (
                <Ionicons
                  name="lock-closed"
                  size={20}
                  color={Colors.light.textSecondary}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* ORDER SUMMARY SECTION */}
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

            <View style={styles.summaryTotal}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalAmount}>₹{getTotalPrice()}</Text>
            </View>
          </View>
        </View>

        {/* BOTTOM SPACER FOR FOOTER */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* FOOTER */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
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

      {/* ORDER SUCCESS MODAL */}
      {orderSuccess && (
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            <Text style={styles.successTitle}>Order Placed!</Text>
            <Text style={styles.successSubtitle}>Your order has been placed successfully</Text>
            <Text style={styles.successNote}>Payment: Cash on Delivery</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ===================== STYLES ===================== //
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors.light.background 
  },
  
  // HEADER STYLES
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  headerSpacer: {
    width: 24,
  },

  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // SECTION STYLES
  section: { 
    marginTop: 24, 
    paddingHorizontal: 20 
  },
  sectionHeader: { 
    marginBottom: 16 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '700',
    color: Colors.light.text 
  },

  // ADDRESS CARD STYLES
  addressCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  addressCardSelected: {
    borderColor: Colors.light.accent,
    backgroundColor: "#F0F9FF",
  },
  addressHeader: { 
    flexDirection: "row",
    alignItems: "flex-start",
  },
  addressIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: Colors.light.backgroundLight,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  addressInfo: { 
    flex: 1,
    marginRight: 12,
  },
  addressName: { 
    fontSize: 16, 
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 4,
  },
  addressText: { 
    fontSize: 14, 
    color: Colors.light.textSecondary,
    lineHeight: 18,
  },

  // CURRENT LOCATION STYLES
  currentLocCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  disabledCard: {
    opacity: 0.6,
  },
  currentLocHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  currentLocIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: Colors.light.backgroundLight,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 2,
  },
  currentLocInfo: { 
    flex: 1,
    marginRight: 12,
  },
  currentLocTitle: { 
    fontWeight: "700", 
    fontSize: 16,
    color: Colors.light.text,
    marginBottom: 4,
  },
  currentLocText: { 
    fontSize: 14, 
    color: "#6B7280",
    lineHeight: 18,
  },

  // AUTO-SELECTION INFO
  autoSelectInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  autoSelectText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 8,
    flex: 1,
  },

  // PAYMENT CARD STYLES
  paymentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  paymentCardSelected: { 
    borderColor: Colors.light.accent,
    backgroundColor: "#F0F9FF"
  },
  comingSoonCard: {
    opacity: 0.7,
  },
  paymentIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: Colors.light.backgroundLight,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  paymentInfo: { 
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  paymentName: { 
    fontSize: 16, 
    fontWeight: "600",
    color: Colors.light.text
  },
  comingSoonText: {
    color: Colors.light.textSecondary,
  },
  comingSoonBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  // ORDER SUMMARY STYLES
  summaryCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  summaryItemName: { 
    fontSize: 15, 
    color: Colors.light.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  summaryItemPrice: { 
    fontSize: 15, 
    fontWeight: "600",
    color: Colors.light.text
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 12,
  },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryTotalLabel: { 
    fontSize: 17, 
    fontWeight: "700",
    color: Colors.light.text
  },
  summaryTotalAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.accent,
  },

  // FOOTER STYLES
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 8,
  },
  totalContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  totalLabel: { 
    fontSize: 16, 
    fontWeight: "600",
    color: Colors.light.textSecondary 
  },
  totalAmount: { 
    fontSize: 24, 
    fontWeight: "700",
    color: Colors.light.accent
  },
  placeOrderButton: {
    backgroundColor: Colors.light.tint,
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: Colors.light.tint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: { 
    opacity: 0.6 
  },
  placeOrderButtonText: { 
    color: "#fff", 
    fontWeight: "700", 
    fontSize: 16 
  },

  // LOADING AND EMPTY STATES
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.light.background,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 12,
  },
  noAddressContainer: { 
    flex: 1,
    justifyContent: "center", 
    alignItems: "center", 
    paddingHorizontal: 40 
  },
  noAddressTitle: { 
    fontSize: 18, 
    fontWeight: "600", 
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  addAddressButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  addAddressButtonText: { 
    color: "#fff", 
    fontWeight: "600",
    fontSize: 16,
  },

  // BOTTOM SPACER
  bottomSpacer: {
    height: 20,
  },

  // SUCCESS MODAL STYLES
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  successModal: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
    margin: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.light.text,
    marginTop: 16,
  },
  successSubtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  successNote: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 12,
    fontWeight: '600',
  },
});