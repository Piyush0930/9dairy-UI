import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { TouchableOpacity } from "react-native";

export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: "#FFFFFF",
        },
        headerTintColor: "#000000",
        headerTitleStyle: {
          fontWeight: "bold",
        },
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginLeft: 16 }}
          >
            <Ionicons name="arrow-back" size={24} color="#000000" />
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Admin Dashboard",
        }}
      />
      <Stack.Screen
        name="invoice-summary"
        options={{
          title: "Invoice Summary",
        }}
      />
      <Stack.Screen
        name="orders"
        options={{
          title: "Admin Orders",
        }}
      />
      <Stack.Screen
        name="categories"
        options={{
          title: "Categories Management",
        }}
      />
      <Stack.Screen
        name="products"
        options={{
          title: "Products Management",
        }}
      />
    </Stack>
  );
}
