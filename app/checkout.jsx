import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCart } from '@/contexts/CartContext';
import { mockAddresses } from '@/mocks/addresses';
import Colors from '@/constants/colors';

export default function CheckoutScreen() {
  const router = useRouter();
  const { items, getTotalPrice, clearCart } = useCart();
  const insets = useSafeAreaInsets();
  const [selectedAddress, setSelectedAddress] = useState(mockAddresses[0].id);
  const [selectedPayment, setSelectedPayment] = useState('upi');

  const handlePlaceOrder = () => {
    clearCart();
    router.push('/order-success');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
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
              <View key={item.product.id} style={styles.summaryItem}>
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
        <TouchableOpacity style={styles.placeOrderButton} onPress={handlePlaceOrder}>
          <Text style={styles.placeOrderButtonText}>Place Order</Text>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 12,
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
  placeOrderButtonText: {
    color: Colors.light.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
