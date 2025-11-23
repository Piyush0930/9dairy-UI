// app/(tabs)/supadmin/orders.jsx
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');
const API_BASE = `${process.env.EXPO_PUBLIC_API_URL || ''}/api`;

export default function OrdersScreen() {
  const { authToken, isLoading: authLoading, isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [ordersData, setOrdersData] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [errorMsg, setErrorMsg] = useState(null);
  const insets = useSafeAreaInsets();
  const fadeAnim = useState(new Animated.Value(0))[0];

  const [retailerCache, setRetailerCache] = useState({});

  const getAuthToken = async () => {
    if (authToken) return authToken;
    try {
      return (await AsyncStorage.getItem('authtoken')) || (await AsyncStorage.getItem('token')) || null;
    } catch (e) {
      console.warn('[orders] AsyncStorage read error', e);
      return null;
    }
  };

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  // Fetch orders list
  const fetchOrders = useCallback(async () => {
    setErrorMsg(null);
    setLoadingList(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        setErrorMsg('No auth token found. Please login.');
        setOrdersData(null);
        return;
      }
      const url = `${API_BASE}/superadmin/stock-orders`;
      const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${txt}`);
      }
      const json = await res.json();
      const rawOrders = Array.isArray(json.orders) ? json.orders : (Array.isArray(json.data?.orders) ? json.data.orders : (Array.isArray(json) ? json : []));
      
      const mappedOrders = rawOrders.map(o => ({
        id: o._id,
        orderNumber: o.orderNumber || o._id,
        status: o.status || 'unknown',
        isLocked: !!o.isLocked,
        totalRequestedQty: o.totalRequestedQty ?? (Array.isArray(o.items) ? o.items.reduce((s, it) => s + (it.requestedQty || 0), 0) : 0),
        totalFulfilledQty: o.totalFulfilledQty ?? (Array.isArray(o.items) ? o.items.reduce((s, it) => s + (it.fulfilledQty || 0), 0) : 0),
        priority: o.priority || 'normal',
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        items: Array.isArray(o.items) ? o.items.map(it => ({
          productId: it.product?._id || it.product?.id || it.product || null,
          name: it.product?.name || it.name || 'Unknown product',
          requestedQty: it.requestedQty ?? it.qty ?? 0,
          fulfilledQty: it.fulfilledQty ?? 0,
          reservedQty: it.reservedQty ?? 0,
          unitPrice: it.unitPrice || 0,
          totalPrice: (it.requestedQty || 0) * (it.unitPrice || 0),
          note: it.note || '',
          raw: it,
        })) : [],
        retailer: o.retailer,
        raw: o,
      }));

      setOrdersData({ orders: mappedOrders, total: json.total ?? mappedOrders.length });
    } catch (err) {
      console.error('[orders] fetchOrders error', err);
      setErrorMsg(err.message || 'Failed to load orders');
      setOrdersData(null);
    } finally {
      setLoadingList(false);
      setRefreshing(false);
    }
  }, [authToken]);

  // Fetch retailer details
  const fetchRetailerDetails = useCallback(async (retailerId) => {
    if (!retailerId) return null;
    if (retailerCache[retailerId]) return retailerCache[retailerId];

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Not authenticated');
      const url = `${API_BASE}/superadmin/retailers/${encodeURIComponent(retailerId)}`;
      const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${txt}`);
      }
      const json = await res.json();

      const payload = json.data ?? json;
      const retailerObj = payload.retailer ?? payload;
      if (payload.performance) retailerObj.performance = payload.performance;
      if (Array.isArray(payload.recentOrders)) retailerObj.recentOrders = payload.recentOrders;

      setRetailerCache(prev => ({ ...prev, [retailerId]: retailerObj }));
      return retailerObj;
    } catch (err) {
      console.warn('[orders] fetchRetailerDetails error', err);
      return null;
    }
  }, [retailerCache, authToken]);

  // Fetch single order
  const fetchOrderDetails = useCallback(async (orderId) => {
    setErrorMsg(null);
    setLoadingDetail(true);
    try {
      const token = await getAuthToken();
      if (!token) { setErrorMsg('Not auth'); return; }
      const url = `${API_BASE}/superadmin/stock-orders/${encodeURIComponent(orderId)}`;
      const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      if (!res.ok) { const txt = await res.text().catch(()=> ''); throw new Error(`HTTP ${res.status} ${txt}`); }
      const json = await res.json();

      let orderObj = null;
      if (json == null) throw new Error('Empty response');
      if (json._id) orderObj = json;
      else if (json.order && json.order._id) orderObj = json.order;
      else if (json.success && json.data) {
        if (json.data._id) orderObj = json.data;
        else if (json.data.order && json.data.order._id) orderObj = json.data.order;
        else if (json.data.orderObj && json.data.orderObj._id) orderObj = json.data.orderObj;
      } else if (json.data && json.data.items && Array.isArray(json.data.items)) orderObj = json.data;
      if (!orderObj) throw new Error('Invalid order detail response');

      orderObj.items = Array.isArray(orderObj.items) ? orderObj.items.map(it => ({
        product: (it.product && typeof it.product === 'object') ? it.product : (typeof it.product === 'string' ? { _id: it.product, name: it.name || 'Product' } : (it.product ?? {})),
        requestedQty: it.requestedQty ?? it.qty ?? 0,
        fulfilledQty: it.fulfilledQty ?? 0,
        reservedQty: it.reservedQty ?? 0,
        unitPrice: it.unitPrice || 0,
        totalPrice: (it.requestedQty || 0) * (it.unitPrice || 0),
        note: it.note || '',
        raw: it,
      })) : [];

      if (orderObj.retailer && typeof orderObj.retailer === 'string') {
        const r = await fetchRetailerDetails(orderObj.retailer);
        if (r) orderObj.retailer = r;
      } else if (orderObj.retailer && orderObj.retailer._id) {
        const rid = orderObj.retailer._id;
        const cached = await fetchRetailerDetails(rid);
        if (cached) orderObj.retailer = { ...orderObj.retailer, ...cached };
      }

      setSelectedOrder(orderObj);
      setShowDetailsModal(true);
    } catch (err) {
      console.error('[orders] fetchOrderDetails error', err);
      Alert.alert('Error', err.message || 'Failed to load order details');
      setSelectedOrder(null);
      setShowDetailsModal(false);
    } finally {
      setLoadingDetail(false);
    }
  }, [authToken, fetchRetailerDetails]);

  // Action on order
  const actOnOrder = async ({ orderId, action, items = [], reason = '' }) => {
    const token = await getAuthToken();
    if (!token) { Alert.alert('Auth', 'Not authenticated'); return; }
    const idempotencyKey = uuidv4();
    const url = `${API_BASE}/superadmin/stock-orders/${encodeURIComponent(orderId)}/action`;
    try {
      if (action === 'reject' || action === 'cancel') {
        const ok = await new Promise(resolve => Alert.alert(`${action}`, `Are you sure you want to ${action} this order?`, [
          { text: 'No', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Yes', onPress: () => resolve(true) },
        ]));
        if (!ok) return;
      }
      setLoadingDetail(true);
      const body = { action, items, reason, idempotencyKey };
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (!res.ok) {
        const txt = await res.text().catch(()=> '');
        throw new Error(`HTTP ${res.status} ${txt}`);
      }
      const json = await res.json();
      const updatedOrder = json.order || json || null;
      if (updatedOrder && updatedOrder._id) {
        if (updatedOrder.retailer && typeof updatedOrder.retailer === 'string') {
          const r = await fetchRetailerDetails(updatedOrder.retailer);
          if (r) updatedOrder.retailer = r;
        }
        setSelectedOrder(updatedOrder);
        await fetchOrders();
        Alert.alert('Success', `${action} completed`);
      } else {
        await fetchOrderDetails(orderId);
        await fetchOrders();
        Alert.alert('Success', `${action} completed`);
      }
    } catch (err) {
      console.error('[orders] actOnOrder error', err);
      Alert.alert('Error', err.message || 'Action failed');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Lock order
  const lockOrder = async (orderId) => {
    const token = await getAuthToken();
    if (!token) { Alert.alert('Auth', 'Not authenticated'); return; }
    try {
      const res = await fetch(`${API_BASE}/superadmin/stock-orders/${encodeURIComponent(orderId)}/lock`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      if (!res.ok) { const txt = await res.text().catch(()=> ''); throw new Error(`HTTP ${res.status} ${txt}`); }
      const updated = await res.json();
      if (updated.retailer && typeof updated.retailer === 'string') {
        const r = await fetchRetailerDetails(updated.retailer);
        if (r) updated.retailer = r;
      }
      setSelectedOrder(updated);
      await fetchOrders();
      Alert.alert('Locked', 'Order locked for processing');
    } catch (err) {
      console.error('[orders] lockOrder error', err);
      Alert.alert('Error', err.message || 'Lock failed');
    }
  };

  // Release lock
  const releaseOrderLock = async (orderId, note = '') => {
    const token = await getAuthToken();
    if (!token) { Alert.alert('Auth', 'Not authenticated'); return; }
    try {
      const res = await fetch(`${API_BASE}/superadmin/stock-orders/${encodeURIComponent(orderId)}/release-lock`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ note }) });
      if (!res.ok) { const txt = await res.text().catch(()=> ''); throw new Error(`HTTP ${res.status} ${txt}`); }
      const updated = await res.json();
      if (updated.retailer && typeof updated.retailer === 'string') {
        const r = await fetchRetailerDetails(updated.retailer);
        if (r) updated.retailer = r;
      }
      setSelectedOrder(updated);
      await fetchOrders();
      Alert.alert('Released', 'Lock released');
    } catch (err) {
      console.error('[orders] releaseOrderLock error', err);
      Alert.alert('Error', err.message || 'Release failed');
    }
  };

  // Initial fetch
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated && !authToken) {
      setErrorMsg('Not authenticated. Please login.');
      setOrdersData(null);
      setLoadingList(false);
      return;
    }
    fetchOrders();
  }, [authLoading, authToken, isAuthenticated]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
  };

  // Summary statistics
  const getOrderStats = () => {
    const orders = ordersData?.orders || [];
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      processing: orders.filter(o => o.status === 'processing').length,
      fulfilled: orders.filter(o => o.status === 'fulfilled').length,
      locked: orders.filter(o => o.isLocked).length,
    };
  };

  const filteredOrders = (ordersData?.orders || []).filter(order => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || 
      (order.orderNumber || '').toLowerCase().includes(q) || 
      (order.items?.[0]?.name || '').toLowerCase().includes(q);
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Calculate order totals
  const calculateOrderTotals = (order) => {
    const subtotal = order.items?.reduce((sum, item) => sum + (item.totalPrice || 0), 0) || 0;
    return {
      subtotal,
      tax: 0, // You can add tax calculation if needed
      total: subtotal
    };
  };

  // UI Components
  const StatusBadge = ({ status }) => {
    const getStatusConfig = (status) => {
      switch (status) {
        case 'pending': return { color: '#F59E0B', bgColor: '#FEF3C7', text: 'Pending', icon: 'pending' };
        case 'fulfilled': return { color: '#10B981', bgColor: '#D1FAE5', text: 'Fulfilled', icon: 'check-circle' };
        case 'processing': return { color: '#3B82F6', bgColor: '#DBEAFE', text: 'Processing', icon: 'settings' };
        case 'locked': return { color: '#DC2626', bgColor: '#FEE2E2', text: 'Locked', icon: 'lock' };
        case 'cancelled': return { color: '#6B7280', bgColor: '#F3F4F6', text: 'Cancelled', icon: 'cancel' };
        case 'partially_fulfilled': return { color: '#8B5CF6', bgColor: '#EDE9FE', text: 'Partial', icon: 'partially' };
        default: return { color: '#6B7280', bgColor: '#F3F4F6', text: status || 'Unknown', icon: 'help' };
      }
    };
    const cfg = getStatusConfig(status);
    return (
      <View className="flex-row items-center px-2 py-1 rounded-lg gap-1" style={{ backgroundColor: cfg.bgColor }}>
        <MaterialIcons name={cfg.icon} size={12} color={cfg.color} />
        <Text className="text-xs font-bold" style={{ color: cfg.color }}>{cfg.text}</Text>
      </View>
    );
  };

  const OrderCard = ({ order }) => {
    const handleViewDetails = () => {
      fetchOrderDetails(order.id);
    };

    const totals = calculateOrderTotals(order);

    return (
      <TouchableOpacity className="bg-white p-4 rounded-2xl shadow-sm mb-3" onPress={handleViewDetails} activeOpacity={0.8}>
        {/* Header Section */}
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900 mb-1">{order.orderNumber}</Text>
            <Text className="text-sm text-gray-500 font-semibold">
              {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { 
                day: 'numeric', 
                month: 'short',
                year: 'numeric'
              }) : '—'}
            </Text>
          </View>
          <View className="items-end gap-1.5">
            <StatusBadge status={order.status} />
            {order.isLocked && <StatusBadge status={'locked'} />}
          </View>
        </View>

        {/* Order Summary */}
        <View className="mb-4 gap-1.5">
          <View className="flex-row justify-between items-center">
            <Text className="text-sm text-gray-500 font-medium">Items:</Text>
            <Text className="text-sm text-gray-900 font-semibold">{order.items?.length || 0}</Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-sm text-gray-500 font-medium">Total Amount:</Text>
            <Text className="text-sm text-gray-900 font-semibold">₹{totals.total.toFixed(2)}</Text>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-sm text-gray-500 font-medium">Priority:</Text>
            <Text className="text-sm font-semibold" style={{ 
              color: order.priority === 'high' ? '#DC2626' : order.priority === 'low' ? '#10B981' : '#3B82F6'
            }}>
              {order.priority || 'normal'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="flex-row gap-2">
          <TouchableOpacity 
            className="flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-1.5 bg-blue-500" 
            onPress={handleViewDetails}
          >
            <Feather name="eye" size={14} color="#FFFFFF" />
            <Text className="text-xs font-semibold text-white">View Details</Text>
          </TouchableOpacity>

          {order.isLocked ? (
            <TouchableOpacity 
              className="flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-1.5 bg-green-500" 
              onPress={() => releaseOrderLock(order.id)}
            >
              <Feather name="unlock" size={14} color="#FFFFFF" />
              <Text className="text-xs font-semibold text-white">Unlock</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              className="flex-1 flex-row items-center justify-center py-2.5 rounded-lg gap-1.5 bg-red-600" 
              onPress={() => lockOrder(order.id)}
            >
              <Feather name="lock" size={14} color="#FFFFFF" />
              <Text className="text-xs font-semibold text-white">Lock</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const StatusFilter = () => {
    const stats = getOrderStats();
    const filters = [
      { key: 'all', label: 'All', count: stats.total },
      { key: 'pending', label: 'Pending', count: stats.pending },
      { key: 'processing', label: 'Processing', count: stats.processing },
      { key: 'partially_fulfilled', label: 'Partial', count: stats.processing },
      { key: 'fulfilled', label: 'Fulfilled', count: stats.fulfilled },
    ];

    return (
      <View className="px-5 py-4">
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          className="gap-2"
        >
          {filters.map(filter => (
            <TouchableOpacity 
              key={filter.key} 
              className={`flex-row items-center px-4 py-3 rounded-xl border mr-2 ${
                filterStatus === filter.key ? 'bg-blue-500 border-blue-500' : 'bg-gray-50 border-gray-200'
              }`} 
              onPress={() => setFilterStatus(filter.key)}
            >
              <Text className={`text-sm font-semibold mr-1.5 ${
                filterStatus === filter.key ? 'text-white' : 'text-gray-500'
              }`}>
                {filter.label}
              </Text>
              <View className={`px-1.5 py-0.5 rounded ${
                filterStatus === filter.key ? 'bg-blue-700' : 'bg-gray-200'
              }`}>
                <Text className="text-xs text-gray-500 font-bold">{filter.count}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const OrderDetailModal = () => {
    if (!selectedOrder) return null;

    const totals = calculateOrderTotals(selectedOrder);

    return (
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
          <View className="flex-row justify-between items-center px-5 py-4 bg-white border-b border-gray-200">
            <Text className="text-xl font-bold text-gray-900">Order Details</Text>
            <TouchableOpacity 
              className="p-1"
              onPress={() => setShowDetailsModal(false)}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1">
            {loadingDetail ? (
              <View className="p-10 items-center">
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text className="mt-3 text-sm text-gray-500 text-center">Loading order details...</Text>
              </View>
            ) : (
              <>
                {/* Basic Info */}
                <View className="bg-white mx-4 mb-0 rounded-2xl p-5 shadow-sm mt-4">
                  <View className="flex-row justify-between items-start mb-2">
                    <Text className="text-2xl font-bold text-gray-900 flex-1">{selectedOrder.orderNumber}</Text>
                    <View className="items-end gap-1.5">
                      <StatusBadge status={selectedOrder.status} />
                      {selectedOrder.isLocked && <StatusBadge status={'locked'} />}
                    </View>
                  </View>
                  <Text className="text-base text-gray-500 font-semibold mb-1">
                    Created {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '—'}
                  </Text>
                  <Text className="text-sm text-gray-400">Priority: {selectedOrder.priority || 'normal'}</Text>
                </View>

                {/* Retailer Information */}
                {selectedOrder.retailer && (
                  <View className="bg-white mx-4 mb-0 rounded-2xl p-5 shadow-sm mt-4">
                    <Text className="text-lg font-bold text-gray-900 mb-4">Retailer Information</Text>
                    <View className="gap-1.5">
                      <Text className="text-lg text-gray-700 font-semibold">
                        {selectedOrder.retailer.shopName || selectedOrder.retailer.name || selectedOrder.retailer.ownerName || '—'}
                      </Text>
                      <Text className="text-base text-gray-500 font-medium">{selectedOrder.retailer.email || selectedOrder.retailer.mobile || ''}</Text>
                    </View>
                  </View>
                )}

                {/* Order Items Table */}
                <View className="bg-white mx-4 mb-0 rounded-2xl p-5 shadow-sm mt-4">
                  <Text className="text-lg font-bold text-gray-900 mb-4">Order Items</Text>
                  <View className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Table Header */}
                    <View className="flex-row bg-gray-50 border-b border-gray-200 py-3 px-2">
                      <Text className="text-xs font-bold text-gray-500 uppercase flex-4">Product</Text>
                      <Text className="text-xs font-bold text-gray-500 uppercase flex-2 text-center">Qty</Text>
                      <Text className="text-xs font-bold text-gray-500 uppercase flex-2 text-right">Price</Text>
                      <Text className="text-xs font-bold text-gray-500 uppercase flex-2 text-right">Total</Text>
                    </View>
                    
                    {/* Table Rows */}
                    {(selectedOrder.items || []).map((item, index) => (
                      <View key={index} className="flex-row border-b border-gray-100 py-3 px-2">
                        <View className="flex-4 justify-center">
                          <Text className="text-sm font-semibold text-gray-900 mb-1">{item.name}</Text>
                          {item.note ? <Text className="text-xs text-gray-500 italic">{item.note}</Text> : null}
                        </View>
                        <View className="flex-2 items-center justify-center">
                          <Text className="text-sm font-semibold text-gray-900 text-center">{item.requestedQty}</Text>
                          {item.fulfilledQty > 0 && (
                            <Text className="text-xs text-green-500 font-medium mt-0.5">Fulfilled: {item.fulfilledQty}</Text>
                          )}
                        </View>
                        <View className="flex-2 items-end justify-center">
                          <Text className="text-sm text-gray-500 font-medium">₹{item.unitPrice?.toFixed(2)}</Text>
                        </View>
                        <View className="flex-2 items-end justify-center">
                          <Text className="text-sm font-semibold text-gray-900">₹{item.totalPrice?.toFixed(2)}</Text>
                        </View>
                      </View>
                    ))}
                    
                    {/* Table Footer */}
                    <View className="bg-gray-50 p-4 border-t border-gray-200">
                      <View className="flex-row justify-between items-center mb-2">
                        <Text className="text-sm text-gray-500 font-medium">Subtotal:</Text>
                        <Text className="text-sm text-gray-900 font-semibold">₹{totals.subtotal.toFixed(2)}</Text>
                      </View>
                      <View className="flex-row justify-between items-center">
                        <Text className="text-sm text-gray-500 font-medium">Total:</Text>
                        <Text className="text-base font-bold text-gray-900">₹{totals.total.toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <View className="p-4 gap-3">
                  <TouchableOpacity 
                    className="flex-row items-center py-3.5 rounded-xl gap-2 justify-center bg-green-500"
                    onPress={() => {
                      const items = (selectedOrder.items || []).map(it => ({ 
                        product: it.product?._id || it.productId || it.product, 
                        fulfilledQty: Math.max(0, (it.requestedQty || 0) - (it.fulfilledQty || 0)) 
                      }));
                      actOnOrder({ 
                        orderId: selectedOrder._id, 
                        action: 'fulfill', 
                        items, 
                        reason: 'Fulfilled from SuperAdmin panel' 
                      });
                    }}
                  >
                    <Feather name="check-circle" size={20} color="#FFFFFF" />
                    <Text className="text-base font-semibold text-white">Fulfill Remaining</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    className="flex-row items-center py-3.5 rounded-xl gap-2 justify-center bg-red-600"
                    onPress={() => {
                      actOnOrder({ 
                        orderId: selectedOrder._id, 
                        action: 'reject', 
                        items: [], 
                        reason: 'Rejected by SuperAdmin' 
                      });
                    }}
                  >
                    <Feather name="x-circle" size={20} color="#FFFFFF" />
                    <Text className="text-base font-semibold text-white">Reject Order</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const stats = getOrderStats();

  return (
    <Animated.View className="flex-1 bg-gray-50" style={{ opacity: fadeAnim, paddingTop: insets.top }}>
      {/* Header Section */}
      <View className="flex-row justify-between items-center px-5 py-4 bg-white border-b border-gray-200">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-900">Stock Orders</Text>
        </View>
      </View>

      <ScrollView 
        className="flex-1" 
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#3B82F6']}
            tintColor="#3B82F6"
          />
        } 
        showsVerticalScrollIndicator={false}
      >
        {/* Status Filter */}
        <StatusFilter />

        {/* Search Bar */}
        <View className="px-5 pb-4">
          <View className="flex-row items-center bg-white border border-gray-200 rounded-xl px-3 py-2 gap-2">
            <Feather name="search" size={16} color="#64748B" />
            <TextInput 
              className="flex-1 text-sm text-gray-900 py-1" 
              placeholder="Search orders by number or product..." 
              value={searchQuery} 
              onChangeText={setSearchQuery} 
              placeholderTextColor="#94A3B8" 
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="clear" size={16} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Orders List */}
        <View className="px-5">
          {loadingList ? (
            <View className="p-10 items-center">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="mt-3 text-sm text-gray-500 text-center">Loading orders...</Text>
            </View>
          ) : filteredOrders.length === 0 ? (
            <View className="items-center py-10 px-5">
              <Feather name="package" size={48} color="#CBD5E1" />
              <Text className="mt-3 text-base font-semibold text-gray-500 text-center">No orders found</Text>
              <Text className="mt-1 text-sm text-gray-400 text-center leading-5">
                {searchQuery ? 'Try adjusting your search terms' : `No ${filterStatus === 'all' ? '' : filterStatus} orders found`}
              </Text>
            </View>
          ) : (
            <View>
              {filteredOrders.map(order => (
                <OrderCard key={order.id} order={order} />
              ))}
            </View>
          )}
        </View>

        <View className="h-10" />
      </ScrollView>

      {/* Order Details Modal */}
      <OrderDetailModal />
    </Animated.View>
  );
}