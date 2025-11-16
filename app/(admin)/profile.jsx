// app/(admin)/profile.jsx
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
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
  const { refreshTrigger, updateProfile } = useProfile();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (refreshTrigger > 0) {
      fetchProfile();
    }
  }, [refreshTrigger]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/admin/retailer/profile`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      
      if (data.success) {
        const profileData = data.data || data.profile;
        
        if (profileData) {
          setProfile(profileData);
          updateProfile(profileData);
          
          setFormData({
            fullName: profileData.fullName || '',
            shopName: profileData.shopName || '',
            contactNumber: profileData.contactNumber || '',
            address: profileData.address || '',
            serviceRadius: profileData.serviceRadius || 50,
            isActive: profileData.isActive !== undefined ? profileData.isActive : true
          });

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
        }
      } else {
        Alert.alert('Error', data.message || 'Failed to load profile data');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
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
        updateProfile(updatedProfile);
        setEditModalVisible(false);
        Alert.alert('Success', 'Profile updated successfully');
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
        fetchProfile();
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

  // Enhanced Card Components
  const ProfileHeaderCard = () => (
    <View style={styles.profileHeaderCard}>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.shopName?.charAt(0)?.toUpperCase() || 'S'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.shopName} numberOfLines={1}>
            {profile?.shopName || 'No Shop Name'}
          </Text>
          <Text style={styles.ownerName} numberOfLines={1}>
            {profile?.fullName || 'No Name'}
          </Text>
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
      </View>
      <TouchableOpacity 
        style={styles.editProfileButton}
        onPress={() => setEditModalVisible(true)}
      >
        <Feather name="edit-2" size={18} color={Colors.light.accent} />
      </TouchableOpacity>
    </View>
  );

  const StatsCard = () => (
    <View style={styles.statsCard}>
      <Text style={styles.sectionTitle}>Business Overview</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
            <Ionicons name="location" size={20} color={Colors.light.accent} />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statValue}>{profile?.serviceRadius || 50} km</Text>
            <Text style={styles.statLabel}>Service Radius</Text>
          </View>
        </View>
        
        <View style={styles.statItem}>
          <View style={[styles.statIcon, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
            <MaterialIcons name="store" size={20} color="#4CAF50" />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statValue}>
              {profile?.isActive ? "Active" : "Inactive"}
            </Text>
            <Text style={styles.statLabel}>Shop Status</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const InfoSection = ({ title, items }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.infoCards}>
        {items.map((item, index) => (
          <TouchableOpacity 
            key={index}
            style={styles.infoCard}
            onPress={item.onPress}
            disabled={!item.editable}
          >
            <View style={styles.infoHeader}>
              <View style={styles.infoLeft}>
                <View style={styles.infoIcon}>
                  {item.icon}
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>{item.label}</Text>
                  <Text style={styles.infoValue} numberOfLines={2}>
                    {item.value || 'Not set'}
                  </Text>
                </View>
              </View>
              {item.editable && (
                <Feather name="edit-2" size={16} color={Colors.light.textSecondary} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const ActionCard = ({ icon, title, description, onPress, buttonText = "Manage" }) => (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <View style={styles.actionContent}>
        <View style={styles.actionIcon}>
          {icon}
        </View>
        <View style={styles.actionText}>
          <Text style={styles.actionTitle}>{title}</Text>
          <Text style={styles.actionDescription}>{description}</Text>
        </View>
      </View>
      <View style={styles.actionButton}>
        <Text style={styles.actionButtonText}>{buttonText}</Text>
        <Feather name="chevron-right" size={16} color={Colors.light.accent} />
      </View>
    </TouchableOpacity>
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
      {/* Professional Header */}
      <View style={styles.professionalHeader}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Text style={styles.headerSubtitle}>Manage your business profile</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header */}
        <ProfileHeaderCard />

        {/* Radius Settings */}
        <RadiusSettings />

        {/* Business Stats */}
        <StatsCard />

        {/* Shop Information */}
        <InfoSection
          title="Shop Information"
          items={[
            {
              icon: <MaterialIcons name="person" size={20} color={Colors.light.accent} />,
              label: "Owner Name",
              value: profile?.fullName,
              editable: true,
              onPress: () => setEditModalVisible(true)
            },
            {
              icon: <MaterialIcons name="store" size={20} color={Colors.light.accent} />,
              label: "Shop Name",
              value: profile?.shopName,
              editable: true,
              onPress: () => setEditModalVisible(true)
            },
            {
              icon: <MaterialIcons name="phone" size={20} color={Colors.light.accent} />,
              label: "Contact Number",
              value: profile?.contactNumber,
              editable: true,
              onPress: () => setEditModalVisible(true)
            },
            {
              icon: <MaterialIcons name="location-on" size={20} color={Colors.light.accent} />,
              label: "Service Radius",
              value: `${profile?.serviceRadius || 50} kilometers`,
              editable: true,
              onPress: () => setEditModalVisible(true)
            }
          ]}
        />

        {/* Location Management */}
        <InfoSection
          title="Location"
          items={[
            {
              icon: <MaterialIcons name="place" size={20} color={Colors.light.accent} />,
              label: "Business Address",
              value: profile?.address,
              editable: true,
              onPress: () => setLocationModalVisible(true)
            },
            {
              icon: <MaterialIcons name="map" size={20} color={Colors.light.accent} />,
              label: "Coordinates",
              value: profile?.location?.coordinates ? 
                `${profile.location.coordinates.latitude}, ${profile.location.coordinates.longitude}` : 
                'Not set',
              editable: true,
              onPress: () => setLocationModalVisible(true)
            }
          ]}
        />

        {/* Account Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.actionCards}>
            <ActionCard
              icon={<MaterialIcons name="phone-android" size={24} color={Colors.light.accent} />}
              title="Phone Number"
              description={user?.phone || 'Not available'}
              buttonText="View"
              onPress={() => {}}
            />
            <ActionCard
              icon={<MaterialIcons name="security" size={24} color={Colors.light.accent} />}
              title="Account Security"
              description="Manage your account security"
              onPress={() => {}}
            />
            <ActionCard
              icon={<MaterialIcons name="help-outline" size={24} color={Colors.light.accent} />}
              title="Help & Support"
              description="Get help with your account"
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Logout Section */}
        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialIcons name="logout" size={20} color="#F44336" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
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
                disabled={saving}
              >
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
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

            <View style={styles.modalFooter}>
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

      {/* Keep your existing Location Update Modal (simplified for brevity) */}
      {/* ... Location Modal code remains the same ... */}
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
  // Professional Header
  professionalHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    minHeight: 72,
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  // Profile Header Card
  profileHeaderCard: {
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
    marginBottom: 8,
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
  editProfileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Stats Card
  statsCard: {
    backgroundColor: '#FFF',
    margin: 16,
    marginTop: 0,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  statLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  // Sections
  section: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  infoCards: {
    gap: 8,
  },
  infoCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '500',
  },
  // Action Cards
  actionCards: {
    gap: 8,
  },
  actionCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.accent,
    marginRight: 4,
  },
  // Logout Section
  logoutSection: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  logoutButton: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFEBEE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F44336',
  },
  // Modal Styles
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
  modalBody: {
    padding: 20,
  },
  inputGroup: {
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
  modalFooter: {
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