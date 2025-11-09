// app/(admin)/_layout.jsx
import { useAuth } from "@/contexts/AuthContext";
import { useScanner } from "@/contexts/ScannerContext";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { Alert, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminLayout() {
  const { logout } = useAuth();
  const { openScanner } = useScanner();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
              router.replace("/GetStarted");
            } catch {
              Alert.alert("Error", "Failed to logout.");
            }
          },
        },
      ]
    );
  };

  // open scanner on the Orders screen
 const handleOpenScanner = () => {
  openScanner();
};

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#FFFFFF" },
        headerTintColor: "#000000",
        headerTitleStyle: { fontWeight: "bold" },
        headerRight: () => (
          <View style={{ flexDirection: "row", alignItems: "center", marginRight: 15 }}>
            {/* Scanner */}
            <TouchableOpacity onPress={handleOpenScanner} style={{ marginRight: 16 }}>
              <Ionicons name="qr-code" size={24} color="#000" />
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity onPress={handleLogout}>
              <MaterialIcons name="logout" size={24} color="#000" />
            </TouchableOpacity>
          </View>
        ),
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E0E0E0",
          height: 60 + insets.bottom,
          paddingBottom: 5 + insets.bottom,
          paddingTop: 5,
        },
        tabBarActiveTintColor: "#2196F3",
        tabBarInactiveTintColor: "#9E9E9E",
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size }) => <MaterialIcons name="list-alt" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: "Products",
          tabBarIcon: ({ color, size }) => <MaterialIcons name="inventory" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: "Categories",
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <MaterialIcons name="person" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="offline-order" options={{ href: null }} />
    </Tabs>
  );
}
