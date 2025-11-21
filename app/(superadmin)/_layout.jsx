// C:\Users\Krishna\OneDrive\Desktop\dairy9-frontend\9dairy-UI\app\(superadmin)\_layout.jsx
import { Feather, FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SupadminLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        // REMOVE HEADER COMPLETELY
        headerShown: false,
        
        // TAB BAR STYLING - Enhanced and Consistent
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
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{
              padding: 4,
              borderRadius: 8,
              backgroundColor: focused ? 'rgba(33, 150, 243, 0.1)' : 'transparent'
            }}>
              <MaterialIcons name="dashboard" size={focused ? 26 : 24} color={color} />
            </View>
          ),
        }}
      />

      {/* RETAILERS TAB */}
      <Tabs.Screen
        name="retailers"
        options={{
          title: "Retailers",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{
              padding: 4,
              borderRadius: 8,
              backgroundColor: focused ? 'rgba(33, 150, 243, 0.1)' : 'transparent'
            }}>
              <FontAwesome5 name="store" size={focused ? 20 : 18} color={color} />
            </View>
          ),
        }}
      />

      {/* ORDERS TAB */}
      <Tabs.Screen
        name="orders"
        options={{
          title: "Orders",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{
              padding: 4,
              borderRadius: 8,
              backgroundColor: focused ? 'rgba(33, 150, 243, 0.1)' : 'transparent'
            }}>
              <Feather name="shopping-bag" size={focused ? 22 : 20} color={color} />
            </View>
          ),
        }}
      />

      {/* PRODUCT TAB */}
      <Tabs.Screen
        name="product"
        options={{
          title: "Product",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{
              padding: 4,
              borderRadius: 8,
              backgroundColor: focused ? 'rgba(33, 150, 243, 0.1)' : 'transparent'
            }}>
              <MaterialIcons name="inventory" size={focused ? 26 : 24} color={color} />
            </View>
          ),
        }}
      />

      {/* PROFILE TAB */}
      <Tabs.Screen
        name="system"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{
              padding: 4,
              borderRadius: 8,
              backgroundColor: focused ? 'rgba(33, 150, 243, 0.1)' : 'transparent'
            }}>
              <MaterialIcons name="person" size={focused ? 24 : 22} color={color} />
            </View>
          ),
        }}
      />

      {/* INDEX (REDIRECT) - HIDDEN */}
      <Tabs.Screen 
        name="index" 
        options={{ 
          href: null 
        }} 
      />
    </Tabs>
  );
}