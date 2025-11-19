// app/(tabs)/supadmin/_layout.jsx
import { useAuth } from "@/contexts/AuthContext";
import {
  Feather,
  FontAwesome5,
  Ionicons,
  MaterialIcons,
} from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSegments } from "expo-router";

export default function SupadminLayout() {
  const { logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // 🔥 Detect active tab from URL segments
  const segments = useSegments();
  const current = segments[segments.length - 1]; // "dashboard", "retailers", "system", etc.
  console.log("CURRENT TAB ==>", current);

  const handleLogout = () => {
    Alert.alert(
      "SuperAdmin Logout",
      "Are you sure you want to logout from SuperAdmin panel?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await logout();
              router.replace("/Login");
            } catch {
              Alert.alert("Error", "Failed to logout.");
            }
          },
        },
      ]
    );
  };

  return (
    <Tabs
      screenOptions={{
        // 🔷 HEADER STYLE
        headerStyle: {
          backgroundColor: "#FFFFFF",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 5,
        },
        headerTintColor: "#000000",
        headerTitleStyle: {
          fontWeight: "bold",
          fontSize: 18,
        },

        // 🔥 Conditional headerRight (NO route.name!)
        headerRight: () => (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginRight: 15,
              gap: 16,
            }}
          >
            {/* SUPER ADMIN BADGE */}
            <View
              style={{
                backgroundColor: "#FF6B35",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <MaterialIcons
                name="admin-panel-settings"
                size={16}
                color="#FFFFFF"
              />
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                SUPER ADMIN
              </Text>
            </View>

            {/* 🔥 LOGOUT BUTTON ONLY ON SYSTEM TAB */}
            {current === "system" && (
              <TouchableOpacity
                onPress={handleLogout}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: "#F8F9FA",
                  borderWidth: 1,
                  borderColor: "#E9ECEF",
                }}
              >
                <MaterialIcons name="logout" size={20} color="#DC3545" />
              </TouchableOpacity>
            )}
          </View>
        ),

        // 🔷 TAB BAR STYLING
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopWidth: 1,
          borderTopColor: "#E0E0E0",
          height: 60 + (insets.bottom || 0),
          paddingBottom: 5 + (insets.bottom || 0),
          paddingTop: 5,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarActiveTintColor: "#2196F3",
        tabBarInactiveTintColor: "#9E9E9E",
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginTop: 2,
          letterSpacing: 0.3,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}
    >
      {/* DASHBOARD TAB */}
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                padding: 4,
                borderRadius: 8,
                backgroundColor: focused
                  ? "rgba(33, 150, 243, 0.1)"
                  : "transparent",
              }}
            >
              <MaterialIcons
                name="dashboard"
                size={focused ? 26 : 24}
                color={color}
              />
            </View>
          ),
          headerTitle: "SuperAdmin",
        }}
      />

      {/* RETAILERS TAB */}
      <Tabs.Screen
        name="retailers"
        options={{
          title: "Retailers",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                padding: 4,
                borderRadius: 8,
                backgroundColor: focused
                  ? "rgba(33, 150, 243, 0.1)"
                  : "transparent",
              }}
            >
              <FontAwesome5 name="store" size={focused ? 20 : 18} color={color} />
            </View>
          ),
          headerTitle: "Manage Retailers",
        }}
      />

      {/* CUSTOMERS TAB */}
      <Tabs.Screen
        name="customers"
        options={{
          title: "Customers",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                padding: 4,
                borderRadius: 8,
                backgroundColor: focused
                  ? "rgba(33, 150, 243, 0.1)"
                  : "transparent",
              }}
            >
              <MaterialIcons
                name="people-alt"
                size={focused ? 26 : 24}
                color={color}
              />
            </View>
          ),
          headerTitle: "Customer Management",
        }}
      />

      {/* ORDERS TAB */}
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                padding: 4,
                borderRadius: 8,
                backgroundColor: focused
                  ? "rgba(33, 150, 243, 0.1)"
                  : "transparent",
              }}
            >
              <Feather
                name="shopping-bag"
                size={focused ? 22 : 20}
                color={color}
              />
            </View>
          ),
          headerTitle: "All Orders",
        }}
      />

      {/* ANALYTICS TAB */}
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                padding: 4,
                borderRadius: 8,
                backgroundColor: focused
                  ? "rgba(33, 150, 243, 0.1)"
                  : "transparent",
              }}
            >
              <MaterialIcons
                name="bar-chart"
                size={focused ? 26 : 24}
                color={color}
              />
            </View>
          ),
          headerTitle: "Product Catlog",
        }}
      />

      {/* SYSTEM TAB */}
      <Tabs.Screen
        name="system"
        options={{
          title: "System",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                padding: 4,
                borderRadius: 8,
                backgroundColor: focused
                  ? "rgba(33, 150, 243, 0.1)"
                  : "transparent",
              }}
            >
              <Ionicons
                name="settings-sharp"
                size={focused ? 24 : 22}
                color={color}
              />
            </View>
          ),
          headerTitle: "System Settings",
        }}
      />

      {/* HIDDEN SCREENS */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="retailer-details" options={{ href: null }} />
      <Tabs.Screen name="customer-details" options={{ href: null }} />
      <Tabs.Screen name="order-details" options={{ href: null }} />
    </Tabs>
  );
}
