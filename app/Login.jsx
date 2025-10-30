// C:\Users\Krishna\OneDrive\Desktop\frontend-dairy9\9dairy-UI\app\Login.jsx

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
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const { width, height } = Dimensions.get('window');
const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/auth`;

export default function Login() {
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [otpShown, setOtpShown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const router = useRouter();
  const otpRefs = useRef([]);

  const showAlert = (title, message) => {
    Alert.alert(title, message, [{ text: 'OK' }]);
  };

  const handleSendOTP = async () => {
    if (mobile.length !== 10 || !/^\d+$/.test(mobile)) {
      showAlert('Validation Error', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setSendingOtp(true);
    try {
      console.log('Sending OTP to:', mobile);

      const response = await fetch(`${API_BASE_URL}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: mobile }),
      });

      const data = await response.json();
      console.log('OTP Response:', data);

      if (data.success) {
        setOtpShown(true);
        showAlert('Success', 'OTP sent to your mobile number');
      } else {
        throw new Error(data.message || 'Failed to send OTP');
      }
    } catch (error) {
      console.error('OTP Send Error:', error);
      showAlert('Error', error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleOtpChange = (text, index) => {
    if (!/^\d?$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) {
      otpRefs.current[index + 1]?.focus();
    } else if (!text && index > 0) {
      otpRefs.current[index - 1]?.focus();
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
      console.log('Verifying OTP for:', mobile);

      const response = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: mobile, otp: otpCode }),
      });

      const data = await response.json();
      console.log('Verification Response:', data);

      if (data.success && data.token) {
        await AsyncStorage.setItem('authToken', data.token);
        await AsyncStorage.setItem('userData', JSON.stringify(data.user));

        showAlert('Success', 'Login successful!');

        const userRole = data.user?.role;
        if (userRole === 'admin') {
          router.replace('/(admin)');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        throw new Error(data.message || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Verification Error:', error);
      showAlert('Error', error.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background Image */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=800&q=80' }}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
      </View>

      {/* Scrollable Content */}
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scrollContent}
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        extraScrollHeight={100}
      >
        {/* Spacer to push content below image */}
        <View style={styles.spacer} />

        {/* White Card */}
        <View style={styles.bottomCard}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Dairy Nine</Text>
          </View>

          <Text style={styles.title}>Fresh dairy delivered daily</Text>
          <Text style={styles.subtitle}>Sign in with your mobile number</Text>

          {/* Mobile Input */}
          <View style={styles.inputContainer}>
            <View style={styles.flagContainer}>
              <Text style={styles.flag}>India</Text>
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

          {/* Conditional Rendering */}
          {!otpShown ? (
            <>
              <TouchableOpacity
                style={[styles.continueButton, sendingOtp && styles.buttonDisabled]}
                onPress={handleSendOTP}
                disabled={sendingOtp}
              >
                {sendingOtp ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send OTP</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/Signup')} disabled={sendingOtp}>
                <Text style={styles.createAccountText}>
                  New user? <Text style={styles.createAccountLink}>Create Account</Text>
                </Text>
              </TouchableOpacity>

              <Text style={styles.footerText}>
                By continuing, you agree to our Terms & Privacy Policy
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.otpTitle}>Enter 6-digit OTP</Text>
              <Text style={styles.otpSubtitle}>Sent to +91 {mobile || 'your number'}</Text>

              <View style={styles.otpContainer}>
                {otp.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (otpRefs.current[index] = ref)}
                    style={[styles.otpInput, digit ? styles.otpInputActive : null]}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
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
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify & Sign In</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.resendContainer}
                onPress={handleSendOTP}
                disabled={sendingOtp}
              >
                {sendingOtp ? (
                  <ActivityIndicator color="#3b82f6" size="small" />
                ) : (
                  <Text style={styles.resendText}>
                    Didn't receive OTP?{' '}
                    <Text style={styles.resendTextBold}>Resend</Text>
                  </Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.editNumberContainer}
                onPress={() => setOtpShown(false)}
                disabled={loading}
              >
                <Text style={styles.editNumberText}>
                  Wrong number?{' '}
                  <Text style={styles.editNumberTextBold}>Edit</Text>
                </Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/Signup')} disabled={loading}>
                <Text style={styles.createAccountText}>
                  New user? <Text style={styles.createAccountLink}>Create Account</Text>
                </Text>
              </TouchableOpacity>

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

// ==================== STYLES ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  imageContainer: {
    position: 'absolute',
    top: 0,
    width: '100%',
    height: height * 0.5,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
  },
  scrollContent: {
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
    paddingVertical: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    minHeight: height * 0.55,
  },
  logoContainer: { marginBottom: 12 },
  logoText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    width: '100%',
    marginBottom: 12,
  },
  flagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRightWidth: 1.5,
    borderRightColor: '#e2e8f0',
  },
  flag: { fontSize: 18, marginRight: 6 },
  countryCode: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontWeight: '500',
  },
  continueButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
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
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
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
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 24,
  },
  otpInput: {
    width: 46,
    height: 46,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    fontSize: 20,
    fontWeight: '700',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    textAlign: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  otpInputActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#f0f9ff',
    shadowColor: '#3b82f6',
    shadowOpacity: 0.2,
  },
  resendContainer: { alignItems: 'center', marginBottom: 12 },
  resendText: { fontSize: 14, color: '#64748b' },
  resendTextBold: { color: '#3b82f6', fontWeight: '600' },
  editNumberContainer: { alignItems: 'center', marginBottom: 16 },
  editNumberText: { fontSize: 14, color: '#64748b' },
  editNumberTextBold: { color: '#ef4444', fontWeight: '600' },
});