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
      <View className="flex-row bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100">
        {/* Product Image */}
        <View className="w-20 h-20 rounded-xl overflow-hidden bg-gray-50">
          {item.image ? (
            <Image source={{ uri: item.image }} className="w-20 h-20" />
          ) : (
            <View className="w-20 h-20 justify-center items-center bg-gray-100">
              <MaterialIcons name="inventory" size={28} color={Colors.light.textSecondary} />
            </View>
          )}
        </View>

        {/* Product Info */}
        <View className="flex-1 ml-4 justify-between">
          <View className="flex-1">
            <Text className="text-base font-semibold text-gray-800 leading-5 mb-1" numberOfLines={2}>{item.name}</Text>
            {item.sku && (
              <Text className="text-xs text-gray-500 mb-2">SKU: {item.sku}</Text>
            )}
          </View>
          
          <View className="flex-row justify-between items-center mt-2">
            <Text className="text-lg font-bold text-gray-800 flex-1">₹{item.unitPrice?.toFixed(2)}</Text>
            
            {/* Stock Badge */}
            {item.availableQty != null && (
              <View className="px-2 py-1 rounded-lg mr-2" style={{ backgroundColor: item.availableQty > 0 ? '#10B981' : '#EF4444' }}>
                <Text className="text-xs font-semibold text-white">
                  {item.availableQty > 0 ? `${item.availableQty} in stock` : 'Out of stock'}
                </Text>
              </View>
            )}
            
            {/* Quantity Controls */}
            {currentQty > 0 ? (
              <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-lg p-1">
                <TouchableOpacity 
                  className="w-7 h-7 justify-center items-center bg-white rounded-lg"
                  onPress={() => updateCartItemQty(item._id, currentQty - 1)}
                >
                  <Ionicons name="remove" size={16} color="#64748B" />
                </TouchableOpacity>
                
                <Text className="text-sm font-semibold text-gray-800 min-w-7 text-center">{currentQty}</Text>
                
                <TouchableOpacity 
                  className="w-7 h-7 justify-center items-center bg-white rounded-lg"
                  onPress={() => updateCartItemQty(item._id, currentQty + 1)}
                >
                  <Ionicons name="add" size={16} color="#64748B" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity 
                className="flex-row items-center bg-blue-500 px-4 py-2 rounded-lg gap-1.5"
                onPress={() => addToCart(item)}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
                <Text className="text-white text-sm font-semibold">Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  // RENDER CART ITEM
  const renderCartItem = ({ item }) => (
    <View className="flex-row items-center bg-white rounded-lg p-4 mb-3 border border-gray-100">
      <View className="w-12 h-12 rounded-lg overflow-hidden bg-gray-50">
        {item.product.image ? (
          <Image source={{ uri: item.product.image }} className="w-12 h-12" />
        ) : (
          <View className="w-12 h-12 justify-center items-center bg-gray-100">
            <MaterialIcons name="inventory" size={20} color={Colors.light.textSecondary} />
          </View>
        )}
      </View>

      <View className="flex-1 ml-3 mr-3">
        <Text className="text-base font-semibold text-gray-800 mb-1" numberOfLines={2}>{item.product.name}</Text>
        <Text className="text-sm text-gray-500 mb-1">₹{item.unitPrice?.toFixed(2)} each</Text>
        <Text className="text-base font-bold text-gray-800">₹{(item.unitPrice * item.qty).toFixed(2)}</Text>
      </View>

      <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-lg p-1">
        <TouchableOpacity 
          className="w-7 h-7 justify-center items-center bg-white rounded-lg"
          onPress={() => updateCartItemQty(item.productId, item.qty - 1)}
        >
          <Ionicons name="remove" size={16} color="#64748B" />
        </TouchableOpacity>
        
        <Text className="text-sm font-semibold text-gray-800 min-w-7 text-center">{item.qty}</Text>
        
        <TouchableOpacity 
          className="w-7 h-7 justify-center items-center bg-white rounded-lg"
          onPress={() => updateCartItemQty(item.productId, item.qty + 1)}
        >
          <Ionicons name="add" size={16} color="#64748B" />
        </TouchableOpacity>

        <TouchableOpacity 
          className="w-8 h-8 justify-center items-center bg-red-50 border border-red-200 rounded-lg ml-2"
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
        className="bg-white rounded-xl p-4 mb-3 shadow-sm border border-gray-100"
        onPress={() => {
          setSelectedOrder(item);
          setOrderDetailModalVisible(true);
          fetchOrderDetail(item._id);
        }}
      >
        <View className="flex-row justify-between items-start mb-3">
          <View>
            <Text className="text-base font-bold text-gray-800 mb-1">
              Order #{item.orderNumber || item._id?.slice(-8) || 'N/A'}
            </Text>
            <Text className="text-sm text-gray-500">
              {new Date(item.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
              })}
            </Text>
          </View>
          <View className="px-2 py-1 rounded-xl" style={{ backgroundColor: getStatusColor(item.status) }}>
            <Text className="text-xs font-semibold text-white">
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>
        
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-sm text-gray-500">
            {item.items?.length || 0} items • {item.totalRequestedQty || 
              item.items?.reduce((sum, it) => sum + (it.requestedQty || 0), 0) || 0} units
          </Text>
          <Text className="text-lg font-bold text-gray-800">₹{totalValue.toFixed(2)}</Text>
        </View>
        
        <View className="flex-row justify-end">
          <TouchableOpacity 
            className="flex-row items-center bg-blue-50 px-3 py-2 rounded-lg gap-1.5"
            onPress={() => shareOrderInvoice(item._id)}
          >
            <Feather name="share" size={16} color="#3B82F6" />
            <Text className="text-blue-500 text-sm font-semibold">Share Invoice</Text>
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
      <View className="flex-1 p-4">
        <View className="flex-row justify-between items-start mb-5">
          <View>
            <Text className="text-xl font-bold text-gray-800 mb-1">
              Order #{orderDetail.orderNumber || orderDetail._id}
            </Text>
            <Text className="text-sm text-gray-500">
              {new Date(orderDetail.createdAt).toLocaleDateString('en-IN', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </Text>
          </View>
          <View className="px-2 py-1 rounded-xl" style={{ backgroundColor: getStatusColor(orderDetail.status) }}>
            <Text className="text-xs font-semibold text-white">
              {getStatusText(orderDetail.status)}
            </Text>
          </View>
        </View>

        {/* Bill Table */}
        <View className="bg-white rounded-lg border border-gray-200 mb-5 overflow-hidden">
          <View className="flex-row bg-gray-50 px-4 py-3 border-b border-gray-200">
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex-2">Item Description</Text>
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex-1 text-center">Qty</Text>
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex-1 text-center">Price</Text>
            <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex-1 text-right">Amount</Text>
          </View>

          <ScrollView className="max-h-72">
            {orderDetail.items?.map((item, index) => (
              <View key={index} className="flex-row px-4 py-3 border-b border-gray-100">
                <Text className="text-sm font-medium text-gray-800 flex-2">
                  {item.product?.name || `Product ${item.productId}`}
                </Text>
                <Text className="text-sm font-medium text-gray-500 flex-1 text-center">{item.requestedQty}</Text>
                <Text className="text-sm font-medium text-gray-500 flex-1 text-center">₹{item.unitPrice?.toFixed(2)}</Text>
                <Text className="text-sm font-semibold text-gray-800 flex-1 text-right">₹{(item.unitPrice * item.requestedQty).toFixed(2)}</Text>
              </View>
            ))}
          </ScrollView>

          <View className="flex-row justify-between items-center px-4 py-4 bg-gray-50 border-t-2 border-gray-200">
            <Text className="text-base font-semibold text-gray-800">Total Amount</Text>
            <Text className="text-xl font-bold text-blue-500">₹{totalValue.toFixed(2)}</Text>
          </View>
        </View>

        <View className="items-center">
          <TouchableOpacity 
            className="flex-row items-center bg-blue-500 px-6 py-3.5 rounded-xl gap-2 w-full justify-center"
            onPress={() => shareOrderInvoice(orderDetail._id)}
          >
            <Feather name="share" size={20} color="#FFFFFF" />
            <Text className="text-white text-base font-semibold">Share Invoice</Text>
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
      <View className="flex-row justify-between items-center px-5 py-4 bg-white border-b border-gray-200">
        <View>
          <Text className="text-2xl font-bold text-gray-800">Order Stock</Text>
        </View>
        
        <TouchableOpacity 
          className="flex-row items-center bg-gray-50 px-3 py-2 rounded-lg gap-1.5"
          onPress={() => {
            setHistoryModalVisible(true);
            fetchOrders();
          }}
        >
          <Feather name="clock" size={20} color={Colors.light.text} />
          <Text className="text-sm font-semibold text-gray-600">History</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View className="px-5 py-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
          <Ionicons name="search" size={20} color={Colors.light.textSecondary} />
          <TextInput
            className="flex-1 ml-2 text-base text-gray-800 py-1"
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
      <View className="flex-1">
        {loadingProducts && products.length === 0 ? (
          <View className="flex-1 justify-center items-center p-10">
            <ActivityIndicator size="large" color={Colors.light.accent} />
            <Text className="mt-3 text-base text-gray-500 text-center">Loading products...</Text>
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center p-10">
            <MaterialIcons name="error-outline" size={48} color="#EF4444" />
            <Text className="mt-3 text-base text-red-500 text-center">{error}</Text>
            <TouchableOpacity 
              className="mt-4 bg-blue-500 px-5 py-2.5 rounded-lg"
              onPress={() => fetchProducts({ refresh: true })}
            >
              <Text className="text-white text-sm font-semibold">Try Again</Text>
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
            className="p-4 pb-24"
            ListEmptyComponent={
              <View className="items-center py-14 px-10">
                <MaterialIcons name="inventory" size={64} color={Colors.light.border} />
                <Text className="mt-4 text-lg font-semibold text-gray-600 text-center">No Products Found</Text>
                <Text className="mt-2 text-sm text-gray-500 text-center leading-5">
                  {search ? 'Try adjusting your search terms' : 'No products available at the moment'}
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Bottom Order Bar */}
      {cart.length > 0 && (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-5 pt-4 shadow-lg">
          <View className="flex-row items-center justify-between px-5">
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-800">{cartTotalQty} items</Text>
              <Text className="text-xl font-bold text-blue-500 mt-0.5">₹{cartTotalValue.toFixed(2)}</Text>
            </View>
            <TouchableOpacity 
              className="flex-row items-center bg-green-500 px-5 py-3 rounded-xl gap-2 min-w-28 justify-center"
              onPress={() => setCurrentScreen('cart')}
            >
              <Text className="text-white text-base font-semibold">Continue</Text>
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
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity 
          className="p-1"
          onPress={() => setCurrentScreen('products')}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-800">Review Order</Text>
        <View className="w-8" />
      </View>

      <View className="flex-1">
        {cart.length === 0 ? (
          <View className="flex-1 justify-center items-center p-10">
            <Feather name="shopping-cart" size={64} color={Colors.light.border} />
            <Text className="mt-4 text-lg font-semibold text-gray-600">Your cart is empty</Text>
            <Text className="mt-2 text-sm text-gray-500 text-center">
              Add products to your order to continue
            </Text>
            <TouchableOpacity 
              className="mt-5 bg-blue-500 px-5 py-3 rounded-lg"
              onPress={() => setCurrentScreen('products')}
            >
              <Text className="text-white text-sm font-semibold">Continue Shopping</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={cart}
            renderItem={renderCartItem}
            keyExtractor={(item) => String(item.productId)}
            showsVerticalScrollIndicator={false}
            className="p-4"
            ListHeaderComponent={
              <Text className="text-lg font-bold text-gray-800 mb-4">Order Items ({cart.length})</Text>
            }
          />
        )}
      </View>

      {cart.length > 0 && (
        <View className="bg-white border-t border-gray-200 p-5">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-semibold text-gray-800">Total Amount</Text>
            <Text className="text-2xl font-bold text-blue-500">₹{cartTotalValue.toFixed(2)}</Text>
          </View>
          <TouchableOpacity 
            className={`flex-row items-center justify-center py-4 rounded-xl gap-2 ${submitting ? 'bg-gray-400' : 'bg-green-500'}`}
            onPress={submitOrder}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Text className="text-white text-lg font-bold">Place Order</Text>
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  return (
    <SafeAreaView className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {currentScreen === 'products' && renderProductsScreen()}
      {currentScreen === 'cart' && renderCartScreen()}

      {/* Order History Modal */}
      <Modal
        visible={historyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView className="flex-1 bg-gray-50">
          <View className="flex-row justify-between items-center px-5 py-4 bg-white border-b border-gray-200">
            <Text className="text-xl font-bold text-gray-800">Order History</Text>
            <TouchableOpacity 
              className="p-1"
              onPress={() => setHistoryModalVisible(false)}
            >
              <Ionicons name="close" size={24} color={Colors.light.text} />
            </TouchableOpacity>
          </View>

          {loadingOrders ? (
            <View className="flex-1 justify-center items-center p-10">
              <ActivityIndicator size="large" color={Colors.light.accent} />
              <Text className="mt-3 text-base text-gray-500 text-center">Loading orders...</Text>
            </View>
          ) : (
            <FlatList
              data={orders}
              renderItem={renderOrderItem}
              keyExtractor={(item) => String(item._id)}
              className="p-4"
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View className="items-center py-14 px-10">
                  <Feather name="package" size={64} color={Colors.light.border} />
                  <Text className="mt-4 text-lg font-semibold text-gray-600 text-center">No Orders Yet</Text>
                  <Text className="mt-2 text-sm text-gray-500 text-center leading-5">
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
        <SafeAreaView className="flex-1 bg-gray-50">
          <View className="flex-row justify-between items-center px-5 py-4 bg-white border-b border-gray-200">
            <Text className="text-xl font-bold text-gray-800">Order Details</Text>
            <TouchableOpacity 
              className="p-1"
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