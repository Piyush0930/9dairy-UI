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

  // FIX: Try-catch mein wrap karo navigation
  try {
    router.push("/checkout");
  } catch (error) {
    console.error("Navigation error:", error);
    Alert.alert("Error", "Unable to navigate to checkout. Please try again.");
  }
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
      <Animated.View className="bg-white my-1.5 rounded-xl p-4 shadow-sm border border-gray-100 relative" style={{ transform: [{ scale: itemScale }] }}>
        <View className="absolute top-2 left-2 right-2 flex-row justify-between z-10">
          {/* Discount Badge - Positioned above image */}
          {item.pricing.hasDiscount && item.availableFromRetailer && (
            <View className="bg-red-600 px-2 py-1 rounded flex-row items-center gap-1 shadow-sm">
              <Text className="text-white text-xs font-extrabold">
                {item.pricing.discountPercentage}% OFF
              </Text>
              {item.pricing.isExtendedRange && (
                <View className="w-1 h-1 bg-white rounded-full opacity-80" />
              )}
            </View>
          )}

          {/* Status Badge */}
          {item.outOfStock && (
            <View className="bg-red-500 px-2 py-1 rounded">
              <Text className="text-white text-xs font-bold">OUT OF STOCK</Text>
            </View>
          )}
          {!item.soldByRetailer && (
            <View className="bg-yellow-500 px-2 py-1 rounded">
              <Text className="text-white text-xs font-bold">NOT AVAILABLE</Text>
            </View>
          )}
        </View>

        <View className="flex-row gap-3 mt-2">
          <View className="justify-center">
            <View className="relative">
              {item.image || item.imageUrl ? (
                <Image
                  source={getImageSource(item.image || item.imageUrl)}
                  className="w-[70px] h-[70px] rounded bg-gray-50"
                  resizeMode="cover"
                />
              ) : (
                <View className="w-[70px] h-[70px] bg-gray-50 rounded justify-center items-center border border-gray-200">
                  <Text className="text-xl text-gray-400">📦</Text>
                </View>
              )}
            </View>
          </View>

          <View className="flex-1 justify-between py-1">
            <Text className="text-base font-semibold text-gray-800 mb-0.5 leading-5" numberOfLines={2}>
              {item.name}
            </Text>
            <Text className="text-sm text-gray-500 mb-2">{item.unit}</Text>
            
            {/* Price Display */}
            <View className="mb-1">
              <View className="flex-row items-center gap-1.5 mb-1.5">
                <Text className="text-base font-bold text-gray-800">₹{item.pricing.currentPrice}</Text>
                {item.pricing.hasDiscount && item.pricing.currentPrice < item.pricing.basePrice && (
                  <Text className="text-sm text-gray-400 line-through">₹{item.pricing.basePrice}</Text>
                )}
                <Text className="text-xs text-gray-500">/piece</Text>
              </View>
              
              {/* Professional Savings Badge */}
              {item.pricing.savings > 0 && (
                <Animated.View 
                  className="self-start"
                  style={{ transform: [{ scale: savingsScale }] }}
                >
                  <View className="flex-row items-center bg-green-50 px-2 py-1 rounded-full border border-green-200 gap-1">
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text className="text-emerald-800 text-xs font-semibold">
                      Save ₹{item.pricing.savings}
                    </Text>
                  </View>
                </Animated.View>
              )}
            </View>
          </View>

          <View className="items-end justify-between">
            {/* Quantity Controls */}
            {item.availableFromRetailer && (
              <View className="flex-row items-center bg-red-50 rounded px-2 py-1.5 mb-2 border border-red-200">
                <TouchableOpacity 
                  className={`p-1 bg-white rounded shadow-sm ${item.quantity <= 1 ? 'bg-gray-50 shadow-none' : ''}`}
                  onPress={handleDecrease}
                  disabled={item.quantity <= 1}
                >
                  <Ionicons 
                    name="remove" 
                    size={18} 
                    color={item.quantity <= 1 ? "#9CA3AF" : "#DC2626"} 
                  />
                </TouchableOpacity>
                
                <Text className="text-sm font-semibold text-gray-800 min-w-6 text-center">{item.quantity}</Text>
                
                <TouchableOpacity 
                  className="p-1 bg-white rounded shadow-sm" 
                  onPress={handleIncrease}
                >
                  <Ionicons name="add" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            )}

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

            // Header mein back button fix karo
<TouchableOpacity 
  className="p-1"
  onPress={() => {
    try {
      router.back();
    } catch (error) {
      console.error("Navigation back error:", error);
    }
  }}
>
  <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
