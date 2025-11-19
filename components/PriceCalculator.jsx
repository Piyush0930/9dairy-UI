// components/PriceCalculator.js - FULLY UPDATED
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/colors';

const PriceCalculator = ({ inventoryItem, onPriceChange }) => {
  const [quantity, setQuantity] = useState(1);
  const [calculatedPrice, setCalculatedPrice] = useState(0);

  useEffect(() => {
    calculatePrice(quantity);
  }, [quantity, inventoryItem]);

  const calculatePrice = (qty) => {
    if (!inventoryItem || !inventoryItem._id) return;

    try {
      // Always use sellingPrice as the base (retailer's overridden price)
      const basePrice = inventoryItem.sellingPrice || 0;
      const regularPrice = basePrice * qty;
      
      if (!inventoryItem.enableQuantityPricing || !inventoryItem.pricingSlabs || inventoryItem.pricingSlabs.length === 0) {
        setCalculatedPrice(regularPrice);
        onPriceChange?.(regularPrice, qty);
        return;
      }

      // Find applicable slab
      const applicableSlab = inventoryItem.pricingSlabs
        .filter(slab => slab.isActive)
        .sort((a, b) => a.minQuantity - b.minQuantity)
        .find(slab => qty >= slab.minQuantity && qty <= slab.maxQuantity);

      if (!applicableSlab) {
        setCalculatedPrice(regularPrice);
        onPriceChange?.(regularPrice, qty);
        return;
      }

      let discountAmount = 0;
      let finalPrice = regularPrice;

      if (applicableSlab.discountType === 'FLAT') {
        discountAmount = applicableSlab.discountValue;
        finalPrice = Math.max(0, regularPrice - discountAmount);
      } else if (applicableSlab.discountType === 'PERCENTAGE') {
        discountAmount = (regularPrice * applicableSlab.discountValue) / 100;
        finalPrice = Math.max(0, regularPrice - discountAmount);
      }

      setCalculatedPrice(finalPrice);
      onPriceChange?.(finalPrice, qty);

    } catch (error) {
      console.error('Price calculation error:', error);
    }
  };

  const incrementQuantity = () => {
    const newQty = quantity + 1;
    setQuantity(newQty);
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      const newQty = quantity - 1;
      setQuantity(newQty);
    }
  };

  const getDiscountInfo = () => {
    if (!inventoryItem?.enableQuantityPricing || !inventoryItem.pricingSlabs) {
      return null;
    }

    const basePrice = inventoryItem.sellingPrice || 0;
    const regularPrice = basePrice * quantity;
    const discount = regularPrice - calculatedPrice;

    if (discount <= 0) return null;

    const applicableSlab = inventoryItem.pricingSlabs
      .filter(slab => slab.isActive)
      .sort((a, b) => a.minQuantity - b.minQuantity)
      .find(slab => quantity >= slab.minQuantity && quantity <= slab.maxQuantity);

    if (!applicableSlab) return null;

    return {
      discount,
      discountPercentage: regularPrice > 0 ? (discount / regularPrice) * 100 : 0,
      slab: applicableSlab,
      regularPrice
    };
  };

  const discountInfo = getDiscountInfo();
  const basePrice = inventoryItem?.sellingPrice || 0;
  const defaultPrice = inventoryItem?.product?.price || 0;
  const isPriceOverridden = basePrice !== defaultPrice;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quantity & Price Calculator</Text>
      
      {/* Price Information */}
      <View style={styles.priceInfoSection}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Default Price:</Text>
          <Text style={styles.defaultPrice}>₹{defaultPrice.toFixed(2)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Your Selling Price:</Text>
          <Text style={styles.sellingPrice}>₹{basePrice.toFixed(2)}</Text>
          {isPriceOverridden && (
            <View style={styles.overrideBadge}>
              <Text style={styles.overrideBadgeText}>Custom</Text>
            </View>
          )}
        </View>
      </View>

      {/* Quantity Controls */}
      <View style={styles.quantitySection}>
        <Text style={styles.quantityLabel}>Select Quantity</Text>
        <View style={styles.quantityControls}>
          <TouchableOpacity 
            style={styles.quantityButton} 
            onPress={decrementQuantity}
            disabled={quantity <= 1}
          >
            <Ionicons 
              name="remove" 
              size={20} 
              color={quantity <= 1 ? Colors.light.textSecondary : Colors.light.text} 
            />
          </TouchableOpacity>
          
          <TextInput
            style={styles.quantityInput}
            keyboardType="numeric"
            value={quantity.toString()}
            onChangeText={(value) => {
              const numValue = parseInt(value) || 1;
              setQuantity(Math.max(1, numValue));
            }}
          />
          
          <TouchableOpacity 
            style={styles.quantityButton} 
            onPress={incrementQuantity}
          >
            <Ionicons name="add" size={20} color={Colors.light.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Price Calculation */}
      <View style={styles.priceSection}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Total Price:</Text>
          <Text style={styles.finalPrice}>₹{calculatedPrice.toFixed(2)}</Text>
        </View>

        {discountInfo && (
          <View style={styles.discountInfo}>
            <View style={styles.discountRow}>
              <Text style={styles.discountLabel}>Regular Price:</Text>
              <Text style={styles.regularPrice}>₹{discountInfo.regularPrice.toFixed(2)}</Text>
            </View>
            <View style={styles.discountRow}>
              <Text style={styles.discountLabel}>You Save:</Text>
              <Text style={styles.discountAmount}>-₹{discountInfo.discount.toFixed(2)}</Text>
            </View>
            <View style={styles.discountRow}>
              <Text style={styles.discountLabel}>Discount:</Text>
              <Text style={styles.discountPercentage}>
                ({discountInfo.discountPercentage.toFixed(1)}% off)
              </Text>
            </View>
            <Text style={styles.slabInfo}>
              Applied: {discountInfo.slab.discountType === 'FLAT' ? '₹' : ''}
              {discountInfo.slab.discountValue}
              {discountInfo.slab.discountType === 'PERCENTAGE' ? '%' : ''} off for {discountInfo.slab.minQuantity}-{discountInfo.slab.maxQuantity} units
            </Text>
          </View>
        )}

        {inventoryItem?.enableQuantityPricing && inventoryItem.pricingSlabs && inventoryItem.pricingSlabs.length > 0 && (
          <View style={styles.slabsPreview}>
            <Text style={styles.slabsTitle}>Available Quantity Discounts:</Text>
            {inventoryItem.pricingSlabs
              .filter(slab => slab.isActive)
              .sort((a, b) => a.minQuantity - b.minQuantity)
              .map((slab, index) => (
                <Text key={index} style={styles.slabOffer}>
                  • Buy {slab.minQuantity}-{slab.maxQuantity}: Get {slab.discountType === 'FLAT' ? '₹' : ''}
                  {slab.discountValue}
                  {slab.discountType === 'PERCENTAGE' ? '%' : ''} off
                </Text>
              ))}
          </View>
        )}

        {!inventoryItem?.enableQuantityPricing && (
          <View style={styles.noDiscountInfo}>
            <Text style={styles.noDiscountText}>
              Quantity-based pricing is not enabled for this product
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  priceInfoSection: {
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  priceLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  defaultPrice: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textDecorationLine: 'line-through',
  },
  sellingPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  overrideBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  overrideBadgeText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },
  quantitySection: {
    marginBottom: 16,
  },
  quantityLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  quantityInput: {
    width: 60,
    height: 40,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    backgroundColor: '#FFF',
  },
  priceSection: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  finalPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  discountInfo: {
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 12,
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  discountLabel: {
    fontSize: 14,
    color: '#2E7D32',
    fontWeight: '500',
  },
  regularPrice: {
    fontSize: 14,
    color: '#2E7D32',
    textDecorationLine: 'line-through',
  },
  discountAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
  },
  discountPercentage: {
    fontSize: 12,
    color: '#2E7D32',
    fontStyle: 'italic',
  },
  slabInfo: {
    fontSize: 11,
    color: '#2E7D32',
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center',
  },
  slabsPreview: {
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  slabsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 6,
  },
  slabOffer: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 2,
    lineHeight: 16,
  },
  noDiscountInfo: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  noDiscountText: {
    fontSize: 12,
    color: '#E65100',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default PriceCalculator;