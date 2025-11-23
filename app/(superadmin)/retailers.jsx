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
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import LocationPicker from '../../components/LocationPicker';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

// keep api base and auth base (Signup.jsx uses /api/auth)
const API_BASE = `${process.env.EXPO_PUBLIC_API_URL}/api`;
const API_AUTH = `${process.env.EXPO_PUBLIC_API_URL}/api/auth`;

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
  const [showAddRetailerModal, setShowAddRetailerModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const router = useRouter();
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Add Retailer Form State
  const [newRetailer, setNewRetailer] = useState({
    fullName: '',
    shopName: '',
    contactNo: '',
    address: '',
  });
  const [locationData, setLocationData] = useState(null);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpShown, setOtpShown] = useState(false);
  const [addRetailerLoading, setAddRetailerLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [userId, setUserId] = useState(null);

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
        totalOrders: item.totalOrders ?? item.orders ?? 0,
        totalRevenue: item.totalRevenue ?? item.revenue ?? 0,
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

  // Fetch a single retailer's full details
  const fetchRetailerDetails = async (retailerId) => {
    setDetailsLoading(true);
    setShowDetailsModal(true); // open modal early to show loader
    setSelectedRetailer(null);

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('No auth token found');

      const res = await fetch(`${API_BASE}/superadmin/retailers/${retailerId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status} - ${text}`);
      }

      const json = await res.json();
      if (!json.success || !json.data || !json.data.retailer) {
        throw new Error('Invalid retailer data from server');
      }

      // shape to convenient object for UI
      setSelectedRetailer({
        retailer: json.data.retailer,
        performance: json.data.performance || {},
        recentOrders: json.data.recentOrders || [],
      });
    } catch (err) {
      console.error('fetchRetailerDetails error:', err);
      Alert.alert('Error', `Could not load retailer details.\n${err.message}`);
      setSelectedRetailer(null);
      setShowDetailsModal(false);
    } finally {
      setDetailsLoading(false);
    }
  };

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

  // ---------- Add Retailer Functions ----------
  const handleLocationSelect = (location) => {
    console.log('📍 Selected location:', {
      address: location.formattedAddress,
      coordinates: location.coordinates,
    });

    let city = '';
    let state = '';
    
    if (location.addressComponents) {
      const cityComponent = location.addressComponents.find(comp => 
        comp.types.includes('locality') || comp.types.includes('administrative_area_level_2')
      );
      const stateComponent = location.addressComponents.find(comp => 
        comp.types.includes('administrative_area_level_1')
      );
      
      city = cityComponent?.long_name || '';
      state = stateComponent?.long_name || '';
    }
    
    const enhancedLocation = {
      ...location,
      city,
      state
    };
    
    setLocationData(enhancedLocation);
    
    if (location.formattedAddress) {
      setNewRetailer(prev => ({ ...prev, address: location.formattedAddress }));
    }
  };

  const validateRetailerForm = () => {
    if (!newRetailer.fullName.trim()) {
      Alert.alert('Validation Error', 'Please enter retailer full name');
      return false;
    }
    
    if (!newRetailer.shopName.trim()) {
      Alert.alert('Validation Error', 'Please enter shop name');
      return false;
    }
    
    if (!newRetailer.address.trim()) {
      Alert.alert('Validation Error', 'Please enter address');
      return false;
    }
    
    if (!newRetailer.contactNo || newRetailer.contactNo.length !== 10 || !/^\d+$/.test(newRetailer.contactNo)) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit contact number');
      return false;
    }
    
    return true;
  };

  // ----- UPDATED: handleGetOtp to match Signup.jsx shape -----
  const handleGetOtp = async (isResend = false) => {
    if (!validateRetailerForm()) return;

    setAddRetailerLoading(true);
    if (isResend) setResendLoading(true);

    try {
      // build location / coords in the same shape the backend expects (top-level fields)
      let locationParams = {};
      if (locationData && locationData.coordinates && locationData.coordinates.latitude && locationData.coordinates.longitude) {
        locationParams = {
          coordinates: {
            latitude: locationData.coordinates.latitude,
            longitude: locationData.coordinates.longitude,
          },
          formattedAddress: locationData.formattedAddress || newRetailer.address,
        };
      } else {
        // fallback coords if user didn't pick location — match Signup.jsx defaults
        locationParams = {
          coordinates: {
            latitude: 20.0983745,
            longitude: 73.9296103,
          },
          formattedAddress: newRetailer.address,
        };
      }

      const signupData = {
        phone: newRetailer.contactNo,
        fullName: newRetailer.fullName,
        shopName: newRetailer.shopName,
        address: locationData?.formattedAddress || newRetailer.address,
        contactNo: newRetailer.contactNo,
        userType: 'admin',
        // ...(userType === 'admin' && { shopName }),
        ...locationParams, // flattened fields expected by backend
      };

      console.log('📤 Creating retailer with payload:', JSON.stringify(signupData, null, 2));

      const response = await fetch(`${API_AUTH}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signupData),
      });

      console.log('📥 Signup response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Retailer creation response:', data);

      if (data.success) {
        // backend might return userId or user._id — be defensive
        setUserId(data.userId || data.user?._id || null);
        if (!isResend) setOtpShown(true);
        Alert.alert('Success', isResend ? 'OTP resent successfully!' : (data.message || 'Retailer created! Please verify OTP.'));
      } else {
        throw new Error(data.message || 'Retailer creation failed');
      }
    } catch (error) {
      console.error('❌ Retailer Creation Error:', error);

      if (error.message.includes('coordinates')) {
        Alert.alert('Location Error', 'Please select a valid location from suggestions.');
      } else if (error.message.includes('Network request failed')) {
        Alert.alert('Network Error', 'Please check your internet connection and try again.');
      } else {
        Alert.alert('Error', error.message || 'Failed to create retailer. Please try again.');
      }
    } finally {
      setAddRetailerLoading(false);
      if (isResend) setResendLoading(false);
    }
  };

  // ----- UPDATED: handleVerifyOtp to match Signup.jsx -----
  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      Alert.alert('Validation Error', 'Please enter complete 6-digit OTP');
      return;
    }

    setAddRetailerLoading(true);

    try {
      const verifyData = {
        phone: newRetailer.contactNo,
        otp: otpCode,
      };

      const response = await fetch(`${API_AUTH}/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(verifyData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'OTP verification failed');
      }

      // success path
      Alert.alert('Success', data.message || 'Retailer account verified successfully!');

      // Reset form and close modal
      resetAddRetailerForm();
      setShowAddRetailerModal(false);

      // Refresh retailer list in UI
      fetchRetailers();
    } catch (error) {
      console.error('Verification Error:', error);
      if (error.message === 'Network request failed') {
        Alert.alert('Network Error', 'Please check your internet connection and try again.');
      } else {
        Alert.alert('Error', error.message || 'Failed to verify OTP. Please try again.');
      }
    } finally {
      setAddRetailerLoading(false);
    }
  };

  const resetAddRetailerForm = () => {
    setNewRetailer({
      fullName: '',
      shopName: '',
      contactNo: '',
      address: '',
    });
    setLocationData(null);
    setOtp(['', '', '', '', '', '']);
    setOtpShown(false);
    setUserId(null);
  };

  const handleOtpChange = (text, index) => {
    if (/^\d*$/.test(text)) {
      const newOtp = [...otp];
      newOtp[index] = text;
      setOtp(newOtp);
    }
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
      <View className="flex-row items-center px-2 py-1 rounded-lg gap-1" style={{ backgroundColor: config.bgColor }}>
        <MaterialIcons name={config.icon} size={12} color={config.color} />
        <Text className="text-xs font-bold" style={{ color: config.color }}>{config.text}</Text>
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
      <View className="flex-row items-center gap-1.5">
        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: config.color }} />
        <Text className="text-xs font-semibold" style={{ color: config.color }}>{config.text}</Text>
      </View>
    );
  };

  const SummaryCard = ({ title, value, subtitle, color, icon, onPress }) => {
    return (
      <TouchableOpacity 
        className="bg-white p-4 rounded-xl border-l-4 shadow-sm"
        style={{ 
          width: (width - 88) / 2,
          borderLeftColor: color,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 4,
          elevation: 2,
        }} 
        onPress={onPress} 
        activeOpacity={0.7}
      >
        <View className="flex-row justify-between items-center mb-2">
          <View 
            className="w-9 h-9 rounded-lg justify-center items-center"
            style={{ backgroundColor: color }}
          >
            {icon}
          </View>
          <Text className="text-xl font-bold text-slate-800">{value}</Text>
        </View>
        <Text className="text-sm text-slate-500 font-semibold mb-0.5">{title}</Text>
        {subtitle && <Text className="text-xs text-slate-400 font-medium">{subtitle}</Text>}
      </TouchableOpacity>
    );
  };

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
      // fetch full details from backend
      fetchRetailerDetails(retailer.id);
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
        <TouchableOpacity 
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 2,
          }}
          onPressIn={handlePressIn} 
          onPressOut={handlePressOut} 
          onPress={handleViewDetails} 
          activeOpacity={0.8}
        >
          <View className="flex-row justify-between items-start mb-3">
            <View className="flex-1">
              <Text className="text-lg font-bold text-slate-800 mb-0.5">{retailer.shopName}</Text>
              <Text className="text-sm text-slate-500">by {retailer.ownerName}</Text>
            </View>
            <StatusBadge status={retailer.status} />
          </View>

          <View className="gap-1.5 mb-3">
            <View className="flex-row items-center gap-2">
              <Feather name="map-pin" size={14} color="#64748B" />
              <Text className="text-sm text-slate-500">{retailer.location}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Feather name="phone" size={14} color="#64748B" />
              <Text className="text-sm text-slate-500">{retailer.mobile}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="calendar-today" size={14} color="#64748B" />
              <Text className="text-sm text-slate-500">Joined {retailer.joinDate ? new Date(retailer.joinDate).toLocaleDateString() : '—'}</Text>
            </View>
          </View>

          {retailer.status === 'active' && (
            <View className="bg-slate-50 p-3 rounded-lg mb-3">
              <View className="flex-row justify-between mb-2">
                <View className="items-center">
                  <Text className="text-base font-bold text-slate-800 mb-0.5">{retailer.totalOrders}</Text>
                  <Text className="text-xs text-slate-500 font-medium">Orders</Text>
                </View>
                <View className="items-center">
                  <Text className="text-base font-bold text-slate-800 mb-0.5">₹{(retailer.totalRevenue / 1000).toFixed(0)}K</Text>
                  <Text className="text-xs text-slate-500 font-medium">Revenue</Text>
                </View>
                <View className="items-center">
                  <Text className="text-base font-bold text-slate-800 mb-0.5">{retailer.products}</Text>
                  <Text className="text-xs text-slate-500 font-medium">Products</Text>
                </View>
                <View className="items-center">
                  <View className="flex-row items-center gap-0.5">
                    <MaterialIcons name="star" size={14} color="#F59E0B" />
                    <Text className="text-sm font-bold text-slate-800">{retailer.rating}</Text>
                  </View>
                  <Text className="text-xs text-slate-500 font-medium">Rating</Text>
                </View>
              </View>
              <PerformanceIndicator performance={retailer.performance} />
            </View>
          )}

          <View className="flex-row gap-2">
            {retailer.status === 'pending' && (
              <TouchableOpacity 
                className="flex-row items-center px-3 py-2 rounded-lg gap-1 flex-1 justify-center bg-emerald-500"
                onPress={() => handleQuickAction('approve')}
              >
                <MaterialIcons name="check" size={16} color="#FFFFFF" />
                <Text className="text-xs text-white font-semibold">Approve</Text>
              </TouchableOpacity>
            )}

            {retailer.status === 'active' && (
              <TouchableOpacity 
                className="flex-row items-center px-3 py-2 rounded-lg gap-1 flex-1 justify-center bg-red-500"
                onPress={() => handleQuickAction('suspend')}
              >
                <MaterialIcons name="block" size={16} color="#FFFFFF" />
                <Text className="text-xs text-white font-semibold">Suspend</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              className="flex-row items-center px-3 py-2 rounded-lg gap-1 flex-1 justify-center bg-blue-500"
              onPress={() => handleQuickAction('contact')}
            >
              <Feather name="phone" size={16} color="#FFFFFF" />
              <Text className="text-xs text-white font-semibold">Contact</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="flex-row items-center px-3 py-2 rounded-lg gap-1 flex-1 justify-center border border-blue-500"
              onPress={handleViewDetails}
            >
              <Feather name="eye" size={16} color="#3B82F6" />
              <Text className="text-xs font-semibold" style={{ color: '#3B82F6' }}>View</Text>
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
        {filters.map(filter => (
          <TouchableOpacity 
            key={filter.key} 
            className={`flex-row items-center px-4 py-2 rounded-full mr-2 border ${filterStatus === filter.key ? 'bg-blue-500 border-blue-500' : 'bg-slate-50 border-slate-200'}`}
            onPress={() => setFilterStatus(filter.key)}
          >
            <Text className={`text-sm font-semibold mr-1.5 ${filterStatus === filter.key ? 'text-white' : 'text-slate-500'}`}>{filter.label}</Text>
            <View className={`px-1.5 py-0.5 rounded ${filterStatus === filter.key ? 'bg-blue-700' : 'bg-slate-200'}`}>
              <Text className="text-xs font-bold text-slate-500">{filter.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // ---------- Render ----------
  return (
    <Animated.View className="flex-1 bg-slate-50" style={{ opacity: fadeAnim }}>
      {/* Header Section */}
      <View className="flex-row justify-between items-center p-5 bg-white border-b border-slate-200">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-slate-800 mb-1">Retailers Management</Text>
          <Text className="text-base text-slate-500">Manage all retailers on the platform</Text>
        </View>
        <TouchableOpacity 
          className="flex-row items-center bg-emerald-500 px-4 py-2.5 rounded-xl gap-1.5"
          onPress={() => setShowAddRetailerModal(true)}
        >
          <MaterialIcons name="person-add" size={20} color="#FFFFFF" />
          <Text className="text-sm text-white font-semibold">Add Retailer</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        className="flex-1" 
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} 
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Cards */}
        <View className="bg-white mx-4 mb-0 rounded-2xl p-5 shadow-sm">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-slate-800">Platform Overview</Text>
            <TouchableOpacity onPress={onRefresh}>
              <MaterialIcons name="refresh" size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
          <View className="flex-row flex-wrap gap-3">
            <SummaryCard title="Total Retailers" value={retailersData.summary.total} subtitle={`${retailersData.summary.growth}% growth`} color="#3B82F6" icon={<FontAwesome5 name="store" size={18} color="#FFFFFF" />} onPress={() => setFilterStatus('all')} />
            <SummaryCard title="Active" value={retailersData.summary.active} subtitle="Currently operating" color="#10B981" icon={<MaterialIcons name="check-circle" size={20} color="#FFFFFF" />} onPress={() => setFilterStatus('active')} />
            <SummaryCard title="Pending" value={retailersData.summary.pending} subtitle="Awaiting approval" color="#F59E0B" icon={<MaterialIcons name="pending" size={20} color="#FFFFFF" />} onPress={() => setFilterStatus('pending')} />
            <SummaryCard title="Suspended" value={retailersData.summary.suspended} subtitle="Temporarily inactive" color="#EF4444" icon={<MaterialIcons name="block" size={20} color="#FFFFFF" />} onPress={() => setFilterStatus('suspended')} />
          </View>
        </View>

        {/* Search and Filters */}
        <View className="bg-white mx-4 mb-0 rounded-2xl p-5 shadow-sm">
          <View className="mb-4">
            <View className="flex-row items-center bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 gap-3">
              <Feather name="search" size={20} color="#64748B" />
              <TextInput 
                className="flex-1 text-base text-slate-800" 
                placeholder="Search retailers by name, owner, or location..." 
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

          <StatusFilter />
        </View>

        {/* Retailers List */}
        <View className="bg-white mx-4 mb-0 rounded-2xl p-5 shadow-sm">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-slate-800">
              {filterStatus === 'all' ? 'All Retailers' : filterStatus === 'active' ? 'Active Retailers' : filterStatus === 'pending' ? 'Pending Approval' : 'Suspended Retailers'}
            </Text>
            <Text className="text-sm text-slate-500 font-medium">{filteredRetailers.length} results</Text>
          </View>

          {loading ? (
            <View className="p-6 items-center">
              <ActivityIndicator size="large" />
            </View>
          ) : filteredRetailers.length === 0 ? (
            <View className="items-center py-10">
              <MaterialIcons name="store" size={48} color="#E2E8F0" />
              <Text className="text-lg font-bold text-slate-500 mt-3 mb-2">No retailers found</Text>
              <Text className="text-sm text-slate-400 text-center">{searchQuery ? 'Try adjusting your search terms' : 'No retailers match the selected filters'}</Text>
            </View>
          ) : (
            <View className="gap-3">
              {filteredRetailers.map(retailer => (
                <RetailerCard key={retailer.id} retailer={retailer} />
              ))}
            </View>
          )}
        </View>

        {/* Bottom Spacer */}
        <View className="h-5" />
      </ScrollView>

      {/* Retailer Details Modal */}
      <Modal visible={showDetailsModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => {
        setShowDetailsModal(false);
        setSelectedRetailer(null);
        setDetailsLoading(false);
      }}>
        {detailsLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" />
            <Text className="mt-3 text-slate-500">Loading retailer details...</Text>
            <TouchableOpacity onPress={() => { setShowDetailsModal(false); setSelectedRetailer(null); }} className="mt-4.5">
              <Text className="text-blue-500 font-bold">Close</Text>
            </TouchableOpacity>
          </View>
        ) : selectedRetailer && (
          <View className="flex-1 bg-white">
            <View className="flex-row justify-between items-center p-5 border-b border-slate-200">
              <Text className="text-xl font-bold text-slate-800">{selectedRetailer.retailer.shopName}</Text>
              <TouchableOpacity className="p-1" onPress={() => { setShowDetailsModal(false); setSelectedRetailer(null); }}>
                <MaterialIcons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView className="flex-1">
              <View className="p-5 border-b border-slate-100">
                <Text className="text-2xl font-bold text-slate-800 mb-1">{selectedRetailer.retailer.shopName}</Text>
                <Text className="text-base text-slate-500 mb-3">Owner: {selectedRetailer.retailer.ownerName}</Text>
                <StatusBadge status={selectedRetailer.retailer.isActive ? 'active' : 'pending'} />
                <Text className="mt-2 text-slate-500">
                  Service radius: {selectedRetailer.retailer.serviceRadius ?? '—'} km
                </Text>
                <Text className="mt-1 text-slate-500">
                  Created: {selectedRetailer.retailer.createdAt ? new Date(selectedRetailer.retailer.createdAt).toLocaleString() : '—'}
                </Text>
                <Text className="mt-0.5 text-slate-500">
                  Updated: {selectedRetailer.retailer.updatedAt ? new Date(selectedRetailer.retailer.updatedAt).toLocaleString() : '—'}
                </Text>
              </View>

              <View className="p-5 border-b border-slate-100">
                <Text className="text-lg font-bold text-slate-800 mb-3">Contact Information</Text>
                <View className="gap-3">
                  <View className="flex-row items-center gap-3">
                    <Feather name="phone" size={16} color="#64748B" />
                    <Text className="text-base text-slate-700">{selectedRetailer.retailer.mobile || '—'}</Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <Feather name="map-pin" size={16} color="#64748B" />
                    <Text className="text-base text-slate-700">{selectedRetailer.retailer.location?.formattedAddress || selectedRetailer.retailer.address || '—'}</Text>
                  </View>
                  {selectedRetailer.retailer.location?.coordinates && (
                    <View className="flex-row items-center gap-3">
                      <MaterialIcons name="location-on" size={16} color="#64748B" />
                      <Text className="text-base text-slate-700">
                        {`Lat: ${selectedRetailer.retailer.location.coordinates.latitude}, Lon: ${selectedRetailer.retailer.location.coordinates.longitude}`}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View className="p-5 border-b border-slate-100">
                <Text className="text-lg font-bold text-slate-800 mb-4">Performance</Text>
                <View className="flex-row flex-wrap gap-4">
                  <View className="w-[45%] bg-slate-50 p-4 rounded-lg items-center">
                    <Text className="text-base font-bold text-slate-800">{selectedRetailer.performance?.totalOrders ?? 0}</Text>
                    <Text className="text-sm text-slate-500">Total Orders</Text>
                  </View>
                  <View className="w-[45%] bg-slate-50 p-4 rounded-lg items-center">
                    <Text className="text-base font-bold text-slate-800">₹{(selectedRetailer.performance?.totalRevenue ?? 0).toLocaleString()}</Text>
                    <Text className="text-sm text-slate-500">Total Revenue</Text>
                  </View>
                  <View className="w-[45%] bg-slate-50 p-4 rounded-lg items-center">
                    <Text className="text-base font-bold text-slate-800">{selectedRetailer.performance?.completedOrders ?? 0}</Text>
                    <Text className="text-sm text-slate-500">Completed</Text>
                  </View>
                  <View className="w-[45%] bg-slate-50 p-4 rounded-lg items-center">
                    <Text className="text-base font-bold text-slate-800">{selectedRetailer.performance?.pendingOrders ?? 0}</Text>
                    <Text className="text-sm text-slate-500">Pending</Text>
                  </View>
                </View>
              </View>

              <View className="p-5 border-b border-slate-100">
                <Text className="text-lg font-bold text-slate-800 mb-3">Recent Orders</Text>
                {(selectedRetailer.recentOrders || []).length === 0 ? (
                  <Text className="text-sm text-slate-700 font-medium">No recent orders</Text>
                ) : (
                  (selectedRetailer.recentOrders || []).map((o, idx) => (
                    <View key={idx} className="flex-row justify-between items-center p-3 bg-slate-50 rounded-lg mb-2">
                      <View>
                        <Text className="font-bold text-slate-800">{o.orderId || o.orderNumber || '—'}</Text>
                        <Text className="text-slate-500">{o.customerName || '—'}</Text>
                        <Text className="text-slate-400 text-xs">{o.status} • {o.createdAt ? new Date(o.createdAt).toLocaleString() : '—'}</Text>
                      </View>
                      <Text className="font-bold text-slate-800">₹{o.amount ?? 0}</Text>
                    </View>
                  ))
                )}
              </View>

              <View className="flex-row gap-3 p-5">
                <TouchableOpacity className="flex-1 py-3 rounded-lg bg-blue-500 items-center">
                  <Text className="text-base font-semibold text-white">Edit Details</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-1 py-3 rounded-lg border border-blue-500 items-center">
                  <Text className="text-base font-semibold text-blue-500">View Full Profile</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* Add Retailer Modal */}
      <Modal visible={showAddRetailerModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddRetailerModal(false)}>
        <View className="flex-1 bg-white">
          <View className="flex-row justify-between items-center p-5 border-b border-slate-200">
            <Text className="text-xl font-bold text-slate-800">Add New Retailer</Text>
            <TouchableOpacity className="p-1" onPress={() => {
              setShowAddRetailerModal(false);
              resetAddRetailerForm();
            }}>
              <MaterialIcons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {!otpShown ? (
              <>
                <View className="p-5 border-b border-slate-100">
                  <Text className="text-lg font-bold text-slate-800 mb-4">Retailer Information</Text>
                  
                  <View className="flex-row items-center border-2 border-slate-200 rounded-xl px-4 py-1 mb-4 bg-slate-50 min-h-14">
                    <TextInput
                      className="flex-1 text-base text-slate-800 font-medium py-2"
                      placeholder="Full Name *"
                      placeholderTextColor="#94a3b8"
                      value={newRetailer.fullName}
                      onChangeText={(text) => setNewRetailer(prev => ({ ...prev, fullName: text }))}
                    />
                  </View>

                  <View className="flex-row items-center border-2 border-slate-200 rounded-xl px-4 py-1 mb-4 bg-slate-50 min-h-14">
                    <TextInput
                      className="flex-1 text-base text-slate-800 font-medium py-2"
                      placeholder="Shop Name *"
                      placeholderTextColor="#94a3b8"
                      value={newRetailer.shopName}
                      onChangeText={(text) => setNewRetailer(prev => ({ ...prev, shopName: text }))}
                    />
                  </View>

                  <View className="mb-4">
                    <Text className="text-base text-slate-800 font-medium mb-2">Address *</Text>
                    <LocationPicker
                      onLocationSelect={handleLocationSelect}
                      placeholder="Enter shop address"
                      showCurrentLocation={true}
                    />
                  </View>

                  <View className="flex-row items-center border-2 border-slate-200 rounded-xl px-4 py-1 mb-4 bg-slate-50 min-h-14">
                    <View className="flex-row items-center pr-3 border-r-2 border-slate-200">
                      <Text className="text-lg mr-1.5">🇮🇳</Text>
                      <Text className="text-sm text-slate-800 font-semibold">+91</Text>
                    </View>
                    <TextInput
                      className="flex-1 text-base text-slate-800 font-medium py-2 ml-3"
                      placeholder="Contact Number *"
                      placeholderTextColor="#94a3b8"
                      keyboardType="phone-pad"
                      maxLength={10}
                      value={newRetailer.contactNo}
                      onChangeText={(text) => setNewRetailer(prev => ({ ...prev, contactNo: text }))}
                    />
                  </View>
                </View>

                <View className="flex-row gap-3 p-5">
                  <TouchableOpacity
                    className={`flex-1 py-3 rounded-lg items-center ${addRetailerLoading ? 'bg-gray-400' : 'bg-blue-500'}`}
                    onPress={() => handleGetOtp(false)}
                    disabled={addRetailerLoading}
                  >
                    {addRetailerLoading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text className="text-base font-semibold text-white">Create Retailer</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View className="p-5 border-b border-slate-100">
                  <Text className="text-lg text-slate-900 font-semibold mb-2 text-center">Verify Retailer Account</Text>
                  <Text className="text-sm text-slate-500 mb-6 text-center">
                    OTP sent to +91 {newRetailer.contactNo}
                  </Text>
                  
                  <View className="flex-row justify-between mb-6 px-2.5">
                    {otp.map((value, index) => (
                      <TextInput
                        key={index}
                        className={`w-12 h-12 border-2 rounded-lg text-xl font-bold text-slate-900 bg-white text-center ${value ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}
                        style={{
                          shadowColor: value ? '#3b82f6' : '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: value ? 0.2 : 0.1,
                          shadowRadius: value ? 6 : 4,
                          elevation: value ? 5 : 3,
                        }}
                        keyboardType="number-pad"
                        maxLength={1}
                        value={value}
                        onChangeText={(text) => handleOtpChange(text, index)}
                        textAlign="center"
                        editable={!addRetailerLoading}
                        selectTextOnFocus
                      />
                    ))}
                  </View>
                </View>

                <View className="flex-row gap-3 p-5">
                  <TouchableOpacity
                    className={`flex-1 py-3 rounded-lg items-center ${addRetailerLoading ? 'bg-gray-400' : 'bg-blue-500'}`}
                    onPress={handleVerifyOtp}
                    disabled={addRetailerLoading}
                  >
                    {addRetailerLoading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text className="text-base font-semibold text-white">Verify & Complete</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    className="flex-1 py-3 rounded-lg border border-blue-500 items-center"
                    onPress={() => handleGetOtp(true)}
                    disabled={resendLoading}
                  >
                    {resendLoading ? (
                      <ActivityIndicator color="#3b82f6" size="small" />
                    ) : (
                      <Text className="text-base font-semibold text-blue-500">Resend OTP</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </Animated.View>
  );
}