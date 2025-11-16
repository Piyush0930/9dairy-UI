import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/catalog`;

export default function CategoriesManagement() {
  const insets = useSafeAreaInsets();
  const { 
    authToken, 
    isLoading: authLoading, 
    isAuthenticated, 
    validateToken,
    logout 
  } = useAuth();
  
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    displayOrder: 0,
  });

  // Debug logging
  useEffect(() => {
    console.log('🔍 CategoriesManagement Mounted');
    console.log('🔐 Auth State:', { authToken: !!authToken, isAuthenticated, authLoading });
  }, []);

  // Enhanced API error handler
  const handleApiError = (error, customMessage = null) => {
    console.error('API Error:', error);
    
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

  // Add token validation before API calls
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

  // Fix: Simplified and more robust fetch function
  const fetchCategories = async () => {
    console.log('🔄 fetchCategories called');
    
    try {
      // Don't validate auth here to avoid blocking the load
      if (!authToken) {
        console.log('❌ No auth token available');
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setLoading(true);
      console.log('📡 Fetching categories from:', `${API_BASE_URL}/categories`);
      
      const response = await fetch(`${API_BASE_URL}/categories`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
      });

      console.log('📨 Response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Categories data received:', data?.length || 0, 'items');

      // Handle different response formats
      if (Array.isArray(data)) {
        setCategories(data);
        setFilteredCategories(data);
      } else if (data.categories && Array.isArray(data.categories)) {
        setCategories(data.categories);
        setFilteredCategories(data.categories);
      } else {
        console.warn('⚠️ Unexpected response format:', data);
        setCategories([]);
        setFilteredCategories([]);
      }

    } catch (error) {
      console.error('❌ Error fetching categories:', error);
      setCategories([]);
      setFilteredCategories([]);
      
      // Only show alert for non-auth errors
      if (!error.message?.includes('401') && !error.message?.includes('Unauthorized')) {
        Alert.alert("Error", "Failed to load categories. Please check your connection.");
      }
    } finally {
      console.log('🏁 fetchCategories completed');
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fix: Simplified useEffect dependencies
  useEffect(() => {
    console.log('🎯 Main useEffect triggered', { 
      authLoading, 
      hasAuthToken: !!authToken, 
      isAuthenticated 
    });

    if (authLoading) {
      console.log('⏳ Still loading auth...');
      return;
    }

    if (authToken && isAuthenticated) {
      console.log('✅ Auth valid, fetching categories...');
      fetchCategories();
    } else {
      console.log('❌ Auth invalid, stopping load');
      setLoading(false);
      setCategories([]);
      setFilteredCategories([]);
    }
  }, [authToken, authLoading, isAuthenticated]); // Remove fetchCategories from dependencies

  // Fix: useCallback for filterCategories
  const filterCategories = useCallback(() => {
    console.log('🔍 Filtering categories, query:', searchQuery);
    
    if (!searchQuery.trim()) {
      setFilteredCategories(categories);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = categories.filter(cat =>
      cat.name?.toLowerCase().includes(query) ||
      cat.description?.toLowerCase().includes(query)
    );
    
    setFilteredCategories(filtered);
    console.log('✅ Filtered to', filtered.length, 'categories');
  }, [categories, searchQuery]);

  // Apply filter when categories or search query changes
  useEffect(() => {
    filterCategories();
  }, [filterCategories]);

  const onRefresh = useCallback(() => {
    console.log('🔄 Manual refresh triggered');
    setRefreshing(true);
    fetchCategories();
  }, []);

  // Fix: Form validation
  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Category name is required.');
      return false;
    }
    if (formData.name.trim().length < 2) {
      Alert.alert('Validation Error', 'Category name must be at least 2 characters.');
      return false;
    }
    return true;
  };

  // Fix: Handle submit with better error handling
  const handleSubmit = async () => {
    if (!validateForm()) return;

    const isValid = await validateAuthBeforeCall();
    if (!isValid) return;

    setIsSubmitting(true);

    try {
      const url = editingCategory
        ? `${API_BASE_URL}/categories/${editingCategory._id}`
        : `${API_BASE_URL}/categories`;

      const method = editingCategory ? 'PUT' : 'POST';

      let response;

      const isLocalImage = formData.image && (
        formData.image.startsWith('file://') ||
        formData.image.startsWith('content://') ||
        formData.image.includes('ph://')
      );

      if (isLocalImage) {
        const form = new FormData();
        form.append('name', formData.name.trim());
        form.append('description', formData.description?.trim() || '');
        form.append('displayOrder', formData.displayOrder.toString());

        let imageUri = formData.image;
        if (Platform.OS === 'android' && !imageUri.startsWith('file://') && !imageUri.startsWith('content://')) {
          imageUri = `file://${imageUri}`;
        }

        const filename = imageUri.split('/').pop() || `image-${Date.now()}.jpg`;
        let type = 'image/jpeg';

        form.append('image', {
          uri: imageUri,
          name: filename,
          type,
        });

        response = await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
          body: form,
        });
      } else {
        const payload = {
          name: formData.name.trim(),
          description: formData.description?.trim() || '',
          displayOrder: formData.displayOrder,
        };

        if (formData.image && formData.image.startsWith('http')) {
          payload.image = formData.image;
        }

        response = await fetch(url, {
          method,
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      }

      let data = {};
      try {
        data = await response.json();
      } catch (e) {
        data = { message: 'Invalid response' };
      }

      if (response.ok) {
        Alert.alert('Success', `Category ${editingCategory ? 'updated' : 'created'} successfully!`);
        closeModal();
        fetchCategories();
      } else {
        handleApiError({ message: data.message, response }, data.message || `Server error: ${response.status}`);
      }
    } catch (error) {
      console.error('Submit error:', error);
      handleApiError(error, 'Failed to save category. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (categoryId, categoryName) => {
    const isValid = await validateAuthBeforeCall();
    if (!isValid) return;

    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${categoryName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/categories/${categoryId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json'
                },
              });
              
              if (response.ok) {
                Alert.alert('Success', 'Category deleted successfully.');
                fetchCategories();
              } else {
                const data = await response.json();
                handleApiError({ message: data.message, response }, data.message || 'Failed to delete category.');
              }
            } catch (error) {
              handleApiError(error, 'Failed to delete category.');
            }
          },
        },
      ]
    );
  };

  // Fix: Modal functions
  const openEditModal = (category) => {
    console.log('✏️ Opening edit modal for:', category.name);
    setEditingCategory(category);
    setFormData({
      name: category.name || '',
      description: category.description || '',
      image: category.image || '',
      displayOrder: category.displayOrder || 0,
    });
    setModalVisible(true);
  };

  const openCreateModal = () => {
    console.log('➕ Opening create modal');
    setEditingCategory(null);
    resetForm();
    setModalVisible(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      image: '',
      displayOrder: 0,
    });
  };

  const closeModal = () => {
    if (isSubmitting) return;
    console.log('❌ Closing modal');
    setModalVisible(false);
    resetForm();
    setEditingCategory(null);
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setFormData(prev => ({ ...prev, image: result.assets[0].uri }));
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Could not select image. Please try again.');
    }
  };

  // Debug loading states
  console.log('📊 Current state:', { 
    loading, 
    authLoading, 
    categoriesCount: categories.length,
    filteredCount: filteredCategories.length 
  });

  // Loading states
  if (authLoading) {
    console.log('🔄 Showing auth loading...');
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingText}>Checking authentication...</Text>
      </View>
    );
  }

  if (loading) {
    console.log('🔄 Showing categories loading...');
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  console.log('✅ Rendering main content...');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* PROFESSIONAL HEADER */}
      <View style={styles.professionalHeader}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Categories</Text>
          <Text style={styles.headerSubtitle}>
            {filteredCategories.length} {filteredCategories.length === 1 ? 'category' : 'categories'}
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchFilterContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color={Colors.light.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search categories..."
            placeholderTextColor={Colors.light.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Categories List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[Colors.light.accent]} 
            tintColor={Colors.light.accent}
          />
        }
      >
        {filteredCategories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="category" size={56} color={Colors.light.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No categories found' : 'No categories yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search term' : 'Create your first category to get started'}
            </Text>
            {!searchQuery && (
              <TouchableOpacity style={styles.createFirstButton} onPress={openCreateModal}>
                <Text style={styles.createFirstButtonText}>Create Category</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredCategories.map((category) => (
            <TouchableOpacity 
              key={category._id} 
              style={styles.categoryCard}
              onPress={() => openEditModal(category)}
              activeOpacity={0.7}
            >
              <View style={styles.categoryImageContainer}>
                {category.image ? (
                  <Image source={{ uri: category.image }} style={styles.categoryImage} />
                ) : (
                  <View style={styles.categoryImagePlaceholder}>
                    <MaterialIcons name="category" size={24} color={Colors.light.textSecondary} />
                  </View>
                )}
              </View>

              <View style={styles.categoryContent}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {category.name}
                  </Text>
                  <View style={styles.orderBadge}>
                    <Text style={styles.orderBadgeText}>#{category.displayOrder || 0}</Text>
                  </View>
                </View>

                {category.description ? (
                  <Text style={styles.categoryDescription} numberOfLines={2}>
                    {category.description}
                  </Text>
                ) : (
                  <Text style={styles.noDescriptionText}>No description</Text>
                )}
              </View>

              <View style={styles.categoryActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    openEditModal(category);
                  }}
                >
                  <Feather name="edit-2" size={18} color={Colors.light.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDelete(category._id, category.name);
                  }}
                >
                  <Feather name="trash-2" size={18} color="#F44336" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* Modal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCategory ? 'Edit Category' : 'Create New Category'}
              </Text>
              <TouchableOpacity onPress={closeModal} disabled={isSubmitting}>
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Image Preview */}
              {formData.image && (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: formData.image }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setFormData({ ...formData, image: '' })}
                    disabled={isSubmitting}
                  >
                    <Ionicons name="close" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category Name <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={[styles.textInput, formData.name.trim() && styles.inputValid]}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="e.g., Dairy Products, Fresh Milk"
                  editable={!isSubmitting}
                />
                <Text style={styles.charCount}>{formData.name.length}/50</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Optional category description..."
                  multiline
                  numberOfLines={4}
                  editable={!isSubmitting}
                />
                <Text style={styles.charCount}>{formData.description.length}/200</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category Image</Text>
                <View style={styles.imageInputContainer}>
                  <TextInput
                    style={[styles.textInput, styles.imageInput]}
                    value={formData.image}
                    onChangeText={(text) => setFormData({ ...formData, image: text })}
                    placeholder="Image URL or select from gallery"
                    editable={!isSubmitting}
                  />
                  <TouchableOpacity 
                    style={styles.imagePickerButton} 
                    onPress={pickImage} 
                    disabled={isSubmitting}
                  >
                    <Ionicons name="image" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Display Order</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.displayOrder.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setFormData({ ...formData, displayOrder: Math.max(0, num) });
                  }}
                  placeholder="0"
                  keyboardType="numeric"
                  editable={!isSubmitting}
                />
                <Text style={styles.helperText}>Lower numbers appear first in listings</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, isSubmitting && styles.buttonDisabled]}
                onPress={closeModal}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, isSubmitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={isSubmitting || !formData.name.trim()}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingCategory ? 'Update Category' : 'Create Category'}
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

// Keep your existing styles exactly as they were
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
  professionalHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    minHeight: 72,
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '500',
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.light.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  categoryCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryContent: {
    flex: 1,
    marginRight: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
    marginRight: 8,
  },
  orderBadge: {
    backgroundColor: Colors.light.accent + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.accent,
  },
  categoryDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    marginBottom: 8,
  },
  noDescriptionText: {
    fontSize: 13,
    color: Colors.light.textTertiary,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  categoryActions: {
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#E3F2FD',
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
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
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
    paddingHorizontal: 32,
  },
  createFirstButton: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  createFirstButtonText: {
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
  imagePreviewContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
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
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  required: {
    color: '#F44336',
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
  inputValid: {
    borderColor: Colors.light.accent,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'right',
    marginTop: 4,
  },
  helperText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  imageInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageInput: {
    flex: 1,
  },
  imagePickerButton: {
    marginLeft: 8,
    backgroundColor: Colors.light.accent,
    padding: 12,
    borderRadius: 8,
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
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});