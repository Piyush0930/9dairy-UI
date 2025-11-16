// app/Login.jsx
import { useAuth } from '@/contexts/AuthContext';
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
  
  const { login, isAuthenticated } = useAuth();

  const showAlert = (title, message) => {
    Alert.alert(title, message, [{ text: 'OK' }]);
  };

  const handleBackFromOtp = () => {
    setOtpShown(false);
    setOtp(['', '', '', '', '', '']);
    setMobile('');
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
        
        setTimeout(() => {
          otpRefs.current[0]?.focus();
        }, 100);
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

  // FIXED OTP HANDLING
  const handleOtpChange = (text, index) => {
    if (!/^\d?$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto move to next input when a digit is entered
    if (text && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    
    // Auto submit when last digit is entered - USE setTimeout TO WAIT FOR STATE UPDATE
    if (text && index === 5) {
      // Wait for state to update then check if all digits are filled
      setTimeout(() => {
        const updatedOtp = [...newOtp]; // Use the latest newOtp array
        const finalOtp = updatedOtp.join('');
        console.log('Auto-checking OTP:', finalOtp, 'Length:', finalOtp.length);
        
        if (finalOtp.length === 6) {
          console.log('All digits filled, auto-verifying...');
          handleVerifyWithOtp(finalOtp); // Pass the complete OTP directly
        }
      }, 50);
    }
  };

  // Handle backspace key press
  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  // NEW: Separate function for verification that accepts OTP directly
  const handleVerifyWithOtp = async (otpCode) => {
    console.log('🔐 Verifying OTP:', otpCode, 'for mobile:', mobile);
    
    if (!otpCode || otpCode.length !== 6) {
      showAlert('Validation Error', 'Please enter complete 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: mobile, otp: otpCode }),
      });

      const data = await response.json();
      console.log('✅ Verification Response:', data);

      if (data.success && data.token) {
        console.log('🚀 Calling AuthContext login...');
        await login(data.user, data.token);
        console.log('✅ AuthContext login completed');
        
        showAlert('Success', 'Login successful!');

        setTimeout(() => {
          console.log('📍 Navigating to appropriate screen...');
          const userRole = data.user?.role;
          if (userRole === 'admin') {
            router.replace('/(admin)');
          } else {
            router.replace('/(tabs)');
          }
        }, 300);
      } else {
        throw new Error(data.message || 'Invalid OTP');
      }
    } catch (error) {
      console.error('❌ Verification Error:', error);
      showAlert('Error', error.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ORIGINAL verify function (for manual button press)
  const handleVerify = async () => {
    const otpCode = otp.join('');
    console.log('Manual verify - OTP:', otpCode, 'Length:', otpCode.length);
    
    await handleVerifyWithOtp(otpCode);
  };

  // If already authenticated, redirect to appropriate screen
  if (isAuthenticated) {
    console.log('🔄 Already authenticated, redirecting...');
    setTimeout(() => {
      router.replace('/(tabs)');
    }, 100);
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Redirecting...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header with Back Button */}
      {otpShown && (
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={handleBackFromOtp}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Enter OTP</Text>
          <View style={styles.headerPlaceholder} />
        </View>
      )}

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
        <View style={styles.spacer} />

        {/* White Card */}
        <View style={styles.bottomCard}>
          {/* Logo */}
          {!otpShown && (
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>Dairy Nine</Text>
            </View>
          )}

          <Text style={styles.title}>
            {otpShown ? 'Enter OTP' : 'Fresh dairy delivered daily'}
          </Text>
          
          <Text style={styles.subtitle}>
            {otpShown 
              ? `Sent to +91 ${mobile}` 
              : 'Sign in with your mobile number'
            }
          </Text>

          {/* Mobile Input or OTP Input */}
          {!otpShown ? (
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
          ) : (
            <View style={styles.otpSection}>
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
                    onKeyPress={(e) => handleOtpKeyPress(e, index)}
                    textAlign="center"
                    editable={!loading}
                    selectTextOnFocus
                  />
                ))}
              </View>

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
            </View>
          )}

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

// ==================== STYLES (Same as before) ====================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff',
  },
  header: {
    position: 'absolute',
    top: StatusBar.currentHeight || 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 1000,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  headerPlaceholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748b',
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
  otpSection: {
    width: '100%',
    marginBottom: 12,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 16,
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
  resendContainer: { 
    alignItems: 'center', 
    marginBottom: 12 
  },
  resendText: { 
    fontSize: 14, 
    color: '#64748b' 
  },
  resendTextBold: { 
    color: '#3b82f6', 
    fontWeight: '600' 
  },
});