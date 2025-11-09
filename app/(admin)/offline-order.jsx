import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { FontAwesome, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  FlatList,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;

export default function OfflineOrder() {
  const insets = useSafeAreaInsets();
  const { authToken, isLoading: authLoading, isAuthenticated, validateToken } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [scannedItems, setScannedItems] = useState([]);
  const [loading, setLoading] = useState(false);

  /* ------------------------------------------------------------------ */
  /* Parse scanned items from navigation params                         */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (params.scannedItems) {
      try {
        const items = JSON.parse(params.scannedItems);
        setScannedItems(items);
      } catch (e) {
        console.error("Failed to parse scannedItems:", e);
        Alert.alert("Error", "Invalid scanned items data");
        router.back();
      }
    } else {
      Alert.alert("Error", "No scanned items provided");
      router.back();
    }
  }, [params.scannedItems, router]);

  /* ------------------------------------------------------------------ */
  /* Quantity helpers                                                   */
  /* ------------------------------------------------------------------ */
  const updateQuantity = (idx, txt) => {
    const num = parseInt(txt, 10) || 0;
    if (num <= 0) {
      setScannedItems((prev) => prev.filter((_, i) => i !== idx));
    } else {
      setScannedItems((prev) =>
        prev.map((it, i) => (i === idx ? { ...it, quantity: num } : it))
      );
    }
  };

  /* ------------------------------------------------------------------ */
  /* Calculations                                                       */
  /* ------------------------------------------------------------------ */
  const calculateTotal = () =>
    scannedItems.reduce((sum, it) => sum + it.price * it.quantity, 0);

  const calculateSubtotal = () => calculateTotal();
  const calculateTax = () => Math.round(calculateTotal() * 0.05); // 5% GST
  const calculateDiscount = () => 0;
  const calculateFinalTotal = () =>
    calculateSubtotal() + calculateTax() - calculateDiscount();

  /* ------------------------------------------------------------------ */
  /* Submit offline order                                               */
  /* ------------------------------------------------------------------ */
  const finalizeOfflineOrder = async () => {
    if (scannedItems.length === 0) return;

    if (!authToken || !isAuthenticated) {
      Alert.alert("Error", "Not authenticated");
      return;
    }

    const ok = await validateToken();
    if (!ok) {
      Alert.alert("Session Expired", "Please login again");
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        items: scannedItems.map((it) => ({
          productId: it.productId,
          name: it.name,
          price: it.price,
          quantity: it.quantity,
          unit: "unit",
        })),
        totalAmount: calculateFinalTotal(),
        orderType: "offline",
      };

      const res = await fetch(`${API_BASE_URL}/orders/offline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(orderData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to create offline order");
      }

      const data = await res.json();
      Alert.alert(
        "Success",
        `Offline order created! Order ID: ${data.orderId}`,
        [
          {
            text: "OK",
            onPress: () => router.replace("/(admin)/orders"),
          },
        ]
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Error", e.message || "Failed to create offline order");
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Loading UI                                                         */
  /* ------------------------------------------------------------------ */
  if (authLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Main UI                                                            */
  /* ------------------------------------------------------------------ */
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ---------------------- Items List ---------------------- */}
        <View style={styles.section}>
          {scannedItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons
                name="inventory"
                size={48}
                color={Colors.light.textSecondary}
              />
              <Text style={styles.emptyText}>No products scanned</Text>
            </View>
          ) : (
            <FlatList
              data={scannedItems}
              keyExtractor={(_, i) => i.toString()}
              scrollEnabled={false}
              renderItem={({ item, index }) => {
                const displayPrice = item.discountedPrice ?? item.price;
                const lineTotal = displayPrice * item.quantity;

                return (
                  <View style={styles.itemCard}>
                    {/* ---- Image ---- */}
                    <Image
                      source={{
                        uri:
                          item.image ||
                          "https://via.placeholder.com/80x80?text=No+Image",
                      }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />

                    {/* ---- Info ---- */}
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.name}
                      </Text>

                      <View style={styles.priceRow}>
                        <Text style={styles.itemPrice}>
                          ₹{displayPrice.toFixed(2)}
                        </Text>
                        <Text style={styles.unitText}>per unit</Text>
                      </View>

                      {item.discountedPrice && item.discountedPrice < item.price && (
                        <View style={styles.discountRow}>
                          <Text style={styles.originalPrice}>
                            ₹{item.price.toFixed(2)}
                          </Text>
                          <Text style={styles.discountText}>
                            Save ₹{(item.price - item.discountedPrice).toFixed(2)}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* ---- Quantity ---- */}
                    <View style={styles.quantityWrapper}>
                      <TouchableOpacity
                        style={styles.quantityBtn}
                        onPress={() =>
                          updateQuantity(index, (item.quantity - 1).toString())
                        }
                        accessibilityLabel="Decrease quantity"
                      >
                        <MaterialIcons
                          name="remove"
                          size={20}
                          color={Colors.light.accent}
                        />
                      </TouchableOpacity>

                      <TextInput
                        style={styles.quantityInput}
                        keyboardType="numeric"
                        value={item.quantity.toString()}
                        onChangeText={(txt) => updateQuantity(index, txt)}
                      />

                      <TouchableOpacity
                        style={styles.quantityBtn}
                        onPress={() =>
                          updateQuantity(index, (item.quantity + 1).toString())
                        }
                        accessibilityLabel="Increase quantity"
                      >
                        <MaterialIcons
                          name="add"
                          size={20}
                          color={Colors.light.accent}
                        />
                      </TouchableOpacity>
                    </View>

                    {/* ---- Line total ---- */}
                    <Text style={styles.itemTotal} numberOfLines={1}>
                      ₹{lineTotal.toFixed(2)}
                    </Text>
                  </View>
                );
              }}
            />
          )}
        </View>

        {/* ---------------------- Bill Summary ---------------------- */}
        {scannedItems.length > 0 && (
          <View style={styles.billSection}>
            <Text style={styles.billTitle}>Bill Summary</Text>

            <View style={styles.billRow}>
              <Text style={styles.billLabel}>
                Subtotal ({scannedItems.reduce((s, i) => s + i.quantity, 0)} items)
              </Text>
              <Text style={styles.billValue}>
                ₹{calculateSubtotal().toFixed(2)}
              </Text>
            </View>

            <View style={styles.billRow}>
              <Text style={styles.billLabel}>GST (5%)</Text>
              <Text style={styles.billValue}>
                ₹{calculateTax().toFixed(2)}
              </Text>
            </View>

            {calculateDiscount() > 0 && (
              <View style={styles.billRow}>
                <Text style={styles.discountLabel}>Discount</Text>
                <Text style={styles.discountValue}>
                  -₹{calculateDiscount().toFixed(2)}
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>
                ₹{calculateFinalTotal().toFixed(2)}
              </Text>
            </View>

            <View style={styles.orderInfo}>
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={18} color={Colors.light.tint} />
                <Text style={styles.infoText}>Ready for pickup</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="cash-outline" size={18} color={Colors.light.tint} />
                <Text style={styles.infoText}>Cash payment</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ---------------------- Footer ---------------------- */}
      {scannedItems.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.footerTotal}>
            <Text style={styles.footerTotalLabel}>Total</Text>
            <Text style={styles.footerTotalAmount}>
              ₹{calculateFinalTotal().toFixed(2)}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.finalizeBtn, loading && styles.finalizeBtnDisabled]}
            onPress={finalizeOfflineOrder}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <MaterialIcons name="shopping-cart" size={20} color="#FFF" />
                <Text style={styles.finalizeBtnText}>Create Order</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Styles – clean, consistent, responsive                             */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centered: { justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 16, color: Colors.light.textSecondary },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 120 },

  section: { marginTop: 16 },

  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },

  /* ---------- Item Card ---------- */
  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  productImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    justifyContent: "center",
  },
  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.accent,
  },
  unitText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginLeft: 4,
  },
  discountRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  originalPrice: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textDecorationLine: "line-through",
  },
  discountText: {
    fontSize: 13,
    color: "#4CAF50",
    fontWeight: "600",
    marginLeft: 6,
  },

  quantityWrapper: {
    width: 110,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(33, 150, 243, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    width: 44,
    textAlign: "center",
    paddingVertical: 4,
    marginHorizontal: 4,
    fontSize: 15,
    fontWeight: "600",
  },
  itemTotal: {
    width: 80,
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.accent,
    textAlign: "right",
  },

  /* ---------- Bill Summary ---------- */
  billSection: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  billTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 16,
    textAlign: "center",
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  billLabel: { fontSize: 15, color: Colors.light.textSecondary },
  billValue: { fontSize: 15, fontWeight: "600", color: Colors.light.text },
  discountLabel: { fontSize: 15, color: "#4CAF50" },
  discountValue: { fontSize: 15, fontWeight: "600", color: "#4CAF50" },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  totalLabel: { fontSize: 18, fontWeight: "700", color: Colors.light.text },
  totalValue: { fontSize: 20, fontWeight: "700", color: Colors.light.accent },

  orderInfo: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 8,
  },

  /* ---------- Footer ---------- */
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  footerTotal: { flex: 1 },
  footerTotalLabel: { fontSize: 14, color: Colors.light.textSecondary },
  footerTotalAmount: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
  },
  finalizeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.light.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  finalizeBtnDisabled: { backgroundColor: Colors.light.textSecondary },
  finalizeBtnText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
});