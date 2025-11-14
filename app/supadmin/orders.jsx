// app/(tabs)/supadmin/orders.jsx
import { Feather, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
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
const API_BASE = `${process.env.EXPO_PUBLIC_API_URL || ''}/api`; // e.g. http://<host>:5000

export default function OrdersScreen() {
  // top-level hook usage
  const { authToken, isLoading: authLoading, isAuthenticated } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [ordersData, setOrdersData] = useState(null); // will be { orders: [...], total: n } or null
  const [selectedOrder, setSelectedOrder] = useState(null); // detailed order object
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all'); // may be unused for stock-orders but kept
  const [errorMsg, setErrorMsg] = useState(null);
  const router = useRouter();
  const fadeAnim = useState(new Animated.Value(0))[0];

  // fallback token getter (does NOT call hooks)
  const getAuthToken = async () => {
    if (authToken) return authToken;
    try {
      const fallback = (await AsyncStorage.getItem('authtoken')) || (await AsyncStorage.getItem('token'));
      return fallback || null;
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
    console.log('[orders] fetchOrders start', { API_BASE });

    try {
      const token = await getAuthToken();
      if (!token) {
        setErrorMsg('No auth token found. Please login.');
        setOrdersData(null);
        return;
      }

      const url = `${API_BASE}/superadmin/stock-orders`;
      console.log('[orders] GET', url);

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // change to `Authorization: token` if your backend expects raw token
        },
      });

      console.log('[orders] list status', res.status);
      if (!res.ok) {
        const txt = await res.text().catch(() => 'no-text');
        throw new Error(`HTTP ${res.status} - ${txt}`);
      }

      const json = await res.json();
      // expected: { orders: [...], total: N }
      if (!json || !Array.isArray(json.orders)) {
        throw new Error('Invalid response format from orders API');
      }

      // Map API shape into UI shape used elsewhere (keep original property names where possible)
      const mappedOrders = json.orders.map(o => ({
        id: o._id,
        orderNumber: o.orderNumber || o._id,
        status: o.status || 'unknown',
        isLocked: !!o.isLocked,
        totalRequestedQty: o.totalRequestedQty ?? 0,
        totalFulfilledQty: o.totalFulfilledQty ?? 0,
        priority: o.priority || 'normal',
        createdAt: o.createdAt,
        updatedAt: o.updatedAt,
        items: Array.isArray(o.items) ? o.items.map(it => ({
          productId: it.product?._id || it.product?.id || null,
          name: it.product?.name || 'Unknown product',
          requestedQty: it.requestedQty ?? 0,
          fulfilledQty: it.fulfilledQty ?? 0,
          reservedQty: it.reservedQty ?? 0,
          note: it.note || '',
        })) : [],
        raw: o, // preserve raw response for details if needed
      }));

      setOrdersData({ orders: mappedOrders, total: json.total ?? mappedOrders.length });
      setErrorMsg(null);
      console.log('[orders] loaded', mappedOrders.length, 'orders');
    } catch (err) {
      console.error('[orders] fetchOrders error', err);
      setErrorMsg(err.message || 'Failed to load orders');
      setOrdersData(null);
    } finally {
      setLoadingList(false);
      setRefreshing(false);
    }
  }, [authToken]);

  // Fetch single order details
  const fetchOrderDetails = useCallback(async (orderId) => {
    setErrorMsg(null);
    setLoadingDetail(true);
    console.log('[orders] fetchOrderDetails', orderId);

    try {
      const token = await getAuthToken();
      if (!token) {
        setErrorMsg('No auth token found. Please login.');
        return;
      }

      const url = `${API_BASE}/superadmin/stock-orders/${encodeURIComponent(orderId)}`;
      console.log('[orders] GET detail', url);

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => 'no-text');
        throw new Error(`HTTP ${res.status} - ${txt}`);
      }

      const json = await res.json();
      // API returns an order object (per example)
      if (!json || !json._id) {
        // some APIs wrap in { order: {...} } — handle both:
        if (json.order && json.order._id) {
          setSelectedOrder(json.order);
          setShowDetailsModal(true);
          return;
        }
        throw new Error('Invalid order detail response');
      }

      setSelectedOrder(json);
      setShowDetailsModal(true);
      console.log('[orders] detail loaded', json._id);
    } catch (err) {
      console.error('[orders] fetchOrderDetails error', err);
      setErrorMsg(err.message || 'Failed to load order details');
      Alert.alert('Error', err.message || 'Failed to load order details');
    } finally {
      setLoadingDetail(false);
    }
  }, [authToken]);

  // initial fetch when auth is ready
  useEffect(() => {
    if (authLoading) {
      console.log('[orders] waiting for auth to finish');
      return;
    }
    if (!isAuthenticated && !authToken) {
      setErrorMsg('Not authenticated. Please login.');
      setOrdersData(null);
      setLoadingList(false);
      return;
    }

    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authToken, isAuthenticated]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
    setRefreshing(false);
    Alert.alert('✅ Refreshed', 'Orders list updated');
  };

  // Filter logic (works on mapped orders)
  const filteredOrders = (ordersData?.orders || []).filter(order => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (order.orderNumber || '').toLowerCase().includes(q) ||
      (order.items?.[0]?.name || '').toLowerCase().includes(q);

    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    // payment filter may not apply to stock-orders; keep as passthrough
    const matchesPayment = filterPayment === 'all' || true;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  // UI small components reuse your style names
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
                {order.createdAt ? new Date(order.createdAt).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                }) : '—'}
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
              <TouchableOpacity style={[styles.actionButton, styles.contactButton]} onPress={() => {
                Alert.alert('Inspect Order', `Open details for ${order.orderNumber}`, [{ text: 'OK' }]);
              }}>
                <Feather name="eye" size={14} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.updateButton]} onPress={() => {
                // example quick action: lock/unlock - implement API call if available
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

  // StatusFilter uses counts from ordersData where possible
  const StatusFilter = () => {
    const counts = (ordersData?.orders || []).reduce((acc, o) => {
      acc[o.status] = (acc[o.status] || 0) + 1;
      return acc;
    }, {});
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
          <TouchableOpacity
            key={filter.key}
            style={[styles.filterButton, filterStatus === filter.key && styles.filterButtonActive]}
            onPress={() => setFilterStatus(filter.key)}
          >
            <Text style={[styles.filterText, filterStatus === filter.key && styles.filterTextActive]}>{filter.label}</Text>
            <View style={[styles.filterCount, filterStatus === filter.key && styles.filterCountActive]}>
              <Text style={styles.filterCountText}>{filter.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // Render
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

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing || loadingList} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Orders Overview</Text>
            <TouchableOpacity onPress={fetchOrders}><MaterialIcons name="refresh" size={20} color="#3B82F6" /></TouchableOpacity>
          </View>

          {loadingList && !ordersData ? (
            <View style={styles.centered}><ActivityIndicator size="large" /></View>
          ) : (!ordersData ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No orders available</Text>
              <Text style={styles.emptyStateText}>No stock orders were returned by the server.</Text>
            </View>
          ) : (
            <>
              <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                  <Feather name="search" size={20} color="#64748B" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search orders by number or product..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholderTextColor="#94A3B8"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                      <MaterialIcons name="clear" size={20} color="#64748B" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <Text style={styles.filterLabel}>Status</Text>
              <StatusFilter />

              <View style={styles.ordersList}>
                {filteredOrders.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Feather name="package" size={48} color="#E2E8F0" />
                    <Text style={styles.emptyStateTitle}>No orders match filters</Text>
                    <Text style={styles.emptyStateText}>Try clearing filters or refreshing the list.</Text>
                  </View>
                ) : (
                  filteredOrders.map(order => <OrderCard key={order.id} order={order} />)
                )}
              </View>
            </>
          ))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Order Details Modal */}
      <Modal visible={showDetailsModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowDetailsModal(false)}>
        {loadingDetail && !selectedOrder ? (
          <View style={[styles.modalContainer, styles.centered]}><ActivityIndicator size="large" /></View>
        ) : selectedOrder ? (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedOrder.orderNumber || selectedOrder.orderId || selectedOrder._id}</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowDetailsModal(false)}>
                <MaterialIcons name="close" size={24} color="#000" />
              </TouchableOpacity>
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
                <Text style={styles.orderDateModal}>
                  Created {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString('en-IN') : '—'}
                </Text>
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Items</Text>
                {(selectedOrder.items || []).map((it, idx) => (
                  <View key={idx} style={styles.productItem}>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{it.name}</Text>
                      <Text style={styles.productQuantity}>Requested: {it.requestedQty} • Fulfilled: {it.fulfilledQty}</Text>
                    </View>
                    <Text style={styles.productPrice}>ID: {it.productId || '—'}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Logs</Text>
                {(selectedOrder.logs || selectedOrder.raw?.logs || []).length === 0 ? (
                  <Text style={styles.emptySubtext}>No logs available</Text>
                ) : (
                  (selectedOrder.logs || selectedOrder.raw?.logs || []).map((log, i) => (
                    <View key={i} style={styles.timelineItem}>
                      <View style={styles.timelineIconContainer}>
                        <View style={[styles.timelineIcon, { backgroundColor: '#3B82F6' }]}><MaterialIcons name="history" size={16} color="#fff" /></View>
                      </View>
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineDescription}>{log.action} {log.note ? `— ${log.note}` : ''}</Text>
                        <Text style={styles.timelineTime}>{log.at ? new Date(log.at).toLocaleString('en-IN') : (log._id || '')}</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalButton, styles.primaryButton]} onPress={() => {
                  Alert.alert('Action', 'Implement status update API call here.');
                }}>
                  <Text style={styles.modalButtonText}>Update Status</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.secondaryButton]} onPress={() => {
                  setShowDetailsModal(false);
                }}>
                  <Text style={[styles.modalButtonText, { color: '#3B82F6' }]}>Close</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        ) : (
          <View style={[styles.modalContainer, styles.centered]}>
            <Text style={styles.emptyStateTitle}>No details</Text>
            <TouchableOpacity onPress={() => setShowDetailsModal(false)} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    </Animated.View>
  );
}

// Styles (kept from your original file for compatibility)
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

  // Modal styles
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
});
