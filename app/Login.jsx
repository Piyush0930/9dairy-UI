// app/Login.jsx
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
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');
const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/auth`;

export default function Login() {
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [secret, setSecret] = useState(['', '', '', '', '', '']);
  const [currentStep, setCurrentStep] = useState('mobile'); // 'mobile' | 'otp' | 'secret'
  const [sessionToken, setSessionToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const router = useRouter();
  const otpRefs = useRef([]);
  const secretRefs = useRef([]);

  const { login, isAuthenticated } = useAuth();

  const showAlert = (title, message) => {
    Alert.alert(title, message, [{ text: 'OK' }]);
  };

  const resetForm = () => {
    setCurrentStep('mobile');
    setOtp(['', '', '', '', '', '']);
    setSecret(['', '', '', '', '', '']);
    setMobile('');
    setSessionToken(null);
  };

  const handleBack = () => {
    if (currentStep === 'otp') {
      setCurrentStep('mobile');
      setOtp(['', '', '', '', '', '']);
    } else if (currentStep === 'secret') {
      setCurrentStep('otp');
      setSecret(['', '', '', '', '', '']);
    }
  };

  // 🔹 Step 1: Send OTP
  const handleSendOTP = async () => {
    if (mobile.length !== 10 || !/^\d+$/.test(mobile)) {
      showAlert('Validation Error', 'Please enter a valid 10-digit mobile number');
      return;
    }

    setSendingOtp(true);
    try {
      console.log('📩 Sending OTP to:', mobile);

      const response = await fetch(`${API_BASE_URL}/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: mobile }),
      });

      const data = await response.json();
      console.log('📩 Send OTP Response:', data);

      if (data.success) {
        setCurrentStep('otp');
        showAlert(`'Success', 'OTP sent to your mobile number'Otp is ${data.otp}`);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
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

  // 🔹 OTP Input Handling
  const handleOtpChange = (text, index) => {
    if (!/^\d?$/.test(text)) return;

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    if (text && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    if (text && index === 5) {
      const finalOtp = newOtp.join('');
      if (finalOtp.length === 6) {
        handleVerifyOTP(finalOtp);
      }
    }
  };

  const handleOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  // 🔹 Step 2: Verify OTP
  const handleVerifyOTP = async (otpCode) => {
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

      if (data.success) {
        // 🔐 If SuperAdmin, ask for Secret Key
        if (data.requirePassword && data.sessionToken) {
          setSessionToken(data.sessionToken);
          setCurrentStep('secret');
          setTimeout(() => secretRefs.current[0]?.focus(), 100);
          showAlert('SuperAdmin Access', 'Please enter your secret key');
        } else if (data.token && data.user) {
          // ✅ Normal user login
          await login(data.user, data.token);
          showAlert('Success', 'Login successful!');
          
          setTimeout(() => {
            const userRole = data.user?.role;
            if (userRole === 'admin') {
              router.replace('/(admin)');
            } else if (userRole === 'superadmin') {
              router.replace('/(superadmin)');
            } else {
              router.replace('/(tabs)');
            }
          }, 300);
        } else {
          throw new Error('Invalid server response');
        }
      } else {
        throw new Error(data.message || 'Invalid OTP');
      }
    } catch (error) {
      console.error('❌ OTP Verify Error:', error);
      showAlert('Error', error.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Secret Key Handling
  const handleSecretChange = (text, index) => {
    if (!/^\d?$/.test(text)) return;

    const newSecret = [...secret];
    newSecret[index] = text;
    setSecret(newSecret);

    if (text && index < 5) {
      secretRefs.current[index + 1]?.focus();
    }

    if (text && index === 5) {
      const finalSecret = newSecret.join('');
      if (finalSecret.length === 6) {
        handleVerifySuperAdmin(finalSecret);
      }
    }
  };

  const handleSecretKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !secret[index] && index > 0) {
      secretRefs.current[index - 1]?.focus();
      const newSecret = [...secret];
      newSecret[index - 1] = '';
      setSecret(newSecret);
    }
  };

  // 🔹 Step 3: Verify SuperAdmin Secret Key
  const handleVerifySuperAdmin = async (secretKey) => {
    if (!secretKey || secretKey.length !== 6) {
      showAlert('Validation Error', 'Please enter complete 6-digit secret key');
      return;
    }

    if (!sessionToken) {
      showAlert('Error', 'Session expired. Please restart login.');
      resetForm();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/superadmin/verify-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phone: mobile, 
          secretKey, 
          sessionToken 
        }),
      });

      const data = await response.json();
      console.log('✅ SuperAdmin Secret Verify:', data);

      if (data.success && data.token && data.user) {
        await login(data.user, data.token);
        showAlert('Success', 'SuperAdmin access granted!');
        setTimeout(() => router.replace('/(superadmin)'), 300);
      } else {
        throw new Error(data.message || 'Invalid secret key');
      }
    } catch (error) {
      console.error('❌ SuperAdmin Verify Error:', error);
      showAlert('Error', error.message || 'Failed to verify secret key.');
      
      // Clear secret input on failure
      setSecret(['', '', '', '', '', '']);
      setTimeout(() => secretRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  // Manual verification buttons
  const handleManualVerifyOTP = () => {
    const otpCode = otp.join('');
    handleVerifyOTP(otpCode);
  };

  const handleManualVerifySecret = () => {
    const secretKey = secret.join('');
    handleVerifySuperAdmin(secretKey);
  };

  // Resend OTP
  const handleResendOTP = async () => {
    await handleSendOTP();
  };

  // Redirect if already authenticated
  if (isAuthenticated) {
    console.log('🔄 Already authenticated, redirecting...');
    setTimeout(() => router.replace('/(tabs)'), 100);
    return (
      <View className="flex-1 justify-center items-center bg-blue-50">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-3 text-base text-slate-500">Redirecting...</Text>
      </View>
    );
  }

  const getStepTitle = () => {
    switch (currentStep) {
      case 'otp': return 'Enter OTP';
      case 'secret': return 'Enter Secret Key';
      default: return 'Fresh dairy delivered daily';
    }
  };

  const getStepSubtitle = () => {
    switch (currentStep) {
      case 'secret': return 'SuperAdmin verification required';
      case 'otp': return `Sent to +91 ${mobile}`;
      default: return 'Sign in with your mobile number';
    }
  };

  return (
    <View className="flex-1 bg-blue-50">
      <StatusBar barStyle="light-content" />
      
      {/* Header with Back Button */}
      {(currentStep === 'otp' || currentStep === 'secret') && (
        <View className="absolute top-10 left-0 right-0 flex-row items-center justify-between px-4 py-3 z-50">
          <TouchableOpacity 
            className="w-10 h-10 rounded-full bg-white/90 items-center justify-center shadow-sm"
            onPress={handleBack}
            disabled={loading}
          >
            <Text className="text-xl font-bold text-blue-500">←</Text>
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-white shadow-sm">
            {currentStep === 'secret' ? 'Enter Secret Key' : 'Enter OTP'}
          </Text>
          <View className="w-10" />
        </View>
      )}

      {/* Background Image */}
      <View className="absolute top-0 w-full h-1/2">
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=800&q=80' }}
          className="w-full h-full"
          resizeMode="cover"
        />
      </View>

      <KeyboardAwareScrollView
  contentContainerClassName="flex-grow justify-end"
  enableOnAndroid
  keyboardShouldPersistTaps="handled"
  showsVerticalScrollIndicator={false}
  extraScrollHeight={100}
>
        <View className="h-1/3" />

        {/* White Card - Image ke niche */}
  <View className="bg-white rounded-t-3xl px-6 py-14 items-center shadow-lg">
          {/* Logo */}
          {currentStep === 'mobile' && (
            <View className="mb-3">
              <Text className="text-2xl font-bold text-slate-900">Dairy Nine</Text>
            </View>
          )}

          <Text className="text-xl font-bold text-slate-900 text-center mb-2">{getStepTitle()}</Text>
          <Text className="text-sm text-slate-500 text-center mb-5">{getStepSubtitle()}</Text>

          {/* Step 1: Mobile Input */}
          {currentStep === 'mobile' && (
            <View className="flex-row items-center border-2 border-slate-300 rounded-xl bg-slate-50 w-full mb-3">
              <View className="flex-row items-center px-3 py-3.5 border-r-2 border-slate-200">
                <Text className="text-lg mr-1.5">🇮🇳</Text>
                <Text className="text-sm font-semibold text-slate-800">+91</Text>
              </View>
              <TextInput
                className="flex-1 text-sm text-slate-800 px-3 py-3.5 font-medium"
                placeholder="Enter mobile number"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                maxLength={10}
                value={mobile}
                onChangeText={setMobile}
                editable={!sendingOtp}
              />
            </View>
          )}

// Step 2: OTP Input - FIXED with margin top
{currentStep === 'otp' && (
  <View className="w-full mb-3 mt-4"> {/* mt-4 add kiya */}
    <View className="flex-row justify-between w-full px-2 mb-4">
      {otp.map((digit, index) => (
        <TextInput
          key={index}
          ref={(ref) => (otpRefs.current[index] = ref)}
          className={`w-12 h-13 border-2 rounded-lg text-xl font-bold bg-white text-black text-center ${digit ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}
          keyboardType="numeric"
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
      className="items-center mb-3"
      onPress={handleResendOTP}
      disabled={sendingOtp}
    >
      {sendingOtp ? (
        <ActivityIndicator color="#3b82f6" size="small" />
      ) : (
        <Text className="text-sm text-slate-500">
          Didn't receive OTP?{' '}
          <Text className="text-blue-500 font-semibold">Resend</Text>
        </Text>
      )}
    </TouchableOpacity>
  </View>
)}

          {/* Step 3: Secret Input */}
          {currentStep === 'secret' && (
            <View className="w-full mb-3">
              <Text className="text-sm text-amber-500 text-center italic mb-2">
                SuperAdmin access requires additional verification
              </Text>
              
              <View className="flex-row justify-between w-full px-2 mb-4">
                {secret.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (secretRefs.current[index] = ref)}
                    className={`w-11 h-11 border-2 rounded-lg text-xl font-bold bg-white text-slate-900 text-center shadow-sm border-green-500 bg-green-50 ${digit ? 'border-blue-500 bg-blue-50 shadow-blue-500/20' : 'border-slate-200'}`}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={digit}
                    onChangeText={(text) => handleSecretChange(text, index)}
                    onKeyPress={(e) => handleSecretKeyPress(e, index)}
                    textAlign="center"
                    editable={!loading}
                    selectTextOnFocus
                    secureTextEntry
                  />
                ))}
              </View>
              
              <Text className="text-xs text-green-600 text-center italic mb-2">
                Enter your 6-digit secret key
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          {currentStep === 'mobile' && (
            <>
              <TouchableOpacity
                className={`w-full rounded-xl py-3.5 items-center mb-3 shadow-lg ${(sendingOtp || !mobile) ? 'bg-gray-400' : 'bg-blue-500 shadow-blue-500/30'}`}
                onPress={handleSendOTP}
                disabled={sendingOtp || !mobile}
              >
                {sendingOtp ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-base font-bold">Send OTP</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/Signup')}>
                <Text className="text-sm text-slate-500 mb-3">
                  New user? <Text className="text-blue-500 font-semibold">Create Account</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}

          {currentStep === 'otp' && (
            <>
              <TouchableOpacity
                className={`w-full rounded-xl py-3.5 items-center mb-3 shadow-lg ${(loading || otp.join('').length !== 6) ? 'bg-gray-400' : 'bg-blue-500 shadow-blue-500/30'}`}
                onPress={handleManualVerifyOTP}
                disabled={loading || otp.join('').length !== 6}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-base font-bold">Verify & Sign In</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push('/Signup')} disabled={loading}>
                <Text className="text-sm text-slate-500 mb-3">
                  New user? <Text className="text-blue-500 font-semibold">Create Account</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}

          {currentStep === 'secret' && (
            <TouchableOpacity
              className={`w-full rounded-xl py-3.5 items-center mb-3 shadow-lg ${(loading || secret.join('').length !== 6) ? 'bg-gray-400' : 'bg-blue-500 shadow-blue-500/30'}`}
              onPress={handleManualVerifySecret}
              disabled={loading || secret.join('').length !== 6}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-base font-bold">Verify Secret Key</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Footer */}
          <Text className="text-xs text-slate-400 text-center leading-3.5 px-4">
            By continuing, you agree to our Terms & Privacy Policy
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}