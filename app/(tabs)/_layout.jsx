import { useCart } from "@/contexts/CartContext";
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router, Tabs, usePathname } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from 'react-native-safe-area-context';



export default function TabLayout() {
  const { getTotalItems } = useCart();
  const cartCount = getTotalItems();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const miniCartStyle = {
    position: 'absolute',
    bottom: 90 + insets.bottom,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  };

  const tabBarStyle = {
    height: 70 + insets.bottom,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    backgroundColor: "#F9FAFB",
    paddingTop: 8,
    paddingBottom: 8 + insets.bottom,
  };

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#EF4444",
          tabBarInactiveTintColor: "#9E9E9E",
          headerShown: false,
          tabBarStyle,
          tabBarLabelStyle: {
            fontSize: 13,
            fontWeight: "600",
            marginTop: 4,
            marginBottom: 4,
          },
          tabBarIconStyle: {
            marginTop: 4,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Shop",
            tabBarIcon: ({ color, focused }) => (
              <View style={[
                styles.iconContainer,
                focused && styles.iconContainerActive
              ]}>
                <Ionicons
                  name="bag-outline"
                  size={28}
                  color={focused ? "#FFFFFF" : color}
                />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="categories"
          options={{
            title: "My list",
            tabBarIcon: ({ color, focused }) => (
              <View style={[
                styles.iconContainer,
                focused && styles.iconContainerActive
              ]}>
                <Ionicons name="heart-outline" size={28} color={focused ? "#FFFFFF" : color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="wallet"
          options={{
            title: "Wallet",
            tabBarIcon: ({ color, focused }) => (
              <View style={[
                styles.iconContainer,
                focused && styles.iconContainerActive
              ]}>
                <Ionicons name="wallet-outline" size={28} color={focused ? "#FFFFFF" : color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: "Orders",
            tabBarIcon: ({ color, focused }) => (
              <View style={[
                styles.iconContainer,
                focused && styles.iconContainerActive
              ]}>
                <MaterialIcons name="list-alt" size={28} color={focused ? "#FFFFFF" : color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: "Account",
            tabBarIcon: ({ color, focused }) => (
              <View style={[
                styles.iconContainer,
                focused && styles.iconContainerActive
              ]}>
                <Ionicons name="person-outline" size={28} color={focused ? "#FFFFFF" : color} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="cart"
          options={{
            href: null,
          }}
        />
      </Tabs>

      {cartCount > 0 && (pathname === "/" || pathname === "/categories") && (
        <TouchableOpacity
          style={miniCartStyle}
          onPress={() => router.push('/cart')}
          activeOpacity={0.9}
        >
          <View style={styles.miniCartContent}>
            <View style={styles.miniCartLeft}>
              <View style={styles.miniCartBadge}>
                <Text style={styles.miniCartBadgeText}>{cartCount}</Text>
              </View>
              <Text style={styles.miniCartText}>
                {cartCount} {cartCount === 1 ? 'item' : 'items'} in cart
              </Text>
            </View>
            <View style={styles.miniCartRight}>
              <Text style={styles.miniCartLabel}>View Cart</Text>
              <Feather name="chevron-right" size={18} color="#000000" />
            </View>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  iconContainerActive: {
    backgroundColor: "#EF4444",
  },
  miniCartContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  miniCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  miniCartBadge: {
    backgroundColor: '#EF4444',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniCartBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  miniCartText: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '600',
  },
  miniCartRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniCartLabel: {
    color: '#1A1A1A',
    fontSize: 15,
    fontWeight: '700',
  },
});
