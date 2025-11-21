// app/(tabs)/supadmin/dashboard.jsx
import { Feather, FontAwesome5, Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');
const API_BASE = `${process.env.EXPO_PUBLIC_API_URL || ''}/api`;

export default function SuperAdminDashboard() {
  const { authToken, isLoading: authLoading, isAuthenticated } = useAuth();
  const [timeframe, setTimeframe] = useState('today');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [timeframeModalVisible, setTimeframeModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetailModalVisible, setOrderDetailModalVisible] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fadeAnim = useState(new Animated.Value(0))[0];

  const getAuthToken = async () => {
    if (authToken) return authToken;
    try {
      const fallback = (await AsyncStorage.getItem('authtoken')) || (await AsyncStorage.getItem('token'));
      return fallback || null;
    } catch (e) {
      console.warn('[dashboard] AsyncStorage read error', e);
      return null;
    }
  };

  const mapApiToUi = (data) => {
    const overview = data?.overview || {};
    const orders = overview?.orders || {};

    return {
      platformStats: {
        totalRetailers: overview.retailers?.total ?? 0,
        activeRetailers: overview.retailers?.active ?? 0,
        pendingRetailers: overview.retailers?.pending ?? 0,
        totalCustomers: overview.customers?.total ?? 0,
        newCustomers: overview.customers?.new ?? 0,
        todayOrders: orders.total ?? 0,
        totalRevenue: typeof orders.revenue === 'number' ? orders.revenue : 0,
        avgOrderValue: typeof orders.average === 'number' ? orders.average : 0,
        pendingOrders: orders.pending ?? 0,
        completedOrders: orders.completed ?? 0,
      },
      revenueTrend: Array.isArray(data.revenueTrend) ? data.revenueTrend : [],
      topProducts: Array.isArray(data.topProducts) ? data.topProducts : [],
      recentActivities: Array.isArray(data.recentActivities) ? data.recentActivities : [],
      timeframe: data.timeframe || timeframe,
      generatedAt: data.generatedAt || null,
    };
  };

  const fetchDashboard = useCallback(async (tf = timeframe) => {
    setErrorMsg(null);
    setLoading(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        setErrorMsg('No auth token found. Please login.');
        setDashboardData(null);
        return;
      }

      const url = `${API_BASE}/superadmin/dashboard/overview?timeframe=${encodeURIComponent(tf)}`;
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
      
      if (!json.success || !json.data) {
        throw new Error('Invalid API response: missing success/data');
      }

      const mapped = mapApiToUi(json.data);
      setDashboardData(mapped);
      setErrorMsg(null);

    } catch (err) {
      console.error('[dashboard] fetch error', err);
      setErrorMsg(err.message || 'Failed to fetch dashboard');
      setDashboardData(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken, timeframe]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated && !authToken) {
      setErrorMsg('Not authenticated. Please login.');
      setDashboardData(null);
      setLoading(false);
      return;
    }
    fetchDashboard(timeframe);
  }, [authLoading, authToken, isAuthenticated, timeframe, fetchDashboard]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard(timeframe);
    setRefreshing(false);
  };

  const handleStatCardPress = (type) => {
    switch (type) {
      case 'retailers':
        router.push('/(superadmin)/retailers');
        break;
      case 'customers':
        router.push('/(superadmin)/customers');
        break;
      case 'orders':
        router.push('/(superadmin)/orders');
        break;
      case 'revenue':
        // Could navigate to revenue analytics screen
        console.log('Navigate to revenue analytics');
        break;
      default:
        break;
    }
  };

  const handleOrderPress = (order) => {
    setSelectedOrder(order);
    setOrderDetailModalVisible(true);
  };

  const timeframeOptions = [
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'week' },
    { label: 'This Month', value: 'month' },
    { label: 'This Year', value: 'year' },
  ];

  const StatCard = ({ title, value, subtitle, color, icon, type, fullWidth = false }) => (
    <TouchableOpacity 
      style={[
        styles.statCard, 
        { borderLeftColor: color },
        fullWidth && styles.fullWidthCard
      ]}
      onPress={() => handleStatCardPress(type)}
      activeOpacity={0.7}
    >
      <View style={styles.statContent}>
        <View style={styles.statHeader}>
          <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
            {icon}
          </View>
          <View style={styles.statValues}>
            <Text style={styles.statValue}>
              {value !== null && value !== undefined ? String(value) : '—'}
            </Text>
            {subtitle ? <Text style={styles.statSubtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </TouchableOpacity>
  );

  const ActivityItem = ({ item }) => {
    const formatDate = (dateString) => {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    };

    const displayName = item.customer?.name || item.retailer?.ownerName || 'Unknown';

    return (
      <TouchableOpacity 
        style={styles.activityItem}
        onPress={() => handleOrderPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.activityIcon}>
          <Feather name="shopping-bag" size={20} color="#3B82F6" />
        </View>
        <View style={styles.activityContent}>
          <View style={styles.activityHeader}>
            <Text style={styles.customerName}>{displayName}</Text>
            <Text style={styles.orderAmount}>₹{item.totalAmount?.toFixed(2)}</Text>
          </View>
          
          <View style={styles.orderInfo}>
            <Text style={styles.orderNumber}>Order #{item.orderNumber}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>
                {getStatusText(item.status)}
              </Text>
            </View>
          </View>

          <Text style={styles.activityTime}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const OrderDetailModal = () => {
    if (!selectedOrder) return null;

    return (
      <Modal
        visible={orderDetailModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOrderDetailModalVisible(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Order Details</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setOrderDetailModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.orderDetailContent}>
            <View style={styles.orderHeader}>
              <View>
                <Text style={styles.orderDetailNumber}>
                  Order #{selectedOrder.orderNumber}
                </Text>
                <Text style={styles.orderDetailCustomer}>
                  {selectedOrder.customer?.name || selectedOrder.retailer?.ownerName || 'Unknown'}
                </Text>
                <Text style={styles.orderDetailDate}>
                  {new Date(selectedOrder.createdAt).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>
              <View style={[
                styles.statusBadgeLarge,
                { backgroundColor: getStatusColor(selectedOrder.status) }
              ]}>
                <Text style={styles.statusTextLarge}>
                  {getStatusText(selectedOrder.status)}
                </Text>
              </View>
            </View>

            {/* Bill Table */}
            <View style={styles.billContainer}>
              <View style={styles.billHeader}>
                <Text style={styles.billHeaderText}>Product</Text>
                <Text style={styles.billHeaderText}>Qty</Text>
                <Text style={styles.billHeaderText}>Price</Text>
                <Text style={styles.billHeaderText}>Amount</Text>
              </View>

              {/* Sample order items - you would replace this with actual items from your API */}
              <View style={styles.billItems}>
                <View style={styles.billRow}>
                  <Text style={styles.billItemName}>Fresh Milk</Text>
                  <Text style={styles.billItemQty}>2</Text>
                  <Text style={styles.billItemPrice}>₹30.00</Text>
                  <Text style={styles.billItemTotal}>₹60.00</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billItemName}>Curd</Text>
                  <Text style={styles.billItemQty}>1</Text>
                  <Text style={styles.billItemPrice}>₹40.00</Text>
                  <Text style={styles.billItemTotal}>₹40.00</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billItemName}>Butter</Text>
                  <Text style={styles.billItemQty}>1</Text>
                  <Text style={styles.billItemPrice}>₹50.00</Text>
                  <Text style={styles.billItemTotal}>₹50.00</Text>
                </View>
              </View>

              <View style={styles.billTotal}>
                <Text style={styles.billTotalLabel}>Total Amount</Text>
                <Text style={styles.billTotalValue}>₹{selectedOrder.totalAmount?.toFixed(2)}</Text>
              </View>
            </View>

            {selectedOrder.retailer && (
              <View style={styles.retailerInfo}>
                <Text style={styles.retailerLabel}>Retailer</Text>
                <Text style={styles.retailerName}>{selectedOrder.retailer.shopName}</Text>
                <Text style={styles.retailerOwner}>{selectedOrder.retailer.ownerName}</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const getStatusColor = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('delivered') || s.includes('completed')) return '#10B981';
    if (s.includes('pending') || s.includes('confirmed')) return '#F59E0B';
    if (s.includes('processing') || s.includes('preparing')) return '#3B82F6';
    if (s.includes('cancelled') || s.includes('rejected')) return '#EF4444';
    if (s.includes('out_for_delivery')) return '#8B5CF6';
    return '#6B7280';
  };

  const getStatusText = (status) => {
    if (!status) return 'Pending';
    const s = status.toLowerCase();
    if (s.includes('pending')) return 'Pending';
    if (s.includes('confirmed')) return 'Confirmed';
    if (s.includes('preparing')) return 'Preparing';
    if (s.includes('out_for_delivery')) return 'Out for Delivery';
    if (s.includes('delivered')) return 'Delivered';
    if (s.includes('cancelled')) return 'Cancelled';
    return status;
  };

  const TimeframeDropdown = () => (
    <Modal
      visible={timeframeModalVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setTimeframeModalVisible(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setTimeframeModalVisible(false)}
      >
        <View style={styles.dropdownAnchor}>
          <View style={styles.dropdownContainer}>
            {timeframeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.dropdownItem,
                  timeframe === option.value && styles.dropdownItemActive
                ]}
                onPress={() => {
                  setTimeframe(option.value);
                  setTimeframeModalVisible(false);
                }}
              >
                <Text style={[
                  styles.dropdownItemText,
                  timeframe === option.value && styles.dropdownItemTextActive
                ]}>
                  {option.label}
                </Text>
                {timeframe === option.value && (
                  <Feather name="check" size={16} color="#3B82F6" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, paddingTop: insets.top }]}>
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
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <TouchableOpacity 
              style={styles.timeframeSelector}
              onPress={() => setTimeframeModalVisible(true)}
            >
              <Text style={styles.timeframeText}>
                {timeframeOptions.find(opt => opt.value === timeframe)?.label}
              </Text>
              <Feather name="chevron-down" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Error Banner */}
        {errorMsg && (
          <View style={styles.errorBanner}>
            <View style={styles.errorHeader}>
              <Feather name="alert-triangle" size={20} color="#DC2626" />
              <Text style={styles.errorTitle}>Unable to Load Data</Text>
            </View>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={onRefresh}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Platform Stats */}
        <View style={styles.statsSection}>
          {loading && !dashboardData ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text style={styles.loadingText}>Loading dashboard data...</Text>
            </View>
          ) : !dashboardData ? (
            <View style={styles.emptyState}>
              <Feather name="bar-chart" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Data Available</Text>
              <Text style={styles.emptySubtitle}>
                Dashboard data is not available for the selected timeframe.
              </Text>
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <StatCard
                title="Customers"
                value={dashboardData.platformStats.totalCustomers}
                subtitle={`${dashboardData.platformStats.newCustomers} new`}
                color="#10B981"
                type="customers"
                icon={<MaterialIcons name="people" size={22} color="#10B981" />}
              />
              <StatCard
                title="Today's Orders"
                value={dashboardData.platformStats.todayOrders}
                subtitle={`${dashboardData.platformStats.completedOrders} completed`}
                color="#EF4444"
                type="orders"
                icon={<Feather name="shopping-bag" size={20} color="#EF4444" />}
              />
              <StatCard
                title="Total Revenue"
                value={`₹${dashboardData.platformStats.totalRevenue?.toLocaleString('en-IN') || '0'}`}
                subtitle={`Avg: ₹${Math.round(dashboardData.platformStats.avgOrderValue || 0)}`}
                color="#F59E0B"
                type="revenue"
                fullWidth={true}
                icon={<FontAwesome5 name="rupee-sign" size={18} color="#F59E0B" />}
              />
            </View>
          )}
        </View>

        {/* Recent Activities Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
            <TouchableOpacity 
              style={styles.seeAllButton}
              onPress={() => router.push('/(superadmin)/orders')}
            >
              <Text style={styles.seeAllText}>View All</Text>
              <Feather name="chevron-right" size={16} color="#3B82F6" />
            </TouchableOpacity>
          </View>

          {dashboardData && dashboardData.recentActivities.length > 0 ? (
            <View style={styles.activitiesList}>
              {dashboardData.recentActivities.slice(0, 4).map((activity, index) => (
                <ActivityItem 
                  key={activity._id || activity.orderNumber || index} 
                  item={activity} 
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Feather name="activity" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No Recent Activity</Text>
              <Text style={styles.emptySubtitle}>
                There are no recent activities for the selected timeframe.
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Timeframe Dropdown Modal */}
      <TimeframeDropdown />

      {/* Order Detail Modal */}
      <OrderDetailModal />

      {/* Floating Refresh Indicator */}
      {loading && (
        <View style={styles.floatingLoader}>
          <ActivityIndicator size="small" color="#3B82F6" />
        </View>
      )}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  timeframeSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  timeframeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  statsSection: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: (width - 56) / 2,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  fullWidthCard: {
    width: width - 32,
  },
  statContent: {
    flex: 1,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValues: {
    alignItems: 'flex-end',
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
    textAlign: 'right',
  },
  statSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'right',
  },
  statTitle: {
    fontSize: 15,
    color: '#64748B',
    fontWeight: '600',
  },
  section: {
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
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
  activitiesList: {
    marginTop: 8,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3B82F6',
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  orderNumber: {
    fontSize: 14,
    color: '#64748B',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  activityTime: {
    fontSize: 12,
    color: '#94A3B8',
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
  errorBanner: {
    backgroundColor: '#FEF2F2',
    padding: 16,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  errorTitle: {
    color: '#DC2626',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  dropdownAnchor: {
    position: 'absolute',
    top: 80,
    right: 20,
    alignItems: 'flex-end',
  },
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    width: 160,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dropdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dropdownItemActive: {
    backgroundColor: '#F1F5F9',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  dropdownItemTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  floatingLoader: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // Order Detail Modal Styles
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
    padding: 20,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  orderDetailNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  orderDetailCustomer: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10B981',
    marginBottom: 4,
  },
  orderDetailDate: {
    fontSize: 14,
    color: '#64748B',
  },
  statusBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusTextLarge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  billContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 24,
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
    flex: 1,
    textAlign: 'center',
  },
  billItems: {
    paddingVertical: 8,
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
    textAlign: 'left',
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
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  retailerInfo: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  retailerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  retailerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  retailerOwner: {
    fontSize: 14,
    color: '#64748B',
  },
});