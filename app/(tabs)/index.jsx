// app/(tabs)/index.jsx

import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Alert,
  TextInput,
  Image,
  Dimensions,
  AppState
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import { useCart } from "@/contexts/CartContext";
import Colors from "@/constants/colors";
import ProductCard from "@/components/ProductCard";
import CategoryTile from "@/components/CategoryTile";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 64;
const CARD_SPACING = 16;
const POPULAR_CARD_WIDTH = 165;
const POPULAR_CARD_SPACING = 12;

const API_BASE = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") || "";

// ⭐ LOCAL CACHE KEYS
const RETAILER_CACHE_KEY = 'current_retailer_cache';
const LOCATION_CACHE_KEY = 'current_location_cache';
const LOCATION_SESSION_KEY = 'location_selected_in_session'; // NEW: Session tracking

// Store banners (unchanged)
const storeCards = [
  { id: 1, image: require('../../assets/images/banner1.jpg') },
  { id: 2, image: require('../../assets/images/banner2.jpg') },
  { id: 3, image: require('../../assets/images/banner3.jpg') },
  { id: 4, image: require('../../assets/images/banner4.jpg') },
  { id: 5, image: require('../../assets/images/banner5.jpg') },
];

// ⭐ LOCAL CACHE FUNCTIONS
const saveRetailerToCache = async (retailerData) => {
  try {
    const cacheData = {
      retailer: retailerData,
      timestamp: Date.now(),
      sessionId: Math.random().toString(36).substr(2, 9)
    };
    await AsyncStorage.setItem(RETAILER_CACHE_KEY, JSON.stringify(cacheData));
    console.log("✅ Retailer saved to cache");
  } catch (error) {
    console.log('❌ Cache save error:', error);
  }
};

const getRetailerFromCache = async () => {
  try {
    const cached = await AsyncStorage.getItem(RETAILER_CACHE_KEY);
    if (!cached) {
      console.log("❌ No retailer cache found");
      return null;
    }
    
    const cacheData = JSON.parse(cached);
    console.log("✅ Retailer cache found");
    return cacheData.retailer;
  } catch (error) {
    console.log('❌ Cache read error:', error);
    return null;
  }
};

// ⭐ CLEAR CACHE FUNCTION - Called on app close
const clearRetailerCache = async () => {
  try {
    await AsyncStorage.removeItem(RETAILER_CACHE_KEY);
    await AsyncStorage.removeItem(LOCATION_CACHE_KEY);
    await AsyncStorage.removeItem(LOCATION_SESSION_KEY); // NEW: Clear session too
    console.log("✅ Retailer cache and session cleared on app close");
  } catch (error) {
    console.log('❌ Cache clear error:', error);
  }
};

const saveLocationToCache = async (locationData) => {
  try {
    await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(locationData));
  } catch (error) {
    console.log('Location cache save error:', error);
  }
};

