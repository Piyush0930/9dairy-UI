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
  const profile = useProfile(); // contains assignedRetailer, deliveryAddress, currentLocation
  const serverAssignedRetailer = profile?.assignedRetailer ?? null;
  const profileDeliveryAddress = profile?.deliveryAddress ?? null;
  const profileCurrentLocation = profile?.currentLocation ?? null;

  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [loading, setLoading] = useState(false); // for network ops
  const [busy, setBusy] = useState(false); // for validation/short ops
  const [inventory, setInventory] = useState([]); // latest retailer inventory
  const [assignedRetailerLocal, setAssignedRetailerLocal] = useState(null); // local override
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [itemStatuses, setItemStatuses] = useState({}); // productId -> { available, reason, availableQty, priceUsed }

  // chosenAddress is set once (initial selection) or when user explicitly changes it
  const [chosenAddress, setChosenAddress] = useState(null);

  const retailerToUse = assignedRetailerLocal || serverAssignedRetailer || null;

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
  // Assign retailer; do not overwrite chosenAddress unless it's null.
  // ----------------------
  const assignRetailer = async ({ lat, lng, address = "", temporary = true, assignedFrom = "current" } = {}) => {
    if (!authToken) {
      Alert.alert("Login required", "Please login to use location-based retailer assignment.");
      return null;
    }
    setAssigning(true);
    try {
      const body = {};
      if (typeof lat === "number" && typeof lng === "number") {
        body.lat = lat;
        body.lng = lng;
        body.address = address || "";
      }
      body.temporary = !!temporary;

      const res = await fetch(`${API_BASE_URL}/customer/assign-retailer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) {
        console.warn("assign-retailer failed", j);
        Alert.alert("Assignment failed", j?.message || "Unable to assign retailer");
        setAssigning(false);
        return null;
      }

      const { retailer, inventory: inv } = j;
      if (retailer) {
        setAssignedRetailerLocal({ ...retailer, assignedFrom });
        if (!chosenAddress) {
          if (assignedFrom === "current") {
            setChosenAddress({ type: "current", coordinates: { latitude: lat, longitude: lng }, formattedAddress: address || retailer?.location?.formattedAddress || "" });
          } else {
            if (profileDeliveryAddress) setChosenAddress({ type: "home", address: profileDeliveryAddress });
            else setChosenAddress({ type: "current", coordinates: { latitude: lat, longitude: lng }, formattedAddress: address || retailer?.location?.formattedAddress || "" });
          }
        }
      }

      if (Array.isArray(inv)) {
        setInventory(inv);
        reconcileCartWithInventory(inv);
      } else {
        const fetched = await fetchInventoryForCustomer();
        setInventory(fetched);
        reconcileCartWithInventory(fetched);
      }

      setShowAssignModal(false);
      setAssigning(false);
      return { retailer: retailer ?? null, inventory: inv ?? [] };
    } catch (err) {
      console.error("assignRetailer error:", err);
      Alert.alert("Error", "Failed to assign retailer. Try again.");
      setAssigning(false);
      return null;
    }
  };

  // ----------------------
  // Geolocation fallback
  // ----------------------
  const getCurrentLocation = () =>
    new Promise((resolve, reject) => {
      try {
        if (!navigator || !navigator.geolocation) {
          return reject(new Error("Geolocation not available"));
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            resolve({ latitude, longitude });
          },
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
      } catch (e) {
        reject(e);
      }
    });

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
  // Init: fetch inventory if retailer exists, else show assign modal
  // preserve chosenAddress if already set
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

        if (serverAssignedRetailer) {
          const inv = await fetchInventoryForCustomer();
          if (!mounted) return;
          setInventory(inv);
          reconcileCartWithInventory(inv);

          if (!chosenAddress) {
            if (profileCurrentLocation && profileCurrentLocation.coordinates) {
              setChosenAddress({ type: "current", coordinates: profileCurrentLocation.coordinates, formattedAddress: profileCurrentLocation.formattedAddress || "" });
            } else if (profileDeliveryAddress) {
              setChosenAddress({ type: "home", address: profileDeliveryAddress });
            }
          }
        } else {
          // no assigned retailer -> prompt assign modal
          setShowAssignModal(true);
          if (!chosenAddress) {
            if (profileDeliveryAddress) setChosenAddress({ type: "home", address: profileDeliveryAddress });
            else if (profileCurrentLocation && profileCurrentLocation.coordinates) setChosenAddress({ type: "current", coordinates: profileCurrentLocation.coordinates, formattedAddress: profileCurrentLocation.formattedAddress || "" });
          }
        }
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
  // Use current location -> assign retailer temporary
  // ----------------------
  const handleUseCurrentAddress = async () => {
    try {
      setAssigning(true);
      const loc = await getCurrentLocation();
      await assignRetailer({ lat: loc.latitude, lng: loc.longitude, temporary: true, assignedFrom: "current" });
      setAssigning(false);
    } catch (err) {
      console.error("Location error:", err);
      Alert.alert("Location error", "Unable to get current location. Allow permissions or try again.");
      setAssigning(false);
    }
  };

  const handleSkipAssign = async () => {
    setAssigning(true);
    await assignRetailer({ temporary: true, assignedFrom: "home" });
    setAssigning(false);
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

    // re-validate inventory
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

      // Everything good -> go to checkout with chosen address type
      router.push({
        pathname: "/checkout",
        params: { chosenAddressType: chosenAddress?.type ?? (profileDeliveryAddress ? "home" : "current") }
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
  // kept for convenience — uses chosenAddress
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

      const deliveryAddress = chosenAddress?.type === "current"
        ? { coordinates: chosenAddress.coordinates, addressLine1: chosenAddress.formattedAddress || "" }
        : (chosenAddress?.address ?? profileDeliveryAddress ?? {});

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
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={18} color={Colors.light.tint} />
            <Text style={styles.infoText}>Delivery by tomorrow morning</Text>
          </View>

          <View style={styles.infoItem}>
            <Ionicons name="cash-outline" size={18} color={Colors.light.tint} />
            <Text style={styles.infoText}>Cash on delivery available</Text>
          </View>

          {/* Delivery address summary */}
          <View style={{ marginTop: 12 }}>
            <Text style={{ fontWeight: "700", color: Colors.light.text }}>Delivery to</Text>

            {chosenAddress?.type === "current" ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontWeight: "600" }}>{chosenAddress.formattedAddress || "Current location"}</Text>
                <Text style={styles.infoText}>Using current location</Text>
              </View>
            ) : chosenAddress?.type === "home" ? (
              <View style={{ marginTop: 8 }}>
                <Text style={{ fontWeight: "600" }}>{chosenAddress.address?.addressLine1 ?? "Home address"}</Text>
                <Text style={styles.infoText}>{chosenAddress.address?.formattedAddress ?? ""}</Text>
              </View>
            ) : (
              <Text style={styles.infoText}>No delivery address selected</Text>
            )}

            {/* explicit toggles (user action only) */}
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              {profileCurrentLocation && (
                <Pressable
                  style={[styles.smallToggle, { opacity: assigning ? 0.6 : 1 }]}
                  onPress={async () => {
                    try {
                      setAssigning(true);
                      const loc = profileCurrentLocation?.coordinates;
                      if (loc?.latitude && loc?.longitude) {
                        await assignRetailer({ lat: loc.latitude, lng: loc.longitude, temporary: true, assignedFrom: "current" });
                        setChosenAddress({ type: "current", coordinates: loc, formattedAddress: profileCurrentLocation.formattedAddress || "" });
                      } else {
                        const pos = await getCurrentLocation();
                        await assignRetailer({ lat: pos.latitude, lng: pos.longitude, temporary: true, assignedFrom: "current" });
                        setChosenAddress({ type: "current", coordinates: pos, formattedAddress: "" });
                      }
                    } catch (e) {
                      console.warn("Could not set current address", e);
                    } finally {
                      setAssigning(false);
                    }
                  }}
                >
                  <Text style={styles.smallToggleText}>Use current</Text>
                </Pressable>
              )}

              {profileDeliveryAddress && (
                <Pressable
                  style={styles.smallToggleGhost}
                  onPress={async () => {
                    try {
                      setAssigning(true);
                      const addr = profileDeliveryAddress;
                      if (addr?.coordinates?.latitude && addr?.coordinates?.longitude) {
                        await assignRetailer({ lat: addr.coordinates.latitude, lng: addr.coordinates.longitude, temporary: true, assignedFrom: "home" });
                      } else {
                        await assignRetailer({ temporary: true, assignedFrom: "home" });
                      }
                      setChosenAddress({ type: "home", address: addr });
                    } catch (e) {
                      console.warn("Could not set home address", e);
                    } finally {
                      setAssigning(false);
                    }
                  }}
                >
                  <Text style={styles.smallToggleGhostText}>Use home</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Retailer info */}
          {retailerToUse ? (
            <View style={[styles.infoItem, { marginTop: 12 }]}>
              <Ionicons name="storefront" size={18} color={Colors.light.tint} />
              <View style={{ marginLeft: 8 }}>
                <Text style={{ fontWeight: "700", color: Colors.light.text }}>{retailerToUse.shopName}</Text>
                <Text style={styles.infoText}>{retailerToUse.address || retailerToUse.location?.formattedAddress || ""}</Text>
              </View>
            </View>
          ) : (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: Colors.light.textSecondary }}>No retailer selected — stock/prices may be inaccurate.</Text>
            </View>
          )}
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

      {/* Assign retailer modal (uses RN Modal so it's reliable) */}
      <Modal visible={showAssignModal} transparent animationType="fade" onRequestClose={() => setShowAssignModal(false)}>
        <View style={modalStyles.modalOverlay}>
          <View style={modalStyles.modalBox}>
            <Text style={modalStyles.title}>Choose delivery location</Text>
            <Text style={modalStyles.subtitle}>We can show stock & prices for the retailer near your current location.</Text>

            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <TouchableOpacity style={[modalStyles.primaryBtn, { flex: 1 }]} onPress={handleUseCurrentAddress} disabled={assigning}>
                {assigning ? <ActivityIndicator color="#fff" /> : <Text style={modalStyles.primaryBtnText}>Use current address</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={[modalStyles.ghostBtn, { flex: 1, marginLeft: 8 }]} onPress={handleSkipAssign} disabled={assigning}>
                <Text style={modalStyles.ghostBtnText}>Use saved / skip</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={{ marginTop: 10, alignSelf: "center" }} onPress={() => setShowAssignModal(false)}>
              <Text style={{ color: Colors.light.textSecondary }}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

/* Modal styles */
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
