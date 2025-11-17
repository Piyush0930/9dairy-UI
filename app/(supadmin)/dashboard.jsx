// app/(tabs)/supadmin/dashboard.jsx
import { Feather, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');
const API_BASE = `${process.env.EXPO_PUBLIC_API_URL || ''}/api`; // e.g. http://localhost:5000

export default function SuperAdminDashboard() {
  // top-level hook usage
  const { authToken, isLoading: authLoading, isAuthenticated } = useAuth();

  const [timeframe, setTimeframe] = useState('week'); // day | week | month
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState(null); // will hold mapped API data or null
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
      console.warn('[dashboard] AsyncStorage read error', e);
      return null;
    }
  };

  // map API response -> UI-friendly object (no sample defaults)
  const mapApiToUi = (data) => {
    const overview = data?.overview || {};
    const orders = overview?.orders || {};

    return {
      platformStats: {
        totalRetailers: overview.retailers?.total ?? 0,
        activeRetailers: overview.retailers?.active ?? 0,
        pendingRetailers: (overview.retailers?.total ?? 0) - (overview.retailers?.active ?? 0),
        totalCustomers: overview.customers?.total ?? 0,
        newCustomers: overview.customers?.new ?? 0,
        todayOrders: orders.total ?? 0,
        totalRevenue: typeof orders.revenue === 'number' ? orders.revenue : 0,
        avgOrderValue: typeof orders.average === 'number' ? orders.average : 0,
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
    console.log('[dashboard] fetch start', { API_BASE, timeframe: tf, hasAuthToken: !!authToken });

    try {
      const token = await getAuthToken();
      if (!token) {
        setErrorMsg('No auth token found. Please login.');
        setDashboardData(null);
        return;
      }

      // if your backend expects raw token (no Bearer), change this header accordingly
      const url = `${API_BASE}/superadmin/dashboard/overview?timeframe=${encodeURIComponent(tf)}`;
      console.log('[dashboard] fetching', url);

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('[dashboard] response status', res.status);

      // capture non-OK responses
      if (!res.ok) {
        const txt = await res.text().catch(() => 'no-text');
        throw new Error(`HTTP ${res.status} - ${txt}`);
      }

      const json = await res.json();
      console.log('[dashboard] json keys', Object.keys(json || {}));

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

  // initial & dependency-driven fetch
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    if (authLoading) {
      console.log('[dashboard] waiting for auth to finish');
      return;
    }
    if (!isAuthenticated && !authToken) {
      setErrorMsg('Not authenticated. Please login.');
      setDashboardData(null);
      setLoading(false);
      return;
    }

    fetchDashboard(timeframe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, authToken, isAuthenticated, timeframe]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard(timeframe);
    setRefreshing(false);
  };

  // UI small components
  const StatCard = ({ title, value, subtitle, color, icon }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <View style={[styles.iconContainer, { backgroundColor: color }]}>{icon}</View>
        <View style={styles.statValues}>
          <Text style={styles.statValue}>{value !== null && value !== undefined ? String(value) : '—'}</Text>
          {subtitle ? <Text style={styles.statSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  const ActivityItem = ({ item }) => {
    // item follows API recentActivities structure (orders)
    const msg = item.orderNumber ? `${item.orderNumber} — ₹${item.totalAmount}` : item.message || 'Activity';
    const time = item.createdAt ? new Date(item.createdAt).toLocaleString() : (item.time || '—');
    const user = item.customer?.name || item.retailer?.ownerName || 'N/A';

    return (
      <View style={styles.activityItem}>
        <View style={styles.activityIcon}><Feather name="activity" size={16} color="#3B82F6" /></View>
        <View style={styles.activityContent}>
          <Text style={styles.activityMessage}>{msg}</Text>
          <View style={styles.activityMeta}>
            <Text style={styles.activityUser}>By {user}</Text>
            <Text style={styles.activityTime}>{time}</Text>
          </View>
        </View>
      </View>
    );
  };

  // Render
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeText}>
            <Text style={styles.welcomeTitle}>SuperAdmin Dashboard 👑</Text>
            <Text style={styles.welcomeSubtitle}>Timeframe: {timeframe.toUpperCase()}</Text>
          </View>

          <View style={{ flexDirection: 'row' }}>
            {['day', 'week', 'month'].map((tf) => (
              <TouchableOpacity
                key={tf}
                onPress={() => setTimeframe(tf)}
                style={[
                  styles.tfButton,
                  timeframe === tf ? styles.tfButtonActive : styles.tfButtonInactive,
                ]}
              >
                <Text style={timeframe === tf ? styles.tfTextActive : styles.tfTextInactive}>{tf.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorText}>{errorMsg}</Text>
            <Text style={styles.errorHint}>
              Check EXPO_PUBLIC_API_URL, token and Metro logs. If using Android emulator replace 'localhost' with '10.0.2.2'.
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Platform Overview</Text>
            <TouchableOpacity onPress={onRefresh}><MaterialIcons name="refresh" size={20} color="#3B82F6" /></TouchableOpacity>
          </View>

          {loading && !dashboardData ? (
            <View style={styles.centered}><ActivityIndicator size="large" /></View>
          ) : (!dashboardData ? (
            // no data state (no sample)
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No dashboard data</Text>
              <Text style={styles.emptySubtitle}>Data not available for selected timeframe.</Text>
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <StatCard
                title="Total Retailers"
                value={dashboardData.platformStats.totalRetailers}
                subtitle={`${dashboardData.platformStats.activeRetailers} active`}
                color="#3B82F6"
                icon={<FontAwesome5 name="store" size={18} color="#fff" />}
              />
              <StatCard
                title="Customers"
                value={dashboardData.platformStats.totalCustomers}
                subtitle={`${dashboardData.platformStats.newCustomers} new`}
                color="#10B981"
                icon={<MaterialIcons name="people" size={20} color="#fff" />}
              />
              <StatCard
                title="Revenue"
                value={dashboardData.platformStats.totalRevenue !== undefined ? `₹${dashboardData.platformStats.totalRevenue}` : '—'}
                subtitle={`Avg ₹${Math.round(dashboardData.platformStats.avgOrderValue || 0)}`}
                color="#F59E0B"
                icon={<FontAwesome5 name="rupee-sign" size={16} color="#fff" />}
              />
              <StatCard
                title="Orders"
                value={dashboardData.platformStats.todayOrders}
                subtitle={`${dashboardData.platformStats.pendingRetailers} pending`}
                color="#EF4444"
                icon={<Feather name="shopping-bag" size={18} color="#fff" />}
              />
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activities</Text>
            <TouchableOpacity onPress={() => { if (dashboardData) console.log('recentActivities count', dashboardData.recentActivities.length); }}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {dashboardData && dashboardData.recentActivities.length > 0 ? (
            <View style={styles.activitiesList}>
              {dashboardData.recentActivities.map((a) => <ActivityItem key={a.orderNumber || a._id || Math.random().toString()} item={a} />)}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No recent activity</Text>
              <Text style={styles.emptySubtitle}>There are no recent orders for the selected timeframe.</Text>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* small floating loader */
        loading ? (
          <View style={styles.floatingLoader}><ActivityIndicator /></View>
        ) : null
      }
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollView: { flex: 1 },
  welcomeSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  welcomeText: { flex: 1 },
  welcomeTitle: { fontSize: 24, fontWeight: 'bold', color: '#1E293B' },
  welcomeSubtitle: { fontSize: 14, color: '#64748B', marginTop: 6 },
  tfButton: { padding: 8, borderRadius: 8, marginLeft: 8 },
  tfButtonActive: { backgroundColor: '#3B82F6' },
  tfButtonInactive: { backgroundColor: '#F1F5F9' },
  tfTextActive: { color: '#fff', fontWeight: '700' },
  tfTextInactive: { color: '#374151', fontWeight: '700' },
  section: { backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.05, elevation: 3 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  seeAllText: { color: '#3B82F6', fontWeight: '700' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: (width - 88) / 2, backgroundColor: '#fff', padding: 12, borderRadius: 10, borderLeftWidth: 4, marginBottom: 12 },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  iconContainer: { width: 40, height: 40, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  statValues: { alignItems: 'flex-end' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  statSubtitle: { fontSize: 11, color: '#64748B' },
  statTitle: { fontSize: 14, color: '#64748B', marginTop: 4 },
  activitiesList: { marginTop: 8 },
  activityItem: { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-start' },
  activityIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  activityContent: { flex: 1 },
  activityMessage: { fontSize: 14, color: '#1E293B' },
  activityMeta: { flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'center' },
  activityUser: { fontSize: 12, color: '#64748B' },
  activityTime: { fontSize: 12, color: '#94A3B8' },
  centered: { padding: 24, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 24 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#64748B' },
  emptySubtitle: { fontSize: 13, color: '#94A3B8', marginTop: 6, textAlign: 'center' },
  errorBanner: { backgroundColor: '#fee2e2', padding: 12, margin: 16, borderRadius: 8 },
  errorTitle: { color: '#7f1d1d', fontWeight: '800' },
  errorText: { color: '#7f1d1d', marginTop: 6 },
  errorHint: { color: '#7f1d1d', marginTop: 6, fontSize: 12 },
  floatingLoader: { position: 'absolute', right: 16, bottom: 16, backgroundColor: '#fff', padding: 8, borderRadius: 8, elevation: 6 },
});
