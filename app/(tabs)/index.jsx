// app/(tabs)/index.jsx

// /home/shubh/Ak/9dairy-UI/app/(tabs)/index.jsx
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
  StyleSheet,
  Image,
  Dimensions
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

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 64;
const CARD_SPACING = 16;
const POPULAR_CARD_WIDTH = 165;
const POPULAR_CARD_SPACING = 12;

const API_BASE = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") || "";

// Store banners (unchanged)
const storeCards = [
  { id: 1, image: require('../../assets/images/banner1.jpg') },
  { id: 2, image: require('../../assets/images/banner2.jpg') },
  { id: 3, image: require('../../assets/images/banner3.jpg') },
  { id: 4, image: require('../../assets/images/banner4.jpg') },
  { id: 5, image: require('../../assets/images/banner5.jpg') },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { authToken } = useAuth();
  const token = authToken;
  const { assignedRetailer, updateLocationAndRetailer, usedLocationType } = useProfile();
  const { getTotalItems, items } = useCart(); // ⭐ ADDED items to check cart count
  const cartCount = getTotalItems();

  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [manualAddress, setManualAddress] = useState("");

  const popularScrollRef = useRef(null);

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

  const postAssignRetailer = async (lat, lng, address = "") => {
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE}/api/customer/assign-retailer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ lat, lng, address })
      });
      return await res.json();
    } catch {
      return null;
    }
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

  // ------------- Location Handlers -------------
  const handleUseCurrentAddress = async () => {
    try {
      setShowLocationPrompt(false);
      setLoading(true);

      const loc = await getDeviceLocation();
      const resp = await postAssignRetailer(loc.lat, loc.lng, "Current Location");

      if (!resp) {
        Alert.alert("Error", "Could not assign nearest retailer.");
        return;
      }

      // ⭐ UPDATE PROFILE CONTEXT WITH NEW LOCATION
      if (updateLocationAndRetailer) {
        updateLocationAndRetailer(
          { 
            coordinates: { latitude: loc.lat, longitude: loc.lng },
            formattedAddress: "Current Location" 
          },
          resp.retailer,
          "current"
        );
      }

      const inv = resp.inventory ?? [];
      setInventory(inv);

      const products = await fetchFeaturedProducts();
      const mapped = attachInventoryToProducts(products, inv);

      setFeaturedProducts(mapped);
      
      // Popular products - ONLY in-stock items
      setPopularProducts(
        mapped.filter(p => p.soldByRetailer && !p.outOfStock).slice(0, 8)
      );

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
      setLoading(true);

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

      // 2. Assign retailer using saved address coordinates
      console.log("📍 Assigning retailer using saved address...");
      const assignResp = await postAssignRetailer(lat, lng, "Saved Address");

      if (!assignResp) {
        Alert.alert("Error", "Failed to assign retailer for your saved address.");
        return;
      }

      // ⭐ UPDATE PROFILE CONTEXT WITH SAVED ADDRESS
      if (updateLocationAndRetailer) {
        updateLocationAndRetailer(
          { 
            coordinates: { latitude: lat, longitude: lng },
            formattedAddress: formatAddress(savedAddress) 
          },
          assignResp.retailer,
          "signup"
        );
      }

      const assignedInventory = assignResp?.inventory ?? [];

      // 3. Fetch categories and products
      const [cats, prods] = await Promise.all([
        fetchCategories(),
        fetchFeaturedProducts()
      ]);

      setCategories(cats);

      // 4. Attach inventory to products
      const mapped = attachInventoryToProducts(prods, assignedInventory);

      setFeaturedProducts(mapped);
      
      // 5. Popular products - ONLY in-stock items
      setPopularProducts(
        mapped.filter(p => p.soldByRetailer && !p.outOfStock).slice(0, 8)
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

  // ------------- Initial Load -------------
  useEffect(() => {
    const initialLoad = async () => {
      if (!token) return;
      
      setLoading(true);
      
      try {
        // Check if we already have a retailer assigned
        const hasExistingRetailer = assignedRetailer && assignedRetailer._id;
        
        if (!hasExistingRetailer) {
          // Show location prompt if no retailer assigned
          setShowLocationPrompt(true);
        }

        // Always load categories and featured products
        const [cats, prods] = await Promise.all([
          fetchCategories(),
          fetchFeaturedProducts()
        ]);

        setCategories(cats);

        // Load inventory based on current retailer assignment
        const inv = await fetchInventory();
        setInventory(inv);

        const mapped = attachInventoryToProducts(prods, inv);
        setFeaturedProducts(mapped);
        
        // Popular products - ONLY in-stock items
        setPopularProducts(
          mapped.filter(p => p.soldByRetailer && !p.outOfStock).slice(0, 8)
        );

      } catch (error) {
        console.error("Initial load error:", error);
      } finally {
        setLoading(false);
      }
    };

    initialLoad();
  }, [token, assignedRetailer]);

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
    <View style={[styles.container, { paddingTop: insets.top }]}>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.light.tint]}
          />
        }
      >

        {/* SEARCH BAR */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#EF4444" />
            <TextInput
              placeholder="Search 'Salted Butter'"
              style={styles.searchInput}
              placeholderTextColor="#BDBDBD"
            />
          </View>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push("/cart")}
          >
            <Ionicons name="cart-outline" size={22} color="#1A1A1A" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {cartCount > 99 ? "99+" : cartCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* FEATURED STORES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Stores</Text>
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          </View>

          <View style={styles.storesContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + CARD_SPACING}
              decelerationRate="fast"
              contentContainerStyle={styles.storesScroll}
            >
              {infiniteStoreCards.map((store, index) => (
                <TouchableOpacity
                  key={`${store.id}-${index}`}
                  style={styles.storeCard}
                  onPress={() => router.push("/categories")}
                  activeOpacity={0.9}
                >
                  <Image source={store.image} style={styles.storeImageFull} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        {/* CATEGORIES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shop by category</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.tint} />
              <Text style={styles.loadingText}>Loading categories...</Text>
            </View>
          ) : categories.length > 0 ? (
            <View style={styles.categoriesGrid}>
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
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No categories found</Text>
            </View>
          )}
        </View>

        {/* POPULAR PRODUCTS - ONLY AVAILABLE */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular</Text>
            <View style={styles.fireIcon}>
              <Text style={styles.fireEmoji}>🔥</Text>
            </View>
          </View>

          <Text style={styles.popularSubtext}>Most frequently bought</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.tint} />
              <Text style={styles.loadingText}>Loading popular products...</Text>
            </View>
          ) : popularProducts.length > 0 ? (
            <View style={styles.popularContainer}>
              <ScrollView
                ref={popularScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.popularScroll}
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
                      style={styles.productCardWrapper}
                    >
                      <ProductCard product={product} />
                    </View>
                  ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No popular products available</Text>
            </View>
          )}
        </View>

        {/* QUICK LINKS */}
        <View style={[styles.section, { marginBottom: 120 }]}>
          <Text style={styles.sectionTitle}>Quick links</Text>

          <View style={styles.quickLinksRow}>
            <TouchableOpacity
              style={styles.quickLinkCard}
              onPress={() => router.push("/wallet")}
            >
              <View
                style={[
                  styles.quickLinkIconContainer,
                  { backgroundColor: "#06B6D4" },
                ]}
              >
                <Text style={styles.quickLinkEmoji}>💳</Text>
              </View>
              <Text style={styles.quickLinkTitle}>Wallet</Text>
              <Text style={styles.quickLinkSubtext}>₹0.0</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickLinkCard}
              onPress={() => router.push("/orders")}
            >
              <View
                style={[
                  styles.quickLinkIconContainer,
                  { backgroundColor: "#F59E0B" },
                ]}
              >
                <Text style={styles.quickLinkEmoji}>📋</Text>
              </View>
              <Text style={styles.quickLinkTitle}>Orders</Text>
              <Text style={styles.quickLinkSubtext}>Track orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickLinkCard}
              onPress={() => router.push("/categories")}
            >
              <View
                style={[
                  styles.quickLinkIconContainer,
                  { backgroundColor: "#EF4444" },
                ]}
              >
                <Text style={styles.quickLinkEmoji}>❤️</Text>
              </View>
              <Text style={styles.quickLinkTitle}>My list</Text>
              <Text style={styles.quickLinkSubtext}>Shop</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* LOCATION PROMPT MODAL */}
      <Modal visible={showLocationPrompt} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Use your location?</Text>
            <Text style={styles.modalSubtitle}>
              We will assign your nearest retailer for better product availability.
            </Text>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={handleUseCurrentAddress}
            >
              <Text style={styles.primaryBtnText}>Use Current Location</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ghostBtn}
              onPress={handleSkip}
            >
              <Text style={styles.ghostBtnText}>Skip - Use Saved Address</Text>
            </TouchableOpacity>

            <TextInput
              placeholder="Or enter address manually (optional)"
              value={manualAddress}
              onChangeText={setManualAddress}
              style={styles.addressInput}
              placeholderTextColor="#666"
            />

            <TouchableOpacity 
              onPress={() => setShowLocationPrompt(false)} 
              style={{ marginTop: 10, alignSelf: "center" }}
            >
              <Text style={{ color: "#666", fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  searchSection: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 8,
    alignItems: "center",
    backgroundColor: Colors.light.white,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.white,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
    paddingHorizontal: 16,
    height: 52,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: "400",
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.light.white,
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
    justifyContent: "center",
    alignItems: "center",
    position: 'relative',
  },
  cartBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    minWidth: 45,
    height: 22,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },

  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 8 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: Colors.light.text },

  newBadge: { backgroundColor: "#EF4444", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  newBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },

  storesContainer: { marginHorizontal: -16 },
  storesScroll: { paddingHorizontal: 32, paddingVertical: 12 },
  storeCard: {
    width: CARD_WIDTH,
    aspectRatio: 16 / 9,
    marginRight: CARD_SPACING,
    borderRadius: 16,
    overflow: "hidden",
    elevation: 8,
  },
  storeImageFull: { width: "100%", height: "100%", borderRadius: 16 },

  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 12,
  },

  popularSubtext: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: 12 },
  popularContainer: { marginHorizontal: -16 },
  popularScroll: { paddingHorizontal: 16, paddingVertical: 12 },
  productCardWrapper: { width: POPULAR_CARD_WIDTH, marginRight: POPULAR_CARD_SPACING },

  fireIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#FFF4E6",
    justifyContent: "center",
    alignItems: "center",
  },
  fireEmoji: { fontSize: 18 },

  loadingContainer: { justifyContent: "center", alignItems: "center", paddingVertical: 40 },
  loadingText: { marginTop: 10, fontSize: 16, color: Colors.light.textSecondary },
  emptyState: { justifyContent: "center", alignItems: "center", paddingVertical: 40 },
  emptyStateText: { fontSize: 16, color: Colors.light.textSecondary },

  quickLinksRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  quickLinkCard: { flex: 1, alignItems: "center" },
  quickLinkIconContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  quickLinkEmoji: { fontSize: 36 },
  quickLinkTitle: { fontSize: 15, fontWeight: "700", color: Colors.light.text },
  quickLinkSubtext: { fontSize: 13, color: "#9E9E9E" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: "#666", marginBottom: 16 },
  primaryBtn: { backgroundColor: Colors.light.tint, paddingVertical: 12, borderRadius: 10, alignItems: "center", marginBottom: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  ghostBtn: { borderWidth: 1, borderColor: "#E8E8E8", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  ghostBtnText: { color: "#333", fontWeight: "700" },
  addressInput: { 
    marginTop: 12, 
    borderWidth: 1, 
    borderColor: "#EEE", 
    borderRadius: 8, 
    padding: 12,
    fontSize: 14
  },
});