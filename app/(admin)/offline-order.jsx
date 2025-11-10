import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

  const incrementQuantity = (idx) => {
    setScannedItems((prev) =>
      prev.map((it, i) => 
        i === idx ? { ...it, quantity: it.quantity + 1 } : it
      )
    );
  };

  const decrementQuantity = (idx) => {
    setScannedItems((prev) =>
      prev.map((it, i) => 
        i === idx && it.quantity > 1 
          ? { ...it, quantity: it.quantity - 1 } 
          : it
      )
    );
  };

  const removeItem = (idx) => {
    setScannedItems((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ------------------------------------------------------------------ */
  /* Calculations                                                       */
  /* ------------------------------------------------------------------ */
  const calculateTotal = () =>
    scannedItems.reduce((sum, it) => sum + (it.discountedPrice || it.price) * it.quantity, 0);

  const calculateSubtotal = () => calculateTotal();
  const calculateDiscount = () => 
    scannedItems.reduce((sum, it) => 
      it.discountedPrice ? sum + (it.price - it.discountedPrice) * it.quantity : sum, 0
    );
  const calculateFinalTotal = () => calculateSubtotal();

  const totalItems = scannedItems.reduce((sum, item) => sum + item.quantity, 0);

  /* ------------------------------------------------------------------ */
  /* Submit offline order                                               */
  /* ------------------------------------------------------------------ */
  const finalizeOfflineOrder = async () => {
    if (scannedItems.length === 0) {
      Alert.alert("Error", "No items to order");
      return;
    }

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
          quantity: it.quantity,
        })),
        paymentMethod: "cash",
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
        `Offline order created! Order ID: ${data.order.orderId}`,
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
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Render Item Card                                                   */
  /* ------------------------------------------------------------------ */
  const renderItemCard = ({ item, index }) => {
    const displayPrice = item.discountedPrice ?? item.price;
    const lineTotal = displayPrice * item.quantity;
    const hasDiscount = item.discountedPrice && item.discountedPrice < item.price;
    const discountAmount = hasDiscount ? (item.price - item.discountedPrice) * item.quantity : 0;

    return (
      <View style={styles.itemCard}>
        {/* Product Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{
              uri: item.image || "https://via.placeholder.com/100",
            }}
            style={styles.productImage}
            resizeMode="cover"
          />
          {hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountBadgeText}>
                {Math.round((1 - item.discountedPrice / item.price) * 100)}% OFF
              </Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.itemInfo}>
          <View style={styles.titleRow}>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.name}
            </Text>
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => removeItem(index)}
            >
              <Feather name="trash-2" size={18} color="#F44336" />
            </TouchableOpacity>
          </View>

          <Text style={styles.productCategory}>
            {item.category?.name || 'Uncategorized'}
          </Text>

          {/* Price Row */}
          <View style={styles.priceRow}>
            <Text style={styles.itemPrice}>₹{displayPrice.toFixed(2)}</Text>
            <Text style={styles.unitText}>per unit</Text>
          </View>

          {hasDiscount && (
            <View style={styles.originalPriceRow}>
              <Text style={styles.originalPrice}>₹{item.price.toFixed(2)}</Text>
              <Text style={styles.saveText}>
                Save ₹{(item.price - item.discountedPrice).toFixed(2)}
              </Text>
            </View>
          )}
        </View>

        {/* Quantity Controls */}
        <View style={styles.quantitySection}>
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityBtn}
              onPress={() => decrementQuantity(index)}
              disabled={item.quantity <= 1}
            >
              <MaterialIcons
                name="remove"
                size={20}
                color={item.quantity <= 1 ? Colors.light.textSecondary : Colors.light.accent}
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
              onPress={() => incrementQuantity(index)}
            >
              <MaterialIcons
                name="add"
                size={20}
                color={Colors.light.accent}
              />
            </TouchableOpacity>
          </View>

          {/* Line Total */}
          <Text style={styles.itemTotal}>₹{lineTotal.toFixed(2)}</Text>
          {hasDiscount && (
            <Text style={styles.discountAmountText}>
              -₹{discountAmount.toFixed(2)}
            </Text>
          )}
        </View>
      </View>
    );
  };

  /* ------------------------------------------------------------------ */
  /* Empty State                                                        */
  /* ------------------------------------------------------------------ */
  const EmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="qr-code-scanner" size={56} color={Colors.light.textSecondary} />
      <Text style={styles.emptyText}>No products scanned</Text>
      <Text style={styles.emptySubtext}>
        Scan product QR codes to add them to the order
      </Text>
      <TouchableOpacity 
        style={styles.scanAgainButton} 
        onPress={() => router.back()}
      >
        <Ionicons name="qr-code-outline" size={20} color="#FFF" />
        <Text style={styles.scanAgainButtonText}>Scan Products</Text>
      </TouchableOpacity>
    </View>
  );

  /* ------------------------------------------------------------------ */
  /* Main UI                                                            */
  /* ------------------------------------------------------------------ */
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* PROFESSIONAL HEADER */}
      <View style={styles.professionalHeader}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Offline Order</Text>
          <View style={styles.headerRight} />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Summary Header */}
        {scannedItems.length > 0 && (
          <View style={styles.summaryHeader}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{scannedItems.length}</Text>
              <Text style={styles.summaryLabel}>Products</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{totalItems}</Text>
              <Text style={styles.summaryLabel}>Total Items</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>₹{calculateFinalTotal().toFixed(0)}</Text>
              <Text style={styles.summaryLabel}>Total Amount</Text>
            </View>
          </View>
        )}

        {/* Items List */}
        <View style={styles.section}>
          {scannedItems.length === 0 ? (
            <EmptyList />
          ) : (
            <FlatList
              data={scannedItems}
              keyExtractor={(_, i) => i.toString()}
              scrollEnabled={false}
              renderItem={renderItemCard}
            />
          )}
        </View>

        {/* Bill Summary */}
        {scannedItems.length > 0 && (
          <View style={styles.billSection}>
            <Text style={styles.billTitle}>Order Summary</Text>

            <View style={styles.billRow}>
              <Text style={styles.billLabel}>
                Subtotal ({totalItems} items)
              </Text>
              <Text style={styles.billValue}>
                ₹{calculateSubtotal().toFixed(2)}
              </Text>
            </View>

            {calculateDiscount() > 0 && (
              <View style={styles.billRow}>
                <Text style={styles.discountLabel}>Discount Applied</Text>
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

            {/* Order Info */}
            <View style={styles.orderInfo}>
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={18} color={Colors.light.accent} />
                <Text style={styles.infoText}>Ready for pickup</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="cash-outline" size={18} color={Colors.light.accent} />
                <Text style={styles.infoText}>Cash payment</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="storefront-outline" size={18} color={Colors.light.accent} />
                <Text style={styles.infoText}>Offline order</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer with Create Order Button */}
      {scannedItems.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.footerTotal}>
            <Text style={styles.footerTotalLabel}>Total Amount</Text>
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
                <MaterialIcons name="shopping-cart-checkout" size={20} color="#FFF" />
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
/* Enhanced Styles - Consistent with Products Management              */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors.light.background 
  },
  centered: { 
    justifyContent: "center", 
    alignItems: "center" 
  },
  loadingText: { 
    marginTop: 16, 
    fontSize: 16, 
    color: Colors.light.textSecondary 
  },

  /* PROFESSIONAL HEADER */
  professionalHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    minHeight: 72,
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
  },
  headerRight: {
    width: 32,
  },

  scrollView: { 
    flex: 1 
  },
  scrollContent: { 
    paddingHorizontal: 16, 
    paddingBottom: 120 
  },

  /* Summary Header */
  summaryHeader: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.accent,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.light.border,
    marginHorizontal: 8,
  },

  section: { 
    marginTop: 8 
  },

  /* Empty State */
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  scanAgainButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },

  /* Enhanced Item Card */
  itemCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  discountBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountBadgeText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },

  /* Item Info */
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
    marginRight: 8,
  },
  deleteButton: {
    padding: 4,
  },
  productCategory: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  unitText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginLeft: 6,
  },
  originalPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  originalPrice: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textDecorationLine: 'line-through',
  },
  saveText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },

  /* Quantity Section */
  quantitySection: {
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  quantityBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    width: 44,
    textAlign: 'center',
    paddingVertical: 4,
    marginHorizontal: 4,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  discountAmountText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 2,
  },

  /* Bill Summary */
  billSection: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  billTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  billLabel: { 
    fontSize: 15, 
    color: Colors.light.textSecondary 
  },
  billValue: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: Colors.light.text 
  },
  discountLabel: { 
    fontSize: 15, 
    color: '#4CAF50' 
  },
  discountValue: { 
    fontSize: 15, 
    fontWeight: '600', 
    color: '#4CAF50' 
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  totalLabel: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: Colors.light.text 
  },
  totalValue: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: Colors.light.accent 
  },

  /* Order Info */
  orderInfo: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 8,
  },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  footerTotal: { 
    flex: 1 
  },
  footerTotalLabel: { 
    fontSize: 14, 
    color: Colors.light.textSecondary 
  },
  footerTotalAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  finalizeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.accent,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  finalizeBtnDisabled: { 
    backgroundColor: Colors.light.textSecondary 
  },
  finalizeBtnText: { 
    color: '#FFF', 
    fontSize: 16, 
    fontWeight: '600' 
  },
});