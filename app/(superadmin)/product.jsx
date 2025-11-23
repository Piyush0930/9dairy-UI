import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const defaultCategoryForm = {
  name: '',
  description: '',
  image: '',
  displayOrder: 0,
};

export default function ProductsManagement() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    authToken,
    isLoading: authLoading,
    isAuthenticated,
    validateToken,
    logout,
  } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Categories Modal State
  const [categoriesModalVisible, setCategoriesModalVisible] = useState(false);
  const [categoryFormModalVisible, setCategoryFormModalVisible] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    image: '',
    displayOrder: 0,
  });
  const [editingCategory, setEditingCategory] = useState(null);
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);

  // Barcode Modal & Camera
  const [barcodeModalVisible, setBarcodeModalVisible] = useState(false);
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState(null);
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef();
  const viewShotRef = useRef();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: '',
    unit: 'piece',
    unitSize: '',
    milkType: 'Cow',
    image: null,
    discount: '',
    isFeatured: false,
    isAvailable: true,
    nutritionalInfo: { fat: '', protein: '', calories: '', carbohydrates: '' },
    tags: '',
    scannedBarcodeId: '',
    cloudinaryImages: []
  });
  const [imageUri, setImageUri] = useState('');

  // OpenFoodFacts Integration States
  const [barcodeScannerVisible, setBarcodeScannerVisible] = useState(false);
  const [productDataPreviewVisible, setProductDataPreviewVisible] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [fetchedProductData, setFetchedProductData] = useState(null);
  const [fetchingProductData, setFetchingProductData] = useState(false);
  const [applyingProductData, setApplyingProductData] = useState(false);
  const [autoFilledFields, setAutoFilledFields] = useState(new Set());

  // Enhanced loading states
  const [imageLoading, setImageLoading] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState(0);
  const [operationInProgress, setOperationInProgress] = useState('');

  // ──────────────────────────────────────────────────────────────
  // LOADING & PROGRESS HELPERS
  // ──────────────────────────────────────────────────────────────
  const startOperation = (operationName) => {
    setOperationInProgress(operationName);
    setSubmissionProgress(0);
  };

  const updateProgress = (progress) => {
    setSubmissionProgress(progress);
  };

  const endOperation = () => {
    setOperationInProgress('');
    setSubmissionProgress(0);
  };

  const showLoadingAlert = (title, message) => {
    Alert.alert(title, message, [], { cancelable: false });
  };

  // ──────────────────────────────────────────────────────────────
  // PULL TO REFRESH
  // ──────────────────────────────────────────────────────────────
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // ──────────────────────────────────────────────────────────────
  // CATEGORIES MANAGEMENT FUNCTIONS
  // ──────────────────────────────────────────────────────────────
  const fetchCategories = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/catalog/categories`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch categories');
    }

    const data = await response.json();
    const categoriesArray = Array.isArray(data) ? data : data.categories || [];
    setCategories(categoriesArray);
    return categoriesArray; // Return the categories for auto-selection
  } catch (error) {
    console.error('Error fetching categories:', error);
    setCategories([]);
    return [];
  }
};

  const openCategoryCreateModal = () => {
    setEditingCategory(null);
    setCategoryFormData({
      name: '',
      description: '',
      image: '',
      displayOrder: categories.length,
    });
    setCategoryFormModalVisible(true);
  };

  const openCategoryEditModal = (category) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name || '',
      description: category.description || '',
      image: category.image || '',
      displayOrder: category.displayOrder || 0,
    });
    setCategoryFormModalVisible(true);
  };

  const closeCategoryModal = () => {
    setCategoriesModalVisible(false);
    setEditingCategory(null);
  };

  const closeCategoryFormModal = () => {
    setCategoryFormModalVisible(false);
    setEditingCategory(null);
    setCategoryFormData({
      name: '',
      description: '',
      image: '',
      displayOrder: 0,
    });
  };

  const handleCategorySubmit = async (formValuesFromChild) => {
  const formData = formValuesFromChild ?? categoryFormData;

  if (!formData.name.trim()) {
    Alert.alert('Error', 'Category name is required.');
    return;
  }

  const isValid = await validateAuthBeforeCall();
  if (!isValid) return;

  setIsSubmittingCategory(true);

  try {
    const body = new FormData();
    body.append('name', formData.name.trim());
    body.append('description', formData.description?.trim() || '');
    body.append('displayOrder', String(formData.displayOrder ?? 0));

    if (formData.image && formData.image.startsWith('file:')) {
      body.append('image', {
        uri: formData.image,
        type: 'image/jpeg',
        name: `category-${Date.now()}.jpg`,
      });
    }

    const url = editingCategory
      ? `${API_BASE_URL}/api/superadmin/categories/${editingCategory._id}`
      : `${API_BASE_URL}/api/superadmin/categories`;

    const method = editingCategory ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${authToken}`,
      },
      body,
    });

    const data = await response.json();

    if (response.ok) {
      Alert.alert(
        'Success',
        `Category ${editingCategory ? 'updated' : 'created'} successfully!`
      );
      
      // Refresh categories list
      await fetchCategories();
      
      // If we're creating a new category from the product form, auto-select it
      if (!editingCategory && modalVisible) {
        // The new category should be the last one in the list (or we can get it from response if available)
        const newCategories = await fetchCategories();
        if (newCategories.length > 0) {
          const newCategory = newCategories[newCategories.length - 1];
          setFormData(prev => ({ ...prev, category: newCategory._id }));
        }
      }
      
      closeCategoryFormModal();
    } else {
      throw new Error(data.message || 'Failed to save category');
    }
  } catch (error) {
    console.error('Category submit error:', error);
    Alert.alert(
      'Error',
      error.message || 'Failed to save category. Please try again.'
    );
  } finally {
    setIsSubmittingCategory(false);
    endOperation();
  }
};


  const handleCategoryDelete = async (categoryId, categoryName) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${categoryName}"? This will remove the category from all associated products.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/superadmin/categories/${categoryId}`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
              });

              if (response.ok) {
                Alert.alert('Success', 'Category deleted successfully.');
                fetchCategories();
                if (selectedCategory === categoryId) {
                  setSelectedCategory(null);
                }
              } else {
                const data = await response.json();
                Alert.alert('Error', data.message || 'Failed to delete category.');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete category.');
            }
          },
        },
      ]
    );
  };

  const pickCategoryImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setCategoryFormData(prev => ({ ...prev, image: result.assets[0].uri }));
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Could not select image. Please try again.');
    }
  };

  // ──────────────────────────────────────────────────────────────
  // ENHANCED SCAN & FAB FUNCTIONS
  // ──────────────────────────────────────────────────────────────

  const handleScanForNewProduct = () => {
    setBarcodeScannerVisible(true);
    setEditingProduct(null); // Ensure we're in create mode
  };

  // Update the FAB to show scan option
  const renderFab = () => (
    <View className="absolute right-5 bottom-5 items-center gap-3">
      {/* Scan FAB */}
      <TouchableOpacity
        className="w-14 h-14 rounded-full justify-center items-center shadow-lg bg-blue-500"
        onPress={handleScanForNewProduct}
      >
        <Ionicons name="barcode-outline" size={24} color="#FFF" />
      </TouchableOpacity>

      {/* Add Product FAB */}
      <TouchableOpacity
        className="w-14 h-14 rounded-full justify-center items-center shadow-lg bg-blue-500"
        onPress={openCreateModal}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
    </View>
  );

  // Update the minimal scan section in the modal to work properly
  const renderScanSection = () => (
    <View className="mb-6 items-center">
      <TouchableOpacity
        className="flex-row items-center bg-blue-50 px-4 py-3 rounded-lg border border-blue-500 gap-2"
        onPress={() => setBarcodeScannerVisible(true)}
      >
        <Ionicons name="barcode-outline" size={20} color={Colors.light.accent} />
        <Text className="text-sm font-semibold text-blue-600">
          {formData.scannedBarcodeId ? `Scanned: ${formData.scannedBarcodeId}` : 'Scan Barcode'}
        </Text>
        {formData.scannedBarcodeId && (
          <TouchableOpacity
            className="ml-2 p-1"
            onPress={() => setFormData(prev => ({ ...prev, scannedBarcodeId: '' }))}
          >
            <Ionicons name="close" size={16} color="#F44336" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>
  );

  // ──────────────────────────────────────────────────────────────
  // SIMPLIFIED IMAGE PICKER FUNCTIONS
  // ──────────────────────────────────────────────────────────────
  const pickImage = async () => {
    try {
      startOperation('Loading image picker...');

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Permission to access camera roll is required!');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setImageLoading(true);
        const selectedImage = result.assets[0];

        // FIX: Set both the image URI for preview and form data properly
        const imageData = {
          uri: selectedImage.uri,
          type: 'image/jpeg',
          name: selectedImage.fileName || `product-${Date.now()}.jpg`,
        };

        setFormData(prev => ({
          ...prev,
          image: imageData,
          cloudinaryImages: [] // Clear cloudinary images when using local image
        }));
        setImageUri(selectedImage.uri); // This is crucial for preview

        setTimeout(() => setImageLoading(false), 500);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      endOperation();
    }
  };

  const takePhoto = async () => {
    try {
      startOperation('Opening camera...');

      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Camera permission is required!');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setImageLoading(true);
        const selectedImage = result.assets[0];

        // FIX: Set both the image URI for preview and form data properly
        const imageData = {
          uri: selectedImage.uri,
          type: 'image/jpeg',
          name: `product-photo-${Date.now()}.jpg`,
        };

        setFormData(prev => ({
          ...prev,
          image: imageData,
          cloudinaryImages: [] // Clear cloudinary images when using local image
        }));
        setImageUri(selectedImage.uri); // This is crucial for preview

        setTimeout(() => setImageLoading(false), 500);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to take photo');
    } finally {
      endOperation();
    }
  };

  // ──────────────────────────────────────────────────────────────
  // ENHANCED OPENFOODFACTS INTEGRATION WITH PROGRESS INDICATORS
  // ──────────────────────────────────────────────────────────────

  const fetchProductDataFromBarcode = async (barcode) => {
    try {
      setFetchingProductData(true);
      startOperation('Scanning barcode...');
      updateProgress(10);

      console.log('🔍 Scanning barcode:', barcode);

      updateProgress(30);
      const response = await fetch(`${API_BASE_URL}/api/catalog/products/scan-barcode`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ barcode })
      });

      updateProgress(60);
      const data = await response.json();
      console.log('📦 Scan Response:', data);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to scan barcode');
      }

      if (data.productExists && data.existingProduct) {
        Alert.alert(
          'Product Already Exists',
          `"${data.existingProduct.name}" already uses this barcode. Would you like to edit it?`,
          [
            { text: 'Edit Product', onPress: () => openEditModal(data.existingProduct) },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }

      if (!data.success) {
        throw new Error(data.message || 'Scan failed');
      }

      updateProgress(80);
      const productData = {
        found: Boolean(data.openFoodFactsData?.found),
        barcode: (data.openFoodFactsData?.barcode || barcode || '').toString(),
        name: data.suggestedData?.name || `Product ${barcode}`,
        description: data.suggestedData?.description || '',
        brand: data.openFoodFactsData?.brand || '',
        categories: Array.isArray(data.openFoodFactsData?.categories)
          ? data.openFoodFactsData.categories
          : [],
        unit: data.suggestedData?.unit || 'piece',
        unitSize: data.suggestedData?.unitSize || '1',
        nutritionalInfo: data.suggestedData?.nutritionalInfo || {
          fat: '',
          protein: '',
          calories: '',
          carbohydrates: ''
        },
        images: Array.isArray(data.imageInfo?.images) && data.imageInfo.images.length > 0
          ? data.imageInfo.images.filter(img => img && img.url)
          : [],
        milkType: data.suggestedData?.milkType || 'Cow',
        tags: data.suggestedData?.tags || '',
        price: data.suggestedData?.price || 0,
        category: data.suggestedData?.category || '',
        autoFilledFields: data.autoFilledFields || {},
        missingRequiredFields: data.missingRequiredFields || {},
        dataSource: data.openFoodFactsData?.found ? 'openfoodfacts' : 'manual',
        requiresUserInput: Boolean(data.requiresConfirmation),
        availableCategories: Array.isArray(data.availableCategories)
          ? data.availableCategories
          : []
      };

      updateProgress(100);
      console.log('📸 Final product data:', {
        totalImages: productData.images.length,
        hasImages: productData.images.length > 0,
        imageUrls: productData.images.map(img => img.url)
      });

      setFetchedProductData(productData);
      setScannedBarcode(productData.barcode);
      setProductDataPreviewVisible(true);

    } catch (error) {
      console.error('❌ Barcode Scan Error:', error);

      setFetchedProductData(null);
      setScannedBarcode('');

      let errorMessage = 'Failed to scan barcode. Please try again.';

      if (error.message.includes('Network request failed')) {
        errorMessage = 'Network error. Please check your internet connection.';
      } else if (error.message.includes('401')) {
        errorMessage = 'Session expired. Please login again.';
        logout();
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Scan Error', errorMessage, [
        { text: 'Try Again', onPress: () => setBarcodeScannerVisible(true) },
        { text: 'Cancel', onPress: () => setBarcodeScannerVisible(false) }
      ]);
    } finally {
      setFetchingProductData(false);
      endOperation();
    }
  };

  const handleBarcodeScannedForProduct = (barcode) => {
    if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
      console.warn('⚠️ Invalid barcode scanned');
      Alert.alert('Invalid Barcode', 'Please scan a valid barcode');
      return;
    }

    console.log('📱 Barcode scanned:', barcode);
    setScannedBarcode(barcode.trim());
    setBarcodeScannerVisible(false);
    fetchProductDataFromBarcode(barcode.trim());
  };

  const handleApplyProductDataToForm = async () => {
    if (!fetchedProductData) {
      console.error('❌ No fetched product data available');
      Alert.alert('Error', 'No product data to apply');
      return;
    }

    try {
      setApplyingProductData(true);
      startOperation('Applying product data...');
      console.log('🔄 Applying scanned data to form...');

      updateProgress(20);
      const downloadedImages = fetchedProductData.images || [];
      console.log('📸 Using already downloaded images:', downloadedImages.length);

      updateProgress(40);
      const updates = {};
      const newAutoFilledFields = new Set();

      if (fetchedProductData.name && fetchedProductData.name.trim()) {
        updates.name = fetchedProductData.name;
        newAutoFilledFields.add('name');
      }

      if (fetchedProductData.description && fetchedProductData.description.trim()) {
        updates.description = fetchedProductData.description;
        newAutoFilledFields.add('description');
      }

      if (fetchedProductData.unit) {
        updates.unit = fetchedProductData.unit;
        newAutoFilledFields.add('unit');
      }

      if (fetchedProductData.unitSize) {
        updates.unitSize = fetchedProductData.unitSize;
        newAutoFilledFields.add('unitSize');
      }

      if (fetchedProductData.nutritionalInfo && typeof fetchedProductData.nutritionalInfo === 'object') {
        updates.nutritionalInfo = fetchedProductData.nutritionalInfo;
        newAutoFilledFields.add('nutritionalInfo');
      }

      if (fetchedProductData.tags) {
        updates.tags = Array.isArray(fetchedProductData.tags)
          ? fetchedProductData.tags.join(', ')
          : String(fetchedProductData.tags);
        newAutoFilledFields.add('tags');
      }

      if (fetchedProductData.price !== undefined && fetchedProductData.price !== null) {
        updates.price = fetchedProductData.price.toString();
      }

      if (fetchedProductData.milkType) {
        updates.milkType = fetchedProductData.milkType;
      }

      if (fetchedProductData.category) {
        updates.category = fetchedProductData.category;
        newAutoFilledFields.add('category');
      }

      updateProgress(60);

      // 🎯 CRITICAL FIX: Properly handle Cloudinary images
      const cloudinaryImages = downloadedImages
        .filter(img => img && img.url)
        .map(img => ({
          url: img.url,
          publicId: img.publicId || null,
          type: img.type || 'product'
        }));

      // 🎯 CRITICAL FIX: Set the scanned barcode in form data
      const scannedBarcodeValue = scannedBarcode || fetchedProductData.barcode;

      // 🎯 CRITICAL FIX: Set form data with proper image handling
      setFormData(prev => ({
        ...prev,
        ...updates,
        scannedBarcodeId: scannedBarcodeValue,
        cloudinaryImages: cloudinaryImages,
        image: null // Clear local image when using cloudinary images
      }));

      // 🎯 CRITICAL FIX: Set imageUri for preview from cloudinary images
      if (cloudinaryImages.length > 0) {
        const mainImage = cloudinaryImages.find(img => img.type === 'front') || cloudinaryImages[0];
        if (mainImage && mainImage.url) {
          setImageUri(mainImage.url);
          console.log('🖼️ Cloudinary image URI set for preview:', mainImage.url);
        } else {
          console.log('⚠️ No valid main image found in cloudinaryImages');
          setImageUri('');
        }
      } else {
        console.log('⚠️ No images available from scan');
        setImageUri('');
      }

      setAutoFilledFields(newAutoFilledFields);

      updateProgress(100);
      setProductDataPreviewVisible(false);
      setModalVisible(true);

      const imageMessage = cloudinaryImages.length > 0
        ? `${cloudinaryImages.length} images ready.`
        : 'No images available.';

      Alert.alert(
        'Success',
        `Product data applied! ${imageMessage} Please review and save. Scanned barcode will be automatically assigned.`
      );

    } catch (error) {
      console.error('❌ Error applying product data:', error);
      Alert.alert('Error', 'Failed to apply product data. Please try again.');
    } finally {
      setApplyingProductData(false);
      setFetchedProductData(null);
      setScannedBarcode('');
      endOperation();
    }
  };

  // ──────────────────────────────────────────────────────────────
  // AUTH & API HELPERS
  // ──────────────────────────────────────────────────────────────
  const handleApiError = (error, customMessage = null) => {
    console.error('API Error:', error);
    if (
      error.message?.includes('401') ||
      error.response?.status === 401 ||
      error.message?.includes('Unauthorized')
    ) {
      Alert.alert('Session Expired', 'Please login again.', [
        { text: 'OK', onPress: () => logout() },
      ]);
      return true;
    }
    Alert.alert('Error', customMessage || 'Something went wrong.');
    return false;
  };

  const validateAuthBeforeCall = async () => {
    if (!authToken || !isAuthenticated) {
      Alert.alert('Session Expired', 'Please login again');
      return false;
    }
    const isValid = await validateToken();
    if (!isValid) {
      Alert.alert('Session Expired', 'Please login again');
      return false;
    }
    return true;
  };

  const getAuthHeaders = (forFormData = false) => {
    const headers = { Authorization: `Bearer ${authToken}` };
    if (!forFormData) headers['Content-Type'] = 'application/json';
    return headers;
  };

  // ──────────────────────────────────────────────────────────────
  // DATA FETCHING
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && authToken && isAuthenticated) {
      fetchData();
    } else if (!authLoading && (!authToken || !isAuthenticated)) {
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
      startOperation('Loading products...');

      updateProgress(30);
      const [productsRes, categoriesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/catalog/products`, {
          headers: getAuthHeaders(),
        }),
        fetch(`${API_BASE_URL}/api/catalog/categories`, {
          headers: getAuthHeaders(),
        }),
      ]);

      updateProgress(70);
      if (!productsRes.ok) throw new Error('Failed to fetch products');

      const productsData = await productsRes.json();
      const categoriesData = await categoriesRes.json();

      // FIX: Map backend 'images' to frontend 'cloudinaryImages'
      const productsWithMappedImages = Array.isArray(productsData)
        ? productsData.map(product => ({
          ...product,
          cloudinaryImages: product.images || [] // Map backend images to cloudinaryImages
        }))
        : (productsData.products || []).map(product => ({
          ...product,
          cloudinaryImages: product.images || []
        }));

      setProducts(
        Array.isArray(productsData) ? productsData : productsData.products || []
      );
      setCategories(
        Array.isArray(categoriesData)
          ? categoriesData
          : categoriesData.categories || []
      );

      updateProgress(100);
    } catch (error) {
      handleApiError(error, 'Failed to load data.');
      setProducts([]);
      setCategories([]);
    } finally {
      setLoading(false);
      endOperation();
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.category?.name?.toLowerCase().includes(query) ||
          p.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Filter by selected category
    if (selectedCategory) {
      filtered = filtered.filter(
        (p) => p.category?._id === selectedCategory
      );
    }

    return filtered;
  }, [products, searchQuery, selectedCategory]);

  // ──────────────────────────────────────────────────────────────
  // FORM MODAL HANDLERS
  // ──────────────────────────────────────────────────────────────
  const openCreateModal = () => {
    setEditingProduct(null);
    resetForm();
    setModalVisible(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      category: product.category?._id || product.category || '',
      unit: product.unit || 'piece',
      unitSize: product.unitSize?.toString() || '',
      milkType: product.milkType || 'Cow',
      image: null,
      discount: product.discount?.toString() || '0',
      isFeatured: product.isFeatured || false,
      isAvailable: product.isAvailable !== false,
      nutritionalInfo:
        product.nutritionalInfo || {
          fat: '',
          protein: '',
          calories: '',
          carbohydrates: '',
        },
      tags: Array.isArray(product.tags)
        ? product.tags.join(', ')
        : typeof product.tags === 'string'
          ? product.tags
          : '',
      scannedBarcodeId: product.scannedBarcodeId || '',
      cloudinaryImages: []
    });
    setImageUri(product.image || '');
    setModalVisible(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      category: '',
      unit: 'piece',
      unitSize: '',
      milkType: 'Cow',
      image: null,
      discount: '',
      isFeatured: false,
      isAvailable: true,
      nutritionalInfo: { fat: '', protein: '', calories: '', carbohydrates: '' },
      tags: '',
      scannedBarcodeId: '', // 🎯 Initialize scannedBarcodeId
      cloudinaryImages: []
    });
    setImageUri('');
    setAutoFilledFields(new Set());
    setScannedBarcode('');
    setFetchedProductData(null);
  };

  const closeModal = () => {
    setModalVisible(false);
    resetForm();
    setEditingProduct(null);
    setFetchedProductData(null);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.price || !formData.category) {
      Alert.alert('Error', 'Name, Price, and Category are required.');
      return;
    }

    const isValid = await validateAuthBeforeCall();
    if (!isValid) return;

    try {
      setUploading(true);
      startOperation(editingProduct ? 'Updating product...' : 'Creating product...');

      const submitFormData = new FormData();

      // Append basic fields
      submitFormData.append('name', formData.name.trim());
      submitFormData.append('description', formData.description.trim());
      submitFormData.append('price', parseFloat(formData.price));
      submitFormData.append('category', formData.category);
      submitFormData.append('unit', formData.unit);
      submitFormData.append('unitSize', formData.unitSize ? parseFloat(formData.unitSize) : '');
      submitFormData.append('milkType', formData.milkType);
      submitFormData.append('discount', formData.discount ? parseFloat(formData.discount) : 0);
      submitFormData.append('isFeatured', formData.isFeatured);
      submitFormData.append('isAvailable', formData.isAvailable);
      submitFormData.append('tags', formData.tags);

      // Append nutritional info
      submitFormData.append('nutritionalInfo[fat]', formData.nutritionalInfo.fat || '');
      submitFormData.append('nutritionalInfo[protein]', formData.nutritionalInfo.protein || '');
      submitFormData.append('nutritionalInfo[calories]', formData.nutritionalInfo.calories || '');
      submitFormData.append('nutritionalInfo[carbohydrates]', formData.nutritionalInfo.carbohydrates || '');

      // 🎯 FIX: Append scanned barcode for NEW products
      if (formData.scannedBarcodeId && !editingProduct) {
        submitFormData.append('scannedBarcodeId', formData.scannedBarcodeId);
        console.log('📦 Adding scanned barcode to form data:', formData.scannedBarcodeId);
      }

      updateProgress(30);

      // Handle image upload - use cloudinaryImages if available, otherwise use local image
      if (formData.cloudinaryImages && formData.cloudinaryImages.length > 0) {
        console.log('📤 Using Cloudinary images:', formData.cloudinaryImages.length);
        console.log('📤 Cloudinary images URLs:', formData.cloudinaryImages.map(img => img.url));
        // For Cloudinary images, we need to send them as JSON string
        submitFormData.append('cloudinaryImages', JSON.stringify(formData.cloudinaryImages));
      } else if (formData.image && formData.image.uri) {
        console.log('📤 Uploading local image');
        submitFormData.append('image', {
          uri: formData.image.uri,
          type: 'image/jpeg',
          name: formData.image.name || `product-${Date.now()}.jpg`,
        });
      }

      updateProgress(60);
      const url = editingProduct
        ? `${API_BASE_URL}/api/superadmin/products/${editingProduct._id}`
        : `${API_BASE_URL}/api/superadmin/products`;

      const response = await fetch(url, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: submitFormData,
      });

      updateProgress(80);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to save product');
      }

      updateProgress(100);

      const successMessage = formData.scannedBarcodeId && !editingProduct
        ? `Product created successfully with barcode: ${formData.scannedBarcodeId}`
        : `Product ${editingProduct ? 'updated' : 'created'} successfully.`;

      Alert.alert('Success!', successMessage, [
        {
          text: 'OK', onPress: () => {
            closeModal();
            fetchData();
          }
        }
      ]);

    } catch (error) {
      console.error('Submit error:', error);
      handleApiError(error, `Failed to ${editingProduct ? 'update' : 'create'} product.`);
    } finally {
      setUploading(false);
      endOperation();
    }
  };

  const handleDelete = async (productId) => {
    const isValid = await validateAuthBeforeCall();
    if (!isValid) return;

    Alert.alert('Delete Product', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            startOperation('Deleting product...');
            const response = await fetch(
              `${API_BASE_URL}/api/catalog/products/${productId}`,
              {
                method: 'DELETE',
                headers: getAuthHeaders(),
              }
            );

            if (response.ok) {
              Alert.alert('Success', 'Product deleted.');
              fetchData();
            } else {
              const data = await response.json();
              handleApiError(
                { message: data.message, response },
                data.message || 'Failed to delete.'
              );
            }
          } catch (error) {
            handleApiError(error, 'Failed to delete product.');
          } finally {
            endOperation();
          }
        },
      },
    ]);
  };

  // ──────────────────────────────────────────────────────────────
  // BARCODE FUNCTIONS
  // ──────────────────────────────────────────────────────────────
  const openBarcodeModal = (product) => {
    setSelectedProductForBarcode(product);
    setBarcodeModalVisible(true);
  };

  const closeBarcodeModal = () => {
    setBarcodeModalVisible(false);
    setSelectedProductForBarcode(null);
    setShowCamera(false);
    setBarcodeScanning(false);
  };

  const requestCameraPermissions = async () => {
    if (!cameraPermission?.granted) {
      const { status } = await requestCameraPermission();
      return status === 'granted';
    }
    return true;
  };

  const startBarcodeScan = async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Camera permission is needed to scan barcodes');
      return;
    }
    setShowCamera(true);
    setBarcodeScanning(true);
  };

  const stopBarcodeScan = () => {
    setShowCamera(false);
    setBarcodeScanning(false);
  };

  const updateProductState = (productId, updates) => {
    setProducts(prev =>
      prev.map(p =>
        p._id === productId ? { ...p, ...updates } : p
      )
    );

    if (selectedProductForBarcode?._id === productId) {
      setSelectedProductForBarcode(prev => ({ ...prev, ...updates }));
    }
  };

  const onBarcodeScanned = async ({ data }) => {
    if (!data || !selectedProductForBarcode) return;

    try {
      setBarcodeScanning(false);
      startOperation('Assigning barcode...');

      const response = await fetch(
        `${API_BASE_URL}/api/catalog/products/${selectedProductForBarcode._id}/scan-barcode`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ scannedBarcodeId: data }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        Alert.alert('Success', 'Scanned barcode assigned successfully!');

        updateProductState(selectedProductForBarcode._id, {
          scannedBarcodeId: data,
        });

      } else {
        Alert.alert('Error', result.message || 'Failed to assign scanned barcode');
      }
    } catch (error) {
      console.error('Barcode Assignment Error:', error);
      handleApiError(error, 'Failed to assign scanned barcode');
    } finally {
      setShowCamera(false);
      endOperation();
    }
  };

  const removeScannedBarcode = async () => {
    if (!selectedProductForBarcode?._id) return;

    Alert.alert('Remove Scanned Barcode', 'Are you sure you want to remove the scanned barcode?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            startOperation('Removing barcode...');
            const response = await fetch(
              `${API_BASE_URL}/api/catalog/products/${selectedProductForBarcode._id}/scanned-barcode`,
              {
                method: 'DELETE',
                headers: getAuthHeaders(),
              }
            );

            if (response.ok) {
              Alert.alert('Success', 'Scanned barcode removed successfully!');

              updateProductState(selectedProductForBarcode._id, {
                scannedBarcodeId: null
              });

            } else {
              const result = await response.json();
              Alert.alert('Error', result.message || 'Failed to remove scanned barcode');
            }
          } catch (error) {
            handleApiError(error, 'Failed to remove scanned barcode');
          } finally {
            endOperation();
          }
        },
      },
    ]);
  };

  const removeGeneratedBarcode = async () => {
    if (!selectedProductForBarcode?._id) return;

    Alert.alert('Remove Generated Barcode', 'Are you sure you want to remove the generated barcode?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            startOperation('Removing generated barcode...');
            const response = await fetch(
              `${API_BASE_URL}/api/catalog/products/${selectedProductForBarcode._id}/generated-barcode`,
              {
                method: 'DELETE',
                headers: getAuthHeaders(),
              }
            );

            if (response.ok) {
              Alert.alert('Success', 'Generated barcode removed successfully!');

              updateProductState(selectedProductForBarcode._id, {
                barcodeId: null,
                barcodeUrl: null
              });

            } else {
              const result = await response.json();
              Alert.alert('Error', result.message || 'Failed to remove generated barcode');
            }
          } catch (error) {
            handleApiError(error, 'Failed to remove generated barcode');
          } finally {
            endOperation();
          }
        },
      },
    ]);
  };

  const generateBarcode = async () => {
    if (!selectedProductForBarcode?._id) return;
    const ok = await validateAuthBeforeCall();
    if (!ok) return;

    try {
      setBarcodeScanning(true);
      startOperation('Generating barcode...');

      const res = await fetch(
        `${API_BASE_URL}/api/catalog/products/${selectedProductForBarcode._id}/generate-barcode`,
        {
          method: 'POST',
          headers: getAuthHeaders(),
        }
      );

      const data = await res.json();
      if (res.ok && data.barcodeUrl) {
        updateProductState(selectedProductForBarcode._id, {
          barcodeUrl: data.barcodeUrl,
          barcodeId: selectedProductForBarcode._id.toString()
        });
        Alert.alert('Success', 'Barcode generated successfully!');
      } else {
        Alert.alert('Info', data.message || 'Barcode already exists.');
      }
    } catch (e) {
      handleApiError(e, 'Failed to generate barcode.');
    } finally {
      setBarcodeScanning(false);
      endOperation();
    }
  };

  const downloadBarcode = async () => {
    if (!selectedProductForBarcode?.barcodeUrl) return;
    try {
      startOperation('Preparing barcode for download...');

      const capturedUri = await viewShotRef.current?.capture?.();
      if (!capturedUri) throw new Error('Capture failed');

      let finalUri = capturedUri;
      try {
        const manip = await ImageManipulator.manipulateAsync(
          capturedUri,
          [],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        finalUri = manip.uri;
      } catch (e) {
        console.warn('JPEG conversion skipped', e);
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(finalUri, {
          mimeType: finalUri.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
          dialogTitle: 'Save Barcode',
          UTI: finalUri.endsWith('.jpg') ? 'public.jpeg' : 'public.png',
        });
        Alert.alert('Success', 'Barcode shared successfully!');
      } else {
        Alert.alert('Saved', 'Barcode is in your device cache.');
      }
    } catch (e) {
      console.error('Barcode download error:', e);
      Alert.alert('Error', 'Could not share barcode');
    } finally {
      endOperation();
    }
  };

  // ──────────────────────────────────────────────────────────────
  // PROGRESS BAR COMPONENT
  // ──────────────────────────────────────────────────────────────
  const ProgressBar = ({ progress, color = Colors.light.accent, height = 6 }) => (
    <View className={`bg-gray-300 rounded-full overflow-hidden h-[${height}px]`}>
      <View
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${progress}%`,
          backgroundColor: color
        }}
      />
    </View>
  );

  // ──────────────────────────────────────────────────────────────
  // LOADING OVERLAY COMPONENT
  // ──────────────────────────────────────────────────────────────
  const LoadingOverlay = ({ message, progress, showProgress = false }) => (
    <View className="absolute inset-0 bg-white/95 justify-center items-center z-50">
      <View className="bg-white p-6 rounded-xl items-center min-w-[200px] shadow-lg">
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text className="mt-4 text-base font-semibold text-gray-900 text-center">{message}</Text>
        {showProgress && progress !== undefined && (
          <>
            <ProgressBar progress={progress} />
            <Text className="mt-2 text-sm text-gray-500 font-semibold">{Math.round(progress)}%</Text>
          </>
        )}
      </View>
    </View>
  );

  // ──────────────────────────────────────────────────────────────
  // HORIZONTAL CATEGORIES COMPONENT
  // ──────────────────────────────────────────────────────────────
  // ──────────────────────────────────────────────────────────────
