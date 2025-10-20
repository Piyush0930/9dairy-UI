import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Animated,
  Image,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Hide default header/navigation bar
export const options = {
  headerShown: false,
};

export default function BasicInfoScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [location, setLocation] = useState('');
  const [fadeAnim] = useState(new Animated.Value(0)); // Animation for fade-in effect

  // Fade-in animation on component mount
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const handleSubmit = () => {
    if (!name || !email || !location) {
      return alert('Please fill all fields');
    }
    router.push('/(tabs)'); // Navigate to Customer Dashboard
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'dark-content'}
        backgroundColor="#ffffff"
      />

      {/* Logo with subtle animation */}
      <Animated.View style={[styles.logoContainer, { opacity: fadeAnim }]}>
        <Image
          source={require('../assets/images/icon.png')} // Local Dairy Nine logo
          style={styles.logo}
        />
      </Animated.View>

      <Animated.Text style={[styles.brand, { opacity: fadeAnim }]}>
        Dairy Nine
      </Animated.Text>
      <Animated.Text style={[styles.title, { opacity: fadeAnim }]}>
        Your Profile
      </Animated.Text>
      <Animated.Text style={[styles.subtitle, { opacity: fadeAnim }]}>
        Enter your details to personalize your experience
      </Animated.Text>

      {/* Name Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor="#a1b4d1"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      </View>

      {/* Email Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Email Address"
          placeholderTextColor="#a1b4d1"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
        />
      </View>

      {/* Location Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Location"
          placeholderTextColor="#a1b4d1"
          value={location}
          onChangeText={setLocation}
        />
      </View>

      {/* Submit Button with hover-like effect */}
      <TouchableOpacity
        style={styles.submitButton}
        onPress={handleSubmit}
        activeOpacity={0.7}
      >
        <Text style={styles.submitText}>Continue</Text>
      </TouchableOpacity>

      <Text style={styles.footerText}>
        Your data is secure with our{' '}
        <Text style={styles.linkText}>Privacy Policy</Text>
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffffff', // soft bluish-white background for depth
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  logo: {
    width: 180,
    height: 130,
    borderRadius: 20,
  },
  brand: {
    top: -15,
    fontSize: 36,
    fontWeight: '800',
    color: '#1e3a8a', // deep royal blue
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 1.3,
  },
  title: {
    top: -25,
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    top: -25,
    fontSize: 15,
    color: '#475569', // soft slate grey
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },

  // 🔹 Refined Input Design
  inputContainer: {
    top: -40,
    width: '100%',
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#c7dfff', // cleaner blue border
    shadowColor: '#60a5fa',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },

  input: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 16,
    fontSize: 16,
    color: '#1e3a8a',
    borderRadius: 16,
    letterSpacing: 0.5,
  },

  // 🔹 Gradient-like modern button
  submitButton: {
    top: -25,
    backgroundColor: '#3b82f6', // bright modern blue
    paddingVertical: 16,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  submitText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 18,
    letterSpacing: 0.5,
  },

  footerText: {
    top: -20,
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
  },
  linkText: {
    color: '#2563eb', // bright blue
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});