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
  StyleSheet,
  Image
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";
import Colors from "@/constants/colors";
import ProductCard from "@/components/ProductCard";
import CategoryTile from "@/components/CategoryTile";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location"; // recommended

const API_BASE = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") || "";

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { authToken } = useAuth();
  const token = authToken;
  const { assignedRetailer, currentRetailer: profileCurrentRetailer /* may be null */ } = useProfile();

  const [categories, setCategories] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // local temporary override (so UI updates immediately)
  const [currentRetailerLocal, setCurrentRetailerLocal] = useState(profileCurrentRetailer || null);

  // show popup when there is no currentRetailerLocal
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [manualAddress, setManualAddress] = useState("");

  // ------------- attachInventoryToProducts (robust) -------------
  const normalize = (s) => {
    if (!s && s !== 0) return null;
    return String(s).trim().toLowerCase();
  };

  const attachInventoryToProducts = (products, inventoryArr) => {
    if (!Array.isArray(products)) return [];
    if (!Array.isArray(inventoryArr)) return products;

    const invMap = new Map();
    inventoryArr.forEach((inv) => {
      const prod = inv?.product || {};
      const ids = [prod?.productId, prod?.id, prod?._id, prod?.sku, inv?.inventoryId].filter(Boolean);
      const nameKey = normalize(prod?.name || inv?.productName);
      ids.forEach(id => invMap.set(String(id), { ...inv }));
      if (nameKey && !invMap.has(`name:${nameKey}`)) invMap.set(`name:${nameKey}`, { ...inv });
    });

    const findInv = (prod) => {
      if (!prod) return null;
      const candidates = [prod._id, prod.id, prod.productId, prod.sku, prod.barcodeId].filter(Boolean);
      for (const c of candidates) if (invMap.has(String(c))) return invMap.get(String(c));
      const nameKey = normalize(prod?.name);
      if (nameKey && invMap.has(`name:${nameKey}`)) return invMap.get(`name:${nameKey}`);
      return null;
    };

    return products.map(prod => {
      const inv = findInv(prod);
      const currentStock = inv?.currentStock ?? null;
      const soldByRetailer = Boolean(inv);
      const outOfStock = soldByRetailer && currentStock !== null ? Number(currentStock) <= 0 : false;
      const price = inv?.sellingPrice ?? prod?.discountedPrice ?? prod?.price ?? 0;
      return {
        ...prod,
        _inventory: inv || null,
        soldByRetailer,
        currentStock,
        outOfStock,
        price,
        retailerPrice: inv?.sellingPrice ?? null,
      };
    });
  };

  // ------------- fetch helper functions -------------
  const fetchCategories = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/catalog/categories`);
      const j = await res.json();
      return res.ok ? (j.categories ?? j ?? []) : [];
    } catch (e) { return []; }
  };

  const fetchFeaturedProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/catalog/products/featured`);
      const j = await res.json();
      return res.ok ? (j.products ?? j ?? []) : [];
    } catch (e) { return []; }
  };

  const fetchInventoryForAssignedRetailer = async () => {
    if (!token) return [];
    try {
      const res = await fetch(`${API_BASE}/api/customer/inventory`, {
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      });
      const j = await res.json();
      if (!res.ok) return [];
      return j?.data?.inventory ?? [];
    } catch (e) { return []; }
  };

  // ------------- assign current retailer endpoint -------------
  const postAssignRetailer = async ({ lat, lng, address, temporary = true }) => {
    if (!token) return null;
    try {
      const res = await fetch(`${API_BASE}/api/customer/assign-retailer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lat, lng, address, temporary })
      });
      const j = await res.json();
      if (!res.ok) {
        console.warn("assign-retailer failed", j);
        return null;
      }
      return j;
    } catch (err) {
      console.error("assignRetailer error:", err);
      return null;
    }
  };

  // ------------- get device location (expo-location recommended) -------------
  const getDeviceLocation = async () => {
    // Try expo-location first
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        throw new Error("Location permission denied");
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const { latitude, longitude } = pos.coords;
      // optionally reverse geocode:
      let formattedAddress = "";
      try {
        const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (Array.isArray(rev) && rev.length > 0) {
          const r = rev[0];
          formattedAddress = [r.name, r.street, r.city, r.region, r.postalCode].filter(Boolean).join(", ");
        }
      } catch (e) { /* ignore */ }
      return { latitude, longitude, formattedAddress };
    } catch (expoErr) {
      // fallback to navigator.geolocation (older)
      return new Promise((resolve, reject) => {
        try {
          navigator.geolocation.getCurrentPosition((pos) => {
            resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, formattedAddress: "" });
          }, (err) => {
            reject(err);
          }, { enableHighAccuracy: true, timeout: 10000 });
        } catch (err) {
          return reject(err);
        }
      });
    }
  };

  // ------------- UI actions -------------
  const handleUseCurrentAddress = async () => {
    setShowLocationPrompt(false);
    setLoading(true);
    try {
      const loc = await getDeviceLocation();
      const lat = loc.latitude;
      const lng = loc.longitude;
      const address = loc.formattedAddress || manualAddress || "";

      const resp = await postAssignRetailer({ lat, lng, address, temporary: true });
      if (!resp) {
        Alert.alert("Error", "Could not assign retailer for current location.");
        return;
      }

      // Update local override
      setCurrentRetailerLocal(resp.retailer || null);

      // Update inventory + products
      const inv = resp.inventory ?? [];
      setInventory(inv);

      const prods = await fetchFeaturedProducts();
      const prodsWithInv = attachInventoryToProducts(prods, inv);
      setFeaturedProducts(prodsWithInv);
      setPopularProducts(prodsWithInv.slice(0, 8));

      // TODO: optionally call ProfileContext.refreshProfile() to persist server-side state
    } catch (err) {
      console.error("Use current address failed:", err);
      Alert.alert("Location error", "Couldn't get location. Please try again or enter address manually.");
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setShowLocationPrompt(false);
    setLoading(true);
    try {
      // clear any temporary currentRetailer on server by calling assign-retailer with no coords
      // server will return assignedRetailer inventory (home) as fallback
      const resp = await postAssignRetailer({ temporary: true });
      if (!resp) {
        // fallback: still try to fetch inventory normally
        const inv = await fetchInventoryForAssignedRetailer();
        setInventory(inv);
        const prods = await fetchFeaturedProducts();
        const prodsWithInv = attachInventoryToProducts(prods, inv);
        setFeaturedProducts(prodsWithInv);
        setPopularProducts(prodsWithInv.slice(0, 8));
        return;
      }

      setCurrentRetailerLocal(resp.retailer || null);
      const inv = resp.inventory ?? [];
      setInventory(inv);
      const prods = await fetchFeaturedProducts();
      const prodsWithInv = attachInventoryToProducts(prods, inv);
      setFeaturedProducts(prodsWithInv);
      setPopularProducts(prodsWithInv.slice(0, 8));
    } catch (err) {
      console.error("Skip flow failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // ------------- initial load -------------
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // If profile has currentRetailer, use it. Else we will ask user.
        if (profileCurrentRetailer) {
          setCurrentRetailerLocal(profileCurrentRetailer);
        } else {
          // show popup asking for location unless you want to silence it
          setShowLocationPrompt(true);
        }

        // fetch categories and featured products
        const [cats, prods] = await Promise.all([fetchCategories(), fetchFeaturedProducts()]);
        setCategories(cats);

        // fetch inventory (either currentRetailerLocal or assignedRetailer)
        // call customer inventory endpoint - it uses profile assignment server-side
        const inv = await fetchInventoryForAssignedRetailer();
        console.log("Fetchinv=",inv)
        setInventory(inv);

        // attach inventory
        const mapped = attachInventoryToProducts(prods, inv);
        setFeaturedProducts(mapped);
        setPopularProducts(mapped.slice(0, 8));
      } catch (err) {
        console.error("Initial load error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (token) load();
  }, [token, profileCurrentRetailer]);

  // ------------- refresh -------------
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const [cats, prods] = await Promise.all([fetchCategories(), fetchFeaturedProducts()]);
      const inv = await fetchInventoryForAssignedRetailer();
      setCategories(cats);
      const mapped = attachInventoryToProducts(prods, inv);
      setFeaturedProducts(mapped);
      setPopularProducts(mapped.slice(0, 8));
    } catch (err) {
      console.error("Refresh failed", err);
    } finally {
      setRefreshing(false);
    }
  };

  // ------------- rendering -------------
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.light.tint]} />}
      >
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#EF4444" />
            <TextInput style={styles.searchInput} placeholder="Search products" placeholderTextColor="#BDBDBD" />
          </View>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="cart-outline" size={22} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        {/* Featured stores / categories omitted for brevity - reuse your existing UI */}
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: "700" }}>Featured</Text>
          {loading ? (
            <ActivityIndicator />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 12 }}>
              {featuredProducts.map(prod => (
                <ProductCard key={prod._id || prod.id || prod.productId} product={prod} />
              ))}
            </ScrollView>
          )}
        </View>
      </ScrollView>

      {/* LOCATION PROMPT MODAL */}
      <Modal visible={showLocationPrompt} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Hey — Do you want to order here?</Text>
            <Text style={styles.modalSubtitle}>We can show products available near your current location.</Text>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleUseCurrentAddress}>
              <Text style={styles.primaryBtnText}>Use current address</Text>
            </TouchableOpacity>

            <Text style={{ textAlign: "center", marginVertical: 8 }}>or</Text>

            <TouchableOpacity style={styles.ghostBtn} onPress={handleSkip}>
              <Text style={styles.ghostBtnText}>Skip — shop from home retailer</Text>
            </TouchableOpacity>

            <View style={{ marginTop: 12 }}>
              <TextInput
                placeholder="Or type an address (optional)"
                value={manualAddress}
                onChangeText={setManualAddress}
                style={styles.addressInput}
                placeholderTextColor="#666"
              />
            </View>

            <TouchableOpacity onPress={() => setShowLocationPrompt(false)} style={{ marginTop: 10, alignSelf: "center" }}>
              <Text style={{ color: "#666" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// styles (trimmed for brevity)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  searchSection: { flexDirection: "row", padding: 16, gap: 8, alignItems: "center", backgroundColor: Colors.light.white },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", borderRadius: 28, borderWidth: 1, borderColor: "#E8E8E8", padding: 12, gap: 8 },
  searchInput: { flex: 1 },
  iconButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.light.white, alignItems: "center", justifyContent: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: "#fff", padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  modalSubtitle: { fontSize: 13, color: "#666", marginBottom: 16 },
  primaryBtn: { backgroundColor: Colors.light.tint, paddingVertical: 12, borderRadius: 10, alignItems: "center", marginBottom: 8 },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  ghostBtn: { borderWidth: 1, borderColor: "#E8E8E8", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  ghostBtnText: { color: "#333", fontWeight: "700" },
  addressInput: { marginTop: 8, borderWidth: 1, borderColor: "#EEE", borderRadius: 8, padding: 10 }
});
