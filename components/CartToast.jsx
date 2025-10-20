import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useCart } from "@/contexts/CartContext";
import { router } from "expo-router";
import { usePathname } from "expo-router";

export default function CartToast() {
  const { showToast, toastMessage, getTotalItems, getTotalPrice } = useCart();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pathname = usePathname();

  // Only show toast on Shop and My List pages
  const isOnShopOrListPage = pathname === "/" || pathname === "/categories";

  useEffect(() => {
    if (showToast && isOnShopOrListPage) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      }, 1700);

      return () => clearTimeout(timer);
    }
  }, [showToast, translateY, opacity, isOnShopOrListPage]);

  if (!showToast || !isOnShopOrListPage) return null;

  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.toast}
        onPress={() => router.push("/cart")}
        activeOpacity={0.9}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="cart-outline" size={20} color="#FFFFFF" />
        </View>
        <View style={styles.content}>
          <Text style={styles.message} numberOfLines={1}>
            {toastMessage}
          </Text>
          <Text style={styles.summary}>
            {totalItems} {totalItems === 1 ? "item" : "items"} · ₹{totalPrice}
          </Text>
        </View>
        <View style={styles.viewCart}>
          <Text style={styles.viewCartText}>View</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 90,
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.light.tint,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  summary: {
    fontSize: 12,
    color: "#BDBDBD",
    fontWeight: "500",
  },
  viewCart: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 8,
  },
  viewCartText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});