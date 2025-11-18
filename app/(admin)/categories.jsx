import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';

// Retailer view: Order stock from SuperAdmin
// - Tries retailer endpoint first, then top-level, then admin-mounted endpoint (/api/admin/stock-orders)
// - Inline qty, cart modal with keyboard-friendly qty, stock clamping, idempotency

const API_ROOT = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '');

const CANDIDATE_PRODUCT_PATHS = [
  '/api/catalog/products',
  '/api/catalog/search',
  '/api/products/search',
  '/api/products',
];

export default function RetailerStockOrderScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { authToken, validateToken, logout, user } = useAuth();

  const [fastAddMode, setFastAddMode] = useState(false);
  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [cart, setCart] = useState([]);
  const [itemModal, setItemModal] = useState({ visible: false, product: null, qty: 1, note: '' });
  const [cartModalVisible, setCartModalVisible] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const searchTimer = useRef(null);

  useEffect(() => {
    navigation?.setOptions({ title: 'Order Stock' });
  }, [navigation]);

  // warn if not retailer — but allow admins (no warning for admin role)
  useEffect(() => {
    if (!user || !user.role) return;

    // If admin, do not warn (admins can access retailer flows in the app)
    if (user.role === 'admin') return;

    // Only warn when the signed-in user is neither 'retailer' nor 'admin'
    if (user.role !== 'retailer') {
      setTimeout(() => {
        Alert.alert('Note', 'You are not signed in as a retailer. Some features may be limited.');
      }, 600);
    }
  }, [user]);


  const ensureAuth = useCallback(async () => {
    if (!authToken) {
      Alert.alert('Session', 'Please sign in again');
      logout?.();
      return false;
    }
    try {
      const ok = await validateToken();
      if (!ok) {
        Alert.alert('Session', 'Session expired');
        logout?.();
        return false;
      }
      return true;
    } catch (e) {
      console.warn('validateToken error', e);
      Alert.alert('Session', 'Authentication check failed');
      logout?.();
      return false;
    }
  }, [authToken, validateToken, logout]);

  const tryFetchUrl = useCallback(async (url, headers = {}) => {
    try {
      const res = await fetch(url, { headers });
      const text = await res.text();
      let body;
      try {
        body = text ? JSON.parse(text) : {};
      } catch (e) {
        body = { raw: text };
      }
      return { res, body, status: res.status };
    } catch (err) {
      return { err };
    }
  }, []);

  const normalizeProduct = useCallback((p) => {
    if (!p || typeof p !== 'object') return p;
    return {
      ...p,
      _id: p._id ?? p.id,
      unitPrice: p.unitPrice ?? p.price ?? p.storedPrice ?? 0,
      image: p.image ?? (Array.isArray(p.images) ? p.images[0] : p.thumbnail) ?? '',
      availableQty: p.availableQty ?? p.qty ?? p.stock ?? null,
    };
  }, []);

  const fetchProducts = useCallback(
    async (opts = {}) => {
      const { pg = 1, q = search, refresh = false } = opts;
      if (!(await ensureAuth())) return;

      try {
        setError(null);
        if (refresh) setRefreshing(true);
        else setLoadingProducts(true);

        const qs = new URLSearchParams();
        qs.append('page', String(pg));
        qs.append('limit', String(limit));
        if (q) qs.append('q', q);

        const headers = {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        };

        let success = null;
        for (const path of CANDIDATE_PRODUCT_PATHS) {
          const url = `${API_ROOT}${path}?${qs.toString()}`;
          // eslint-disable-next-line no-await-in-loop
          const result = await tryFetchUrl(url, headers);
          if (result.err) continue;

          if (result.res.status === 401) {
            Alert.alert('Auth', 'Session expired');
            logout?.();
            return;
          }

          if (result.res.ok) {
            success = { url, body: result.body };
            break;
          }

          if (result.res.status === 404) {
            continue;
          }

          throw new Error(result.body?.message || `Server returned ${result.status} for ${url}`);
        }

        if (!success) throw new Error('No product endpoint responded successfully. Check API base & routes.');

        const body = success.body || {};
        let returnedProducts = [];
        let total = 0;

        if (Array.isArray(body)) {
          returnedProducts = body;
          total = body.length;
        } else if (Array.isArray(body.products)) {
          returnedProducts = body.products;
          total = body.total ?? returnedProducts.length;
        } else {
          const arr = Object.values(body).find((v) => Array.isArray(v));
          if (arr) {
            returnedProducts = arr;
            total = body.total ?? arr.length;
          } else {
            returnedProducts = [];
            total = 0;
          }
        }

        const normalized = (returnedProducts || []).map(normalizeProduct);

        if (pg === 1) setProducts(normalized);
        else setProducts((prev) => [...prev, ...normalized]);

        setTotalProducts(total);
        setPage(pg);
      } catch (err) {
        console.error('fetchProducts err', err);
        setError(err.message || 'Failed to load products');
        Alert.alert('Load error', err.message || 'Could not load products. Check logs.');
      } finally {
        setLoadingProducts(false);
        setRefreshing(false);
      }
    },
    [ensureAuth, limit, normalizeProduct, search, tryFetchUrl, authToken, logout]
  );

  useEffect(() => {
    fetchProducts({ pg: 1, q: '', refresh: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchProducts({ pg: 1, q: search, refresh: true });
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search, fetchProducts]);

  // CART HELPERS
  const getCartItem = useCallback((productId) => cart.find((c) => String(c.productId) === String(productId)), [cart]);

  const setCartQty = useCallback((product, qty, note = undefined) => {
    const id = String(product._id);
    let parsed = Number(qty);
    if (!Number.isFinite(parsed) || Number.isNaN(parsed)) parsed = parseInt(qty, 10) || 0;
    parsed = Math.max(0, Math.floor(parsed));

    let clamped = false;
    const max = product?.availableQty;
    if (typeof max === 'number' && max >= 0 && parsed > max) {
      parsed = max;
      clamped = true;
    }

    setCart((prev) => {
      const exists = prev.find((i) => String(i.productId) === id);
      if (parsed <= 0) {
        return prev.filter((i) => String(i.productId) !== id);
      }
      if (exists) {
        return prev.map((i) =>
          String(i.productId) === id
            ? { ...i, qty: parsed, note: note ?? i.note, clampedToStock: clamped }
            : i
        );
      }
      return [{ productId: id, product, qty: parsed, unitPrice: product.unitPrice ?? 0, note: note ?? '', clampedToStock: clamped }, ...prev];
    });

    if (clamped) {
      Alert.alert('Limited Stock', `${product.name} limited to ${product.availableQty} in stock — quantity adjusted.`);
    }
  }, []);

  const incrementInline = useCallback((product) => {
    const current = getCartItem(product._id);
    const nextQty = (current?.qty || 0) + 1;
    setCartQty(product, nextQty);
  }, [getCartItem, setCartQty]);

  const decrementInline = useCallback((product) => {
    const current = getCartItem(product._id);
    const nextQty = Math.max(0, (current?.qty || 0) - 1);
    setCartQty(product, nextQty);
  }, [getCartItem, setCartQty]);

  const onChangeInlineQty = useCallback((product, value) => {
    const raw = value === '' ? 0 : parseInt(value.replace(/\D/g, ''), 10) || 0;
    setCartQty(product, raw);
  }, [setCartQty]);

  const addToCartQuick = useCallback((product) => {
    const current = getCartItem(product._id);
    const qty = current?.qty || 1;
    setCartQty(product, qty);
    Alert.alert('Added', `${product.name} x${qty} added to cart`);
  }, [getCartItem, setCartQty]);

  const updateCartItem = (productId, patch) => {
    setCart((prev) => prev.map((i) => (String(i.productId) === String(productId) ? { ...i, ...patch } : i)));
  };

  const removeCartItem = (productId) => {
    setCart((prev) => prev.filter((i) => String(i.productId) !== String(productId)));
  };

  const cartTotalQty = useMemo(() => cart.reduce((s, i) => s + (i.qty || 0), 0), [cart]);

  const buildOrderPayload = () => ({
    items: cart.map((i) => ({ product: i.productId, requestedQty: i.qty, unitPrice: i.unitPrice, note: i.note })),
    priority: 'normal',
    metadata: { requestedBy: user?._id },
  });

  // SUBMIT ORDER: tries retailer -> top-level -> admin-mounted endpoints
  const submitOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Cart empty', 'Add products to cart before submitting');
      return;
    }
    if (!(await ensureAuth())) return;

    setSubmitting(true);
    const idempotencyKey = `order-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // note: include the admin-mounted endpoint that matches routes/admin.routes.js
    const candidateOrderUrls = [
      `${API_ROOT}/api/retailer/stock-orders`, // preferred retailer-scoped
      `${API_ROOT}/api/stock-orders`,          // fallback
      `${API_ROOT}/api/admin/stock-orders`,    // admin router when mounted at /api/admin (matches your admin.routes.js)
    ];

    try {
      const payload = buildOrderPayload();

      let success = null;
      for (const url of candidateOrderUrls) {
        try {
          console.log('Attempting to create stock order at:', url);
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
              'Idempotency-Key': idempotencyKey,
            },
            body: JSON.stringify({ ...payload, idempotencyKey }),
          });

          const text = await res.text();
          let body;
          try { body = text ? JSON.parse(text) : {}; } catch (e) { body = { raw: text }; }

          if (res.status === 401) {
            Alert.alert('Auth', 'Session expired');
            logout?.();
            return;
          }

          if (res.status === 403) {
            // permission denied for this endpoint — try next endpoint but let user know
            console.warn('Permission denied (403) at', url);
            // non-blocking: inform user once
            Alert.alert('Permission', `Insufficient permissions for ${url}. Trying next route.`);
            continue;
          }

          if (res.status === 404) {
            console.warn('Not found (404) at', url);
            continue;
          }

          if (!res.ok) {
            throw new Error(body?.message || `Server returned ${res.status} for ${url}`);
          }

          // success
          success = { url, body };
          break;
        } catch (innerErr) {
          console.warn('create order attempt failed for', url, innerErr);
          // try next
          continue;
        }
      }

      if (!success) throw new Error('Failed to create order on all candidate endpoints. Check API routes & permissions.');

      Alert.alert('Success', `Order created: ${success.body.orderNumber || success.body._id || 'OK'}`);
      setCart([]);
      navigation?.navigate('Orders');
    } catch (err) {
      console.error('submitOrder err', err);
      Alert.alert('Error', err.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  // RENDER PRODUCT (classic / fast add unchanged)
  const renderProductClassic = (item) => (
    <Pressable onPress={() => setItemModal({ visible: true, product: item, qty: 1, note: '' })} style={styles.productCard} android_ripple={{ color: '#00000010' }}>
      <View style={styles.productLeft}>
        {item.image ? <Image source={{ uri: item.image }} style={styles.productImage} /> : <View style={styles.productPlaceholder}><MaterialIcons name="inventory" size={28} color={Colors.light.textSecondary} /></View>}
      </View>
      <View style={styles.productBody}>
        <Text numberOfLines={1} style={styles.productName}>{item.name}</Text>
        <Text numberOfLines={1} style={styles.productSku}>{item.sku || ''}</Text>
        <View style={styles.productMetaRow}>
          <Text style={styles.productPrice}>₹{(item.unitPrice ?? 0).toFixed(2)}</Text>
          <Text style={styles.productStock}>{item.availableQty != null ? `${item.availableQty} in stock` : '—'}</Text>
        </View>
      </View>
      <View style={styles.productRight}>
        <TouchableOpacity style={styles.addButton} onPress={() => setItemModal({ visible: true, product: item, qty: 1, note: '' })}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </Pressable>
  );

  const renderProductFast = (item) => {
    const cartItem = getCartItem(item._id) || null;
    const inlineQty = (cartItem && cartItem.qty) || 0;

    return (
      <Pressable onPress={() => setItemModal({ visible: true, product: item, qty: inlineQty || 1, note: cartItem?.note || '' })} style={styles.productCard} android_ripple={{ color: '#00000010' }}>
        <View style={styles.productLeft}>
          {item.image ? <Image source={{ uri: item.image }} style={styles.productImage} /> : <View style={styles.productPlaceholder}><MaterialIcons name="inventory" size={28} color={Colors.light.textSecondary} /></View>}
        </View>
        <View style={styles.productBody}>
          <Text numberOfLines={1} style={styles.productName}>{item.name}</Text>
          <Text numberOfLines={1} style={styles.productSku}>{item.sku || ''}</Text>
          <View style={styles.productMetaRow}>
            <Text style={styles.productPrice}>₹{(item.unitPrice ?? 0).toFixed(2)}</Text>
            <Text style={styles.productStock}>{item.availableQty != null ? `${item.availableQty} in stock` : '—'}</Text>
          </View>
          <View style={styles.inlineQtyRow}>
            <TouchableOpacity onPress={() => decrementInline(item)} style={styles.inlineQtyBtn}><Ionicons name="remove" size={18} /></TouchableOpacity>
            <TextInput style={styles.inlineQtyInput} keyboardType="numeric" value={String(inlineQty)} onChangeText={(v) => onChangeInlineQty(item, v)} placeholder="0" selectTextOnFocus accessibilityLabel={`Quantity for ${item.name}`} />
            <TouchableOpacity onPress={() => incrementInline(item)} style={styles.inlineQtyBtn}><Ionicons name="add" size={18} /></TouchableOpacity>
            <TouchableOpacity style={styles.addButtonSmall} onPress={() => addToCartQuick(item)} accessibilityLabel={`Add ${item.name} to cart`}>
              <Ionicons name="check" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.productRight}>
          <TouchableOpacity style={styles.addButton} onPress={() => addToCartQuick(item)}><Ionicons name="add" size={20} color="#fff" /></TouchableOpacity>
        </View>
      </Pressable>
    );
  };

  const renderProduct = ({ item }) => (fastAddMode ? renderProductFast(item) : renderProductClassic(item));

  const loadMore = () => {
    if (products.length >= totalProducts) return;
    fetchProducts({ pg: page + 1, q: search });
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Order Stock</Text>
          <Text style={styles.subtitle}>{cartTotalQty} items in cart</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
            <Text style={{ fontSize: 12, color: Colors.light.textSecondary }}>{fastAddMode ? 'Fast Add' : 'Classic'}</Text>
            <Text style={{ fontSize: 11, color: Colors.light.textSecondary }}>Tap to switch</Text>
          </View>

          <Switch value={fastAddMode} onValueChange={(v) => setFastAddMode(v)} trackColor={{ true: Colors.light.accent, false: '#dcdcdc' }} thumbColor={fastAddMode ? '#fff' : '#fff'} />

          <TouchableOpacity style={styles.cartButton} onPress={() => setCartModalVisible(true)}>
            <Feather name="shopping-cart" size={20} color="#fff" />
            {cart.length > 0 && <View style={styles.cartBadge}><Text style={styles.cartBadgeText}>{cart.length}</Text></View>}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Colors.light.textSecondary} />
        <TextInput placeholder="Search products..." placeholderTextColor={Colors.light.textSecondary} style={styles.searchInput} value={search} onChangeText={setSearch} />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close" size={18} color={Colors.light.textSecondary} /></TouchableOpacity> : null}
      </View>

      <View style={styles.listWrap}>
        {loadingProducts && products.length === 0 ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.light.accent} /></View>
        ) : (
          <FlatList
            data={products}
            keyExtractor={(i) => String(i._id)}
            renderItem={renderProduct}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            refreshing={refreshing}
            onRefresh={() => fetchProducts({ pg: 1, q: search, refresh: true })}
            ListEmptyComponent={() => <View style={styles.empty}><Text style={styles.emptyText}>No products found</Text></View>}
          />
        )}
      </View>

      <View style={styles.footerBar}>
        <View style={styles.footerLeft}>
          <Text style={styles.footerText}>{cartTotalQty} items</Text>
          <Text style={styles.footerSub}>{cart.length} products</Text>
        </View>

        <TouchableOpacity style={[styles.submitBtn, (submitting || cart.length === 0) && styles.disabledBtn]} onPress={submitOrder} disabled={submitting || cart.length === 0}>
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Place Order</Text>}
        </TouchableOpacity>
      </View>

      {/* Item modal */}
      <Modal visible={itemModal.visible} transparent animationType="slide" onRequestClose={() => setItemModal({ visible: false, product: null, qty: 1, note: '' })}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.itemModalContent}>
            <Text style={styles.modalTitle}>Add to cart</Text>
            {itemModal.product && (
              <View style={styles.modalProductRow}>
                <Image source={itemModal.product.image ? { uri: itemModal.product.image } : null} style={styles.modalProductImage} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.productName}>{itemModal.product.name}</Text>
                  <Text style={styles.productSku}>{itemModal.product.sku}</Text>
                </View>
              </View>
            )}

            <View style={styles.qtyRow}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setItemModal((v) => ({ ...v, qty: Math.max(1, v.qty - 1) }))}><Ionicons name="remove" size={18} /></TouchableOpacity>
              <Text style={styles.qtyText}>{itemModal.qty}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => setItemModal((v) => ({ ...v, qty: v.qty + 1 }))}><Ionicons name="add" size={18} /></TouchableOpacity>
            </View>

            <TextInput style={styles.noteInput} placeholder="Optional note" value={itemModal.note} onChangeText={(t) => setItemModal((v) => ({ ...v, note: t }))} />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setItemModal({ visible: false, product: null, qty: 1, note: '' })}><Text>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.modalAdd} onPress={() => { setCartQty(itemModal.product, itemModal.qty, itemModal.note); setItemModal({ visible: false, product: null, qty: 1, note: '' }); }}><Text style={{ color: '#fff' }}>Add</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Cart modal */}
      <Modal visible={cartModalVisible} animationType="slide" onRequestClose={() => setCartModalVisible(false)}>
        <SafeAreaView style={styles.cartModalContainer}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>Your Cart</Text>
            <TouchableOpacity onPress={() => setCartModalVisible(false)}><Ionicons name="close" size={22} /></TouchableOpacity>
          </View>

          <ScrollView style={styles.cartList}>
            {cart.map((i) => (
              <View key={String(i.productId)} style={styles.cartItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Image source={i.product.image ? { uri: i.product.image } : null} style={styles.cartItemImage} />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.cartItemName}>{i.product.name}</Text>
                    {i.note ? <Text style={styles.cartItemNote}>{i.note}</Text> : null}

                    <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity onPress={() => setCartQty(i.product, Math.max(1, i.qty - 1))} style={styles.qtyBtnSmall}><Ionicons name="remove" size={18} /></TouchableOpacity>

                      <TextInput style={styles.cartQtyInput} keyboardType="numeric" value={String(i.qty)} onChangeText={(v) => { const raw = v === '' ? 0 : parseInt(v.replace(/\D/g, ''), 10) || 0; setCartQty(i.product, raw); }} selectTextOnFocus accessibilityLabel={`Quantity for ${i.product.name}`} />

                      <TouchableOpacity onPress={() => setCartQty(i.product, i.qty + 1)} style={styles.qtyBtnSmall}><Ionicons name="add" size={18} /></TouchableOpacity>

                      <TouchableOpacity onPress={() => removeCartItem(i.productId)} style={styles.cartRemove}><Feather name="trash-2" size={16} color="#fff" /></TouchableOpacity>
                    </View>

                    {i.clampedToStock ? <Text style={{ color: '#F44336', marginTop: 6, fontSize: 12 }}>Limited to {i.product.availableQty} in stock — quantity adjusted.</Text> : null}
                  </View>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '700' }}>₹{((i.unitPrice || 0) * (i.qty || 0)).toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.cartFooter}>
            <Text style={styles.cartSummary}>Total items: {cartTotalQty}</Text>
            <TouchableOpacity style={[styles.checkoutBtn, (cart.length === 0 || submitting) && styles.disabledBtn]} onPress={() => { setCartModalVisible(false); submitOrder(); }} disabled={cart.length === 0 || submitting}>
              <Text style={{ color: '#fff' }}>{submitting ? 'Submitting...' : 'Submit Order'}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  header: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.light.white, borderBottomWidth: 1, borderColor: Colors.light.border },
  title: { fontSize: 20, fontWeight: '700', color: Colors.light.text },
  subtitle: { fontSize: 13, color: Colors.light.textSecondary },
  cartButton: { backgroundColor: Colors.light.accent, padding: 10, borderRadius: 8, position: 'relative' },
  cartBadge: { position: 'absolute', right: -6, top: -6, backgroundColor: '#F44336', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  cartBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', margin: 12, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border },
  searchInput: { marginLeft: 8, flex: 1, height: 36, color: Colors.light.text },
  listWrap: { flex: 1, paddingHorizontal: 12 },
  productCard: { flexDirection: 'row', padding: 12, backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.light.border },
  productLeft: { width: 64, height: 64, borderRadius: 8, overflow: 'hidden', backgroundColor: Colors.light.background, justifyContent: 'center', alignItems: 'center' },
  productImage: { width: 64, height: 64 },
  productPlaceholder: { width: 64, height: 64, justifyContent: 'center', alignItems: 'center' },
  productBody: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 16, fontWeight: '600', color: Colors.light.text },
  productSku: { fontSize: 12, color: Colors.light.textSecondary },
  productMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  productPrice: { fontWeight: '700', color: Colors.light.text },
  productStock: { color: Colors.light.textSecondary, fontSize: 12 },
  inlineQtyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  inlineQtyBtn: { padding: 8, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8 },
  inlineQtyInput: { width: 56, marginHorizontal: 8, textAlign: 'center', borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8, paddingVertical: 6, color: Colors.light.text },
  addButtonSmall: { marginLeft: 8, backgroundColor: Colors.light.accent, padding: 8, borderRadius: 8 },
  productRight: { marginLeft: 12 },
  addButton: { backgroundColor: Colors.light.accent, padding: 8, borderRadius: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { color: Colors.light.textSecondary },
  footerBar: { flexDirection: 'row', padding: 12, alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.white },
  footerLeft: {},
  footerText: { fontSize: 16, fontWeight: '700' },
  footerSub: { fontSize: 12, color: Colors.light.textSecondary },
  submitBtn: { backgroundColor: Colors.light.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8 },
  submitText: { color: '#fff', fontWeight: '700' },
  disabledBtn: { opacity: 0.6 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  itemModalContent: { width: '92%', backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontWeight: '700', fontSize: 18, marginBottom: 12 },
  modalProductRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  modalProductImage: { width: 64, height: 64, borderRadius: 8, backgroundColor: Colors.light.background },
  qtyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginVertical: 12 },
  qtyBtn: { padding: 8, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8, marginHorizontal: 12 },
  qtyText: { fontSize: 18, fontWeight: '700' },
  noteInput: { borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8, padding: 8, marginTop: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  modalCancel: { padding: 10 },
  modalAdd: { padding: 10, backgroundColor: Colors.light.accent, borderRadius: 8 },

  cartModalContainer: { flex: 1, backgroundColor: Colors.light.background },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.white },
  cartTitle: { fontSize: 18, fontWeight: '700' },
  cartList: { flex: 1, padding: 12 },
  cartItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.light.border },
  cartItemImage: { width: 48, height: 48, borderRadius: 8 },
  cartItemName: { fontWeight: '700' },
  cartItemNote: { color: Colors.light.textSecondary, fontSize: 12 },
  cartItemActions: { alignItems: 'center' },
  cartQtyRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  cartQtyText: { marginHorizontal: 8, fontWeight: '700' },
  cartQtyInput: { width: 72, marginHorizontal: 8, textAlign: 'center', borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8, paddingVertical: 6, color: Colors.light.text },
  qtyBtnSmall: { padding: 8, borderWidth: 1, borderColor: Colors.light.border, borderRadius: 8 },
  cartRemove: { backgroundColor: '#F44336', padding: 8, borderRadius: 8, marginLeft: 12 },
  cartFooter: { padding: 16, borderTopWidth: 1, borderColor: Colors.light.border, backgroundColor: Colors.light.white },
  cartSummary: { fontWeight: '700', marginBottom: 8 },
  checkoutBtn: { backgroundColor: Colors.light.accent, padding: 12, alignItems: 'center', borderRadius: 8 },
});