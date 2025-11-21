import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useProfile } from "@/contexts/ProfileContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const getImageSource = (imageName) => {
  if (
    imageName &&
    (imageName.startsWith("http") || imageName.startsWith("https"))
  ) {
    return { uri: imageName };
  }

  const imageMap = {
    "MilkCategory.png": require("../../assets/images/MilkCategory.png"),
    "ButterCategoryCategory.png": require("../../assets/images/ButterCategoryCategory.png"),
    "CheeseCategory.jpg": require("../../assets/images/CheeseCategory.jpg"),
    "Paneer.png": require("../../assets/images/Paneer.png"),
    "DahiCategory.png": require("../../assets/images/DahiCategory.png"),
    "IcecreamCategory.jpg": require("../../assets/images/IcecreamCategory.jpg"),
    "GheeCategory.png": require("../../assets/images/GheeCategory.png"),
    "CreamCategory.png": require("../../assets/images/CreamCategory.png"),
    "buttermilk.png": require("../../assets/images/butter.png"),
    "LassiCategory.png": require("../../assets/images/LassiCategory.png"),
    "flavored-milk.png": require("../../assets/images/milk.png"),
    "Dairy-SweetCategory.png": require("../../assets/images/Dairy-SweetCategory.png"),
  };
  return imageMap[imageName] || require("../../assets/images/MilkCategory.png");
};

