// C:\Users\Krishna\OneDrive\Desktop\frontend-dairy9\9dairy-UI\components\ProductCard.jsx
import Colors from "@/constants/colors";
import { useCart } from "@/contexts/CartContext";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef } from "react";
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ProductCard({ product, onAddToCart, onPress }) {
  const { addToCart, removeFromCart, getItemQuantity } = useCart();

  // --------------------------
  // CORRECT PRODUCT ID
  // --------------------------
  const productId = product.id || product._id || product.productId || null;
  const quantity = getItemQuantity(productId);

  // --------------------------
  // RETAILER-SPECIFIC INVENTORY LOGIC
  // --------------------------
  const inventory = product._inventory ?? null;
  
  // Check if retailer sells this product
  const soldByRetailer = inventory !== null;
  
  // Stock decision: ONLY use retailer's inventory stock
  // If retailer doesn't sell it → consider out of stock
  const retailerStock = inventory?.currentStock;
  const isOutOfStock = !soldByRetailer || (retailerStock !== undefined && Number(retailerStock) <= 0);

  // Price priority: ONLY retailer selling price if available
  // If retailer doesn't sell it, use product price as fallback (but product won't be shown due to filtering)
  const price = inventory?.sellingPrice ?? product?.discountedPrice ?? product?.price ?? 0;

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const animatePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
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
    if (isOutOfStock) return;
    if (onAddToCart) onAddToCart(product);
    else addToCart(product);
  };

  const handleRemove = () => {
    removeFromCart(productId);
  };

  const handlePress = () => {
    if (onPress) onPress();
    else router.push("/categories");
  };

  // --------------------------
  // IMAGE fallback handler
  // --------------------------
  const productImage =
    typeof product.image === "string"
      ? { uri: product.image }
      : product.image || require("../assets/images/NO-IMAGE.png");

  return (
    <Animated.View
      style={{ transform: [{ scale: scaleAnim }], marginBottom: 6 }}
    >
      <TouchableOpacity
        style={[styles.container, isOutOfStock && styles.containerOut]}
        onPress={handlePress}
        onPressIn={animatePressIn}
        onPressOut={animatePressOut}
        activeOpacity={0.85}
        disabled={isOutOfStock}
      >
        <Image
          source={productImage}
          style={[styles.image, isOutOfStock && { opacity: 0.45 }]}
          resizeMode="cover"
        />

        {isOutOfStock && (
          <View style={styles.outOfStockBanner}>
            <Text style={styles.outOfStockText}>
              {!soldByRetailer ? "NOT AVAILABLE" : "OUT OF STOCK"}
            </Text>
          </View>
        )}

        {/* Retailer Price Badge */}
        {soldByRetailer && inventory?.sellingPrice && (
          <View style={styles.retailerPriceBadge}>
            <Text style={styles.retailerPriceText}>Retailer Price</Text>
          </View>
        )}

        <View style={styles.content}>
          <Text style={styles.name} numberOfLines={2}>
            {product.name || product.title || "Unnamed Product"}
          </Text>

          <Text style={styles.unit}>{product.unit || " "}</Text>

          {/* Stock Information */}
          {soldByRetailer && retailerStock !== undefined && (
            <Text style={styles.stockInfo}>
              Stock: {retailerStock} {product.unit || ''}
            </Text>
          )}

          <View style={styles.footer}>
            <Text style={styles.price}>₹{price}</Text>

            {isOutOfStock ? (
              <View style={styles.outStateContainer}>
                <Text style={styles.outStateText}>
                  {!soldByRetailer ? "Not available" : "Out of stock"}
                </Text>
              </View>
            ) : quantity === 0 ? (
              <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
                <Ionicons name="add" size={16} color="#FFF" />
              </TouchableOpacity>
            ) : (
              <View style={styles.quantityControl}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={handleRemove}
                >
                  <Ionicons name="remove" size={14} color={Colors.light.tint} />
                </TouchableOpacity>

                <Text style={styles.quantityText}>{quantity}</Text>

                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={handleAdd}
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
    overflow: "hidden",
  },
  containerOut: {
    borderColor: "#F3D3D3",
    backgroundColor: "#FFF7F7",
  },
  image: {
    width: "100%",
    height: 140,
  },
  outOfStockBanner: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 20,
  },
  outOfStockText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 10,
  },
  retailerPriceBadge: {
    position: "absolute",
    right: 8,
    top: 8,
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    zIndex: 20,
  },
  retailerPriceText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 9,
  },
  content: {
    padding: 10,
    minHeight: 120,
    justifyContent: "space-between",
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
    marginBottom: 4,
  },
  stockInfo: {
    fontSize: 11,
    color: "#666",
    marginBottom: 6,
    fontStyle: "italic",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
  outStateContainer: {
    backgroundColor: "#FFF",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  outStateText: {
    color: "#B91C1C",
    fontWeight: "700",
    fontSize: 11,
    textAlign: "center",
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