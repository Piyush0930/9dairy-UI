import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  SafeAreaView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const DairyOScreen = () => {
  const router = useRouter();
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
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />

      <View className="flex-1 items-center justify-center px-5">
        <View className="mb-15 items-up-center -mt-28">
          <Image
            source={require('../assets/images/logo.jpeg')}
            className="w-49 h-48"
            resizeMode="contain"
          />
        </View>

        <Text className="text-sm text-gray-500 text-center mb-9 -mt-22">
          Fresh dairy products delivered to your door
        </Text>

        <View className="h-40 w-full items-center justify-center mb-9 -mt-10 ">
          <Animated.View className="items-center justify-center mt-28" style={{ opacity: fadeAnim }}>
  <Image
    source={dairyProducts[currentProductIndex].image}
    className="w-29 h-24 mb-1"
    resizeMode="contain"
  />
  <Text className="text-base font-semibold text-blue-900 text-center">
    {dairyProducts[currentProductIndex].name}
  </Text>
</Animated.View>
        </View>

        <TouchableOpacity
          className="bg-blue-700 py-4 px-12 rounded-3xl shadow-lg shadow-black/30 mt-32"
          onPress={() => router.push('Login')}
        >
          <Text className="text-white text-lg font-bold tracking-wide">
            Get Started
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default DairyOScreen;