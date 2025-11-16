import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useCart } from "@/contexts/CartContext";
import { router } from "expo-router";
import { usePathname } from "expo-router";

export default function CartToast() {
  const { showToast, toastMessage, getTotalItems, getTotalPrice } = useCart();
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const pathname = usePathname();

  // Only show toast on Shop and My List pages
  const isOnShopOrListPage = pathname === "/" || pathname === "/categories";

  useEffect(() => {
    if (showToast && isOnShopOrListPage) {
      // Reset animations
      translateY.setValue(-120);
      opacity.setValue(0);
      scale.setValue(0.8);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 200,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.spring(translateY, {
            toValue: -120,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 0.8,
            tension: 200,
            friction: 10,
            useNativeDriver: true,
          }),
        ]).start();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [showToast, translateY, opacity, scale, isOnShopOrListPage]);

  if (!showToast || !isOnShopOrListPage) return null;

  const totalItems = getTotalItems();
  const totalPrice = getTotalPrice();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }, { scale }],
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
          <Ionicons name="cart-outline" size={20} color={Colors.light.white} />
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
    backgroundColor: Colors.light.white,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.light.borderLight,
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
    color: Colors.light.text,
    marginBottom: 4,
  },
  summary: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: "500",
  },
  viewCart: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.light.tint,
    borderRadius: 8,
  },
  viewCartText: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.light.white,
  },
});
