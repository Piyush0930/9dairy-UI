// app/(tabs)/supadmin/dashboard.jsx
import { useState, useEffect } from 'react';
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
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

// Mock data with realistic values
const MOCK_DATA = {
  platformStats: {
    totalRetailers: 145,
    activeRetailers: 128,
    pendingRetailers: 17,
    suspendedRetailers: 5,
    totalCustomers: 12500,
    activeCustomers: 11200,
    newCustomers: 234,
    todayOrders: 89,
    pendingOrders: 23,
    completedOrders: 1567,
    totalRevenue: 254000,
    todayRevenue: 12500,
    avgOrderValue: 285,
  },
  growthMetrics: {
    retailerGrowth: 12,
    customerGrowth: 8,
    revenueGrowth: 22,
    orderGrowth: 15,
  },
  quickActions: [
    { 
      id: 1, 
      title: 'Approve Retailers', 
      count: 5, 
      icon: 'store', 
      color: '#10B981', 
      screen: 'retailers',
      description: 'Review pending applications'
    },
    { 
      id: 2, 
      title: 'View Reports', 
      count: 12, 
      icon: 'assessment', 
      color: '#3B82F6', 
      screen: 'analytics',
      description: 'Generate platform reports'
    },
    { 
      id: 3, 
      title: 'System Health', 
      count: null, 
      icon: 'monitor-heart', 
      color: '#F59E0B', 
      screen: 'system',
      description: 'Check system status'
    },
    { 
      id: 4, 
      title: 'Support Tickets', 
      count: 8, 
      icon: 'support-agent', 
      color: '#EF4444', 
      screen: 'customers',
      description: 'Manage customer support'
    },
  ],
  recentActivities: [
    { 
      id: 1, 
      type: 'new_retailer', 
      message: 'Fresh Mart registered for approval', 
      time: '2 min ago',
      user: 'Rajesh Kumar',
      priority: 'high'
    },
    { 
      id: 2, 
      type: 'new_order', 
      message: 'Large order #1234 placed (₹2,500)', 
      time: '5 min ago',
      user: 'Amit Sharma',
      priority: 'medium'
    },
    { 
      id: 3, 
      type: 'retailer_approved', 
      message: 'Dairy King approved successfully', 
      time: '10 min ago',
      user: 'System',
      priority: 'low'
    },
    { 
      id: 4, 
      type: 'system_alert', 
      message: 'Payment gateway response slow', 
      time: '1 hour ago',
      user: 'System',
      priority: 'high'
    },
  ],
  performanceMetrics: {
    platformUptime: '99.9%',
    apiResponseTime: '120ms',
    databaseHealth: 'Excellent',
    serverLoad: '45%',
  }
};

