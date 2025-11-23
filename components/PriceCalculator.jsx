// components/PriceCalculator.js - UPDATED WITH PRICE VALIDATION
import Colors from '@/constants/colors';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const PriceCalculator = ({ inventoryItem, onPriceChange, authToken }) => {
  const [quantity, setQuantity] = useState(1);
  const [calculatedPrice, setCalculatedPrice] = useState(0);
  const [calculatedPriceInfo, setCalculatedPriceInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validatedPriceData, setValidatedPriceData] = useState(null);

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

  useEffect(() => {
    validateAndFetchPrice();
  }, [inventoryItem]);

  useEffect(() => {
    if (validatedPriceData) {
      calculatePrice(quantity);
    }
  }, [quantity, validatedPriceData]);

  // 🔥 NEW: Validate and fetch corrected price
  const validateAndFetchPrice = async () => {
    if (!inventoryItem || !inventoryItem._id || !authToken) return;

    setLoading(true);
    try {
      console.log('🔄 Validating price for product:', inventoryItem.product?.name);
      
      const response = await fetch(
        `${API_BASE_URL}/api/retailer/inventory/product-price/${inventoryItem.product?._id || inventoryItem.product}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setValidatedPriceData(result.data);
        
        console.log('✅ Price validation result:', {
          productName: result.data.productName,
          catalogPrice: result.data.catalogPrice,
          retailerPrice: result.data.retailerPrice,
          priceCorrected: result.data.priceCorrected,
          discountedPrice: result.data.discountedPrice
        });

        if (result.data.priceCorrected) {
          console.log('🔄 Price was auto-corrected');
        }
      } else {
        // Fallback to original inventory data
        setValidatedPriceData({
          retailerPrice: inventoryItem.sellingPrice,
          discountedPrice: inventoryItem.sellingPrice,
          catalogPrice: inventoryItem.product?.price,
          priceCorrected: false,
          appliedDiscount: 0,
          discountType: null,
          pricingSlabs: inventoryItem.pricingSlabs || [],
          hasQuantityPricing: inventoryItem.enableQuantityPricing
        });
      }
    } catch (error) {
      console.error('❌ Price validation failed:', error);
      // Fallback to original data
      setValidatedPriceData({
        retailerPrice: inventoryItem.sellingPrice,
        discountedPrice: inventoryItem.sellingPrice,
        catalogPrice: inventoryItem.product?.price,
        priceCorrected: false,
        appliedDiscount: 0,
        discountType: null,
        pricingSlabs: inventoryItem.pricingSlabs || [],
        hasQuantityPricing: inventoryItem.enableQuantityPricing
      });
    } finally {
      setLoading(false);
    }
  };

  const calculatePrice = (qty) => {
    if (!validatedPriceData) return;

    try {
      const basePrice = validatedPriceData.retailerPrice || 0;
      const regularPrice = basePrice * qty;
      
      if (!validatedPriceData.hasQuantityPricing || !validatedPriceData.pricingSlabs || validatedPriceData.pricingSlabs.length === 0) {
        const result = {
          finalPrice: regularPrice,
          finalUnitPrice: basePrice,
          appliedDiscount: 0,
          discountType: null,
          baseTotal: regularPrice,
          hasDiscount: false,
          priceCorrected: validatedPriceData.priceCorrected
        };
        setCalculatedPrice(regularPrice);
        setCalculatedPriceInfo(result);
        onPriceChange?.(regularPrice, qty, result);
        return;
      }

      // Get all active slabs sorted by minQuantity
      const activeSlabs = validatedPriceData.pricingSlabs
        .filter(slab => slab.isActive)
        .sort((a, b) => a.minQuantity - b.minQuantity);

      if (activeSlabs.length === 0) {
        const result = {
          finalPrice: regularPrice,
          finalUnitPrice: basePrice,
          appliedDiscount: 0,
          discountType: null,
          baseTotal: regularPrice,
          hasDiscount: false,
          priceCorrected: validatedPriceData.priceCorrected
        };
        setCalculatedPrice(regularPrice);
        setCalculatedPriceInfo(result);
        onPriceChange?.(regularPrice, qty, result);
        return;
      }

      // ✅ Find applicable slab or use last slab for extended quantities
      let applicableSlab = activeSlabs.find(slab => 
        qty >= slab.minQuantity && qty <= slab.maxQuantity
      );

      let isExtendedRange = false;

      // If no slab found for this quantity, use the last slab
      if (!applicableSlab) {
        applicableSlab = activeSlabs[activeSlabs.length - 1];
        isExtendedRange = true;
        
        // Only apply if quantity meets the last slab's minimum requirement
        if (qty < applicableSlab.minQuantity) {
          const result = {
            finalPrice: regularPrice,
            finalUnitPrice: basePrice,
            appliedDiscount: 0,
            discountType: null,
            baseTotal: regularPrice,
            hasDiscount: false,
            priceCorrected: validatedPriceData.priceCorrected
          };
          setCalculatedPrice(regularPrice);
          setCalculatedPriceInfo(result);
          onPriceChange?.(regularPrice, qty, result);
          return;
        }
      }

      // Calculate per-piece discounted price
      let discountedPricePerPiece = basePrice;
      let discountAmountPerPiece = 0;

      if (applicableSlab.discountType === 'FLAT') {
        discountAmountPerPiece = applicableSlab.discountValue;
        discountedPricePerPiece = Math.max(0, basePrice - discountAmountPerPiece);
      } else if (applicableSlab.discountType === 'PERCENTAGE') {
        discountAmountPerPiece = (basePrice * applicableSlab.discountValue) / 100;
        discountedPricePerPiece = Math.max(0, basePrice - discountAmountPerPiece);
      }

      const finalPrice = discountedPricePerPiece * qty;
      const totalDiscount = discountAmountPerPiece * qty;

      const result = {
        finalPrice: Math.round(finalPrice * 100) / 100,
        finalUnitPrice: Math.round(discountedPricePerPiece * 100) / 100,
        appliedDiscount: Math.round(totalDiscount * 100) / 100,
        discountType: applicableSlab.discountType,
        baseTotal: Math.round(regularPrice * 100) / 100,
        hasDiscount: true,
        priceCorrected: validatedPriceData.priceCorrected,
        discountDetails: {
          slab: applicableSlab,
          discountedPricePerPiece: Math.round(discountedPricePerPiece * 100) / 100,
          discountAmountPerPiece: Math.round(discountAmountPerPiece * 100) / 100,
          isExtendedRange: isExtendedRange
        },
        quantity: qty,
        basePrice: basePrice,
        savings: Math.round((regularPrice - finalPrice) * 100) / 100,
        savingsPercentage: regularPrice > 0 ? Math.round(((regularPrice - finalPrice) / regularPrice) * 100 * 100) / 100 : 0
      };

      setCalculatedPrice(finalPrice);
      setCalculatedPriceInfo(result);
      onPriceChange?.(finalPrice, qty, result);

    } catch (error) {
      console.error('Price calculation error:', error);
      const basePrice = validatedPriceData?.retailerPrice || 0;
      const regularPrice = basePrice * qty;
      setCalculatedPrice(regularPrice);
      setCalculatedPriceInfo({
        finalPrice: regularPrice,
        finalUnitPrice: basePrice,
        appliedDiscount: 0,
        discountType: null,
        baseTotal: regularPrice,
        hasDiscount: false,
        priceCorrected: validatedPriceData?.priceCorrected || false
      });
      onPriceChange?.(regularPrice, qty, null);
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
    if (!calculatedPriceInfo?.hasDiscount) {
      return null;
    }

    const regularPrice = calculatedPriceInfo.baseTotal;
    const discount = calculatedPriceInfo.appliedDiscount;
    const isExtendedRange = calculatedPriceInfo.discountDetails?.isExtendedRange;

    if (discount <= 0) return null;

    return {
      discount,
      discountPercentage: calculatedPriceInfo.savingsPercentage,
      slab: calculatedPriceInfo.discountDetails.slab,
      regularPrice,
      isExtendedRange,
      finalPrice: calculatedPriceInfo.finalPrice,
      finalUnitPrice: calculatedPriceInfo.finalUnitPrice,
      priceCorrected: calculatedPriceInfo.priceCorrected
    };
  };

  const discountInfo = getDiscountInfo();
  const basePrice = validatedPriceData?.retailerPrice || inventoryItem?.sellingPrice || 0;
  const defaultPrice = validatedPriceData?.catalogPrice || inventoryItem?.product?.price || 0;
  const isPriceOverridden = basePrice !== defaultPrice;
  const priceCorrected = validatedPriceData?.priceCorrected || false;

  // Get all active pricing slabs for display
  const activeSlabs = validatedPriceData?.pricingSlabs?.filter(slab => slab.isActive) || inventoryItem?.pricingSlabs?.filter(slab => slab.isActive) || [];

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text style={styles.loadingText}>Validating price...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quantity & Price Calculator</Text>
      
      {/* 🔥 NEW: Price Correction Alert */}
      {priceCorrected && (
        <View style={styles.correctionAlert}>
          <Ionicons name="warning" size={16} color="#D32F2F" />
          <Text style={styles.correctionText}>
            Price was auto-corrected for accuracy
          </Text>
        </View>
      )}
      
      {/* Price Information */}
      <View style={styles.priceInfoSection}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Default Price:</Text>
          <Text style={styles.defaultPrice}>₹{defaultPrice.toFixed(2)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Your Selling Price:</Text>
          <View style={styles.sellingPriceContainer}>
            <Text style={styles.sellingPrice}>₹{basePrice.toFixed(2)}</Text>
            {isPriceOverridden && (
              <View style={styles.overrideBadge}>
                <Text style={styles.overrideBadgeText}>Custom</Text>
              </View>
            )}
            {priceCorrected && (
              <View style={styles.correctedBadge}>
                <Ionicons name="checkmark" size={10} color="#FFF" />
                <Text style={styles.correctedBadgeText}>Corrected</Text>
              </View>
            )}
          </View>
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
        <View style={styles.finalPriceRow}>
          <Text style={styles.finalPriceLabel}>Total Price:</Text>
          <Text style={styles.finalPrice}>₹{calculatedPrice.toFixed(2)}</Text>
        </View>

        {discountInfo && (
          <View style={[
            styles.discountInfo,
            discountInfo.isExtendedRange && styles.discountInfoExtended
          ]}>
            {/* Extended Range Badge */}
            {discountInfo.isExtendedRange && (
              <View style={styles.extendedRangeBadge}>
                <Ionicons name="infinite" size={14} color="#FFF" />
                <Text style={styles.extendedRangeText}>Extended Quantity Discount</Text>
              </View>
            )}
            
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
            
            {/* Applied Discount Info */}
            <View style={styles.appliedDiscountInfo}>
              <Text style={styles.appliedDiscountTitle}>
                {discountInfo.isExtendedRange ? '🔗 Applied Discount:' : '✅ Applied Discount:'}
              </Text>
              <Text style={styles.appliedDiscountText}>
                {discountInfo.slab.discountType === 'FLAT' ? '₹' : ''}
                {discountInfo.slab.discountValue}
                {discountInfo.slab.discountType === 'PERCENTAGE' ? '%' : ''} off per piece
              </Text>
              <Text style={styles.appliedDiscountRange}>
                {discountInfo.isExtendedRange ? (
                  `For ${discountInfo.slab.minQuantity}+ units (extended range)`
                ) : (
                  `For ${discountInfo.slab.minQuantity}-${discountInfo.slab.maxQuantity} units`
                )}
              </Text>
            </View>

            {/* Per Piece Price */}
            <View style={styles.perPieceInfo}>
              <Text style={styles.perPieceLabel}>Effective Price:</Text>
              <Text style={styles.perPieceValue}>
                ₹{discountInfo.finalUnitPrice.toFixed(2)} per piece
              </Text>
            </View>
          </View>
        )}

        {/* Available Quantity Discounts */}
        {validatedPriceData?.hasQuantityPricing && activeSlabs.length > 0 && (
          <View style={styles.slabsPreview}>
            <Text style={styles.slabsTitle}>Available Quantity Discounts:</Text>
            {activeSlabs
              .sort((a, b) => a.minQuantity - b.minQuantity)
              .map((slab, index) => {
                const isLastSlab = index === activeSlabs.length - 1;
                return (
                  <View key={index} style={styles.slabOfferContainer}>
                    <Text style={styles.slabOffer}>
                      • {slab.minQuantity}-{slab.maxQuantity} units: {slab.discountType === 'FLAT' ? '₹' : ''}
                      {slab.discountValue}
                      {slab.discountType === 'PERCENTAGE' ? '%' : ''} off per piece
                    </Text>
                    {isLastSlab && (
                      <Text style={styles.extendedNote}>
                        🔄 {slab.minQuantity}+ units get this discount automatically
                      </Text>
                    )}
                  </View>
                );
              })}
          </View>
        )}

        {!validatedPriceData?.hasQuantityPricing && (
          <View style={styles.noDiscountInfo}>
            <Text style={styles.noDiscountText}>
              Quantity-based pricing is not enabled for this product
            </Text>
          </View>
        )}

        {/* Quick Quantity Examples */}
        {validatedPriceData?.hasQuantityPricing && activeSlabs.length > 0 && (
          <View style={styles.quickExamples}>
            <Text style={styles.quickExamplesTitle}>Quick Examples:</Text>
            <View style={styles.quickExamplesGrid}>
              {[1, 5, 10, 20].map((exampleQty) => {
                // Calculate example price
                const basePrice = validatedPriceData.retailerPrice || 0;
                let exampleFinalPrice = basePrice * exampleQty;
                
                if (activeSlabs.length > 0) {
                  let applicableSlab = activeSlabs.find(slab => 
                    exampleQty >= slab.minQuantity && exampleQty <= slab.maxQuantity
                  );

                  if (!applicableSlab && exampleQty >= activeSlabs[activeSlabs.length - 1].minQuantity) {
                    applicableSlab = activeSlabs[activeSlabs.length - 1];
                  }

                  if (applicableSlab) {
                    let discountedPricePerPiece = basePrice;
                    if (applicableSlab.discountType === 'FLAT') {
                      discountedPricePerPiece = Math.max(0, basePrice - applicableSlab.discountValue);
                    } else if (applicableSlab.discountType === 'PERCENTAGE') {
                      discountedPricePerPiece = Math.max(0, basePrice - (basePrice * applicableSlab.discountValue) / 100);
                    }
                    exampleFinalPrice = discountedPricePerPiece * exampleQty;
                  }
                }

                return (
                  <View key={exampleQty} style={styles.quickExampleItem}>
                    <Text style={styles.quickExampleQty}>{exampleQty} unit{exampleQty > 1 ? 's' : ''}</Text>
                    <Text style={styles.quickExamplePrice}>₹{exampleFinalPrice.toFixed(2)}</Text>
                  </View>
                );
              })}
            </View>
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
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  correctionAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FFCDD2',
    gap: 8,
  },
  correctionText: {
    fontSize: 12,
    color: '#D32F2F',
    fontWeight: '500',
    flex: 1,
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
  sellingPriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  },
  overrideBadgeText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },
  correctedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  correctedBadgeText: {
    fontSize: 8,
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
  finalPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  finalPriceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  finalPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  discountInfo: {
    backgroundColor: '#E8F5E8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  discountInfoExtended: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FFE0B2',
  },
  extendedRangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 6,
  },
  extendedRangeText: {
    fontSize: 12,
    color: '#FFF',
    fontWeight: '600',
  },
  discountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
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
  appliedDiscountInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#C8E6C9',
  },
  appliedDiscountTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2E7D32',
    marginBottom: 4,
  },
  appliedDiscountText: {
    fontSize: 13,
    color: '#2E7D32',
    fontWeight: '500',
    marginBottom: 2,
  },
  appliedDiscountRange: {
    fontSize: 12,
    color: '#2E7D32',
    fontStyle: 'italic',
  },
  perPieceInfo: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#C8E6C9',
  },
  perPieceLabel: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '500',
  },
  perPieceValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
    marginTop: 2,
  },
  slabsPreview: {
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  slabsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  slabOfferContainer: {
    marginBottom: 8,
  },
  slabOffer: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    lineHeight: 16,
  },
  extendedNote: {
    fontSize: 11,
    color: '#FF9800',
    fontStyle: 'italic',
    marginTop: 2,
    marginLeft: 8,
  },
  noDiscountInfo: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  noDiscountText: {
    fontSize: 12,
    color: '#E65100',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  quickExamples: {
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  quickExamplesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  quickExamplesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickExampleItem: {
    flex: 1,
    minWidth: '48%',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#FFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  quickExampleQty: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  quickExamplePrice: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.accent,
  },
});

export default PriceCalculator;