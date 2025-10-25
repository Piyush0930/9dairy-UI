import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import LocationPicker from '../components/LocationPicker';

const { width, height } = Dimensions.get('window');

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/auth`;

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
    
    if (userType === 'admin' && !shopName.trim()) {
      showAlert('Validation Error', 'Please enter shop name');
      return false;
    }
    
    return true;
  };

  const handleGetOtp = async (isResend = false) => {
    if (!validateForm()) return;

    setLoading(true);
    if (isResend) setResendLoading(true);

    try {
      const signupData = {
        phone: contactNo,
        fullName,
        address,
        contactNo,
        userType,
        ...(userType === 'admin' && { shopName })
      };

      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(signupData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Signup failed');
      }

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
      console.error('Signup Error:', error);
      if (error.message === 'Network request failed') {
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

      // Store token and user data securely
      if (data.token) {
        await AsyncStorage.setItem('authToken', data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(data.user));
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
  };

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      enableOnAndroid={true}
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={20}
      showsVerticalScrollIndicator={false}
    >
      <View>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

        {/* Header Section */}
        <View style={styles.header}>
          <Image
            source={require('../assets/images/logo.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.headerSubtitle}>Create your account</Text>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* User Type Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, userType === 'customer' && styles.toggleButtonActive]}
              onPress={() => resetForm()}
              disabled={loading}
            >
              <Text style={[styles.toggleText, userType === 'customer' && styles.toggleTextActive]}>
                Customer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, userType === 'admin' && styles.toggleButtonActive]}
              onPress={() => {
                setUserType('admin');
                setFullName('');
                setAddress('');
                setContactNo('');
                setShopName('');
                setOtp(['', '', '', '', '', '']);
                setOtpShown(false);
                setUserId(null);
              }}
              disabled={loading}
            >
              <Text style={[styles.toggleText, userType === 'admin' && styles.toggleTextActive]}>
                Retailer
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Full Name *"
                placeholderTextColor="#94a3b8"
                value={fullName}
                onChangeText={setFullName}
                editable={!loading && !otpShown}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Address *"
                placeholderTextColor="#94a3b8"
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={2}
                editable={!loading && !otpShown}
                returnKeyType="next"
              />
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.flagContainer}>
                <Text style={styles.flag}>🇮🇳</Text>
                <Text style={styles.countryCode}>+91</Text>
              </View>
              <TextInput
                style={styles.input}
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

            {userType === 'admin' && (
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Shop Name *"
                  placeholderTextColor="#94a3b8"
                  value={shopName}
                  onChangeText={setShopName}
                  editable={!loading && !otpShown}
                  returnKeyType="done"
                />
              </View>
            )}

            {!otpShown ? (
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={() => handleGetOtp(false)}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Get OTP</Text>
                )}
              </TouchableOpacity>
            ) : (
              <>
                {/* OTP Section */}
                <Text style={styles.otpTitle}>Enter 6-digit OTP</Text>
                <Text style={styles.otpSubtitle}>
                  OTP sent to +91 {contactNo}
                </Text>
                
                <View style={styles.otpContainer}>
                  {otp.map((value, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => (otpRefs.current[index] = ref)}
                      style={[styles.otpInput, value && styles.otpInputActive]}
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
                  style={[styles.primaryButton, loading && styles.buttonDisabled]}
                  onPress={handleVerify}
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify & Sign Up</Text>
                  )}
                </TouchableOpacity>

                {/* Resend OTP Option */}
                <TouchableOpacity 
                  style={styles.resendContainer}
                  onPress={() => handleGetOtp(true)}
                  disabled={resendLoading}
                >
                  {resendLoading ? (
                    <ActivityIndicator color="#3b82f6" size="small" />
                  ) : (
                    <Text style={styles.resendText}>
                      Didn't receive OTP? <Text style={styles.resendTextBold}>Resend</Text>
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Edit Number Option */}
                <TouchableOpacity 
                  style={styles.editNumberContainer}
                  onPress={() => setOtpShown(false)}
                  disabled={loading}
                >
                  <Text style={styles.editNumberText}>
                    Wrong number? <Text style={styles.editNumberTextBold}>Edit</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* Signin Link */}
            <TouchableOpacity 
              onPress={handleSigninLink} 
              style={styles.linkContainer}
              disabled={loading}
            >
              <Text style={styles.linkText}>
                Already have an account? <Text style={styles.linkTextBold}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <Text style={styles.footerText}>
            By signing up, you agree to our Terms & Privacy Policy
          </Text>
        </View>
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 150,
    height: 120,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  mainContent: {
    flex: 1,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 32,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: '#3b82f6',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
  formContainer: {
    marginBottom: 32,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
    backgroundColor: '#f8fafc',
    minHeight: 56,
  },
  flagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
    borderRightWidth: 1.5,
    borderRightColor: '#e2e8f0',
  },
  flag: {
    fontSize: 18,
    marginRight: 6,
  },
  countryCode: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
    paddingVertical: 8,
    fontWeight: '500',
  },
  locationContainer: {
    marginBottom: 16,
  },
  locationLabel: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
    marginBottom: 8,
  },
  locationPicker: {
    zIndex: 1000,
  },
  otpTitle: {
    fontSize: 18,
    color: '#0f172a',
    marginBottom: 8,
    fontWeight: '600',
    textAlign: 'center',
  },
  otpSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 24,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 10,
  },
  otpInput: {
    width: 48,
    height: 48,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    fontSize: 20,
    fontWeight: '700',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    textAlign: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  otpInputActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#f0f9ff',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
    shadowColor: '#9ca3af',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
  },
  resendText: {
    fontSize: 14,
    color: '#64748b',
  },
  resendTextBold: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  editNumberContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 8,
  },
  editNumberText: {
    fontSize: 14,
    color: '#64748b',
  },
  editNumberTextBold: {
    color: '#ef4444',
    fontWeight: '600',
  },
  linkContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 16,
    color: '#64748b',
  },
  linkTextBold: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 16,
  },
});