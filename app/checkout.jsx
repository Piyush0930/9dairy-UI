import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { mockAddresses } from '@/mocks/addresses';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;

export default function CheckoutScreen() {
  const router = useRouter();
  const { items, getTotalPrice, clearCart } = useCart();
  const { 
    authToken, 
    isAuthenticated, 
    validateToken,
    logout,
    user 
  } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedAddress, setSelectedAddress] = useState(mockAddresses[0].id);
  const [selectedPayment, setSelectedPayment] = useState('upi');
  const [loading, setLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [orderData, setOrderData] = useState(null);

  // Enhanced API error handler
  const handleApiError = (error, customMessage = null) => {
    console.error('API Error:', error);
    
    if (error.message?.includes('401') || 
        error.message?.includes('Unauthorized') ||
        error.message?.includes('token') ||
        error.response?.status === 401) {
      
      console.log('🔐 Authentication error detected in checkout');
      Alert.alert(
        "Session Expired",
        "Your session has expired. Please login again.",
        [
          {
            text: "OK",
            onPress: () => logout()
          }
        ]
      );
      return true;
    }
    
    Alert.alert("Error", customMessage || "Something went wrong. Please try again.");
    return false;
  };

  // Validate auth before API calls
  const validateAuthBeforeCall = async () => {
    if (!authToken || !isAuthenticated) {
      Alert.alert(
        "Login Required",
        "Please login to place an order",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Login",
            onPress: () => router.push('/Login')
          }
        ]
      );
      return false;
    }

    const isValid = await validateToken();
    if (!isValid) {
      Alert.alert(
        "Session Expired",
        "Please login again",
        [
          {
            text: "OK",
            onPress: () => logout()
          }
        ]
      );
      return false;
    }

    return true;
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0) {
      Alert.alert('Error', 'Your cart is empty');
      return;
    }

    const isValid = await validateAuthBeforeCall();
    if (!isValid) {
      return;
    }

    setLoading(true);

    try {
      const selectedAddressData = mockAddresses.find(addr => addr.id === selectedAddress);

      const orderData = {
        items: items.map(item => ({
          productId: item.product._id,
          quantity: item.quantity
        })),
        deliveryAddress: {
          addressLine1: selectedAddressData.addressLine,
          city: selectedAddressData.city,
          state: selectedAddressData.state,
          pincode: selectedAddressData.pincode
        },
        deliveryTime: "Morning",
        paymentMethod: selectedPayment === 'cod' ? 'cash' : selectedPayment,
        specialInstructions: ""
      };

      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create order');
      }

      if (data.success) {
        // Set order data and show success animation
        setOrderData(data.order);
        setOrderSuccess(true);
        clearCart();
        
        // Auto navigate after 3 seconds
        setTimeout(() => {
          router.replace('/(tabs)/orders');
        }, 3000);
      } else {
        throw new Error(data.message || 'Failed to create order');
      }
    } catch (error) {
      console.error('Checkout Error:', error);
      handleApiError(error, error.message || 'Failed to place order. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Order Success Animation Component
  const OrderSuccessAnimation = () => (
    <View style={styles.successContainer}>
      <View style={styles.animationContainer}>
        {/* Animated Checkmark */}
        <View style={styles.checkmarkContainer}>
          <View style={styles.checkmarkCircle}>
            <Ionicons name="checkmark" size={60} color="#FFF" />
          </View>
        </View>
        
        {/* Success Text */}
        <Text style={styles.successTitle}>Order Placed Successfully!</Text>
        <Text style={styles.successSubtitle}>
          Your order has been confirmed and will be delivered soon
        </Text>
        
        {/* Order Details */}
        {orderData && (
          <View style={styles.orderDetails}>
            <Text style={styles.orderId}>Order ID: #{orderData.orderId}</Text>
            <Text style={styles.orderAmount}>Total: ₹{orderData.finalAmount}</Text>
            <Text style={styles.deliveryText}>
              Expected delivery: Tomorrow Morning
            </Text>
          </View>
        )}
        
        {/* Loading indicator for auto navigation */}
        <View style={styles.navigationIndicator}>
          <Text style={styles.navigationText}>
            Redirecting to orders in 3 seconds...
          </Text>
        </View>
      </View>
    </View>
  );

  // Add empty cart check at the beginning
  if (items.length === 0 && !orderSuccess) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={80} color={Colors.light.border} />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <Text style={styles.emptySubtext}>
            Add some items to your cart before checkout
          </Text>
          <TouchableOpacity 
            style={styles.shopNowButton}
            onPress={() => router.push('/(tabs)')}
          >
            <Text style={styles.shopNowText}>Continue Shopping</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show success animation if order was successful
  if (orderSuccess) {
    return <OrderSuccessAnimation />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <TouchableOpacity style={styles.addButton}>
              <Ionicons name="add" size={20} color={Colors.light.tint} />
              <Text style={styles.addButtonText}>Add New</Text>
            </TouchableOpacity>
          </View>
          {mockAddresses.map((address) => (
            <TouchableOpacity
              key={address.id}
              style={[
                styles.addressCard,
                selectedAddress === address.id && styles.addressCardSelected,
              ]}
              onPress={() => setSelectedAddress(address.id)}
              activeOpacity={0.7}
            >
              <View style={styles.addressHeader}>
                <View style={styles.addressIconContainer}>
                  <Ionicons name="location-outline" size={20} color={Colors.light.accent} />
                </View>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressName}>{address.name}</Text>
                  <Text style={styles.addressText}>
                    {address.addressLine}, {address.city}
                  </Text>
                  <Text style={styles.addressText}>
                    {address.state} - {address.pincode}
                  </Text>
                  <Text style={styles.addressPhone}>{address.phone}</Text>
                </View>
                {selectedAddress === address.id && (
                  <Ionicons name="checkmark-circle-outline" size={24} color={Colors.light.accent} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          <TouchableOpacity
            style={[
              styles.paymentCard,
              selectedPayment === 'upi' && styles.paymentCardSelected,
            ]}
            onPress={() => setSelectedPayment('upi')}
            activeOpacity={0.7}
          >
            <View style={styles.paymentIconContainer}>
              <Ionicons name="wallet-outline" size={24} color={Colors.light.accent} />
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentName}>UPI</Text>
              <Text style={styles.paymentDesc}>Pay using UPI apps</Text>
            </View>
            {selectedPayment === 'upi' && <Ionicons name="checkmark-circle-outline" size={24} color={Colors.light.accent} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentCard,
              selectedPayment === 'card' && styles.paymentCardSelected,
            ]}
            onPress={() => setSelectedPayment('card')}
            activeOpacity={0.7}
          >
            <View style={styles.paymentIconContainer}>
              <Ionicons name="card-outline" size={24} color={Colors.light.accent} />
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentName}>Card</Text>
              <Text style={styles.paymentDesc}>Credit or Debit card</Text>
            </View>
            {selectedPayment === 'card' && <Ionicons name="checkmark-circle-outline" size={24} color={Colors.light.accent} />}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentCard,
              selectedPayment === 'cod' && styles.paymentCardSelected,
            ]}
            onPress={() => setSelectedPayment('cod')}
            activeOpacity={0.7}
          >
            <View style={styles.paymentIconContainer}>
              <Ionicons name="cash-outline" size={24} color={Colors.light.accent} />
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentName}>Cash on Delivery</Text>
              <Text style={styles.paymentDesc}>Pay when you receive</Text>
            </View>
            {selectedPayment === 'cod' && <Ionicons name="checkmark-circle-outline" size={24} color={Colors.light.accent} />}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <View style={styles.summaryCard}>
            {items.map((item) => (
              <View key={item.product._id} style={styles.summaryItem}>
                <Text style={styles.summaryItemName}>
                  {item.product.name} x {item.quantity}
                </Text>
                <Text style={styles.summaryItemPrice}>
                  ₹{item.product.price * item.quantity}
                </Text>
              </View>
            ))}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryTotalLabel}>Total</Text>
              <Text style={styles.summaryTotalAmount}>₹{getTotalPrice()}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total Amount</Text>
          <Text style={styles.totalAmount}>₹{getTotalPrice()}</Text>
        </View>
        <TouchableOpacity 
          style={[styles.placeOrderButton, loading && styles.buttonDisabled]} 
          onPress={handlePlaceOrder}
          disabled={loading}
        >
          <Text style={styles.placeOrderButtonText}>
            {loading ? 'Placing Order...' : 'Place Order'}
          </Text>
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
  content: {
    flex: 1,
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.tint,
  },
  addressCard: {
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  addressCardSelected: {
    borderColor: Colors.light.accent,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  addressPhone: {
    fontSize: 14,
    color: Colors.light.textLight,
    marginTop: 4,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentCardSelected: {
    borderColor: Colors.light.accent,
  },
  paymentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  paymentDesc: {
    fontSize: 14,
    color: Colors.light.textLight,
  },
  summaryCard: {
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    padding: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryItemName: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    flex: 1,
  },
  summaryItemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginVertical: 8,
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
  },
  summaryTotalAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    backgroundColor: Colors.light.white,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    color: Colors.light.textLight,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
  },
  placeOrderButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  placeOrderButtonText: {
    color: Colors.light.white,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
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
  // Success Animation Styles
  successContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  animationContainer: {
    alignItems: 'center',
    width: '100%',
  },
  checkmarkContainer: {
    marginBottom: 32,
  },
  checkmarkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  orderDetails: {
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderId: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  orderAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.accent,
    textAlign: 'center',
    marginBottom: 12,
  },
  deliveryText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  navigationIndicator: {
    marginTop: 16,
  },
  navigationText: {
    fontSize: 14,
    color: Colors.light.textLight,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});