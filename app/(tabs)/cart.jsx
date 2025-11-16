// C:\Users\Krishna\OneDrive\Desktop\frontend-dairy9\9dairy-UI\app\(tabs)\cart.jsx
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
  Platform,
  Modal,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProfile } from "@/contexts/ProfileContext";

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MIN_TOUCH = 44;

export default function CartScreen() {
  const { items, addToCart, removeFromCart, getTotalPrice, clearCart, setItemQuantity } = useCart();
  const { authToken, isAuthenticated, validateToken, logout } = useAuth();
  const profile = useProfile(); // contains assignedRetailer, deliveryAddress, currentLocation (we will not display)
  const serverAssignedRetailer = profile?.assignedRetailer ?? null;
  const profileDeliveryAddress = profile?.deliveryAddress ?? null;
  const profileCurrentLocation = profile?.currentLocation ?? null;

  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(false); // for network ops
  const [busy, setBusy] = useState(false); // for validation/short ops
  const [inventory, setInventory] = useState([]); // latest retailer inventory
  const [assigning, setAssigning] = useState(false);
  const [itemStatuses, setItemStatuses] = useState({}); // productId -> { available, reason, availableQty, priceUsed }

  // chosenAddress handled at checkout — cart will not show or change address
  const [chosenAddress, setChosenAddress] = useState(null);

  // helpers: product id normalization
  const productIdOf = (p) => p?.id || p?._id || p?.productId || null;

  // ----------------------
  // Fetch inventory for assigned retailer (customer endpoint)
  // ----------------------
  const fetchInventoryForCustomer = async () => {
    if (!authToken) return [];
    try {
      const res = await fetch(`${API_BASE_URL}/customer/inventory`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
      });
      const j = await res.json();
      if (!res.ok) {
        console.warn("Inventory fetch failed:", j);
        return [];
      }
      return j?.data?.inventory ?? [];
    } catch (err) {
      console.error("Inventory fetch error:", err);
      return [];
    }
  };

  // ----------------------
  // Reconcile cart against inventory
  // ----------------------
  const reconcileCartWithInventory = (inv = []) => {
    const map = new Map();
    inv.forEach((entry) => {
      const prod = entry?.product ?? {};
      const idKeys = [prod?.id, prod?._id, prod?.productId, prod?.sku].filter(Boolean);
      idKeys.forEach((k) => map.set(String(k), entry));
      if (prod?.name) map.set(`name:${prod.name.toLowerCase().trim()}`, entry);
    });

    const statuses = {};
    items.forEach((cartItem) => {
      const pid = productIdOf(cartItem.product);
      let matched = null;
      if (pid && map.has(String(pid))) matched = map.get(String(pid));
      else if (cartItem.product?.name && map.has(`name:${cartItem.product.name.toLowerCase().trim()}`)) {
        matched = map.get(`name:${cartItem.product.name.toLowerCase().trim()}`);
      }

      if (!matched) {
        statuses[pid || cartItem.product._id] = {
          available: false,
          reason: "not_sold_by_retailer",
          availableQty: 0,
          priceUsed: cartItem.product.price ?? 0,
        };
      } else {
        const stock = matched.currentStock ?? null;
        const sellingPrice = matched.sellingPrice ?? null;
        if (stock === null || stock === undefined) {
          statuses[pid] = {
            available: true,
            reason: "available_unknown_stock",
            availableQty: Number.MAX_SAFE_INTEGER,
            priceUsed: sellingPrice ?? cartItem.product.price ?? 0,
          };
        } else if (Number(stock) <= 0) {
          statuses[pid] = {
            available: false,
            reason: "out_of_stock",
            availableQty: 0,
            priceUsed: sellingPrice ?? cartItem.product.price ?? 0,
          };
        } else {
          const qty = cartItem.quantity ?? 0;
          statuses[pid] = {
            available: Number(stock) >= qty,
            reason: Number(stock) >= qty ? "ok" : "partial_stock",
            availableQty: Number(stock),
            priceUsed: sellingPrice ?? cartItem.product.price ?? 0,
          };
        }
      }
    });

    setItemStatuses(statuses);
    return statuses;
  };

  // ----------------------
  // Totals using retailer price when available
  // ----------------------
  const computedTotals = useMemo(() => {
    let itemsTotal = 0;
    items.forEach((it) => {
      const pid = productIdOf(it.product);
      const status = itemStatuses[pid];
      const price = status?.priceUsed ?? it.product?.price ?? 0;
      itemsTotal += Number(price) * (it.quantity ?? 0);
    });
    return { itemsTotal };
  }, [items, itemStatuses]);

  // ----------------------
  // Derived flags
  // ----------------------
  const { hasUnavailable, unavailableItems, hasPartial } = useMemo(() => {
    const unavailable = [];
    const partial = [];
    Object.entries(itemStatuses).forEach(([pid, s]) => {
      if (!s) return;
      if (!s.available && (s.reason === "not_sold_by_retailer" || s.reason === "out_of_stock")) unavailable.push(pid);
      if (s.reason === "partial_stock") partial.push({ pid, availableQty: s.availableQty });
    });
    return {
      hasUnavailable: unavailable.length > 0,
      unavailableItems: unavailable,
      hasPartial: partial.length > 0,
    };
  }, [itemStatuses]);

  // ----------------------
  // Init: fetch inventory if retailer exists (silent); reconcile cart
  // ----------------------
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      setLoading(true);
      try {
        if (!authToken) {
          setLoading(false);
          return;
        }

        // fetch inventory for customer (server-side assignment applies)
        const inv = await fetchInventoryForCustomer();
        if (!mounted) return;
        setInventory(inv);
        reconcileCartWithInventory(inv);

        // do not change or show chosenAddress here — checkout will handle it
        // keep chosenAddress null (checkout uses profile or ask at checkout)
      } catch (err) {
        console.error("Init cart error:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, serverAssignedRetailer]);

  // ----------------------
  // Auth helpers
  // ----------------------
  const handleApiAuthIssue = () => {
    Alert.alert("Session Expired", "Please login again.", [{ text: "OK", onPress: () => logout() }]);
  };

  const validateAuthBeforeCall = async () => {
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
  };

  // ----------------------
  // Remove item helper
  // ----------------------
  const removeItem = (product) => {
    const pid = productIdOf(product);
    removeFromCart(pid);
    setItemStatuses((prev) => {
      const copy = { ...prev };
      delete copy[pid];
      return copy;
    });
  };

  // ----------------------
  // Continue to checkout flow
  // ----------------------
  const handleContinueToCheckout = async () => {
    if (items.length === 0) {
      Alert.alert("Cart empty", "Add some items before checkout.");
      return;
    }

    const ok = await validateAuthBeforeCall();
    if (!ok) return;

    // re-validate inventory silently
    setBusy(true);
    try {
      const inv = await fetchInventoryForCustomer();
      setInventory(inv);
      const statuses = reconcileCartWithInventory(inv);

      // compute unavailable & partial with product names
      const unavailable = [];
      const partial = [];

      items.forEach((it) => {
        const pid = productIdOf(it.product);
        const s = statuses[pid];
        if (!s) unavailable.push({ product: it.product, reason: "unknown" });
        else if (!s.available && (s.reason === "not_sold_by_retailer" || s.reason === "out_of_stock")) unavailable.push({ product: it.product, reason: s.reason });
        else if (s.reason === "partial_stock") partial.push({ product: it.product, availableQty: s.availableQty });
      });

      if (unavailable.length > 0) {
        Alert.alert(
          "Some items are unavailable",
          `The following items are not available from your assigned retailer:\n\n${unavailable.map(u => `• ${u.product.name}`).join("\n")}\n\nRemove them to continue.`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Remove items",
              style: "destructive",
              onPress: () => unavailable.forEach(u => removeItem(u.product)),
            }
          ]
        );
        setBusy(false);
        return;
      }

      if (partial.length > 0) {
        Alert.alert(
          "Limited stock",
          `Some items have less stock than requested. Example:\n\n${partial.map(p => `• ${p.product.name} — available ${p.availableQty}`).join("\n")}\n\nAuto-adjust to available quantity?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Auto-adjust",
              onPress: () => {
                partial.forEach(p => {
                  const pid = productIdOf(p.product);
                  try {
                    if (setItemQuantity) setItemQuantity(pid, p.availableQty);
                    else {
                      removeFromCart(pid);
                      for (let i = 0; i < p.availableQty; i++) addToCart(p.product);
                    }
                  } catch (e) {
                    console.warn("Auto-adjust failed", e);
                  }
                });
                // After adjustments user should re-continue
              }
            }
          ]
        );
        setBusy(false);
        return;
      }

      // Everything good -> go to checkout. Checkout screen should request/confirm address.
      router.push({
        pathname: "/checkout",
        params: { chosenAddressType: null } // checkout will handle selecting address
      });
    } catch (err) {
      console.error("Checkout validation error:", err);
      Alert.alert("Error", "Failed to validate cart. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  // ----------------------
  // Optional: place order directly
  // ----------------------
  const placeOrderNow = async () => {
    const ok = await validateAuthBeforeCall();
    if (!ok) return;
    setLoading(true);
    try {
      const payloadItems = items.map((it) => {
        const pid = productIdOf(it.product);
        const status = itemStatuses[pid];
        const price = status?.priceUsed ?? it.product?.price ?? 0;
        return { productId: pid, quantity: it.quantity, unitPrice: price };
      });

      // Checkout will provide address; we send a placeholder here or you can remove this function if not used.
      const deliveryAddress = profileDeliveryAddress ?? {};

      const orderData = { items: payloadItems, deliveryAddress, paymentMethod: "cash" };

      const res = await fetch(`${API_BASE_URL}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(orderData),
      });

      const j = await res.json();
      if (!res.ok) {
        if (j?.message?.includes("Unauthorized") || j?.status === 401) { handleApiAuthIssue(); return; }
        throw new Error(j?.message || "Order failed");
      }

      if (j?.success) {
        Alert.alert("Order Placed", `Order id: ${j.order.orderId}\nTotal: ₹${j.order.finalAmount}`, [
          { text: "OK", onPress: () => { clearCart(); router.push("/(tabs)/orders"); } }
        ]);
      } else throw new Error(j?.message || "Order failed");
    } catch (err) {
      console.error("Place order error:", err);
      Alert.alert("Error", err.message || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

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
            const status = itemStatuses[pid] ?? {};
            const availabilityText = !status.available
              ? status.reason === "not_sold_by_retailer" ? "Not sold by retailer" : status.reason === "out_of_stock" ? "Out of stock" : "Unavailable"
              : status.reason === "partial_stock" ? `Only ${status.availableQty} available` : "";

            const priceToShow = status?.priceUsed ?? item.product.price ?? 0;

            return (
              <View key={pid || item.product._id} style={styles.cartItem}>
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
                    <Text style={[styles.availabilityText, status.available ? styles.availableText : styles.unavailableText]}>
                      {availabilityText}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.quantityContainer}>
                  <TouchableOpacity style={styles.quantityButton} onPress={() => removeFromCart(pid)} disabled={busy} accessibilityLabel="Decrease quantity">
                    <Feather name="minus" size={16} color={Colors.light.text} />
                  </TouchableOpacity>

                  <Text style={styles.quantity}>{item.quantity}</Text>

                  <TouchableOpacity style={styles.quantityButton} onPress={() => addToCart(item.product)} disabled={busy} accessibilityLabel="Increase quantity">
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

        <View style={styles.infoSection}>
          <View style={{ marginTop: 12 }}>
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              {/* No 'Use current' or 'Use home' toggles here — address handled at checkout */}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.totalSection}>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerTotal}>₹{computedTotals.itemsTotal.toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.checkoutButton, (busy || loading || hasUnavailable) && styles.buttonDisabled]}
          onPress={handleContinueToCheckout}
          disabled={busy || loading || hasUnavailable}
          accessibilityLabel="Continue to checkout"
        >
          {busy || loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutButtonText}>{hasUnavailable ? "Resolve items" : "Continue"}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* Styles (kept compact and responsive) */
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
  infoSection: { marginHorizontal: 16, backgroundColor: "#FFF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.light.border, marginBottom: 12 },
  infoItem: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  infoText: { fontSize: 14, color: Colors.light.textSecondary, marginLeft: 8 },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#FFF", borderTopWidth: 1, borderTopColor: Colors.light.border, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 16, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 8 },
  totalSection: { flex: 1 },
  footerLabel: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: 2 },
  footerTotal: { fontSize: 20, fontWeight: "700", color: Colors.light.text },
  checkoutButton: { backgroundColor: Colors.light.tint, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, minWidth: 120, alignItems: "center", justifyContent: "center" },
  buttonDisabled: { backgroundColor: "#9ca3af" },
  checkoutButtonText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  smallToggle: { backgroundColor: Colors.light.tint, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginRight: 8, minHeight: MIN_TOUCH, justifyContent: "center" },
  smallToggleText: { color: "#fff", fontWeight: "700" },
  smallToggleGhost: { backgroundColor: "#F3F4F6", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, minHeight: MIN_TOUCH, justifyContent: "center" },
  smallToggleGhostText: { color: Colors.light.text },
});

/* Modal styles (kept if you later want to re-enable modal) */
const modalStyles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center" },
  modalBox: { width: Math.min(520, SCREEN_WIDTH - 40), backgroundColor: "#FFF", borderRadius: 12, padding: 18, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, elevation: Platform.OS === "android" ? 6 : 12 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 6, color: Colors.light.text },
  subtitle: { color: Colors.light.textSecondary, marginBottom: 12 },
  primaryBtn: { backgroundColor: Colors.light.tint, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, alignItems: "center", justifyContent: "center", marginRight: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  ghostBtn: { backgroundColor: "#F3F4F6", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  ghostBtnText: { color: Colors.light.text },
});
