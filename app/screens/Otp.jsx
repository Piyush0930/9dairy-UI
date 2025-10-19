import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const { width, height } = Dimensions.get('window');

export default function Otp() {
  const router = useRouter();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(26); // 00:26 countdown
  const [resendEnabled, setResendEnabled] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [whatsappChecked, setWhatsappChecked] = useState(false);

  useEffect(() => {
    let interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setResendEnabled(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOtpChange = (text, index) => {
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Move focus to next input
    if (text && index < 5) {
      refs[index + 1].current.focus();
    }
  };

  const refs = otp.map(() => useState(null)[1]);

  const handleVerify = () => {
    if (otp.join('').length === 6) {
      router.push('screens/Success'); // Replace with your success page
    } else {
      alert('Please enter a valid 6-digit OTP');
    }
  };

  const handleResend = () => {
    if (resendEnabled) {
      setTimer(26);
      setResendEnabled(false);
      // Add resend logic here
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
        extraScrollHeight={80} // Precise positioning above keyboard
        keyboardOpeningTime={200} // Smooth animation duration
        enableAutomaticScroll={true}
        showsVerticalScrollIndicator={false}
        resetScrollToCoords={{ x: 0, y: 0 }}
        scrollEnabled={true}
        getTextInputRefs={() => refs} // Track OTP input fields for scrolling
      >
        <View style={styles.spacer} />
        <View style={styles.bottomCard}>
          {/* Back Arrow */}
          <TouchableWithoutFeedback onPress={() => router.back()}>
            <Text style={styles.backArrow}>&lt;</Text>
          </TouchableWithoutFeedback>

          {/* Title */}
          <Text style={styles.title}>Enter verification code</Text>

          {/* OTP Message */}
          <Text style={styles.subtitle}>
            6 digit OTP has been sent to 7666325259
          </Text>

          {/* OTP Input Boxes */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={refs[index]}
                style={styles.otpInput}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                keyboardType="numeric"
                maxLength={1}
                textAlign="center"
              />
            ))}
          </View>

          {/* Timer and Resend */}
          <View style={styles.timerContainer}>
            <Text style={styles.timer}>
              {`00:${timer < 10 ? `0${timer}` : timer}`}
            </Text>
            <TouchableOpacity
              onPress={handleResend}
              disabled={!resendEnabled}
              style={styles.resend}
            >
              <Text style={[styles.resendText, resendEnabled && styles.resendTextEnabled]}>
                Resend now
              </Text>
            </TouchableOpacity>
          </View>

          {/* Checkboxes */}
          <View style={styles.checkboxContainer}>
            <TouchableWithoutFeedback onPress={() => setTermsChecked(!termsChecked)}>
              <View style={styles.checkbox}>
                {termsChecked && <View style={styles.checkboxCheck} />}
              </View>
            </TouchableWithoutFeedback>
            <Text style={styles.checkboxLabel}>
              I agree to Hyperpure terms & conditions
            </Text>
          </View>
          <View style={styles.checkboxContainer}>
            <TouchableWithoutFeedback onPress={() => setWhatsappChecked(!whatsappChecked)}>
              <View style={styles.checkbox}>
                {whatsappChecked && <View style={styles.checkboxCheck} />}
              </View>
            </TouchableWithoutFeedback>
            <Text style={styles.checkboxLabel}>
              Send me offers and updates on WhatsApp
            </Text>
          </View>

          {/* Verify Button */}
          <TouchableOpacity style={styles.verifyButton} onPress={handleVerify}>
            <Text style={styles.verifyText}>Verify</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f9ff', // Consistent with login page
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
    justifyContent: 'flex-end', // Anchor card at bottom
  },
  spacer: {
    height: height * 0.48, // Slight overlap for rounded corners
  },
  bottomCard: {
    backgroundColor: '#ffffff', // Consistent with login page
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
    minHeight: height * 0.52, // Ensures card extends to bottom
  },
  backArrow: {
    fontSize: 20,
    color: '#1e293b',
    alignSelf: 'flex-start',
    marginBottom: 16,
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
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '60%',
    marginBottom: 20,
  },
  otpInput: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 18,
  },
  timerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '60%',
    marginBottom: 20,
  },
  timer: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '600',
  },
  resend: {
    opacity: 0.5,
  },
  resendText: {
    fontSize: 14,
    color: '#64748b',
  },
  resendTextEnabled: {
    color: '#3b82f6',
    opacity: 1,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: '#ef4444', // Red border consistent with image
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxCheck: {
    width: 10,
    height: 10,
    backgroundColor: '#ef4444', // Red checkmark
  },
  checkboxLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  verifyButton: {
    backgroundColor: '#3b82f6', // Consistent with login page
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
    marginTop: 12,
  },
  verifyText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});