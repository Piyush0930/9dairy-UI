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
    <View className="bg-white mx-4 p-5 rounded-xl border border-gray-200 shadow flex-row items-center justify-between">
      <View className="flex-row items-center flex-1">
        <View className="w-16 h-16 rounded-full bg-blue-500 items-center justify-center mr-4">
          <Text className="text-white text-2xl font-bold">
            {profile?.shopName?.charAt(0)?.toUpperCase() || 'S'}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-800 mb-1" numberOfLines={1}>
            {profile?.shopName || 'No Shop Name'}
          </Text>
          <Text className="text-base text-gray-500 mb-2" numberOfLines={1}>
            {profile?.fullName || 'No Name'}
          </Text>
          <View className="flex-row items-center self-start bg-green-100 px-3 py-1.5 rounded-full">
            <View 
              className={`w-2 h-2 rounded-full mr-1.5 ${
                profile?.isActive ? 'bg-green-500' : 'bg-red-500'
              }`} 
            />
            <Text className="text-xs font-semibold text-green-700">
              {profile?.isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity 
        className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center"
        onPress={() => setEditModalVisible(true)}
      >
        <Feather name="edit-2" size={18} color={Colors.light.accent} />
      </TouchableOpacity>
    </View>
  );

  const StatsCard = () => (
    <View className="bg-white mx-4 p-5 rounded-xl border border-gray-200">
      <Text className="text-lg font-bold text-gray-800 mb-4">Business Overview</Text>
      <View className="flex-row gap-4">
        <View className="flex-1 flex-row items-center">
          <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mr-3">
            <Ionicons name="location" size={20} color={Colors.light.accent} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-800 mb-0.5">{profile?.serviceRadius || 50} km</Text>
            <Text className="text-sm text-gray-500">Service Radius</Text>
          </View>
        </View>
        
        <View className="flex-1 flex-row items-center">
          <View className="w-12 h-12 rounded-full bg-green-100 items-center justify-center mr-3">
            <MaterialIcons name="store" size={20} color="#4CAF50" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-800 mb-0.5">
              {profile?.isActive ? "Active" : "Inactive"}
            </Text>
            <Text className="text-sm text-gray-500">Shop Status</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const InfoSection = ({ title, items }) => (
    <View className="mb-6 px-4">
      <Text className="text-lg font-bold text-gray-800 mb-4">{title}</Text>
      <View className="gap-2">
        {items.map((item, index) => (
          <TouchableOpacity 
            key={index}
            className="bg-white p-4 rounded-xl border border-gray-200"
            onPress={item.onPress}
            disabled={!item.editable}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-full bg-blue-100 items-center justify-center mr-3">
                  {item.icon}
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-500 mb-1">{item.label}</Text>
                  <Text className="text-base text-gray-800 font-medium" numberOfLines={2}>
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
    <TouchableOpacity className="bg-white p-4 rounded-xl border border-gray-200 flex-row items-center justify-between" onPress={onPress}>
      <View className="flex-row items-center flex-1">
        <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center mr-3">
          {icon}
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-800 mb-0.5">{title}</Text>
          <Text className="text-sm text-gray-500">{description}</Text>
        </View>
      </View>
      <View className="flex-row items-center">
        <Text className="text-sm font-semibold text-blue-500 mr-1">{buttonText}</Text>
        <Feather name="chevron-right" size={16} color={Colors.light.accent} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text className="text-base text-gray-500 mt-4">Loading profile...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Professional Header */}
      <View className="px-4 pt-4 pb-4 bg-white border-b border-gray-200 min-h-18 justify-center">
        <View className="flex-row items-center justify-between h-10">
          <View>
            <Text className="text-2xl font-bold text-gray-800">Profile</Text>
            <Text className="text-sm text-gray-500 font-medium">Manage your business profile</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
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
        <View className="mb-6 px-4">
          <Text className="text-lg font-bold text-gray-800 mb-4">Account</Text>
          <View className="gap-2">
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
        <View className="px-4 mt-2">
          <TouchableOpacity className="bg-white p-4 rounded-xl border border-red-100 flex-row items-center justify-center gap-2" onPress={handleLogout}>
            <MaterialIcons name="logout" size={20} color="#F44336" />
            <Text className="text-base font-semibold text-red-500">Logout</Text>
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
        <View className="flex-1 bg-black/50 justify-center items-center p-5">
          <View className="bg-white rounded-xl w-full max-w-125 max-h-4/5 shadow-lg">
            <View className="flex-row justify-between items-center p-5 border-b border-gray-200">
              <Text className="text-xl font-bold text-gray-800">Edit Profile</Text>
              <TouchableOpacity 
                onPress={() => setEditModalVisible(false)}
                disabled={saving}
              >
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-800 mb-2">Owner Name</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-300 rounded-lg p-3 text-base text-gray-800"
                  value={formData.fullName}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, fullName: text }))}
                  placeholder="Enter owner name"
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-800 mb-2">Shop Name</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-300 rounded-lg p-3 text-base text-gray-800"
                  value={formData.shopName}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, shopName: text }))}
                  placeholder="Enter shop name"
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-800 mb-2">Contact Number</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-300 rounded-lg p-3 text-base text-gray-800"
                  value={formData.contactNumber}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, contactNumber: text }))}
                  placeholder="Enter contact number"
                  keyboardType="phone-pad"
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-800 mb-2">Address</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-300 rounded-lg p-3 text-base text-gray-800 min-h-20 text-top"
                  value={formData.address}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, address: text }))}
                  placeholder="Enter shop address"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-800 mb-2">Service Radius (km)</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-300 rounded-lg p-3 text-base text-gray-800"
                  value={formData.serviceRadius.toString()}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, serviceRadius: parseInt(text) || 50 }))}
                  placeholder="Enter service radius"
                  keyboardType="numeric"
                />
              </View>

              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-sm font-semibold text-gray-800">Shop Active</Text>
                <Switch
                  value={formData.isActive}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, isActive: value }))}
                  trackColor={{ false: '#767577', true: Colors.light.accent }}
                  thumbColor={formData.isActive ? '#f4f3f4' : '#f4f3f4'}
                />
              </View>
            </ScrollView>

            <View className="flex-row p-5 border-t border-gray-200 gap-3">
              <TouchableOpacity 
                className="flex-1 bg-gray-50 py-3.5 rounded-lg items-center border border-gray-300"
                onPress={() => setEditModalVisible(false)}
                disabled={saving}
              >
                <Text className="text-base font-semibold text-gray-500">Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                className="flex-1 bg-blue-500 py-3.5 rounded-lg items-center"
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text className="text-base font-semibold text-white">Save Changes</Text>
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