// HORIZONTAL CATEGORIES COMPONENT
// ──────────────────────────────────────────────────────────────
const HorizontalCategories = () => (
  <View className="bg-white py-4 border-b border-gray-200">
    <View className="flex-row justify-between items-center px-5 mb-3">
      <Text className="text-lg font-bold text-gray-900">Categories</Text>
      <TouchableOpacity
        className="bg-blue-500/20 px-3 py-1.5 rounded-lg"
        onPress={() => setCategoriesModalVisible(true)}
      >
        <Text className="text-sm font-semibold text-blue-500">Manage</Text>
      </TouchableOpacity>
    </View>

    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 16 }}
    >
      {/* All Categories Option */}
      <TouchableOpacity
        className="items-center mx-2 w-20"
        onPress={() => setSelectedCategory(null)}
      >
        <View className={`w-16 h-16 rounded-full mb-2 border-2 overflow-hidden ${selectedCategory === null ? 'border-blue-500 bg-blue-500/20' : 'border-gray-300'}`}>
          <View className="w-full h-full justify-center items-center bg-gray-100">
            <MaterialIcons name="all-inclusive" size={24} color={selectedCategory === null ? "#FFF" : Colors.light.textSecondary} />
          </View>
          {selectedCategory === null && (
            <View className="absolute -bottom-1 -right-1 bg-blue-500 w-5 h-5 rounded-full justify-center items-center border-2 border-white">
              <Ionicons name="checkmark" size={16} color="#FFF" />
            </View>
          )}
        </View>
        <Text className={`text-xs font-semibold text-center ${selectedCategory === null ? 'text-blue-500 font-bold' : 'text-gray-900'}`}>
          All
        </Text>
      </TouchableOpacity>

      {categories.map((category) => (
        <TouchableOpacity
          key={category._id}
          className="items-center mx-2 w-20"
          onPress={() => setSelectedCategory(category._id)}
        >
          <View className={`w-16 h-16 rounded-full mb-2 border-2 overflow-hidden ${selectedCategory === category._id ? 'border-blue-500 bg-blue-500/20' : 'border-gray-300'}`}>
            {category.image ? (
              <Image
                source={{ uri: category.image }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full justify-center items-center bg-gray-100">
                <MaterialIcons name="category" size={24} color={selectedCategory === category._id ? "#FFF" : Colors.light.textSecondary} />
              </View>
            )}
            {selectedCategory === category._id && (
              <View className="absolute -bottom-1 -right-1 bg-blue-500 w-5 h-5 rounded-full justify-center items-center border-2 border-white">
                <Ionicons name="checkmark" size={16} color="#FFF" />
              </View>
            )}
          </View>
          <Text className={`text-xs font-semibold text-center max-w-[80px] ${selectedCategory === category._id ? 'text-blue-500 font-bold' : 'text-gray-900'}`} numberOfLines={1}>
            {category.name}
          </Text>
        </TouchableOpacity>
      ))}

      {/* Add Category Button */}
      <TouchableOpacity
        className="items-center mx-2 w-20"
        onPress={openCategoryCreateModal}
      >
        <View className="w-16 h-16 rounded-full border-2 border-blue-500 border-dashed justify-center items-center mb-2 bg-gray-50">
          <Ionicons name="add" size={24} color={Colors.light.accent} />
        </View>
        <Text className="text-xs font-semibold text-blue-500 text-center">Add New</Text>
      </TouchableOpacity>
    </ScrollView>
  </View>
);

  // ──────────────────────────────────────────────────────────────
  // RENDER PRODUCT CARD
  // ──────────────────────────────────────────────────────────────
  const renderProduct = ({ item }) => {
    const isOutOfStock = item.stock <= 0;
    const discount = item.discount > 0 ? `${item.discount}% off` : null;
    const unitDisplay = item.unitSize ? `${item.unitSize}${item.unit}` : item.unit;

    return (
      <TouchableOpacity
        className="bg-white rounded-xl p-4 mb-3 border border-gray-200 flex-row items-start shadow-sm"
        onPress={() => openEditModal(item)}
        activeOpacity={0.7}
      >
        {/* Product Image */}
        <View className="relative mr-3">
          <Image
            source={{
              uri: item.image || 'https://via.placeholder.com/100'
            }}
            className="w-20 h-20 rounded-xl bg-gray-100"
            resizeMode="cover"
          />
          {/* Featured Badge */}
          {item.isFeatured && (
            <View className="absolute -top-1 -left-1 flex-row items-center bg-blue-500 px-2 py-1 rounded-lg gap-1">
              <Ionicons name="star" size={12} color="#FFF" />
              <Text className="text-xs text-white font-semibold">Featured</Text>
            </View>
          )}
          {/* Out of Stock Overlay */}
          {isOutOfStock && (
            <View className="absolute inset-0 bg-black/70 rounded-xl justify-center items-center">
              <Text className="text-xs text-red-500 font-semibold">Out of Stock</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View className="flex-1 mr-3">
          {/* Title Row */}
          <View className="flex-row justify-between items-start mb-1">
            <Text className="text-base font-semibold text-gray-900 flex-1 mr-2" numberOfLines={1}>
              {item.name}
            </Text>
            <Text className="text-xs text-gray-500 font-medium bg-gray-100 px-1.5 py-1 rounded">
              {unitDisplay}
            </Text>
          </View>

          {/* Category */}
          <Text className="text-sm text-gray-500 mb-1.5" numberOfLines={1}>
            {item.category?.name || 'Uncategorized'}
          </Text>

          {/* Description */}
          {item.description && (
            <Text className="text-sm text-gray-500 leading-4 mb-2" numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Barcode Info - Show Both Types */}
          {(item.barcodeId || item.scannedBarcodeId) && (
            <View className="flex-row items-center mb-2 gap-1">
              <Ionicons name="barcode-outline" size={12} color={Colors.light.textSecondary} />
              <View className="flex-1 ml-1.5">
                {item.scannedBarcodeId && (
                  <View className="flex-row items-center mb-1">
                    <Text className="text-xs text-gray-500 font-mono flex-1" numberOfLines={1}>
                      {item.scannedBarcodeId}
                    </Text>
                    <View className="bg-blue-100 px-1.5 py-0.5 rounded">
                      <Text className="text-[9px] font-semibold text-blue-600">Scanned</Text>
                    </View>
                  </View>
                )}
                {item.barcodeId && (
                  <View className="flex-row items-center">
                    <Text className="text-xs text-gray-500 font-mono flex-1" numberOfLines={1}>
                      {item.barcodeId}
                    </Text>
                    <View className="bg-green-100 px-1.5 py-0.5 rounded">
                      <Text className="text-[9px] font-semibold text-green-600">Generated</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Price & Stock Row */}
          <View className="flex-row justify-between items-end">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg font-bold text-blue-500">₹{item.price}</Text>
              {discount && (
                <View className="bg-green-100 px-1.5 py-1 rounded">
                  <Text className="text-xs text-green-600 font-semibold">{discount}</Text>
                </View>
              )}
            </View>
            <Text className={`text-xs ${isOutOfStock ? 'text-red-500' : 'text-gray-500'}`}>
              {item.stock} in stock
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="items-center gap-2">
          <TouchableOpacity
            className="w-10 h-10 rounded-lg justify-center items-center bg-green-100"
            onPress={(e) => {
              e.stopPropagation();
              openBarcodeModal(item);
            }}
          >
            <Ionicons name="barcode-outline" size={20} color="#4CAF50" />
          </TouchableOpacity>
          <TouchableOpacity
            className="w-10 h-10 rounded-lg justify-center items-center bg-red-100"
            onPress={(e) => {
              e.stopPropagation();
              handleDelete(item._id);
            }}
          >
            <Feather name="trash-2" size={18} color="#F44336" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const EmptyList = () => (
    <View className="items-center justify-center py-15">
      <MaterialIcons name="inventory-2" size={56} color={Colors.light.textSecondary} />
      <Text className="text-lg font-semibold text-gray-900 mt-4">
        {searchQuery || selectedCategory ? 'No products found' : 'No products yet'}
      </Text>
      <Text className="text-sm text-gray-500 mt-2 text-center px-8">
        {searchQuery
          ? 'Try a different search term'
          : selectedCategory
            ? 'No products in this category'
            : 'Add your first product to get started'}
      </Text>
      {!searchQuery && !selectedCategory && (
        <TouchableOpacity className="bg-blue-500 px-6 py-3 rounded-xl mt-4" onPress={openCreateModal}>
          <Text className="text-white font-semibold">Add Product</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ──────────────────────────────────────────────────────────────
  // CATEGORIES LIST COMPONENT
  // ──────────────────────────────────────────────────────────────
  const CategoriesList = () => (
    <View className="flex-1 p-4">
      <Text className="text-xl font-bold text-gray-900 mb-1">Manage Categories</Text>
      <Text className="text-sm text-gray-500 mb-4">Tap to edit or use actions</Text>

      <FlatList
        data={categories}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-row items-center bg-white p-4 rounded-xl mb-3 border border-gray-200 shadow-sm"
            onPress={() => openCategoryEditModal(item)}
          >
            <View className="w-12 h-12 rounded-full overflow-hidden mr-3 bg-gray-100 justify-center items-center">
              {item.image ? (
                <Image source={{ uri: item.image }} className="w-full h-full" />
              ) : (
                <View className="w-full h-full justify-center items-center">
                  <MaterialIcons name="category" size={24} color={Colors.light.textSecondary} />
                </View>
              )}
            </View>

            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900 mb-1">{item.name}</Text>
              {item.description ? (
                <Text className="text-sm text-gray-500 mb-1" numberOfLines={2}>
                  {item.description}
                </Text>
              ) : (
                <Text className="text-sm text-gray-500 mb-1">No description</Text>
              )}
              <Text className="text-xs text-gray-500">Order: {item.displayOrder}</Text>
            </View>

            <View className="ml-3">
              <TouchableOpacity
                className="p-2 bg-blue-500/20 rounded-lg mb-2"
                onPress={() => openCategoryEditModal(item)}
              >
                <Feather name="edit" size={18} color={Colors.light.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                className="p-2 bg-red-100 rounded-lg"
                onPress={() => handleCategoryDelete(item._id, item.name)}
              >
                <Feather name="trash-2" size={18} color="#F44336" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-10">
            <MaterialIcons name="category" size={48} color={Colors.light.textSecondary} />
            <Text className="text-lg font-semibold text-gray-900 mt-4">No categories yet</Text>
            <Text className="text-sm text-gray-500 mt-2 text-center">
              Create your first category to organize products
            </Text>
          </View>
        }
      />
    </View>
  );

  // ──────────────────────────────────────────────────────────────
  // CATEGORY FORM COMPONENT
  // ──────────────────────────────────────────────────────────────
  const CategoryForm = React.memo(({
  initialData,
  onSubmit,
  onCancel,
  isSubmittingCategory,
  categories,
  pickCategoryImage,
}) => {

  const defaultForm = {
    name: '',
    description: '',
    image: '',
    displayOrder: 0,
  };

  const [localForm, setLocalForm] = React.useState({
    ...defaultForm,
    ...(initialData || {}),
  });

  React.useEffect(() => {
    setLocalForm({
      ...defaultForm,
      ...(initialData || {}),
    });
  }, [initialData?._id, initialData?.id, initialData?.name]);

  const updateField = (field, value) => {
    setLocalForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onSubmit(localForm);
  };

  return (
    <>
      <KeyboardAwareScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >

        {/* 🔼 IMAGE SECTION IS NOW ABOVE CATEGORY NAME 🔼 */}

        {/* Category Image Preview */}
        {localForm.image ? (
          <View className="relative w-full h-48 mb-3 rounded-xl overflow-hidden border border-gray-300">
            <Image source={{ uri: localForm.image }} className="w-full h-full" />
            <TouchableOpacity
              className="absolute top-2 right-2 bg-red-500/90 w-6 h-6 rounded-full justify-center items-center"
              onPress={() => updateField('image', '')}
              disabled={isSubmittingCategory}
            >
              <Ionicons name="close" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Image Input + Picker */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-900 mb-2">Category Image</Text>
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 border border-gray-300 rounded-lg p-3 text-base text-gray-900 bg-white"
              value={localForm.image}
              onChangeText={(text) => updateField('image', text)}
              placeholder="Image URL or select from gallery"
              editable={!isSubmittingCategory}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              className="ml-2 bg-blue-500 p-3 rounded-lg"
              onPress={pickCategoryImage}
              disabled={isSubmittingCategory}
            >
              <Ionicons name="image" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 🔽 CATEGORY NAME (now moved below Image) 🔽 */}

        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-900 mb-2">Category Name *</Text>
          <TextInput
            className={`border rounded-lg p-3 text-base text-gray-900 bg-white ${localForm.name.trim() ? 'border-blue-500' : 'border-gray-300'}`}
            value={localForm.name}
            onChangeText={(text) => updateField('name', text)}
            placeholder="e.g., Dairy Products, Fresh Milk"
            editable={!isSubmittingCategory}
            autoCapitalize="words"
            autoCorrect={true}
            blurOnSubmit={false}
            maxLength={50}
          />
          <Text className="text-xs text-gray-500 text-right mt-1">{localForm.name.length}/50</Text>
        </View>

        {/* Description */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-900 mb-2">Description</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-3 text-base text-gray-900 bg-white h-32 text-align-top"
            value={localForm.description}
            onChangeText={(text) => updateField('description', text)}
            placeholder="Optional category description..."
            multiline
            numberOfLines={4}
            editable={!isSubmittingCategory}
            autoCapitalize="sentences"
            autoCorrect={true}
            blurOnSubmit={false}
            maxLength={200}
          />
          <Text className="text-xs text-gray-500 text-right mt-1">{localForm.description.length}/200</Text>
        </View>

        {/* Display Order */}
        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-900 mb-2">Display Order</Text>
          <TextInput
            className="border border-gray-300 rounded-lg p-3 text-base text-gray-900 bg-white"
            value={localForm.displayOrder?.toString() ?? '0'}
            onChangeText={(text) => {
              const num = parseInt(text, 10) || 0;
              updateField('displayOrder', Math.max(0, num));
            }}
            placeholder="0"
            keyboardType="numeric"
            editable={!isSubmittingCategory}
          />
          <Text className="text-xs text-gray-500 mt-1">Lower numbers appear first in listings</Text>
        </View>
      </KeyboardAwareScrollView>

      {/* Footer */}
      <View className="flex-row p-5 border-t border-gray-300 gap-3">
        <TouchableOpacity
          className={`flex-1 bg-gray-100 py-3.5 rounded-lg items-center ${isSubmittingCategory ? 'opacity-60' : ''}`}
          onPress={onCancel}
          disabled={isSubmittingCategory}
        >
          <Text className="text-base font-semibold text-gray-900">Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 bg-blue-500 py-3.5 rounded-lg items-center ${(isSubmittingCategory || !localForm.name.trim()) ? 'opacity-60' : ''}`}
          onPress={handleSubmit}
          disabled={isSubmittingCategory || !localForm.name.trim()}
        >
          {isSubmittingCategory ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text className="text-base font-semibold text-white">
              {initialData?._id ? 'Update Category' : 'Create Category'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
});




  // ──────────────────────────────────────────────────────────────
  // LOADING STATES
  // ──────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <View className={`flex-1 bg-gray-50 justify-center items-center pt-[${insets.top + 16}px]`}>
        <LoadingOverlay
          message="Loading your products..."
          progress={submissionProgress}
          showProgress={operationInProgress !== ''}
        />
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // MAIN RETURN
  // ──────────────────────────────────────────────────────────────
  return (
    <View className={`flex-1 bg-gray-50 pt-[${insets.top}px]`}>
      {/* Global Loading Overlay */}
      {operationInProgress !== '' && (
        <LoadingOverlay
          message={operationInProgress}
          progress={submissionProgress}
          showProgress={true}
        />
      )}

      {/* PROFESSIONAL HEADER */}
      <View className="bg-white px-5 pt-4 pb-3 border-b border-gray-200">
        <View className="mb-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-2xl font-bold text-gray-900 flex-1">Products</Text>
            <View className="flex-1 flex-row items-center bg-gray-100 rounded-xl border border-gray-300 px-3 ml-4 max-w-[200px]">
              <Ionicons name="search" size={20} color={Colors.light.textSecondary} className="mr-2" />
              <TextInput
                className="flex-1 py-2.5 text-sm text-gray-900"
                placeholder="Search products..."
                placeholderTextColor={Colors.light.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>
        </View>

        {/* Stats Bar - Now inside scrollable content */}
        <View className="flex-row items-center bg-white rounded-xl py-3 shadow-sm">
          <View className="flex-1 items-center">
            <Text className="text-lg font-bold text-blue-500">{filteredProducts.length}</Text>
            <Text className="text-xs text-gray-500 mt-0.5">Showing</Text>
          </View>
          <View className="w-px h-6 bg-gray-300" />
          <View className="flex-1 items-center">
            <Text className="text-lg font-bold text-blue-500">
              {filteredProducts.filter(p => p.barcodeId || p.scannedBarcodeId).length}
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5">With Barcodes</Text>
          </View>
          <View className="w-px h-6 bg-gray-300" />
          <View className="flex-1 items-center">
            <Text className="text-lg font-bold text-blue-500">
              {filteredProducts.filter(p => p.isFeatured).length}
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5">Featured</Text>
          </View>
        </View>
      </View>

      {/* Horizontal Categories Section */}
      <HorizontalCategories />

      {/* Product List with Pull to Refresh */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item._id}
        className="px-5 pb-20"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyList />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.light.accent]}
            tintColor={Colors.light.accent}
          />
        }
      />

      {/* Enhanced FAB with Scan Option */}
      {renderFab()}

      {/* Product Form Modal */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal}>
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[95%]">
            <View className="flex-row justify-between items-start p-5 border-b border-gray-300">
              <View>
                <Text className="text-xl font-bold text-gray-900">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </Text>
                <Text className="text-sm text-gray-500 mt-1">
                  {editingProduct ? 'Update product information' : 'Create a new product entry'}
                </Text>
              </View>
              <TouchableOpacity
                className="p-1"
                onPress={closeModal}
              >
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
              {/* Minimal Scan Barcode Section - Only for new products */}
              {!editingProduct && (
                <View className="mb-6 items-center">
                  {formData.scannedBarcodeId ? (
                    <View className="bg-green-100 p-3 rounded-lg mb-4 border-l-4 border-l-green-500">
                      <Text className="text-sm text-green-800 font-medium">
                        📦 Scanned Barcode: {formData.scannedBarcodeId}
                      </Text>
                      <Text className="text-xs text-green-700 mt-1">
                        This barcode will be automatically assigned to the product
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      className="flex-row items-center bg-blue-50 px-4 py-3 rounded-lg border border-blue-500 gap-2"
                      onPress={() => setBarcodeScannerVisible(true)}
                    >
                      <Ionicons name="barcode-outline" size={20} color={Colors.light.accent} />
                      <Text className="text-sm font-semibold text-blue-600">Scan Barcode to Auto-Fill</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Basic Information Section */}
              <View className="mb-6">
                <View className="flex-row items-center mb-4 gap-2">
                  <Ionicons name="information-circle-outline" size={20} color={Colors.light.accent} />
                  <Text className="text-base font-semibold text-gray-900">Basic Information</Text>
                </View>

                {/* Improved Image Upload with Loading */}
                <View className="mb-4">
                  <Text className="text-sm font-semibold text-gray-900 mb-2">Product Image</Text>

                  {/* Image Preview with Loading - FIXED LOGIC */}
                  {(imageUri || (formData.cloudinaryImages && formData.cloudinaryImages.length > 0)) && (
                    <View className="relative w-full h-48 mb-3 rounded-xl overflow-hidden border border-gray-300">
                      {imageLoading && (
                        <View className="absolute inset-0 bg-black/70 justify-center items-center z-10">
                          <ActivityIndicator size="small" color="#FFF" />
                          <Text className="text-white text-xs font-semibold mt-2">Processing Image...</Text>
                        </View>
                      )}

                      {/* Show local image if available, otherwise show first cloudinary image */}
                      {imageUri ? (
                        <Image
                          source={{ uri: imageUri }}
                          className="w-full h-full"
                          resizeMode="cover"
                          onError={(e) => {
                            console.log('Local image preview error:', e.nativeEvent.error);
                            setImageUri('');
                          }}
                        />
                      ) : formData.cloudinaryImages && formData.cloudinaryImages.length > 0 && formData.cloudinaryImages[0].url ? (
                        <Image
                          source={{ uri: formData.cloudinaryImages[0].url }}
                          className="w-full h-full"
                          resizeMode="cover"
                          onError={(e) => {
                            console.log('Cloudinary image preview error:', e.nativeEvent.error);
                            // Remove the faulty image from cloudinaryImages
                            setFormData(prev => ({
                              ...prev,
                              cloudinaryImages: prev.cloudinaryImages.filter((_, index) => index !== 0)
                            }));
                          }}
                        />
                      ) : null}

                      <TouchableOpacity
                        className="absolute top-2 right-2 bg-red-500/90 w-6 h-6 rounded-full justify-center items-center"
                        onPress={() => {
                          setFormData(prev => ({
                            ...prev,
                            image: null,
                            cloudinaryImages: []
                          }));
                          setImageUri('');
                        }}
                      >
                        <Ionicons name="close" size={16} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Image Selection Buttons */}
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      className={`flex-1 flex-row items-center justify-center border rounded-lg py-3 gap-2 ${imageLoading ? 'border-gray-300 bg-gray-100' : 'border-gray-300 bg-gray-50'}`}
                      onPress={pickImage}
                      disabled={imageLoading}
                    >
                      {imageLoading ? (
                        <ActivityIndicator size="small" color={Colors.light.accent} />
                      ) : (
                        <>
                          <Ionicons name="image-outline" size={20} color={Colors.light.accent} />
                          <Text className="text-sm font-semibold text-blue-500">Choose from Gallery</Text>
                        </>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      className={`flex-1 flex-row items-center justify-center border rounded-lg py-3 gap-2 ${imageLoading ? 'border-gray-300 bg-gray-100' : 'border-gray-300 bg-gray-50'}`}
                      onPress={takePhoto}
                      disabled={imageLoading}
                    >
                      {imageLoading ? (
                        <ActivityIndicator size="small" color={Colors.light.accent} />
                      ) : (
                        <>
                          <Ionicons name="camera-outline" size={20} color={Colors.light.accent} />
                          <Text className="text-sm font-semibold text-blue-500">Take Photo</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <View className="flex-row -mx-1.5">
                  <View className="flex-1 mx-1.5">
                    <Text className="text-sm font-semibold text-gray-900 mb-2">
                      Product Name * {autoFilledFields.has('name') && '✓'}
                    </Text>
                    <TextInput
                      className={`border rounded-lg p-3 text-base text-gray-900 bg-white ${autoFilledFields.has('name') ? 'bg-blue-50 border-blue-500' : 'border-gray-300'}`}
                      value={formData.name}
                      onChangeText={(t) => setFormData({ ...formData, name: t })}
                      placeholder="Enter product name"
                    />
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-sm font-semibold text-gray-900 mb-2">
                    Description {autoFilledFields.has('description') && '✓'}
                  </Text>
                  <TextInput
                    className={`border rounded-lg p-3 text-base text-gray-900 bg-white h-24 text-align-top ${autoFilledFields.has('description') ? 'bg-blue-50 border-blue-500' : 'border-gray-300'}`}
                    value={formData.description}
                    onChangeText={(t) => setFormData({ ...formData, description: t })}
                    placeholder="Product description..."
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Category Selection with Create New Option */}
<View className="mb-4">
  <Text className="text-sm font-semibold text-gray-900 mb-2">
    Category * {autoFilledFields.has('category') && '✓'}
  </Text>
  
  {/* Categories Chip List */}
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    className="mb-2"
    contentContainerStyle={{ paddingRight: 20 }}
  >
    {categories.map((cat) => (
      <TouchableOpacity
        key={cat._id}
        className={`bg-gray-100 px-4 py-2 rounded-full mr-2 ${formData.category === cat._id ? 'bg-blue-500' : ''}`}
        onPress={() => setFormData({ ...formData, category: cat._id })}
      >
        <Text
          className={`text-sm ${formData.category === cat._id ? 'text-white font-semibold' : 'text-gray-900'}`}
        >
          {cat.name}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>

  {/* Create New Category Button */}
  <TouchableOpacity
    className="flex-row items-center justify-center bg-blue-50 py-3 rounded-lg border border-blue-500 border-dashed gap-2 mt-2"
    onPress={() => {
      setCategoryFormModalVisible(true);
      setEditingCategory(null);
      setCategoryFormData({
        name: '',
        description: '',
        image: '',
        displayOrder: categories.length,
      });
    }}
  >
    <Ionicons name="add-circle-outline" size={18} color={Colors.light.accent} />
    <Text className="text-sm font-semibold text-blue-500">Create New Category</Text>
  </TouchableOpacity>
</View>
              </View>

              {/* Pricing Section */}
              <View className="mb-6">
                <View className="flex-row items-center mb-4 gap-2">
                  <Ionicons name="pricetag-outline" size={20} color={Colors.light.accent} />
                  <Text className="text-base font-semibold text-gray-900">Pricing</Text>
                </View>

                <View className="flex-row -mx-1.5">
                  <View className="flex-1 mx-1.5">
                    <Text className="text-sm font-semibold text-gray-900 mb-2">Price (₹) *</Text>
                    <TextInput
                      className="border border-gray-300 rounded-lg p-3 text-base text-gray-900 bg-white"
                      value={formData.price}
                      onChangeText={(t) => setFormData({ ...formData, price: t })}
                      keyboardType="numeric"
                      placeholder="0.00"
                    />
                  </View>
                  <View className="flex-1 mx-1.5">
                    <Text className="text-sm font-semibold text-gray-900 mb-2">Discount (%)</Text>
                    <TextInput
                      className="border border-gray-300 rounded-lg p-3 text-base text-gray-900 bg-white"
                      value={formData.discount}
                      onChangeText={(t) => setFormData({ ...formData, discount: t })}
                      keyboardType="numeric"
                      placeholder="0"
                    />
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-sm font-semibold text-gray-900 mb-2">Milk Type</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mb-2"
                    contentContainerStyle={{ paddingRight: 20 }}
                  >
                    {['Cow', 'Buffalo', 'Mixed', 'None'].map((t) => (
                      <TouchableOpacity
                        key={t}
                        className={`bg-gray-100 px-4 py-2 rounded-full mr-2 ${formData.milkType === t ? 'bg-blue-500' : ''}`}
                        onPress={() => setFormData({ ...formData, milkType: t })}
                      >
                        <Text
                          className={`text-sm ${formData.milkType === t ? 'text-white font-semibold' : 'text-gray-900'}`}
                        >
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Product Details Section */}
              <View className="mb-6">
                <View className="flex-row items-center mb-4 gap-2">
                  <Ionicons name="cube-outline" size={20} color={Colors.light.accent} />
                  <Text className="text-base font-semibold text-gray-900">Product Details</Text>
                </View>

                <View className="flex-row -mx-1.5">
                  <View className="flex-1 mx-1.5">
                    <Text className="text-sm font-semibold text-gray-900 mb-2">
                      Unit {autoFilledFields.has('unit') && '✓'}
                    </Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      className="mb-2"
                      contentContainerStyle={{ paddingRight: 20 }}
                    >
                      {['ml', 'liter', 'gm', 'kg', 'pack', 'piece'].map((u) => (
                        <TouchableOpacity
                          key={u}
                          className={`bg-gray-100 px-4 py-2 rounded-full mr-2 ${formData.unit === u ? 'bg-blue-500' : ''}`}
                          onPress={() => setFormData({ ...formData, unit: u })}
                        >
                          <Text
                            className={`text-sm ${formData.unit === u ? 'text-white font-semibold' : 'text-gray-900'}`}
                          >
                            {u}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <View className="flex-1 mx-1.5">
                    <Text className="text-sm font-semibold text-gray-900 mb-2">
                      Size {autoFilledFields.has('unitSize') && '✓'}
                    </Text>
                    <TextInput
                      className={`border rounded-lg p-3 text-base text-gray-900 bg-white ${autoFilledFields.has('unitSize') ? 'bg-blue-50 border-blue-500' : 'border-gray-300'}`}
                      value={formData.unitSize}
                      onChangeText={(t) => setFormData({ ...formData, unitSize: t })}
                      keyboardType="numeric"
                      placeholder="1"
                    />
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-sm font-semibold text-gray-900 mb-2">
                    Tags {autoFilledFields.has('tags') && '✓'}
                  </Text>
                  <TextInput
                    className={`border rounded-lg p-3 text-base text-gray-900 bg-white ${autoFilledFields.has('tags') ? 'bg-blue-50 border-blue-500' : 'border-gray-300'}`}
                    value={formData.tags}
                    onChangeText={(t) => setFormData({ ...formData, tags: t })}
                    placeholder="organic, fresh, premium (comma separated)"
                  />
                </View>
              </View>

              {/* Nutrition Information Section */}
              <View className="mb-6">
                <View className="flex-row items-center mb-4 gap-2">
                  <Ionicons name="nutrition-outline" size={20} color={Colors.light.accent} />
                  <Text className="text-base font-semibold text-gray-900">
                    Nutrition Information {autoFilledFields.has('nutritionalInfo') && '✓'}
                  </Text>
                  <Text className="text-xs text-gray-500 ml-auto">(per 100{formData.unit})</Text>
                </View>

                <View className="flex-row flex-wrap gap-3">
                  {['fat', 'protein', 'calories', 'carbohydrates'].map((key) => (
                    <View key={key} className="flex-1 min-w-[45%]">
                      <Text className="text-xs text-gray-500 mb-1 capitalize">
                        {key}
                      </Text>
                      <TextInput
                        className={`border rounded-lg p-2.5 text-sm text-gray-900 bg-white ${autoFilledFields.has('nutritionalInfo') ? 'bg-blue-50 border-blue-500' : 'border-gray-300'}`}
                        value={formData.nutritionalInfo[key]}
                        onChangeText={(t) =>
                          setFormData({
                            ...formData,
                            nutritionalInfo: { ...formData.nutritionalInfo, [key]: t },
                          })
                        }
                        keyboardType="numeric"
                        placeholder="0"
                      />
                    </View>
                  ))}
                </View>
              </View>

              {/* Settings Section */}
              <View className="mb-6">
                <View className="flex-row items-center mb-4 gap-2">
                  <Ionicons name="settings-outline" size={20} color={Colors.light.accent} />
                  <Text className="text-base font-semibold text-gray-900">Settings</Text>
                </View>

                <View className="gap-4">
                  <TouchableOpacity
                    className="flex-row items-start"
                    onPress={() => setFormData({ ...formData, isFeatured: !formData.isFeatured })}
                  >
                    <View
                      className={`w-5 h-5 rounded border-2 mr-3 justify-center items-center mt-0.5 ${formData.isFeatured ? 'bg-blue-500 border-blue-500' : 'border-gray-400'}`}
                    >
                      {formData.isFeatured && <Ionicons name="checkmark" size={16} color="#FFF" />}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-gray-900 mb-0.5">Featured Product</Text>
                      <Text className="text-xs text-gray-500">Show this product in featured section</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    className="flex-row items-start"
                    onPress={() =>
                      setFormData({ ...formData, isAvailable: !formData.isAvailable })
                    }
                  >
                    <View
                      className={`w-5 h-5 rounded border-2 mr-3 justify-center items-center mt-0.5 ${formData.isAvailable ? 'bg-blue-500 border-blue-500' : 'border-gray-400'}`}
                    >
                      {formData.isAvailable && <Ionicons name="checkmark" size={16} color="#FFF" />}
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-gray-900 mb-0.5">Available for Sale</Text>
                      <Text className="text-xs text-gray-500">Product is available in store</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View className="flex-row p-5 border-t border-gray-300 gap-3">
              <TouchableOpacity
                className="flex-1 bg-gray-100 py-3.5 rounded-lg items-center"
                onPress={closeModal}
                disabled={uploading}
              >
                <Text className="text-base font-semibold text-gray-900">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 bg-blue-500 py-3.5 rounded-lg items-center ${uploading ? 'opacity-60' : ''}`}
                onPress={handleSubmit}
                disabled={uploading}
              >
                {uploading ? (
                  <View className="flex-row items-center gap-2">
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text className="text-white font-semibold text-base">
                      {editingProduct ? 'Updating...' : 'Creating...'}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-white font-semibold text-base">
                    {editingProduct ? 'Update Product' : 'Create Product'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Categories Management Modal */}
      <Modal
        visible={categoriesModalVisible}
        animationType="slide"
        onRequestClose={closeCategoryModal}
      >
        <View className="flex-1 bg-black/50">
          <View className="flex-1 bg-white mt-12 rounded-t-3xl">
            <View className="flex-row justify-between items-start p-5 border-b border-gray-300">
              <View>
                <Text className="text-xl font-bold text-gray-900">Manage Categories</Text>
                <Text className="text-sm text-gray-500 mt-1">
                  Create, edit, or delete product categories
                </Text>
              </View>
              <TouchableOpacity
                className="p-1"
                onPress={closeCategoryModal}
                disabled={isSubmittingCategory}
              >
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            {/* Remove the wrapper View and use CategoriesList directly */}
            <CategoriesList />

            <View className="flex-row p-5 border-t border-gray-300 gap-3">
              <TouchableOpacity
                className={`flex-1 bg-gray-100 py-3.5 rounded-lg items-center ${isSubmittingCategory ? 'opacity-60' : ''}`}
                onPress={closeCategoryModal}
                disabled={isSubmittingCategory}
              >
                <Text className="text-base font-semibold text-gray-900">Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 bg-blue-500 py-3.5 rounded-lg items-center ${isSubmittingCategory ? 'opacity-60' : ''}`}
                onPress={openCategoryCreateModal}
                disabled={isSubmittingCategory}
              >
                <Text className="text-base font-semibold text-white">Add New Category</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Form Modal */}
      <Modal
        visible={categoryFormModalVisible}
        animationType="slide"
        onRequestClose={closeCategoryFormModal}
        statusBarTranslucent={false}
        avoidKeyboard
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl max-h-[95%]">
            {/* header ... */}
            <View className="flex-row justify-between items-start p-5 border-b border-gray-300">
              <View>
                <Text className="text-xl font-bold text-gray-900">
                  {editingCategory ? 'Edit Category' : 'Create New Category'}
                </Text>
                <Text className="text-sm text-gray-500 mt-1">
                  {editingCategory ? 'Update category information' : 'Add a new product category'}
                </Text>
              </View>
              <TouchableOpacity
                className="p-1"
                onPress={closeCategoryFormModal}
                disabled={isSubmittingCategory}
              >
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <CategoryForm
              initialData={categoryFormData}
              onSubmit={handleCategorySubmit}      // gets localForm as argument
              onCancel={closeCategoryFormModal}
              isSubmittingCategory={isSubmittingCategory}
              categories={categories}
              pickCategoryImage={pickCategoryImage}
            />
          </View>
        </View>
      </Modal>



      {/* Barcode Scanner Modal for Product Creation */}
      <Modal
        visible={barcodeScannerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBarcodeScannerVisible(false)}
      >
        <View className="flex-1 bg-black/90 justify-center items-center">
          <View className="bg-black rounded-3xl w-full h-full">
            <View className="flex-row justify-between items-start p-5 bg-black/80 pt-16">
              <View>
                <Text className="text-xl font-bold text-white">Scan Product Barcode</Text>
                <Text className="text-sm text-white/70 mt-1">
                  Position barcode within the frame to auto-fill product details
                </Text>
              </View>
              <TouchableOpacity
                className="p-1"
                onPress={() => setBarcodeScannerVisible(false)}
              >
                <MaterialIcons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            <View className="flex-1 rounded-2xl overflow-hidden m-5">
              <CameraView
                className="flex-1"
                facing={'back'}
                barcodeScannerSettings={{
                  barcodeTypes: [
                    'ean13',
                    'ean8',
                    'upc_a',
                    'upc_e',
                    'code39',
                    'code128',
                    'itf14'
                  ],
                }}
                onBarcodeScanned={({ data }) => handleBarcodeScannedForProduct(data)}
              />
              <View className="absolute inset-0 bg-transparent justify-center items-center">
                <View className="items-center">
                  <View className="w-64 h-40 border-2 border-white rounded-xl bg-transparent" />
                  <Text className="text-white text-base font-semibold mt-5 text-center bg-black/70 px-4 py-2 rounded-lg">
                    Align barcode within the frame
                  </Text>
                </View>
              </View>
            </View>

            <View className="p-5 bg-black/80 items-center">
              <Text className="text-sm text-white/70 text-center mb-4">
                Scanning will automatically fetch product details, images, and nutritional information
              </Text>
              <TouchableOpacity
                className="bg-white/20 px-6 py-3 rounded-lg"
                onPress={() => setBarcodeScannerVisible(false)}
              >
                <Text className="text-white font-semibold text-base">Cancel Scan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Product Data Preview Modal with Enhanced Loading */}
      <Modal
        visible={productDataPreviewVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setProductDataPreviewVisible(false);
          setFetchedProductData(null);
          setScannedBarcode('');
        }}
      >
        <View className="flex-1 bg-black/70 justify-center items-center px-4">
          <View className="bg-white rounded-2xl p-5 w-full max-w-[400px] max-h-[80%]">
            <View className="flex-row justify-between items-start mb-5">
              <View>
                <Text className="text-xl font-bold text-gray-900">
                  {fetchingProductData ? '🔍 Scanning Barcode...' :
                    fetchedProductData?.found ? '🎉 Product Data Found!' : '📝 Create New Product'}
                </Text>
                <Text className="text-sm text-gray-500 mt-1">
                  {fetchingProductData ? 'Fetching product information...' :
                    `Barcode: ${scannedBarcode}${fetchedProductData?.dataSource === 'openfoodfacts' ? ' • From OpenFoodFacts' : ''}`}
                </Text>
              </View>
              {!fetchingProductData && (
                <TouchableOpacity
                  className="p-1"
                  onPress={() => {
                    setProductDataPreviewVisible(false);
                    setFetchedProductData(null);
                    setScannedBarcode('');
                  }}
                >
                  <MaterialIcons name="close" size={24} color={Colors.light.text} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView className="mb-5">
              {fetchingProductData ? (
                <View className="items-center p-10">
                  <ActivityIndicator size="large" color={Colors.light.accent} />
                  <ProgressBar progress={submissionProgress} />
                  <Text className="text-base font-semibold text-gray-900 mt-4 text-center">Scanning barcode and fetching product data...</Text>
                  <Text className="text-sm text-gray-500 mt-2 text-center">
                    This may take a few seconds as we gather product information and images
                  </Text>
                </View>
              ) : applyingProductData ? (
                <View className="items-center p-10">
                  <ActivityIndicator size="large" color={Colors.light.accent} />
                  <ProgressBar progress={submissionProgress} />
                  <Text className="text-base font-semibold text-gray-900 mt-4 text-center">Applying product data to form...</Text>
                  <Text className="text-sm text-gray-500 mt-2 text-center">
                    Preparing form with product information and images
                  </Text>
                </View>
              ) : fetchedProductData ? (
                <View className="gap-4">

                  {/* Data Source Info */}
                  <View className={`flex-row items-start p-3 rounded-lg border-l-4 gap-2 ${fetchedProductData.found ? 'bg-green-100 border-l-green-500' : 'bg-blue-100 border-l-blue-500'}`}>
                    <Ionicons
                      name={fetchedProductData.found ? "checkmark-circle" : "information-circle"}
                      size={20}
                      color={fetchedProductData.found ? "#4CAF50" : "#2196F3"}
                    />
                    <Text className={`text-sm flex-1 ${fetchedProductData.found ? 'text-green-800' : 'text-blue-800'}`}>
                      {fetchedProductData.found
                        ? 'Product data found online! Review and complete the information below.'
                        : 'No product data found. Please fill in the details manually.'}
                    </Text>
                  </View>

                  {/* Product Images */}
                  {fetchedProductData.images && Array.isArray(fetchedProductData.images) && fetchedProductData.images.length > 0 && (
                    <View className="mb-4">
                      <Text className="text-base font-semibold text-gray-900 mb-2">
                        Product Images ({fetchedProductData.images.length})
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View className="flex-row gap-2 py-2">
                          {fetchedProductData.images.map((image, index) => {
                            if (!image || !image.url) return null;

                            return (
                              <View key={index} className="relative mr-2 rounded-lg overflow-hidden border border-gray-300">
                                <Image
                                  source={{ uri: image.url }}
                                  className="w-24 h-24 rounded-lg"
                                  resizeMode="cover"
                                  onError={(e) => console.log(`Image ${index} load error:`, e.nativeEvent.error)}
                                />
                                <View className="absolute bottom-1 left-1 bg-black/70 px-1.5 py-0.5 rounded">
                                  <Text className="text-xs text-white font-semibold">
                                    {image.type === 'front' ? 'Main' : `Image ${index + 1}`}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </ScrollView>
                      <Text className="text-xs text-gray-500 italic mt-2">
                        {fetchedProductData.images.find(img => img && img.type === 'front')
                          ? 'Front product image will be used as main image.'
                          : 'First image will be used as main product image.'
                        }
                      </Text>
                    </View>
                  )}

                  {/* Product Information */}
                  <View className="mb-4">
                    <Text className="text-base font-semibold text-gray-900 mb-2">Product Information</Text>

                    {fetchedProductData.name && (
                      <View className="mb-3">
                        <Text className="text-sm font-semibold text-gray-900 mb-1">
                          Product Name {fetchedProductData.autoFilledFields?.name && '✓'}
                        </Text>
                        <Text className="text-base text-gray-900 bg-gray-100 p-3 rounded-lg border border-gray-300">{fetchedProductData.name}</Text>
                      </View>
                    )}

                    {fetchedProductData.description && (
                      <View className="mb-3">
                        <Text className="text-sm font-semibold text-gray-900 mb-1">
                          Description {fetchedProductData.autoFilledFields?.description && '✓'}
                        </Text>
                        <Text className="text-base text-gray-900 bg-gray-100 p-3 rounded-lg border border-gray-300">{fetchedProductData.description}</Text>
                      </View>
                    )}

                    {fetchedProductData.brand && (
                      <View className="mb-3">
                        <Text className="text-sm font-semibold text-gray-900 mb-1">Brand</Text>
                        <Text className="text-base text-gray-900 bg-gray-100 p-3 rounded-lg border border-gray-300">{fetchedProductData.brand}</Text>
                      </View>
                    )}
                  </View>

                  {/* Product Details */}
                  <View className="mb-4">
                    <Text className="text-base font-semibold text-gray-900 mb-2">Product Details</Text>

                    <View className="flex-row gap-3 mb-3">
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-gray-900 mb-1">
                          Unit {fetchedProductData.autoFilledFields?.unit && '✓'}
                        </Text>
                        <Text className="text-base text-gray-900 bg-gray-100 p-3 rounded-lg border border-gray-300">{fetchedProductData.unit || 'piece'}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-gray-900 mb-1">
                          Size {fetchedProductData.autoFilledFields?.unitSize && '✓'}
                        </Text>
                        <Text className="text-base text-gray-900 bg-gray-100 p-3 rounded-lg border border-gray-300">{fetchedProductData.unitSize || '1'}</Text>
                      </View>
                    </View>

                    {fetchedProductData.milkType && (
                      <View className="mb-3">
                        <Text className="text-sm font-semibold text-gray-900 mb-1">
                          Milk Type {fetchedProductData.autoFilledFields?.milkType && '✓'}
                        </Text>
                        <Text className="text-base text-gray-900 bg-gray-100 p-3 rounded-lg border border-gray-300">{fetchedProductData.milkType}</Text>
                      </View>
                    )}

                    {fetchedProductData.categories && Array.isArray(fetchedProductData.categories) && fetchedProductData.categories.length > 0 && (
                      <View className="mb-3">
                        <Text className="text-sm font-semibold text-gray-900 mb-1">
                          Suggested Categories {fetchedProductData.autoFilledFields?.category && '✓'}
                        </Text>
                        <Text className="text-base text-gray-900 bg-gray-100 p-3 rounded-lg border border-gray-300">{fetchedProductData.categories.join(', ')}</Text>
                      </View>
                    )}
                  </View>

                  {/* Required Fields Warning */}
                  {fetchedProductData.missingRequiredFields &&
                    Object.values(fetchedProductData.missingRequiredFields).some(val => val) && (
                      <View className="flex-row items-start p-3 rounded-lg border-l-4 border-l-orange-500 bg-orange-100 gap-2">
                        <Ionicons name="warning" size={20} color="#FF9800" />
                        <View className="flex-1">
                          <Text className="text-sm font-semibold text-orange-800 mb-1">Required Fields Missing</Text>
                          <Text className="text-sm text-orange-700">
                            Please fill in these required fields:{' '}
                            {Object.entries(fetchedProductData.missingRequiredFields)
                              .filter(([_, isMissing]) => isMissing)
                              .map(([field]) => {
                                const fieldNames = {
                                  name: 'Product Name',
                                  price: 'Price',
                                  category: 'Category',
                                  unit: 'Unit'
                                };
                                return fieldNames[field] || field;
                              })
                              .join(', ')}
                          </Text>
                        </View>
                      </View>
                    )}

                  {/* Action Instructions */}
                  <View className="flex-row items-start p-3 rounded-lg border-l-4 border-l-blue-500 bg-blue-100 gap-2">
                    <Ionicons name="help-circle" size={20} color="#2196F3" />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-blue-800 mb-1">Next Steps</Text>
                      <Text className="text-sm text-blue-700">
                        Choose "Apply to Form" to auto-fill available data, then complete any missing information before saving.
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View className="items-center p-10">
                  <Text className="text-lg font-semibold text-gray-900">No product data available</Text>
                </View>
              )}
            </ScrollView>

            {!fetchingProductData && !applyingProductData && (
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className="flex-1 bg-gray-100 py-3.5 rounded-lg items-center"
                  onPress={() => {
                    setProductDataPreviewVisible(false);
                    setFetchedProductData(null);
                    setScannedBarcode('');
                  }}
                  disabled={applyingProductData}
                >
                  <Text className="text-base font-semibold text-gray-900">Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className={`flex-1 bg-blue-500 py-3.5 rounded-lg items-center flex-row justify-center gap-2 ${applyingProductData ? 'opacity-60' : ''}`}
                  onPress={handleApplyProductDataToForm}
                  disabled={applyingProductData || !fetchedProductData}
                >
                  {applyingProductData ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="document-text" size={20} color="#FFF" />
                      <Text className="text-white font-semibold text-base">Apply to Form</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Existing Barcode Modal for Product Management */}
      <Modal
        visible={barcodeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeBarcodeModal}
      >
        <View className="flex-1 bg-black/75 justify-center items-center px-4">
          <View className="bg-white rounded-2xl p-5 w-full max-w-[400px] max-h-[85%] shadow-2xl">
            <View className="flex-row justify-between items-start w-full mb-4">
              <View>
                <Text className="text-xl font-bold text-gray-900">Product Barcode</Text>
                <Text className="text-sm text-gray-500 mt-1">
                  {selectedProductForBarcode?.name}
                </Text>
              </View>
              <TouchableOpacity
                className="p-1"
                onPress={closeBarcodeModal}
              >
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            {showCamera ? (
              <View className="flex-1 rounded-2xl overflow-hidden m-5">
                <CameraView
                  className="flex-1"
                  facing={'back'}
                  barcodeScannerSettings={{
                    barcodeTypes: [
                      'ean13',
                      'ean8',
                      'upc_a',
                      'upc_e',
                      'code39',
                      'code128',
                      'itf14'
                    ],
                  }}
                  onBarcodeScanned={barcodeScanning ? onBarcodeScanned : undefined}
                  ref={cameraRef}
                />
                <View className="absolute inset-0 bg-transparent justify-center items-center">
                  <View className="items-center">
                    <View className="w-64 h-40 border-2 border-white rounded-xl bg-transparent" />
                    <Text className="text-white text-base font-semibold mt-5 text-center">
                      Point camera at barcode to scan
                    </Text>
                  </View>
                  <TouchableOpacity
                    className="bg-white/20 px-6 py-3 rounded-lg mt-8"
                    onPress={stopBarcodeScan}
                  >
                    <Text className="text-white font-semibold text-base">Cancel Scan</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <ScrollView
                className="w-full"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
              >
                <View className="p-4 bg-gray-100 rounded-2xl border-2 border-gray-300 mb-4 items-center w-full">
                  {/* Generated Barcode Section */}
                  {selectedProductForBarcode?.barcodeUrl && (
                    <View className="w-full mb-6">
                      <View className="flex-row items-center mb-3 gap-2">
                        <Ionicons name="qr-code-outline" size={20} color="#4CAF50" />
                        <Text className="text-base font-semibold text-gray-900">Generated Barcode</Text>
                      </View>
                      <ViewShot
                        ref={viewShotRef}
                        options={{ format: 'png', quality: 1 }}
                        className="p-4 bg-gray-50 rounded-xl border-2 border-green-200 items-center mb-2 w-full"
                      >
                        <Image
                          source={{ uri: selectedProductForBarcode.barcodeUrl }}
                          className="w-56 h-32 rounded-lg"
                          resizeMode="contain"
                        />
                        <View className="mt-2 bg-green-500/90 px-3 py-1.5 rounded">
                          <Text className="text-white text-xs font-semibold font-mono">Product ID: {selectedProductForBarcode.barcodeId}</Text>
                        </View>
                      </ViewShot>
                      <Text className="text-xs text-gray-500 text-center italic">
                        System-generated barcode using product ID
                      </Text>
                    </View>
                  )}

                  {/* Scanned Barcode Section */}
                  {selectedProductForBarcode?.scannedBarcodeId && (
                    <View className="w-full mb-6">
                      <View className="flex-row items-center mb-3 gap-2">
                        <Ionicons name="scan-outline" size={20} color="#2196F3" />
                        <Text className="text-base font-semibold text-gray-900">Scanned Barcode</Text>
                      </View>
                      <View className="items-center bg-blue-50 p-4 rounded-xl border-2 border-blue-300 border-dashed mb-2 w-full">
                        <View className="bg-blue-100 p-3 rounded-lg mb-3">
                          <Ionicons name="barcode-outline" size={32} color="#2196F3" />
                        </View>
                        <Text className="text-base font-bold text-gray-900 font-mono mb-2 text-center">{selectedProductForBarcode.scannedBarcodeId}</Text>
                        <Text className="text-xs text-gray-500 text-center">
                          External barcode scanned and assigned
                        </Text>
                      </View>
                      <Text className="text-xs text-gray-500 text-center italic">
                        Physical barcode scanned from product packaging
                      </Text>
                    </View>
                  )}

                  {/* Divider when both exist */}
                  {selectedProductForBarcode?.barcodeUrl && selectedProductForBarcode?.scannedBarcodeId && (
                    <View className="flex-row items-center my-4">
                      <View className="flex-1 h-px bg-gray-400" />
                      <Text className="text-xs text-gray-500 font-semibold mx-3 bg-gray-100 px-2">Both Barcodes Active</Text>
                      <View className="flex-1 h-px bg-gray-400" />
                    </View>
                  )}

                  {/* No Barcode State */}
                  {!selectedProductForBarcode?.barcodeUrl && !selectedProductForBarcode?.scannedBarcodeId && (
                    <View className="items-center py-8">
                      <Ionicons name="barcode-outline" size={56} color={Colors.light.textSecondary} />
                      <Text className="text-lg font-semibold text-gray-900 mt-3">No Barcode Assigned</Text>
                      <Text className="text-sm text-gray-500 mt-2 text-center">
                        Generate a barcode or scan an external barcode
                      </Text>
                    </View>
                  )}
                </View>

                <View className="w-full gap-3">
                  {selectedProductForBarcode?.barcodeUrl ? (
                    // Has generated barcode
                    <>
                      <TouchableOpacity
                        className="flex-row items-center justify-center bg-green-500 px-5 py-3.5 rounded-xl gap-2.5"
                        onPress={downloadBarcode}
                      >
                        <Ionicons name="download-outline" size={20} color="#FFF" />
                        <Text className="text-white font-semibold text-base">Save Generated Barcode</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-row items-center justify-center bg-blue-500 px-5 py-3.5 rounded-xl gap-2.5"
                        onPress={startBarcodeScan}
                      >
                        <Ionicons name="scan-outline" size={20} color="#FFF" />
                        <Text className="text-white font-semibold text-base">
                          {selectedProductForBarcode?.scannedBarcodeId ? 'Rescan Barcode' : 'Scan External Barcode'}
                        </Text>
                      </TouchableOpacity>
                      <View className="flex-row gap-2">
                        {selectedProductForBarcode?.scannedBarcodeId && (
                          <TouchableOpacity
                            className="flex-1 flex-row items-center justify-center bg-red-50 px-4 py-3 rounded-xl gap-2 border border-red-500"
                            onPress={removeScannedBarcode}
                          >
                            <Ionicons name="trash-outline" size={18} color="#F44336" />
                            <Text className="text-red-500 font-semibold text-sm">Remove Scanned</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          className="flex-1 flex-row items-center justify-center bg-red-50 px-4 py-3 rounded-xl gap-2 border border-red-500"
                          onPress={removeGeneratedBarcode}
                        >
                          <Ionicons name="trash-outline" size={18} color="#F44336" />
                          <Text className="text-red-500 font-semibold text-sm">Remove Generated</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : selectedProductForBarcode?.scannedBarcodeId ? (
                    // Has scanned barcode but no generated
                    <>
                      <TouchableOpacity
                        className="flex-row items-center justify-center bg-blue-500 px-5 py-3.5 rounded-xl gap-2.5"
                        onPress={generateBarcode}
                        disabled={barcodeScanning}
                      >
                        {barcodeScanning ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <Ionicons name="sparkles" size={20} color="#FFF" />
                            <Text className="text-white font-semibold text-base">Generate Barcode</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-row items-center justify-center bg-blue-500 px-5 py-3.5 rounded-xl gap-2.5"
                        onPress={startBarcodeScan}
                      >
                        <Ionicons name="scan-outline" size={20} color="#FFF" />
                        <Text className="text-white font-semibold text-base">Rescan Barcode</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-row items-center justify-center bg-red-50 px-5 py-3.5 rounded-xl gap-2 border border-red-500"
                        onPress={removeScannedBarcode}
                      >
                        <Ionicons name="trash-outline" size={20} color="#F44336" />
                        <Text className="text-red-500 font-semibold text-base">Remove Scanned Barcode</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    // No barcode at all
                    <>
                      <TouchableOpacity
                        className="flex-row items-center justify-center bg-blue-500 px-5 py-3.5 rounded-xl gap-2.5"
                        onPress={generateBarcode}
                        disabled={barcodeScanning}
                      >
                        {barcodeScanning ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <Ionicons name="sparkles" size={20} color="#FFF" />
                            <Text className="text-white font-semibold text-base">Generate Barcode</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="flex-row items-center justify-center bg-blue-500 px-5 py-3.5 rounded-xl gap-2.5"
                        onPress={startBarcodeScan}
                      >
                        <Ionicons name="scan-outline" size={20} color="#FFF" />
                        <Text className="text-white font-semibold text-base">Scan External Barcode</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}