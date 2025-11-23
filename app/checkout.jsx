//checkout.jsx

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
      <View className={`bg-red-600 px-2 py-1 rounded-lg flex-row items-center gap-1 shadow-lg ${isLarge ? 'px-2.5 py-1.5' : 'px-1.5 py-0.75'}`}>
        <Text className={`text-white text-xs font-extrabold ${isLarge && 'text-sm'}`}>
          {discountPercentage}% OFF
        </Text>
        {isExtendedRange && (
          <View className="w-1 h-1 bg-white rounded-full opacity-80" />
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
      <View className="bg-white mb-3 rounded-xl p-4 shadow-lg relative border border-gray-100">
        <View className="absolute top-2 left-2 right-2 flex-row justify-between z-10">
          {/* Discount Badge */}
          {item.pricing.hasDiscount && item.availableFromRetailer && (
            <DiscountBadge 
              discountPercentage={item.pricing.discountPercentage} 
              isExtendedRange={item.pricing.isExtendedRange}
            />
          )}

          {/* Status Badge */}
          {item.outOfStock && (
            <View className="bg-red-500 px-2 py-1 rounded-lg">
              <Text className="text-white text-xs font-bold">OUT OF STOCK</Text>
            </View>
          )}
          {!item.soldByRetailer && (
            <View className="bg-yellow-500 px-2 py-1 rounded-lg">
              <Text className="text-white text-xs font-bold">NOT AVAILABLE</Text>
            </View>
          )}
        </View>

        <View className="flex-row gap-3 mt-2">
          <View className="justify-center">
            <View className="relative">
              {item.image || item.imageUrl ? (
                <Image
                  source={{ uri: item.image || item.imageUrl }}
                  className="w-[70px] h-[70px] rounded-lg bg-gray-50"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-[70px] h-[70px] bg-gray-50 rounded-lg justify-center items-center border border-gray-200">
                  <Text className="text-xl text-gray-400">📦</Text>
                </View>
              )}
            </View>
          </View>

          <View className="flex-1 justify-between py-1">
            <Text className="text-base font-semibold text-gray-800 mb-0.5 leading-5" numberOfLines={2}>
              {item.name}
            </Text>
            <Text className="text-sm text-gray-600 mb-2">{item.unit}</Text>
            
            {/* Price Display */}
            <View className="mb-1">
              <View className="flex-row items-center gap-1.5 mb-1.5">
                <Text className="text-base font-bold text-gray-800">₹{item.pricing.currentPrice}</Text>
                {item.pricing.hasDiscount && item.pricing.currentPrice < item.pricing.basePrice && (
                  <Text className="text-sm text-gray-400 line-through">₹{item.pricing.basePrice}</Text>
                )}
                <Text className="text-xs text-gray-600">/piece</Text>
              </View>
              
              {/* Savings Badge */}
              {item.pricing.savings > 0 && (
                <View className="self-start">
                  <View className="flex-row items-center bg-green-50 px-2 py-1 rounded-full border border-green-200 gap-1">
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text className="text-emerald-800 text-xs font-semibold">
                      Save ₹{item.pricing.savings}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          <View className="items-end justify-between">
            {/* Quantity Display */}
            <View className="bg-gray-100 px-2 py-1 rounded-lg mb-2">
              <Text className="text-xs font-semibold text-gray-700">Qty: {item.quantity}</Text>
            </View>

            {/* Item Total */}
            <View className="items-end mb-2">
              <Text className="text-base font-bold text-gray-800">
                ₹{item.pricing.itemTotal}
              </Text>
              {item.pricing.hasDiscount && (
                <Text className="text-xs text-gray-400 line-through">
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
      <View className="flex-1 justify-center items-center bg-gray-50">
        <Text className="text-base text-gray-600 mt-3">Loading checkout...</Text>
      </View>
    );
  }

  if (!profileData?.deliveryAddress) {
    return (
      <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
        <View className="flex-1 justify-center items-center px-10">
          <Ionicons name="location-outline" size={70} color={Colors.light.border} />
          <Text className="text-lg font-semibold text-gray-800 mt-4 mb-2">No Address Found</Text>
          <TouchableOpacity
            className="bg-red-600 px-6 py-3 rounded-lg mt-4"
            onPress={() => router.push("/profile")}
          >
            <Text className="text-white font-semibold text-base">Add Address</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (cartItemsWithPricing.length === 0) {
    return (
      <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
        <View className="flex-1 justify-center items-center px-10">
          <Ionicons name="cart-outline" size={80} color={Colors.light.textSecondary} />
          <Text className="text-lg font-semibold text-gray-800 mt-4 mb-4">Your cart is empty</Text>
          <TouchableOpacity
            className="bg-red-600 px-6 py-3 rounded-lg"
            onPress={() => router.push("/categories")}
          >
            <Text className="text-white font-semibold text-base">Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // =========================================
  // MAIN UI
  // =========================================

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>

      {/* HEADER */}
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-200 bg-white shadow-sm">
        <TouchableOpacity 
          className="p-1"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-800">Checkout</Text>
        <View className="w-6" />
      </View>

      <ScrollView 
        className="flex-1" 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >

        {/* DELIVERY ADDRESS SECTION */}
        <View className="mt-6 px-5">
          <Text className="text-lg font-bold text-gray-800">Delivery Address</Text>
          
          {/* Signup Address */}
          <TouchableOpacity
            className={`bg-white p-4 rounded-xl border-2 mb-3 shadow-sm ${addressType === "signup" ? "border-red-600 bg-red-50" : "border-gray-200"}`}
            onPress={() => setAddressType("signup")}
          >
            <View className="flex-row items-start">
              <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center mr-3 mt-0.5">
                <Ionicons
                  name="home-outline"
                  size={20}
                  color={Colors.light.accent}
                />
              </View>
              <View className="flex-1 mr-3">
                <Text className="text-base font-bold text-gray-800 mb-1">Home Address</Text>
                <Text className="text-sm text-gray-600 leading-[18px]">
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
            className={`bg-white p-4 rounded-xl border-2 mb-3 shadow-sm ${addressType === "current" ? "border-red-600 bg-red-50" : "border-gray-200"} ${!currentLocation && "opacity-60"}`}
            onPress={() => currentLocation && setAddressType("current")}
            disabled={!currentLocation}
          >
            <View className="flex-row items-start">
              <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center mr-3 mt-0.5">
                <Ionicons
                  name="navigate-outline"
                  size={20}
                  color={currentLocation ? Colors.light.accent : Colors.light.textSecondary}
                />
              </View>
              <View className="flex-1 mr-3">
                <Text className="text-base font-bold text-gray-800 mb-1">Current Location</Text>
                <Text className="text-sm text-gray-600 leading-[18px]">
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
        <View className="mt-6 px-5">
          <Text className="text-lg font-bold text-gray-800">Payment Method</Text>

          {[
            { key: "upi", label: "UPI", icon: "wallet-outline", status: "coming_soon" },
            { key: "card", label: "Card", icon: "card-outline", status: "coming_soon" },
            { key: "cash", label: "Cash on Delivery", icon: "cash-outline", status: "available" }
          ].map((method) => (
            <TouchableOpacity
              key={method.key}
              className={`flex-row items-center bg-white p-4 rounded-xl mb-3 border-2 shadow-sm ${selectedPayment === method.key && method.status === "available" ? "border-red-600 bg-red-50" : "border-gray-200"} ${method.status === "coming_soon" && "opacity-70"}`}
              onPress={() => {
                if (method.status === "available") {
                  setSelectedPayment(method.key);
                } else {
                  Alert.alert("Coming Soon", `${method.label} payment will be available soon!`);
                }
              }}
              disabled={method.status === "coming_soon"}
            >
              <View className="w-12 h-12 bg-gray-100 rounded-full items-center justify-center mr-4">
                <Ionicons
                  name={method.icon}
                  size={24}
                  color={method.status === "coming_soon" ? Colors.light.textSecondary : Colors.light.accent}
                />
              </View>

              <View className="flex-1 flex-row items-center justify-between">
                <Text className={`text-base font-semibold ${method.status === "coming_soon" ? "text-gray-600" : "text-gray-800"}`}>
                  {method.label}
                </Text>
                {method.status === "coming_soon" && (
                  <Text className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">Coming Soon</Text>
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
        <View className="mt-6 px-5">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-gray-800">
              Order Items ({cartItemsWithPricing.length})
            </Text>
            {getDiscountedItemsCount() > 0 && (
              <Text className="text-xs text-blue-500 font-semibold bg-blue-50 px-2 py-1 rounded-lg">
                {getDiscountedItemsCount()} items with discounts
              </Text>
            )}
          </View>

          <View className="bg-white p-5 rounded-xl shadow-sm">
            {cartItemsWithPricing.map((item, index) => (
              <OrderItem key={`${item._id}-${index}`} item={item} />
            ))}

            <View className="h-px bg-gray-200 my-3" />

            {/* ENHANCED PRICING BREAKDOWN */}
            <View className="mt-2">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm text-gray-600">Subtotal</Text>
                <Text className="text-sm font-semibold text-gray-800">₹{cartSummary.subtotal.toFixed(2)}</Text>
              </View>
              
              {cartSummary.totalDiscount > 0 && (
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm text-gray-600">Discounts</Text>
                  <Text className="text-sm font-bold text-emerald-600">
                    -₹{cartSummary.totalDiscount.toFixed(2)}
                  </Text>
                </View>
              )}

              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm text-gray-600">Delivery</Text>
                <Text className="text-sm font-semibold text-gray-800">FREE</Text>
              </View>

              <View className="flex-row justify-between items-center mt-3 pt-3 border-t border-gray-200">
                <Text className="text-base font-bold text-gray-800">Total Amount</Text>
                <View className="items-end">
                  <Text className="text-lg font-bold text-gray-800">₹{cartSummary.finalTotal.toFixed(2)}</Text>
                  {cartSummary.totalDiscount > 0 && (
                    <Text className="text-xs text-gray-400 line-through mt-0.5">
                      ₹{cartSummary.subtotal.toFixed(2)}
                    </Text>
                  )}
                </View>
              </View>

              {cartSummary.totalDiscount > 0 && (
                <View className="mb-4 bg-green-50 p-4 rounded-xl border border-green-200 mt-4">
                  <View className="flex-row items-center gap-3">
                    <Ionicons name="sparkles" size={20} color="#059669" />
                    <View className="flex-1">
                      <Text className="text-emerald-800 text-base font-bold mb-0.5">
                        You saved ₹{cartSummary.totalDiscount.toFixed(2)}!
                      </Text>
                      <Text className="text-emerald-800 text-xs opacity-80">
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
        <View className="h-5" />
      </ScrollView>

      {/* ENHANCED FOOTER */}
      <View className="px-5 pt-4 bg-white border-t border-gray-200 shadow-lg" style={{ paddingBottom: insets.bottom + 16 }}>
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-base font-semibold text-gray-600">Total Amount</Text>
          <View className="items-end">
            <Text className="text-2xl font-bold text-gray-800">₹{cartSummary.finalTotal.toFixed(2)}</Text>
            {cartSummary.totalDiscount > 0 && (
              <Text className="text-sm text-gray-400 line-through mt-0.5">
                ₹{cartSummary.subtotal.toFixed(2)}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          className={`flex-row items-center justify-between bg-red-600 px-6 py-4 rounded-xl shadow-lg ${loading && "opacity-60"}`}
          onPress={handlePlaceOrder}
          disabled={loading}
        >
          <View className="flex-1">
            <Text className="text-white font-bold text-base mb-0.5">
              {loading ? "Placing Order..." : `Place Order - ₹${cartSummary.finalTotal.toFixed(2)}`}
            </Text>
            {cartSummary.totalDiscount > 0 && (
              <Text className="text-white text-xs opacity-90">
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
        <View className="absolute top-0 left-0 right-0 bottom-0 bg-black/70 justify-center items-center z-50">
          <View className="bg-white p-8 rounded-2xl items-center m-6 shadow-xl">
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            <Text className="text-2xl font-bold text-gray-800 mt-4">Order Placed!</Text>
            <Text className="text-base text-gray-600 mt-2 text-center leading-[22px]">
              Your order has been placed successfully
            </Text>
            {cartSummary.totalDiscount > 0 && (
              <Text className="text-sm text-emerald-600 font-semibold mt-2">
                You saved ₹{cartSummary.totalDiscount.toFixed(2)} on this order
              </Text>
            )}
            <Text className="text-sm text-gray-600 mt-3 font-medium">Payment: Cash on Delivery</Text>
          </View>
        </View>
      )}
    </View>
  );
}