</TouchableOpacity>
          </View>
        </View>

        {/* Availability Message */}
        {!item.availableFromRetailer && (
          <View className={`mt-3 p-2 rounded flex-row items-center gap-1.5 ${item.outOfStock ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-orange-200'}`}>
            <Ionicons 
              name={item.outOfStock ? "alert-circle" : "information-circle"} 
              size={16} 
              color={item.outOfStock ? "#DC2626" : "#F59E0B"} 
            />
            <Text className="text-xs font-medium text-gray-800 flex-1">
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
    <View className="p-5 bg-white">
      <View className="mb-4">
        <Text className="text-lg font-bold text-gray-800">Order Summary</Text>
      </View>

      {/* Professional Savings Highlight */}
      {cartTotals.totalSavings > 0 && (
        <View className="mb-4 bg-green-50 p-4 rounded-xl border border-green-200">
          <View className="flex-row items-center gap-3">
            <Ionicons name="sparkles" size={20} color="#059669" />
            <View className="flex-1">
              <Text className="text-emerald-800 text-base font-bold mb-0.5">
                You're saving ₹{cartTotals.totalSavings}!
              </Text>
              <Text className="text-emerald-800 text-xs opacity-80">
                That's {cartTotals.savingsPercentage}% off your order
              </Text>
            </View>
          </View>
        </View>
      )}

      <View className="mb-5">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm text-gray-500">Subtotal</Text>
          <Text className="text-sm font-semibold text-gray-800">₹{cartTotals.subtotal}</Text>
        </View>

        {cartTotals.totalSavings > 0 && (
          <View className="flex-row justify-between items-center mb-2">
            <Text className="text-sm text-gray-500">Discounts</Text>
            <Text className="text-sm font-bold text-green-600">
              -₹{cartTotals.totalSavings}
            </Text>
          </View>
        )}

        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-sm text-gray-500">Delivery</Text>
          <Text className="text-sm font-semibold text-gray-800">FREE</Text>
        </View>

        <View className="h-px bg-gray-200 my-3" />

        <View className="flex-row justify-between items-center mb-0">
          <Text className="text-base font-bold text-gray-800">Total</Text>
          <View className="items-end">
            <Text className="text-xl font-bold text-gray-800">₹{cartTotals.finalTotal}</Text>
            {cartTotals.totalSavings > 0 && (
              <Text className="text-sm text-gray-400 line-through">
                ₹{cartTotals.subtotal}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Professional Checkout Button */}
      <TouchableOpacity 
        className={`rounded-xl shadow-lg ${!cartItemsWithPricing.some(item => item.availableFromRetailer) ? 'bg-gray-400 opacity-60 shadow-gray-400' : 'bg-red-600 shadow-red-600'}`}
        onPress={handleCheckout}
        disabled={!cartItemsWithPricing.some(item => item.availableFromRetailer)}
      >
        <View className="flex-row items-center justify-between px-6 py-4.5">
          <Text className="text-white text-base font-bold">
            Proceed to Checkout
          </Text>
          <View className="bg-white/20 px-3 py-1.5 rounded">
            <Text className="text-white text-sm font-bold">₹{cartTotals.finalTotal}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {!cartItemsWithPricing.some(item => item.availableFromRetailer) && (
        <Text className="text-xs text-gray-500 text-center mt-2">
          Add available items to proceed with checkout
        </Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
        <View className="flex-1 justify-center items-center">
          <Text className="text-base text-gray-500">Loading cart...</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="bg-white pb-3 border-b border-gray-200 shadow-sm">
        <View className="flex-row justify-between items-center px-4 pt-3 pb-4">
          <TouchableOpacity 
            className="p-1"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-xl font-bold text-gray-800">My Cart</Text>
          <View className="flex-row items-center">
            <TouchableOpacity 
              className="px-3 py-1.5"
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
              <Text className={`text-sm font-semibold ${items.length === 0 ? 'text-gray-400 opacity-50' : 'text-red-600'}`}>
                Clear All
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {items.length > 0 && (
          <View className="px-4 pb-2">
            <Text className="text-sm text-gray-500">
              {items.length} item{items.length !== 1 ? 's' : ''} in cart
            </Text>
          </View>
        )}
      </View>

      {/* Cart Content */}
      <View className="flex-1">
        {cartItemsWithPricing.length === 0 ? (
          <View className="flex-1 justify-center items-center px-10">
            <View className="mb-6">
              <Ionicons name="cart-outline" size={80} color="#D1D5DB" />
            </View>
            <Text className="text-xl font-bold text-gray-800 mb-2 text-center">Your cart is empty</Text>
            <Text className="text-base text-gray-500 text-center mb-8 leading-5.5">
              Browse our categories and add some delicious dairy products!
            </Text>
            <TouchableOpacity 
  className="bg-red-600 px-8 py-4 rounded-xl shadow-lg shadow-red-600"
  onPress={() => {
    try {
      router.push("/categories");
    } catch (error) {
      console.error("Navigation error:", error);
    }
  }}
>
  <Text className="text-white text-base font-bold">Start Shopping</Text>
</TouchableOpacity>
          </View>
        ) : (
          <View className="flex-1">
            {/* Cart Items ScrollView */}
            <ScrollView
              className="flex-1"
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              contentContainerClassName="px-4 pt-3 pb-52"
            >
              {cartItemsWithPricing.map((item) => (
                <CartItem key={item._id} item={item} />
              ))}
              
              {/* Add space at the bottom for the order summary */}
              <View className="h-5" />
            </ScrollView>

            {/* Fixed Order Summary at Bottom */}
            <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200">
              <OrderSummary />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}