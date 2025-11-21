import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_ROOT = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/+$/, '') || 'http://localhost:5000';

const CANDIDATE_PRODUCT_PATHS = [
  '/api/catalog/products',
  '/api/catalog/search',
  '/api/products/search',
  '/api/products',
];

export default function RetailerStockOrderScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { authToken, validateToken, logout, user } = useAuth();

  const [products, setProducts] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [cart, setCart] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Order history & details
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderDetailModalVisible, setOrderDetailModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetail, setOrderDetail] = useState(null);

  // Screen states
  const [currentScreen, setCurrentScreen] = useState('products'); // 'products', 'cart'

  const searchTimer = useRef(null);

  // If navigation passes prefillCart (reorder), apply it
  useEffect(() => {
    if (route?.params?.prefillCart && Array.isArray(route.params.prefillCart)) {
      const pre = route.params.prefillCart.map((p) => ({
        productId: String(p.productId),
        product: p.product ?? { _id: p.productId, name: p.productName || 'Prefilled item', unitPrice: p.unitPrice ?? 0 },
        qty: Math.max(1, Number(p.qty) || 1),
        unitPrice: p.unitPrice ?? (p.product?.unitPrice ?? 0),
      }));
      setCart(pre);
    }
  }, [route?.params?.prefillCart]);

  useEffect(() => {
    navigation?.setOptions({ title: 'Order Stock' });
  }, [navigation]);

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
      unitPrice: Number(p.unitPrice ?? p.price ?? p.storedPrice ?? 0),
      image: p.image ?? (Array.isArray(p.images) ? p.images[0] : p.thumbnail) ?? '',
      availableQty: typeof p.availableQty === 'number' ? p.availableQty : (p.qty ?? p.stock ?? null),
      name: p.name ?? p.productName ?? p.title ?? 'Unnamed product',
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
          const result = await tryFetchUrl(url, headers);
          if (result?.err) continue;

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
      } finally {
        setLoadingProducts(false);
        setRefreshing(false);
      }
    },
    [ensureAuth, limit, normalizeProduct, search, tryFetchUrl, authToken, logout]
  );

  useEffect(() => {
    fetchProducts({ pg: 1, q: '', refresh: true });
  }, [fetchProducts]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      fetchProducts({ pg: 1, q: search, refresh: true });
    }, 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search, fetchProducts]);

  // SIMPLIFIED CART MANAGEMENT
  const addToCart = useCallback((product) => {
    if (!product) return;
    
    const id = String(product._id);
    
    setCart((prev) => {
      const existingItem = prev.find((item) => String(item.productId) === id);
      
      if (existingItem) {
        return prev.map((item) =>
          String(item.productId) === id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      
      return [
        ...prev,
        {
          productId: id,
          product: { ...product },
          qty: 1,
          unitPrice: Number(product.unitPrice ?? 0),
        }
      ];
    });
  }, []);

  const updateCartItemQty = useCallback((productId, newQty) => {
    const qty = Math.max(0, Number(newQty) || 0);
    
    setCart((prev) => {
      if (qty === 0) {
        return prev.filter((item) => String(item.productId) !== String(productId));
      }
      
      return prev.map((item) =>
        String(item.productId) === String(productId)
          ? { ...item, qty }
          : item
      );
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setCart((prev) => prev.filter((item) => String(item.productId) !== String(productId)));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  const cartTotalQty = useMemo(() => cart.reduce((sum, item) => sum + item.qty, 0), [cart]);
  const cartTotalValue = useMemo(() => 
    cart.reduce((sum, item) => sum + (item.unitPrice * item.qty), 0), [cart]
  );

  const buildOrderPayload = useCallback(() => ({
    items: cart.map((item) => ({ 
      product: item.productId, 
      requestedQty: item.qty, 
      unitPrice: item.unitPrice 
    })),
    priority: 'normal',
    retailer: user?._id,
    createdBy: user?._id,
  }), [cart, user]);

  // SUBMIT ORDER
  const submitOrder = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add products to your cart before submitting.');
      return;
    }
    if (!(await ensureAuth())) return;

    setSubmitting(true);

    const candidateOrderUrls = [
      `${API_ROOT}/api/admin/stock-orders`,
      `${API_ROOT}/api/stock-orders`,
      `${API_ROOT}/api/retailer/stock-orders`,
    ];

    try {
      const payload = buildOrderPayload();
      let success = null;

      for (const url of candidateOrderUrls) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });

          if (res.status === 401) {
            Alert.alert('Authentication', 'Your session has expired. Please sign in again.');
            logout?.();
            return;
          }

          if (res.ok) {
            const data = await res.json();
            success = { url, data };
            break;
          }
        } catch (err) {
          continue;
        }
      }

      if (!success) {
        throw new Error('Unable to create order. Please try again.');
      }

      // Clear cart and redirect to history
      clearCart();
      setCurrentScreen('products');
      setHistoryModalVisible(true);
      fetchOrders();
      
    } catch (err) {
      console.error('Order submission error:', err);
      Alert.alert('Submission Failed', err.message || 'There was an error submitting your order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ORDER HISTORY
  const fetchOrders = useCallback(async () => {
    if (!(await ensureAuth())) return;
    setLoadingOrders(true);
    try {
      const url = `${API_ROOT}/api/admin/stock-orders`;
      const res = await fetch(url, { 
        headers: { 
          Authorization: `Bearer ${authToken}`, 
          'Content-Type': 'application/json' 
        } 
      });
      
      if (res.status === 401) {
        logout?.();
        return;
      }
      
      if (!res.ok) throw new Error('Failed to fetch orders');
      
      const data = await res.json();
      const ordersList = Array.isArray(data.orders) ? data.orders : 
                        Array.isArray(data) ? data : 
                        Array.isArray(data.data) ? data.data : [];
      setOrders(ordersList);
    } catch (err) {
      console.error('Error fetching orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  }, [authToken, ensureAuth, logout]);

  const fetchOrderDetail = useCallback(async (orderId) => {
    if (!(await ensureAuth())) return;
    try {
      const url = `${API_ROOT}/api/admin/stock-orders/${orderId}`;
      const res = await fetch(url, { 
        headers: { 
          Authorization: `Bearer ${authToken}`, 
          'Content-Type': 'application/json' 
        } 
      });
      
      if (res.status === 401) {
        logout?.();
        return;
      }
      
      if (!res.ok) throw new Error('Failed to fetch order details');
      
      const data = await res.json();
      setOrderDetail(data);
    } catch (err) {
      console.error('Error fetching order details:', err);
      Alert.alert('Error', 'Could not load order details');
    }
  }, [authToken, ensureAuth, logout]);

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('complete') || s.includes('delivered') || s.includes('fulfilled')) return '#10B981';
    if (s.includes('pending')) return '#F59E0B';
    if (s.includes('processing')) return '#3B82F6';
    if (s.includes('cancel') || s.includes('rejected')) return '#EF4444';
    if (s.includes('partial')) return '#F59E0B';
    return '#6B7280';
  };

  const getStatusText = (status) => {
    if (!status) return 'Pending';
    const s = status.toLowerCase();
    if (s.includes('pending')) return 'Pending';
    if (s.includes('processing')) return 'Processing';
    if (s.includes('complete') || s.includes('delivered')) return 'Completed';
    if (s.includes('cancel')) return 'Cancelled';
    if (s.includes('rejected')) return 'Rejected';
    if (s.includes('partial')) return 'Partially Fulfilled';
    return status;
  };

  // INVOICE FUNCTIONS
  const downloadInvoiceToFile = async (orderId) => {
    if (!(await ensureAuth())) throw new Error('Not authenticated');

    const url = `${API_ROOT}/api/admin/stock-orders/${orderId}/invoice`;
    const fileName = `invoice-${orderId}.pdf`;
    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    const fileUri = `${baseDir}${fileName}`;

    try {
      const info = await FileSystem.getInfoAsync(fileUri);
      if (info.exists) {
        await FileSystem.deleteAsync(fileUri, { idempotent: true });
      }
    } catch (e) {}

    const downloadOptions = {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/pdf',
      },
    };

    const result = await FileSystem.downloadAsync(url, fileUri, downloadOptions);
    if (!result || !result.uri) throw new Error(`Download failed${result?.status ? ` (status ${result.status})` : ''}`);
    return result.uri;
  };

  const shareOrderInvoice = async (orderId) => {
    if (!(await ensureAuth())) return;
    try {
      const fileUri = await downloadInvoiceToFile(orderId);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Invoice ${orderId}`,
        });
        return;
      }

      if (Platform.OS === 'android' && FileSystem.getContentUriAsync) {
        const contentObj = await FileSystem.getContentUriAsync(fileUri);
        await Linking.openURL(contentObj.uri);
        return;
      }

      await Linking.openURL(fileUri);
    } catch (err) {
      console.error('shareOrderInvoice error', err);
      Alert.alert('Error', err.message || 'Failed to share invoice');
    }
  };

  // RENDER PRODUCT CARD
  const renderProductCard = ({ item }) => {
    const cartItem = cart.find(cartItem => String(cartItem.productId) === String(item._id));
    const currentQty = cartItem?.qty || 0;

    return (
      <View style={styles.productCard}>
        {/* Product Image */}
        <View style={styles.productImageContainer}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.productImage} />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <MaterialIcons name="inventory" size={28} color={Colors.light.textSecondary} />
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          <View style={styles.productHeader}>
            <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
            {item.sku && (
              <Text style={styles.productSku}>SKU: {item.sku}</Text>
            )}
          </View>
          
          <View style={styles.productFooter}>
            <Text style={styles.productPrice}>₹{item.unitPrice?.toFixed(2)}</Text>
            
            {/* Stock Badge */}
            {item.availableQty != null && (
              <View style={[
                styles.stockBadge,
                { backgroundColor: item.availableQty > 0 ? '#10B981' : '#EF4444' }
              ]}>
                <Text style={styles.stockBadgeText}>
                  {item.availableQty > 0 ? `${item.availableQty} in stock` : 'Out of stock'}
                </Text>
              </View>
            )}
            
            {/* Quantity Controls */}
            {currentQty > 0 ? (
              <View style={styles.quantityControls}>
                <TouchableOpacity 
                  style={styles.quantityButton}
                  onPress={() => updateCartItemQty(item._id, currentQty - 1)}
                >
                  <Ionicons name="remove" size={16} color="#64748B" />
                </TouchableOpacity>
                
                <Text style={styles.quantityText}>{currentQty}</Text>
                
                <TouchableOpacity 
                  style={styles.quantityButton}
                  onPress={() => updateCartItemQty(item._id, currentQty + 1)}
                >
                  <Ionicons name="add" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.addToCartButton}
                onPress={() => addToCart(item)}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text style={styles.addToCartText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  // RENDER CART ITEM
  const renderCartItem = ({ item }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemImageContainer}>
        {item.product.image ? (
          <Image source={{ uri: item.product.image }} style={styles.cartItemImage} />
        ) : (
          <View style={styles.cartItemImagePlaceholder}>
            <MaterialIcons name="inventory" size={20} color={Colors.light.textSecondary} />
          </View>
        )}
      </View>

      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName} numberOfLines={2}>{item.product.name}</Text>
        <Text style={styles.cartItemPrice}>₹{item.unitPrice?.toFixed(2)} each</Text>
        <Text style={styles.cartItemTotal}>₹{(item.unitPrice * item.qty).toFixed(2)}</Text>
      </View>

      <View style={styles.cartItemControls}>
        <TouchableOpacity 
          style={styles.cartQuantityButton}
          onPress={() => updateCartItemQty(item.productId, item.qty - 1)}
        >
          <Ionicons name="remove" size={16} color="#64748B" />
        </TouchableOpacity>
        
        <Text style={styles.cartQuantityText}>{item.qty}</Text>
        
        <TouchableOpacity 
          style={styles.cartQuantityButton}
          onPress={() => updateCartItemQty(item.productId, item.qty + 1)}
        >
          <Ionicons name="add" size={16} color="#64748B" />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.removeCartItemButton}
          onPress={() => removeFromCart(item.productId)}
        >
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // RENDER ORDER HISTORY ITEM
  const renderOrderItem = ({ item }) => {
    const totalValue = Array.isArray(item.items) 
      ? item.items.reduce((sum, lineItem) => {
          const price = Number(lineItem.unitPrice || lineItem.price || 0);
          const quantity = Number(lineItem.requestedQty || lineItem.quantity || 0);
          return sum + (price * quantity);
        }, 0)
      : 0;

    return (
      <TouchableOpacity 
        style={styles.orderItem}
        onPress={() => {
          setSelectedOrder(item);
          setOrderDetailModalVisible(true);
          fetchOrderDetail(item._id);
        }}
      >
        <View style={styles.orderHeader}>
          <View>
            <Text style={styles.orderNumber}>
              Order #{item.orderNumber || item._id?.slice(-8) || 'N/A'}
            </Text>
            <Text style={styles.orderDate}>
              {new Date(item.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </Text>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) }
          ]}>
            <Text style={styles.statusText}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>
        
        <View style={styles.orderDetails}>
          <Text style={styles.orderItems}>
            {item.items?.length || 0} items • {item.totalRequestedQty || 
              item.items?.reduce((sum, it) => sum + (it.requestedQty || 0), 0) || 0} units
          </Text>
          <Text style={styles.orderTotal}>₹{totalValue.toFixed(2)}</Text>
        </View>
        
        <View style={styles.orderFooter}>
          <TouchableOpacity 
            style={styles.invoiceButton}
            onPress={() => shareOrderInvoice(item._id)}
          >
            <Feather name="share" size={16} color="#3B82F6" />
            <Text style={styles.invoiceButtonText}>Share Invoice</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // RENDER ORDER DETAIL
  const renderOrderDetail = () => {
    if (!orderDetail) return null;

    const totalValue = Array.isArray(orderDetail.items) 
      ? orderDetail.items.reduce((sum, item) => sum + (item.unitPrice * item.requestedQty), 0)
      : 0;

    return (
      <View style={styles.orderDetailContainer}>
        <View style={styles.orderDetailHeader}>
          <View>
            <Text style={styles.orderDetailTitle}>
              Order #{orderDetail.orderNumber || orderDetail._id}
            </Text>
            <Text style={styles.orderDetailDate}>
              {new Date(orderDetail.createdAt).toLocaleDateString('en-IN', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
          </View>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(orderDetail.status) }
          ]}>
            <Text style={styles.statusText}>
              {getStatusText(orderDetail.status)}
            </Text>
          </View>
        </View>

        {/* Bill Table */}
        <View style={styles.billContainer}>
          <View style={styles.billHeader}>
            <Text style={styles.billHeaderText}>Item Description</Text>
            <Text style={styles.billHeaderText}>Qty</Text>
            <Text style={styles.billHeaderText}>Price</Text>
            <Text style={styles.billHeaderText}>Amount</Text>
          </View>

          <ScrollView style={styles.billItems}>
            {orderDetail.items?.map((item, index) => (
              <View key={index} style={styles.billRow}>
                <Text style={styles.billItemName}>
                  {item.product?.name || `Product ${item.productId}`}
                </Text>
                <Text style={styles.billItemQty}>{item.requestedQty}</Text>
                <Text style={styles.billItemPrice}>₹{item.unitPrice?.toFixed(2)}</Text>
                <Text style={styles.billItemTotal}>₹{(item.unitPrice * item.requestedQty).toFixed(2)}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.billTotal}>
            <Text style={styles.billTotalLabel}>Total Amount</Text>
            <Text style={styles.billTotalValue}>₹{totalValue.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.orderDetailActions}>
          <TouchableOpacity 
            style={styles.shareInvoiceButton}
            onPress={() => shareOrderInvoice(orderDetail._id)}
          >
            <Feather name="share" size={20} color="#FFFFFF" />
            <Text style={styles.shareInvoiceButtonText}>Share Invoice</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const loadMoreProducts = () => {
    if (products.length < totalProducts && !loadingProducts) {
      fetchProducts({ pg: page + 1, q: search });
    }
  };

  // RENDER PRODUCTS SCREEN
  const renderProductsScreen = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Order Stock</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.historyButton}
          onPress={() => {
            setHistoryModalVisible(true);
            fetchOrders();
          }}
        >
          <Feather name="clock" size={20} color={Colors.light.text} />
          <Text style={styles.historyButtonText}>History</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.light.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={Colors.light.textSecondary}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Products List */}
      <View style={styles.productsContainer}>
        {loadingProducts && products.length === 0 ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.light.accent} />
            <Text style={styles.loadingText}>Loading products...</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <MaterialIcons name="error-outline" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => fetchProducts({ refresh: true })}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={products}
            renderItem={renderProductCard}
            keyExtractor={(item) => String(item._id)}
            showsVerticalScrollIndicator={false}
            onEndReached={loadMoreProducts}
            onEndReachedThreshold={0.5}
            refreshing={refreshing}
            onRefresh={() => fetchProducts({ refresh: true })}
            contentContainerStyle={styles.productsList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <MaterialIcons name="inventory" size={64} color={Colors.light.border} />
                <Text style={styles.emptyTitle}>No Products Found</Text>
                <Text style={styles.emptySubtitle}>
                  {search ? 'Try adjusting your search terms' : 'No products available at the moment'}
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Bottom Order Bar */}
      {cart.length > 0 && (
        <View style={styles.bottomOrderBar}>
          <View style={styles.orderBarContent}>
            <View style={styles.orderSummary}>
              <Text style={styles.orderItemsCount}>{cartTotalQty} items</Text>
              <Text style={styles.orderTotalValue}>₹{cartTotalValue.toFixed(2)}</Text>
            </View>
            <TouchableOpacity 
              style={styles.continueButton}
              onPress={() => setCurrentScreen('cart')}
            >
              <Text style={styles.continueButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  );

  // RENDER CART SCREEN
  const renderCartScreen = () => (
    <>
      <View style={styles.cartHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCurrentScreen('products')}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.cartTitle}>Review Order</Text>
        <View style={styles.cartHeaderRight} />
      </View>

      <View style={styles.cartContainer}>
        {cart.length === 0 ? (
          <View style={styles.emptyCart}>
            <Feather name="shopping-cart" size={64} color={Colors.light.border} />
            <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
            <Text style={styles.emptyCartSubtitle}>
              Add products to your order to continue
            </Text>
            <TouchableOpacity 
              style={styles.continueShoppingButton}
              onPress={() => setCurrentScreen('products')}
            >
              <Text style={styles.continueShoppingText}>Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={cart}
            renderItem={renderCartItem}
            keyExtractor={(item) => String(item.productId)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.cartList}
            ListHeaderComponent={
              <Text style={styles.cartListTitle}>Order Items ({cart.length})</Text>
            }
          />
        )}
      </View>

      {cart.length > 0 && (
        <View style={styles.cartFooter}>
          <View style={styles.cartTotal}>
            <Text style={styles.cartTotalLabel}>Total Amount</Text>
            <Text style={styles.cartTotalValue}>₹{cartTotalValue.toFixed(2)}</Text>
          </View>
          <TouchableOpacity 
            style={[
              styles.placeOrderButton,
              submitting && styles.placeOrderButtonDisabled
            ]}
            onPress={submitOrder}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.placeOrderButtonText}>Place Order</Text>
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {currentScreen === 'products' && renderProductsScreen()}
      {currentScreen === 'cart' && renderCartScreen()}

      {/* Order History Modal */}
      <Modal
        visible={historyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Order History</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setHistoryModalVisible(false)}
            >
              <Ionicons name="close" size={24} color={Colors.light.text} />
            </TouchableOpacity>
          </View>

          {loadingOrders ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.light.accent} />
              <Text style={styles.loadingText}>Loading orders...</Text>
            </View>
          ) : (
            <FlatList
              data={orders}
              renderItem={renderOrderItem}
              keyExtractor={(item) => String(item._id)}
              contentContainerStyle={styles.ordersList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Feather name="package" size={64} color={Colors.light.border} />
                  <Text style={styles.emptyTitle}>No Orders Yet</Text>
                  <Text style={styles.emptySubtitle}>
                    Your orders will appear here once you place them
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Order Detail Modal */}
      <Modal
        visible={orderDetailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Order Details</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setOrderDetailModalVisible(false)}
            >
              <Ionicons name="close" size={24} color={Colors.light.text} />
            </TouchableOpacity>
          </View>
          {renderOrderDetail()}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  // Products Screen Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  historyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#1E293B',
    paddingVertical: 4,
  },
  productsContainer: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  productsList: {
    padding: 16,
    paddingBottom: 100,
  },
  // Product Card Styles
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  productImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  productImage: {
    width: 80,
    height: 80,
  },
  productImagePlaceholder: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  productInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'space-between',
  },
  productHeader: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    lineHeight: 22,
    marginBottom: 4,
  },
  productSku: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 8,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  stockBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 4,
  },
  quantityButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    minWidth: 30,
    textAlign: 'center',
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  addToCartText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bottomOrderBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingBottom: 20,
    paddingTop: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
  },
  orderBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  orderSummary: {
    flex: 1,
  },
  orderItemsCount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  orderTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3B82F6',
    marginTop: 2,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
    minWidth: 120,
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#475569',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Cart Screen Styles
  cartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
  },
  cartTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  cartHeaderRight: {
    width: 32,
  },
  cartContainer: {
    flex: 1,
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyCartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#475569',
    marginTop: 16,
  },
  emptyCartSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  continueShoppingButton: {
    marginTop: 20,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  continueShoppingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cartList: {
    padding: 16,
  },
  cartListTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  cartItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cartItemImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
  },
  cartItemImage: {
    width: 50,
    height: 50,
  },
  cartItemImagePlaceholder: {
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  cartItemInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  cartItemPrice: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  cartItemTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  cartItemControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 4,
  },
  cartQuantityButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
  },
  cartQuantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    minWidth: 30,
    textAlign: 'center',
  },
  removeCartItemButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 6,
    marginLeft: 8,
  },
  cartFooter: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 20,
  },
  cartTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cartTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  cartTotalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3B82F6',
  },
  placeOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  placeOrderButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  placeOrderButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  closeButton: {
    padding: 4,
  },
  ordersList: {
    padding: 16,
  },
  // Order Item Styles
  orderItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 14,
    color: '#64748B',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderItems: {
    fontSize: 14,
    color: '#64748B',
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  invoiceButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  // Order Detail Styles
  orderDetailContainer: {
    flex: 1,
    padding: 16,
  },
  orderDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  orderDetailTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  orderDetailDate: {
    fontSize: 14,
    color: '#64748B',
  },
  // Bill Table Styles
  billContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    overflow: 'hidden',
  },
  billHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  billHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  billItems: {
    maxHeight: 300,
  },
  billRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  billItemName: {
    flex: 2,
    fontSize: 14,
    fontWeight: '500',
    color: '#1E293B',
  },
  billItemQty: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
  },
  billItemPrice: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
    textAlign: 'center',
  },
  billItemTotal: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'right',
  },
  billTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0',
  },
  billTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  billTotalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3B82F6',
  },
  orderDetailActions: {
    alignItems: 'center',
  },
  shareInvoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    width: '100%',
    justifyContent: 'center',
  },
  shareInvoiceButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});