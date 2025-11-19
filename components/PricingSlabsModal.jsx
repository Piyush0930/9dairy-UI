// components/PricingSlabsModal.js - UPDATED
import Colors from '@/constants/colors';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const PricingSlabsModal = ({ visible, onClose, inventoryItem, onSave, authToken }) => {
  const [pricingSlabs, setPricingSlabs] = useState([]);
  const [sellingPrice, setSellingPrice] = useState('');
  const [minStockLevel, setMinStockLevel] = useState('');
  const [maxStockLevel, setMaxStockLevel] = useState('');
  const [enableQuantityPricing, setEnableQuantityPricing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (inventoryItem) {
      setSellingPrice(inventoryItem.sellingPrice?.toString() || '');
      setMinStockLevel(inventoryItem.minStockLevel?.toString() || '10');
      setMaxStockLevel(inventoryItem.maxStockLevel?.toString() || '100');
      setEnableQuantityPricing(inventoryItem.enableQuantityPricing || false);
      setPricingSlabs(inventoryItem.pricingSlabs || []);
    }
  }, [inventoryItem]);

  const addNewSlab = () => {
    const newSlab = {
      minQuantity: pricingSlabs.length > 0 ? pricingSlabs[pricingSlabs.length - 1].maxQuantity + 1 : 1,
      maxQuantity: pricingSlabs.length > 0 ? pricingSlabs[pricingSlabs.length - 1].maxQuantity + 10 : 10,
      discountType: 'FLAT',
      discountValue: '0',
      isActive: true
    };
    setPricingSlabs([...pricingSlabs, newSlab]);
  };

  const updateSlab = (index, field, value) => {
    const updatedSlabs = [...pricingSlabs];
    updatedSlabs[index][field] = value;
    setPricingSlabs(updatedSlabs);
  };

  const removeSlab = (index) => {
    const updatedSlabs = pricingSlabs.filter((_, i) => i !== index);
    setPricingSlabs(updatedSlabs);
  };

  const validateForm = () => {
    if (!sellingPrice || isNaN(parseFloat(sellingPrice)) || parseFloat(sellingPrice) <= 0) {
      Alert.alert('Error', 'Please enter a valid selling price');
      return false;
    }

    if (parseInt(minStockLevel) < 0) {
      Alert.alert('Error', 'Minimum stock level cannot be negative');
      return false;
    }

    if (parseInt(maxStockLevel) <= parseInt(minStockLevel)) {
      Alert.alert('Error', 'Maximum stock level must be greater than minimum stock level');
      return false;
    }

    if (enableQuantityPricing) {
      for (let i = 0; i < pricingSlabs.length; i++) {
        const slab = pricingSlabs[i];
        
        if (slab.minQuantity < 0) {
          Alert.alert('Error', `Slab ${i + 1}: Minimum quantity cannot be negative`);
          return false;
        }
        
        if (slab.maxQuantity <= slab.minQuantity) {
          Alert.alert('Error', `Slab ${i + 1}: Maximum quantity must be greater than minimum quantity`);
          return false;
        }
        
        if (parseFloat(slab.discountValue) < 0) {
          Alert.alert('Error', `Slab ${i + 1}: Discount value cannot be negative`);
          return false;
        }
        
        if (slab.discountType === 'PERCENTAGE' && parseFloat(slab.discountValue) > 100) {
          Alert.alert('Error', `Slab ${i + 1}: Percentage discount cannot exceed 100%`);
          return false;
        }

        // Check for overlaps
        if (i < pricingSlabs.length - 1) {
          const nextSlab = pricingSlabs[i + 1];
          if (slab.maxQuantity >= nextSlab.minQuantity) {
            Alert.alert('Error', `Slab ${i + 1} and ${i + 2} have overlapping quantity ranges`);
            return false;
          }
        }
      }
    }
    
    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      
      const updateData = {
        sellingPrice: parseFloat(sellingPrice),
        minStockLevel: parseInt(minStockLevel) || 10,
        maxStockLevel: parseInt(maxStockLevel) || 100,
        enableQuantityPricing: enableQuantityPricing,
        pricingSlabs: enableQuantityPricing ? pricingSlabs.map(slab => ({
          ...slab,
          discountValue: parseFloat(slab.discountValue)
        })) : []
      };

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/retailer/inventory/products/${inventoryItem._id}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        }
      );

      const data = await response.json();
      
      if (!data.success) throw new Error(data.message);

      Alert.alert('Success', 'Product pricing and settings updated successfully!');
      onSave(data.data);
      onClose();
    } catch (error) {
      console.error('Save pricing and settings error:', error);
      Alert.alert('Error', error.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const calculateExamplePrice = (quantity) => {
    if (!sellingPrice) return 0;
    
    const base = parseFloat(sellingPrice);
    const regularPrice = base * quantity;
    
    if (!enableQuantityPricing || pricingSlabs.length === 0) {
      return regularPrice;
    }

    const applicableSlab = pricingSlabs
      .filter(slab => slab.isActive)
      .sort((a, b) => a.minQuantity - b.minQuantity)
      .find(slab => quantity >= slab.minQuantity && quantity <= slab.maxQuantity);

    if (!applicableSlab) return regularPrice;

    const discountValue = parseFloat(applicableSlab.discountValue);
    let discountAmount = 0;

    if (applicableSlab.discountType === 'FLAT') {
      discountAmount = discountValue;
    } else if (applicableSlab.discountType === 'PERCENTAGE') {
      discountAmount = (regularPrice * discountValue) / 100;
    }

    return Math.max(0, regularPrice - discountAmount);
  };

  const renderSlabItem = ({ item, index }) => (
    <View style={styles.slabItem}>
      <View style={styles.slabHeader}>
        <Text style={styles.slabTitle}>Slab {index + 1}</Text>
        <TouchableOpacity onPress={() => removeSlab(index)}>
          <Ionicons name="trash-outline" size={20} color="#F44336" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.slabRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Min Quantity</Text>
          <TextInput
            style={styles.textInput}
            keyboardType="numeric"
            value={item.minQuantity.toString()}
            onChangeText={(value) => updateSlab(index, 'minQuantity', parseInt(value) || 0)}
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Max Quantity</Text>
          <TextInput
            style={styles.textInput}
            keyboardType="numeric"
            value={item.maxQuantity.toString()}
            onChangeText={(value) => updateSlab(index, 'maxQuantity', parseInt(value) || 0)}
          />
        </View>
      </View>
      
      <View style={styles.slabRow}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Discount Type</Text>
          <View style={styles.radioGroup}>
            <TouchableOpacity
              style={styles.radioButton}
              onPress={() => updateSlab(index, 'discountType', 'FLAT')}
            >
              <View style={[
                styles.radioCircle,
                item.discountType === 'FLAT' && styles.radioCircleSelected
              ]}>
                {item.discountType === 'FLAT' && <View style={styles.radioInnerCircle} />}
              </View>
              <Text style={styles.radioText}>Flat (₹)</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.radioButton}
              onPress={() => updateSlab(index, 'discountType', 'PERCENTAGE')}
            >
              <View style={[
                styles.radioCircle,
                item.discountType === 'PERCENTAGE' && styles.radioCircleSelected
              ]}>
                {item.discountType === 'PERCENTAGE' && <View style={styles.radioInnerCircle} />}
              </View>
              <Text style={styles.radioText}>Percentage (%)</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Discount Value</Text>
          <TextInput
            style={styles.textInput}
            keyboardType="numeric"
            value={item.discountValue.toString()}
            onChangeText={(value) => updateSlab(index, 'discountValue', value)}
            placeholder="0"
          />
        </View>
      </View>
      
      <View style={styles.examplePrice}>
        <Text style={styles.exampleText}>
          Example: {item.minQuantity} units = ₹{calculateExamplePrice(item.minQuantity).toFixed(2)}
        </Text>
      </View>
    </View>
  );

  const basePrice = inventoryItem?.product?.price || 0;
  const isPriceOverridden = sellingPrice && parseFloat(sellingPrice) !== basePrice;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Product Pricing & Settings</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={Colors.light.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.productName}>
              {inventoryItem?.productName || 'Product'}
            </Text>

            {/* Price Information */}
            <View style={styles.priceSection}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Default Price:</Text>
                <Text style={styles.basePrice}>₹{basePrice.toFixed(2)}</Text>
              </View>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Your Selling Price (₹) *</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    isPriceOverridden && styles.overriddenPriceInput
                  ]}
                  keyboardType="numeric"
                  value={sellingPrice}
                  onChangeText={setSellingPrice}
                  placeholder="Enter your selling price"
                />
                {isPriceOverridden && (
                  <Text style={styles.overrideNote}>
                    You are overriding the default price
                  </Text>
                )}
              </View>
            </View>

            {/* Stock Levels */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Stock Levels</Text>
              <View style={styles.stockRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Min Stock Level</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={minStockLevel}
                    onChangeText={setMinStockLevel}
                    placeholder="10"
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Max Stock Level</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={maxStockLevel}
                    onChangeText={setMaxStockLevel}
                    placeholder="100"
                  />
                </View>
              </View>
            </View>

            {/* Quantity Pricing Toggle */}
            <View style={styles.toggleSection}>
              <View style={styles.toggleRow}>
                <View>
                  <Text style={styles.toggleLabel}>Enable Quantity-Based Pricing</Text>
                  <Text style={styles.toggleDescription}>
                    Offer different prices based on quantity purchased
                  </Text>
                </View>
                <Switch
                  value={enableQuantityPricing}
                  onValueChange={setEnableQuantityPricing}
                  trackColor={{ false: '#E0E0E0', true: Colors.light.accent }}
                  thumbColor={enableQuantityPricing ? '#FFF' : '#FFF'}
                />
              </View>
            </View>

            {enableQuantityPricing && (
              <>
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Pricing Slabs</Text>
                    <TouchableOpacity style={styles.addButton} onPress={addNewSlab}>
                      <Ionicons name="add" size={20} color="#FFF" />
                      <Text style={styles.addButtonText}>Add Slab</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.sectionDescription}>
                    Configure different prices based on quantity ranges. Discounts will be applied to your selling price.
                  </Text>

                  {pricingSlabs.length === 0 ? (
                    <View style={styles.emptySlabs}>
                      <Ionicons name="pricetag-outline" size={48} color={Colors.light.textSecondary} />
                      <Text style={styles.emptyText}>No pricing slabs configured</Text>
                      <Text style={styles.emptySubtext}>
                        Add pricing slabs to offer quantity-based discounts
                      </Text>
                    </View>
                  ) : (
                    <FlatList
                      data={pricingSlabs}
                      renderItem={renderSlabItem}
                      keyExtractor={(item, index) => index.toString()}
                      scrollEnabled={false}
                      style={styles.slabsList}
                    />
                  )}
                </View>

                {/* Pricing Preview */}
                <View style={styles.previewSection}>
                  <Text style={styles.previewTitle}>Price Preview</Text>
                  <Text style={styles.previewSubtitle}>
                    Based on your selling price: ₹{parseFloat(sellingPrice || 0).toFixed(2)}
                  </Text>
                  <View style={styles.previewGrid}>
                    <View style={styles.previewItem}>
                      <Text style={styles.previewLabel}>1 unit</Text>
                      <Text style={styles.previewValue}>₹{calculateExamplePrice(1).toFixed(2)}</Text>
                    </View>
                    <View style={styles.previewItem}>
                      <Text style={styles.previewLabel}>5 units</Text>
                      <Text style={styles.previewValue}>₹{calculateExamplePrice(5).toFixed(2)}</Text>
                    </View>
                    <View style={styles.previewItem}>
                      <Text style={styles.previewLabel}>10 units</Text>
                      <Text style={styles.previewValue}>₹{calculateExamplePrice(10).toFixed(2)}</Text>
                    </View>
                    <View style={styles.previewItem}>
                      <Text style={styles.previewLabel}>20 units</Text>
                      <Text style={styles.previewValue}>₹{calculateExamplePrice(20).toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              </>
            )}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity 
              style={styles.cancelButton} 
              onPress={onClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.submitButton,
                (!sellingPrice || saving) && styles.submitButtonDisabled
              ]} 
              onPress={handleSave}
              disabled={!sellingPrice || saving}
            >
              <Text style={styles.submitButtonText}>
                {saving ? 'Saving...' : 'Save All Settings'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  modalBody: {
    padding: 20,
    maxHeight: '80%',
  },
  productName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  priceSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  basePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.textSecondary,
  },
  overriddenPriceInput: {
    borderColor: '#4CAF50',
    backgroundColor: '#F1F8E9',
  },
  overrideNote: {
    fontSize: 12,
    color: '#4CAF50',
    marginTop: 4,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 12,
  },
  stockRow: {
    flexDirection: 'row',
    gap: 12,
  },
  toggleSection: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  inputGroup: {
    flex: 1,
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.light.text,
    backgroundColor: '#FFF',
  },
  emptySlabs: {
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  slabsList: {
    marginBottom: 20,
  },
  slabItem: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  slabHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  slabTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  slabRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: Colors.light.accent,
  },
  radioInnerCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.light.accent,
  },
  radioText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  examplePrice: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  exampleText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
  previewSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  previewSubtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  previewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  previewItem: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  previewLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.accent,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  submitButton: {
    flex: 1,
    backgroundColor: Colors.light.accent,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});

export default PricingSlabsModal;