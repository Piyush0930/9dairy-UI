import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useProfile } from "@/contexts/ProfileContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { 
    items, 
    clearCart 
  } = useCart();
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
  
  // LOCAL INVENTORY STATE - Just like CartScreen
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);

  // Fetch inventory function - Same as CartScreen
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

  // Enhanced pricing calculation for cart items - Same as CartScreen
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

        // EXTENDED RANGE LOGIC: Use last slab if quantity exceeds all ranges
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
    if (!Array.isArray(inventory)) return cartItems.map(item => ({
      ...item,
      pricing: {
        basePrice: item.price || 0,
        currentPrice: item.price || 0,
        hasDiscount: false,
        discountPercentage: 0,
        savings: 0,
        itemTotal: (item.price || 0) * item.quantity,
        baseTotal: (item.price || 0) * item.quantity,
        totalCartQuantity: item.quantity,
        isExtendedRange: false
      },
      soldByRetailer: false,
      availableFromRetailer: false,
      outOfStock: false
    }));

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

  // Calculate cart totals with discounts
  const calculateCartTotals = (cartItems) => {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalSavings = 0;

    cartItems.forEach(item => {
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
      savingsPercentage: subtotal > 0 ? Math.round((totalSavings / subtotal) * 100 * 100) / 100 : 0,
      itemCount: cartItems.length
    };
  };

  // Get cart data with LOCAL pricing calculation
  const cartItemsWithPricing = attachInventoryToCartItems(items, inventory);
  const cartSummary = calculateCartTotals(cartItemsWithPricing);

  // Calculate discounted items count
  const getDiscountedItemsCount = () => {
    return cartItemsWithPricing.filter(item => item.pricing?.hasDiscount).length;
  };

  // =========================================
  // ENHANCED UI COMPONENTS WITH DISCOUNT BADGES
  // =========================================
  const DiscountBadge = ({ discountPercentage, isExtendedRange, size = "medium" }) => {
    const isLarge = size === "large";
    
    return (
      <View style={[
        styles.discountBadge,
        isLarge ? styles.discountBadgeLarge : styles.discountBadgeMedium
      ]}>
        <Text style={[
          styles.discountBadgeText,
          isLarge && styles.discountBadgeTextLarge
        ]}>
          {discountPercentage}% OFF
        </Text>
        {isExtendedRange && (
          <View style={styles.extendedRangeDot} />
        )}
      </View>
    );
  };

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
  // INIT AUTH + PROFILE LOAD + INVENTORY
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
      
      // Load inventory
      setInventoryLoading(true);
      try {
        const inventoryData = await fetchInventory();
        setInventory(inventoryData);
      } catch (error) {
        console.error("Error fetching inventory:", error);
      } finally {
        setInventoryLoading(false);
      }
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
  // PLACE ORDER WITH PROPER PRICING DATA
  // =========================================
  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      return Alert.alert("Missing Address", "Please select a delivery address.");
    }

    if (!selectedAddress?.coordinates?.latitude) {
      return Alert.alert("Missing Coordinates", "Address does not have coordinates");
    }

    // Check for unavailable items
    const unavailableItems = cartItemsWithPricing.filter(item => !item.availableFromRetailer);
    if (unavailableItems.length > 0) {
      Alert.alert(
        "Unavailable Items",
        "Some items in your cart are not available. Please remove them to proceed.",
        [{ text: "OK" }]
      );
      return;
    }

    try {
      const valid = await validateToken();
      if (!valid) return logout();

      setLoading(true);

      const validPaymentMethod = "cash";

      // Prepare order items with COMPLETE pricing data
      const orderItems = cartItemsWithPricing.map(item => ({
        productId: item._id,
        quantity: item.quantity,
        // Include pricing information for backend verification
        calculatedPrice: item.pricing.currentPrice,
        basePrice: item.pricing.basePrice,
        discountDetails: item.pricing
      }));

      const body = {
        items: orderItems,
        deliveryAddress: selectedAddress,
        paymentMethod: validPaymentMethod,
        // Include pricing summary for verification
        pricingSummary: {
          subtotal: cartSummary.subtotal,
          totalDiscount: cartSummary.totalDiscount,
          finalTotal: cartSummary.finalTotal
        }
      };

      console.log("📦 Placing order with complete pricing data:", {
        items: orderItems.length,
        subtotal: cartSummary.subtotal,
        discount: cartSummary.totalDiscount,
        finalTotal: cartSummary.finalTotal
      });

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

      // Clear cart on success
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
  // ENHANCED ORDER ITEM COMPONENT WITH PROPER PRICING
  // =========================================
  const OrderItem = ({ item }) => {
    return (
      <View style={styles.orderItem}>
        <View style={styles.orderItemHeader}>
          {/* Discount Badge */}
          {item.pricing.hasDiscount && item.availableFromRetailer && (
            <DiscountBadge 
              discountPercentage={item.pricing.discountPercentage} 
              isExtendedRange={item.pricing.isExtendedRange}
            />
          )}

          {/* Status Badge */}
          {item.outOfStock && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText}>OUT OF STOCK</Text>
            </View>
          )}
          {!item.soldByRetailer && (
            <View style={[styles.statusBadge, styles.notAvailableBadge]}>
              <Text style={styles.statusBadgeText}>NOT AVAILABLE</Text>
            </View>
          )}
        </View>

        <View style={styles.orderItemContent}>
          <View style={styles.orderItemLeft}>
            <View style={styles.imageContainer}>
              {item.image || item.imageUrl ? (
                <Image
                  source={{ uri: item.image || item.imageUrl }}
                  style={styles.orderItemImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.orderItemImagePlaceholder}>
                  <Text style={styles.orderItemImageText}>📦</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.orderItemCenter}>
            <Text style={styles.orderItemName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.orderItemUnit}>{item.unit}</Text>
            
            {/* Price Display */}
            <View style={styles.priceContainer}>
              <View style={styles.priceRow}>
                <Text style={styles.currentPrice}>₹{item.pricing.currentPrice}</Text>
                {item.pricing.hasDiscount && item.pricing.currentPrice < item.pricing.basePrice && (
                  <Text style={styles.originalPrice}>₹{item.pricing.basePrice}</Text>
                )}
                <Text style={styles.priceUnit}>/piece</Text>
              </View>
              
              {/* Savings Badge */}
              {item.pricing.savings > 0 && (
                <View style={styles.savingsBadge}>
                  <View style={styles.savingsContent}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={styles.savingsBadgeText}>
                      Save ₹{item.pricing.savings}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          <View style={styles.orderItemRight}>
            {/* Quantity Display */}
            <View style={styles.quantityDisplay}>
              <Text style={styles.quantityText}>Qty: {item.quantity}</Text>
            </View>

            {/* Item Total */}
            <View style={styles.itemTotal}>
              <Text style={styles.itemTotalText}>
                ₹{item.pricing.itemTotal}
              </Text>
              {item.pricing.hasDiscount && (
                <Text style={styles.itemTotalOriginal}>
                  ₹{item.pricing.baseTotal}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    );
  };

  // =========================================
  // UI LOADING / EMPTY STATES
  // =========================================
  if (fetchingProfile || inventoryLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading checkout...</Text>
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

  if (cartItemsWithPricing.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyCartContainer}>
          <Ionicons name="cart-outline" size={80} color={Colors.light.textSecondary} />
          <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => router.push("/categories")}
          >
            <Text style={styles.shopButtonText}>Continue Shopping</Text>
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
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          
          {/* Signup Address */}
          <TouchableOpacity
            style={[
              styles.addressCard,
              addressType === "signup" && styles.addressCardSelected,
            ]}
            onPress={() => setAddressType("signup")}
          >
            <View style={styles.addressHeader}>
              <View style={styles.addressIconContainer}>
                <Ionicons
                  name="home-outline"
                  size={20}
                  color={Colors.light.accent}
                />
              </View>
              <View style={styles.addressInfo}>
                <Text style={styles.addressName}>Home Address</Text>
                <Text style={styles.addressText}>
                  {formatAddress(profileData?.deliveryAddress)}
                </Text>
              </View>
              {addressType === "signup" && (
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={Colors.light.accent}
                />
              )}
            </View>
          </TouchableOpacity>

          {/* Current Location */}
          <TouchableOpacity
            style={[
              styles.currentLocCard,
              addressType === "current" && styles.addressCardSelected,
              !currentLocation && styles.disabledCard,
            ]}
            onPress={() => currentLocation && setAddressType("current")}
            disabled={!currentLocation}
          >
            <View style={styles.currentLocHeader}>
              <View style={styles.currentLocIconContainer}>
                <Ionicons
                  name="navigate-outline"
                  size={20}
                  color={currentLocation ? Colors.light.accent : Colors.light.textSecondary}
                />
              </View>
              <View style={styles.currentLocInfo}>
                <Text style={styles.currentLocTitle}>Current Location</Text>
                <Text style={styles.currentLocText}>
                  {currentLocation
                    ? currentLocation.formattedAddress || "Your current location"
                    : "Location not available"}
                </Text>
              </View>
              {addressType === "current" && (
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={Colors.light.accent}
                />
              )}
            </View>
          </TouchableOpacity>
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

        {/* ENHANCED ORDER SUMMARY SECTION WITH DISCOUNT BADGES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Order Items ({cartItemsWithPricing.length})
            </Text>
            {getDiscountedItemsCount() > 0 && (
              <Text style={styles.discountsCount}>
                {getDiscountedItemsCount()} items with discounts
              </Text>
            )}
          </View>

          <View style={styles.summaryCard}>
            {cartItemsWithPricing.map((item, index) => (
              <OrderItem key={`${item._id}-${index}`} item={item} />
            ))}

            <View style={styles.summaryDivider} />

            {/* ENHANCED PRICING BREAKDOWN */}
            <View style={styles.pricingBreakdown}>
              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Subtotal</Text>
                <Text style={styles.pricingValue}>₹{cartSummary.subtotal.toFixed(2)}</Text>
              </View>
              
              {cartSummary.totalDiscount > 0 && (
                <View style={styles.pricingRow}>
                  <Text style={styles.pricingLabel}>Discounts</Text>
                  <Text style={[styles.pricingValue, styles.discountValue]}>
                    -₹{cartSummary.totalDiscount.toFixed(2)}
                  </Text>
                </View>
              )}

              <View style={styles.pricingRow}>
                <Text style={styles.pricingLabel}>Delivery</Text>
                <Text style={styles.pricingValue}>FREE</Text>
              </View>

              <View style={styles.finalTotalRow}>
                <Text style={styles.finalTotalLabel}>Total Amount</Text>
                <View style={styles.finalTotalContainer}>
                  <Text style={styles.finalTotalValue}>₹{cartSummary.finalTotal.toFixed(2)}</Text>
                  {cartSummary.totalDiscount > 0 && (
                    <Text style={styles.originalTotalValue}>
                      ₹{cartSummary.subtotal.toFixed(2)}
                    </Text>
                  )}
                </View>
              </View>

              {cartSummary.totalDiscount > 0 && (
                <View style={styles.savingsHighlight}>
                  <View style={styles.savingsHighlightContent}>
                    <Ionicons name="sparkles" size={20} color="#059669" />
                    <View style={styles.savingsHighlightText}>
                      <Text style={styles.savingsHighlightTitle}>
                        You saved ₹{cartSummary.totalDiscount.toFixed(2)}!
                      </Text>
                      <Text style={styles.savingsHighlightSubtitle}>
                        That's {((cartSummary.totalDiscount / cartSummary.subtotal) * 100).toFixed(1)}% off your order
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* BOTTOM SPACER FOR FOOTER */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* ENHANCED FOOTER */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <View style={styles.totalAmountContainer}>
            <Text style={styles.totalAmount}>₹{cartSummary.finalTotal.toFixed(2)}</Text>
            {cartSummary.totalDiscount > 0 && (
              <Text style={styles.totalOriginalAmount}>
                ₹{cartSummary.subtotal.toFixed(2)}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            loading && styles.buttonDisabled,
          ]}
          onPress={handlePlaceOrder}
          disabled={loading}
        >
          <View style={styles.placeOrderContent}>
            <Text style={styles.placeOrderButtonText}>
              {loading ? "Placing Order..." : `Place Order - ₹${cartSummary.finalTotal.toFixed(2)}`}
            </Text>
            {cartSummary.totalDiscount > 0 && (
              <Text style={styles.placeOrderDiscountText}>
                Save ₹{cartSummary.totalDiscount.toFixed(2)}
              </Text>
            )}
          </View>
          {!loading && (
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* ORDER SUCCESS MODAL */}
      {orderSuccess && (
        <View style={styles.successOverlay}>
          <View style={styles.successModal}>
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            <Text style={styles.successTitle}>Order Placed!</Text>
            <Text style={styles.successSubtitle}>Your order has been placed successfully</Text>
            {cartSummary.totalDiscount > 0 && (
              <Text style={styles.successDiscount}>
                You saved ₹{cartSummary.totalDiscount.toFixed(2)} on this order
              </Text>
            )}
            <Text style={styles.successNote}>Payment: Cash on Delivery</Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ===================== ENHANCED STYLES ===================== //
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: "#F8FAFC" 
  },
  
  // HEADER STYLES
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: '#fff',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: "#1F2937",
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '700',
    color: "#1F2937" 
  },
  discountsCount: {
    fontSize: 12,
    color: '#3B82F6',
    fontWeight: '600',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  // ENHANCED DISCOUNT BADGES
  discountBadge: {
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
  discountBadgeMedium: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  discountBadgeLarge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  discountBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  extendedRangeDot: {
    width: 4,
    height: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
    opacity: 0.8,
  },

  // STATUS BADGES
  statusBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  notAvailableBadge: {
    backgroundColor: "#F59E0B",
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },

  // ENHANCED ORDER ITEM STYLES
  orderItem: {
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
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
  orderItemHeader: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    zIndex: 2,
  },
  orderItemContent: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  orderItemLeft: {
    justifyContent: "center",
  },
  imageContainer: {
    position: "relative",
  },
  orderItemImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
  },
  orderItemImagePlaceholder: {
    width: 70,
    height: 70,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  orderItemImageText: {
    fontSize: 20,
    color: "#9CA3AF",
  },
  orderItemCenter: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  orderItemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
    lineHeight: 20,
  },
  orderItemUnit: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 8,
  },
  priceContainer: {
    marginBottom: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  originalPrice: {
    fontSize: 14,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },
  priceUnit: {
    fontSize: 12,
    color: "#6B7280",
  },
  savingsBadge: {
    alignSelf: "flex-start",
  },
  savingsContent: {
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
  savingsBadgeText: {
    color: "#065F46",
    fontSize: 11,
    fontWeight: "600",
  },
  orderItemRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  quantityDisplay: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
  },
  quantityText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },
  itemTotal: {
    alignItems: "flex-end",
    marginBottom: 8,
  },
  itemTotalText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  itemTotalOriginal: {
    fontSize: 12,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
  },

  // ADDRESS CARD STYLES
  addressCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  addressCardSelected: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  addressHeader: { 
    flexDirection: "row",
    alignItems: "flex-start",
  },
  addressIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: "#F3F4F6",
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
    color: "#1F2937",
    marginBottom: 4,
  },
  addressText: { 
    fontSize: 14, 
    color: "#6B7280",
    lineHeight: 18,
  },

  // CURRENT LOCATION STYLES
  currentLocCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
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
    backgroundColor: "#F3F4F6",
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
    color: "#1F2937",
    marginBottom: 4,
  },
  currentLocText: { 
    fontSize: 14, 
    color: "#6B7280",
    lineHeight: 18,
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
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  paymentCardSelected: { 
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2"
  },
  comingSoonCard: {
    opacity: 0.7,
  },
  paymentIconContainer: {
    width: 48,
    height: 48,
    backgroundColor: "#F3F4F6",
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
    color: "#1F2937"
  },
  comingSoonText: {
    color: "#6B7280",
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
  summaryDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },

  // PRICING BREAKDOWN
  pricingBreakdown: {
    marginTop: 8,
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  pricingLabel: { 
    fontSize: 14, 
    color: "#6B7280" 
  },
  pricingValue: { 
    fontSize: 14, 
    fontWeight: "600",
    color: "#1F2937"
  },
  discountValue: {
    color: "#059669",
    fontWeight: "700",
  },
  finalTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  finalTotalLabel: { 
    fontSize: 16, 
    fontWeight: "700",
    color: "#1F2937"
  },
  finalTotalContainer: {
    alignItems: "flex-end",
  },
  finalTotalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  originalTotalValue: {
    fontSize: 12,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
    marginTop: 2,
  },

  // ENHANCED SAVINGS HIGHLIGHT
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

  // ENHANCED FOOTER STYLES
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
    color: "#6B7280" 
  },
  totalAmountContainer: {
    alignItems: "flex-end",
  },
  totalAmount: { 
    fontSize: 24, 
    fontWeight: "700",
    color: "#1F2937"
  },
  totalOriginalAmount: {
    fontSize: 14,
    color: "#9CA3AF",
    textDecorationLine: "line-through",
    marginTop: 2,
  },
  placeOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: "#DC2626",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: { 
    opacity: 0.6 
  },
  placeOrderContent: {
    flex: 1,
  },
  placeOrderButtonText: { 
    color: "#fff", 
    fontWeight: "700", 
    fontSize: 16,
    marginBottom: 2,
  },
  placeOrderDiscountText: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.9,
  },

  // LOADING AND EMPTY STATES
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
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
    color: "#1F2937",
    marginTop: 16,
    marginBottom: 8,
  },
  addAddressButton: {
    backgroundColor: "#DC2626",
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
  emptyCartContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyCartTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginTop: 16,
    marginBottom: 16,
  },
  shopButton: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: {
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
    color: "#1F2937",
    marginTop: 16,
  },
  successSubtitle: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
  successDiscount: {
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
    marginTop: 8,
  },
  successNote: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 12,
    fontWeight: '500',
  },
});