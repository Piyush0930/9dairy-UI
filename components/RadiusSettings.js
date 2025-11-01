// components/RadiusSettings.js
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  Modal,
  ActivityIndicator,
  ScrollView,
  Dimensions 
} from 'react-native';
import { MaterialIcons, FontAwesome } from '@expo/vector-icons';
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/contexts/ProfileContext'; // Add this import

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function RadiusSettings() {
  const { authToken } = useAuth();
  const [modalVisible, setModalVisible] = useState(false);
  const [radius, setRadius] = useState(50);
  const { refreshProfile } = useProfile(); // Add this
  const [loading, setLoading] = useState(false);
  const [currentRadius, setCurrentRadius] = useState(50);
  const [retailerProfile, setRetailerProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    fetchRetailerProfile();
  }, []);

  const fetchRetailerProfile = async () => {
    try {
      setProfileLoading(true);
      const response = await fetch(`${API_BASE_URL}/admin/retailer/profile`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      console.log('Retailer profile response:', data);
      
      if (data.success && data.data) {
        setRetailerProfile(data.data);
        setCurrentRadius(data.data.serviceRadius || 50);
        setRadius(data.data.serviceRadius || 50);
        console.log('Profile loaded successfully, radius:', data.data.serviceRadius);
      } else {
        console.log('No profile data found, using default radius');
        setCurrentRadius(50);
        setRadius(50);
      }
    } catch (error) {
      console.error('Error fetching retailer profile:', error);
      setCurrentRadius(50);
      setRadius(50);
    } finally {
      setProfileLoading(false);
    }
  };

  // Enhanced update function with better debugging
  const updateRadius = async () => {
    if (radius < 1 || radius > 100) {
      Alert.alert('Error', 'Radius must be between 1 and 100 km');
      return;
    }

    setLoading(true);
    try {
      console.log('🔄 Sending radius update:', radius, 'Type:', typeof radius);
      
      // Try different payload formats
      const payloads = [
        { serviceRadius: radius }, // Original format
        { serviceRadius: parseInt(radius) }, // Ensure integer
        { serviceRadius: Number(radius) }, // Ensure number
        { serviceRadius: radius.toString() }, // Try as string
        { radius: radius }, // Alternative key name
        { radius: parseInt(radius) }, // Alternative key with integer
        { deliveryRadius: radius }, // Another alternative
        { delivery_radius: radius }, // Snake case alternative
      ];

      let success = false;
      let lastError = '';

      // Try different payload formats
      for (const payload of payloads) {
        try {
          console.log('📤 Trying payload:', payload);
          
          const response = await fetch(`${API_BASE_URL}/admin/retailer/radius`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });

          const data = await response.json();
          console.log('📡 API response for payload', payload, ':', data);
          
          if (data.success) {
            console.log('✅ Radius updated successfully with payload:', payload);
            setCurrentRadius(radius);
            setCurrentRadius(radius);
            setRetailerProfile(prev => ({
              ...prev,
              serviceRadius: radius
            }));
            setModalVisible(false);
            Alert.alert('Success', `Service radius updated to ${radius} km`);
            await fetchRetailerProfile();
            refreshProfile(); // Trigger profile refresh in other components
            success = true;
            break;
          } else {
            lastError = data.message || 'Unknown error';
            console.log('❌ Failed with payload:', payload, 'Error:', lastError);
          }
        } catch (error) {
          console.error('🚨 Network error with payload:', payload, error);
          lastError = error.message;
        }
      }

      if (!success) {
        // If all payloads fail, try the profile endpoint as fallback
        console.log('🔄 Trying fallback: updating via profile endpoint');
        const fallbackSuccess = await updateRadiusViaProfile();
        if (!fallbackSuccess) {
          Alert.alert('Error', `Failed to update radius. Last error: ${lastError}`);
        }
      }

    } catch (error) {
      console.error('🚨 Final error updating radius:', error);
      Alert.alert('Error', 'Failed to update service radius. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fallback method: Update via profile endpoint
  const updateRadiusViaProfile = async () => {
    try {
      console.log('🔄 Attempting profile endpoint update...');
      
      const profileData = {
        ...retailerProfile,
        serviceRadius: radius
      };

      // Remove circular references or undefined values
      const cleanProfileData = JSON.parse(JSON.stringify(profileData));

      const response = await fetch(`${API_BASE_URL}/admin/retailer/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanProfileData)
      });

      const data = await response.json();
      console.log('📡 Profile endpoint response:', data);
      
      if (data.success) {
        console.log('✅ Radius updated via profile endpoint');
        setCurrentRadius(radius);
        setRetailerProfile(prev => ({
          ...prev,
          serviceRadius: radius
        }));
        setModalVisible(false);
        Alert.alert('Success', `Service radius updated to ${radius} km`);
        await fetchRetailerProfile();
        return true;
      } else {
        Alert.alert('Error', data.message || 'Failed to update radius via profile');
        return false;
      }
    } catch (error) {
      console.error('🚨 Profile endpoint error:', error);
      Alert.alert('Error', 'Failed to update via profile endpoint');
      return false;
    }
  };

  // Test endpoint function
  const testEndpoint = async () => {
    try {
      console.log('🧪 Testing radius endpoint with value 25...');
      
      const testPayload = { serviceRadius: 25 };
      const response = await fetch(`${API_BASE_URL}/admin/retailer/radius`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      });

      const data = await response.json();
      console.log('🧪 Test result:', data);
      
      if (data.success) {
        console.log('✅ Test successful! Endpoint works with value 25');
        Alert.alert('Test Successful', 'Endpoint is working correctly');
        // Refresh the current radius
        fetchRetailerProfile();
      } else {
        console.log('❌ Test failed:', data.message);
        Alert.alert('Test Failed', `Endpoint error: ${data.message}`);
      }
    } catch (error) {
      console.error('🧪 Test error:', error);
      Alert.alert('Test Error', 'Could not connect to endpoint');
    }
  };

  const QuickRadiusButton = ({ value, label }) => (
    <TouchableOpacity
      style={[
        styles.quickRadiusButton,
        radius === value && styles.quickRadiusButtonActive
      ]}
      onPress={() => setRadius(value)}
    >
      <Text style={[
        styles.quickRadiusText,
        radius === value && styles.quickRadiusTextActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (profileLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Colors.light.accent} />
        <Text style={styles.loadingText}>Loading radius settings...</Text>
      </View>
    );
  }

  return (
    <>
      {/* Radius Display Button */}
      <TouchableOpacity 
        style={styles.radiusButton}
        onPress={() => setModalVisible(true)}
      >
        <View style={styles.radiusButtonContent}>
          <MaterialIcons name="location-on" size={20} color={Colors.light.accent} />
          <View style={styles.radiusInfo}>
            <Text style={styles.radiusLabel}>Service Radius</Text>
            <Text style={styles.radiusValue}>{currentRadius} km</Text>
          </View>
          <MaterialIcons name="edit" size={16} color={Colors.light.textSecondary} />
        </View>
        
        {retailerProfile?.location?.coordinates ? (
          <Text style={styles.locationStatus}>
            <MaterialIcons name="check-circle" size={12} color="#4CAF50" />
            Location set
          </Text>
        ) : (
          <Text style={styles.locationWarning}>
            <MaterialIcons name="warning" size={12} color="#FF9800" />
            Set location
          </Text>
        )}
      </TouchableOpacity>

      {/* Debug Button - Temporary */}
      {/* <TouchableOpacity 
        style={styles.debugButton}
        onPress={testEndpoint}
      >
        <Text style={styles.debugButtonText}>Test Endpoint (Debug)</Text>
      </TouchableOpacity> */}

      {/* Radius Settings Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Fixed Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Set Service Radius</Text>
              <TouchableOpacity 
                onPress={() => {
                  setRadius(currentRadius);
                  setModalVisible(false);
                }}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color={Colors.light.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Scrollable Content */}
            <ScrollView 
              style={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContentContainer}
            >
              <Text style={styles.modalSubtitle}>
                Adjust your delivery service area (1-100 km)
              </Text>

              {/* Debug Info */}
              <View style={styles.debugInfo}>
                <Text style={styles.debugInfoText}>
                  Current: {currentRadius}km | New: {radius}km
                </Text>
              </View>

              {/* Current Radius Display */}
              <View style={styles.currentRadiusDisplay}>
                <Text style={styles.currentRadiusValue}>{radius}</Text>
                <Text style={styles.currentRadiusUnit}>kilometers</Text>
              </View>

              {/* Custom Slider */}
              <View style={styles.sliderContainer}>
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>1 km</Text>
                  <Text style={styles.sliderLabel}>100 km</Text>
                </View>
                
                <View style={styles.slider}>
                  <View style={styles.sliderTrack}>
                    <View 
                      style={[
                        styles.sliderFill,
                        { width: `${radius}%` }
                      ]} 
                    />
                  </View>
                  
                  {/* Touchable areas for slider */}
                  <View style={styles.sliderTouchArea}>
                    {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((position) => (
                      <TouchableOpacity
                        key={position}
                        style={[styles.sliderTouchPoint]}
                        onPress={() => setRadius(position)}
                      />
                    ))}
                  </View>
                  
                  {/* Slider thumb */}
                  <View style={styles.sliderThumbContainer}>
                    <View 
                      style={[
                        styles.sliderThumb,
                        { left: `${radius}%`, marginLeft: -12 }
                      ]}
                    />
                  </View>
                </View>

                {/* Manual input option */}
                <View style={styles.manualInputContainer}>
                  <Text style={styles.manualInputLabel}>Set custom radius:</Text>
                  <View style={styles.manualInputRow}>
                    <TouchableOpacity 
                      style={styles.decrementButton}
                      onPress={() => setRadius(prev => Math.max(1, prev - 1))}
                    >
                      <Text style={styles.manualButtonText}>-</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.manualInputDisplay}>
                      <Text style={styles.manualInputValue}>{radius}</Text>
                      <Text style={styles.manualInputUnit}>km</Text>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.incrementButton}
                      onPress={() => setRadius(prev => Math.min(100, prev + 1))}
                    >
                      <Text style={styles.manualButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Quick Select Buttons */}
              <View style={styles.quickSelectContainer}>
                <Text style={styles.quickSelectTitle}>Quick Select</Text>
                <View style={styles.quickSelectGrid}>
                  <QuickRadiusButton value={5} label="5 km" />
                  <QuickRadiusButton value={10} label="10 km" />
                  <QuickRadiusButton value={25} label="25 km" />
                  <QuickRadiusButton value={50} label="50 km" />
                  <QuickRadiusButton value={75} label="75 km" />
                  <QuickRadiusButton value={100} label="100 km" />
                </View>
              </View>

              {/* Coverage Info */}
              <View style={styles.coverageInfo}>
                <MaterialIcons name="info" size={16} color={Colors.light.accent} />
                <Text style={styles.coverageText}>
                  This will show you orders within {radius} km of your location
                </Text>
              </View>

              {/* Location Status */}
              {!retailerProfile?.location?.coordinates && (
                <View style={styles.locationAlert}>
                  <MaterialIcons name="warning" size={16} color="#FF9800" />
                  <Text style={styles.locationAlertText}>
                    Please set your location in profile settings to use radius-based orders
                  </Text>
                </View>
              )}

              {/* Shop Info */}
              {retailerProfile && (
                <View style={styles.shopInfo}>
                  <MaterialIcons name="store" size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.shopInfoText}>
                    {retailerProfile.shopName} • {retailerProfile.address}
                  </Text>
                </View>
              )}
            </ScrollView>

            {/* Fixed Action Buttons - ALWAYS VISIBLE */}
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setRadius(currentRadius);
                  setModalVisible(false);
                }}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={updateRadius}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="save" size={18} color="#FFF" />
                    <Text style={styles.saveButtonText}>Save Radius</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  loadingText: {
    marginLeft: 12,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  radiusButton: {
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  radiusButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radiusInfo: {
    flex: 1,
    marginLeft: 12,
  },
  radiusLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  radiusValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  locationStatus: {
    fontSize: 11,
    color: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationWarning: {
    fontSize: 11,
    color: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  debugButton: {
    backgroundColor: '#666',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  debugInfo: {
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  debugInfoText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    width: screenWidth * 0.95,
    maxWidth: 500,
    height: screenHeight * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    backgroundColor: '#FFF',
  },
  modalScrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 20,
    paddingTop: 0,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  closeButton: {
    padding: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 24,
    textAlign: 'center',
  },
  currentRadiusDisplay: {
    alignItems: 'center',
    marginBottom: 32,
  },
  currentRadiusValue: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  currentRadiusUnit: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  sliderContainer: {
    marginBottom: 24,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  slider: {
    height: 40,
    justifyContent: 'center',
    marginBottom: 16,
  },
  sliderTrack: {
    height: 6,
    backgroundColor: Colors.light.border,
    borderRadius: 3,
    position: 'relative',
    marginHorizontal: 10,
  },
  sliderFill: {
    height: '100%',
    backgroundColor: Colors.light.accent,
    borderRadius: 3,
    position: 'absolute',
  },
  sliderThumbContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 40,
    justifyContent: 'center',
  },
  sliderThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.accent,
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    position: 'absolute',
  },
  sliderTouchArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderTouchPoint: {
    width: '9%',
    height: '100%',
  },
  manualInputContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  manualInputLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  manualInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  manualInputDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: Colors.light.background,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    minWidth: 100,
    justifyContent: 'center',
  },
  manualInputValue: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.accent,
    marginRight: 4,
  },
  manualInputUnit: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  decrementButton: {
    backgroundColor: Colors.light.background,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  incrementButton: {
    backgroundColor: Colors.light.background,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  manualButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  quickSelectContainer: {
    marginBottom: 24,
  },
  quickSelectTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 12,
  },
  quickSelectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  quickRadiusButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: Colors.light.background,
    borderWidth: 1,
    borderColor: Colors.light.border,
    minWidth: (screenWidth * 0.95 - 80) / 3,
    alignItems: 'center',
  },
  quickRadiusButtonActive: {
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.accent,
  },
  quickRadiusText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  quickRadiusTextActive: {
    color: '#FFF',
  },
  coverageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  coverageText: {
    fontSize: 14,
    color: Colors.light.accent,
    marginLeft: 8,
    flex: 1,
  },
  locationAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 152, 0, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  locationAlertText: {
    fontSize: 14,
    color: '#FF9800',
    marginLeft: 8,
    flex: 1,
  },
  shopInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  shopInfoText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginLeft: 8,
    flex: 1,
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: '#FFF',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
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
  }
});