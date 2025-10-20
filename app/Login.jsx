import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
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

export default function Login() {
  const [mobile, setMobile] = useState('');
  const router = useRouter();

  const handleContinue = () => {
    if (mobile.length !== 10) return alert('Enter valid mobile number');
    router.push('/Otp');
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
        extraScrollHeight={80} // Precise positioning above keyboard
        keyboardOpeningTime={200} // Smooth animation duration
        enableAutomaticScroll={true}
        showsVerticalScrollIndicator={false}
        resetScrollToCoords={{ x: 0, y: 0 }}
        scrollEnabled={true}
        getTextInputRefs={() => [mobile]} // Track input field for scrolling
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
            />
          </View>

          {/* Continue Button */}
          <TouchableOpacity 
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Continue</Text>
          </TouchableOpacity>

          {/* Footer Text */}
          <Text style={styles.footerText}>
            By continuing, you agree to our Terms & Privacy Policy
          </Text>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff', // Fallback background
  },
  imageContainer: {
    width: '100%',
    height: height * 0.5, // Image covers top half
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
    justifyContent: 'flex-end', // Anchor card at bottom when keyboard is not active
  },
  spacer: {
    height: height * 0.48, // Slightly less than image height for overlap
  },
  bottomCard: {
    backgroundColor: '#ffffff', // Solid white for contrast
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
    minHeight: height * 0.52, // Slightly more to compensate for overlap
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
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  footerText: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 14,
    paddingHorizontal: 16,
  },
});