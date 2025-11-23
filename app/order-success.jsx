import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';

export default function OrderSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleContinueShopping = () => {
    router.push('/(tabs)');
  };

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <View className="flex-1 justify-center items-center px-8">
        <View className="mb-6">
          <Ionicons name="checkmark-circle" size={80} color={Colors.light.success} />
        </View>
        <Text className="text-2xl font-bold text-gray-900 text-center mb-3">
          Order Placed Successfully!
        </Text>
        <Text className="text-base text-gray-600 text-center mb-4">
          Your fresh dairy products will be delivered to you soon.
        </Text>
        <Text className="text-sm text-gray-500 text-center leading-5">
          You will receive a confirmation message with tracking details shortly.
        </Text>
      </View>
      <View className="p-4 border-t border-gray-300 bg-white">
        <TouchableOpacity className="bg-blue-500 py-4 rounded-xl items-center" onPress={handleContinueShopping}>
          <Text className="text-white text-base font-bold">
            Continue Shopping
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}