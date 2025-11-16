// app/(tabs)/cart.jsx
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "@/contexts/ProfileContext";

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MIN_TOUCH = 44;

export default function CartScreen() {
  const { 
    items, 
    addToCart, 
    removeFromCart, 
    getTotalPrice, 
    clearCart, 
    setItemQuantity,
    hasUnavailableItems,
    getItemStatus,
    cartItemsStatus
  } = useCart();
  
  const { authToken, isAuthenticated, validateToken, logout } = useAuth();
  const { checkCartItemsAvailability } = useProfile();

  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  // helpers: product id normalization
  const productIdOf = (p) => p?.id || p?._id || p?.productId || null;

  // ----------------------
  // Totals using retailer price when available
  // ----------------------
  const computedTotals = useMemo(() => {
    let itemsTotal = 0;
    items.forEach((it) => {
      const pid = productIdOf(it.product);
      const status = getItemStatus(pid);
      const price = status?.priceUsed ?? it.product?.price ?? 0;
      itemsTotal += Number(price) * (it.quantity ?? 0);
    });
    return { itemsTotal };
  }, [items, getItemStatus]);

  // ----------------------
  // FIXED: Refresh cart status only once when screen focuses
  // ----------------------
  useEffect(() => {
    if (items.length > 0) {
      const timer = setTimeout(() => {
        checkCartItemsAvailability(items);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, []); // ⭐ Empty dependency array - run only once

  // ----------------------
  // Auth helpers
  // ----------------------
  const handleApiAuthIssue = useCallback(() => {
    Alert.alert("Session Expired", "Please login again.", [{ text: "OK", onPress: () => logout() }]);
  }, [logout]);

  const validateAuthBeforeCall = useCallback(async () => {
    if (!authToken || !isAuthenticated) {
      Alert.alert("Login Required", "Please login to place an order", [{ text: "Cancel", style: "cancel" }, { text: "Login", onPress: () => router.push("/Login") }]);
      return false;
    }
    const isValid = await validateToken();
    if (!isValid) {
      handleApiAuthIssue();
      return false;
    }
    return true;
  }, [authToken, isAuthenticated, validateToken, handleApiAuthIssue, router]);

  // ----------------------
  // Handle resolve unavailable items
  // ----------------------
  const handleResolveUnavailableItems = useCallback(() => {
    const unavailableItems = items.filter(item => {
      const status = getItemStatus(productIdOf(item.product));
      return status?.isOutOfStock;
    });

    if (unavailableItems.length > 0) {
      Alert.alert(
        "Remove Unavailable Items",
        `The following items are not available at your current location:\n\n${unavailableItems.map(item => `• ${item.product.name}`).join('\n')}\n\nDo you want to remove them?`,
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Remove All", 
            style: "destructive",
            onPress: () => {
              unavailableItems.forEach(item => {
                removeFromCart(productIdOf(item.product));
              });
            }
          }
        ]
      );
    }
  }, [items, getItemStatus, removeFromCart]);

  // ----------------------
  // Continue to checkout flow
  // ----------------------
  const handleContinueToCheckout = useCallback(async () => {
    if (items.length === 0) {
      Alert.alert("Cart empty", "Add some items before checkout.");
      return;
    }

    const ok = await validateAuthBeforeCall();
    if (!ok) return;

    // Refresh cart status
    setBusy(true);
    await checkCartItemsAvailability(items);

    // Check if still has unavailable items
    if (hasUnavailableItems()) {
      Alert.alert(
        "Unavailable Items", 
        "Some items in your cart are not available at your current location. Please remove them to continue.",
        [{ text: "OK" }]
      );
      setBusy(false);
      return;
    }

    // Check for items needing quantity adjustment
    const itemsNeedingAdjustment = cartItemsStatus.filter(item => 
      item.isAvailable && item.availableStock < item.requestedQuantity
    );

    if (itemsNeedingAdjustment.length > 0) {
      const adjustmentMessage = itemsNeedingAdjustment.map(item => {
        const product = items.find(i => productIdOf(i.product) === item.productId);
        return `• ${product?.product.name} - Available: ${item.availableQty}`;
      }).join('\n');

      Alert.alert(
        "Limited Stock Available",
        `Some items have limited stock:\n\n${adjustmentMessage}\n\nWe'll auto-adjust quantities for you.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Auto-Adjust & Continue",
            onPress: () => {
              // Auto-adjust quantities
              itemsNeedingAdjustment.forEach(adjustment => {
                setItemQuantity(adjustment.productId, adjustment.availableQty);
              });
              
              // Proceed to checkout after adjustment
              setTimeout(() => {
                router.push({
                  pathname: "/checkout",
                  params: { chosenAddressType: null }
                });
              }, 1000);
            }
          }
        ]
      );
      setBusy(false);
      return;
    }

    // Everything is good, proceed to checkout
    router.push({
      pathname: "/checkout",
      params: { chosenAddressType: null }
    });
    setBusy(false);
  }, [items, validateAuthBeforeCall, checkCartItemsAvailability, hasUnavailableItems, cartItemsStatus, setItemQuantity, router]);

  // ----------------------
  // Empty state UI
  // ----------------------
  if (items.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Cart</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="bag-outline" size={80} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtext}>Add something fresh from our dairy collection!</Text>
          <TouchableOpacity style={styles.shopNowButton} onPress={() => router.push("/(tabs)")} activeOpacity={0.8}>
            <Text style={styles.shopNowText}>Shop Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ----------------------
  // Main render
  // ----------------------
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cart</Text>

        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => {
              Alert.alert("Clear cart", "Are you sure?", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: clearCart }]);
            }}
            style={styles.clearButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Clear cart"
          >
            <MaterialIcons name="delete-outline" size={20} color={Colors.light.tint} />
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.itemsList}>
          {items.map((item) => {
            const pid = productIdOf(item.product);
            const status = getItemStatus(pid);
            
            const availabilityText = status?.isOutOfStock 
              ? "Not available at this location"
              : status?.outOfStockMessage || "";

            const priceToShow = status?.priceUsed ?? item.product.price ?? 0;

            return (
              <View key={pid || item.product._id} style={[
                styles.cartItem,
                status?.isOutOfStock && styles.unavailableItem
              ]}>
                <Image
                  source={typeof item.product.image === "string" ? { uri: item.product.image } : item.product.image ? item.product.image : require("../../assets/images/NO-IMAGE.png")}
                  style={styles.productImage}
                  resizeMode="cover"
                />
                <View style={styles.itemInfo}>
                  <Text style={styles.productName}>{item.product.name}</Text>
                  <Text style={styles.productUnit}>{item.product.unit}</Text>
                  <Text style={styles.productPrice}>₹{priceToShow}</Text>

                  {availabilityText ? (
                    <Text style={[
                      styles.availabilityText, 
                      status?.isOutOfStock ? styles.unavailableText : styles.availableText
                    ]}>
                      {availabilityText}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.quantityContainer}>
                  <TouchableOpacity 
                    style={styles.quantityButton} 
                    onPress={() => removeFromCart(pid)} 
                    disabled={busy}
                  >
                    <Feather name="minus" size={16} color={Colors.light.text} />
                  </TouchableOpacity>

                  <Text style={styles.quantity}>{item.quantity}</Text>

                  <TouchableOpacity 
                    style={styles.quantityButton} 
                    onPress={() => addToCart(item.product)} 
                    disabled={busy}
                  >
                    <Feather name="plus" size={16} color={Colors.light.text} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.billSection}>
          <Text style={styles.billTitle}>Bill Details</Text>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total</Text>
            <Text style={styles.billValue}>₹{computedTotals.itemsTotal.toFixed(2)}</Text>
          </View>

          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Fee</Text>
            <Text style={styles.billValueFree}>FREE</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.billRow}>
            <Text style={styles.totalLabel}>To Pay</Text>
            <Text style={styles.totalValue}>₹{computedTotals.itemsTotal.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.totalSection}>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerTotal}>₹{computedTotals.itemsTotal.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.checkoutButton, 
            (busy || loading || hasUnavailableItems()) && styles.buttonDisabled
          ]}
          onPress={hasUnavailableItems() ? handleResolveUnavailableItems : handleContinueToCheckout}
          disabled={busy || loading}
        >
          {busy || loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.checkoutButtonText}>
              {hasUnavailableItems() 
                ? "Resolve Unavailable Items" 
                : `Continue - ₹${getTotalPrice()}`
              }
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}


// Styles remain the same as your original...
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.light.border },
  headerTitle: { fontSize: Math.max(20, Math.floor(SCREEN_WIDTH * 0.06)), fontWeight: "700", color: Colors.light.text },
  clearButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 6 },
  clearText: { fontSize: 14, fontWeight: "600", color: Colors.light.tint, marginLeft: 6 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  emptyTitle: { fontSize: 20, fontWeight: "700", color: Colors.light.text, marginTop: 24, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: Colors.light.textSecondary, textAlign: "center", marginBottom: 24 },
  shopNowButton: { backgroundColor: Colors.light.tint, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  shopNowText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 160 },
  itemsList: { padding: 12 },
  cartItem: { flexDirection: "row", backgroundColor: "#FFF", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.light.border, alignItems: "center" },
  unavailableItem: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  productImage: { width: Math.min(96, Math.floor(SCREEN_WIDTH * 0.22)), height: Math.min(96, Math.floor(SCREEN_WIDTH * 0.22)), borderRadius: 8, backgroundColor: "#f5f5f5" },
  itemInfo: { flex: 1, marginLeft: 12, justifyContent: "center" },
  productName: { fontSize: 15, fontWeight: "700", color: Colors.light.text, marginBottom: 4 },
  productUnit: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: 4 },
  productPrice: { fontSize: 16, fontWeight: "800", color: Colors.light.text },
  availabilityText: { marginTop: 6, fontSize: 12 },
  availableText: { color: "#15803d" },
  unavailableText: { color: "#B91C1C" },
  quantityContainer: { flexDirection: "row", alignItems: "center", gap: 10 },
  quantityButton: { width: 40, height: 40, borderRadius: 8, backgroundColor: Colors.light.backgroundLight, justifyContent: "center", alignItems: "center", minWidth: MIN_TOUCH, minHeight: MIN_TOUCH },
  quantity: { fontSize: 16, fontWeight: "700", color: Colors.light.text, minWidth: 28, textAlign: "center" },
  billSection: { marginHorizontal: 16, backgroundColor: "#FFF", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.light.border, marginBottom: 16 },
  billTitle: { fontSize: 16, fontWeight: "700", color: Colors.light.text, marginBottom: 12 },
  billRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  billLabel: { fontSize: 14, color: Colors.light.textSecondary },
  billValue: { fontSize: 14, fontWeight: "600", color: Colors.light.text },
  billValueFree: { fontSize: 14, fontWeight: "700", color: "#4CAF50" },
  divider: { height: 1, backgroundColor: Colors.light.border, marginVertical: 12 },
  totalLabel: { fontSize: 16, fontWeight: "700", color: Colors.light.text },
  totalValue: { fontSize: 18, fontWeight: "700", color: Colors.light.text },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: Colors.light.border, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 16, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 8 },
  totalSection: { flex: 1 },
  footerLabel: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: 2 },
  footerTotal: { fontSize: 20, fontWeight: "700", color: Colors.light.text },
  checkoutButton: { backgroundColor: Colors.light.tint, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, minWidth: 120, alignItems: "center", justifyContent: "center" },
  buttonDisabled: { backgroundColor: "#9ca3af" },
  checkoutButtonText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
});