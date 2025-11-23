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
      className={`bg-white p-5 rounded-xl mb-3 shadow border-l-4 ${fullWidth ? 'w-full' : 'w-1/2'}`}
      style={{ borderLeftColor: color, width: fullWidth ? width - 32 : (width - 56) / 2 }}
      onPress={() => handleStatCardPress(type)}
      activeOpacity={0.7}
    >
      <View className="flex-1">
        <View className="flex-row justify-between items-start mb-3">
          <View className={`w-12 h-12 rounded-xl justify-center items-center`} style={{ backgroundColor: color + '20' }}>
            {icon}
          </View>
          <View className="items-end flex-1">
            <Text className="text-2xl font-bold text-gray-800 mb-1 text-right">
              {value !== null && value !== undefined ? String(value) : '—'}
            </Text>
            {subtitle ? <Text className="text-sm text-gray-500 font-medium text-right">{subtitle}</Text> : null}
          </View>
        </View>
        <Text className="text-sm text-gray-500 font-semibold">{title}</Text>
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
        className="flex-row items-start py-4 border-b border-gray-100"
        onPress={() => handleOrderPress(item)}
        activeOpacity={0.7}
      >
        <View className="w-11 h-11 rounded-xl bg-gray-100 justify-center items-center mr-3">
          <Feather name="shopping-bag" size={20} color="#3B82F6" />
        </View>
        <View className="flex-1">
          <View className="flex-row justify-between items-start mb-2">
            <Text className="text-base font-semibold text-gray-800 flex-1">{displayName}</Text>
            <Text className="text-base font-bold text-blue-500">₹{item.totalAmount?.toFixed(2)}</Text>
          </View>
          
          <View className="flex-row justify-between items-center mb-1.5">
            <Text className="text-sm text-gray-500 flex-1">Order #{item.orderNumber}</Text>
            <View className="px-2 py-1 rounded" style={{ backgroundColor: getStatusColor(item.status) }}>
              <Text className="text-2.75 font-semibold text-white">
                {getStatusText(item.status)}
              </Text>
            </View>
          </View>

          <Text className="text-xs text-gray-400">
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
        <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
          <View className="flex-row justify-between items-center px-5 py-4 bg-white border-b border-gray-200">
            <Text className="text-xl font-bold text-gray-800">Order Details</Text>
            <TouchableOpacity 
              className="p-1"
              onPress={() => setOrderDetailModalVisible(false)}
            >
              <Ionicons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 p-5">
            <View className="flex-row justify-between items-start mb-6">
              <View className="flex-1">
                <Text className="text-lg font-bold text-gray-800 mb-1">
                  Order #{selectedOrder.orderNumber}
                </Text>
                <Text className="text-base font-semibold text-green-500 mb-1">
                  {selectedOrder.customer?.name || selectedOrder.retailer?.ownerName || 'Unknown'}
                </Text>
                <Text className="text-sm text-gray-500">
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
              <View className="px-3 py-1.5 rounded-lg" style={{ backgroundColor: getStatusColor(selectedOrder.status) }}>
                <Text className="text-xs font-semibold text-white">
                  {getStatusText(selectedOrder.status)}
                </Text>
              </View>
            </View>

            {/* Bill Table */}
            <View className="bg-white rounded-xl border border-gray-200 mb-6 overflow-hidden">
              <View className="flex-row bg-gray-50 px-4 py-3 border-b border-gray-200">
                <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex-1 text-center">Product</Text>
                <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex-1 text-center">Qty</Text>
                <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex-1 text-center">Price</Text>
                <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex-1 text-right">Amount</Text>
              </View>

              {/* Sample order items - you would replace this with actual items from your API */}
              <View className="py-2">
                <View className="flex-row px-4 py-3 border-b border-gray-50">
                  <Text className="text-sm font-medium text-gray-800 flex-2 text-left">Fresh Milk</Text>
                  <Text className="text-sm font-medium text-gray-500 flex-1 text-center">2</Text>
                  <Text className="text-sm font-medium text-gray-500 flex-1 text-center">₹30.00</Text>
                  <Text className="text-sm font-semibold text-gray-800 flex-1 text-right">₹60.00</Text>
                </View>
                <View className="flex-row px-4 py-3 border-b border-gray-50">
                  <Text className="text-sm font-medium text-gray-800 flex-2 text-left">Curd</Text>
                  <Text className="text-sm font-medium text-gray-500 flex-1 text-center">1</Text>
                  <Text className="text-sm font-medium text-gray-500 flex-1 text-center">₹40.00</Text>
                  <Text className="text-sm font-semibold text-gray-800 flex-1 text-right">₹40.00</Text>
                </View>
                <View className="flex-row px-4 py-3">
                  <Text className="text-sm font-medium text-gray-800 flex-2 text-left">Butter</Text>
                  <Text className="text-sm font-medium text-gray-500 flex-1 text-center">1</Text>
                  <Text className="text-sm font-medium text-gray-500 flex-1 text-center">₹50.00</Text>
                  <Text className="text-sm font-semibold text-gray-800 flex-1 text-right">₹50.00</Text>
                </View>
              </View>

              <View className="flex-row justify-between items-center px-4 py-4 bg-gray-50 border-t-2 border-gray-200">
                <Text className="text-base font-semibold text-gray-800">Total Amount</Text>
                <Text className="text-lg font-bold text-blue-500">₹{selectedOrder.totalAmount?.toFixed(2)}</Text>
              </View>
            </View>

            {selectedOrder.retailer && (
              <View className="bg-white p-4 rounded-xl border border-gray-200">
                <Text className="text-sm font-semibold text-gray-500 mb-1">Retailer</Text>
                <Text className="text-base font-semibold text-gray-800 mb-0.5">{selectedOrder.retailer.shopName}</Text>
                <Text className="text-sm text-gray-500">{selectedOrder.retailer.ownerName}</Text>
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
        className="flex-1 bg-black/30"
        activeOpacity={1}
        onPress={() => setTimeframeModalVisible(false)}
      >
        <View className="absolute top-20 right-5 items-end">
          <View className="bg-white rounded-xl p-2 w-40 shadow-lg border border-gray-200">
            {timeframeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                className={`flex-row justify-between items-center px-4 py-3 rounded-lg ${
                  timeframe === option.value ? 'bg-gray-50' : ''
                }`}
                onPress={() => {
                  setTimeframe(option.value);
                  setTimeframeModalVisible(false);
                }}
              >
                <Text className={`text-base ${
                  timeframe === option.value ? 'text-blue-500 font-semibold' : 'text-gray-500 font-medium'
                }`}>
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
    <Animated.View className="flex-1 bg-gray-50" style={{ opacity: fadeAnim, paddingTop: insets.top }}>
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
        {/* Header Section */}
        <View className="px-5 py-4 bg-white border-b border-gray-200">
          <View className="flex-row justify-between items-center">
            <Text className="text-2xl font-bold text-gray-800">Dashboard</Text>
            <TouchableOpacity 
              className="flex-row items-center bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 gap-2"
              onPress={() => setTimeframeModalVisible(true)}
            >
              <Text className="text-sm font-semibold text-gray-500">
                {timeframeOptions.find(opt => opt.value === timeframe)?.label}
              </Text>
              <Feather name="chevron-down" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Error Banner */}
        {errorMsg && (
          <View className="bg-red-50 p-4 m-4 rounded-xl border border-red-200">
            <View className="flex-row items-center gap-2 mb-2">
              <Feather name="alert-triangle" size={20} color="#DC2626" />
              <Text className="text-red-600 text-base font-semibold">Unable to Load Data</Text>
            </View>
            <Text className="text-red-600 text-sm leading-5 mb-3">{errorMsg}</Text>
            <TouchableOpacity 
              className="bg-red-600 px-4 py-2 rounded-lg self-start"
              onPress={onRefresh}
            >
              <Text className="text-white text-sm font-semibold">Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Platform Stats */}
        <View className="p-4">
          {loading && !dashboardData ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="text-sm text-gray-500 mt-3 text-center">Loading dashboard data...</Text>
            </View>
          ) : !dashboardData ? (
            <View className="py-10 items-center">
              <Feather name="bar-chart" size={48} color="#CBD5E1" />
              <Text className="text-base font-semibold text-gray-500 mt-3 text-center">No Data Available</Text>
              <Text className="text-sm text-gray-400 mt-1.5 text-center leading-5">
                Dashboard data is not available for the selected timeframe.
              </Text>
            </View>
          ) : (
            <View className="flex-row flex-wrap gap-3">
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
        <View className="bg-white m-4 rounded-xl p-5 shadow border border-gray-50">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-xl font-bold text-gray-800">Recent Activities</Text>
            <TouchableOpacity 
              className="flex-row items-center gap-1"
              onPress={() => router.push('/(superadmin)/orders')}
            >
              <Text className="text-blue-500 text-sm font-semibold">View All</Text>
              <Feather name="chevron-right" size={16} color="#3B82F6" />
            </TouchableOpacity>
          </View>

          {dashboardData && dashboardData.recentActivities.length > 0 ? (
            <View className="mt-2">
              {dashboardData.recentActivities.slice(0, 4).map((activity, index) => (
                <ActivityItem 
                  key={activity._id || activity.orderNumber || index} 
                  item={activity} 
                />
              ))}
            </View>
          ) : (
            <View className="py-10 items-center">
              <Feather name="activity" size={48} color="#CBD5E1" />
              <Text className="text-base font-semibold text-gray-500 mt-3 text-center">No Recent Activity</Text>
              <Text className="text-sm text-gray-400 mt-1.5 text-center leading-5">
                There are no recent activities for the selected timeframe.
              </Text>
            </View>
          )}
        </View>

        <View className="h-10" />
      </ScrollView>

      {/* Timeframe Dropdown Modal */}
      <TimeframeDropdown />

      {/* Order Detail Modal */}
      <OrderDetailModal />

      {/* Floating Refresh Indicator */}
      {loading && (
        <View className="absolute right-5 bottom-5 bg-white p-3 rounded-xl shadow">
          <ActivityIndicator size="small" color="#3B82F6" />
        </View>
      )}
    </Animated.View>
  );
}