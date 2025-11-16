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
  StyleSheet,
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
    <View style={styles.editableField}>
      <Text style={styles.editableLabel}>{label}</Text>
      <TextInput
        style={[styles.editableInput, multiline && styles.multilineInput]}
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
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.light.tint} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!customerProfile) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.loadingText}>Failed to load profile. Please try again.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadProfile}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with Edit Button */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>My Profile</Text>
          {!isEditing && (
            <TouchableOpacity
              style={styles.editButton}
              onPress={handleEditToggle}
              disabled={saving}
            >
              <Ionicons
                name="create-outline"
                size={20}
                color={Colors.light.white}
              />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Image
              source={{ uri: "https://img.icons8.com/color/96/user.png" }}
              style={styles.avatar}
            />
            {customerProfile?.subscription?.isActive && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>Premium</Text>
              </View>
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.profileName}>
              {customerProfile?.personalInfo?.fullName || "Guest User"}
            </Text>
            <Text style={styles.profileEmail}>
              {customerProfile?.personalInfo?.email || "No email set"}
            </Text>
            <View style={styles.walletBalance}>
              <Ionicons name="wallet-outline" size={16} color={Colors.light.tint} />
              <Text style={styles.walletBalanceText}>
                {formatWalletBalance(customerProfile?.walletBalance)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-circle-outline" size={20} color={Colors.light.tint} />
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>
          <View style={styles.sectionContent}>
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
                <View style={styles.editableField}>
                  <Text style={styles.editableLabel}>Date of Birth</Text>
                  <TouchableOpacity
                    style={styles.datePickerButton}
                    onPress={showDatepicker}
                  >
                    <Text style={[styles.datePickerText, { color: editForm.dateOfBirth ? Colors.light.text : Colors.light.textSecondary }]}>
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
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Full Name</Text>
                  <Text style={styles.infoValue}>
                    {customerProfile?.personalInfo?.fullName || 'Not set'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>
                    {customerProfile?.personalInfo?.email || 'Not set'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Alternate Phone</Text>
                  <Text style={styles.infoValue}>
                    {customerProfile?.personalInfo?.alternatePhone || 'Not set'}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Date of Birth</Text>
                  <Text style={styles.infoValue}>
                    {formatDate(customerProfile?.personalInfo?.dateOfBirth)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Delivery Address Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="location-outline" size={20} color={Colors.light.tint} />
            <Text style={styles.sectionTitle}>Delivery Address</Text>
          </View>
          <View style={styles.sectionContent}>
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
                <View style={styles.row}>
                  <View style={styles.halfInput}>
                    <EditableField
                      label="City"
                      value={editForm.city}
                      onChange={(text) => setEditForm(prev => ({ ...prev, city: text }))}
                      placeholder="City"
                    />
                  </View>
                  <View style={styles.halfInput}>
                    <EditableField
                      label="State"
                      value={editForm.state}
                      onChange={(text) => setEditForm(prev => ({ ...prev, state: text }))}
                      placeholder="State"
                    />
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={styles.halfInput}>
                    <EditableField
                      label="Pincode"
                      value={editForm.pincode}
                      onChange={(text) => setEditForm(prev => ({ ...prev, pincode: text }))}
                      placeholder="Pincode"
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  <View style={styles.halfInput}>
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
              <View style={styles.addressCard}>
                <Text style={styles.addressText}>
                  {getFormattedAddress()}
                </Text>
                {customerProfile?.deliveryAddress?.landmark && (
                  <Text style={styles.landmarkText}>
                    Landmark: {customerProfile.deliveryAddress.landmark}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>

       

        {/* Save and Cancel Buttons when editing */}
        {isEditing && (
          <View style={styles.saveSection}>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleEditToggle}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={Colors.light.white} />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={20} color={Colors.light.white} />
                    <Text style={styles.saveButtonText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Logout Button */}
        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <MaterialIcons name="logout" size={24} color="#FF6B6B" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy Policy Link */}
        <View style={styles.menuSection}>
          <TouchableOpacity
            style={styles.privacyButton}
            onPress={() => router.push('/privacy-policy')}
          >
            <Ionicons name="shield-checkmark-outline" size={24} color={Colors.light.text} />
            <Text style={styles.privacyButtonText}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
          <Text style={styles.madeWithText}>Made with ❤️ by Dairy Nine</Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundLight,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  header: {
    backgroundColor: Colors.light.white,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  editButtonText: {
    color: Colors.light.white,
    fontSize: 14,
    fontWeight: '600',
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: 'relative',
  },
  avatar: {
    width: 60,
    height: 60,
  },
  premiumBadge: {
    position: 'absolute',
    bottom: -2,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  premiumBadgeText: {
    color: Colors.light.white,
    fontSize: 10,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    fontWeight: "400",
    marginBottom: 8,
  },
  walletBalance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  walletBalanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 100,
  },
  section: {
    backgroundColor: Colors.light.white,
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  sectionContent: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
    flex: 1,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.light.text,
    flex: 1,
    textAlign: 'right',
  },
  editableField: {
    marginBottom: 20,
  },
  editableLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  editableInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.light.text,
    backgroundColor: Colors.light.white,
  },
  datePickerButton: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: Colors.light.white,
  },
  datePickerText: {
    fontSize: 16,
    color: Colors.light.text,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.light.tint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.tint,
  },
  radioLabel: {
    fontSize: 16,
    color: Colors.light.text,
  },
  addressCard: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.tint,
  },
  addressText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
    marginBottom: 8,
    lineHeight: 22,
  },
  landmarkText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  saveSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: Colors.light.tint,
    paddingVertical: 16,
    borderRadius: 12,
  },
  cancelButtonText: {
    color: Colors.light.tint,
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.tint,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: Colors.light.white,
    fontSize: 16,
    fontWeight: '600',
  },
  menuSection: {
    backgroundColor: Colors.light.white,
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 16,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FF6B6B",
  },
  privacyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 16,
  },
  privacyButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.light.text,
  },
  versionContainer: {
    marginTop: 32,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  versionText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  madeWithText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: "500",
  },
  bottomPadding: {
    height: 20,
  },
  retryButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  retryButtonText: {
    color: Colors.light.white,
    fontSize: 16,
    fontWeight: '600',
  },
  orderItem: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.tint,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  orderStatus: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderDate: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  orderItems: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
  },
  noOrdersText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
});