export default function CartScreen() {
  const { 
    items, 
    getTotalItems, 
    getTotalAmount, 
    removeFromCart, 
    updateQuantity,
    clearCart 
  } = useCart();
  const { authToken } = useAuth();
  const { assignedRetailer } = useProfile();
  const insets = useSafeAreaInsets();
  
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;

  const fetchInventory = async () => {
    try {
      if (!authToken) {
        console.log("Inventory fetch skipped (no token)");
        return [];
      }

      const res = await fetch(`${API_BASE_URL}/customer/inventory`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
      });

      const payload = await res.json();
      return res.ok ? payload?.data?.inventory || [] : [];
    } catch (err) {
      console.error("Inventory fetch error:", err);
      return [];
    }
  };

  // Enhanced pricing calculation for cart items
  const calculateCartItemPricing = (cartItem, inventoryItem) => {
    const basePrice = inventoryItem?.sellingPrice || cartItem.price || 0;
    let currentPrice = basePrice;
    let hasDiscount = false;
    let discountPercentage = 0;
    let savings = 0;
    let currentAppliedSlab = null;
    let isExtendedRange = false;

    // Get active pricing slabs
    if (inventoryItem?.enableQuantityPricing && inventoryItem.pricingSlabs) {
      const activeSlabs = inventoryItem.pricingSlabs
        .filter(slab => slab.isActive)
        .sort((a, b) => a.minQuantity - b.minQuantity);

      if (activeSlabs.length > 0) {
        // Find applicable slab - with extended range logic
        let applicableSlab = activeSlabs.find(slab => 
          cartItem.quantity >= slab.minQuantity && cartItem.quantity <= slab.maxQuantity
        );

        // ✅ EXTENDED RANGE LOGIC: Use last slab if quantity exceeds all ranges
        if (!applicableSlab && cartItem.quantity > 0) {
          applicableSlab = activeSlabs[activeSlabs.length - 1];
          isExtendedRange = cartItem.quantity >= applicableSlab.minQuantity;
          
          // Only apply extended range if quantity meets the last slab's minimum
          if (!isExtendedRange) {
            applicableSlab = null;
          }
        }

        if (applicableSlab) {
          currentAppliedSlab = applicableSlab;
          
          // Calculate discounted price
          if (applicableSlab.discountType === 'FLAT') {
            currentPrice = Math.max(0, basePrice - applicableSlab.discountValue);
          } else if (applicableSlab.discountType === 'PERCENTAGE') {
            const discountAmount = (basePrice * applicableSlab.discountValue) / 100;
            currentPrice = Math.max(0, basePrice - discountAmount);
          }
          
          hasDiscount = currentPrice < basePrice;
          discountPercentage = applicableSlab.discountType === 'PERCENTAGE' 
            ? applicableSlab.discountValue 
            : Math.round(((basePrice - currentPrice) / basePrice) * 100);
          savings = (basePrice - currentPrice) * cartItem.quantity;
        }
      }
    }

    return {
      basePrice: Math.round(basePrice * 100) / 100,
      currentPrice: Math.round(currentPrice * 100) / 100,
      hasDiscount,
      discountPercentage: Math.round(discountPercentage * 100) / 100,
      savings: Math.round(savings * 100) / 100,
      currentAppliedSlab,
      totalQuantity: cartItem.quantity,
      isExtendedRange,
      itemTotal: Math.round(currentPrice * cartItem.quantity * 100) / 100,
      baseTotal: Math.round(basePrice * cartItem.quantity * 100) / 100
    };
  };

  const attachInventoryToCartItems = (cartItems, inventory) => {
    if (!Array.isArray(cartItems)) return [];
    if (!Array.isArray(inventory)) return cartItems;

    const inventoryMap = new Map();
    
    inventory.forEach(inv => {
      const product = inv?.product;
      if (!product) return;
      
      const productId = product?.id || product?._id;
      
      if (productId) {
        inventoryMap.set(productId, {
          ...inv,
          currentStock: inv.currentStock,
          sellingPrice: inv.sellingPrice,
          isActive: inv.isActive,
          enableQuantityPricing: inv.enableQuantityPricing,
          pricingSlabs: inv.pricingSlabs || [],
          soldByRetailer: true
        });
      }
    });

    return cartItems.map(cartItem => {
      const productId = cartItem._id;
      
      let matchedInventory = null;
      
      if (productId && inventoryMap.has(productId)) {
        matchedInventory = inventoryMap.get(productId);
      }
      
      const soldByRetailer = matchedInventory !== null;
      const retailerStock = matchedInventory?.currentStock;
      const isOutOfStock = soldByRetailer && retailerStock !== undefined && Number(retailerStock) <= 0;
      
      const pricing = calculateCartItemPricing(cartItem, matchedInventory);
      
      return {
        ...cartItem,
        _inventory: matchedInventory,
        outOfStock: isOutOfStock,
        soldByRetailer: soldByRetailer,
        availableFromRetailer: soldByRetailer && !isOutOfStock,
        pricing: pricing
      };
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const inventoryData = await fetchInventory();
        setInventory(inventoryData);
      } catch (error) {
        console.error("Error fetching inventory:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [authToken, assignedRetailer]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const inventoryData = await fetchInventory();
      setInventory(inventoryData);
    } catch (error) {
      console.error("Error refreshing inventory:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const cartItemsWithPricing = attachInventoryToCartItems(items, inventory);

  // Calculate cart totals with discounts
  const calculateCartTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalSavings = 0;

    cartItemsWithPricing.forEach(item => {
      subtotal += item.pricing.baseTotal;
      totalDiscount += item.pricing.savings;
    });

    const finalTotal = subtotal - totalDiscount;
    totalSavings = totalDiscount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      finalTotal: Math.round(finalTotal * 100) / 100,
      totalSavings: Math.round(totalSavings * 100) / 100,
      savingsPercentage: subtotal > 0 ? Math.round((totalSavings / subtotal) * 100 * 100) / 100 : 0
    };
  };

  const cartTotals = calculateCartTotals();

  const handleQuantityChange = (productId, newQuantity) => {
    if (newQuantity === 0) {
      removeFromCart(productId);
    } else {
      updateQuantity(productId, newQuantity);
    }
  };

  const handleRemoveItem = (productId) => {
    Alert.alert(
      "Remove Item",
      "Are you sure you want to remove this item from your cart?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Remove", 
          style: "destructive",
          onPress: () => removeFromCart(productId)
        }
      ]
    );
  };

  const handleCheckout = () => {
    if (cartItemsWithPricing.length === 0) {
      Alert.alert("Cart Empty", "Please add items to your cart before checkout.");
      return;
    }

    // Check for out of stock items
    const outOfStockItems = cartItemsWithPricing.filter(item => item.outOfStock);
    if (outOfStockItems.length > 0) {
      Alert.alert(
        "Out of Stock Items",
        "Some items in your cart are out of stock. Please remove them to proceed.",
        [{ text: "OK" }]
      );
      return;
    }

    // Check for items not available from retailer
    const unavailableItems = cartItemsWithPricing.filter(item => !item.soldByRetailer);
    if (unavailableItems.length > 0) {
      Alert.alert(
        "Unavailable Items",
        "Some items in your cart are not available from your retailer. Please remove them to proceed.",
        [{ text: "OK" }]
      );
      return;
    }

    router.push("/checkout");
  };

  // Cart Item Component
  const CartItem = ({ item }) => {
    const [itemScale] = useState(new Animated.Value(1));
    const [savingsScale] = useState(new Animated.Value(0));

    useEffect(() => {
      if (item.pricing.savings > 0) {
        // Animate savings badge with pop effect
        Animated.sequence([
          Animated.spring(savingsScale, {
            toValue: 1.2,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.spring(savingsScale, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [item.pricing.savings]);

    const animateItem = () => {
      Animated.sequence([
        Animated.spring(itemScale, {
          toValue: 0.98,
          tension: 100,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(itemScale, {
          toValue: 1,
          tension: 100,
          friction: 5,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const handleIncrease = () => {
      animateItem();
      handleQuantityChange(item._id, item.quantity + 1);
    };

    const handleDecrease = () => {
      animateItem();
      handleQuantityChange(item._id, item.quantity - 1);
    };

    return (
      <Animated.View style={[styles.cartItem, { transform: [{ scale: itemScale }] }]}>
        <View style={styles.cartItemHeader}>
          {/* Discount Badge - Positioned above image */}
          {item.pricing.hasDiscount && item.availableFromRetailer && (
            <View style={styles.cartDiscountBadge}>
              <Text style={styles.cartDiscountBadgeText}>
                {item.pricing.discountPercentage}% OFF
              </Text>
              {item.pricing.isExtendedRange && (
                <View style={styles.cartExtendedRangeDot} />
              )}
            </View>
          )}

          {/* Status Badge */}
          {item.outOfStock && (
            <View style={styles.cartStatusBadge}>
              <Text style={styles.cartStatusBadgeText}>OUT OF STOCK</Text>
            </View>
          )}
          {!item.soldByRetailer && (
            <View style={[styles.cartStatusBadge, styles.cartNotAvailableBadge]}>
              <Text style={styles.cartStatusBadgeText}>NOT AVAILABLE</Text>
            </View>
          )}
        </View>

        <View style={styles.cartItemContent}>
          <View style={styles.cartItemLeft}>
            <View style={styles.cartImageContainer}>
              {item.image || item.imageUrl ? (
                <Image
                  source={getImageSource(item.image || item.imageUrl)}
                  style={styles.cartItemImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.cartItemImagePlaceholder}>
                  <Text style={styles.cartItemImageText}>📦</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.cartItemCenter}>
            <Text style={styles.cartItemName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.cartItemUnit}>{item.unit}</Text>
            
            {/* Price Display */}
            <View style={styles.cartPriceContainer}>
              <View style={styles.cartPriceRow}>
                <Text style={styles.cartPrice}>₹{item.pricing.currentPrice}</Text>
                {item.pricing.hasDiscount && item.pricing.currentPrice < item.pricing.basePrice && (
                  <Text style={styles.cartPriceOriginal}>₹{item.pricing.basePrice}</Text>
                )}
                <Text style={styles.cartPriceUnit}>/piece</Text>
              </View>
              
              {/* Professional Savings Badge */}
              {item.pricing.savings > 0 && (
                <Animated.View 
                  style={[
                    styles.cartSavingsBadge,
                    { transform: [{ scale: savingsScale }] }
                  ]}
                >
                  <View style={styles.cartSavingsContent}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={styles.cartSavingsBadgeText}>
                      Save ₹{item.pricing.savings}
                    </Text>
                  </View>
                </Animated.View>
              )}
            </View>
          </View>

          <View style={styles.cartItemRight}>
            {/* Quantity Controls */}
            {item.availableFromRetailer && (
              <View style={styles.cartQuantityControls}>
                <TouchableOpacity 
                  style={[
                    styles.cartQtyBtn,
                    item.quantity <= 1 && styles.cartQtyBtnDisabled
                  ]} 
                  onPress={handleDecrease}
                  disabled={item.quantity <= 1}
                >
                  <Ionicons 
                    name="remove" 
                    size={18} 
                    color={item.quantity <= 1 ? "#9CA3AF" : "#DC2626"} 
                  />
                </TouchableOpacity>
                
                <Text style={styles.cartQtyText}>{item.quantity}</Text>
                
                <TouchableOpacity 
                  style={styles.cartQtyBtn} 
                  onPress={handleIncrease}
                >
                  <Ionicons name="add" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            )}

            {/* Item Total */}
            <View style={styles.cartItemTotal}>
              <Text style={styles.cartItemTotalText}>
                ₹{item.pricing.itemTotal}
              </Text>
              {item.pricing.hasDiscount && (
                <Text style={styles.cartItemTotalOriginal}>
                  ₹{item.pricing.baseTotal}
                </Text>
              )}
            </View>

            {/* Remove Button */}
            <TouchableOpacity 
              style={styles.removeButton}
              onPress={() => handleRemoveItem(item._id)}
            >
              <Ionicons name="trash-outline" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Availability Message */}
        {!item.availableFromRetailer && (
          <View style={[
            styles.cartAvailabilityMessage,
            item.outOfStock ? styles.cartOutOfStockMessage : styles.cartNotAvailableMessage
          ]}>
            <Ionicons 
              name={item.outOfStock ? "alert-circle" : "information-circle"} 
              size={16} 
              color={item.outOfStock ? "#DC2626" : "#F59E0B"} 
            />
            <Text style={styles.cartAvailabilityMessageText}>
              {item.outOfStock 
                ? 'This product is currently out of stock' 
                : 'This product is not available from your retailer'
              }
            </Text>
          </View>
        )}
      </Animated.View>
    );
  };

  // Order Summary Component
  const OrderSummary = () => (
    <View style={styles.orderSummary}>
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryTitle}>Order Summary</Text>
      </View>

      {/* Professional Savings Highlight */}
      {cartTotals.totalSavings > 0 && (
        <View style={styles.savingsHighlight}>
          <View style={styles.savingsHighlightContent}>
            <Ionicons name="sparkles" size={20} color="#059669" />
            <View style={styles.savingsHighlightText}>
              <Text style={styles.savingsHighlightTitle}>
                You're saving ₹{cartTotals.totalSavings}!
              </Text>
              <Text style={styles.savingsHighlightSubtitle}>
                That's {cartTotals.savingsPercentage}% off your order
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.summaryRows}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Subtotal</Text>
          <Text style={styles.summaryValue}>₹{cartTotals.subtotal}</Text>
        </View>

        {cartTotals.totalSavings > 0 && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Discounts</Text>
            <Text style={[styles.summaryValue, styles.discountValue]}>
              -₹{cartTotals.totalSavings}
            </Text>
          </View>
        )}

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Delivery</Text>
          <Text style={styles.summaryValue}>FREE</Text>
        </View>

        <View style={styles.summaryDivider} />

        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <View style={styles.totalContainer}>
            <Text style={styles.totalValue}>₹{cartTotals.finalTotal}</Text>
            {cartTotals.totalSavings > 0 && (
              <Text style={styles.originalTotalValue}>
                ₹{cartTotals.subtotal}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Professional Checkout Button */}
      <TouchableOpacity 
        style={[
          styles.checkoutButton,
          (!cartItemsWithPricing.some(item => item.availableFromRetailer) && styles.checkoutButtonDisabled)
        ]}
        onPress={handleCheckout}
        disabled={!cartItemsWithPricing.some(item => item.availableFromRetailer)}
      >
        <View style={styles.checkoutButtonContent}>
          <Text style={styles.checkoutButtonText}>
            Proceed to Checkout
          </Text>
          <View style={styles.checkoutTotal}>
            <Text style={styles.checkoutTotalText}>₹{cartTotals.finalTotal}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {!cartItemsWithPricing.some(item => item.availableFromRetailer) && (
        <Text style={styles.checkoutDisabledText}>
          Add available items to proceed with checkout
        </Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading cart...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Cart</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => {
                if (items.length > 0) {
                  Alert.alert(
                    "Clear Cart",
                    "Are you sure you want to clear your entire cart?",
                    [
                      { text: "Cancel", style: "cancel" },
                      { 
                        text: "Clear", 
                        style: "destructive",
                        onPress: clearCart
                      }
                    ]
                  );
                }
              }}
              disabled={items.length === 0}
            >
              <Text style={[
                styles.clearButtonText,
                items.length === 0 && styles.clearButtonTextDisabled
              ]}>
                Clear All
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {items.length > 0 && (
          <View style={styles.cartSummary}>
            <Text style={styles.cartSummaryText}>
              {items.length} item{items.length !== 1 ? 's' : ''} in cart
            </Text>
          </View>
        )}
      </View>

      {/* Cart Content */}
      <View style={styles.content}>
        {cartItemsWithPricing.length === 0 ? (
          <View style={styles.emptyCart}>
            <View style={styles.emptyCartIcon}>
              <Ionicons name="cart-outline" size={80} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
            <Text style={styles.emptyCartSubtitle}>
              Browse our categories and add some delicious dairy products!
            </Text>
            <TouchableOpacity 
              style={styles.shopButton}
              onPress={() => router.push("/categories")}
            >
              <Text style={styles.shopButtonText}>Start Shopping</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cartWithSummary}>
            {/* Cart Items ScrollView */}
            <ScrollView
              style={styles.cartItemsScrollView}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              contentContainerStyle={styles.cartItemsContent}
            >
              {cartItemsWithPricing.map((item) => (
                <CartItem key={item._id} item={item} />
              ))}
              
              {/* Add space at the bottom for the order summary */}
              <View style={styles.cartBottomSpacer} />
            </ScrollView>

            {/* Fixed Order Summary at Bottom */}
            <View style={styles.orderSummaryContainer}>
              <OrderSummary />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
  },
  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#DC2626",
  },
  clearButtonTextDisabled: {
    color: "#9CA3AF",
    opacity: 0.5,
  },
  cartSummary: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  cartSummaryText: {
    fontSize: 14,
    color: "#6B7280",
  },
  content: {
    flex: 1,
  },
  emptyCart: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyCartIcon: {
    marginBottom: 24,
  },
  emptyCartTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyCartSubtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  shopButton: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  shopButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  // NEW: Container for cart with summary layout
  cartWithSummary: {
    flex: 1,
  },
  // UPDATED: ScrollView for cart items
  cartItemsScrollView: {
    flex: 1,
  },
  // UPDATED: Content container for cart items
  cartItemsContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 200, // Extra space for order summary
  },
  // NEW: Container for fixed order summary
  orderSummaryContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  // NEW: Bottom spacer for cart items
  cartBottomSpacer: {
    height: 20,
  },
  cartItem: {
    backgroundColor: "#FFFFFF",
    marginVertical: 6,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    position: "relative",
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  cartItemHeader: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 2,
  },
  cartDiscountBadge: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  cartDiscountBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  cartExtendedRangeDot: {
    width: 4,
    height: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
    opacity: 0.8,
  },
  cartStatusBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cartNotAvailableBadge: {
    backgroundColor: "#F59E0B",
  },
  cartStatusBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  cartItemContent: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cartItemLeft: {
    justifyContent: "center",
  },
  cartImageContainer: {
    position: "relative",
  },
  cartItemImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
  },
  cartItemImagePlaceholder: {
    width: 70,
    height: 70,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cartItemImageText: {
    fontSize: 20,
    color: "#9CA3AF",
  },
  cartItemCenter: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
    lineHeight: 20,
  },
  cartItemUnit: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  cartPriceContainer: {
    marginBottom: 4,
  },
  cartPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  cartPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  cartPriceOriginal: {
    fontSize: 14,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  cartPriceUnit: {
    fontSize: 12,
    color: "#6B7280",
  },
  cartSavingsBadge: {
    alignSelf: "flex-start",
  },
  cartSavingsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
    gap: 4,
  },
  cartSavingsBadgeText: {
    color: "#065F46",
    fontSize: 11,
    fontWeight: "600",
  },
  cartItemRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  cartQuantityControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  cartQtyBtn: {
    padding: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  cartQtyBtnDisabled: {
    backgroundColor: "#F9FAFB",
    shadowOpacity: 0,
    elevation: 0,
  },
  cartQtyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    minWidth: 24,
    textAlign: "center",
  },
  cartItemTotal: {
    alignItems: "flex-end",
    marginBottom: 8,
  },
  cartItemTotalText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  cartItemTotalOriginal: {
    fontSize: 12,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  removeButton: {
    padding: 4,
  },
  cartAvailabilityMessage: {
    marginTop: 12,
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cartOutOfStockMessage: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
  },
  cartNotAvailableMessage: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FED7AA",
  },
  cartAvailabilityMessageText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#1F2937",
    flex: 1,
  },
  orderSummary: {
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  summaryHeader: {
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  savingsHighlight: {
    marginBottom: 16,
    backgroundColor: "#F0FDF4",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  savingsHighlightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  savingsHighlightText: {
    flex: 1,
  },
  savingsHighlightTitle: {
    color: "#065F46",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  savingsHighlightSubtitle: {
    color: "#065F46",
    fontSize: 12,
    opacity: 0.8,
  },
  summaryRows: {
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: "#6B7280",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  discountValue: {
    color: "#059669",
    fontWeight: "700",
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },
  totalRow: {
    marginBottom: 0,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  totalContainer: {
    alignItems: "flex-end",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  originalTotalValue: {
    fontSize: 14,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  checkoutButton: {
    backgroundColor: "#DC2626",
    borderRadius: 12,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  checkoutButtonDisabled: {
    backgroundColor: "#9CA3AF",
    shadowColor: "#9CA3AF",
    opacity: 0.6,
  },
  checkoutButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
  },
  checkoutButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  checkoutTotal: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  checkoutTotalText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  checkoutDisabledText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 8,
  },
});