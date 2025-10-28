import Colors from "@/constants/colors";
import { useCart } from "@/contexts/CartContext";
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;

export default function CartScreen() {
  const { items, addToCart, removeFromCart, getTotalPrice, clearCart } = useCart();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    if (items.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return;
    }

    setLoading(true);

    try {
      // Get auth token from storage
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Please login to place order');
        router.push('/Login');
        return;
      }

      // Get user data to check customer profile
      const userData = await AsyncStorage.getItem('userData');
      if (!userData) {
        Alert.alert('Error', 'User data not found. Please login again.');
        router.push('/Login');
        return;
      }

      const user = JSON.parse(userData);
      
      // Prepare order data according to backend schema
      const orderData = {
        items: items.map(item => ({
          productId: item.product.id, // Assuming product has id field
          quantity: item.quantity
        })),
        deliveryAddress: {
          // You might want to get this from user profile or let user enter
          addressLine1: "Customer Address", // This should come from user profile
          city: "City",
          state: "State", 
          pincode: "000000"
        },
        deliveryTime: "Morning", // Default or from user preferences
        paymentMethod: "cash", // Default to cash on delivery
        specialInstructions: "" // Can be made editable
      };

      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create order');
      }

      if (data.success) {
        Alert.alert(
          'Order Placed!',
          `Your order has been placed successfully!\nOrder ID: ${data.order.orderId}\nTotal: ₹${data.order.finalAmount}`,
          [
            {
              text: 'OK',
              onPress: () => {
                clearCart();
                router.push('/checkout');
              }
            }
          ]
        );
      } else {
        throw new Error(data.message || 'Failed to create order');
      }
    } catch (error) {
      console.error('Checkout Error:', error);
      Alert.alert(
        'Order Failed', 
        error.message || 'Failed to place order. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to clear your cart?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: clearCart
        }
      ]
    );
  };

  if (items.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Cart</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="bag-outline" size={80} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtext}>
            Add something fresh from our dairy collection!
          </Text>
          <TouchableOpacity 
            style={styles.shopNowButton}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={styles.shopNowText}>Shop Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cart</Text>
        <TouchableOpacity onPress={handleClearCart} style={styles.clearButton}>
          <MaterialIcons name="delete-outline" size={20} color={Colors.light.tint} />
          <Text style={styles.clearText}>Clear</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.itemsList}>
          {items.map((item) => (
            <View key={item.product._id} style={styles.cartItem}>
              <Image
                source={{ uri: item.product.image }}
                style={styles.productImage}
              />
              <View style={styles.itemInfo}>
                <Text style={styles.productName}>{item.product.name}</Text>
                <Text style={styles.productUnit}>{item.product.unit}</Text>
                <Text style={styles.productPrice}>₹{item.product.price}</Text>
              </View>
              <View style={styles.quantityContainer}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => removeFromCart(item.product.id)}
                  disabled={loading}
                >
                  <Feather name="minus" size={16} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.quantity}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => addToCart(item.product)}
                  disabled={loading}
                >
                  <Feather name="plus" size={16} color={Colors.light.text} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.billSection}>
          <Text style={styles.billTitle}>Bill Details</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Item Total</Text>
            <Text style={styles.billValue}>₹{getTotalPrice()}</Text>
          </View>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Delivery Fee</Text>
            <Text style={styles.billValueFree}>FREE</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.billRow}>
            <Text style={styles.totalLabel}>To Pay</Text>
            <Text style={styles.totalValue}>₹{getTotalPrice()}</Text>
          </View>
        </View>

        {/* Order Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={18} color={Colors.light.tint} />
            <Text style={styles.infoText}>Delivery by tomorrow morning</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="cash-outline" size={18} color={Colors.light.tint} />
            <Text style={styles.infoText}>Cash on delivery available</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalSection}>
          <Text style={styles.footerLabel}>Total</Text>
          <Text style={styles.footerTotal}>₹{getTotalPrice()}</Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButton, loading && styles.buttonDisabled]}
          onPress={() => router.push('/checkout')}
          disabled={loading}
        >
          <Text style={styles.checkoutButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.text,
  },
  clearButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  clearText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.tint,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
    marginBottom: 24,
  },
  shopNowButton: {
    backgroundColor: Colors.light.tint,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopNowText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  itemsList: {
    padding: 16,
  },
  cartItem: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  productUnit: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.light.backgroundLight,
    justifyContent: "center",
    alignItems: "center",
  },
  quantity: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    minWidth: 24,
    textAlign: "center",
  },
  billSection: {
    marginHorizontal: 16,
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginBottom: 16,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 12,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  billLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  billValue: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  billValueFree: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4CAF50",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
  },
  infoSection: {
    marginHorizontal: 16,
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginLeft: 8,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  totalSection: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  footerTotal: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
  },
  checkoutButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  checkoutButtonText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
});