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
  StyleSheet,
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
      <View style={[styles.statusBadge, { backgroundColor: cfg.bgColor }]}>
        <MaterialIcons name={cfg.icon} size={12} color={cfg.color} />
        <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.text}</Text>
      </View>
    );
  };

  const OrderCard = ({ order }) => {
    const handleViewDetails = () => {
      fetchOrderDetails(order.id);
    };

    const totals = calculateOrderTotals(order);

    return (
      <TouchableOpacity style={styles.orderCard} onPress={handleViewDetails} activeOpacity={0.8}>
        {/* Header Section */}
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={styles.orderId}>{order.orderNumber}</Text>
            <Text style={styles.orderDate}>
              {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { 
                day: 'numeric', 
                month: 'short',
                year: 'numeric'
              }) : '—'}
            </Text>
          </View>
          <View style={styles.badgeContainer}>
            <StatusBadge status={order.status} />
            {order.isLocked && <StatusBadge status={'locked'} />}
          </View>
        </View>

        {/* Order Summary */}
        <View style={styles.orderSummary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Items:</Text>
            <Text style={styles.summaryValue}>{order.items?.length || 0}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Amount:</Text>
            <Text style={styles.summaryValue}>₹{totals.total.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Priority:</Text>
            <Text style={[styles.summaryValue, { 
              color: order.priority === 'high' ? '#DC2626' : order.priority === 'low' ? '#10B981' : '#3B82F6',
              fontWeight: '600'
            }]}>
              {order.priority || 'normal'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.viewButton]} 
            onPress={handleViewDetails}
          >
            <Feather name="eye" size={14} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>View Details</Text>
          </TouchableOpacity>

          {order.isLocked ? (
            <TouchableOpacity 
              style={[styles.actionButton, styles.unlockButton]} 
              onPress={() => releaseOrderLock(order.id)}
            >
              <Feather name="unlock" size={14} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Unlock</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.actionButton, styles.lockButton]} 
              onPress={() => lockOrder(order.id)}
            >
              <Feather name="lock" size={14} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Lock</Text>
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
      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {filters.map(filter => (
            <TouchableOpacity 
              key={filter.key} 
              style={[styles.filterButton, filterStatus === filter.key && styles.filterButtonActive]} 
              onPress={() => setFilterStatus(filter.key)}
            >
              <Text style={[styles.filterText, filterStatus === filter.key && styles.filterTextActive]}>
                {filter.label}
              </Text>
              <View style={[styles.filterCount, filterStatus === filter.key && styles.filterCountActive]}>
                <Text style={styles.filterCountText}>{filter.count}</Text>
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
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Order Details</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setShowDetailsModal(false)}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.orderDetailContent}>
            {loadingDetail ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Loading order details...</Text>
              </View>
            ) : (
              <>
                {/* Basic Info */}
                <View style={styles.detailSection}>
                  <View style={styles.detailHeader}>
                    <Text style={styles.detailOrderNumber}>{selectedOrder.orderNumber}</Text>
                    <View style={styles.badgeContainer}>
                      <StatusBadge status={selectedOrder.status} />
                      {selectedOrder.isLocked && <StatusBadge status={'locked'} />}
                    </View>
                  </View>
                  <Text style={styles.detailDate}>
                    Created {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : '—'}
                  </Text>
                  <Text style={styles.detailPriority}>Priority: {selectedOrder.priority || 'normal'}</Text>
                </View>

                {/* Retailer Information */}
                {selectedOrder.retailer && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionTitle}>Retailer Information</Text>
                    <View style={styles.retailerInfo}>
                      <Text style={styles.retailerName}>
                        {selectedOrder.retailer.shopName || selectedOrder.retailer.name || selectedOrder.retailer.ownerName || '—'}
                      </Text>
                      <Text style={styles.retailerContact}>{selectedOrder.retailer.email || selectedOrder.retailer.mobile || ''}</Text>
                    </View>
                  </View>
                )}

                {/* Order Items Table */}
                <View style={styles.detailSection}>
                  <Text style={styles.sectionTitle}>Order Items</Text>
                  <View style={styles.tableContainer}>
                    {/* Table Header */}
                    <View style={styles.tableHeader}>
                      <Text style={[styles.tableHeaderText, styles.tableColProduct]}>Product</Text>
                      <Text style={[styles.tableHeaderText, styles.tableColQty]}>Qty</Text>
                      <Text style={[styles.tableHeaderText, styles.tableColPrice]}>Price</Text>
                      <Text style={[styles.tableHeaderText, styles.tableColTotal]}>Total</Text>
                    </View>
                    
                    {/* Table Rows */}
                    {(selectedOrder.items || []).map((item, index) => (
                      <View key={index} style={styles.tableRow}>
                        <View style={[styles.tableCell, styles.tableColProduct]}>
                          <Text style={styles.productName}>{item.name}</Text>
                          {item.note ? <Text style={styles.productNote}>{item.note}</Text> : null}
                        </View>
                        <View style={[styles.tableCell, styles.tableColQty]}>
                          <Text style={styles.quantityText}>{item.requestedQty}</Text>
                          {item.fulfilledQty > 0 && (
                            <Text style={styles.fulfilledText}>Fulfilled: {item.fulfilledQty}</Text>
                          )}
                        </View>
                        <View style={[styles.tableCell, styles.tableColPrice]}>
                          <Text style={styles.priceText}>₹{item.unitPrice?.toFixed(2)}</Text>
                        </View>
                        <View style={[styles.tableCell, styles.tableColTotal]}>
                          <Text style={styles.totalText}>₹{item.totalPrice?.toFixed(2)}</Text>
                        </View>
                      </View>
                    ))}
                    
                    {/* Table Footer */}
                    <View style={styles.tableFooter}>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Subtotal:</Text>
                        <Text style={styles.totalValue}>₹{totals.subtotal.toFixed(2)}</Text>
                      </View>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total:</Text>
                        <Text style={styles.grandTotal}>₹{totals.total.toFixed(2)}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.fulfillButton]}
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
                    <Text style={styles.modalButtonText}>Fulfill Remaining</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.modalButton, styles.rejectButton]}
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
                    <Text style={styles.modalButtonText}>Reject Order</Text>
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
    <Animated.View style={[styles.container, { opacity: fadeAnim, paddingTop: insets.top }]}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Stock Orders</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
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
        <View style={styles.searchSection}>
          <View style={styles.searchInputContainer}>
            <Feather name="search" size={16} color="#64748B" />
            <TextInput 
              style={styles.searchInput} 
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
        <View style={styles.ordersSection}>
          {loadingList ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Loading orders...</Text>
            </View>
          ) : filteredOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="package" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No orders found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try adjusting your search terms' : `No ${filterStatus === 'all' ? '' : filterStatus} orders found`}
              </Text>
            </View>
          ) : (
            <View style={styles.ordersList}>
              {filteredOrders.map(order => (
                <OrderCard key={order.id} order={order} />
              ))}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Order Details Modal */}
      <OrderDetailModal />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  scrollView: { 
    flex: 1 
  },
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
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  filterScrollContent: {
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 8,
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginRight: 6,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  filterCount: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  filterCountActive: {
    backgroundColor: '#1D4ED8',
  },
  filterCountText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    paddingVertical: 4,
  },
  ordersSection: {
    paddingHorizontal: 20,
  },
  ordersList: {
    gap: 12,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  badgeContainer: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  orderSummary: {
    marginBottom: 16,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  viewButton: {
    backgroundColor: '#3B82F6',
  },
  lockButton: {
    backgroundColor: '#DC2626',
  },
  unlockButton: {
    backgroundColor: '#10B981',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  centered: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 12,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
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
  orderDetailContent: {
    flex: 1,
  },
  detailSection: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginBottom: 0,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailOrderNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  detailDate: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  detailPriority: {
    fontSize: 14,
    color: '#94A3B8',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  retailerInfo: {
    gap: 6,
  },
  retailerName: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '600',
  },
  retailerContact: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  // Table Styles
  tableContainer: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableCell: {
    justifyContent: 'center',
  },
  tableColProduct: {
    flex: 4,
  },
  tableColQty: {
    flex: 2,
    alignItems: 'center',
  },
  tableColPrice: {
    flex: 2,
    alignItems: 'flex-end',
  },
  tableColTotal: {
    flex: 2,
    alignItems: 'flex-end',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  productNote: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  fulfilledText: {
    fontSize: 11,
    color: '#10B981',
    fontWeight: '500',
    marginTop: 2,
  },
  priceText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  totalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  tableFooter: {
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  totalValue: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
  },
  grandTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalActions: {
    padding: 16,
    gap: 12,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    justifyContent: 'center',
  },
  fulfillButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#DC2626',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});