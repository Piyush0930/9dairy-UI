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
  const { getAuthHeaders } = useAuth();
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    image: '',
    displayOrder: 0,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    filterCategories();
  }, [categories, searchQuery, activeFilter]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/categories`, {
        headers: await getAuthHeaders(),
      });
      const data = await response.json();

      if (response.ok && Array.isArray(data)) {
        setCategories(data);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      Alert.alert('Error', 'Failed to load categories.');
      setCategories([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterCategories = useCallback(() => {
    let filtered = categories;

    if (activeFilter === 'active') {
      filtered = filtered.filter(cat => cat.isActive !== false);
    } else if (activeFilter === 'inactive') {
      filtered = filtered.filter(cat => cat.isActive === false);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(cat =>
        cat.name.toLowerCase().includes(query) ||
        (cat.description && cat.description.toLowerCase().includes(query))
      );
    }

    setFilteredCategories(filtered);
  }, [categories, searchQuery, activeFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCategories();
  }, []);

  const validateForm = () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Category name is required.');
      return false;
    }
    if (formData.name.trim().length < 2) {
      Alert.alert('Error', 'Category name must be at least 2 characters.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Category name is required.');
      return;
    }

    try {
      const url = editingCategory
        ? `${API_BASE_URL}/categories/${editingCategory._id}`
        : `${API_BASE_URL}/categories`;

      const method = editingCategory ? 'PUT' : 'POST';

      let response;
      const headers = getAuthHeaders();

      // Check if we have a local image URI (from image picker)
      if (formData.image && formData.image.startsWith('file://')) {
        // Use FormData for file upload
        const formDataToSend = new FormData();

        // Add text fields
        formDataToSend.append('name', formData.name);
        formDataToSend.append('description', formData.description || '');
        formDataToSend.append('displayOrder', formData.displayOrder.toString());

        // Add image file (React Native way)
        const fileName = `category-image-${Date.now()}.jpg`;
        formDataToSend.append('image', {
          uri: formData.image,
          type: 'image/jpeg',
          name: fileName,
        });

        response = await fetch(url, {
          method,
          headers, // Auth headers only, no Content-Type for FormData
          body: formDataToSend,
        });
      } else {
        // Use JSON for text-only updates (no image change)
        const jsonData = {
          name: formData.name,
          description: formData.description || '',
          displayOrder: parseInt(formData.displayOrder) || 0,
        };

        // Only include image if it's a URL (not local URI)
        if (formData.image && !formData.image.startsWith('file://')) {
          jsonData.image = formData.image;
        }

        response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify(jsonData),
        });
      }

      const data = await response.json();

      if (response.ok && data.success !== false) {
        Alert.alert('Success', `Category ${editingCategory ? 'updated' : 'created'} successfully!`);
        closeModal();
        fetchCategories();
      } else {
        Alert.alert('Error', data.message || 'Failed to save category.');
      }
    } catch (error) {
      Alert.alert('Error', error.message === 'Network request failed'
        ? 'Check your connection and try again.'
        : 'Failed to save category.'
      );
    }
  };

  const handleDelete = async (categoryId, categoryName) => {
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
                headers: await getAuthHeaders(),
              });
              if (response.ok) {
                Alert.alert('Success', 'Category deleted.');
                fetchCategories();
              } else {
                const data = await response.json();
                Alert.alert('Error', data.message || 'Failed to delete.');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete category.');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
      image: category.image || '',
      displayOrder: category.displayOrder || 0,
    });
    setModalVisible(true);
  };

  const openCreateModal = () => {
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

  const pickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permissionResult.granted === false) {
        Alert.alert('Permission required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFormData({ ...formData, image: result.assets[0].uri });
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setModalVisible(false);
    resetForm();
    setEditingCategory(null);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingText}>Loading categories...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Search & Filter Bar */}
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
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'all' && styles.filterButtonActive]}
          onPress={() => setActiveFilter('all')}
        >
          <Text style={[styles.filterButtonText, activeFilter === 'all' && styles.filterButtonTextActive]}>
            All ({categories.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'active' && styles.filterButtonActive]}
          onPress={() => setActiveFilter('active')}
        >
          <Text style={[styles.filterButtonText, activeFilter === 'active' && styles.filterButtonTextActive]}>
            Active ({categories.filter(c => c.isActive !== false).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'inactive' && styles.filterButtonActive]}
          onPress={() => setActiveFilter('inactive')}
        >
          <Text style={[styles.filterButtonText, activeFilter === 'inactive' && styles.filterButtonTextActive]}>
            Inactive ({categories.filter(c => c.isActive === false).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Categories List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredCategories.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="category" size={56} color={Colors.light.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery ? 'No categories found' : 'No categories yet'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? 'Try a different search' : 'Create your first category'}
            </Text>
            {!searchQuery && activeFilter === 'all' && (
              <TouchableOpacity style={styles.createFirstButton} onPress={openCreateModal}>
                <Text style={styles.createFirstButtonText}>Create Category</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredCategories.map((category) => (
            <View key={category._id} style={styles.categoryCard}>
              <View style={styles.categoryImageContainer}>
                {category.image ? (
                  <Image source={{ uri: category.image }} style={styles.categoryImage} />
                ) : (
                  <View style={styles.categoryImagePlaceholder}>
                    <MaterialIcons name="image" size={24} color={Colors.light.textSecondary} />
                  </View>
                )}
              </View>

              <View style={styles.categoryContent}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryName} numberOfLines={1}>
                    {category.name}
                  </Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryOrderText}>#{category.displayOrder || 0}</Text>
                  </View>
                </View>

                {category.description && (
                  <Text style={styles.categoryDescription} numberOfLines={2}>
                    {category.description}
                  </Text>
                )}

                <View style={styles.categoryMeta}>
                  <View style={styles.metaItem}>
                    <Ionicons name="time-outline" size={14} color={Colors.light.textSecondary} />
                    <Text style={styles.metaText}>
                      {new Date(category.createdAt || Date.now()).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  <View style={[styles.statusIndicator, category.isActive !== false && styles.statusActive]}>
                    <View style={[styles.statusDot, category.isActive !== false && styles.statusDotActive]} />
                    <Text style={styles.statusText}>
                      {category.isActive !== false ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.categoryActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() => openEditModal(category)}
                >
                  <Feather name="edit-2" size={18} color={Colors.light.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => handleDelete(category._id, category.name)}
                >
                  <Feather name="trash-2" size={18} color="#F44336" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* Create/Edit Modal */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCategory ? 'Edit Category' : 'Create Category'}
              </Text>
              <TouchableOpacity onPress={closeModal} disabled={submitting}>
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category Name <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={[styles.textInput, formData.name.trim() && styles.inputValid]}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholder="Enter category name"
                  editable={!submitting}
                />
                <Text style={styles.charCount}>{formData.name.length}/50</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  placeholder="Optional description..."
                  multiline
                  numberOfLines={4}
                  editable={!submitting}
                />
                <Text style={styles.charCount}>{formData.description.length}/200</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Image</Text>
                <View style={styles.imageInputContainer}>
                  <TextInput
                    style={[styles.textInput, styles.imageInput]}
                    value={formData.image}
                    onChangeText={(text) => setFormData({ ...formData, image: text })}
                    placeholder="https://... or select from gallery"
                    editable={!submitting}
                  />
                  <TouchableOpacity style={styles.imagePickerButton} onPress={pickImage}>
                    <Ionicons name="image" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
                {formData.image && (
                  <View style={styles.imagePreview}>
                    <Image source={{ uri: formData.image }} style={styles.previewImage} />
                  </View>
                )}
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
                  editable={!submitting}
                />
                <Text style={styles.helperText}>Lower numbers appear first</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, submitting && styles.buttonDisabled]}
                onPress={closeModal}
                disabled={submitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, submitting && styles.buttonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingCategory ? 'Update' : 'Create'}
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
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: Colors.light.accent,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  filterButtonTextActive: {
    color: '#FFF',
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 16,
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
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: Colors.light.accent + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  categoryOrderText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.accent,
  },
  categoryDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    lineHeight: 20,
    marginBottom: 8,
  },
  categoryMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F44336',
  },
  statusDotActive: {
    backgroundColor: Colors.light.accent,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  categoryActions: {
    flexDirection: 'row',
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
    backgroundColor: Colors.light.accent + '20',
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
  },
  createFirstButton: {
    backgroundColor: Colors.light.accent,
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
  imagePreview: {
    marginTop: 12,
    alignItems: 'center',
  },
  previewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
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
    borderRadius: 8,
    paddingVertical: 14,
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
    borderRadius: 8,
    paddingVertical: 14,
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
    padding: 10,
    borderRadius: 6,
  },
});
