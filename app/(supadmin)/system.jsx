// app/(tabs)/supadmin/analytics.jsx
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Alert,
  Animated,
} from 'react-native';
import { MaterialIcons, FontAwesome5, Ionicons, Feather, Octicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Mock analytics data
const MOCK_ANALYTICS = {
  overview: {
    totalRevenue: 2540000,
    revenueGrowth: 22,
    totalOrders: 1567,
    orderGrowth: 15,
    activeCustomers: 11200,
    customerGrowth: 8,
    avgOrderValue: 285,
    aovGrowth: 12,
  },
  revenueData: {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    values: [1200000, 1350000, 1420000, 1560000, 1680000, 1850000, 1920000, 2100000, 2250000, 2380000, 2450000, 2540000],
  },
  orderData: {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    values: [45, 52, 38, 74, 65, 89, 76],
  },
  customerMetrics: {
    newCustomers: 234,
    returningCustomers: 856,
    churnRate: 4.2,
    retentionRate: 95.8,
    customerLifetimeValue: 2450,
  },
  topProducts: [
    { name: 'Buffalo Milk', sales: 1245, revenue: 99600, growth: 15 },
    { name: 'Fresh Curd', sales: 856, revenue: 34240, growth: 12 },
    { name: 'Cow Milk', sales: 734, revenue: 44040, growth: 8 },
    { name: 'Paneer', sales: 456, revenue: 54720, growth: 25 },
    { name: 'White Butter', sales: 389, revenue: 42790, growth: 18 },
  ],
  retailerPerformance: [
    { name: 'Fresh Dairy Mart', orders: 1234, revenue: 345000, rating: 4.8 },
    { name: 'Dairy King', orders: 876, revenue: 189000, rating: 4.5 },
    { name: 'Milk & More', orders: 654, revenue: 143000, rating: 4.2 },
    { name: 'Pure Milk Center', orders: 432, revenue: 95000, rating: 3.9 },
    { name: 'Farm Fresh Dairy', orders: 321, revenue: 70500, rating: 4.1 },
  ],
  platformMetrics: {
    avgResponseTime: '120ms',
    successRate: '99.2%',
    uptime: '99.9%',
    loadTime: '2.1s',
  }
};

export default function AnalyticsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(MOCK_ANALYTICS);
  const [dateRange, setDateRange] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => {
      setAnalyticsData(MOCK_ANALYTICS);
      setRefreshing(false);
      Alert.alert('✅ Refreshed', 'Analytics data updated');
    }, 1500);
  };

  const handleExport = (type) => {
    Alert.alert('Export Data', `Export ${type} report?`, [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Export', 
        onPress: () => console.log(`Exporting ${type} report`)
      }
    ]);
  };

  // Custom Bar Chart Component
  const BarChart = ({ data, color = '#3B82F6' }) => {
    const maxValue = Math.max(...data.values);
    
    return (
      <View style={styles.barChartContainer}>
        <View style={styles.barChart}>
          {data.values.map((value, index) => (
            <View key={index} style={styles.barColumn}>
              <View style={styles.barWrapper}>
                <View 
                  style={[
                    styles.bar,
                    { 
                      height: `${(value / maxValue) * 80}%`,
                      backgroundColor: color
                    }
                  ]} 
                />
              </View>
              <Text style={styles.barLabel}>{data.labels[index]}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Custom Line Chart Component
  const LineChart = ({ data, color = '#3B82F6' }) => {
    const maxValue = Math.max(...data.values);
    const minValue = Math.min(...data.values);
    
    return (
      <View style={styles.lineChartContainer}>
        <View style={styles.lineChart}>
          {data.values.map((value, index) => (
            <View key={index} style={styles.linePoint}>
              <View 
                style={[
                  styles.lineDot,
                  { backgroundColor: color }
                ]} 
              />
              {index < data.values.length - 1 && (
                <View 
                  style={[
                    styles.lineConnector,
                    { 
                      height: 2,
                      backgroundColor: color,
                      opacity: 0.6
                    }
                  ]} 
                />
              )}
            </View>
          ))}
        </View>
        <View style={styles.lineLabels}>
          {data.labels.map((label, index) => (
            <Text key={index} style={styles.lineLabel}>{label}</Text>
          ))}
        </View>
      </View>
    );
  };

  // Metric Card Component
  const MetricCard = ({ title, value, growth, subtitle, color, icon }) => {
    return (
      <View style={styles.metricCard}>
        <View style={styles.metricHeader}>
          <View style={styles.metricInfo}>
            <Text style={styles.metricValue}>{value}</Text>
            {growth && (
              <View style={styles.growthContainer}>
                <MaterialIcons 
                  name={growth > 0 ? "trending-up" : "trending-down"} 
                  size={16} 
                  color={growth > 0 ? '#10B981' : '#EF4444'} 
                />
                <Text style={[
                  styles.growthText, 
                  { color: growth > 0 ? '#10B981' : '#EF4444' }
                ]}>
                  {growth > 0 ? '+' : ''}{growth}%
                </Text>
              </View>
            )}
          </View>
          <View style={[styles.metricIcon, { backgroundColor: color }]}>
            {icon}
          </View>
        </View>
        <Text style={styles.metricTitle}>{title}</Text>
        {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
      </View>
    );
  };

  // Revenue Chart Component
  const RevenueChart = () => (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Revenue Trend</Text>
        <Text style={styles.chartSubtitle}>Last 12 months</Text>
      </View>
      <LineChart data={analyticsData.revenueData} color="#3B82F6" />
      <View style={styles.chartStats}>
        <Text style={styles.chartStat}>
          Highest: ₹{(Math.max(...analyticsData.revenueData.values) / 1000000).toFixed(1)}M
        </Text>
        <Text style={styles.chartStat}>
          Growth: +{analyticsData.overview.revenueGrowth}%
        </Text>
      </View>
    </View>
  );

  // Orders Chart Component
  const OrdersChart = () => (
    <View style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>Weekly Orders</Text>
        <Text style={styles.chartSubtitle}>Current week</Text>
      </View>
      <BarChart data={analyticsData.orderData} color="#10B981" />
      <View style={styles.chartStats}>
        <Text style={styles.chartStat}>
          Peak: {Math.max(...analyticsData.orderData.values)} orders
        </Text>
        <Text style={styles.chartStat}>
          Total: {analyticsData.orderData.values.reduce((a, b) => a + b, 0)} orders
        </Text>
      </View>
    </View>
  );

  // Top Products Component
  const TopProducts = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Top Products</Text>
        <TouchableOpacity onPress={() => handleExport('products')}>
          <Text style={styles.seeAllText}>Export</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.productsList}>
        {analyticsData.topProducts.map((product, index) => (
          <View key={product.name} style={styles.productItem}>
            <View style={styles.productRank}>
              <Text style={styles.rankText}>#{index + 1}</Text>
            </View>
            <View style={styles.productInfo}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productSales}>{product.sales} units sold</Text>
            </View>
            <View style={styles.productRevenue}>
              <Text style={styles.revenueText}>₹{(product.revenue / 1000).toFixed(0)}K</Text>
              <View style={styles.growthBadge}>
                <MaterialIcons name="trending-up" size={12} color="#10B981" />
                <Text style={styles.growthBadgeText}>+{product.growth}%</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  // Retailer Performance Component
  const RetailerPerformance = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Top Retailers</Text>
        <TouchableOpacity onPress={() => handleExport('retailers')}>
          <Text style={styles.seeAllText}>Export</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.retailersList}>
        {analyticsData.retailerPerformance.map((retailer, index) => (
          <View key={retailer.name} style={styles.retailerItem}>
            <View style={styles.retailerInfo}>
              <Text style={styles.retailerName}>{retailer.name}</Text>
              <View style={styles.retailerStats}>
                <Text style={styles.retailerStat}>{retailer.orders} orders</Text>
                <Text style={styles.retailerStat}>₹{(retailer.revenue / 1000).toFixed(0)}K revenue</Text>
              </View>
            </View>
            <View style={styles.retailerRating}>
              <MaterialIcons name="star" size={16} color="#F59E0B" />
              <Text style={styles.ratingText}>{retailer.rating}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );

  // Customer Metrics Component
  const CustomerMetrics = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Customer Insights</Text>
      <View style={styles.metricsGrid}>
        <View style={styles.customerMetric}>
          <Text style={styles.metricValue}>{analyticsData.customerMetrics.newCustomers}</Text>
          <Text style={styles.metricLabel}>New Customers</Text>
        </View>
        <View style={styles.customerMetric}>
          <Text style={styles.metricValue}>{analyticsData.customerMetrics.returningCustomers}</Text>
          <Text style={styles.metricLabel}>Returning</Text>
        </View>
        <View style={styles.customerMetric}>
          <Text style={styles.metricValue}>{analyticsData.customerMetrics.retentionRate}%</Text>
          <Text style={styles.metricLabel}>Retention Rate</Text>
        </View>
        <View style={styles.customerMetric}>
          <Text style={styles.metricValue}>₹{analyticsData.customerMetrics.customerLifetimeValue}</Text>
          <Text style={styles.metricLabel}>CLV</Text>
        </View>
      </View>
    </View>
  );

  // Platform Metrics Component
  const PlatformMetrics = () => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Platform Performance</Text>
      <View style={styles.platformMetrics}>
        <View style={styles.platformMetric}>
          <Ionicons name="speedometer" size={20} color="#3B82F6" />
          <View style={styles.platformMetricInfo}>
            <Text style={styles.platformMetricValue}>{analyticsData.platformMetrics.avgResponseTime}</Text>
            <Text style={styles.platformMetricLabel}>Avg Response Time</Text>
          </View>
        </View>
        <View style={styles.platformMetric}>
          <MaterialIcons name="check-circle" size={20} color="#10B981" />
          <View style={styles.platformMetricInfo}>
            <Text style={styles.platformMetricValue}>{analyticsData.platformMetrics.successRate}</Text>
            <Text style={styles.platformMetricLabel}>Success Rate</Text>
          </View>
        </View>
        <View style={styles.platformMetric}>
          <MaterialIcons name="cloud-queue" size={20} color="#8B5CF6" />
          <View style={styles.platformMetricInfo}>
            <Text style={styles.platformMetricValue}>{analyticsData.platformMetrics.uptime}</Text>
            <Text style={styles.platformMetricLabel}>Uptime</Text>
          </View>
        </View>
        <View style={styles.platformMetric}>
          <Feather name="clock" size={20} color="#F59E0B" />
          <View style={styles.platformMetricInfo}>
            <Text style={styles.platformMetricValue}>{analyticsData.platformMetrics.loadTime}</Text>
            <Text style={styles.platformMetricLabel}>Avg Load Time</Text>
          </View>
        </View>
      </View>
    </View>
  );

  // Date Range Selector
  const DateRangeSelector = () => {
    const ranges = [
      { key: 'today', label: 'Today' },
      { key: 'week', label: 'This Week' },
      { key: 'month', label: 'This Month' },
      { key: 'quarter', label: 'This Quarter' },
      { key: 'year', label: 'This Year' },
    ];

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.dateRangeContainer}
      >
        {ranges.map((range) => (
          <TouchableOpacity
            key={range.key}
            style={[
              styles.dateRangeButton,
              dateRange === range.key && styles.dateRangeButtonActive
            ]}
            onPress={() => setDateRange(range.key)}
          >
            <Text style={[
              styles.dateRangeText,
              dateRange === range.key && styles.dateRangeTextActive
            ]}>
              {range.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // Tab Navigation
  const AnalyticsTabs = () => {
    const tabs = [
      { key: 'overview', label: 'Overview', icon: 'dashboard' },
      { key: 'revenue', label: 'Revenue', icon: 'trending-up' },
      { key: 'customers', label: 'Customers', icon: 'people' },
      { key: 'products', label: 'Products', icon: 'inventory' },
    ];

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
      >
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabButton,
              activeTab === tab.key && styles.tabButtonActive
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <MaterialIcons 
              name={tab.icon} 
              size={18} 
              color={activeTab === tab.key ? '#3B82F6' : '#64748B'} 
            />
            <Text style={[
              styles.tabText,
              activeTab === tab.key && styles.tabTextActive
            ]}>
              {tab.label}
            </Text>
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
                value={`₹${(analyticsData.overview.totalRevenue / 1000000).toFixed(1)}M`}
                growth={analyticsData.overview.revenueGrowth}
                subtitle="Year to date"
                color="#3B82F6"
                icon={<FontAwesome5 name="rupee-sign" size={18} color="#FFFFFF" />}
              />
              <MetricCard
                title="Total Orders"
                value={analyticsData.overview.totalOrders.toLocaleString()}
                growth={analyticsData.overview.orderGrowth}
                subtitle="Completed orders"
                color="#10B981"
                icon={<Feather name="shopping-bag" size={18} color="#FFFFFF" />}
              />
              <MetricCard
                title="Active Customers"
                value={analyticsData.overview.activeCustomers.toLocaleString()}
                growth={analyticsData.overview.customerGrowth}
                subtitle="Monthly active"
                color="#8B5CF6"
                icon={<MaterialIcons name="people" size={20} color="#FFFFFF" />}
              />
              <MetricCard
                title="Avg Order Value"
                value={`₹${analyticsData.overview.avgOrderValue}`}
                growth={analyticsData.overview.aovGrowth}
                subtitle="Per order"
                color="#F59E0B"
                icon={<MaterialIcons name="attach-money" size={20} color="#FFFFFF" />}
              />
            </View>
            <TopProducts />
            <CustomerMetrics />
          </>
        );
      
      case 'revenue':
        return (
          <>
            <RevenueChart />
            <OrdersChart />
            <RetailerPerformance />
          </>
        );
      
      case 'customers':
        return (
          <>
            <CustomerMetrics />
            <PlatformMetrics />
          </>
        );
      
      case 'products':
        return (
          <>
            <TopProducts />
            <OrdersChart />
          </>
        );
      
      default:
        return null;
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Analytics & Reports</Text>
          <Text style={styles.headerSubtitle}>Platform performance insights</Text>
        </View>
        <TouchableOpacity 
          style={styles.exportButton}
          onPress={() => handleExport('full')}
        >
          <Feather name="download" size={18} color="#FFFFFF" />
          <Text style={styles.exportButtonText}>Export Report</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Date Range Selector */}
        <View style={styles.section}>
          <DateRangeSelector />
        </View>

        {/* Analytics Tabs */}
        <View style={styles.section}>
          <AnalyticsTabs />
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {renderTabContent()}
        </View>

        {/* Bottom Spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginBottom: 0,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  seeAllText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  dateRangeContainer: {
    marginBottom: 8,
  },
  dateRangeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  dateRangeButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  dateRangeText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  dateRangeTextActive: {
    color: '#FFFFFF',
  },
  tabsContainer: {
    marginBottom: 8,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginRight: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  tabButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  tabText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabContent: {
    gap: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: (width - 88) / 2,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  metricInfo: {
    flex: 1,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  growthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  growthText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  metricSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  // Chart Styles
  chartContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartHeader: {
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  chartSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  chartStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  chartStat: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  // Bar Chart Styles
  barChartContainer: {
    height: 200,
    marginVertical: 8,
  },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 150,
    paddingHorizontal: 8,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  barWrapper: {
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  bar: {
    width: 20,
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '500',
  },
  // Line Chart Styles
  lineChartContainer: {
    height: 200,
    marginVertical: 8,
  },
  lineChart: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 150,
    paddingHorizontal: 8,
    justifyContent: 'space-between',
  },
  linePoint: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
  },
  lineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lineConnector: {
    flex: 1,
    marginHorizontal: 4,
  },
  lineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  lineLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '500',
  },
  // Products List Styles
  productsList: {
    gap: 12,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    gap: 12,
  },
  productRank: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  productSales: {
    fontSize: 12,
    color: '#64748B',
  },
  productRevenue: {
    alignItems: 'flex-end',
  },
  revenueText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  growthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  growthBadgeText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '700',
  },
  // Retailers List Styles
  retailersList: {
    gap: 12,
  },
  retailerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    justifyContent: 'space-between',
  },
  retailerInfo: {
    flex: 1,
  },
  retailerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  retailerStats: {
    flexDirection: 'row',
    gap: 12,
  },
  retailerStat: {
    fontSize: 12,
    color: '#64748B',
  },
  retailerRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  // Customer Metrics Styles
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  customerMetric: {
    width: (width - 88) / 2,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 4,
  },
  // Platform Metrics Styles
  platformMetrics: {
    gap: 12,
  },
  platformMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    gap: 12,
  },
  platformMetricInfo: {
    flex: 1,
  },
  platformMetricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 2,
  },
  platformMetricLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  bottomSpacer: {
    height: 20,
  },
});