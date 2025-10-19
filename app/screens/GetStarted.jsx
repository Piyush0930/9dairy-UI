import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
const router = useRouter();


const DairyOScreen = () => {
  const [currentProductIndex, setCurrentProductIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Array of dairy products - replace with your actual product images
  const dairyProducts = [
    { id: 1, name: 'Fresh Milk', image: require('../../assets/images/milk.png') },
    { id: 2, name: 'Butter', image: require('../../assets/images/butter.png') },
    { id: 3, name: 'Cheese', image: require('../../assets/images/Cheese.png') },
    { id: 4, name: 'Yogurt', image: require('../../assets/images/Yogurt.png') },
    { id: 5, name: 'Paneer', image: require('../../assets/images/Paneer.png') },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out animation
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        // Change product
        setCurrentProductIndex((prevIndex) => 
          (prevIndex + 1) % dairyProducts.length
        );
        
        // Fade in animation
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
    }, 1000); // Change every 1 second

    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/logo.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        
        {/* Main Heading */}
        {/* <Text style={styles.heading}>Taste of Awesomenss</Text> */}
        
        {/* Subheading */}
        <Text style={styles.subheading}>Fresh dairy products delivered to your door</Text>
        
        {/* Animated Product Showcase */}
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
        
        {/* Get Started Button */}
    
      <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/screens/Login')} // ✅ route path
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
    backgroundColor: '#ffffffff',
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
    top: 0,
  },
  heading: {
    fontSize: 30,
    fontWeight: '700',
    color: '#1E3A5F',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
    top: -50,
  },
  subheading: {
    fontSize: 15,
    color: '#5A6B7D',
    textAlign: 'center',
    marginBottom: 30,
    fontWeight: '400',
    top: -90,
  },
  productContainer: {
    height: 180,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    top: -50,
  },
  productWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    top: -20,
    width: 140,
    height: 140,
    marginBottom: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E3A5F',
    textAlign: 'center',
    top: -30,
  },
  button: {
    top: -30,
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
    color: '#ffffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1.5,
    // top:30,
  },
});

export default DairyOScreen;