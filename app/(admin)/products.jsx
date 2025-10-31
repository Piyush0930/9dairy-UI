import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function ProductsManagement() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { 
    authToken, 
    isLoading: authLoading, 
    isAuthenticated, 
    validateToken,
    logout 
  } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    unit: 'liter',
    unitSize: '',
    stock: '',
    milkType: 'Cow',
    image: null,
    discount: '',
    isFeatured: false,
    isAvailable: true,
    nutritionalInfo: { fat: '', protein: '', calories: '', carbohydrates: '' },
    tags: '',
  });

  const [imageUri, setImageUri] = useState('');

  // Enhanced API error handler
  const handleApiError = (error, customMessage = null) => {
    console.error('API Error:', error);
    
    // Check for authentication errors
    if (error.message?.includes('401') || 
        error.message?.includes('Unauthorized') ||
        error.message?.includes('token') ||
        error.response?.status === 401) {
      
      console.log('🔐 Authentication error detected, logging out...');
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

  // Token validation before API calls
  const validateAuthBeforeCall = async () => {
    if (!authToken || !isAuthenticated) {
      Alert.alert("Session Expired", "Please login again");
      return false;
    }

    const isValid = await validateToken();
    if (!isValid) {
      Alert.alert("Session Expired", "Please login again");
      return false;
    }

    return true;
  };

  // Get auth headers
  const getAuthHeaders = (forFormData = false) => {
    const headers = {
      'Authorization': `Bearer ${authToken}`,
    };
    
    if (!forFormData) {
      headers['Content-Type'] = 'application/json';
    }
    
    return headers;
  };

  useEffect(() => {
    if (!authLoading && authToken && isAuthenticated) {
      fetchData();
    } else if (!authLoading && (!authToken || !isAuthenticated)) {
      console.log('❌ No auth token or not authenticated');
      setLoading(false);
    }
  }, [authToken, authLoading, isAuthenticated]);

  const fetchData = async () => {
    const isValid = await validateAuthBeforeCall();
    if (!isValid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      const [productsRes, categoriesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/catalog/products`, {
          headers: getAuthHeaders(),
        }),
        fetch(`${API_BASE_URL}/api/catalog/categories`, {
          headers: getAuthHeaders(),
        }),
      ]);

      if (!productsRes.ok) throw new Error('Failed to fetch products');
      
      const productsData = await productsRes.json();
      const categoriesData = await categoriesRes.json();

      setProducts(Array.isArray(productsData) ? productsData : productsData.products || []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : categoriesData.categories || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      handleApiError(error, 'Failed to load data.');
      setProducts([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.category?.name?.toLowerCase().includes(query) ||
        p.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [products, searchQuery]);

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.price || !formData.category) {
      Alert.alert('Error', 'Name, Price, and Category are required.');
      return;
    }

    const isValid = await validateAuthBeforeCall();
    if (!isValid) return;

    try {
      setUploading(true);
      
      const url = editingProduct
        ? `${API_BASE_URL}/api/catalog/products/${editingProduct._id}`
        : `${API_BASE_URL}/api/catalog/products`;

      const method = editingProduct ? 'PUT' : 'POST';

      const submitFormData = new FormData();
      
      submitFormData.append('name', formData.name);
      submitFormData.append('description', formData.description);
      submitFormData.append('price', parseFloat(formData.price).toString());
      submitFormData.append('category', formData.category);
      submitFormData.append('unit', formData.unit);
      submitFormData.append('unitSize', (parseInt(formData.unitSize) || 0).toString());
      submitFormData.append('stock', (parseInt(formData.stock) || 0).toString());
      submitFormData.append('milkType', formData.milkType);
      submitFormData.append('discount', (parseFloat(formData.discount) || 0).toString());
      submitFormData.append('isFeatured', formData.isFeatured.toString());
      submitFormData.append('isAvailable', formData.isAvailable.toString());
      
      if (formData.tags) {
        submitFormData.append('tags', formData.tags);
      }

      if (formData.nutritionalInfo.fat || formData.nutritionalInfo.protein || 
          formData.nutritionalInfo.calories || formData.nutritionalInfo.carbohydrates) {
        Object.keys(formData.nutritionalInfo).forEach(key => {
          submitFormData.append(`nutritionalInfo[${key}]`, 
            (parseFloat(formData.nutritionalInfo[key]) || 0).toString()
          );
        });
      }

      if (formData.image) {
        submitFormData.append('image', {
          uri: formData.image.uri,
          type: formData.image.type || 'image/jpeg',
          name: formData.image.fileName || `product-${Date.now()}.jpg`,
        });
      }

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(true),
        body: submitFormData,
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', `Product ${editingProduct ? 'updated' : 'added'} successfully!`);
        closeModal();
        fetchData();
      } else {
        handleApiError({ message: data.message, response }, data.message || 'Failed to save product.');
      }
    } catch (error) {
      console.error('Submit error:', error);
      handleApiError(error, 'Failed to save product.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (productId) => {
    const isValid = await validateAuthBeforeCall();
    if (!isValid) return;

    Alert.alert(
      'Delete Product',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/catalog/products/${productId}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
              });
              
              if (response.ok) {
                Alert.alert('Success', 'Product deleted.');
                fetchData();
              } else {
                const data = await response.json();
                handleApiError({ message: data.message, response }, data.message || 'Failed to delete.');
              }
            } catch (error) {
              handleApiError(error, 'Failed to delete product.');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      category: product.category?._id || product.category || '',
      unit: product.unit || 'liter',
      unitSize: product.unitSize?.toString() || '',
      stock: product.stock?.toString() || '',
      milkType: product.milkType || 'Cow',
      image: null,
      discount: product.discount?.toString() || '0',
      isFeatured: product.isFeatured || false,
      isAvailable: product.isAvailable !== false,
      nutritionalInfo: product.nutritionalInfo || { fat: '', protein: '', calories: '', carbohydrates: '' },
      tags: product.tags?.join(', ') || (typeof product.tags === 'string' ? product.tags : ''),
    });
    setImageUri(product.image || '');
    setModalVisible(true);
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    resetForm();
    setModalVisible(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      category: '',
      unit: 'liter',
      unitSize: '',
      stock: '',
      milkType: 'Cow',
      image: null,
      discount: '',
      isFeatured: false,
      isAvailable: true,
      nutritionalInfo: { fat: '', protein: '', calories: '', carbohydrates: '' },
      tags: '',
    });
    setImageUri('');
  };

  const closeModal = () => {
    setModalVisible(false);
    resetForm();
    setEditingProduct(null);
  };

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        setFormData({ 
          ...formData, 
          image: {
            uri: selectedImage.uri,
            type: 'image/jpeg',
            fileName: selectedImage.fileName || `image-${Date.now()}.jpg`
          }
        });
        setImageUri(selectedImage.uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const renderProduct = ({ item }) => {
    const isOutOfStock = item.stock <= 0;
    const discount = item.discount > 0 ? `${item.discount}% off` : null;

    return (
      <View style={styles.productCard}>
        <Image
          source={{ uri: item.image || 'https://via.placeholder.com/80' }}
          style={styles.productImage}
          resizeMode="cover"
        />
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.productCategory}>{item.category?.name || 'Uncategorized'}</Text>
          {item.description && (
            <Text style={styles.productDescription} numberOfLines={2} ellipsizeMode='tail'>
              {item.description}
            </Text>
          )}
          <View style={styles.priceRow}>
            <Text style={styles.productPrice}>₹{item.price}</Text>
            {discount && <Text style={styles.discountBadge}>{discount}</Text>}
          </View>
          <Text style={[styles.stockText, isOutOfStock && styles.outOfStockText]}>
            Stock: {item.stock} {item.unit}
          </Text>
        </View>
        <View style={styles.categoryActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => openEditModal(item)}
          >
            <Feather name="edit-2" size={18} color={Colors.light.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDelete(item._id)}
          >
            <Feather name="trash-2" size={18} color="#F44336" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (authLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top * 0.5 }]}>
      {/* Search Bar */}
      <View style={styles.searchFilterContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={Colors.light.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={Colors.light.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Product List */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inventory-2" size={56} color={Colors.light.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No products found' : 'No products yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'Add your first product to get started'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity style={styles.addFirstButton} onPress={openCreateModal}>
                <Text style={styles.addFirstButtonText}>Add Product</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingProduct ? 'Edit Product' : 'Add New Product'}</Text>
              <TouchableOpacity onPress={closeModal}>
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Image Preview */}
              {(imageUri || formData.image) && (
                <View style={styles.imagePreviewContainer}>
                  <Image 
                    source={{ uri: imageUri || formData.image?.uri }} 
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity 
                    style={styles.removeImageButton}
                    onPress={() => {
                      setFormData({...formData, image: null});
                      setImageUri('');
                    }}
                  >
                    <Ionicons name="close" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Name */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.name}
                  onChangeText={(t) => setFormData({ ...formData, name: t })}
                  placeholder="e.g., Fresh Cow Milk"
                />
              </View>

              {/* Description */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={formData.description}
                  onChangeText={(t) => setFormData({ ...formData, description: t })}
                  placeholder="Optional description..."
                  multiline
                />
              </View>

              {/* Category */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat._id}
                      style={[styles.chip, formData.category === cat._id && styles.chipSelected]}
                      onPress={() => setFormData({ ...formData, category: cat._id })}
                    >
                      <Text style={[styles.chipText, formData.category === cat._id && styles.chipTextSelected]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Price & Discount */}
              <View style={styles.row}>
                <View style={styles.inputGroupFlex}>
                  <Text style={styles.inputLabel}>Price (₹) *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.price}
                    onChangeText={(t) => setFormData({ ...formData, price: t })}
                    keyboardType="numeric"
                    placeholder="60"
                  />
                </View>
                <View style={styles.inputGroupFlex}>
                  <Text style={styles.inputLabel}>Discount (%)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.discount}
                    onChangeText={(t) => setFormData({ ...formData, discount: t })}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
              </View>

              {/* Unit & Size */}
              <View style={styles.row}>
                <View style={styles.inputGroupFlex}>
                  <Text style={styles.inputLabel}>Unit</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {['ml', 'liter', 'gm', 'kg', 'pack', 'piece'].map((u) => (
                      <TouchableOpacity
                        key={u}
                        style={[styles.chip, formData.unit === u && styles.chipSelected]}
                        onPress={() => setFormData({ ...formData, unit: u })}
                      >
                        <Text style={[styles.chipText, formData.unit === u && styles.chipTextSelected]}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.inputGroupFlex}>
                  <Text style={styles.inputLabel}>Size</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.unitSize}
                    onChangeText={(t) => setFormData({ ...formData, unitSize: t })}
                    keyboardType="numeric"
                    placeholder="1"
                  />
                </View>
              </View>

              {/* Stock & Milk Type */}
              <View style={styles.row}>
                <View style={styles.inputGroupFlex}>
                  <Text style={styles.inputLabel}>Stock</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.stock}
                    onChangeText={(t) => setFormData({ ...formData, stock: t })}
                    keyboardType="numeric"
                    placeholder="100"
                  />
                </View>
                <View style={styles.inputGroupFlex}>
                  <Text style={styles.inputLabel}>Milk Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {['Cow', 'Buffalo', 'Mixed', 'None'].map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.chip, formData.milkType === t && styles.chipSelected]}
                        onPress={() => setFormData({ ...formData, milkType: t })}
                      >
                        <Text style={[styles.chipText, formData.milkType === t && styles.chipTextSelected]}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Image Upload */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Image</Text>
                <TouchableOpacity style={styles.imageUploadButton} onPress={pickImage}>
                  <Ionicons name="camera" size={24} color={Colors.light.accent} />
                  <Text style={styles.imageUploadText}>
                    {formData.image ? 'Change Image' : 'Select Image from Gallery'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Toggles */}
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={styles.toggle}
                  onPress={() => setFormData({ ...formData, isFeatured: !formData.isFeatured })}
                >
                  <View style={[styles.checkbox, formData.isFeatured && styles.checkboxChecked]}>
                    {formData.isFeatured && <Ionicons name="checkmark" size={16} color="#FFF" />}
                  </View>
                  <Text style={styles.toggleLabel}>Featured</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.toggle}
                  onPress={() => setFormData({ ...formData, isAvailable: !formData.isAvailable })}
                >
                  <View style={[styles.checkbox, formData.isAvailable && styles.checkboxChecked]}>
                    {formData.isAvailable && <Ionicons name="checkmark" size={16} color="#FFF" />}
                  </View>
                  <Text style={styles.toggleLabel}>Available</Text>
                </TouchableOpacity>
              </View>

              {/* Nutrition */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Nutrition (per 100{formData.unit})</Text>
                <View style={styles.nutritionGrid}>
                  {['fat', 'protein', 'calories', 'carbohydrates'].map((key) => (
                    <View key={key} style={styles.nutritionInput}>
                      <Text style={styles.nutritionLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                      <TextInput
                        style={styles.nutritionTextInput}
                        value={formData.nutritionalInfo[key]}
                        onChangeText={(t) => setFormData({
                          ...formData,
                          nutritionalInfo: { ...formData.nutritionalInfo, [key]: t }
                        })}
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                  ))}
                </View>
              </View>

              {/* Tags */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tags (comma separated)</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.tags}
                  onChangeText={(t) => setFormData({ ...formData, tags: t })}
                  placeholder="organic, fresh, premium"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeModal} disabled={uploading}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitButton, uploading && styles.submitButtonDisabled]} 
                onPress={handleSubmit}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingProduct ? 'Update' : 'Add'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  searchFilterContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.light.background,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.light.text,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  productCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  discountBadge: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  stockText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  outOfStockText: {
    color: '#F44336',
    fontWeight: '600',
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  editButton: {
    backgroundColor: '#E8F5E9',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: Colors.light.accent,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 8,
    textAlign: 'center',
    marginBottom: 24,
  },
  addFirstButton: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '95%',
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
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupFlex: {
    flex: 1,
    marginBottom: 16,
    paddingHorizontal: 6,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  chipScroll: {
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: Colors.light.accent,
  },
  chipText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  chipTextSelected: {
    color: '#FFF',
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.light.border,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.accent,
  },
  toggleLabel: {
    fontSize: 14,
    color: Colors.light.text,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  nutritionInput: {
    flex: 1,
    minWidth: '45%',
  },
  nutritionLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  nutritionTextInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
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
  imagePreviewContainer: {
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#F44336',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#F9F9F9',
  },
  imageUploadText: {
    marginLeft: 8,
    fontSize: 16,
    color: Colors.light.accent,
    fontWeight: '600',
  },
});