// app/(tabs)/supadmin/profile.jsx
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const router = useRouter();
  
  // Superadmin data
  const [profileData, setProfileData] = useState({
    name: 'Mohan Patil',
    phone: '9552524301',
    email: 'mohan.patil@dairyapp.com',
    role: 'Super Admin',
    joinDate: '2024-01-15',
    lastLogin: '2024-12-19 14:30',
    status: 'Active',
  });

  const [profileImage, setProfileImage] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({ ...profileData });
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState({
    orderAlerts: true,
    stockUpdates: true,
    priceChanges: false,
    systemNotifications: true,
  });

  // Logout functionality
  const handleLogout = () => {
    Alert.alert(
      "SuperAdmin Logout",
      "Are you sure you want to logout from SuperAdmin panel?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
              router.replace("/Login");
            } catch {
              Alert.alert("Error", "Failed to logout.");
            }
          },
        },
      ]
    );
  };

  // Pick image from gallery
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Could not select image. Please try again.');
    }
  };

  // Handle edit
  const handleEdit = () => {
    setEditedData({ ...profileData });
    setIsEditing(true);
  };

  // Handle save
  const handleSave = async () => {
    if (!editedData.name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (!editedData.phone.trim() || editedData.phone.length !== 10) {
      Alert.alert('Error', 'Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setProfileData({ ...editedData });
      setIsEditing(false);
      setLoading(false);
      Alert.alert('Success', 'Profile updated successfully!');
    }, 1500);
  };

  // Handle cancel
  const handleCancel = () => {
    setIsEditing(false);
    setEditedData({ ...profileData });
  };

  // Handle notification toggle
  const toggleNotification = (key) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Profile stats data
  const profileStats = [
    { label: 'Total Orders', value: '1,247', icon: 'receipt-outline', color: '#3B82F6' },
    { label: 'Products', value: '156', icon: 'cube-outline', color: '#10B981' },
    { label: 'Retailers', value: '89', icon: 'storefront-outline', color: '#8B5CF6' },
    { label: 'This Month', value: '₹2.4L', icon: 'trending-up-outline', color: '#F59E0B' },
  ];

  // Menu items
  const menuItems = [
    {
      title: 'Account Settings',
      icon: 'person-outline',
      items: [
        { label: 'Change Password', icon: 'lock-closed-outline', onPress: () => Alert.alert('Change Password', 'Password change feature coming soon!') },
        { label: 'Privacy & Security', icon: 'shield-checkmark-outline', onPress: () => Alert.alert('Privacy', 'Privacy settings coming soon!') },
        { label: 'Two-Factor Auth', icon: 'phone-portrait-outline', onPress: () => Alert.alert('2FA', 'Two-factor authentication coming soon!') },
      ]
    },
    {
      title: 'App Settings',
      icon: 'settings-outline',
      items: [
        { label: 'Notifications', icon: 'notifications-outline', onPress: () => {} },
        { label: 'Language', icon: 'language-outline', onPress: () => Alert.alert('Language', 'Language settings coming soon!') },
        { label: 'Theme', icon: 'color-palette-outline', onPress: () => Alert.alert('Theme', 'Theme settings coming soon!') },
      ]
    },
    {
      title: 'Support',
      icon: 'help-circle-outline',
      items: [
        { label: 'Help & Support', icon: 'chatbubble-ellipses-outline', onPress: () => Alert.alert('Support', 'Contact support at: support@dairyapp.com') },
        { label: 'About App', icon: 'information-circle-outline', onPress: () => Alert.alert('About', 'Dairy Management App v2.0.0') },
        { label: 'Terms & Conditions', icon: 'document-text-outline', onPress: () => Alert.alert('Terms', 'Terms and conditions coming soon!') },
      ]
    }
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Text style={styles.headerSubtitle}>Manage your account settings</Text>
        </View>
        <TouchableOpacity style={styles.editButton} onPress={isEditing ? handleCancel : handleEdit}>
          <Ionicons 
            name={isEditing ? "close-outline" : "create-outline"} 
            size={22} 
            color={isEditing ? "#EF4444" : "#3B82F6"} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header Section */}
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            {/* Profile Image */}
            <View style={styles.imageContainer}>
              <View style={styles.profileImageWrapper}>
                <View style={styles.profileImage}>
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.profileImage} />
                  ) : (
                    <View style={styles.defaultAvatar}>
                      <Text style={styles.avatarText}>
                        {profileData.name.split(' ').map(n => n[0]).join('')}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity style={styles.cameraButton} onPress={pickImage}>
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              
              {!isEditing && (
                <TouchableOpacity style={styles.changePhotoButton} onPress={pickImage}>
                  <Text style={styles.changePhotoText}>Change Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Profile Info */}
            <View style={styles.profileInfo}>
              {isEditing ? (
                <View style={styles.editForm}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Full Name</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editedData.name}
                      onChangeText={(text) => setEditedData({ ...editedData, name: text })}
                      placeholder="Enter your name"
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editedData.phone}
                      onChangeText={(text) => setEditedData({ ...editedData, phone: text })}
                      placeholder="Enter phone number"
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>
                  
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <TextInput
                      style={styles.textInput}
                      value={editedData.email}
                      onChangeText={(text) => setEditedData({ ...editedData, email: text })}
                      placeholder="Enter email address"
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.profileName}>{profileData.name}</Text>
                  <Text style={styles.profileRole}>{profileData.role}</Text>
                  
                  <View style={styles.profileDetails}>
                    <View style={styles.detailItem}>
                      <Ionicons name="call-outline" size={16} color="#64748B" />
                      <Text style={styles.detailText}>{profileData.phone}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="mail-outline" size={16} color="#64748B" />
                      <Text style={styles.detailText}>{profileData.email}</Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Ionicons name="calendar-outline" size={16} color="#64748B" />
                      <Text style={styles.detailText}>Joined {new Date(profileData.joinDate).toLocaleDateString('en-IN', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</Text>
                    </View>
                  </View>

                  <View style={styles.statusBadge}>
                    <View style={[styles.statusDot, { backgroundColor: profileData.status === 'Active' ? '#10B981' : '#EF4444' }]} />
                    <Text style={styles.statusText}>{profileData.status}</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Save/Cancel Buttons for Edit Mode */}
          {isEditing && (
            <View style={styles.editActions}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.cancelButton]} 
                onPress={handleCancel}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.saveButton]} 
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        

        {/* Notification Settings */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingsCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="notifications-outline" size={20} color="#3B82F6" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Order Alerts</Text>
                  <Text style={styles.settingDescription}>Get notified for new orders</Text>
                </View>
              </View>
              <Switch
                value={notifications.orderAlerts}
                onValueChange={() => toggleNotification('orderAlerts')}
                trackColor={{ false: '#E5E7EB', true: '#BFDBFE' }}
                thumbColor={notifications.orderAlerts ? '#3B82F6' : '#9CA3AF'}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="archive-outline" size={20} color="#10B981" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Stock Updates</Text>
                  <Text style={styles.settingDescription}>Low stock alerts</Text>
                </View>
              </View>
              <Switch
                value={notifications.stockUpdates}
                onValueChange={() => toggleNotification('stockUpdates')}
                trackColor={{ false: '#E5E7EB', true: '#A7F3D0' }}
                thumbColor={notifications.stockUpdates ? '#10B981' : '#9CA3AF'}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="pricetag-outline" size={20} color="#F59E0B" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Price Changes</Text>
                  <Text style={styles.settingDescription}>Product price updates</Text>
                </View>
              </View>
              <Switch
                value={notifications.priceChanges}
                onValueChange={() => toggleNotification('priceChanges')}
                trackColor={{ false: '#E5E7EB', true: '#FDE68A' }}
                thumbColor={notifications.priceChanges ? '#F59E0B' : '#9CA3AF'}
              />
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Ionicons name="server-outline" size={20} color="#8B5CF6" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>System Notifications</Text>
                  <Text style={styles.settingDescription}>App updates and maintenance</Text>
                </View>
              </View>
              <Switch
                value={notifications.systemNotifications}
                onValueChange={() => toggleNotification('systemNotifications')}
                trackColor={{ false: '#E5E7EB', true: '#DDD6FE' }}
                thumbColor={notifications.systemNotifications ? '#8B5CF6' : '#9CA3AF'}
              />
            </View>
          </View>
        </View>

        {/* Menu Sections */}
        {menuItems.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.menuSection}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  style={[
                    styles.menuItem,
                    itemIndex < section.items.length - 1 && styles.menuItemBorder
                  ]}
                  onPress={item.onPress}
                >
                  <View style={styles.menuItemLeft}>
                    <View style={styles.menuIcon}>
                      <Ionicons name={item.icon} size={20} color="#3B82F6" />
                    </View>
                    <Text style={styles.menuText}>{item.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => Alert.alert(
              'Delete Account',
              'This action cannot be undone. All your data will be permanently deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => console.log('Delete account pressed') }
              ]
            )}
          >
            <Ionicons name="trash-outline" size={20} color="#9CA3AF" />
            <Text style={styles.deleteButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  editButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  
  // Profile Section
  profileSection: {
    backgroundColor: '#FFFFFF',
    margin: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  imageContainer: {
    alignItems: 'center',
    marginRight: 20,
  },
  profileImageWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#F1F5F9',
  },
  defaultAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3B82F6',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  changePhotoButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
  },
  changePhotoText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 16,
    color: '#3B82F6',
    fontWeight: '600',
    marginBottom: 16,
  },
  profileDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#64748B',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '600',
  },
  
  // Edit Form
  editForm: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  // Stats Section
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Settings Section
  settingsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#64748B',
  },
  
  // Menu Sections
  menuSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
  },
  
  // Actions Section
  actionsSection: {
    paddingHorizontal: 20,
    gap: 12,
  },
  logoutButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  
  bottomSpacer: {
    height: 20,
  },
});