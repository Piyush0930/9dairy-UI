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
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row justify-between items-center px-5 py-4 bg-white border-b border-gray-200">
        <View className="flex-1">
          <Text className="text-2xl font-bold text-gray-800 mb-0.5">Profile</Text>
          <Text className="text-sm text-gray-500">Manage your account settings</Text>
        </View>
        <TouchableOpacity className="p-2" onPress={isEditing ? handleCancel : handleEdit}>
          <Ionicons 
            name={isEditing ? "close-outline" : "create-outline"} 
            size={22} 
            color={isEditing ? "#EF4444" : "#3B82F6"} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Profile Header Section */}
        <View className="bg-white mx-5 rounded-xl p-5 shadow-lg mt-4">
          <View className="flex-row items-start">
            {/* Profile Image */}
            <View className="items-center mr-5">
              <View className="relative mb-3">
                <View className="w-24 h-24 rounded-full border-4 border-gray-100 overflow-hidden">
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} className="w-24 h-24" />
                  ) : (
                    <View className="w-full h-full rounded-full bg-blue-500 justify-center items-center">
                      <Text className="text-2xl font-bold text-white">
                        {profileData.name.split(' ').map(n => n[0]).join('')}
                      </Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity 
                  className="absolute bottom-0 right-0 bg-blue-500 w-8 h-8 rounded-full justify-center items-center border-2 border-white"
                  onPress={pickImage}
                >
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              
              {!isEditing && (
                <TouchableOpacity className="px-3 py-1.5 bg-gray-50 rounded-lg" onPress={pickImage}>
                  <Text className="text-xs text-gray-500 font-semibold">Change Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Profile Info */}
            <View className="flex-1">
              {isEditing ? (
                <View className="gap-4">
                  <View className="gap-1.5">
                    <Text className="text-sm font-semibold text-gray-700">Full Name</Text>
                    <TextInput
                      className="border border-gray-300 rounded-lg p-3 text-base text-gray-800 bg-white"
                      value={editedData.name}
                      onChangeText={(text) => setEditedData({ ...editedData, name: text })}
                      placeholder="Enter your name"
                    />
                  </View>
                  
                  <View className="gap-1.5">
                    <Text className="text-sm font-semibold text-gray-700">Phone Number</Text>
                    <TextInput
                      className="border border-gray-300 rounded-lg p-3 text-base text-gray-800 bg-white"
                      value={editedData.phone}
                      onChangeText={(text) => setEditedData({ ...editedData, phone: text })}
                      placeholder="Enter phone number"
                      keyboardType="phone-pad"
                      maxLength={10}
                    />
                  </View>
                  
                  <View className="gap-1.5">
                    <Text className="text-sm font-semibold text-gray-700">Email Address</Text>
                    <TextInput
                      className="border border-gray-300 rounded-lg p-3 text-base text-gray-800 bg-white"
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
                  <Text className="text-2xl font-bold text-gray-800 mb-1">{profileData.name}</Text>
                  <Text className="text-base text-blue-500 font-semibold mb-4">{profileData.role}</Text>
                  
                  <View className="gap-2 mb-4">
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="call-outline" size={16} color="#64748B" />
                      <Text className="text-sm text-gray-500">{profileData.phone}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="mail-outline" size={16} color="#64748B" />
                      <Text className="text-sm text-gray-500">{profileData.email}</Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Ionicons name="calendar-outline" size={16} color="#64748B" />
                      <Text className="text-sm text-gray-500">Joined {new Date(profileData.joinDate).toLocaleDateString('en-IN', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}</Text>
                    </View>
                  </View>

                  <View className="flex-row items-center bg-green-50 px-3 py-1.5 rounded-full self-start">
                    <View 
                      className="w-2 h-2 rounded-full mr-1.5" 
                      style={{ backgroundColor: profileData.status === 'Active' ? '#10B981' : '#EF4444' }} 
                    />
                    <Text className="text-xs text-green-800 font-semibold">{profileData.status}</Text>
                  </View>
                </>
              )}
            </View>
          </View>

          {/* Save/Cancel Buttons for Edit Mode */}
          {isEditing && (
            <View className="flex-row gap-3 mt-5">
              <TouchableOpacity 
                className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-gray-50 border border-gray-300"
                onPress={handleCancel}
                disabled={loading}
              >
                <Text className="text-base font-semibold text-gray-700">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-blue-500 gap-2"
                onPress={handleSave}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    <Text className="text-base font-semibold text-white">Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        

        {/* Notification Settings */}
        <View className="px-5 mb-5">
          <Text className="text-lg font-bold text-gray-800 mb-3">Notifications</Text>
          <View className="bg-white rounded-xl p-4 shadow-sm">
            <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
              <View className="flex-row items-center flex-1">
                <Ionicons name="notifications-outline" size={20} color="#3B82F6" />
                <View className="ml-3 flex-1">
                  <Text className="text-base font-semibold text-gray-800 mb-0.5">Order Alerts</Text>
                  <Text className="text-sm text-gray-500">Get notified for new orders</Text>
                </View>
              </View>
              <Switch
                value={notifications.orderAlerts}
                onValueChange={() => toggleNotification('orderAlerts')}
                trackColor={{ false: '#E5E7EB', true: '#BFDBFE' }}
                thumbColor={notifications.orderAlerts ? '#3B82F6' : '#9CA3AF'}
              />
            </View>

            <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
              <View className="flex-row items-center flex-1">
                <Ionicons name="archive-outline" size={20} color="#10B981" />
                <View className="ml-3 flex-1">
                  <Text className="text-base font-semibold text-gray-800 mb-0.5">Stock Updates</Text>
                  <Text className="text-sm text-gray-500">Low stock alerts</Text>
                </View>
              </View>
              <Switch
                value={notifications.stockUpdates}
                onValueChange={() => toggleNotification('stockUpdates')}
                trackColor={{ false: '#E5E7EB', true: '#A7F3D0' }}
                thumbColor={notifications.stockUpdates ? '#10B981' : '#9CA3AF'}
              />
            </View>

            <View className="flex-row items-center justify-between py-3 border-b border-gray-100">
              <View className="flex-row items-center flex-1">
                <Ionicons name="pricetag-outline" size={20} color="#F59E0B" />
                <View className="ml-3 flex-1">
                  <Text className="text-base font-semibold text-gray-800 mb-0.5">Price Changes</Text>
                  <Text className="text-sm text-gray-500">Product price updates</Text>
                </View>
              </View>
              <Switch
                value={notifications.priceChanges}
                onValueChange={() => toggleNotification('priceChanges')}
                trackColor={{ false: '#E5E7EB', true: '#FDE68A' }}
                thumbColor={notifications.priceChanges ? '#F59E0B' : '#9CA3AF'}
              />
            </View>

            <View className="flex-row items-center justify-between py-3">
              <View className="flex-row items-center flex-1">
                <Ionicons name="server-outline" size={20} color="#8B5CF6" />
                <View className="ml-3 flex-1">
                  <Text className="text-base font-semibold text-gray-800 mb-0.5">System Notifications</Text>
                  <Text className="text-sm text-gray-500">App updates and maintenance</Text>
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
          <View key={sectionIndex} className="px-5 mb-5">
            <Text className="text-lg font-bold text-gray-800 mb-3">{section.title}</Text>
            <View className="bg-white rounded-xl shadow-sm">
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  className={`flex-row items-center justify-between py-4 px-4 ${itemIndex < section.items.length - 1 ? 'border-b border-gray-100' : ''}`}
                  onPress={item.onPress}
                >
                  <View className="flex-row items-center flex-1">
                    <View className="w-10 h-10 rounded-full bg-blue-50 justify-center items-center mr-3">
                      <Ionicons name={item.icon} size={20} color="#3B82F6" />
                    </View>
                    <Text className="text-base text-gray-800 font-medium">{item.label}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Action Buttons */}
        <View className="px-5 gap-3">
          <TouchableOpacity 
            className="flex-row items-center justify-center py-3 rounded-lg bg-red-50 border border-red-200 gap-2"
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text className="text-base font-semibold text-red-500">Logout</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            className="flex-row items-center justify-center py-3 rounded-lg bg-gray-50 border border-gray-200 gap-2"
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
            <Text className="text-base font-semibold text-gray-500">Delete Account</Text>
          </TouchableOpacity>
        </View>

        <View className="h-5" />
      </ScrollView>
    </View>
  );
}