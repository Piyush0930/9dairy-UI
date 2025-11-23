import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// API Service functions
const customerAPI = {
  getProfile: async (token) => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/customer/profile`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch profile: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  createUpdateProfile: async (profileData, token) => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/customer/profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update profile: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  getOrderHistory: async (token) => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/customer/orders`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch order history: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw error;
    }
  }
};

function EditableField({ label, value, onChange, placeholder, keyboardType = "default", multiline = false, maxLength }) {
  return (
    <View className="mb-5">
      <Text className="text-sm font-medium text-gray-500 mb-2">{label}</Text>
      <TextInput
        className={`border border-gray-300 rounded-lg px-4 py-3 text-base text-gray-900 bg-white ${multiline ? 'min-h-20 text-top' : ''}`}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.light.textSecondary}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
      />
    </View>
  );
}

export default function Account() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { 
    authToken, 
    isLoading: authLoading, 
    logout, 
    validateToken,
    isAuthenticated 
  } = useAuth();
  
  const [customerProfile, setCustomerProfile] = useState(null);
  const [orderHistory, setOrderHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Form state for all editable fields
  const [editForm, setEditForm] = useState({
    // Personal Info
    fullName: '',
    email: '',
    alternatePhone: '',
    dateOfBirth: '',
    dateOfBirthDate: null,

    // Delivery Address
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    landmark: ''
  });

  // Enhanced API error handler
  const handleApiError = (error, customMessage = null) => {
    console.error('API Error:', error);
    
    // Check for authentication errors
    if (error.message?.includes('401') || 
        error.message?.includes('Unauthorized') ||
        error.message?.includes('token') ||
        error.response?.status === 401) {
      
      console.log('🔐 Authentication error detected, logging out...');
      Alert.alert(
        "Session Expired",
        "Your session has expired. Please login again.",
        [
          {
            text: "OK",
            onPress: () => logout()
          }
        ]
        
      );
      return true; // Indicates auth error
    }
    
    // Show custom or generic error
    Alert.alert("Error", customMessage || "Something went wrong. Please try again.");
    return false; // Indicates non-auth error
  };

  // Auto-redirect when not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log('🔒 User not authenticated, redirecting to login...');
      setTimeout(() => {
        router.replace('/Login');
      }, 100);
    }
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (!authLoading && authToken && isAuthenticated) {
      loadProfile();
      loadOrderHistory();
    } else if (!authLoading && (!authToken || !isAuthenticated)) {
      console.log('❌ No auth token or not authenticated');
      setLoading(false);
    }
  }, [authToken, authLoading, isAuthenticated]);

  // Add token validation before API calls
  const validateAuthBeforeCall = async () => {
    if (!authToken || !isAuthenticated) {
      Alert.alert("Session Expired", "Please login again");
      return false;
    }

    const isValid = await validateToken();
    if (!isValid) {
      Alert.alert("Session Expired", "Please login again");
      return false;
    }

    return true;
  };

  const loadProfile = async () => {
    const isValid = await validateAuthBeforeCall();
    if (!isValid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await customerAPI.getProfile(authToken);
      setCustomerProfile(response);
      initializeForm(response);
    } catch (error) {
      handleApiError(error, "Failed to load profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const initializeForm = (profile) => {
    if (profile) {
      const dateOfBirth = profile.personalInfo?.dateOfBirth;
      setEditForm({
        // Personal Info
        fullName: profile.personalInfo?.fullName || '',
        email: profile.personalInfo?.email || '',
        alternatePhone: profile.personalInfo?.alternatePhone || '',
        dateOfBirth: dateOfBirth || '',
        dateOfBirthDate: dateOfBirth ? new Date(dateOfBirth) : null,

        // Delivery Address
        addressLine1: profile.deliveryAddress?.addressLine1 || '',
        addressLine2: profile.deliveryAddress?.addressLine2 || '',
        city: profile.deliveryAddress?.city || '',
        state: profile.deliveryAddress?.state || '',
        pincode: profile.deliveryAddress?.pincode || '',
        landmark: profile.deliveryAddress?.landmark || ''
      });
    }
  };

  const loadOrderHistory = async () => {
    const isValid = await validateAuthBeforeCall();
    if (!isValid) return;

    try {
      setLoadingOrders(true);
      const response = await customerAPI.getOrderHistory(authToken);
      setOrderHistory(response || []);
    } catch (error) {
      handleApiError(error, "Failed to load order history. Please try again.");
    } finally {
      setLoadingOrders(false);
    }
  };

  const refreshProfile = async () => {
    setRefreshing(true);
    await loadProfile();
    await loadOrderHistory();
    setRefreshing(false);
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing - reset form to original values
      initializeForm(customerProfile);
    }
    setIsEditing(!isEditing);
  };

  const onChangeDate = (event, selectedDate) => {
    const currentDate = selectedDate || editForm.dateOfBirthDate;
    setShowDatePicker(Platform.OS === 'ios');
    setEditForm(prev => ({
      ...prev,
      dateOfBirthDate: currentDate,
      dateOfBirth: currentDate ? currentDate.toISOString().split('T')[0] : ''
    }));
  };

  const showDatepicker = () => {
    setShowDatePicker(true);
  };

  const handleSaveProfile = async () => {
    const isValid = await validateAuthBeforeCall();
    if (!isValid) return;

    try {
      setSaving(true);

      const profileData = {
        personalInfo: {
          fullName: editForm.fullName.trim(),
          email: editForm.email.trim(),
          alternatePhone: editForm.alternatePhone.trim(),
          dateOfBirth: editForm.dateOfBirth.trim() || null
        },
        deliveryAddress: {
          addressLine1: editForm.addressLine1.trim(),
          addressLine2: editForm.addressLine2.trim(),
          city: editForm.city.trim(),
          state: editForm.state.trim(),
          pincode: editForm.pincode.trim(),
          landmark: editForm.landmark.trim(),
          coordinates: {
            latitude: null,
            longitude: null
          },
          formattedAddress: ''
        }
      };

      await customerAPI.createUpdateProfile(profileData, authToken);
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully");
      await loadProfile(); // Refresh profile data
    } catch (error) {
      handleApiError(error, `Failed to update profile: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  // Enhanced logout handler
  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { 
          text: "Cancel", 
          style: "cancel" 
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              console.log('👋 User initiated logout...');
              await logout();
              // No need to navigate here - the AuthContext logout already handles navigation
            } catch (error) {
              console.error('❌ Logout error in UI:', error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatWalletBalance = (balance) => {
    return `₹${balance?.toFixed(2) || '0.00'}`;
  };

  const getFormattedAddress = () => {
    if (!customerProfile?.deliveryAddress) return 'No address set';

    const addr = customerProfile.deliveryAddress;
    if (addr.formattedAddress && typeof addr.formattedAddress === 'string') return addr.formattedAddress;

    const parts = [
      addr.addressLine1,
      addr.addressLine2,
      addr.city,
      addr.state,
      addr.pincode
    ].filter(part => part && part.trim() !== '');

    return parts.join(', ') || 'Address not complete';
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'cancelled':
        return '#F44336';
      case 'processing':
        return '#2196F3';
      default:
        return '#9E9E9E';
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
        <Text className="mt-4 text-base text-gray-500">Loading profile...</Text>
      </View>
    );
  }

  if (!customerProfile) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50" style={{ paddingTop: insets.top }}>
        <Text className="text-base text-gray-500">Failed to load profile. Please try again.</Text>
        <TouchableOpacity className="bg-blue-500 px-5 py-2.5 rounded-lg mt-4" onPress={loadProfile}>
          <Text className="text-white text-base font-semibold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header with Edit Button */}
      <View className="bg-white px-5 pt-5 pb-5 border-b border-gray-100">
        <View className="flex-row justify-between items-center mb-5">
          <Text className="text-2xl font-bold text-gray-900">My Profile</Text>
          {!isEditing && (
            <TouchableOpacity
              className="flex-row items-center bg-blue-500 px-4 py-2 rounded-lg gap-1.5"
              onPress={handleEditToggle}
              disabled={saving}
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={Colors.light.white}
              />
              <Text className="text-white text-sm font-semibold">Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-row items-center gap-4">
          <View className="w-20 h-20 rounded-full bg-blue-50 justify-center items-center overflow-hidden relative">
            <Image
              source={{ uri: "https://img.icons8.com/color/96/user.png" }}
              className="w-15 h-15"
            />
            {customerProfile?.subscription?.isActive && (
              <View className="absolute -bottom-0.5 bg-blue-500 px-2 py-1 rounded-xl">
                <Text className="text-white text-xs font-bold">Premium</Text>
              </View>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-900 mb-1">
              {customerProfile?.personalInfo?.fullName || "Guest User"}
            </Text>
            <Text className="text-sm text-gray-500 font-normal mb-2">
              {customerProfile?.personalInfo?.email || "No email set"}
            </Text>
            <View className="flex-row items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-2xl self-start">
              <Ionicons name="wallet-outline" size={16} color={Colors.light.tint} />
              <Text className="text-sm font-semibold text-blue-500">
                {formatWalletBalance(customerProfile?.walletBalance)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="pt-5 pb-25"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshProfile}
            colors={[Colors.light.tint]}
          />
        }
      >
        {/* Personal Information Section */}
        <View className="bg-white mx-4 rounded-xl mb-4 overflow-hidden shadow-sm shadow-black/5">
          <View className="flex-row items-center px-4 py-4 border-b border-gray-100 gap-3">
            <Ionicons name="person-circle-outline" size={20} color={Colors.light.tint} />
            <Text className="text-lg font-semibold text-gray-900">Personal Information</Text>
          </View>
          <View className="p-4">
            {isEditing ? (
              <>
                <EditableField
                  label="Full Name"
                  value={editForm.fullName}
                  onChange={(text) => setEditForm(prev => ({ ...prev, fullName: text }))}
                  placeholder="Enter your full name"
                />
                <EditableField
                  label="Email"
                  value={editForm.email}
                  onChange={(text) => setEditForm(prev => ({ ...prev, email: text }))}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                />
                <EditableField
                  label="Alternate Phone"
                  value={editForm.alternatePhone}
                  onChange={(text) => setEditForm(prev => ({ ...prev, alternatePhone: text }))}
                  placeholder="Enter alternate phone number"
                  keyboardType="phone-pad"
                  maxLength={10}
                />
                <View className="mb-5">
                  <Text className="text-sm font-medium text-gray-500 mb-2">Date of Birth</Text>
                  <TouchableOpacity
                    className="border border-gray-300 rounded-lg px-4 py-3 text-base bg-white"
                    onPress={showDatepicker}
                  >
                    <Text className={`text-base ${editForm.dateOfBirth ? 'text-gray-900' : 'text-gray-500'}`}>
                      {editForm.dateOfBirth ? formatDate(editForm.dateOfBirth) : 'Select date of birth'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {showDatePicker && (
                  <DateTimePicker
                    testID="dateTimePicker"
                    value={editForm.dateOfBirthDate || new Date()}
                    mode="date"
                    is24Hour={true}
                    display="default"
                    onChange={onChangeDate}
                    maximumDate={new Date()}
                  />
                )}
              </>
            ) : (
              <>
                <View className="flex-row justify-between items-start mb-4">
                  <Text className="text-sm font-medium text-gray-500 flex-1">Full Name</Text>
                  <Text className="text-base font-normal text-gray-900 flex-1 text-right">
                    {customerProfile?.personalInfo?.fullName || 'Not set'}
                  </Text>
                </View>
                <View className="flex-row justify-between items-start mb-4">
                  <Text className="text-sm font-medium text-gray-500 flex-1">Email</Text>
                  <Text className="text-base font-normal text-gray-900 flex-1 text-right">
                    {customerProfile?.personalInfo?.email || 'Not set'}
                  </Text>
                </View>
                <View className="flex-row justify-between items-start mb-4">
                  <Text className="text-sm font-medium text-gray-500 flex-1">Alternate Phone</Text>
                  <Text className="text-base font-normal text-gray-900 flex-1 text-right">
                    {customerProfile?.personalInfo?.alternatePhone || 'Not set'}
                  </Text>
                </View>
                <View className="flex-row justify-between items-start mb-4">
                  <Text className="text-sm font-medium text-gray-500 flex-1">Date of Birth</Text>
                  <Text className="text-base font-normal text-gray-900 flex-1 text-right">
                    {formatDate(customerProfile?.personalInfo?.dateOfBirth)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Delivery Address Section */}
        <View className="bg-white mx-4 rounded-xl mb-4 overflow-hidden shadow-sm shadow-black/5">
          <View className="flex-row items-center px-4 py-4 border-b border-gray-100 gap-3">
            <Ionicons name="location-outline" size={20} color={Colors.light.tint} />
            <Text className="text-lg font-semibold text-gray-900">Delivery Address</Text>
          </View>
          <View className="p-4">
            {isEditing ? (
              <>
                <EditableField
                  label="Address Line 1"
                  value={editForm.addressLine1}
                  onChange={(text) => setEditForm(prev => ({ ...prev, addressLine1: text }))}
                  placeholder="Enter address line 1"
                />
                <EditableField
                  label="Address Line 2"
                  value={editForm.addressLine2}
                  onChange={(text) => setEditForm(prev => ({ ...prev, addressLine2: text }))}
                  placeholder="Enter address line 2"
                />
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <EditableField
                      label="City"
                      value={editForm.city}
                      onChange={(text) => setEditForm(prev => ({ ...prev, city: text }))}
                      placeholder="City"
                    />
                  </View>
                  <View className="flex-1">
                    <EditableField
                      label="State"
                      value={editForm.state}
                      onChange={(text) => setEditForm(prev => ({ ...prev, state: text }))}
                      placeholder="State"
                    />
                  </View>
                </View>
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <EditableField
                      label="Pincode"
                      value={editForm.pincode}
                      onChange={(text) => setEditForm(prev => ({ ...prev, pincode: text }))}
                      placeholder="Pincode"
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  <View className="flex-1">
                    <EditableField
                      label="Landmark"
                      value={editForm.landmark}
                      onChange={(text) => setEditForm(prev => ({ ...prev, landmark: text }))}
                      placeholder="Landmark"
                    />
                  </View>
                </View>
              </>
            ) : (
              <View className="bg-gray-50 p-4 rounded-xl border-l-4 border-l-blue-500">
                <Text className="text-base font-medium text-gray-900 mb-2 leading-5.5">
                  {getFormattedAddress()}
                </Text>
                {customerProfile?.deliveryAddress?.landmark && (
                  <Text className="text-sm text-gray-500 mb-1">
                    Landmark: {customerProfile.deliveryAddress.landmark}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>

       

        {/* Save and Cancel Buttons when editing */}
        {isEditing && (
          <View className="px-4 mb-5">
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 items-center justify-center bg-white border border-blue-500 py-4 rounded-xl"
                onPress={handleEditToggle}
                disabled={saving}
              >
                <Text className="text-blue-500 text-base font-semibold">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 flex-row items-center justify-center bg-blue-500 py-4 rounded-xl gap-2"
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.light.white} />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={20} color={Colors.light.white} />
                    <Text className="text-white text-base font-semibold">Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Logout Button */}
        <View className="bg-white mx-4 rounded-xl mb-4 overflow-hidden shadow-sm shadow-black/5">
          <TouchableOpacity
            className="flex-row items-center py-4.5 px-5 gap-4"
            onPress={handleLogout}
          >
            <MaterialIcons name="logout" size={24} color="#FF6B6B" />
            <Text className="text-base font-medium text-red-400">Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy Policy Link */}
        <View className="bg-white mx-4 rounded-xl mb-4 overflow-hidden shadow-sm shadow-black/5">
          <TouchableOpacity
            className="flex-row items-center py-4.5 px-5 gap-4"
            onPress={() => router.push('/privacy-policy')}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color={Colors.light.text} />
            <Text className="text-base font-medium text-gray-900">Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        <View className="mt-8 items-center px-5">
          <Text className="text-sm text-gray-500 mb-2">Version 1.0.0</Text>
          <Text className="text-sm text-gray-500 font-medium">Made with ❤️ by Dairy Nine</Text>
        </View>

        <View className="h-5" />
      </ScrollView>
    </View>
  );
}