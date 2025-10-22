import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
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

export default function Signup() {
  const [userType, setUserType] = useState('Customer'); // 'Customer' or 'Retailer'
  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [contactNo, setContactNo] = useState('');
  const [shopName, setShopName] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [otpShown, setOtpShown] = useState(false);
  const router = useRouter();
  const otpRefs = useRef([]);

  const handleGetOtp = () => {
    if (!fullName || !address || !contactNo || contactNo.length !== 10) {
      alert('Please fill all required fields with valid contact number');
      return;
    }
    if (userType === 'Retailer' && !shopName) {
      alert('Please fill shop details');
      return;
    }
    // Simulate OTP generation
    setOtpShown(true);
    alert('OTP sent to your mobile number');
  };

  const handleOtpChange = (text, index) => {
    if (/^\d*$/.test(text)) {
      const newOtp = [...otp];
      newOtp[index] = text;
      setOtp(newOtp);
      if (text && index < otp.length - 1) {
        otpRefs.current[index + 1]?.focus();
      }
      if (!text && index > 0) {
        otpRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleVerify = () => {
    const otpCode = otp.join('');
    if (otpCode.length !== 4) {
      alert('Enter valid 4-digit OTP');
      return;
    }
    // For testing: Always navigate to dashboard after OTP entry
    if (userType === 'Customer') {
      router.push('/(tabs)');
    } else {
      router.push('/(admin)');
    }
  };

  const handleSigninLink = () => {
    router.push('/Login');
  };

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      enableOnAndroid={true}
      keyboardShouldPersistTaps="handled"
      extraScrollHeight={20}
      keyboardOpeningTime={200}
      enableAutomaticScroll={true}
      showsVerticalScrollIndicator={false}
      resetScrollToCoords={{ x: 0, y: 0 }}
      scrollEnabled={true}
    >
      <View>
        <StatusBar barStyle="dark-content" />

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
            style={[styles.toggleButton, userType === 'Customer' && styles.toggleButtonActive]}
            onPress={() => {
              setUserType('Customer');
              setFullName('');
              setAddress('');
              setContactNo('');
              setShopName('');
              setOtp(['', '', '', '']);
              setOtpShown(false);
            }}
          >
            <Text style={[styles.toggleText, userType === 'Customer' && styles.toggleTextActive]}>
              Customer
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, userType === 'Retailer' && styles.toggleButtonActive]}
            onPress={() => {
              setUserType('Retailer');
              setFullName('');
              setAddress('');
              setContactNo('');
              setShopName('');
              setOtp(['', '', '', '']);
              setOtpShown(false);
            }}
          >
            <Text style={[styles.toggleText, userType === 'Retailer' && styles.toggleTextActive]}>
              Retailer
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form Fields */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#94a3b8"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Address"
              placeholderTextColor="#94a3b8"
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={2}
            />
          </View>

          <View style={styles.inputContainer}>
            <View style={styles.flagContainer}>
              <Text style={styles.flag}>🇮🇳</Text>
              <Text style={styles.countryCode}>+91</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Contact Number"
              placeholderTextColor="#94a3b8"
              keyboardType="phone-pad"
              maxLength={10}
              value={contactNo}
              onChangeText={setContactNo}
            />
          </View>

          {userType === 'Retailer' && (
            <>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Shop Name"
                  placeholderTextColor="#94a3b8"
                  value={shopName}
                  onChangeText={setShopName}
                />
              </View>


            </>
          )}

          {!otpShown ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleGetOtp}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Get OTP</Text>
            </TouchableOpacity>
          ) : (
            <>
              {/* OTP Section */}
              <Text style={styles.otpTitle}>Enter 4-digit OTP</Text>
              <View style={styles.otpContainer}>
                {otp.map((value, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => (otpRefs.current[index] = ref)}
                    style={[styles.otpInput, value ? styles.otpInputActive : null]}
                    keyboardType="number-pad"
                    maxLength={1}
                    value={value}
                    onChangeText={(text) => handleOtpChange(text, index)}
                    textAlign="center"
                  />
                ))}
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleVerify}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>Verify & Sign Up</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Signin Link */}
          <TouchableOpacity onPress={handleSigninLink} style={styles.linkContainer}>
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
    paddingLeft: 12,
    paddingVertical: 8,
    fontWeight: '500',
    textAlignVertical: 'top',
  },
  otpTitle: {
    fontSize: 18,
    color: '#0f172a',
    marginBottom: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  otpInput: {
    width: 60,
    height: 60,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    fontSize: 24,
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
    marginBottom: 24,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  linkContainer: {
    alignItems: 'center',
    marginBottom: 24,
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
