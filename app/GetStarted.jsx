import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
const router = useRouter();

const DairyOScreen = () => {
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const dairyProducts = [
    { id: 1, name: 'Fresh Milk', image: require('../assets/images/milk.png') },
    { id: 2, name: 'Butter', image: require('../assets/images/butter.png') },
    { id: 3, name: 'Cheese', image: require('../assets/images/Cheese.png') },
    { id: 4, name: 'Yogurt', image: require('../assets/images/Yogurt.png') },
    { id: 5, name: 'Paneer', image: require('../assets/images/Paneer.png') },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setCurrentProductIndex((prevIndex) => (prevIndex + 1) % dairyProducts.length);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../assets/images/logo.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.subheading}>
          Fresh dairy products delivered to your door
        </Text>

        <View style={styles.productContainer}>
          <Animated.View style={[styles.productWrapper, { opacity: fadeAnim }]}>
            <Image
              source={dairyProducts[currentProductIndex].image}
              style={styles.productImage}
              resizeMode="contain"
            />
            <Text style={styles.productName}>
              {dairyProducts[currentProductIndex].name}
            </Text>
          </Animated.View>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('Login')}
        >
          <Text style={styles.buttonText}>Get Started</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    marginBottom: 40,
    alignItems: 'center',
  },
  logo: {
    width: 300,
    height: 290,
  },
  subheading: {
    top: -100,
    fontSize: 15,
    color: '#5A6B7D',
    textAlign: 'center',
    marginBottom: 30,
  },
  productContainer: {
    top: -80,
    height: 180,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  productWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    width: 140,
    height: 140,
    marginBottom: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E3A5F',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#004494',
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 35,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});

export default DairyOScreen;