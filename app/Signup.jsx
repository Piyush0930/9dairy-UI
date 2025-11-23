import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import LocationPicker from '../components/LocationPicker';

const { width, height } = Dimensions.get('window');

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/auth`

// Simple storage helper (replace with SecureStore if needed)
const storage = {
  async setItem(key, value) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
      // For React Native, you might want to use AsyncStorage or SecureStore
      // await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn('Storage error:', error);
    }
  },
  async getItem(key) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const value = window.localStorage.getItem(key);
        return value ? JSON.parse(value) : null;
      }
      // For React Native
      // const value = await AsyncStorage.getItem(key);
      // return value ? JSON.parse(value) : null;
      return null;
    } catch (error) {
      console.warn('Storage error:', error);
      return null;
    }
  }
};

export default function Signup() {
  const [userType, setUserType] = useState('customer');
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [shopName, setShopName] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpShown, setOtpShown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [userId, setUserId] = useState(null);
  const [locationData, setLocationData] = useState(null);
  const router = useRouter();
  const otpRefs = useRef([]);

  const showAlert = (title, message) => {
    Alert.alert(title, message, [{ text: 'OK' }]);
  };

  const handleOtpChange = (text, index) => {
    if (/^\d*$/.test(text)) {
      const newOtp = [...otp];
      newOtp[index] = text;
      setOtp(newOtp);
      
      // Auto-focus next input
      if (text && index < otp.length - 1) {
        otpRefs.current[index + 1]?.focus();
      }
      
      // Auto-focus previous input on backspace
      if (!text && index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    }
  };

  const validateForm = () => {
    if (!fullName.trim()) {
      showAlert('Validation Error', 'Please enter your full name');
      return false;
    }
    
    if (!address.trim()) {
      showAlert('Validation Error', 'Please enter your address');
      return false;
    }
    
    if (!contactNo || contactNo.length !== 10 || !/^\d+$/.test(contactNo)) {
      showAlert('Validation Error', 'Please enter a valid 10-digit contact number');
      return false;
    }
    
    return true;
  };

  const handleLocationSelect = (location) => {
  console.log('📍 User ne location select kiya:', {
    address: location.formattedAddress,
    coordinates: location.coordinates,
    hasCoords: !!(location.coordinates?.latitude && location.coordinates?.longitude)
  });
  
  // Address components se city, state extract karo
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
  
  // User ko sirf address dikhao
  if (location.formattedAddress) {
    setAddress(location.formattedAddress);
  }
};

  const handleGetOtp = async (isResend = false) => {
  if (!validateForm()) return;

  console.log('📍 Current Location Data:', locationData);

  setLoading(true);
  if (isResend) setResendLoading(true);

  try {
    // ✅ BACKEND KE PARAMETERS KE HISAB SE DATA BANAO
    let locationParams = {};
    
    if (locationData && locationData.coordinates) {
      // Backend ko yeh format chahiye:
      locationParams = {
        coordinates: {
          latitude: locationData.coordinates.latitude,
          longitude: locationData.coordinates.longitude
        },
        formattedAddress: locationData.formattedAddress || address
      };
      console.log('✅ Using coordinates in backend parameters format');
    } else {
      // ✅ AGAR COORDINATES NAHI HAI TO DEFAULT USE KARO
      console.log('⚠ No coordinates found, using defaults');
      locationParams = {
        coordinates: {
          latitude: 20.0983745,
          longitude: 73.9296103
        },
        formattedAddress: address
      };
    }

    const signupData = {
      phone: contactNo,
      fullName,
      address: locationData?.formattedAddress || address,
      contactNo,
      userType,
      ...locationParams  // ✅ Direct parameters, NOT nested under location
    };

    console.log('📤 Final API Payload (Backend Parameters):', JSON.stringify(signupData, null, 2));

    const response = await fetch(`${API_BASE_URL}/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signupData),
    });

    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Server error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Server response:', data);

    if (data.success) {
      setUserId(data.userId);
      if (!isResend) {
        setOtpShown(true);
      }
      showAlert('Success', isResend ? 'OTP resent successfully!' : data.message);
    } else {
      throw new Error(data.message || 'Signup failed');
    }
  } catch (error) {
    console.error('❌ Signup Error:', error);
    
    if (error.message.includes('coordinates')) {
      showAlert('Location Error', 'Please select a valid location from suggestions or use current location.');
    } else if (error.message.includes('Network request failed')) {
      showAlert('Network Error', 'Please check your internet connection and try again.');
    } else {
      showAlert('Error', error.message || 'Failed to sign up. Please try again.');
    }
  } finally {
    setLoading(false);
    if (isResend) setResendLoading(false);
  }
};

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) {
      showAlert('Validation Error', 'Please enter complete 6-digit OTP');
      return;
    }

    setLoading(true);

    try {
      const verifyData = {
        phone: contactNo,
        otp: otpCode
      };

      const response = await fetch(`${API_BASE_URL}/verify-otp`, {
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

      // Store token and user data
      if (data.token) {
        await storage.setItem('authToken', data.token);
        await storage.setItem('userData', JSON.stringify(data.user));
      }

      showAlert('Success', 'Account verified successfully!');

      // Navigate based on role from response
      const userRole = data.user?.role || userType;
      if (userRole === 'customer') {
        router.replace('/(tabs)');
      } else {
        router.replace('/(admin)');
      }
    } catch (error) {
      console.error('Verification Error:', error);
      if (error.message === 'Network request failed') {
        showAlert('Network Error', 'Please check your internet connection and try again.');
      } else {
        showAlert('Error', error.message || 'Failed to verify OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSigninLink = () => {
    router.push('/Login');
  };

  const resetForm = () => {
    setUserType('customer');
    setFullName('');
    setAddress('');
    setContactNo('');
    setShopName('');
    setOtp(['', '', '', '', '', '']);
    setOtpShown(false);
    setUserId(null);
    setLocationData(null);
  };

  return (
    <KeyboardAwareScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ flexGrow: 1 }}
      enableOnAndroid={true}
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={20}
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-1 px-6 pt-10 pb-10">
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

        {/* Header Section */}
        <View className="items-center mb-5">
          <Image
            source={require('../assets/images/logo.jpeg')}
            className="w-36 h-28 mb-2"
            resizeMode="contain"
          />
          <Text className="text-base text-slate-500 font-medium">Create your account</Text>
        </View>

        {/* Main Content */}
        <View className="flex-1">
          {/* Form Fields */}
          <View className="mb-8">
            <View className="flex-row items-center border border-slate-300 rounded-lg px-4 py-3 mb-4 bg-slate-100 min-h-[56px]">
              <TextInput
                className="flex-1 text-base text-slate-800"
                placeholder="Full Name *"
                placeholderTextColor="#94a3b8"
                value={fullName}
                onChangeText={setFullName}
                editable={!loading && !otpShown}
                returnKeyType="next"
              />
            </View>

            <View className="mb-4">
              <Text className="text-base text-slate-800 font-medium mb-2">Address *</Text>
              <LocationPicker
                onLocationSelect={handleLocationSelect}
                placeholder="Enter your address"
                showCurrentLocation={true}
                style={{ zIndex: 1000 }}
              />
            </View>

            <View className="flex-row items-center border border-slate-300 rounded-lg px-4 py-3 mb-4 bg-slate-100 min-h-[56px]">
              <View className="flex-row items-center pr-3 border-r border-r-slate-300">
                <Text className="text-lg mr-2">🇮🇳</Text>
                <Text className="text-sm text-slate-800 font-semibold">+91</Text>
              </View>
              <TextInput
                className="flex-1 text-base text-slate-800 ml-3"
                placeholder="Contact Number *"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                maxLength={10}
                value={contactNo}
                onChangeText={setContactNo}
                editable={!loading && !otpShown}
                returnKeyType="next"
              />
            </View>

            {!otpShown ? (
              <TouchableOpacity
                className={`bg-blue-500 rounded-lg py-4 items-center justify-center mb-4 ${loading ? 'bg-gray-400' : ''}`}
                onPress={() => handleGetOtp(false)}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text className="text-white text-base font-bold">Get OTP</Text>
                )}
              </TouchableOpacity>
            ) : (
              <>
                {/* OTP Section */}
                <Text className="text-lg text-slate-900 mb-2 font-semibold text-center">Enter 6-digit OTP</Text>
                <Text className="text-sm text-slate-500 mb-6 text-center">
                  OTP sent to +91 {contactNo}
                </Text>
                
                <View className="flex-row justify-between mb-6 px-2">
                  {otp.map((value, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => (otpRefs.current[index] = ref)}
                      className={`w-12 h-12 border-2 border-slate-300 rounded-lg text-xl font-bold bg-white text-slate-900 text-center ${value ? 'border-blue-500 bg-blue-50' : ''}`}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={value}
                      onChangeText={(text) => handleOtpChange(text, index)}
                      textAlign="center"
                      editable={!loading}
                      selectTextOnFocus
                    />
                  ))}
                </View>

                <TouchableOpacity
                  className={`bg-blue-500 rounded-lg py-4 items-center justify-center mb-4 ${loading ? 'bg-gray-400' : ''}`}
                  onPress={handleVerify}
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text className="text-white text-base font-bold">Verify & Sign Up</Text>
                  )}
                </TouchableOpacity>

                {/* Resend OTP Option */}
                <TouchableOpacity 
                  className="items-center mb-3 py-2"
                  onPress={() => handleGetOtp(true)}
                  disabled={resendLoading}
                >
                  {resendLoading ? (
                    <ActivityIndicator color="#3b82f6" size="small" />
                  ) : (
                    <Text className="text-sm text-slate-500">
                      Didn't receive OTP? <Text className="text-blue-500 font-semibold">Resend</Text>
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Edit Number Option */}
                <TouchableOpacity 
                  className="items-center mb-6 py-2"
                  onPress={() => setOtpShown(false)}
                  disabled={loading}
                >
                  <Text className="text-sm text-slate-500">
                    Wrong number? <Text className="text-red-500 font-semibold">Edit</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Signin Link */}
            <TouchableOpacity 
              onPress={handleSigninLink} 
              className="items-center mb-6 py-2"
              disabled={loading}
            >
              <Text className="text-base text-slate-500">
                Already have an account? <Text className="text-blue-500 font-semibold">Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text className="text-xs text-slate-400 text-center leading-4">
            By signing up, you agree to our Terms & Privacy Policy
          </Text>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}