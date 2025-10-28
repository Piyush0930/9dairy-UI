// C:\Users\Krishna\OneDrive\Desktop\frontend-dairy9\9dairy-UI\app\Login.jsx

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

const { width, height } = Dimensions.get('window');

const API_BASE_URL =`${process.env.EXPO_PUBLIC_API_URL}/api/auth`;
// Storage helper
const storage = {
  async setItem(key, value) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
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
      return null;
    } catch (error) {
      console.warn('Storage error:', error);
      return null;
    }
  }
};

export default function Login() {
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']); // ✅ Changed to 6 digits
  const [otpShown, setOtpShown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const router = useRouter();
  const otpRefs = useRef([]);

  const showAlert = (title, message) => {
    Alert.alert(title, message, [{ text: 'OK' }]);
  };

  const handleSendOTP = async () => {
    if (mobile.length !== 10) {
      showAlert('Validation Error', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setSendingOtp(true);
    try {
      console.log('📱 Sending OTP to:', mobile);
      
      const response = await fetch(`${API_BASE_URL}/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: mobile }),
      });

      const data = await response.json();
      console.log('📲 OTP Response:', data);

      if (data.success) {
        setOtpShown(true);
        showAlert('Success', 'OTP sent to your mobile number');
      } else {
        throw new Error(data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('❌ OTP Send Error:', error);
      showAlert('Error', error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
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

  const handleVerify = async () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 6) { // ✅ Changed to 6 digits
      showAlert('Validation Error', 'Please enter complete 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      console.log('🔐 Verifying OTP for:', mobile);
      
      const response = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          phone: mobile, 
          otp: otpCode 
        }),
      });

      const data = await response.json();
      console.log('✅ Verification Response:', data);

      if (data.success) {
        // Store token and user data
        if (data.token) {
          await storage.setItem('authToken', data.token);
          await storage.setItem('userData', JSON.stringify(data.user));
        }

        showAlert('Success', 'Login successful!');
        
        // Redirect based on user role
        const userRole = data.user?.role;
        console.log('🎯 User Role:', userRole);
        
        if (userRole === 'admin') {
          console.log('🚀 Redirecting to Admin Dashboard');
          router.replace('/(admin)');
        } else {
          console.log('🚀 Redirecting to Customer Dashboard');
          router.replace('/(tabs)');
        }
      } else {
        throw new Error(data.message || 'OTP verification failed');
      }
    } catch (error) {
      console.error('❌ Verification Error:', error);
      showAlert('Error', error.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Top Half Image Section */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=800&q=80' }}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      </View>

      {/* Bottom White Card Section with KeyboardAwareScrollView */}
      <KeyboardAwareScrollView
        style={styles.keyboardAwareContainer}
        contentContainerStyle={styles.keyboardAwareContent}
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
        extraScrollHeight={80}
        keyboardOpeningTime={200}
        enableAutomaticScroll={true}
        showsVerticalScrollIndicator={false}
        resetScrollToCoords={{ x: 0, y: 0 }}
        scrollEnabled={true}
      >
        <View style={styles.spacer} />
        <View style={styles.bottomCard}>
          {/* Brand Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Dairy Nine</Text>
          </View>

          <Text style={styles.title}>
            Fresh dairy delivered daily
          </Text>

          <Text style={styles.subtitle}>
            Sign in with your mobile number
          </Text>

          {/* Phone Input Field */}
          <View style={styles.inputContainer}>
            <View style={styles.flagContainer}>
              <Text style={styles.flag}>🇮🇳</Text>
              <Text style={styles.countryCode}>+91</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Enter mobile number"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              maxLength={10}
              value={mobile}
              onChangeText={setMobile}
              editable={!sendingOtp && !loading}
            />
          </View>

          {!otpShown ? (
            <>
              {/* Continue Button */}
              <TouchableOpacity
                style={[styles.continueButton, sendingOtp && styles.buttonDisabled]}
                onPress={handleSendOTP}
                activeOpacity={0.8}
                disabled={sendingOtp}
              >
                {sendingOtp ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Send OTP</Text>
                )}
              </TouchableOpacity>

              {/* Create Account Link */}
              <TouchableOpacity onPress={() => router.push('/Signup')} disabled={sendingOtp}>
                <Text style={styles.createAccountText}>
                  New user? <Text style={styles.createAccountLink}>Create Account</Text>
                </Text>
              </TouchableOpacity>

              {/* Footer Text */}
              <Text style={styles.footerText}>
                By continuing, you agree to our Terms & Privacy Policy
              </Text>
            </>
          ) : (
            <>
              {/* OTP Section */}
              <Text style={styles.otpTitle}>Enter 6-digit OTP</Text> {/* ✅ Changed text */}
              <Text style={styles.otpSubtitle}>
                OTP sent to +91 {mobile}
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
                style={[styles.continueButton, loading && styles.buttonDisabled]}
                onPress={handleVerify}
                activeOpacity={0.8}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Verify & Sign In</Text>
                )}
              </TouchableOpacity>

              {/* Resend OTP Option */}
              <TouchableOpacity 
                style={styles.resendContainer}
                onPress={handleSendOTP}
                disabled={sendingOtp}
              >
                {sendingOtp ? (
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

              {/* Create Account Link */}
              <TouchableOpacity onPress={() => router.push('/Signup')} disabled={loading}>
                <Text style={styles.createAccountText}>
                  New user? <Text style={styles.createAccountLink}>Create Account</Text>
                </Text>
              </TouchableOpacity>

              {/* Footer Text */}
              <Text style={styles.footerText}>
                By continuing, you agree to our Terms & Privacy Policy
              </Text>
            </>
          )}
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  imageContainer: {
    width: '100%',
    height: height * 0.5,
    position: 'absolute',
    top: 0,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  keyboardAwareContainer: {
    width: '100%',
    flex: 1,
  },
  keyboardAwareContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  spacer: {
    height: height * 0.48,
  },
  bottomCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingVertical: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    minHeight: height * 0.52,
  },
  logoContainer: {
    marginBottom: 12,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '400',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
    backgroundColor: '#f8fafc',
    width: '100%',
  },
  flagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
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
    fontSize: 14,
    color: '#1e293b',
    paddingLeft: 12,
    paddingVertical: 12,
    fontWeight: '500',
  },
  continueButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    marginBottom: 12,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
    shadowColor: '#9ca3af',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  createAccountText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 12,
  },
  createAccountLink: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  footerText: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 16,
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
    marginBottom: 20,
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 10, // ✅ Reduced padding for 6 inputs
  },
  otpInput: {
    width: 48, // ✅ Slightly smaller for 6 inputs
    height: 48, // ✅ Slightly smaller for 6 inputs
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
    marginBottom: 16,
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
});