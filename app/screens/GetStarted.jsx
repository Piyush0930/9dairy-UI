import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function GetStarted() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to Dairy App</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('screens/Login')}
      >
        <Text style={styles.buttonText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, marginBottom: 20 },
  button: { backgroundColor: '#4CAF50', padding: 12, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
Radius: 4.65,
  },
  buttonText: {
    color: '#ffffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
    // top:30,
  },
});

export default DairyOScreen;