const getLocationFromCache = async () => {
  try {
    const cached = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.log('Location cache read error:', error);
    return null;
  }
};

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { authToken } = useAuth();
  const token = authToken;
  const { assignedRetailer, updateLocationAndRetailer, usedLocationType } = useProfile();
  const { getTotalItems, items } = useCart();
  const cartCount = getTotalItems();

  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [locationSelected, setLocationSelected] = useState(false); // NEW: Session state

  const popularScrollRef = useRef(null);
  const appState = useRef(AppState.currentState);

  // ------------- Inventory Attachment Logic -------------
  const normalize = (s) => {
    if (!s && s !== 0) return null;
    return String(s).trim().toLowerCase();
  };

  const attachInventoryToProducts = (products, inventoryArr) => {
    if (!Array.isArray(products)) return [];
    
    const invMap = new Map();
    
    // Create mapping for inventory
    inventoryArr?.forEach(inv => {
      const prod = inv.product || {};
      const ids = [prod.id, prod._id, prod.productId, prod.sku].filter(Boolean);
      const nameKey = normalize(prod.name);

      ids.forEach(id => invMap.set(String(id), inv));
      if (nameKey) invMap.set("name:" + nameKey, inv);
    });

    const findInv = (p) => {
      const ids = [p._id, p.id, p.productId, p.sku].filter(Boolean);
      for (const id of ids) {
        if (invMap.has(String(id))) return invMap.get(String(id));
      }

      const key = normalize(p.name);
      if (key && invMap.has("name:" + key)) return invMap.get("name:" + key);

      return null;
    };

    return products.map(p => {
      const inv = findInv(p);
      const stock = inv?.currentStock ?? null;

      return {
        ...p,
        _inventory: inv || null,
        soldByRetailer: Boolean(inv),
        currentStock: stock,
        outOfStock: stock !== null ? Number(stock) <= 0 : false,
        price: inv?.sellingPrice ?? p.discountedPrice ?? p.price ?? 0
      };
    });
  };

  // ------------- API Calls -------------
  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/catalog/categories`);
      const j = await res.json();
      return j.categories ?? j ?? [];
    } catch {
      return [];
    }
  };

  const fetchFeaturedProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/catalog/products/featured`);
      const j = await res.json();
      return j.products ?? j ?? [];
    } catch {
      return [];
    }
  };

  const fetchInventory = async () => {
    if (!token) return [];
    try {
      const res = await fetch(`${API_BASE}/api/customer/inventory`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const j = await res.json();
      return j.data?.inventory ?? [];
    } catch {
      return [];
    }
  };

  const fetchProfileAddress = async () => {
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE}/api/customer/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const profile = await res.json();
      return profile?.deliveryAddress;
    } catch {
      return null;
    }
  };

  // ⭐ UPDATED: Assign Retailer - REMOVED useCached parameter since we're not using cache
  const postAssignRetailer = async (lat, lng, address = "") => {
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE}/api/customer/assign-retailer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          lat, 
          lng, 
          address
        })
      });
      return await res.json();
    } catch {
      return null;
    }
  };

  // ------------- Location Functions -------------
  const getDeviceLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Location permission denied");
    }

    const pos = await Location.getCurrentPositionAsync({ 
      accuracy: Location.Accuracy.Highest 
    });

    return { 
      lat: pos.coords.latitude, 
      lng: pos.coords.longitude 
    };
  };

  // Helper function for address formatting
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

  // ⭐ UPDATED: Load products WITHOUT cache support
  const loadProductsWithRetailer = async (retailer, inventoryData, locationData = null) => {
    try {
      const [cats, prods] = await Promise.all([
        fetchCategories(),
        fetchFeaturedProducts()
      ]);

      setCategories(cats);

      const mapped = attachInventoryToProducts(prods, inventoryData);
      setFeaturedProducts(mapped);
      
      // Popular products - ONLY in-stock items
      setPopularProducts(
        mapped.filter(p => p.soldByRetailer && !p.outOfStock).slice(0, 8)
      );

      // Update profile context if location data provided
      if (locationData && updateLocationAndRetailer) {
        updateLocationAndRetailer(
          locationData,
          retailer,
          locationData.type || "current"
        );
      }

      console.log(`✅ Products loaded for retailer: ${retailer.shopName}`);
    } catch (error) {
      console.error("❌ Error loading products:", error);
      throw error;
    }
  };

  // ------------- Location Handlers -------------
  const handleUseCurrentAddress = async () => {
    try {
      setShowLocationPrompt(false);
      setLocationSelected(true);
      setLoading(true);

      // ⭐ MARK: Location selected in this session
      await AsyncStorage.setItem(LOCATION_SESSION_KEY, 'true');

      const loc = await getDeviceLocation();
      const locationData = { 
        coordinates: { latitude: loc.lat, longitude: loc.lng },
        formattedAddress: "Current Location",
        type: "current"
      };

      const resp = await postAssignRetailer(loc.lat, loc.lng, "Current Location");

      if (!resp || !resp.success) {
        Alert.alert("Error", "Could not assign nearest retailer.");
        return;
      }

      // ⭐ SAVE TO CACHE ONLY FOR CURRENT SESSION
      // Cache will be cleared when app closes
      await saveRetailerToCache(resp.retailer);
      await saveLocationToCache(locationData);

      await loadProductsWithRetailer(resp.retailer, resp.inventory ?? [], locationData);
      
      // ⭐ SHOW ALERT IF CART ITEMS AFFECTED
      if (items.length > 0) {
        Alert.alert(
          "Location Changed", 
          "Your cart items availability has been updated based on new location.",
          [{ text: "OK" }]
        );
      }

    } catch (err) {
      Alert.alert("Location Error", "Unable to fetch current location.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    try {
      setShowLocationPrompt(false);
      setLocationSelected(true);
      setLoading(true);

      // ⭐ MARK: Location selected in this session
      await AsyncStorage.setItem(LOCATION_SESSION_KEY, 'true');

      console.log("🔄 Skip clicked - using saved address from profile");

      // 1. Get saved address from profile
      const savedAddress = await fetchProfileAddress();
      
      if (!savedAddress) {
        Alert.alert("No Saved Address", "Please add an address in your profile.");
        setLoading(false);
        return;
      }

      const addr = savedAddress;
      const lat = Number(
        addr?.coordinates?.latitude ??
        addr?.lat ??
        addr?.latitude
      );
      const lng = Number(
        addr?.coordinates?.longitude ??
        addr?.lng ??
        addr?.longitude
      );

      if (!lat || !lng) {
        Alert.alert("Invalid Address", "Your saved address has no coordinates.");
        setLoading(false);
        return;
      }

      const locationData = { 
        coordinates: { latitude: lat, longitude: lng },
        formattedAddress: formatAddress(savedAddress),
        type: "signup"
      };

      // 2. Assign retailer using saved address coordinates
      console.log("📍 Assigning retailer using saved address...");
      const assignResp = await postAssignRetailer(lat, lng, "Saved Address");

      if (!assignResp || !assignResp.success) {
        Alert.alert("Error", "Failed to assign retailer for your saved address.");
        return;
      }

      // ⭐ SAVE TO CACHE ONLY FOR CURRENT SESSION
      await saveRetailerToCache(assignResp.retailer);
      await saveLocationToCache(locationData);

      await loadProductsWithRetailer(
        assignResp.retailer, 
        assignResp.inventory ?? [], 
        locationData
      );

      // ⭐ SHOW ALERT IF CART ITEMS AFFECTED
      if (items.length > 0) {
        Alert.alert(
          "Location Changed", 
          "Your cart items availability has been updated based on new location.",
          [{ text: "OK" }]
        );
      }

      console.log("✅ Skip completed - Using saved address with correct retailer products");

    } catch (err) {
      console.log("❌ Skip error:", err);
      Alert.alert("Error", "Failed to load products for your saved address.");
    } finally {
      setLoading(false);
    }
  };

  // ⭐ UPDATED: Initial Load - SMART LOCATION PROMPT
  useEffect(() => {
    const initialLoad = async () => {
      if (!token) return;
      
      setLoading(true);
      
      try {
        // ⭐ STEP 1: Check if location was already selected in this session
        const locationSelectedInSession = await AsyncStorage.getItem(LOCATION_SESSION_KEY);
        
        if (locationSelectedInSession === 'true') {
          // Location already selected - try to use cached retailer
          console.log("🔄 Location already selected this session - using cached data");
          setShowLocationPrompt(false);
          setLocationSelected(true);
          
          const cachedRetailer = await getRetailerFromCache();
          const cachedLocation = await getLocationFromCache();
          
          if (cachedRetailer) {
            // Load products with cached retailer
            const inventory = await fetchInventory();
            await loadProductsWithRetailer(cachedRetailer, inventory, cachedLocation);
          } else {
            // No cache found, show prompt
            console.log("🔄 No cached retailer found - showing location prompt");
            setShowLocationPrompt(true);
          }
        } else {
          // ⭐ STEP 2: First time in session - show location prompt
          console.log("🔄 First app open - showing location prompt");
          setShowLocationPrompt(true);
        }

        // ⭐ STEP 3: Always load categories (even if location not selected yet)
        const cats = await fetchCategories();
        setCategories(cats);

      } catch (error) {
        console.error("Initial load error:", error);
        // On error, show location prompt
        setShowLocationPrompt(true);
      } finally {
        setLoading(false);
      }
    };

    initialLoad();
  }, [token]);

  // ⭐ UPDATED: App State Listener to Clear Cache on App Close
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      // When app goes from active to background/inactive (app closing)
      if (appState.current === 'active' && 
          (nextAppState === 'background' || nextAppState === 'inactive')) {
        console.log('🔄 App closing - Clearing retailer cache and session');
        clearRetailerCache();
      }
      
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // ⭐ NEW: Handle logout - reset session state
  useEffect(() => {
    if (!token) {
      // User logged out - clear session and show prompt next time
      console.log("🔄 User logged out - resetting location session");
      setLocationSelected(false);
      setShowLocationPrompt(true);
      AsyncStorage.removeItem(LOCATION_SESSION_KEY);
    }
  }, [token]);

  // ------------- Refresh -------------
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const [cats, prods] = await Promise.all([
        fetchCategories(),
        fetchFeaturedProducts()
      ]);
      
      const inv = await fetchInventory();
      
      const mapped = attachInventoryToProducts(prods, inv);
      
      setCategories(cats);
      setFeaturedProducts(mapped);
      setPopularProducts(
        mapped.filter(p => p.soldByRetailer && !p.outOfStock).slice(0, 8)
      );
    } catch (error) {
      console.error("Refresh error:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // ------------- Infinite Scroll Arrays -------------
  const infiniteStoreCards = [...storeCards, ...storeCards, ...storeCards];
  const infinitePopularProducts = [...popularProducts, ...popularProducts, ...popularProducts];

  // ------------- Scroll Handler for Infinite Loop -------------
  const handlePopularScroll = (event) => {
    if (popularProducts.length === 0) return;

    const scrollX = event.nativeEvent.contentOffset.x;
    const cardWidth = POPULAR_CARD_WIDTH + POPULAR_CARD_SPACING;
    const total = popularProducts.length * cardWidth;

    if (scrollX >= total * 2) {
      popularScrollRef.current?.scrollTo({ x: total, animated: false });
    } else if (scrollX <= total - cardWidth) {
      popularScrollRef.current?.scrollTo({ x: total * 2 - cardWidth, animated: false });
    }
  };

  // ------------- Render -------------
  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.light.tint]}
          />
        }
      >

        {/* SEARCH BAR - Only show if location is selected */}
        {!showLocationPrompt && (
          <View className="flex-row px-4 pt-4 pb-4 gap-2 items-center bg-white">
            <View className="flex-1 flex-row items-center bg-white rounded-3xl border border-[#E8E8E8] px-4 h-13 gap-2.5">
              <Ionicons name="search" size={20} color="#EF4444" />
              <TextInput
                placeholder="Search 'Salted Butter'"
                className="flex-1 text-base text-gray-900 font-normal"
                placeholderTextColor="#BDBDBD"
              />
            </View>

            <TouchableOpacity
              className="w-13 h-13 rounded-full bg-white border border-[#E8E8E8] justify-center items-center relative"
              onPress={() => router.push("/cart")}
            >
              <Ionicons name="cart-outline" size={22} color="#1A1A1A" />
              {cartCount > 0 && (
                <View className="absolute top-2 right-2 bg-red-500 rounded-full min-w-[45px] h-5.5 justify-center items-center px-2">
                  <Text className="text-white text-xs font-bold">
                    {cartCount > 99 ? "99+" : cartCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Show loading only when location prompt is not visible */}
        {loading && !showLocationPrompt && (
          <View className="flex-1 justify-center items-center py-25">
            <ActivityIndicator size="large" color={Colors.light.tint} />
            <Text className="mt-2.5 text-base text-gray-600">Loading products...</Text>
          </View>
        )}

        {/* CONTENT - Only show if location is selected and not loading */}
        {!showLocationPrompt && !loading && (
          <>
            {/* FEATURED STORES */}
            <View className="px-4 mt-6">
              <View className="flex-row items-center mb-4 gap-2">
                <Text className="text-xl font-bold text-gray-900">Featured Stores</Text>
                <View className="bg-red-500 px-2 py-0.75 rounded">
                  <Text className="text-white text-xs font-bold">NEW</Text>
                </View>
              </View>

              <View className="mx--4">
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={CARD_WIDTH + CARD_SPACING}
                  decelerationRate="fast"
                  contentContainerStyle={{ paddingHorizontal: 32, paddingVertical: 12 }}
                >
                  {infiniteStoreCards.map((store, index) => (
                    <TouchableOpacity
                      key={`${store.id}-${index}`}
                      className="w-[280px] aspect-video mr-4 rounded-xl overflow-hidden elevation-8"
                      onPress={() => router.push("/categories")}
                      activeOpacity={0.9}
                    >
                      <Image source={store.image} className="w-full h-full rounded-xl" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>

            {/* CATEGORIES */}
            <View className="px-4 mt-6">
              <Text className="text-xl font-bold text-gray-900">Shop by category</Text>

              {categories.length > 0 ? (
                <View className="flex-row flex-wrap justify-between mt-3">
                  {categories.map((cat) => (
                    <CategoryTile
                      key={cat._id || cat.id}
                      name={cat.name}
                      image={cat.image}
                      color={cat.color || "#E3F2FD"}
                      onPress={() =>
                        router.push({
                          pathname: "/categories",
                          params: { categoryId: cat._id },
                        })
                      }
                    />
                  ))}
                </View>
              ) : (
                <View className="justify-center items-center py-10">
                  <Text className="text-base text-gray-600">No categories found</Text>
                </View>
              )}
            </View>

            {/* POPULAR PRODUCTS - ONLY AVAILABLE */}
            <View className="px-4 mt-6">
              <View className="flex-row items-center mb-4 gap-2">
                <Text className="text-xl font-bold text-gray-900">Popular</Text>
                <View className="w-8 h-8 rounded bg-orange-50 justify-center items-center">
                  <Text className="text-lg">🔥</Text>
                </View>
              </View>

              <Text className="text-sm text-gray-600 mb-3">Most frequently bought</Text>

              {popularProducts.length > 0 ? (
                <View className="mx--4">
                  <ScrollView
                    ref={popularScrollRef}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
                    snapToInterval={POPULAR_CARD_WIDTH + POPULAR_CARD_SPACING}
                    decelerationRate="fast"
                    onScroll={handlePopularScroll}
                    scrollEventThrottle={16}
                  >
                    {infinitePopularProducts
                      .filter((p) => p && p.soldByRetailer && !p.outOfStock)
                      .map((product, index) => (
                        <View
                          key={`${product._id || product.id}-${index}`}
                          className="w-[165px] mr-3"
                        >
                          <ProductCard product={product} />
                        </View>
                      ))}
                  </ScrollView>
                </View>
              ) : (
                <View className="justify-center items-center py-10">
                  <Text className="text-base text-gray-600">No popular products available</Text>
                </View>
              )}
            </View>

            {/* QUICK LINKS */}
            <View className="px-4 mt-6 mb-30">
              <Text className="text-xl font-bold text-gray-900">Quick links</Text>

              <View className="flex-row gap-3 mt-3">
                <TouchableOpacity
                  className="flex-1 items-center"
                  onPress={() => router.push("/wallet")}
                >
                  <View
                    className="w-full aspect-square rounded-xl justify-center items-center mb-2"
                    style={{ backgroundColor: "#06B6D4" }}
                  >
                    <Text className="text-4xl">💳</Text>
                  </View>
                  <Text className="text-base font-bold text-gray-900">Wallet</Text>
                  <Text className="text-sm text-gray-500">₹0.0</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 items-center"
                  onPress={() => router.push("/orders")}
                >
                  <View
                    className="w-full aspect-square rounded-xl justify-center items-center mb-2"
                    style={{ backgroundColor: "#F59E0B" }}
                  >
                    <Text className="text-4xl">📋</Text>
                  </View>
                  <Text className="text-base font-bold text-gray-900">Orders</Text>
                  <Text className="text-sm text-gray-500">Track orders</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 items-center"
                  onPress={() => router.push("/categories")}
                >
                  <View
                    className="w-full aspect-square rounded-xl justify-center items-center mb-2"
                    style={{ backgroundColor: "#EF4444" }}
                  >
                    <Text className="text-4xl">❤️</Text>
                  </View>
                  <Text className="text-base font-bold text-gray-900">My list</Text>
                  <Text className="text-sm text-gray-500">Shop</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* LOCATION PROMPT MODAL - Show only when needed */}
      <Modal 
        visible={showLocationPrompt} 
        animationType="slide" 
        transparent
        onRequestClose={() => {
          // Prevent closing modal by back button - user must choose location
          return true;
        }}
      >
        <View className="flex-1 bg-black/45 justify-end">
          <View className="bg-white p-6 rounded-t-2xl pb-7">
            <Text className="text-xl font-bold mb-2 text-center">Welcome Back! 👋</Text>
            <Text className="text-sm text-gray-600 mb-6 text-center leading-5">
              Please choose your location to see available products from nearest retailer.
            </Text>

            <TouchableOpacity
              className="bg-red-500 py-4 rounded-xl items-center mb-3 flex-row justify-center"
              onPress={handleUseCurrentAddress}
            >
              <Ionicons name="location" size={18} color="#fff" className="mr-2" />
              <Text className="text-white font-bold text-base">Use Current Location</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="border border-[#E8E8E8] py-4 rounded-xl items-center mb-4 flex-row justify-center"
              onPress={handleSkip}
            >
              <Ionicons name="home" size={18} color="#333" className="mr-2" />
              <Text className="text-gray-900 font-bold text-base">Use Saved Address</Text>
            </TouchableOpacity>

            <TextInput
              placeholder="Or enter address manually (optional)"
              value={manualAddress}
              onChangeText={setManualAddress}
              className="mt-2 border border-[#EEE] rounded-xl p-3.5 text-base mb-3"
              placeholderTextColor="#666"
            />

            <Text className="text-xs text-gray-600 text-center italic">
              🔄 Your location choice will be remembered until you close the app
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}