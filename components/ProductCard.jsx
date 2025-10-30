import Colors from "@/constants/colors";
import { useCart } from "@/contexts/CartContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef } from 'react';
import { Animated, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ProductCard({ product, onAddToCart, onPress }) {
  const { addToCart, removeFromCart, getItemQuantity } = useCart();
  const quantity = getItemQuantity(product.id);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const animatePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  const animatePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  const handleAdd = () => {
    if (onAddToCart) {
      onAddToCart(product);
    } else {
      addToCart(product);
    }
  };

  const handleRemove = () => {
    removeFromCart(product.id);
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push("/categories");
    }
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.container}
        onPress={handlePress}
        onPressIn={animatePressIn}
        onPressOut={animatePressOut}
        activeOpacity={0.8}
      >
        <Image source={{ uri: product.image }} style={styles.image} />
        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={2} ellipsizeMode="tail">
            {product.name}
          </Text>
          <Text style={styles.unit}>{product.unit}</Text>
          <View style={styles.footer}>
            <Text style={styles.price}>₹{product.price}</Text>
            {quantity === 0 ? (
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAdd}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={16} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <View style={styles.quantityControl}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={handleRemove}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={14} color={Colors.light.tint} />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={handleAdd}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={14} color={Colors.light.tint} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 165,
    backgroundColor: "#FFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginRight: 12,
    marginBottom: 12,
  },
  image: {
    width: "100%",
    height: 180,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  content: {
    padding: 12,
    minHeight: 120,
  },
  name: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
    height: 38,
  },
  unit: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.light.text,
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.light.tint,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF",
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.light.tint,
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  quantityButton: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: Colors.light.backgroundLight,
    justifyContent: "center",
    alignItems: "center",
  },
  quantityText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.light.text,
    minWidth: 12,
    textAlign: "center",
  },
});