export default function SuperAdminDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(MOCK_DATA);
  const [activeStat, setActiveStat] = useState(null);
  const router = useRouter();
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
    // Simulate API call
    setTimeout(() => {
      setDashboardData(MOCK_DATA);
      setRefreshing(false);
      Alert.alert('✅ Refreshed', 'Dashboard data updated successfully');
    }, 1500);
  };

  // Enhanced Stat Card with animations
  const StatCard = ({ title, value, growth, icon, color, subtitle, onPress }) => {
    const scaleAnim = useState(new Animated.Value(1))[0];

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[
            styles.statCard,
            { borderLeftColor: color },
            activeStat === title && styles.statCardActive
          ]}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onPress}
          activeOpacity={0.8}
        >
          <View style={styles.statHeader}>
            <View style={[styles.iconContainer, { backgroundColor: color }]}>
              {icon}
            </View>
            <View style={styles.statValues}>
              <Text style={styles.statValue}>{value}</Text>
              {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
            </View>
          </View>
          <Text style={styles.statTitle}>{title}</Text>
          {growth && (
            <View style={styles.growthContainer}>
              <MaterialIcons 
                name={growth > 0 ? "trending-up" : "trending-down"} 
                size={14} 
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
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Enhanced Quick Action Component
  const QuickAction = ({ title, count, icon, color, description, onPress }) => {
    const getIcon = () => {
      switch (icon) {
        case 'store': return <FontAwesome5 name="store" size={20} color="#FFF" />;
        case 'assessment': return <MaterialIcons name="assessment" size={22} color="#FFF" />;
        case 'monitor-heart': return <MaterialIcons name="monitor-heart" size={22} color="#FFF" />;
        case 'support-agent': return <MaterialIcons name="support-agent" size={22} color="#FFF" />;
        default: return <Feather name="activity" size={20} color="#FFF" />;
      }
    };

    return (
      <TouchableOpacity 
        style={styles.quickAction} 
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={[styles.actionIcon, { backgroundColor: color }]}>
          {getIcon()}
          {count && (
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>{count}</Text>
            </View>
          )}
        </View>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription}>{description}</Text>
      </TouchableOpacity>
    );
  };

  // Activity Item Component
  const ActivityItem = ({ type, message, time, user, priority }) => {
    const getIcon = () => {
      switch (type) {
        case 'new_retailer':
          return <FontAwesome5 name="store" size={16} color="#3B82F6" />;
        case 'new_order':
          return <Feather name="shopping-bag" size={16} color="#10B981" />;
        case 'retailer_approved':
          return <MaterialIcons name="verified" size={16} color="#F59E0B" />;
        case 'system_alert':
          return <Ionicons name="warning" size={16} color="#EF4444" />;
        default:
          return <Octicons name="dot-fill" size={16} color="#6B7280" />;
      }
    };

    const getPriorityColor = () => {
      switch (priority) {
        case 'high': return '#EF4444';
        case 'medium': return '#F59E0B';
        case 'low': return '#10B981';
        default: return '#6B7280';
      }
    };

    return (
      <View style={styles.activityItem}>
        <View style={styles.activityIcon}>
          {getIcon()}
        </View>
        <View style={styles.activityContent}>
          <Text style={styles.activityMessage}>{message}</Text>
          <View style={styles.activityMeta}>
            <Text style={styles.activityUser}>By {user}</Text>
            <View style={[styles.priorityDot, { backgroundColor: getPriorityColor() }]} />
            <Text style={styles.activityTime}>{time}</Text>
          </View>
        </View>
      </View>
    );
  };

  // Performance Metric Component
  const PerformanceMetric = ({ title, value, status, icon }) => {
    const getStatusColor = () => {
      switch (status) {
        case 'Excellent': return '#10B981';
        case 'Good': return '#3B82F6';
        case 'Warning': return '#F59E0B';
        case 'Critical': return '#EF4444';
        default: return '#6B7280';
      }
    };

    return (
      <View style={styles.performanceMetric}>
        <View style={styles.metricHeader}>
          {icon}
          <Text style={styles.metricTitle}>{title}</Text>
        </View>
        <Text style={styles.metricValue}>{value}</Text>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>
    );
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Header */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeText}>
            <Text style={styles.welcomeTitle}>SuperAdmin Dashboard 👑</Text>
            <Text style={styles.welcomeSubtitle}>Complete platform overview and management</Text>
          </View>
          <View style={styles.dateBadge}>
            <Text style={styles.dateText}>{new Date().toLocaleDateString('en-IN', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}</Text>
          </View>
        </View>

        {/* Platform Overview Stats */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Platform Overview</Text>
            <TouchableOpacity onPress={onRefresh}>
              <MaterialIcons name="refresh" size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              title="Total Retailers"
              value={dashboardData.platformStats.totalRetailers}
              growth={dashboardData.growthMetrics.retailerGrowth}
              icon={<FontAwesome5 name="store" size={18} color="#FFFFFF" />}
              color="#3B82F6"
              subtitle={`${dashboardData.platformStats.activeRetailers} active`}
            />
            <StatCard
              title="Customers"
              value={dashboardData.platformStats.totalCustomers.toLocaleString()}
              growth={dashboardData.growthMetrics.customerGrowth}
              icon={<MaterialIcons name="people" size={22} color="#FFFFFF" />}
              color="#10B981"
              subtitle={`${dashboardData.platformStats.newCustomers} new today`}
            />
            <StatCard
              title="Today's Revenue"
              value={`₹${(dashboardData.platformStats.todayRevenue / 1000).toFixed(1)}K`}
              growth={dashboardData.growthMetrics.revenueGrowth}
              icon={<FontAwesome5 name="rupee-sign" size={16} color="#FFFFFF" />}
              color="#F59E0B"
              subtitle={`Avg: ₹${dashboardData.platformStats.avgOrderValue}`}
            />
            <StatCard
              title="Orders"
              value={dashboardData.platformStats.todayOrders}
              growth={dashboardData.growthMetrics.orderGrowth}
              icon={<Feather name="shopping-bag" size={18} color="#FFFFFF" />}
              color="#EF4444"
              subtitle={`${dashboardData.platformStats.pendingOrders} pending`}
            />
          </View>
        </View>

        {/* Quick Actions Grid */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.actionsGrid}>
            {dashboardData.quickActions.map((action) => (
              <QuickAction
                key={action.id}
                title={action.title}
                count={action.count}
                icon={action.icon}
                color={action.color}
                description={action.description}
                onPress={() => router.push(`/(tabs)/supadmin/${action.screen}`)}
              />
            ))}
          </View>
        </View>

        {/* Performance Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Performance</Text>
          <View style={styles.performanceGrid}>
            <PerformanceMetric
              title="Platform Uptime"
              value={dashboardData.performanceMetrics.platformUptime}
              status="Excellent"
              icon={<MaterialIcons name="cloud-queue" size={20} color="#3B82F6" />}
            />
            <PerformanceMetric
              title="API Response"
              value={dashboardData.performanceMetrics.apiResponseTime}
              status="Good"
              icon={<MaterialIcons name="speed" size={20} color="#10B981" />}
            />
            <PerformanceMetric
              title="Database"
              value={dashboardData.performanceMetrics.databaseHealth}
              status="Excellent"
              icon={<MaterialIcons name="storage" size={20} color="#F59E0B" />}
            />
            <PerformanceMetric
              title="Server Load"
              value={dashboardData.performanceMetrics.serverLoad}
              status="Good"
              icon={<MaterialIcons name="memory" size={20} color="#EF4444" />}
            />
          </View>
        </View>

        {/* Recent Activities */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.activitiesList}>
            {dashboardData.recentActivities.map((activity) => (
              <ActivityItem
                key={activity.id}
                type={activity.type}
                message={activity.message}
                time={activity.time}
                user={activity.user}
                priority={activity.priority}
              />
            ))}
          </View>
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
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  welcomeText: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 20,
  },
  dateBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dateText: {
    fontSize: 12,
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
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  seeAllText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: (width - 88) / 2,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statCardActive: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValues: {
    alignItems: 'flex-end',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  statTitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 8,
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
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickAction: {
    width: (width - 88) / 2,
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  actionBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#EF4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 14,
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  performanceMetric: {
    width: (width - 88) / 2,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  metricTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  statusIndicator: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  activitiesList: {
    gap: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 4,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityMessage: {
    fontSize: 14,
    color: '#1E293B',
    marginBottom: 4,
    lineHeight: 18,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityUser: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activityTime: {
    fontSize: 12,
    color: '#94A3B8',
  },
  bottomSpacer: {
    height: 20,
  },
});