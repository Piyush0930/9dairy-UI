// C:\Users\Krishna\OneDrive\Desktop\dairy9-frontend\9dairy-UI\app\(superadmin)\_layout.jsx
import { Feather, FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SupadminLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        // HEADER STYLING - Consistent with Admin
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
        headerRight: () => (
          <View style={{ flexDirection: "row", alignItems: "center", marginRight: 15 }}>
            {/* SuperAdmin Badge - Enhanced */}
            <View style={{
              backgroundColor: "#FF6B35",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}>
              <MaterialIcons name="admin-panel-settings" size={16} color="#FFFFFF" />
              <Text style={{
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: '700',
                letterSpacing: 0.5,
              }}>
                SUPER ADMIN
              </Text>
            </View>
          </View>
        ),
        
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
      {/* ✅ ONLY SCREENS THAT ACTUALLY EXIST - NO HIDDEN/EXTRA SCREENS */}

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
          headerTitle: "SuperAdmin Dashboard",
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
          headerTitle: "Manage Retailers",
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
          headerTitle: "All Orders",
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
          headerTitle: "Product Catalog",
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
          headerTitle: "Profile",
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