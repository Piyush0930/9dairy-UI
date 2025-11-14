// app/(tabs)/supadmin/analytics.jsx
import { Feather, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { BarChart, LineChart } from 'react-native-chart-kit';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');
const API_BASE = `${process.env.EXPO_PUBLIC_API_URL || ''}/api`;

const chartConfig = {
  backgroundColor: '#FFFFFF',
  backgroundGradientFrom: '#FFFFFF',
  backgroundGradientTo: '#FFFFFF',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#3B82F6' },
  propsForBackgroundLines: { strokeDasharray: '', stroke: '#E5E7EB', strokeWidth: 1 },
};

function formatYMD(date) {
  // returns YYYY-MM-DD
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function rangeToDates(rangeKey) {
  const now = new Date();
  let start, end;
  end = new Date(now);
  // set end to end of day (for readability we send date only)
  switch (rangeKey) {
    case 'today':
      start = new Date(now);
      break;
    case 'week': {
      // last 7 days including today
      start = new Date(now);
      start.setDate(now.getDate() - 6);
      break;
    }
    case 'month': {
      start = new Date(now);
      start.setMonth(now.getMonth() - 1);
      start.setDate(start.getDate() + 1);
      break;
    }
    case 'quarter': {
      start = new Date(now);
      start.setMonth(now.getMonth() - 3);
      start.setDate(start.getDate() + 1);
      break;
    }
    case 'year': {
      start = new Date(now);
      start.setFullYear(now.getFullYear() - 1);
      start.setDate(start.getDate() + 1);
      break;
    }
    default:
      start = new Date(now);
  }
  return { start: formatYMD(start), end: formatYMD(end) };
}

export default function AnalyticsScreen() {
  const { authToken, isLoading: authLoading, isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [analyticsData, setAnalyticsData] = useState({
    salesReport: { report: [], summary: null },
    retailers: { retailers: [], summary: null },
    customers: { topCustomers: [], customerGrowth: [], summary: null },
  });

  const [dateRange, setDateRange] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [loadingRetailers, setLoadingRetailers] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [error, setError] = useState(null);

  const fadeAnim = useState(new Animated.Value(0))[0];
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const getAuthToken = async () => {
    if (authToken) return authToken;
    try {
      return (await AsyncStorage.getItem('authtoken')) || (await AsyncStorage.getItem('token')) || null;
    } catch (e) {
      console.warn('[analytics] AsyncStorage read failure', e);
      return null;
    }
  };

  const fetchSales = useCallback(async (startDate, endDate) => {
    setLoading(true);
    setError(null);
    try {
      const token = await getAuthToken();
      if (!token) {
        setError('Not authenticated. Please login.');
        setLoading(false);
        return;
      }

      const url = `${API_BASE}/superadmin/reports/sales?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      console.log('[analytics] GET sales', url);
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${txt}`);
      }
      const json = await res.json();
      if (!json || !json.data) throw new Error('Invalid sales response');
      setAnalyticsData(prev => ({ ...prev, salesReport: json.data }));
      console.log('[analytics] sales loaded', json.data.summary || {}, (json.data.report || []).length);
    } catch (err) {
      console.error('[analytics] fetchSales error', err);
      setError(err.message || 'Failed to load sales');
      setAnalyticsData(prev => ({ ...prev, salesReport: { report: [], summary: null } }));
    } finally {
      setLoading(false);
    }
  }, [authToken]);

  const fetchRetailerPerformance = useCallback(async () => {
    setLoadingRetailers(true);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const url = `${API_BASE}/superadmin/reports/retailer-performance?limit=5`;
      console.log('[analytics] GET retailers', url);
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${txt}`);
      }
      const json = await res.json();
      setAnalyticsData(prev => ({ ...prev, retailers: json.data || { retailers: [], summary: null } }));
      console.log('[analytics] retailers loaded', (json.data?.retailers || []).length);
    } catch (err) {
      console.error('[analytics] fetchRetailerPerformance error', err);
      setAnalyticsData(prev => ({ ...prev, retailers: { retailers: [], summary: null } }));
    } finally {
      setLoadingRetailers(false);
    }
  }, [authToken]);

  const fetchCustomerAnalytics = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const token = await getAuthToken();
      if (!token) return;
      const url = `${API_BASE}/superadmin/reports/customer-analytics`;
      console.log('[analytics] GET customers', url);
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }});
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${txt}`);
      }
      const json = await res.json();
      setAnalyticsData(prev => ({ ...prev, customers: json.data || { topCustomers: [], customerGrowth: [], summary: null } }));
      console.log('[analytics] customers loaded', (json.data?.topCustomers || []).length);
    } catch (err) {
      console.error('[analytics] fetchCustomerAnalytics error', err);
      setAnalyticsData(prev => ({ ...prev, customers: { topCustomers: [], customerGrowth: [], summary: null } }));
    } finally {
      setLoadingCustomers(false);
    }
  }, [authToken]);

  // Fetch all (sales + retailers + customers)
  const fetchAll = useCallback(async (rangeKey = dateRange) => {
    setRefreshing(true);
    setError(null);
    const { start, end } = rangeToDates(rangeKey);
    console.log('[analytics] fetchAll', { start, end });

    await Promise.allSettled([
      fetchSales(start, end),
      fetchRetailerPerformance(),
      fetchCustomerAnalytics(),
    ]);

    setRefreshing(false);
  }, [dateRange, fetchSales, fetchRetailerPerformance, fetchCustomerAnalytics]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated && !authToken) {
      setError('Not authenticated');
      return;
    }
    // initial fetch
    fetchAll(dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authToken, isAuthenticated]);

  // When date range changes, re-fetch sales (and other dependent metrics if you want)
  useEffect(() => {
    const { start, end } = rangeToDates(dateRange);
    fetchSales(start, end);
  }, [dateRange, fetchSales]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAll(dateRange);
    setRefreshing(false);
    Alert.alert('✅ Refreshed', 'Analytics updated');
  };

  // Helpers to shape chart data
  const salesReport = analyticsData.salesReport?.report || [];
  const salesLabels = salesReport.map(r => {
    // shorten label to day or date
    const d = new Date(r._id);
    return `${d.getDate()}/${d.getMonth()+1}`;
  });
  const salesRevenueData = salesReport.map(r => Math.round((r.totalRevenue ?? 0) * 100) / 100);
  const salesOrdersData = salesReport.map(r => r.totalOrders ?? 0);

  // UI components
  const MetricCard = ({ title, value, growth, subtitle, color, icon, small }) => (
    <View style={[styles.metricCard, small && { width: (width - 120) / 2 }]}>
      <View style={styles.metricHeader}>
        <View style={styles.metricInfo}>
          <Text style={styles.metricValue}>{value}</Text>
          {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
        </View>
        <View style={[styles.metricIcon, { backgroundColor: color }]}>{icon}</View>
      </View>
      <Text style={styles.metricTitle}>{title}</Text>
      {growth !== undefined && (
        <View style={styles.growthContainer}>
          <MaterialIcons name={growth > 0 ? 'trending-up' : 'trending-down'} size={14} color={growth > 0 ? '#10B981' : '#EF4444'} />
          <Text style={[styles.growthText, { color: growth > 0 ? '#10B981' : '#EF4444' }]}>{growth > 0 ? '+' : ''}{growth}%</Text>
        </View>
      )}
    </View>
  );

  const RevenueChart = () => (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Revenue Trend</Text>
        <Text style={styles.chartSubtitle}>{salesReport.length} data points</Text>
      </View>

      {loading && salesReport.length === 0 ? (
        <View style={{ padding: 20 }}><ActivityIndicator size="large" /></View>
      ) : salesReport.length === 0 ? (
        <View style={{ padding: 20 }}><Text style={{ color: '#64748B' }}>No data for the selected period</Text></View>
      ) : (
        <LineChart
          data={{ labels: salesLabels, datasets: [{ data: salesRevenueData }] }}
          width={Math.min(width - 40, 1000)}
          height={220}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
          withDots
          withShadow={false}
        />
      )}
    </View>
  );

  const OrdersChart = () => (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Orders Trend</Text>
        <Text style={styles.chartSubtitle}>Orders per day</Text>
      </View>

      {loading && salesReport.length === 0 ? (
        <View style={{ padding: 20 }}><ActivityIndicator size="large" /></View>
      ) : salesReport.length === 0 ? (
        <View style={{ padding: 20 }}><Text style={{ color: '#64748B' }}>No data for the selected period</Text></View>
      ) : (
        <BarChart
          data={{ labels: salesLabels, datasets: [{ data: salesOrdersData }] }}
          width={Math.min(width - 40, 1000)}
          height={200}
          chartConfig={{ ...chartConfig, color: (op = 1) => `rgba(16,185,129,${op})` }}
          style={styles.chart}
          fromZero
          showValuesOnTopOfBars
        />
      )}
    </View>
  );

  const TopProducts = () => {
    // There is no topProducts endpoint in this request set; we can re-use retailers/customers summaries if needed
    return null;
  };

  const RetailerPerformance = () => {
    const list = analyticsData.retailers?.retailers || [];
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Retailers</Text>
          <TouchableOpacity onPress={() => fetchRetailerPerformance()}>
            <Text style={styles.seeAllText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loadingRetailers ? <ActivityIndicator /> : list.length === 0 ? (
          <Text style={{ color: '#64748B' }}>No retailer data</Text>
        ) : (
          list.map((r) => (
            <View key={r._id} style={styles.productItem}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{r.retailerName}</Text>
                <Text style={styles.productSales}>{r.totalOrders} orders • ₹{Math.round(r.totalRevenue)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.revenueText}>CR: {r.completionRate}%</Text>
                <View style={styles.growthBadge}><MaterialIcons name="star" size={12} color="#10B981" /><Text style={styles.growthBadgeText}>{Math.round(r.averageOrderValue)}</Text></View>
              </View>
            </View>
          ))
        )}
      </View>
    );
  };

  const CustomerMetrics = () => {
    const top = analyticsData.customers?.topCustomers || [];
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Top Customers</Text>
          <TouchableOpacity onPress={() => fetchCustomerAnalytics()}>
            <Text style={styles.seeAllText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {loadingCustomers ? <ActivityIndicator /> : top.length === 0 ? (
          <Text style={{ color: '#64748B' }}>No customer analytics</Text>
        ) : (
          top.map(c => (
            <View key={c.customerId} style={styles.productItem}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{c.customerName}</Text>
                <Text style={styles.productSales}>{c.totalOrders} orders • ₹{c.totalSpent}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.revenueText}>AOV: ₹{Math.round(c.averageOrderValue)}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    );
  };

  const DateRangeSelector = () => {
    const ranges = [
      { key: 'today', label: 'Today' },
      { key: 'week', label: 'This Week' },
      { key: 'month', label: 'This Month' },
      { key: 'quarter', label: 'This Quarter' },
      { key: 'year', label: 'This Year' },
    ];

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateRangeContainer}>
        {ranges.map(r => (
          <TouchableOpacity key={r.key} style={[styles.dateRangeButton, dateRange === r.key && styles.dateRangeButtonActive]} onPress={() => setDateRange(r.key)}>
            <Text style={[styles.dateRangeText, dateRange === r.key && styles.dateRangeTextActive]}>{r.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const AnalyticsTabs = () => {
    const tabs = [
      { key: 'overview', label: 'Overview', icon: 'dashboard' },
      { key: 'revenue', label: 'Revenue', icon: 'trending-up' },
      { key: 'customers', label: 'Customers', icon: 'people' },
      { key: 'retailers', label: 'Retailers', icon: 'store' },
    ];
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsContainer}>
        {tabs.map(tab => (
          <TouchableOpacity key={tab.key} style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]} onPress={() => setActiveTab(tab.key)}>
            <MaterialIcons name={tab.icon} size={18} color={activeTab === tab.key ? '#3B82F6' : '#64748B'} />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <>
            <RevenueChart />
            <View style={styles.metricsGrid}>
              <MetricCard
                title="Total Revenue"
                value={`₹${analyticsData.salesReport.summary ? Math.round(analyticsData.salesReport.summary.totalRevenue) : '0'}`}
                growth={0}
                subtitle="Selected period"
                color="#3B82F6"
                icon={<FontAwesome5 name="rupee-sign" size={18} color="#fff" />}
                small
              />
              <MetricCard
                title="Total Orders"
                value={`${analyticsData.salesReport.summary ? analyticsData.salesReport.summary.totalOrders : 0}`}
                growth={0}
                subtitle="All orders"
                color="#10B981"
                icon={<Feather name="shopping-bag" size={18} color="#fff" />}
                small
              />
              <MetricCard
                title="Completed Orders"
                value={`${analyticsData.salesReport.summary ? analyticsData.salesReport.summary.completedOrders : 0}`}
                growth={0}
                subtitle="Completed"
                color="#8B5CF6"
                icon={<MaterialIcons name="check-circle" size={20} color="#fff" />}
                small
              />
              <MetricCard
                title="Avg Order Value"
                value={`₹${analyticsData.salesReport.summary ? Math.round(analyticsData.salesReport.summary.averageOrderValue) : 0}`}
                growth={0}
                subtitle="Average"
                color="#F59E0B"
                icon={<MaterialIcons name="attach-money" size={20} color="#fff" />}
                small
              />
            </View>

            <OrdersChart />
            <RetailerPerformance />
            <CustomerMetrics />
          </>
        );

      case 'revenue':
        return (
          <>
            <RevenueChart />
            <OrdersChart />
            {/* Optionally show more revenue breakdowns */}
          </>
        );

      case 'customers':
        return (
          <>
            <CustomerMetrics />
            {/* customer growth chart */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer Growth</Text>
              {analyticsData.customers.customerGrowth?.length ? (
                <LineChart
                  data={{
                    labels: analyticsData.customers.customerGrowth.map(x => x._id),
                    datasets: [{ data: analyticsData.customers.customerGrowth.map(x => x.newCustomers) }]
                  }}
                  width={Math.min(width - 40, 1000)}
                  height={200}
                  chartConfig={chartConfig}
                  style={styles.chart}
                />
              ) : <Text style={{ color: '#64748B' }}>No growth data</Text>}
            </View>
          </>
        );

      case 'retailers':
        return (
          <>
            <RetailerPerformance />
          </>
        );

      default: return null;
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Analytics & Reports</Text>
          <Text style={styles.headerSubtitle}>Platform performance insights</Text>
        </View>
        <TouchableOpacity style={styles.exportButton} onPress={() => {
          const { start, end } = rangeToDates(dateRange);
          Alert.alert('Export', `Export report for ${start} to ${end}?`);
        }}>
          <Feather name="download" size={18} color="#FFFFFF" />
          <Text style={styles.exportButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
      >
        <View style={styles.section}>
          <DateRangeSelector />
        </View>

        <View style={styles.section}>
          <AnalyticsTabs />
        </View>

        <View style={styles.tabContent}>
          {loading && !analyticsData.salesReport.report.length ? (
            <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator /></View>
          ) : (
            renderTabContent()
          )}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* keep most of original styles (copied/adapted from your file) */
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
  seeAllText: { fontSize: 14, color: '#3B82F6', fontWeight: '600' },
  dateRangeContainer: { marginBottom: 8 },
  dateRangeButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  dateRangeButtonActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  dateRangeText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  dateRangeTextActive: { color: '#FFFFFF' },
  tabsContainer: { marginBottom: 8 },
  tabButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginRight: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', gap: 8 },
  tabButtonActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  tabText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },
  tabContent: { gap: 16 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metricCard: { width: (width - 88) / 2, backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  metricHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  metricInfo: { flex: 1 },
  metricValue: { fontSize: 20, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 },
  metricSubtitle: { fontSize: 11, color: '#94A3B8' },
  metricIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  metricTitle: { fontSize: 14, color: '#64748B', fontWeight: '600', marginBottom: 4 },
  growthContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  growthText: { fontSize: 12, fontWeight: '700' },
  chartContainer: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  chartHeader: { marginBottom: 12 },
  chartTitle: { fontSize: 16, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 },
  chartSubtitle: { fontSize: 14, color: '#64748B' },
  chart: { marginVertical: 8, borderRadius: 8 },
  productsList: { gap: 12 },
  productItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F8FAFC', borderRadius: 8, gap: 12 },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginBottom: 2 },
  productSales: { fontSize: 12, color: '#64748B' },
  productRevenue: { alignItems: 'flex-end' },
  revenueText: { fontSize: 14, fontWeight: 'bold', color: '#1E293B', marginBottom: 4 },
  growthBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 4 },
  growthBadgeText: { fontSize: 10, color: '#10B981', fontWeight: '700' },
  retailersList: { gap: 12 },
  retailerItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F8FAFC', borderRadius: 8, justifyContent: 'space-between' },
  retailerInfo: { flex: 1 },
  retailerName: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
  retailerStats: { flexDirection: 'row', gap: 12 },
  retailerStat: { fontSize: 12, color: '#64748B' },
  ratingText: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  bottomSpacer: { height: 20 },
});
