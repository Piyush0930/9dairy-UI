import Colors from '@/constants/colors';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

const API_BASE_URL = 'http://10.55.13.5:5000/api/catalog'; // Adjust this to your backend URL

export default function ProductsManagement() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    unit: 'gm',
    unitSize: '',
    stock: '',
    milkType: 'Cow',
    image: '',
    discount: '',
    isFeatured: false,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, categoriesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/products`),
        fetch(`${API_BASE_URL}/categories`),
      ]);

      const productsData = await productsRes.json();
      const categoriesData = await categoriesRes.json();

      if (productsData.success !== false) {
        setProducts(productsData.products || productsData);
      } else {
        setProducts([]);
      }

      if (categoriesData.success !== false) {
        setCategories(categoriesData);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      if (error.message === 'Network request failed') {
        Alert.alert('Network Error', 'Please check your internet connection and try again.');
      } else {
        Alert.alert('Error', 'Failed to fetch data');
      }
      setProducts([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.price || !formData.category) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    try {
      const url = editingProduct
        ? `${API_BASE_URL}/products/${editingProduct._id}`
        : `${API_BASE_URL}/products`;

      const method = editingProduct ? 'PUT' : 'POST';

      const submitData = {
        ...formData,
        price: parseFloat(formData.price),
        unitSize: parseInt(formData.unitSize),
        stock: parseInt(formData.stock),
        discount: parseFloat(formData.discount) || 0,
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', `Product ${editingProduct ? 'updated' : 'created'} successfully`);
        setModalVisible(false);
        resetForm();
        fetchData();
      } else {
        Alert.alert('Error', data.message || 'Something went wrong');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      if (error.message === 'Network request failed') {
        Alert.alert('Network Error', 'Please check your internet connection and try again.');
      } else {
        Alert.alert('Error', 'Failed to save product');
      }
    }
  };

  const handleDelete = async (productId) => {
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/products/${productId}`, {
                method: 'DELETE',
              });

              if (response.ok) {
                Alert.alert('Success', 'Product deleted successfully');
                fetchData();
              } else {
                const data = await response.json();
                Alert.alert('Error', data.message || 'Failed to delete product');
              }
            } catch (error) {
              console.error('Error deleting product:', error);
              if (error.message === 'Network request failed') {
                Alert.alert('Network Error', 'Please check your internet connection and try again.');
              } else {
                Alert.alert('Error', 'Failed to delete product');
              }
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
      category: product.category._id,
      unit: product.unit,
      unitSize: product.unitSize.toString(),
      stock: product.stock.toString(),
      milkType: product.milkType,
      image: product.image || '',
      discount: product.discount.toString(),
      isFeatured: product.isFeatured,
    });
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
      unit: 'gm',
      unitSize: '',
      stock: '',
      milkType: 'Cow',
      image: '',
      discount: '',
      isFeatured: false,
    });
  };

  const closeModal = () => {
    setModalVisible(false);
    resetForm();
    setEditingProduct(null);
  };

  const renderProduct = ({ item }) => (
    <View style={styles.productCard}>
      <Image
        source={{ uri: item.image || 'https://via.placeholder.com/100' }}
        style={styles.productImage}
        resizeMode="cover"
      />
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productPrice}>₹{item.price}</Text>
        <Text style={styles.productStock}>Stock: {item.stock}</Text>
        <Text style={styles.productCategory}>{item.category?.name}</Text>
      </View>
      <View style={styles.productActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <MaterialIcons name="edit" size={20} color="#2196F3" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item._id)}
        >
          <MaterialIcons name="delete" size={20} color="#F44336" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading products...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Products Management</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => router.push('/(admin)/categories')}>
            <MaterialIcons name="category" size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={openCreateModal}>
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="inventory" size={64} color="#CCC" />
            <Text style={styles.emptyStateText}>No products found</Text>
            <Text style={styles.emptyStateSubtext}>Create your first product to get started</Text>
            <TouchableOpacity style={styles.createFirstButton} onPress={openCreateModal}>
              <Text style={styles.createFirstButtonText}>Create Product</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProduct ? 'Edit Product' : 'Create Product'}
              </Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Enter product name"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Enter product description"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                  {categories.map((category) => (
                    <TouchableOpacity
                      key={category._id}
                      style={[
                        styles.categoryChip,
                        formData.category === category._id && styles.categoryChipSelected,
                      ]}
                      onPress={() => setFormData({ ...formData, category: category._id })}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          formData.category === category._id && styles.categoryChipTextSelected,
                        ]}
                      >
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Price *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.price}
                    onChangeText={(text) => setFormData({ ...formData, price: text })}
                    placeholder="0.00"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Discount (%)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.discount}
                    onChangeText={(text) => setFormData({ ...formData, discount: text })}
                    placeholder="0"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.inputLabel}>Unit</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.unitScroll}>
                    {['ml', 'liter', 'gm', 'kg', 'pack', 'piece'].map((unit) => (
                      <TouchableOpacity
                        key={unit}
                        style={[
                          styles.unitChip,
                          formData.unit === unit && styles.unitChipSelected,
                        ]}
                        onPress={() => setFormData({ ...formData, unit: unit })}
                      >
                        <Text
                          style={[
                            styles.unitChipText,
                            formData.unit === unit && styles.unitChipTextSelected,
                          ]}
                        >
                          {unit}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.inputLabel}>Unit Size</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formData.unitSize}
                    onChangeText={(text) => setFormData({ ...formData, unitSize: text })}
                    placeholder="500"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Stock</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.stock}
                  onChangeText={(text) => setFormData({ ...formData, stock: text })}
                  placeholder="100"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Milk Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.milkTypeScroll}>
                  {['Cow', 'Buffalo', 'Mixed', 'None'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.milkTypeChip,
                        formData.milkType === type && styles.milkTypeChipSelected,
                      ]}
                      onPress={() => setFormData({ ...formData, milkType: type })}
                    >
                      <Text
                        style={[
                          styles.milkTypeChipText,
                          formData.milkType === type && styles.milkTypeChipTextSelected,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Image URL</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.image}
                  onChangeText={(text) => setFormData({ ...formData, image: text })}
                  placeholder="Enter image URL"
                  placeholderTextColor="#999"
                />
              </View>

              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setFormData({ ...formData, isFeatured: !formData.isFeatured })}
              >
                <View style={[styles.checkbox, formData.isFeatured && styles.checkboxChecked]}>
                  {formData.isFeatured && <Ionicons name="checkmark" size={16} color="#FFF" />}
                </View>
                <Text style={styles.checkboxLabel}>Featured Product</Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                <Text style={styles.submitButtonText}>
                  {editingProduct ? 'Update' : 'Create'}
                </Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 8,
    marginLeft: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  createFirstButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
  },
  createFirstButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
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
    width: 60,
    height: 60,
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
  },
  productPrice: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
    marginTop: 2,
  },
  productStock: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  productCategory: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  productActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: '#E3F2FD',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    width: '95%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  modalBody: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
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
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
  },
  categoryScroll: {
    maxHeight: 50,
  },
  categoryChip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  categoryChipTextSelected: {
    color: '#FFF',
  },
  unitScroll: {
    maxHeight: 50,
  },
  unitChip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  unitChipSelected: {
    backgroundColor: Colors.primary,
  },
  unitChipText: {
    fontSize: 12,
    color: Colors.light.text,
  },
  unitChipTextSelected: {
    color: '#FFF',
  },
  milkTypeScroll: {
    maxHeight: 50,
  },
  milkTypeChip: {
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  milkTypeChipSelected: {
    backgroundColor: Colors.primary,
  },
  milkTypeChipText: {
    fontSize: 12,
    color: Colors.light.text,
  },
  milkTypeChipTextSelected: {
    color: '#FFF',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: Colors.light.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    color: Colors.light.text,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginRight: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.light.text,
  },
  submitButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 12,
    marginLeft: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFF',
  },
});
