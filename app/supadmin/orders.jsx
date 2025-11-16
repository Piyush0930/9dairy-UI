// app/(tabs)/supadmin/orders.jsx
import 'react-native-get-random-values'; // <-- polyfill for uuid in RN/Expo
import { v4 as uuidv4 } from 'uuid';

import { Feather, MaterialIcons } from '@expo/vector-icons';
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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');
const API_BASE = `${process.env.EXPO_PUBLIC_API_URL || ''}/api`; // e.g. http://localhost:5000

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
  const [filterPayment, setFilterPayment] = useState('all');
  const [errorMsg, setErrorMsg] = useState(null);
  const fadeAnim = useState(new Animated.Value(0))[0];

  // cache for retailer details to avoid repeated fetches
  const [retailerCache, setRetailerCache] = useState({});

  // token fallback
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

  // ---------- Fetch orders list ----------
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
          note: it.note || '',
          raw: it,
        })) : [],
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

  // ---------- Fetch retailer details by id (uses cache) ----------
  const fetchRetailerDetails = useCallback(async (retailerId) => {
    if (!retailerId) return null;
    // return cached if exists
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

      // many APIs wrap as { success, data: { retailer, performance, recentOrders } }
      const payload = json.data ?? json;
      const retailerObj = payload.retailer ?? payload;
      // attach performance & recentOrders if present
      if (payload.performance) retailerObj.performance = payload.performance;
      if (Array.isArray(payload.recentOrders)) retailerObj.recentOrders = payload.recentOrders;

      // cache
      setRetailerCache(prev => ({ ...prev, [retailerId]: retailerObj }));
      return retailerObj;
    } catch (err) {
      console.warn('[orders] fetchRetailerDetails error', err);
      return null;
    }
  }, [retailerCache, authToken]);

  // ---------- Fetch single order ----------
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

      // accept many shapes
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

      // normalize items
      orderObj.items = Array.isArray(orderObj.items) ? orderObj.items.map(it => ({
        product: (it.product && typeof it.product === 'object') ? it.product : (typeof it.product === 'string' ? { _id: it.product, name: it.name || 'Product' } : (it.product ?? {})),
        requestedQty: it.requestedQty ?? it.qty ?? 0,
        fulfilledQty: it.fulfilledQty ?? 0,
        reservedQty: it.reservedQty ?? 0,
        note: it.note || '',
        raw: it,
      })) : [];

      // If retailer is an ID (string), fetch full retailer info using retailer API
      if (orderObj.retailer && typeof orderObj.retailer === 'string') {
        const r = await fetchRetailerDetails(orderObj.retailer);
        if (r) orderObj.retailer = r;
      } else if (orderObj.retailer && orderObj.retailer._id) {
        // if object already contains _id, still try to attach performance if cached
        const rid = orderObj.retailer._id;
        const cached = await fetchRetailerDetails(rid); // fetch will return cached quickly
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

  // ---------- Act on order (fulfill/reject/cancel) ----------
  const actOnOrder = async ({ orderId, action, items = [], reason = '' }) => {
    const token = await getAuthToken();
    if (!token) { Alert.alert('Auth', 'Not authenticated'); return; }
    const idempotencyKey = uuidv4();
    const url = `${API_BASE}/superadmin/stock-orders/${encodeURIComponent(orderId)}/action`;
    try {
      // confirm for destructive actions
      if (action === 'reject' || action === 'cancel') {
        const ok = await new Promise(resolve => Alert.alert(`${action}`, `Are you sure you want to ${action} this order?`, [
          { text: 'No', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Yes', onPress: () => resolve(true) },
        ]));
        if (!ok) return;
      }
      // optimistic spinner
      setLoadingDetail(true);
      const body = { action, items, reason, idempotencyKey };
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (!res.ok) {
        const txt = await res.text().catch(()=> '');
        throw new Error(`HTTP ${res.status} ${txt}`);
      }
      const json = await res.json();
      // backend returns the updated order (or message)
      const updatedOrder = json.order || json || null;
      if (updatedOrder && updatedOrder._id) {
        // If retailer is an ID, try to fetch retailer details to attach
        if (updatedOrder.retailer && typeof updatedOrder.retailer === 'string') {
          const r = await fetchRetailerDetails(updatedOrder.retailer);
          if (r) updatedOrder.retailer = r;
        }
        setSelectedOrder(updatedOrder);
        await fetchOrders();
        Alert.alert('Success', `${action} completed`);
      } else {
        // fallback - re-fetch details and list
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

  // ---------- Lock / Release ----------
  const lockOrder = async (orderId) => {
    const token = await getAuthToken();
    if (!token) { Alert.alert('Auth', 'Not authenticated'); return; }
    try {
      const res = await fetch(`${API_BASE}/superadmin/stock-orders/${encodeURIComponent(orderId)}/lock`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      if (!res.ok) { const txt = await res.text().catch(()=> ''); throw new Error(`HTTP ${res.status} ${txt}`); }
      const updated = await res.json();
      // attach retailer details if returned as id
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

  // initial fetch
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
    setRefreshing(false);
    Alert.alert('✅ Refreshed', 'Orders list updated');
  };

  const filteredOrders = (ordersData?.orders || []).filter(order => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch = !q || (order.orderNumber || '').toLowerCase().includes(q) || (order.items?.[0]?.name || '').toLowerCase().includes(q);
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const matchesPayment = filterPayment === 'all' || true;
    return matchesSearch && matchesStatus && matchesPayment;
  });

  // Reuse your styles and components from previous file
  const StatusBadge = ({ status, type = 'order' }) => {
    const getStatusConfig = (status) => {
      switch (status) {
        case 'pending': return { color: '#F59E0B', bgColor: '#FEF3C7', text: 'Pending', icon: 'pending' };
        case 'fulfilled': return { color: '#10B981', bgColor: '#D1FAE5', text: 'Fulfilled', icon: 'check-circle' };
        case 'processing': return { color: '#8B5CF6', bgColor: '#EDE9FE', text: 'Processing', icon: 'settings' };
        case 'locked': return { color: '#F59E0B', bgColor: '#FEF3C7', text: 'Locked', icon: 'lock' };
        case 'cancelled': return { color: '#EF4444', bgColor: '#FEE2E2', text: 'Cancelled', icon: 'cancel' };
        default: return { color: '#6B7280', bgColor: '#F3F4F6', text: status || 'Unknown', icon: 'help' };
      }
    };
    const cfg = getStatusConfig(status);
    return (
      <View style={[styles.statusBadge, { backgroundColor: cfg.bgColor }]}>
        <MaterialIcons name={cfg.icon} size={12} color={cfg.color} />
        <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.text}</Text>
      </View>
    );
  };

  const OrderCard = ({ order }) => {
    const scaleAnim = useState(new Animated.Value(1))[0];
    const handlePressIn = () => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start();
    const handlePressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={styles.orderCard}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => fetchOrderDetails(order.id)}
          activeOpacity={0.85}
        >
          <View style={styles.orderHeader}>
            <View style={styles.orderInfo}>
              <Text style={styles.orderId}>{order.orderNumber}</Text>
              <Text style={styles.orderDate}>
                {order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
              </Text>
            </View>
            <View style={styles.statusContainer}>
              <StatusBadge status={order.status} />
              {order.isLocked && <StatusBadge status={'locked'} />}
            </View>
          </View>

          <View style={styles.orderDetails}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Feather name="layers" size={14} color="#64748B" />
                <Text style={styles.detailText}>{order.items?.length ?? 0} items</Text>
              </View>
              <View style={styles.detailItem}>
                <Feather name="hash" size={14} color="#64748B" />
                <Text style={styles.detailText}>Qty: {order.totalRequestedQty}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Feather name="clock" size={14} color="#64748B" />
                <Text style={styles.detailText}>Updated {order.updatedAt ? new Date(order.updatedAt).toLocaleString() : '—'}</Text>
              </View>
              <View style={styles.detailItem}>
                <Feather name="flag" size={14} color="#64748B" />
                <Text style={styles.detailText}>{order.priority}</Text>
              </View>
            </View>
          </View>

          <View style={styles.orderFooter}>
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Fulfilled</Text>
              <Text style={styles.amountValue}>{order.totalFulfilledQty}/{order.totalRequestedQty}</Text>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity style={[styles.actionButton, styles.contactButton]} onPress={() => fetchOrderDetails(order.id)}>
                <Feather name="eye" size={14} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.updateButton]} onPress={() => {
                Alert.alert('Quick Action', `Toggle lock for ${order.orderNumber}`, [{ text: 'OK' }]);
              }}>
                <Feather name="lock" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const StatusFilter = () => {
    const counts = (ordersData?.orders || []).reduce((acc, o) => { acc[o.status] = (acc[o.status] || 0) + 1; return acc; }, {});
    const statusFilters = [
      { key: 'all', label: 'All', count: ordersData?.total ?? (ordersData?.orders?.length ?? 0) },
      { key: 'pending', label: 'Pending', count: counts['pending'] ?? 0 },
      { key: 'fulfilled', label: 'Fulfilled', count: counts['fulfilled'] ?? 0 },
      { key: 'processing', label: 'Processing', count: counts['processing'] ?? 0 },
      { key: 'cancelled', label: 'Cancelled', count: counts['cancelled'] ?? 0 },
    ];
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {statusFilters.map((filter) => (
          <TouchableOpacity key={filter.key} style={[styles.filterButton, filterStatus === filter.key && styles.filterButtonActive]} onPress={() => setFilterStatus(filter.key)}>
            <Text style={[styles.filterText, filterStatus === filter.key && styles.filterTextActive]}>{filter.label}</Text>
            <View style={[styles.filterCount, filterStatus === filter.key && styles.filterCountActive]}><Text style={styles.filterCountText}>{filter.count}</Text></View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Stock Orders</Text>
          <Text style={styles.headerSubtitle}>Manage internal stock orders</Text>
        </View>
        <TouchableOpacity style={styles.exportButton} onPress={() => fetchOrders()}>
          <Feather name="refresh-ccw" size={18} color="#FFFFFF" />
          <Text style={styles.exportButtonText}>Reload</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} refreshControl={<RefreshControl refreshing={refreshing || loadingList} onRefresh={onRefresh} />} showsVerticalScrollIndicator={false}>
        {errorMsg ? <View style={styles.errorBanner}><Text style={styles.errorTitle}>Error</Text><Text style={styles.errorText}>{errorMsg}</Text></View> : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Orders Overview</Text>
            <TouchableOpacity onPress={fetchOrders}><MaterialIcons name="refresh" size={20} color="#3B82F6" /></TouchableOpacity>
          </View>

          {loadingList && !ordersData ? <View style={styles.centered}><ActivityIndicator size="large" /></View> : (!ordersData ? (
            <View style={styles.emptyState}><Text style={styles.emptyStateTitle}>No orders available</Text><Text style={styles.emptyStateText}>No stock orders were returned by the server.</Text></View>
          ) : (
            <>
              <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                  <Feather name="search" size={20} color="#64748B" />
                  <TextInput style={styles.searchInput} placeholder="Search orders by number or product..." value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor="#94A3B8" />
                  {searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')}><MaterialIcons name="clear" size={20} color="#64748B" /></TouchableOpacity>}
                </View>
              </View>

              <Text style={styles.filterLabel}>Status</Text>
              <StatusFilter />

              <View style={styles.ordersList}>
                {filteredOrders.length === 0 ? (
                  <View style={styles.emptyState}><Feather name="package" size={48} color="#E2E8F0" /><Text style={styles.emptyStateTitle}>No orders match filters</Text><Text style={styles.emptyStateText}>Try clearing filters or refreshing the list.</Text></View>
                ) : (filteredOrders.map(order => <OrderCard key={order.id} order={order} />))}
              </View>
            </>
          ))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Order Details Modal */}
      <Modal visible={showDetailsModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowDetailsModal(false)}>
        {loadingDetail && !selectedOrder ? <View style={[styles.modalContainer, styles.centered]}><ActivityIndicator size="large" /></View> : selectedOrder ? (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedOrder.orderNumber || selectedOrder._id}</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowDetailsModal(false)}><MaterialIcons name="close" size={24} color="#000" /></TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.modalSection}>
                <View style={styles.orderHeaderModal}>
                  <Text style={styles.modalOrderId}>{selectedOrder.orderNumber || selectedOrder._id}</Text>
                  <View style={styles.statusContainer}>
                    <StatusBadge status={selectedOrder.status} />
                    {selectedOrder.isLocked && <StatusBadge status={'locked'} />}
                  </View>
                </View>
                <Text style={styles.orderDateModal}>Created {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString('en-IN') : '—'}</Text>
                <Text style={[styles.detailText, { marginTop: 6 }]}>Priority: {selectedOrder.priority || 'normal'}</Text>
                <Text style={[styles.detailText]}>Requested: {selectedOrder.totalRequestedQty ?? selectedOrder.items.reduce((s, it) => s + (it.requestedQty || 0), 0)} • Fulfilled: {selectedOrder.totalFulfilledQty ?? selectedOrder.items.reduce((s, it) => s + (it.fulfilledQty || 0), 0)}</Text>

                {selectedOrder.retailer && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={styles.sectionTitle}>Retailer</Text>
                    <Text style={styles.detailText}>{selectedOrder.retailer.shopName || selectedOrder.retailer.retailerName || selectedOrder.retailer.ownerName || '—'}</Text>
                    <Text style={styles.detailText}>{selectedOrder.retailer.mobile || ''}</Text>
                    <Text style={styles.detailText}>{selectedOrder.retailer.address || selectedOrder.retailer.location?.formattedAddress || ''}</Text>

                    {/* show performance if available */}
                    {selectedOrder.retailer.performance && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.detailText, { fontWeight: '700' }]}>Performance</Text>
                        <Text style={styles.detailText}>Total Orders: {selectedOrder.retailer.performance.totalOrders ?? '—'}</Text>
                        <Text style={styles.detailText}>Total Revenue: ₹{(selectedOrder.retailer.performance.totalRevenue ?? 0).toLocaleString()}</Text>
                        <Text style={styles.detailText}>Completed: {selectedOrder.retailer.performance.completedOrders ?? 0} • Pending: {selectedOrder.retailer.performance.pendingOrders ?? 0}</Text>
                      </View>
                    )}

                    {/* recent orders if present */}
                    {Array.isArray(selectedOrder.retailer.recentOrders) && selectedOrder.retailer.recentOrders.length > 0 && (
                      <View style={{ marginTop: 8 }}>
                        <Text style={[styles.detailText, { fontWeight: '700' }]}>Recent Orders</Text>
                        {selectedOrder.retailer.recentOrders.slice(0,5).map((ro, i) => (
                          <Text key={i} style={styles.detailText}>
                            {ro.orderId} — ₹{ro.amount} — {ro.status} — {ro.customerName} • {new Date(ro.createdAt).toLocaleString()}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {selectedOrder.createdBy && <Text style={[styles.detailText, { marginTop: 8 }]}>Created by: {selectedOrder.createdBy}</Text>}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Items</Text>
                {(selectedOrder.items || []).map((it, idx) => {
                  const product = it.product || it.raw?.product || {};
                  const name = product.name || it.name || 'Unknown product';
                  return (
                    <View key={idx} style={styles.productItem}>
                      <View style={styles.productInfo}>
                        <Text style={styles.productName}>{name}</Text>
                        <Text style={styles.productQuantity}>Requested: {it.requestedQty} • Fulfilled: {it.fulfilledQty}</Text>
                        {it.note ? <Text style={[styles.detailText, { marginTop: 4 }]}>Note: {it.note}</Text> : null}
                      </View>
                      <Text style={styles.productPrice}>ID: {product._id || it.productId || '—'}</Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Notes</Text>
                {(selectedOrder.notes || []).length === 0 ? <Text style={styles.emptySubtext}>No notes available</Text> : (selectedOrder.notes || []).map((n, i) => (
                  <View key={i} style={{ marginBottom: 8 }}>
                    <Text style={styles.detailText}>{n.text || JSON.stringify(n)}</Text>
                    <Text style={styles.timelineTime}>{n.at ? new Date(n.at).toLocaleString('en-IN') : ''}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Logs</Text>
                {(selectedOrder.logs || selectedOrder.raw?.logs || []).length === 0 ? <Text style={styles.emptySubtext}>No logs available</Text> : (selectedOrder.logs || selectedOrder.raw?.logs || []).map((log, i) => (
                  <View key={i} style={styles.timelineItem}>
                    <View style={styles.timelineIconContainer}><View style={[styles.timelineIcon, { backgroundColor: '#3B82F6' }]}><MaterialIcons name="history" size={16} color="#fff" /></View></View>
                    <View style={styles.timelineContent}>
                      <Text style={styles.timelineDescription}>{log.action} {log.note ? `— ${log.note}` : ''}</Text>
                      <Text style={styles.timelineTime}>{log.at ? new Date(log.at).toLocaleString('en-IN') : (log._id || '')}</Text>
                      {log.by ? <Text style={[styles.detailText, { marginTop: 4 }]}>By: {log.by}</Text> : null}
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.modalActions}>
                {/* Example action buttons */}
                <TouchableOpacity style={[styles.modalButton, styles.primaryButton]} onPress={() => {
                  // Build items array for fulfill with remaining qtys
                  const items = (selectedOrder.items || []).map(it => ({ product: it.product._id || it.productId || it.product, fulfilledQty: Math.max(0, (it.requestedQty || 0) - (it.fulfilledQty || 0)) }));
                  actOnOrder({ orderId: selectedOrder._id, action: 'fulfill', items, reason: 'Fulfilled from SuperAdmin panel' });
                }}>
                  <Text style={styles.modalButtonText}>Fulfill Remaining</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.modalButton, styles.secondaryButton]} onPress={() => {
                  actOnOrder({ orderId: selectedOrder._id, action: 'reject', items: [], reason: 'Rejected by SuperAdmin' });
                }}>
                  <Text style={[styles.modalButtonText, { color: '#3B82F6' }]}>Reject</Text>
                </TouchableOpacity>
              </View>

              <View style={[styles.modalActions, { marginTop: 0 }]}>
                {selectedOrder.isLocked ? (
                  <TouchableOpacity style={[styles.modalButton, styles.secondaryButton]} onPress={() => releaseOrderLock(selectedOrder._id, 'Released from UI')}>
                    <Text style={[styles.modalButtonText, { color: '#3B82F6' }]}>Release Lock</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.modalButton, styles.primaryButton]} onPress={() => lockOrder(selectedOrder._id)}>
                    <Text style={styles.modalButtonText}>Lock Order</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[styles.modalButton, styles.secondaryButton]} onPress={() => setShowDetailsModal(false)}>
                  <Text style={[styles.modalButtonText, { color: '#3B82F6' }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        ) : (
          <View style={[styles.modalContainer, styles.centered]}>
            <Text style={styles.emptyStateTitle}>No details</Text>
            <TouchableOpacity onPress={() => setShowDetailsModal(false)} style={styles.cancelButton}><Text style={styles.cancelButtonText}>Close</Text></TouchableOpacity>
          </View>
        )}
      </Modal>
    </Animated.View>
  );
}

// Styles (kept from your original file)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollView: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 },
  headerSubtitle: { fontSize: 16, color: '#64748B' },
  exportButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, gap: 6 },
  exportButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  section: { backgroundColor: '#FFFFFF', margin: 16, marginBottom: 0, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1E293B' },
  searchContainer: { marginBottom: 16 },
  searchInputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  searchInput: { flex: 1, fontSize: 16, color: '#1E293B' },
  filterLabel: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 8 },
  filterContainer: { marginBottom: 8 },
  filterButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  filterButtonActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  filterText: { fontSize: 14, color: '#64748B', fontWeight: '600', marginRight: 6 },
  filterTextActive: { color: '#FFFFFF' },
  filterCount: { backgroundColor: '#E2E8F0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  filterCountActive: { backgroundColor: '#1D4ED8' },
  filterCountText: { fontSize: 11, color: '#64748B', fontWeight: '700' },
  ordersList: { gap: 12 },
  orderCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, marginBottom: 12 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderInfo: { flex: 1 },
  orderId: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 2 },
  orderDate: { fontSize: 14, color: '#64748B' },
  statusContainer: { flexDirection: 'row', gap: 6 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  statusText: { fontSize: 11, fontWeight: '700' },
  orderDetails: { gap: 6, marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailText: { fontSize: 13, color: '#64748B' },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountSection: { flex: 1 },
  amountLabel: { fontSize: 12, color: '#64748B', marginBottom: 2 },
  amountValue: { fontSize: 18, fontWeight: 'bold', color: '#1E293B', marginBottom: 2 },
  actionButtons: { flexDirection: 'row', gap: 6 },
  actionButton: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  contactButton: { backgroundColor: '#3B82F6' },
  updateButton: { backgroundColor: '#F59E0B' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyStateTitle: { fontSize: 18, fontWeight: 'bold', color: '#64748B', marginTop: 12, marginBottom: 8 },
  emptyStateText: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
  bottomSpacer: { height: 20 },

  // Modal styles same as earlier
  modalContainer: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1E293B' },
  closeButton: { padding: 4 },
  modalContent: { flex: 1 },
  modalSection: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  orderHeaderModal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  modalOrderId: { fontSize: 24, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 },
  orderDateModal: { fontSize: 16, color: '#64748B' },
  productItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  productInfo: { flex: 1 },
  productName: { fontSize: 16, color: '#1E293B', marginBottom: 2 },
  productQuantity: { fontSize: 14, color: '#64748B' },
  productPrice: { fontSize: 16, fontWeight: '600', color: '#1E293B' },

  timelineItem: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  timelineIconContainer: { alignItems: 'center' },
  timelineIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  timelineContent: { flex: 1 },
  timelineDescription: { fontSize: 16, color: '#1E293B', marginBottom: 4 },
  timelineTime: { fontSize: 14, color: '#64748B' },

  modalActions: { flexDirection: 'row', gap: 12, padding: 20 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  primaryButton: { backgroundColor: '#3B82F6' },
  secondaryButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#3B82F6' },
  modalButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

  centered: { padding: 24, alignItems: 'center' },
  errorBanner: { backgroundColor: '#fee2e2', padding: 12, margin: 16, borderRadius: 8 },
  errorTitle: { color: '#7f1d1d', fontWeight: '800' },
  errorText: { color: '#7f1d1d', marginTop: 6 },
  cancelButton: { backgroundColor: '#F5F5F5', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 8, marginTop: 12 },
  cancelButtonText: { color: '#374151', fontWeight: '700' },
  emptySubtext: { color: '#64748B' },
});
