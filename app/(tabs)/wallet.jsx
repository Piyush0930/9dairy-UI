import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

export default function WalletScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <View className="px-4 py-4 border-b border-gray-200 bg-white">
        <Text className="text-2xl font-bold text-gray-900">Dairy Nine Wallet</Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-blue-500 rounded-2xl p-8 items-center mb-6 shadow-lg shadow-black/15">
          <View className="w-18 h-18 rounded-full bg-white/20 justify-center items-center mb-4">
            <Ionicons name="wallet-outline" size={32} color="#FFFFFF" />
          </View>
          <Text className="text-sm text-white/80 mb-2 font-medium">Current Balance</Text>
          <Text className="text-5xl font-bold text-white mb-6">₹300</Text>
          <View className="flex-row gap-3 w-full">
            <TouchableOpacity className="flex-1 bg-white py-3 rounded-xl items-center">
              <Text className="text-blue-500 text-base font-bold">Add Money</Text>
            </TouchableOpacity>
            <TouchableOpacity className="flex-1 bg-white/20 border border-white py-3 rounded-xl items-center">
              <Text className="text-white text-base font-bold">Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="bg-white rounded-xl p-8 items-center mb-6 border-2 border-blue-100 border-dashed">
          <View className="mb-4">
            <MaterialIcons name="trending-up" size={48} color="#4FC3F7" />
          </View>
          <Text className="text-2xl font-bold text-gray-900 mb-3">Coming Soon</Text>
          <Text className="text-sm text-gray-600 text-center leading-5">
            Complete wallet functionality with transactions, offers, and rewards will be available soon.
          </Text>
        </View>

        <View className="mb-6">
          <Text className="text-lg font-bold text-gray-900 mb-4">Upcoming Features</Text>
          
          <View className="flex-row items-center bg-white p-4 rounded-xl mb-3 border border-gray-200">
            <View className="w-12 h-12 rounded-xl bg-gray-100 justify-center items-center mr-3">
              <MaterialIcons name="history" size={24} color={Colors.light.tint} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900 mb-1">Transaction History</Text>
              <Text className="text-sm text-gray-600">
                Track all your wallet transactions
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#BDBDBD" />
          </View>

          <View className="flex-row items-center bg-white p-4 rounded-xl mb-3 border border-gray-200">
            <View className="w-12 h-12 rounded-xl bg-gray-100 justify-center items-center mr-3">
              <Text className="text-2xl">🎁</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900 mb-1">Cashback & Offers</Text>
              <Text className="text-sm text-gray-600">
                Earn rewards on every purchase
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#BDBDBD" />
          </View>

          <View className="flex-row items-center bg-white p-4 rounded-xl mb-3 border border-gray-200">
            <View className="w-12 h-12 rounded-xl bg-gray-100 justify-center items-center mr-3">
              <Text className="text-2xl">🔒</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900 mb-1">Secure Payments</Text>
              <Text className="text-sm text-gray-600">
                Bank-grade security for your money
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#BDBDBD" />
          </View>
        </View>

        <View className="h-15" />
      </ScrollView>
    </View>
  );
}