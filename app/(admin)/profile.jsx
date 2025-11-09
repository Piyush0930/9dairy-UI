// app/(admin)/profile.jsx
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext'; // Add this import
import {
  MaterialIcons
} from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RadiusSettings from '../../components/RadiusSettings';

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;

export default function AdminProfile() {
  const insets = useSafeAreaInsets();
  const { authToken, user, logout } = useAuth();
  const { refreshTrigger, updateProfile } = useProfile(); // Add this
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    shopName: '',
    contactNumber: '',
    address: '',
    serviceRadius: 50,
    isActive: true
  });

  // Location state
  const [locationData, setLocationData] = useState({
    latitude: '',
    longitude: '',
    formattedAddress: '',
    city: '',
    state: '',
    pincode: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  // Listen for refresh triggers
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('🔄 Profile refresh triggered from context, trigger:', refreshTrigger);
      fetchProfile();
    }
  }, [refreshTrigger]);

  // In your AdminProfile component, update the fetchProfile function:
const fetchProfile = async () => {
  try {
    setLoading(true);
    console.log('📡 Fetching profile data...');
    
    const response = await fetch(`${API_BASE_URL}/admin/retailer/profile`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('📊 Profile API Response:', data);
    
    if (data.success) {
      // Handle both response structures: data.data and data.profile
      const profileData = data.data || data.profile;
      
      if (profileData) {
        console.log('✅ Profile data received:', profileData);
        setProfile(profileData);
        updateProfile(profileData); // Update global context
        
        setFormData({
          fullName: profileData.fullName || '',
          shopName: profileData.shopName || '',
          contactNumber: profileData.contactNumber || '',
          address: profileData.address || '',
          serviceRadius: profileData.serviceRadius || 50,
          isActive: profileData.isActive !== undefined ? profileData.isActive : true
        });

        // Set location data if available
        if (profileData.location) {
          setLocationData({
            latitude: profileData.location.coordinates?.latitude?.toString() || '',
            longitude: profileData.location.coordinates?.longitude?.toString() || '',
            formattedAddress: profileData.location.formattedAddress || '',
            city: profileData.location.city || '',
            state: profileData.location.state || '',
            pincode: profileData.location.pincode || ''
          });
        }
        
        console.log('✅ Profile loaded successfully, serviceRadius:', profileData.serviceRadius);
      } else {
        console.log('⚠️ Profile data structure unexpected:', data);
        Alert.alert('Warning', 'Profile data format unexpected');
      }
    } else {
      console.log('❌ Profile API error:', data.message);
      Alert.alert('Error', data.message || 'Failed to load profile data');
    }
  } catch (error) {
    console.error('❌ Error fetching profile:', error);
    Alert.alert('Error', 'Failed to load profile data');
  } finally {
    setLoading(false);
  }
};

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/admin/retailer/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (data.success) {
        const updatedProfile = data.data || data.profile;
        setProfile(updatedProfile);
        updateProfile(updatedProfile); // Update global context
        setEditing(false);
        setEditModalVisible(false);
        Alert.alert('Success', 'Profile updated successfully');
        fetchProfile(); // Refresh data
      } else {
        Alert.alert('Error', data.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLocation = async () => {
    if (!locationData.latitude || !locationData.longitude) {
      Alert.alert('Error', 'Please provide latitude and longitude');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch(`${API_BASE_URL}/admin/retailer/location`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          latitude: parseFloat(locationData.latitude),
          longitude: parseFloat(locationData.longitude),
          formattedAddress: locationData.formattedAddress,
          city: locationData.city,
          state: locationData.state,
          pincode: locationData.pincode
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setLocationModalVisible(false);
        Alert.alert('Success', 'Location updated successfully');
        fetchProfile(); // Refresh data
      } else {
        Alert.alert('Error', data.message || 'Failed to update location');
      }
    } catch (error) {
      console.error('Error updating location:', error);
      Alert.alert('Error', 'Failed to update location');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
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
              await logout();
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            }
          }
        }
      ]
    );
  };

  const InfoCard = ({ icon, title, value, onPress, editable = false }) => (
    <TouchableOpacity 
      style={styles.infoCard}
      onPress={onPress}
      disabled={!editable}
    >
      <View style={styles.infoHeader}>
        <View style={styles.infoTitle}>
          {icon}
          <Text style={styles.infoTitleText}>{title}</Text>
        </View>
        {editable && (
          <MaterialIcons name="edit" size={18} color={Colors.light.textSecondary} />
        )}
      </View>
      <Text style={styles.infoValue}>{value || 'Not set'}</Text>
    </TouchableOpacity>
  );

  const StatCard = ({ icon, title, value, subtitle }) => (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        {icon}
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
        {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Add Radius Settings at the top */}
      <RadiusSettings />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile?.shopName?.charAt(0) || 'A'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.shopName}>{profile?.shopName || 'No Shop Name'}</Text>
              <Text style={styles.ownerName}>{profile?.fullName || 'No Name'}</Text>
              <Text style={styles.phone}>{user?.phone || 'No Phone'}</Text>
            </View>
          </View>

          <View style={styles.statusBadge}>
            <View 
              style={[
                styles.statusDot,
                { backgroundColor: profile?.isActive ? '#4CAF50' : '#F44336' }
              ]} 
            />
            <Text style={styles.statusText}>
              {profile?.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Business Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon={<MaterialIcons name="location-on" size={20} color={Colors.light.accent} />}
              title="Service Radius"
              value={`${profile?.serviceRadius || 50} km`}
              subtitle="Delivery Area"
            />
            <StatCard
              icon={<MaterialIcons name="store" size={20} color="#4CAF50" />}
              title="Shop Status"
              value={profile?.isActive ? "Active" : "Inactive"}
              subtitle="Business"
            />
          </View>
        </View>

        {/* Profile Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Shop Information</Text>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => setEditModalVisible(true)}
            >
              <MaterialIcons name="edit" size={18} color={Colors.light.accent} />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <InfoCard
            icon={<MaterialIcons name="person" size={18} color={Colors.light.accent} />}
            title="Owner Name"
            value={profile?.fullName}
            editable={true}
            onPress={() => setEditModalVisible(true)}
          />

          <InfoCard
            icon={<MaterialIcons name="store" size={18} color={Colors.light.accent} />}
            title="Shop Name"
            value={profile?.shopName}
            editable={true}
            onPress={() => setEditModalVisible(true)}
          />

          <InfoCard
            icon={<MaterialIcons name="phone" size={18} color={Colors.light.accent} />}
            title="Contact Number"
            value={profile?.contactNumber}
            editable={true}
            onPress={() => setEditModalVisible(true)}
          />

          <InfoCard
            icon={<MaterialIcons name="location-on" size={18} color={Colors.light.accent} />}
            title="Service Radius"
            value={`${profile?.serviceRadius || 50} kilometers`}
            editable={true}
            onPress={() => setEditModalVisible(true)}
          />
        </View>

        {/* Location Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Location</Text>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => setLocationModalVisible(true)}
            >
              <MaterialIcons name="edit" size={18} color={Colors.light.accent} />
              <Text style={styles.editButtonText}>Update</Text>
            </TouchableOpacity>
          </View>

          <InfoCard
            icon={<MaterialIcons name="place" size={18} color={Colors.light.accent} />}
            title="Address"
            value={profile?.address}
            editable={true}
            onPress={() => setLocationModalVisible(true)}
          />

          {profile?.location?.formattedAddress && (
            <InfoCard
              icon={<MaterialIcons name="map" size={18} color={Colors.light.accent} />}
              title="Formatted Address"
              value={profile.location.formattedAddress}
            />
          )}

          {profile?.location?.coordinates && (
            <View style={styles.coordinates}>
              <Text style={styles.coordinateText}>
                Lat: {profile.location.coordinates.latitude}
              </Text>
              <Text style={styles.coordinateText}>
                Lng: {profile.location.coordinates.longitude}
              </Text>
            </View>
          )}
        </View>

        {/* Account Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <InfoCard
            icon={<MaterialIcons name="phone-android" size={18} color={Colors.light.accent} />}
            title="Phone Number"
            value={user?.phone}
          />

          <InfoCard
            icon={<MaterialIcons name="person-pin" size={18} color={Colors.light.accent} />}
            title="Role"
            value="Admin / Retailer"
          />

           <InfoCard
            icon={<MaterialIcons name="calendar-today" size={18} color={Colors.light.accent} />}
            title="Member Since"
            value={profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN') : 'N/A'}
          />
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity 
                onPress={() => setEditModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Owner Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.fullName}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, fullName: text }))}
                  placeholder="Enter owner name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Shop Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.shopName}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, shopName: text }))}
                  placeholder="Enter shop name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Contact Number</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.contactNumber}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, contactNumber: text }))}
                  placeholder="Enter contact number"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={formData.address}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, address: text }))}
                  placeholder="Enter shop address"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Service Radius (km)</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.serviceRadius.toString()}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, serviceRadius: parseInt(text) || 50 }))}
                  placeholder="Enter service radius"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.switchGroup}>
                <Text style={styles.inputLabel}>Shop Active</Text>
                <Switch
                  value={formData.isActive}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, isActive: value }))}
                  trackColor={{ false: '#767577', true: Colors.light.accent }}
                  thumbColor={formData.isActive ? '#f4f3f4' : '#f4f3f4'}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Location Update Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={locationModalVisible}
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Location</Text>
              <TouchableOpacity 
                onPress={() => setLocationModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Latitude</Text>
                <TextInput
                  style={styles.textInput}
                  value={locationData.latitude}
                  onChangeText={(text) => setLocationData(prev => ({ ...prev, latitude: text }))}
                  placeholder="Enter latitude"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Longitude</Text>
                <TextInput
                  style={styles.textInput}
                  value={locationData.longitude}
                  onChangeText={(text) => setLocationData(prev => ({ ...prev, longitude: text }))}
                  placeholder="Enter longitude"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Formatted Address</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={locationData.formattedAddress}
                  onChangeText={(text) => setLocationData(prev => ({ ...prev, formattedAddress: text }))}
                  placeholder="Enter formatted address"
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>City</Text>
                  <TextInput
                    style={styles.textInput}
                    value={locationData.city}
                    onChangeText={(text) => setLocationData(prev => ({ ...prev, city: text }))}
                    placeholder="City"
                  />
                </View>

                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>State</Text>
                  <TextInput
                    style={styles.textInput}
                    value={locationData.state}
                    onChangeText={(text) => setLocationData(prev => ({ ...prev, state: text }))}
                    placeholder="State"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Pincode</Text>
                <TextInput
                  style={styles.textInput}
                  value={locationData.pincode}
                  onChangeText={(text) => setLocationData(prev => ({ ...prev, pincode: text }))}
                  placeholder="Enter pincode"
                  keyboardType="numeric"
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setLocationModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleUpdateLocation}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Update Location</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  logoutButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  profileCard: {
    backgroundColor: '#FFF',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  profileInfo: {
    flex: 1,
  },
  shopName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  ownerName: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  phone: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  statsSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.accent,
    marginLeft: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 2,
  },
  statTitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  statSubtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  infoCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 8,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoTitleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginLeft: 8,
  },
  infoValue: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '500',
  },
  coordinates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  coordinateText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontFamily: 'monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  closeButton: {
    padding: 4,
  },
  modalScroll: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.light.text,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  switchGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  saveButton: {
    backgroundColor: Colors.light.accent,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});