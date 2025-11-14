// app/(tabs)/supadmin/retailers.jsx
import { Feather, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
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

const API_BASE = `${process.env.EXPO_PUBLIC_API_URL}/api`; // ensure EXPO_PUBLIC_API_URL is set in .env

export default function RetailersScreen() {
  // ✅ call hook at top-level only
  const { authToken, isLoading: authLoading, isAuthenticated } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [retailersData, setRetailersData] = useState({
    summary: { total: 0, active: 0, pending: 0, suspended: 0, revenue: 0, growth: 0 },
    retailers: [],
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const fadeAnim = useState(new Animated.Value(0))[0];

  // helper that DOES NOT call hooks — uses top-level authToken or AsyncStorage fallback
  const getAuthToken = async () => {
    if (authToken) return authToken; // use value from context first

    try {
      const stored = (await AsyncStorage.getItem('authtoken')) || (await AsyncStorage.getItem('token'));
      return stored || null;
    } catch (e) {
      console.warn('Error reading token from AsyncStorage', e);
      return null;
    }
  };

  // ---------- Fetching ----------
  const fetchRetailers = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        // no token, stop and show empty
        setRetailersData(prev => ({ ...prev, retailers: [], summary: { ...prev.summary, total: 0, active: 0 } }));
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const res = await fetch(`${API_BASE}/superadmin/retailers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Most servers expect 'Bearer <token>'. If your server expects raw token, remove 'Bearer '.
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} - ${text}`);
      }

      const json = await res.json();

      if (!json.success || !json.data) {
        // handle unexpected shapes gracefully
        console.warn('fetchRetailers: unexpected response', json);
        setRetailersData({ summary: { total: 0, active: 0, pending: 0, suspended: 0, revenue: 0, growth: 0 }, retailers: [] });
        return;
      }

      const apiRetailers = json.data.retailers || [];
      const stats = json.data.stats || json.data.pagination || {};

      // Map API response to the UI shape used in the component
      const mappedRetailers = apiRetailers.map(item => ({
        id: item._id,
        shopName: item.shopName || '—',
        ownerName: item.ownerName || '—',
        mobile: item.mobile || '—',
        email: item.email || '',
        location: item.location?.formattedAddress || item.address || 'N/A',
        joinDate: item.createdAt || item.created_at || '',
        status: item.isActive === true ? 'active' : 'pending',
        totalOrders: item.totalOrders ?? 0,
        totalRevenue: item.totalRevenue ?? 0,
        rating: item.rating ?? 0,
        products: item.products ?? 0,
        lastActive: item.updatedAt ? new Date(item.updatedAt).toLocaleString() : '',
        performance: item.performance ?? (item.isActive ? 'good' : 'new'),
        documents: item.documents ?? [],
        raw: item,
      }));

      setRetailersData({
        summary: {
          total: stats.total ?? mappedRetailers.length,
          active: stats.active ?? mappedRetailers.filter(r => r.status === 'active').length,
          pending: (stats.total ?? mappedRetailers.length) - (stats.active ?? mappedRetailers.filter(r => r.status === 'active').length),
          suspended: 0,
          revenue: 0,
          growth: 0,
        },
        retailers: mappedRetailers,
      });
    } catch (err) {
      console.error('fetchRetailers error:', err);
      Alert.alert('Error', `Could not load retailers.\n${err.message}`);
      setRetailersData(prev => ({ ...prev, retailers: [] }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken]);

  // fetch when component mounts and whenever auth state changes
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [fadeAnim]);

  useEffect(() => {
    // don't fetch while auth library is loading
    if (authLoading) return;

    if (!isAuthenticated && !authToken) {
      // user not logged in — clear list
      setRetailersData(prev => ({ ...prev, retailers: [], summary: { ...prev.summary, total: 0, active: 0 } }));
      setLoading(false);
      return;
    }

    // call fetchRetailers (useCallback ensures stable ref)
    fetchRetailers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken, authLoading, isAuthenticated, fetchRetailers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRetailers();
    Alert.alert('✅ Refreshed', 'Retailers data updated');
  };

  // ---------- Filter/Search ----------
  const filteredRetailers = retailersData.retailers.filter(retailer => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (retailer.shopName && retailer.shopName.toLowerCase().includes(q)) ||
      (retailer.ownerName && retailer.ownerName.toLowerCase().includes(q)) ||
      (retailer.location && retailer.location.toLowerCase().includes(q)) ||
      (retailer.mobile || '').includes(q);

    const matchesStatus = filterStatus === 'all' || retailer.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // ---------- UI Subcomponents ----------
  const StatusBadge = ({ status }) => {
    const getStatusConfig = (status) => {
      switch (status) {
        case 'active':
          return { color: '#10B981', bgColor: '#D1FAE5', text: 'Active', icon: 'check-circle' };
        case 'pending':
          return { color: '#F59E0B', bgColor: '#FEF3C7', text: 'Pending', icon: 'pending' };
        case 'suspended':
          return { color: '#EF4444', bgColor: '#FEE2E2', text: 'Suspended', icon: 'block' };
        default:
          return { color: '#6B7280', bgColor: '#F3F4F6', text: 'Unknown', icon: 'help' };
      }
    };

    const config = getStatusConfig(status);

    return (
      <View style={[styles.statusBadge, { backgroundColor: config.bgColor }]}>
        <MaterialIcons name={config.icon} size={12} color={config.color} />
        <Text style={[styles.statusText, { color: config.color }]}>{config.text}</Text>
      </View>
    );
  };

  const PerformanceIndicator = ({ performance }) => {
    const getPerformanceConfig = (performance) => {
      switch (performance) {
        case 'excellent':
          return { color: '#10B981', text: 'Excellent' };
        case 'good':
          return { color: '#3B82F6', text: 'Good' };
        case 'average':
          return { color: '#F59E0B', text: 'Average' };
        case 'poor':
          return { color: '#EF4444', text: 'Needs Attention' };
        case 'new':
          return { color: '#6B7280', text: 'New' };
        default:
          return { color: '#6B7280', text: 'Unknown' };
      }
    };

    const config = getPerformanceConfig(performance);

    return (
      <View style={styles.performanceIndicator}>
        <View style={[styles.performanceDot, { backgroundColor: config.color }]} />
        <Text style={[styles.performanceText, { color: config.color }]}>{config.text}</Text>
      </View>
    );
  };

  const SummaryCard = ({ title, value, subtitle, color, icon, onPress }) => {
    return (
      <TouchableOpacity style={[styles.summaryCard, { borderLeftColor: color }]} onPress={onPress} activeOpacity={0.7}>
        <View style={styles.summaryHeader}>
          <View style={[styles.summaryIcon, { backgroundColor: color }]}>{icon}</View>
          <Text style={styles.summaryValue}>{value}</Text>
        </View>
        <Text style={styles.summaryTitle}>{title}</Text>
        {subtitle && <Text style={styles.summarySubtitle}>{subtitle}</Text>}
      </TouchableOpacity>
    );
  };

  // For quick actions we only update locally; if you have a backend endpoint to change status,
  // replace the local update with an API call (example commented near handleStatusChange).
  const handleStatusChange = async (retailerId, newStatus) => {
    setRetailersData(prev => ({
      ...prev,
      retailers: prev.retailers.map(retailer => (retailer.id === retailerId ? { ...retailer, status: newStatus } : retailer)),
      summary: {
        ...prev.summary,
        active: newStatus === 'active' ? prev.summary.active + 1 : Math.max(0, prev.summary.active - 1),
      },
    }));

    Alert.alert('✅ Success', `Retailer status updated to ${newStatus}`);
  };

  const RetailerCard = ({ retailer }) => {
    const scaleAnim = useState(new Animated.Value(1))[0];

    const handlePressIn = () => {
      Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    };

    const handleViewDetails = () => {
      setSelectedRetailer(retailer);
      setShowDetailsModal(true);
    };

    const handleQuickAction = (action) => {
      switch (action) {
        case 'approve':
          Alert.alert('Approve Retailer', `Approve ${retailer.shopName}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Approve', onPress: () => handleStatusChange(retailer.id, 'active') },
          ]);
          break;
        case 'suspend':
          Alert.alert('Suspend Retailer', `Suspend ${retailer.shopName}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Suspend', onPress: () => handleStatusChange(retailer.id, 'suspended') },
          ]);
          break;
        case 'contact':
          Alert.alert('Contact', `Call ${retailer.ownerName} at ${retailer.mobile}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Call', onPress: () => console.log('Calling:', retailer.mobile) },
          ]);
          break;
        default:
          break;
      }
    };

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity style={styles.retailerCard} onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={handleViewDetails} activeOpacity={0.8}>
          <View style={styles.retailerHeader}>
            <View style={styles.retailerInfo}>
              <Text style={styles.shopName}>{retailer.shopName}</Text>
              <Text style={styles.ownerName}>by {retailer.ownerName}</Text>
            </View>
            <StatusBadge status={retailer.status} />
          </View>

          <View style={styles.retailerDetails}>
            <View style={styles.detailRow}>
              <Feather name="map-pin" size={14} color="#64748B" />
              <Text style={styles.detailText}>{retailer.location}</Text>
            </View>
            <View style={styles.detailRow}>
              <Feather name="phone" size={14} color="#64748B" />
              <Text style={styles.detailText}>{retailer.mobile}</Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialIcons name="calendar-today" size={14} color="#64748B" />
              <Text style={styles.detailText}>Joined {retailer.joinDate ? new Date(retailer.joinDate).toLocaleDateString() : '—'}</Text>
            </View>
          </View>

          {retailer.status === 'active' && (
            <View style={styles.performanceSection}>
              <View style={styles.performanceRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{retailer.totalOrders}</Text>
                  <Text style={styles.metricLabel}>Orders</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>₹{(retailer.totalRevenue / 1000).toFixed(0)}K</Text>
                  <Text style={styles.metricLabel}>Revenue</Text>
                </View>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{retailer.products}</Text>
                  <Text style={styles.metricLabel}>Products</Text>
                </View>
                <View style={styles.metric}>
                  <View style={styles.rating}>
                    <MaterialIcons name="star" size={14} color="#F59E0B" />
                    <Text style={styles.ratingText}>{retailer.rating}</Text>
                  </View>
                  <Text style={styles.metricLabel}>Rating</Text>
                </View>
              </View>
              <PerformanceIndicator performance={retailer.performance} />
            </View>
          )}

          <View style={styles.actionButtons}>
            {retailer.status === 'pending' && (
              <TouchableOpacity style={[styles.actionButton, styles.approveButton]} onPress={() => handleQuickAction('approve')}>
                <MaterialIcons name="check" size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Approve</Text>
              </TouchableOpacity>
            )}

            {retailer.status === 'active' && (
              <TouchableOpacity style={[styles.actionButton, styles.suspendButton]} onPress={() => handleQuickAction('suspend')}>
                <MaterialIcons name="block" size={16} color="#FFFFFF" />
                <Text style={styles.actionButtonText}>Suspend</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.actionButton, styles.contactButton]} onPress={() => handleQuickAction('contact')}>
              <Feather name="phone" size={16} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Contact</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.actionButton, styles.detailsButton]} onPress={handleViewDetails}>
              <Feather name="eye" size={16} color="#3B82F6" />
              <Text style={[styles.actionButtonText, { color: '#3B82F6' }]}>View</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const StatusFilter = () => {
    const filters = [
      { key: 'all', label: 'All', count: retailersData.summary.total },
      { key: 'active', label: 'Active', count: retailersData.summary.active },
      { key: 'pending', label: 'Pending', count: retailersData.summary.pending },
      { key: 'suspended', label: 'Suspended', count: retailersData.summary.suspended },
    ];

    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {filters.map(filter => (
          <TouchableOpacity key={filter.key} style={[styles.filterButton, filterStatus === filter.key && styles.filterButtonActive]} onPress={() => setFilterStatus(filter.key)}>
            <Text style={[styles.filterText, filterStatus === filter.key && styles.filterTextActive]}>{filter.label}</Text>
            <View style={[styles.filterCount, filterStatus === filter.key && styles.filterCountActive]}>
              <Text style={styles.filterCountText}>{filter.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // ---------- Render ----------
  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Retailers Management</Text>
          <Text style={styles.headerSubtitle}>Manage all retailers on the platform</Text>
        </View>
        <TouchableOpacity style={styles.addButton}>
          <MaterialIcons name="person-add" size={20} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Retailer</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} showsVerticalScrollIndicator={false}>
        {/* Summary Cards */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Platform Overview</Text>
            <TouchableOpacity onPress={onRefresh}>
              <MaterialIcons name="refresh" size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
          <View style={styles.summaryGrid}>
            <SummaryCard title="Total Retailers" value={retailersData.summary.total} subtitle={`${retailersData.summary.growth}% growth`} color="#3B82F6" icon={<FontAwesome5 name="store" size={18} color="#FFFFFF" />} onPress={() => setFilterStatus('all')} />
            <SummaryCard title="Active" value={retailersData.summary.active} subtitle="Currently operating" color="#10B981" icon={<MaterialIcons name="check-circle" size={20} color="#FFFFFF" />} onPress={() => setFilterStatus('active')} />
            <SummaryCard title="Pending" value={retailersData.summary.pending} subtitle="Awaiting approval" color="#F59E0B" icon={<MaterialIcons name="pending" size={20} color="#FFFFFF" />} onPress={() => setFilterStatus('pending')} />
            <SummaryCard title="Suspended" value={retailersData.summary.suspended} subtitle="Temporarily inactive" color="#EF4444" icon={<MaterialIcons name="block" size={20} color="#FFFFFF" />} onPress={() => setFilterStatus('suspended')} />
          </View>
        </View>

        {/* Search and Filters */}
        <View style={styles.section}>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Feather name="search" size={20} color="#64748B" />
              <TextInput style={styles.searchInput} placeholder="Search retailers by name, owner, or location..." value={searchQuery} onChangeText={setSearchQuery} placeholderTextColor="#94A3B8" />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialIcons name="clear" size={20} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <StatusFilter />
        </View>

        {/* Retailers List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {filterStatus === 'all' ? 'All Retailers' : filterStatus === 'active' ? 'Active Retailers' : filterStatus === 'pending' ? 'Pending Approval' : 'Suspended Retailers'}
            </Text>
            <Text style={styles.resultsCount}>{filteredRetailers.length} results</Text>
          </View>

          {loading ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <ActivityIndicator size="large" />
            </View>
          ) : filteredRetailers.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="store" size={48} color="#E2E8F0" />
              <Text style={styles.emptyStateTitle}>No retailers found</Text>
              <Text style={styles.emptyStateText}>{searchQuery ? 'Try adjusting your search terms' : 'No retailers match the selected filters'}</Text>
            </View>
          ) : (
            <View style={styles.retailersList}>
              {filteredRetailers.map(retailer => (
                <RetailerCard key={retailer.id} retailer={retailer} />
              ))}
            </View>
          )}
        </View>

        {/* Bottom Spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Retailer Details Modal */}
      <Modal visible={showDetailsModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowDetailsModal(false)}>
        {selectedRetailer && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Retailer Details</Text>
              <TouchableOpacity style={styles.closeButton} onPress={() => setShowDetailsModal(false)}>
                <MaterialIcons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.modalSection}>
                <Text style={styles.modalShopName}>{selectedRetailer.shopName}</Text>
                <Text style={styles.modalOwner}>Owner: {selectedRetailer.ownerName}</Text>
                <StatusBadge status={selectedRetailer.status} />
              </View>

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Contact Information</Text>
                <View style={styles.contactInfo}>
                  <View style={styles.contactItem}>
                    <Feather name="phone" size={16} color="#64748B" />
                    <Text style={styles.contactText}>{selectedRetailer.mobile}</Text>
                  </View>
                  <View style={styles.contactItem}>
                    <Feather name="mail" size={16} color="#64748B" />
                    <Text style={styles.contactText}>{selectedRetailer.email || '—'}</Text>
                  </View>
                  <View style={styles.contactItem}>
                    <Feather name="map-pin" size={16} color="#64748B" />
                    <Text style={styles.contactText}>{selectedRetailer.location}</Text>
                  </View>
                </View>
              </View>

              {selectedRetailer.status === 'active' && (
                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Performance Metrics</Text>
                  <View style={styles.performanceGrid}>
                    <View style={styles.performanceMetric}>
                      <Text style={styles.metricValue}>{selectedRetailer.totalOrders}</Text>
                      <Text style={styles.metricLabel}>Total Orders</Text>
                    </View>
                    <View style={styles.performanceMetric}>
                      <Text style={styles.metricValue}>₹{selectedRetailer.totalRevenue.toLocaleString()}</Text>
                      <Text style={styles.metricLabel}>Total Revenue</Text>
                    </View>
                    <View style={styles.performanceMetric}>
                      <Text style={styles.metricValue}>{selectedRetailer.products}</Text>
                      <Text style={styles.metricLabel}>Products</Text>
                    </View>
                    <View style={styles.performanceMetric}>
                      <Text style={styles.metricValue}>{selectedRetailer.rating}/5</Text>
                      <Text style={styles.metricLabel}>Customer Rating</Text>
                    </View>
                  </View>
                </View>
              )}

              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Documents</Text>
                <View style={styles.documentsList}>
                  {(selectedRetailer.documents || []).length === 0 ? (
                    <Text style={styles.documentText}>No documents available</Text>
                  ) : (
                    selectedRetailer.documents.map((doc, index) => (
                      <View key={index} style={styles.documentItem}>
                        <MaterialIcons name="description" size={16} color="#3B82F6" />
                        <Text style={styles.documentText}>{doc.toUpperCase()} Certificate</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalButton, styles.primaryButton]}>
                  <Text style={styles.modalButtonText}>Edit Details</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.secondaryButton]}>
                  <Text style={[styles.modalButtonText, { color: '#3B82F6' }]}>View Full Profile</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  /* ... keep your original styles unchanged (same as your file) ... */
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
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  addButtonText: {
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
  resultsCount: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
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
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  summaryTitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  summarySubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  filterContainer: {
    marginBottom: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  retailersList: {
    gap: 12,
  },
  retailerCard: {
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
  retailerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  retailerInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 2,
  },
  ownerName: {
    fontSize: 14,
    color: '#64748B',
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
    fontSize: 11,
    fontWeight: '700',
  },
  retailerDetails: {
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#64748B',
  },
  performanceSection: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  metric: {
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  performanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  performanceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  performanceText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
    flex: 1,
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  suspendButton: {
    backgroundColor: '#EF4444',
  },
  contactButton: {
    backgroundColor: '#3B82F6',
  },
  detailsButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#64748B',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  modalSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalShopName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  modalOwner: {
    fontSize: 16,
    color: '#64748B',
    marginBottom: 12,
  },
  contactInfo: {
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactText: {
    fontSize: 16,
    color: '#374151',
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  performanceMetric: {
    width: (width - 72) / 2,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  documentsList: {
    gap: 8,
  },
  documentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  documentText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
