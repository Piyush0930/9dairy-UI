import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
      setCategories(Array.isArray(data) ? data : data.categories || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
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
    setCategoriesModalVisible(true);
  };

  const openCategoryEditModal = (category) => {
    setEditingCategory(category);
    setCategoryFormData({
      name: category.name || '',
      description: category.description || '',
      image: category.image || '',
      displayOrder: category.displayOrder || 0,
    });
    setCategoriesModalVisible(true);
  };

  const closeCategoryModal = () => {
    setCategoriesModalVisible(false);
    setEditingCategory(null);
    setCategoryFormData({
      name: '',
      description: '',
      image: '',
      displayOrder: 0,
    });
  };

  const handleCategorySubmit = async () => {
    if (!categoryFormData.name.trim()) {
      Alert.alert('Error', 'Category name is required.');
      return;
    }

    const isValid = await validateAuthBeforeCall();
    if (!isValid) return;

    setIsSubmittingCategory(true);

    try {
      let imageUrl = categoryFormData.image;

      // If image is a local URI, upload it first
      if (categoryFormData.image && categoryFormData.image.startsWith('file:')) {
        startOperation('Uploading category image...');
        
        const uploadFormData = new FormData();
        uploadFormData.append('image', {
          uri: categoryFormData.image,
          type: 'image/jpeg',
          name: `category-${Date.now()}.jpg`,
        });

        const uploadResponse = await fetch(`${API_BASE_URL}/api/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload image');
        }

        const uploadData = await uploadResponse.json();
        imageUrl = uploadData.imageUrl;
      }

      const url = editingCategory
        ? `${API_BASE_URL}/api/catalog/categories/${editingCategory._id}`
        : `${API_BASE_URL}/api/catalog/categories`;

      const method = editingCategory ? 'PUT' : 'POST';

      const payload = {
        name: categoryFormData.name.trim(),
        description: categoryFormData.description?.trim() || '',
        displayOrder: categoryFormData.displayOrder,
        image: imageUrl || '',
      };

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Success', `Category ${editingCategory ? 'updated' : 'created'} successfully!`);
        closeCategoryModal();
        fetchCategories();
      } else {
        throw new Error(data.message || 'Failed to save category');
      }
    } catch (error) {
      console.error('Category submit error:', error);
      Alert.alert('Error', error.message || 'Failed to save category. Please try again.');
    } finally {
      setIsSubmittingCategory(false);
      endOperation();
    }
  };

  const handleCategoryDelete = async (categoryId, categoryName) => {
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
              const response = await fetch(`${API_BASE_URL}/api/catalog/categories/${categoryId}`, {
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
        
        setFormData(prev => ({
          ...prev,
          image: {
            uri: selectedImage.uri,
            type: 'image/jpeg',
            name: selectedImage.fileName || `product-${Date.now()}.jpg`,
          }
        }));
        setImageUri(selectedImage.uri);
        
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
        
        setFormData(prev => ({
          ...prev,
          image: {
            uri: selectedImage.uri,
            type: 'image/jpeg',
            name: `product-photo-${Date.now()}.jpg`,
          }
        }));
        setImageUri(selectedImage.uri);
        
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

    // Validate barcode
    if (!barcode || typeof barcode !== 'string' || barcode.trim() === '') {
      throw new Error('Invalid barcode');
    }

    const cleanBarcode = barcode.trim();
    console.log('📦 Sending barcode to backend:', cleanBarcode);

    updateProgress(30);
    
    // 🎯 FIX: Use the correct endpoint for scanning new barcodes
    const response = await fetch(`${API_BASE_URL}/api/catalog/products/scan-barcode`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        barcode: cleanBarcode  // ✅ Correct field name
      })
    });

    updateProgress(60);
    const data = await response.json();
    console.log('📦 Scan Response:', data);

    if (!response.ok) {
      throw new Error(data.message || 'Failed to scan barcode');
    }

    // 🎯 FIX: Handle the actual response structure from scan-barcode endpoint
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

    updateProgress(80);
    
    // 🎯 FIX: Process the actual response structure from scan-barcode endpoint
    const productData = {
      found: Boolean(data.openFoodFactsData?.found),
      barcode: (data.openFoodFactsData?.barcode || cleanBarcode || '').toString(),
      name: data.suggestedData?.name || `Product ${cleanBarcode}`,
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
      let mainImageUri = '';
      
      if (downloadedImages.length > 0) {
        const frontImage = downloadedImages.find(img => img && img.type === 'front') || downloadedImages[0];
        if (frontImage && frontImage.url) {
          mainImageUri = frontImage.url;
          console.log('✅ Main image set:', mainImageUri);
        }
      }

      updateProgress(80);
      const cloudinaryImages = downloadedImages
        .filter(img => img && img.url)
        .map(img => ({
          url: img.url,
          publicId: img.publicId || null,
          type: img.type || 'product'
        }));

      setFormData(prev => ({ 
        ...prev, 
        ...updates,
        scannedBarcodeId: scannedBarcode || fetchedProductData.barcode,
        cloudinaryImages: cloudinaryImages
      }));
      
      if (mainImageUri) {
        setImageUri(mainImageUri);
        console.log('🖼️ Image URI set for preview');
      } else {
        console.log('⚠️ No main image available');
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
        `Product data applied! ${imageMessage} Please review and save.`
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
      
      // Append barcode if available
      if (scannedBarcode && !editingProduct) {
        submitFormData.append('scannedBarcodeId', scannedBarcode);
      }

      updateProgress(30);
      
      // Handle image upload - use cloudinaryImages if available, otherwise use local image
      if (formData.cloudinaryImages && formData.cloudinaryImages.length > 0) {
        console.log('📤 Using Cloudinary images:', formData.cloudinaryImages.length);
        // For Cloudinary images, we'll send them as part of the form data
        formData.cloudinaryImages.forEach((img, index) => {
          if (img.url) {
            submitFormData.append(`cloudinaryImages[${index}][url]`, img.url);
            if (img.publicId) {
              submitFormData.append(`cloudinaryImages[${index}][publicId]`, img.publicId);
            }
            if (img.type) {
              submitFormData.append(`cloudinaryImages[${index}][type]`, img.type);
            }
          }
        });
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
        ? `${API_BASE_URL}/api/catalog/products/${editingProduct._id}`
        : `${API_BASE_URL}/api/catalog/products`;

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
      Alert.alert('Success!', `Product ${editingProduct ? 'updated' : 'created'} successfully.`, [
        { text: 'OK', onPress: () => {
          closeModal();
          fetchData();
        }}
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

    console.log('🔍 DEBUG - Barcode Assignment Details:', {
      productId: selectedProductForBarcode._id,
      productName: selectedProductForBarcode.name,
      productObject: selectedProductForBarcode,
      barcode: data,
      apiUrl: `${API_BASE_URL}/api/catalog/products/${selectedProductForBarcode._id}/scan-barcode`
    });

    // 🎯 FIX: Use the correct product ID from selectedProductForBarcode
    const response = await fetch(
      `${API_BASE_URL}/api/catalog/products/${selectedProductForBarcode._id}/scan-barcode`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ scannedBarcodeId: data }),
      }
    );

    console.log('🔍 DEBUG - Response Status:', response.status);
    
    const result = await response.json();
    console.log('🔍 DEBUG - Response Data:', result);
    
    if (response.ok) {
      Alert.alert('Success', 'Scanned barcode assigned successfully!');
      
      updateProductState(selectedProductForBarcode._id, {
        scannedBarcodeId: data,
      });
      
      closeBarcodeModal();
    } else {
      Alert.alert('Error', result.message || 'Failed to assign scanned barcode');
    }
  } catch (error) {
    console.error('❌ Barcode Assignment Error:', error);
    console.log('🔍 DEBUG - Error Details:', {
      message: error.message,
      productId: selectedProductForBarcode?._id,
      apiUrl: `${API_BASE_URL}/api/catalog/products/${selectedProductForBarcode?._id}/scan-barcode`
    });
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
          
          // 🎯 FIX: Use the correct product ID
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
          
          // 🎯 FIX: Use the correct product ID
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
    
    // 🎯 FIX: Use the correct product ID
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
    <View style={[styles.progressBarContainer, { height }]}>
      <View 
        style={[
          styles.progressBar, 
          { 
            width: `${progress}%`,
            backgroundColor: color
          }
        ]} 
      />
    </View>
  );

  // ──────────────────────────────────────────────────────────────
  // LOADING OVERLAY COMPONENT
  // ──────────────────────────────────────────────────────────────
  const LoadingOverlay = ({ message, progress, showProgress = false }) => (
    <View style={styles.loadingOverlay}>
      <View style={styles.loadingContent}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingMessage}>{message}</Text>
        {showProgress && progress !== undefined && (
          <>
            <ProgressBar progress={progress} />
            <Text style={styles.progressText}>{Math.round(progress)}%</Text>
          </>
        )}
      </View>
    </View>
  );

  // ──────────────────────────────────────────────────────────────
  // HORIZONTAL CATEGORIES COMPONENT
  // ──────────────────────────────────────────────────────────────
  const HorizontalCategories = () => (
    <View style={styles.categoriesSection}>
      <View style={styles.categoriesHeader}>
        <Text style={styles.categoriesTitle}>Categories</Text>
        <TouchableOpacity 
          style={styles.manageCategoriesButton}
          onPress={() => setCategoriesModalVisible(true)}
        >
          <Text style={styles.manageCategoriesText}>Manage</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoriesScrollContent}
      >
        {/* All Categories Option */}
        <TouchableOpacity 
          style={styles.categoryCircle}
          onPress={() => setSelectedCategory(null)}
        >
          <View style={[
            styles.categoryCircleImageContainer,
            selectedCategory === null && styles.categorySelected
          ]}>
            <View style={styles.categoryCirclePlaceholder}>
              <MaterialIcons name="all-inclusive" size={24} color={selectedCategory === null ? "#FFF" : Colors.light.textSecondary} />
            </View>
            {selectedCategory === null && (
              <View style={styles.categorySelectedIndicator}>
                <Ionicons name="checkmark" size={16} color="#FFF" />
              </View>
            )}
          </View>
          <Text style={[
            styles.categoryCircleName,
            selectedCategory === null && styles.categoryNameSelected
          ]}>
            All
          </Text>
        </TouchableOpacity>

        {categories.map((category) => (
          <TouchableOpacity 
            key={category._id} 
            style={styles.categoryCircle}
            onPress={() => setSelectedCategory(category._id)}
          >
            <View style={[
              styles.categoryCircleImageContainer,
              selectedCategory === category._id && styles.categorySelected
            ]}>
              {category.image ? (
                <Image 
                  source={{ uri: category.image }} 
                  style={styles.categoryCircleImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.categoryCirclePlaceholder}>
                  <MaterialIcons name="category" size={24} color={selectedCategory === category._id ? "#FFF" : Colors.light.textSecondary} />
                </View>
              )}
              {selectedCategory === category._id && (
                <View style={styles.categorySelectedIndicator}>
                  <Ionicons name="checkmark" size={16} color="#FFF" />
                </View>
              )}
            </View>
            <Text style={[
              styles.categoryCircleName,
              selectedCategory === category._id && styles.categoryNameSelected
            ]} numberOfLines={1}>
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}
        
        {/* Add Category Button */}
        <TouchableOpacity 
          style={styles.addCategoryCircle}
          onPress={openCategoryCreateModal}
        >
          <View style={styles.addCategoryCircleInner}>
            <Ionicons name="add" size={24} color={Colors.light.accent} />
          </View>
          <Text style={styles.addCategoryText}>Add New</Text>
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
        style={styles.productCard}
        onPress={() => openEditModal(item)}
        activeOpacity={0.7}
      >
        {/* Product Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ 
              uri: item.image || 'https://via.placeholder.com/100'
            }}
            style={styles.productImage}
            resizeMode="cover"
          />
          {/* Featured Badge */}
          {item.isFeatured && (
            <View style={styles.featuredBadge}>
              <Ionicons name="star" size={12} color="#FFF" />
              <Text style={styles.featuredText}>Featured</Text>
            </View>
          )}
          {/* Out of Stock Overlay */}
          {isOutOfStock && (
            <View style={styles.outOfStockOverlay}>
              <Text style={styles.outOfStockText}>Out of Stock</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          {/* Title Row */}
          <View style={styles.titleRow}>
            <Text style={styles.productName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.unitText}>{unitDisplay}</Text>
          </View>

          {/* Category */}
          <Text style={styles.productCategory} numberOfLines={1}>
            {item.category?.name || 'Uncategorized'}
          </Text>

          {/* Description */}
          {item.description && (
            <Text style={styles.productDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Barcode Info - Show Both Types */}
          {(item.barcodeId || item.scannedBarcodeId) && (
            <View style={styles.barcodeInfo}>
              <Ionicons name="barcode-outline" size={12} color={Colors.light.textSecondary} />
              <View style={styles.barcodeTypes}>
                {item.scannedBarcodeId && (
                  <View style={styles.barcodeTypeItem}>
                    <Text style={styles.barcodeText} numberOfLines={1}>
                      {item.scannedBarcodeId}
                    </Text>
                    <View style={[styles.barcodeBadge, styles.scannedBadge]}>
                      <Text style={styles.barcodeBadgeText}>Scanned</Text>
                    </View>
                  </View>
                )}
                {item.barcodeId && (
                  <View style={styles.barcodeTypeItem}>
                    <Text style={styles.barcodeText} numberOfLines={1}>
                      {item.barcodeId}
                    </Text>
                    <View style={[styles.barcodeBadge, styles.generatedBadge]}>
                      <Text style={styles.barcodeBadgeText}>Generated</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Price & Stock Row */}
          <View style={styles.bottomRow}>
            <View style={styles.priceSection}>
              <Text style={styles.productPrice}>₹{item.price}</Text>
              {discount && (
                <View style={styles.discountContainer}>
                  <Text style={styles.discountBadge}>{discount}</Text>
                </View>
              )}
            </View>
            <Text style={[
              styles.stockText, 
              isOutOfStock && styles.outOfStockText
            ]}>
              {item.stock} in stock
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.barcodeButton]}
            onPress={(e) => {
              e.stopPropagation();
              openBarcodeModal(item);
            }}
          >
            <Ionicons name="barcode-outline" size={20} color="#4CAF50" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
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
    <View style={styles.emptyContainer}>
      <MaterialIcons name="inventory-2" size={56} color={Colors.light.textSecondary} />
      <Text style={styles.emptyText}>
        {searchQuery || selectedCategory ? 'No products found' : 'No products yet'}
      </Text>
      <Text style={styles.emptySubtext}>
        {searchQuery
          ? 'Try a different search term'
          : selectedCategory
          ? 'No products in this category'
          : 'Add your first product to get started'}
      </Text>
      {!searchQuery && !selectedCategory && (
        <TouchableOpacity style={styles.addFirstButton} onPress={openCreateModal}>
          <Text style={styles.addFirstButtonText}>Add Product</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ──────────────────────────────────────────────────────────────
  // CATEGORIES LIST COMPONENT
  // ──────────────────────────────────────────────────────────────
  const CategoriesList = () => (
    <View style={styles.categoriesListContainer}>
      <Text style={styles.categoriesListTitle}>Manage Categories</Text>
      <Text style={styles.categoriesListSubtitle}>Tap to edit, long press to delete</Text>
      
      <FlatList
        data={categories}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.categoryListItem}
            onPress={() => openCategoryEditModal(item)}
            onLongPress={() => handleCategoryDelete(item._id, item.name)}
          >
            <View style={styles.categoryListImageContainer}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.categoryListImage} />
              ) : (
                <View style={styles.categoryListPlaceholder}>
                  <MaterialIcons name="category" size={24} color={Colors.light.textSecondary} />
                </View>
              )}
            </View>
            
            <View style={styles.categoryListInfo}>
              <Text style={styles.categoryListName}>{item.name}</Text>
              {item.description ? (
                <Text style={styles.categoryListDescription} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : (
                <Text style={styles.categoryListDescription}>No description</Text>
              )}
              <Text style={styles.categoryListOrder}>Order: {item.displayOrder}</Text>
            </View>
            
            <View style={styles.categoryListActions}>
              <TouchableOpacity 
                style={styles.categoryEditButton}
                onPress={() => openCategoryEditModal(item)}
              >
                <Feather name="edit" size={18} color={Colors.light.accent} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.categoriesEmpty}>
            <MaterialIcons name="category" size={48} color={Colors.light.textSecondary} />
            <Text style={styles.categoriesEmptyText}>No categories yet</Text>
            <Text style={styles.categoriesEmptySubtext}>
              Create your first category to organize products
            </Text>
          </View>
        }
      />
    </View>
  );

  // ──────────────────────────────────────────────────────────────
  // LOADING STATES
  // ──────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + 16 }]}>
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Global Loading Overlay */}
      {operationInProgress !== '' && (
        <LoadingOverlay 
          message={operationInProgress}
          progress={submissionProgress}
          showProgress={true}
        />
      )}

      {/* PROFESSIONAL HEADER */}
      <View style={styles.professionalHeader}>
        <View style={styles.headerTop}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Products</Text>
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
        </View>

        {/* Stats Bar - Now inside scrollable content */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{filteredProducts.length}</Text>
            <Text style={styles.statLabel}>Showing</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {filteredProducts.filter(p => p.barcodeId || p.scannedBarcodeId).length}
            </Text>
            <Text style={styles.statLabel}>With Barcodes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {filteredProducts.filter(p => p.isFeatured).length}
            </Text>
            <Text style={styles.statLabel}>Featured</Text>
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
        contentContainerStyle={styles.listContent}
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

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* Product Form Modal */}
      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {editingProduct ? 'Update product information' : 'Create a new product entry'}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={closeModal}
              >
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Minimal Scan Barcode Section - Only for new products */}
              {!editingProduct && (
                <View style={styles.scanSection}>
                  <TouchableOpacity
                    style={styles.minimalScanButton}
                    onPress={() => setBarcodeScannerVisible(true)}
                  >
                    <Ionicons name="barcode-outline" size={20} color={Colors.light.accent} />
                    <Text style={styles.minimalScanButtonText}>Scan Barcode</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Basic Information Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="information-circle-outline" size={20} color={Colors.light.accent} />
                  <Text style={styles.sectionTitle}>Basic Information</Text>
                </View>

                {/* Improved Image Upload with Loading */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Product Image</Text>
                  
                  {/* Image Preview with Loading */}
                  {(imageUri || (formData.image && formData.image.uri)) && (
                    <View style={styles.imagePreviewContainer}>
                      {imageLoading && (
                        <View style={styles.imageLoadingOverlay}>
                          <ActivityIndicator size="small" color="#FFF" />
                          <Text style={styles.imageLoadingText}>Processing Image...</Text>
                        </View>
                      )}
                      <Image
                        source={{ uri: imageUri || formData.image?.uri }}
                        style={styles.imagePreview}
                        resizeMode="cover"
                        onError={(e) => {
                          console.log('Image preview error:', e.nativeEvent.error);
                          setImageUri('');
                          setFormData(prev => ({ ...prev, image: null }));
                        }}
                      />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => {
                          setFormData(prev => ({ ...prev, image: null, cloudinaryImages: [] }));
                          setImageUri('');
                        }}
                      >
                        <Ionicons name="close" size={16} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Image Selection Buttons */}
                  <View style={styles.imageButtonsRow}>
                    <TouchableOpacity 
                      style={[styles.imageButton, styles.galleryButton]} 
                      onPress={pickImage}
                      disabled={imageLoading}
                    >
                      {imageLoading ? (
                        <ActivityIndicator size="small" color={Colors.light.accent} />
                      ) : (
                        <>
                          <Ionicons name="image-outline" size={20} color={Colors.light.accent} />
                          <Text style={styles.imageButtonText}>Choose from Gallery</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      style={[styles.imageButton, styles.cameraButton]} 
                      onPress={takePhoto}
                      disabled={imageLoading}
                    >
                      {imageLoading ? (
                        <ActivityIndicator size="small" color={Colors.light.accent} />
                      ) : (
                        <>
                          <Ionicons name="camera-outline" size={20} color={Colors.light.accent} />
                          <Text style={styles.imageButtonText}>Take Photo</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Product Name * {autoFilledFields.has('name') && '✓'}
                    </Text>
                    <TextInput
                      style={[styles.textInput, autoFilledFields.has('name') && styles.autoFilledField]}
                      value={formData.name}
                      onChangeText={(t) => setFormData({ ...formData, name: t })}
                      placeholder="Enter product name"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Description {autoFilledFields.has('description') && '✓'}
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.textArea, autoFilledFields.has('description') && styles.autoFilledField]}
                    value={formData.description}
                    onChangeText={(t) => setFormData({ ...formData, description: t })}
                    placeholder="Product description..."
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Category * {autoFilledFields.has('category') && '✓'}
                  </Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    style={styles.chipScroll}
                    contentContainerStyle={styles.chipScrollContent}
                  >
                    {categories.map((cat) => (
                      <TouchableOpacity
                        key={cat._id}
                        style={[styles.chip, formData.category === cat._id && styles.chipSelected]}
                        onPress={() => setFormData({ ...formData, category: cat._id })}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            formData.category === cat._id && styles.chipTextSelected,
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Pricing Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="pricetag-outline" size={20} color={Colors.light.accent} />
                  <Text style={styles.sectionTitle}>Pricing</Text>
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.inputGroup, styles.flex1]}>
                    <Text style={styles.inputLabel}>Price (₹) *</Text>
                    <TextInput
                      style={styles.textInput}
                      value={formData.price}
                      onChangeText={(t) => setFormData({ ...formData, price: t })}
                      keyboardType="numeric"
                      placeholder="0.00"
                    />
                  </View>
                  <View style={[styles.inputGroup, styles.flex1]}>
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

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Milk Type</Text>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    style={styles.chipScroll}
                    contentContainerStyle={styles.chipScrollContent}
                  >
                    {['Cow', 'Buffalo', 'Mixed', 'None'].map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.chip, formData.milkType === t && styles.chipSelected]}
                        onPress={() => setFormData({ ...formData, milkType: t })}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            formData.milkType === t && styles.chipTextSelected,
                          ]}
                        >
                          {t}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              {/* Product Details Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="cube-outline" size={20} color={Colors.light.accent} />
                  <Text style={styles.sectionTitle}>Product Details</Text>
                </View>

                <View style={styles.formRow}>
                  <View style={[styles.inputGroup, styles.flex1]}>
                    <Text style={styles.inputLabel}>
                      Unit {autoFilledFields.has('unit') && '✓'}
                    </Text>
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false}
                      style={styles.chipScroll}
                      contentContainerStyle={styles.chipScrollContent}
                    >
                      {['ml', 'liter', 'gm', 'kg', 'pack', 'piece'].map((u) => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.chip, formData.unit === u && styles.chipSelected]}
                          onPress={() => setFormData({ ...formData, unit: u })}
                        >
                          <Text
                            style={[styles.chipText, formData.unit === u && styles.chipTextSelected]}
                          >
                            {u}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <View style={[styles.inputGroup, styles.flex1]}>
                    <Text style={styles.inputLabel}>
                      Size {autoFilledFields.has('unitSize') && '✓'}
                    </Text>
                    <TextInput
                      style={[styles.textInput, autoFilledFields.has('unitSize') && styles.autoFilledField]}
                      value={formData.unitSize}
                      onChangeText={(t) => setFormData({ ...formData, unitSize: t })}
                      keyboardType="numeric"
                      placeholder="1"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Tags {autoFilledFields.has('tags') && '✓'}
                  </Text>
                    <TextInput
                      style={[styles.textInput, autoFilledFields.has('tags') && styles.autoFilledField]}
                      value={formData.tags}
                      onChangeText={(t) => setFormData({ ...formData, tags: t })}
                      placeholder="organic, fresh, premium (comma separated)"
                    />
                </View>
              </View>

              {/* Nutrition Information Section */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="nutrition-outline" size={20} color={Colors.light.accent} />
                  <Text style={styles.sectionTitle}>
                    Nutrition Information {autoFilledFields.has('nutritionalInfo') && '✓'}
                  </Text>
                  <Text style={styles.sectionSubtitle}>(per 100{formData.unit})</Text>
                </View>

                <View style={styles.nutritionGrid}>
                  {['fat', 'protein', 'calories', 'carbohydrates'].map((key) => (
                    <View key={key} style={styles.nutritionInput}>
                      <Text style={styles.nutritionLabel}>
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </Text>
                      <TextInput
                        style={[styles.nutritionTextInput, autoFilledFields.has('nutritionalInfo') && styles.autoFilledField]}
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
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="settings-outline" size={20} color={Colors.light.accent} />
                  <Text style={styles.sectionTitle}>Settings</Text>
                </View>

                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={styles.toggle}
                    onPress={() => setFormData({ ...formData, isFeatured: !formData.isFeatured })}
                  >
                    <View
                      style={[styles.checkbox, formData.isFeatured && styles.checkboxChecked]}
                    >
                      {formData.isFeatured && <Ionicons name="checkmark" size={16} color="#FFF" />}
                    </View>
                    <View style={styles.toggleTexts}>
                      <Text style={styles.toggleLabel}>Featured Product</Text>
                      <Text style={styles.toggleDescription}>Show this product in featured section</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.toggle}
                    onPress={() =>
                      setFormData({ ...formData, isAvailable: !formData.isAvailable })
                    }
                  >
                    <View
                      style={[styles.checkbox, formData.isAvailable && styles.checkboxChecked]}
                    >
                      {formData.isAvailable && <Ionicons name="checkmark" size={16} color="#FFF" />}
                    </View>
                    <View style={styles.toggleTexts}>
                      <Text style={styles.toggleLabel}>Available for Sale</Text>
                      <Text style={styles.toggleDescription}>Product is available in store</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={closeModal}
                disabled={uploading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={uploading}
              >
                {uploading ? (
                  <View style={styles.submitButtonLoading}>
                    <ActivityIndicator size="small" color="#FFF" />
                    <Text style={styles.submitButtonLoadingText}>
                      {editingProduct ? 'Updating...' : 'Creating...'}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingProduct ? 'Update Product' : 'Create Product'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Categories Management Modal */}
      <Modal visible={categoriesModalVisible} animationType="slide" onRequestClose={closeCategoryModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Manage Categories</Text>
                <Text style={styles.modalSubtitle}>
                  Create, edit, or delete product categories
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={closeCategoryModal}
                disabled={isSubmittingCategory}
              >
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <CategoriesList />

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, isSubmittingCategory && styles.buttonDisabled]}
                onPress={closeCategoryModal}
                disabled={isSubmittingCategory}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, isSubmittingCategory && styles.buttonDisabled]}
                onPress={openCategoryCreateModal}
                disabled={isSubmittingCategory}
              >
                <Text style={styles.submitButtonText}>Add New Category</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Form Modal */}
      <Modal visible={editingCategory !== null || categoryFormData.name !== ''} animationType="slide" onRequestClose={closeCategoryModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingCategory ? 'Edit Category' : 'Create New Category'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {editingCategory ? 'Update category information' : 'Add a new product category'}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={closeCategoryModal}
                disabled={isSubmittingCategory}
              >
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Category Image Preview */}
              {categoryFormData.image && (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: categoryFormData.image }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setCategoryFormData(prev => ({ ...prev, image: '' }))}
                    disabled={isSubmittingCategory}
                  >
                    <Ionicons name="close" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category Name *</Text>
                <TextInput
                  style={[styles.textInput, categoryFormData.name.trim() && styles.inputValid]}
                  value={categoryFormData.name}
                  onChangeText={(text) => setCategoryFormData(prev => ({ ...prev, name: text }))}
                  placeholder="e.g., Dairy Products, Fresh Milk"
                  editable={!isSubmittingCategory}
                />
                <Text style={styles.charCount}>{categoryFormData.name.length}/50</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={categoryFormData.description}
                  onChangeText={(text) => setCategoryFormData(prev => ({ ...prev, description: text }))}
                  placeholder="Optional category description..."
                  multiline
                  numberOfLines={4}
                  editable={!isSubmittingCategory}
                />
                <Text style={styles.charCount}>{categoryFormData.description.length}/200</Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category Image</Text>
                <View style={styles.imageInputContainer}>
                  <TextInput
                    style={[styles.textInput, styles.imageInput]}
                    value={categoryFormData.image}
                    onChangeText={(text) => setCategoryFormData(prev => ({ ...prev, image: text }))}
                    placeholder="Image URL or select from gallery"
                    editable={!isSubmittingCategory}
                  />
                  <TouchableOpacity 
                    style={styles.imagePickerButton} 
                    onPress={pickCategoryImage} 
                    disabled={isSubmittingCategory}
                  >
                    <Ionicons name="image" size={20} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Display Order</Text>
                <TextInput
                  style={styles.textInput}
                  value={categoryFormData.displayOrder.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setCategoryFormData(prev => ({ ...prev, displayOrder: Math.max(0, num) }));
                  }}
                  placeholder="0"
                  keyboardType="numeric"
                  editable={!isSubmittingCategory}
                />
                <Text style={styles.helperText}>Lower numbers appear first in listings</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.cancelButton, isSubmittingCategory && styles.buttonDisabled]}
                onPress={closeCategoryModal}
                disabled={isSubmittingCategory}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, isSubmittingCategory && styles.buttonDisabled]}
                onPress={handleCategorySubmit}
                disabled={isSubmittingCategory || !categoryFormData.name.trim()}
              >
                {isSubmittingCategory ? (
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

      {/* Barcode Scanner Modal for Product Creation */}
      <Modal
        visible={barcodeScannerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBarcodeScannerVisible(false)}
      >
        <View style={styles.barcodeScannerOverlay}>
          <View style={styles.barcodeScannerContent}>
            <View style={styles.barcodeScannerHeader}>
              <View>
                <Text style={styles.barcodeScannerTitle}>Scan Product Barcode</Text>
                <Text style={styles.barcodeScannerSubtitle}>
                  Position barcode within the frame to auto-fill product details
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setBarcodeScannerVisible(false)}
              >
                <MaterialIcons name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.cameraContainer}>
              <CameraView
                style={styles.camera}
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
              <View style={styles.cameraOverlay}>
                <View style={styles.scanFrameContainer}>
                  <View style={styles.scanFrame} />
                  <Text style={styles.cameraInstruction}>
                    Align barcode within the frame
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.barcodeScannerFooter}>
              <Text style={styles.scannerHelpText}>
                Scanning will automatically fetch product details, images, and nutritional information
              </Text>
              <TouchableOpacity
                style={styles.cancelScanButton}
                onPress={() => setBarcodeScannerVisible(false)}
              >
                <Text style={styles.cancelScanButtonText}>Cancel Scan</Text>
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
        <View style={styles.previewModalOverlay}>
          <View style={styles.previewModalContent}>
            <View style={styles.previewModalHeader}>
              <View>
                <Text style={styles.previewModalTitle}>
                  {fetchingProductData ? '🔍 Scanning Barcode...' : 
                   fetchedProductData?.found ? '🎉 Product Data Found!' : '📝 Create New Product'}
                </Text>
                <Text style={styles.previewModalSubtitle}>
                  {fetchingProductData ? 'Fetching product information...' : 
                   `Barcode: ${scannedBarcode}${fetchedProductData?.dataSource === 'openfoodfacts' ? ' • From OpenFoodFacts' : ''}`}
                </Text>
              </View>
              {!fetchingProductData && (
                <TouchableOpacity 
                  style={styles.closeButton}
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

            <ScrollView style={styles.previewModalBody}>
              {fetchingProductData ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={Colors.light.accent} />
                  <ProgressBar progress={submissionProgress} />
                  <Text style={styles.loadingText}>Scanning barcode and fetching product data...</Text>
                  <Text style={styles.loadingSubtext}>
                    This may take a few seconds as we gather product information and images
                  </Text>
                </View>
              ) : applyingProductData ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={Colors.light.accent} />
                  <ProgressBar progress={submissionProgress} />
                  <Text style={styles.loadingText}>Applying product data to form...</Text>
                  <Text style={styles.loadingSubtext}>
                    Preparing form with product information and images
                  </Text>
                </View>
              ) : fetchedProductData ? (
                <View style={styles.previewData}>
                  
                  {/* Data Source Info */}
                  <View style={[
                    styles.warningSection, 
                    fetchedProductData.found ? styles.successSection : styles.infoSection
                  ]}>
                    <Ionicons 
                      name={fetchedProductData.found ? "checkmark-circle" : "information-circle"} 
                      size={20} 
                      color={fetchedProductData.found ? "#4CAF50" : "#2196F3"} 
                    />
                    <Text style={[
                      styles.warningText,
                      fetchedProductData.found ? styles.successText : styles.infoText
                    ]}>
                      {fetchedProductData.found 
                        ? 'Product data found online! Review and complete the information below.'
                        : 'No product data found. Please fill in the details manually.'}
                    </Text>
                  </View>

                  {/* Product Images */}
                  {fetchedProductData.images && Array.isArray(fetchedProductData.images) && fetchedProductData.images.length > 0 && (
                    <View style={styles.previewSection}>
                      <Text style={styles.previewSectionTitle}>
                        Product Images ({fetchedProductData.images.length})
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.previewImagesContainer}>
                          {fetchedProductData.images.map((image, index) => {
                            if (!image || !image.url) return null;
                            
                            return (
                              <View key={index} style={styles.previewImageContainer}>
                                <Image
                                  source={{ uri: image.url }}
                                  style={styles.previewImage}
                                  resizeMode="cover"
                                  onError={(e) => console.log(`Image ${index} load error:`, e.nativeEvent.error)}
                                />
                                <View style={styles.previewImageBadge}>
                                  <Text style={styles.previewImageBadgeText}>
                                    {image.type === 'front' ? 'Main' : `Image ${index + 1}`}
                                  </Text>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      </ScrollView>
                      <Text style={styles.previewImageNote}>
                        {fetchedProductData.images.find(img => img && img.type === 'front') 
                          ? 'Front product image will be used as main image.' 
                          : 'First image will be used as main product image.'
                        }
                      </Text>
                    </View>
                  )}

                  {/* Product Information */}
                  <View style={styles.previewSection}>
                    <Text style={styles.previewSectionTitle}>Product Information</Text>
                    
                    {fetchedProductData.name && (
                      <View style={styles.previewField}>
                        <Text style={styles.previewLabel}>
                          Product Name {fetchedProductData.autoFilledFields?.name && '✓'}
                        </Text>
                        <Text style={styles.previewValue}>{fetchedProductData.name}</Text>
                      </View>
                    )}
                    
                    {fetchedProductData.description && (
                      <View style={styles.previewField}>
                        <Text style={styles.previewLabel}>
                          Description {fetchedProductData.autoFilledFields?.description && '✓'}
                        </Text>
                        <Text style={styles.previewValue}>{fetchedProductData.description}</Text>
                      </View>
                    )}
                    
                    {fetchedProductData.brand && (
                      <View style={styles.previewField}>
                        <Text style={styles.previewLabel}>Brand</Text>
                        <Text style={styles.previewValue}>{fetchedProductData.brand}</Text>
                      </View>
                    )}
                  </View>

                  {/* Product Details */}
                  <View style={styles.previewSection}>
                    <Text style={styles.previewSectionTitle}>Product Details</Text>
                    
                    <View style={styles.previewFieldRow}>
                      <View style={styles.previewFieldHalf}>
                        <Text style={styles.previewLabel}>
                          Unit {fetchedProductData.autoFilledFields?.unit && '✓'}
                        </Text>
                        <Text style={styles.previewValue}>{fetchedProductData.unit || 'piece'}</Text>
                      </View>
                      <View style={styles.previewFieldHalf}>
                        <Text style={styles.previewLabel}>
                          Size {fetchedProductData.autoFilledFields?.unitSize && '✓'}
                        </Text>
                        <Text style={styles.previewValue}>{fetchedProductData.unitSize || '1'}</Text>
                      </View>
                    </View>

                    {fetchedProductData.milkType && (
                      <View style={styles.previewField}>
                        <Text style={styles.previewLabel}>
                          Milk Type {fetchedProductData.autoFilledFields?.milkType && '✓'}
                        </Text>
                        <Text style={styles.previewValue}>{fetchedProductData.milkType}</Text>
                      </View>
                    )}

                    {fetchedProductData.categories && Array.isArray(fetchedProductData.categories) && fetchedProductData.categories.length > 0 && (
                      <View style={styles.previewField}>
                        <Text style={styles.previewLabel}>
                          Suggested Categories {fetchedProductData.autoFilledFields?.category && '✓'}
                        </Text>
                        <Text style={styles.previewValue}>{fetchedProductData.categories.join(', ')}</Text>
                      </View>
                    )}
                  </View>

                  {/* Required Fields Warning */}
                  {fetchedProductData.missingRequiredFields && 
                  Object.values(fetchedProductData.missingRequiredFields).some(val => val) && (
                    <View style={styles.warningSection}>
                      <Ionicons name="warning" size={20} color="#FF9800" />
                      <View style={styles.warningContent}>
                        <Text style={styles.warningTitle}>Required Fields Missing</Text>
                        <Text style={styles.warningText}>
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
                  <View style={styles.infoSection}>
                    <Ionicons name="help-circle" size={20} color="#2196F3" />
                    <View style={styles.infoContent}>
                      <Text style={styles.infoTitle}>Next Steps</Text>
                      <Text style={styles.infoText}>
                        Choose "Apply to Form" to auto-fill available data, then complete any missing information before saving.
                      </Text>
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No product data available</Text>
                </View>
              )}
            </ScrollView>

            {!fetchingProductData && !applyingProductData && (
              <View style={styles.previewModalFooter}>
                <TouchableOpacity
                  style={styles.previewCancelButton}
                  onPress={() => {
                    setProductDataPreviewVisible(false);
                    setFetchedProductData(null);
                    setScannedBarcode('');
                  }}
                  disabled={applyingProductData}
                >
                  <Text style={styles.previewCancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.previewApplyButton, applyingProductData && styles.previewApplyButtonDisabled]}
                  onPress={handleApplyProductDataToForm}
                  disabled={applyingProductData || !fetchedProductData}
                >
                  {applyingProductData ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="document-text" size={20} color="#FFF" />
                      <Text style={styles.previewApplyButtonText}>Apply to Form</Text>
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
        <View style={styles.barcodeModalOverlay}>
          <View style={styles.barcodeModalContent}>
            <View style={styles.barcodeModalHeader}>
              <View>
                <Text style={styles.barcodeModalTitle}>Product Barcode</Text>
                <Text style={styles.barcodeModalSubtitle}>
                  {selectedProductForBarcode?.name}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={closeBarcodeModal}
              >
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            {showCamera ? (
              <View style={styles.cameraContainer}>
                <CameraView
                  style={styles.camera}
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
                <View style={styles.cameraOverlay}>
                  <View style={styles.scanFrameContainer}>
                    <View style={styles.scanFrame} />
                    <Text style={styles.cameraInstruction}>
                      Point camera at barcode to scan
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.cancelScanButton}
                    onPress={stopBarcodeScan}
                  >
                    <Text style={styles.cancelScanButtonText}>Cancel Scan</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <ScrollView 
                style={styles.barcodeScrollView}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.barcodeScrollContent}
              >
                <View style={styles.barcodeInfoContainer}>
                  {/* Generated Barcode Section */}
                  {selectedProductForBarcode?.barcodeUrl && (
                    <View style={styles.barcodeSection}>
                      <View style={styles.sectionHeader}>
                        <Ionicons name="qr-code-outline" size={20} color="#4CAF50" />
                        <Text style={styles.sectionTitle}>Generated Barcode</Text>
                      </View>
                      <ViewShot
                        ref={viewShotRef}
                        options={{ format: 'png', quality: 1 }}
                        style={styles.barcodeContainer}
                      >
                        <Image
                          source={{ uri: selectedProductForBarcode.barcodeUrl }}
                          style={styles.barcodeImage}
                          resizeMode="contain"
                        />
                        <View style={styles.barcodeOverlay}>
                          <Text style={styles.barcodeOverlayText}>Product ID: {selectedProductForBarcode.barcodeId}</Text>
                        </View>
                      </ViewShot>
                      <Text style={styles.barcodeDescription}>
                        System-generated barcode using product ID
                      </Text>
                    </View>
                  )}

                  {/* Scanned Barcode Section */}
                  {selectedProductForBarcode?.scannedBarcodeId && (
                    <View style={styles.barcodeSection}>
                      <View style={styles.sectionHeader}>
                        <Ionicons name="scan-outline" size={20} color="#2196F3" />
                        <Text style={styles.sectionTitle}>Scanned Barcode</Text>
                      </View>
                      <View style={styles.scannedBarcodeDisplay}>
                        <View style={styles.scannedBarcodeIconContainer}>
                          <Ionicons name="barcode-outline" size={32} color="#2196F3" />
                        </View>
                        <Text style={styles.scannedBarcodeValue}>{selectedProductForBarcode.scannedBarcodeId}</Text>
                        <Text style={styles.scannedBarcodeNote}>
                          External barcode scanned and assigned
                        </Text>
                      </View>
                      <Text style={styles.barcodeDescription}>
                        Physical barcode scanned from product packaging
                      </Text>
                    </View>
                  )}

                  {/* Divider when both exist */}
                  {selectedProductForBarcode?.barcodeUrl && selectedProductForBarcode?.scannedBarcodeId && (
                    <View style={styles.barcodeDivider}>
                      <View style={styles.dividerLine} />
                      <Text style={styles.dividerText}>Both Barcodes Active</Text>
                      <View style={styles.dividerLine} />
                    </View>
                  )}

                  {/* No Barcode State */}
                  {!selectedProductForBarcode?.barcodeUrl && !selectedProductForBarcode?.scannedBarcodeId && (
                    <View style={styles.barcodeEmpty}>
                      <Ionicons name="barcode-outline" size={56} color={Colors.light.textSecondary} />
                      <Text style={styles.barcodeEmptyText}>No Barcode Assigned</Text>
                      <Text style={styles.barcodeEmptySubtext}>
                        Generate a barcode or scan an external barcode
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.barcodeActions}>
                  {selectedProductForBarcode?.barcodeUrl ? (
                    // Has generated barcode
                    <>
                      <TouchableOpacity 
                        style={styles.downloadBarcodeButton} 
                        onPress={downloadBarcode}
                      >
                        <Ionicons name="download-outline" size={20} color="#FFF" />
                        <Text style={styles.downloadBarcodeButtonText}>Save Generated Barcode</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.scanBarcodeButton} 
                        onPress={startBarcodeScan}
                      >
                        <Ionicons name="scan-outline" size={20} color="#FFF" />
                        <Text style={styles.scanBarcodeButtonText}>
                          {selectedProductForBarcode?.scannedBarcodeId ? 'Rescan Barcode' : 'Scan External Barcode'}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.removeButtonsRow}>
                        {selectedProductForBarcode?.scannedBarcodeId && (
                          <TouchableOpacity 
                            style={[styles.removeBarcodeButton, styles.removeScannedButton]}
                            onPress={removeScannedBarcode}
                          >
                            <Ionicons name="trash-outline" size={18} color="#F44336" />
                            <Text style={styles.removeBarcodeButtonText}>Remove Scanned</Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity 
                          style={[styles.removeBarcodeButton, styles.removeGeneratedButton]}
                          onPress={removeGeneratedBarcode}
                        >
                          <Ionicons name="trash-outline" size={18} color="#F44336" />
                          <Text style={styles.removeBarcodeButtonText}>Remove Generated</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  ) : selectedProductForBarcode?.scannedBarcodeId ? (
                    // Has scanned barcode but no generated
                    <>
                      <TouchableOpacity 
                        style={styles.generateBarcodeButton} 
                        onPress={generateBarcode}
                        disabled={barcodeScanning}
                      >
                        {barcodeScanning ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <Ionicons name="sparkles" size={20} color="#FFF" />
                            <Text style={styles.generateBarcodeButtonText}>Generate Barcode</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.scanBarcodeButton} 
                        onPress={startBarcodeScan}
                      >
                        <Ionicons name="scan-outline" size={20} color="#FFF" />
                        <Text style={styles.scanBarcodeButtonText}>Rescan Barcode</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.removeBarcodeButton} 
                        onPress={removeScannedBarcode}
                      >
                        <Ionicons name="trash-outline" size={20} color="#F44336" />
                        <Text style={styles.removeBarcodeButtonText}>Remove Scanned Barcode</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    // No barcode at all
                    <>
                      <TouchableOpacity 
                        style={styles.generateBarcodeButton} 
                        onPress={generateBarcode}
                        disabled={barcodeScanning}
                      >
                        {barcodeScanning ? (
                          <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                          <>
                            <Ionicons name="sparkles" size={20} color="#FFF" />
                            <Text style={styles.generateBarcodeButtonText}>Generate Barcode</Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.scanBarcodeButton} 
                        onPress={startBarcodeScan}
                      >
                        <Ionicons name="scan-outline" size={20} color="#FFF" />
                        <Text style={styles.scanBarcodeButtonText}>Scan External Barcode</Text>
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

// ──────────────────────────────────────────────────────────────
// UPDATED STYLES WITH ALL CHANGES
// ──────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header Styles
  professionalHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  headerTop: {
    marginBottom: 12,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.light.text,
    flex: 1,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    paddingHorizontal: 12,
    marginLeft: 16,
    maxWidth: 200,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.light.text,
  },

  // Stats Bar
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.light.border,
  },

  // Horizontal Categories Styles
  categoriesSection: {
    backgroundColor: Colors.light.white,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  categoriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  categoriesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  manageCategoriesButton: {
    backgroundColor: Colors.light.accent + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  manageCategoriesText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.accent,
  },
  categoriesScrollContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  categoryCircle: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 80,
  },
  categoryCircleImageContainer: {
    position: 'relative',
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: Colors.light.border,
    overflow: 'hidden',
  },
  categorySelected: {
    borderColor: Colors.light.accent,
    backgroundColor: Colors.light.accent + '20',
  },
  categoryCircleImage: {
    width: '100%',
    height: '100%',
  },
  categoryCirclePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categorySelectedIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.light.accent,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.light.white,
  },
  categoryCircleName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
    maxWidth: 80,
  },
  categoryNameSelected: {
    color: Colors.light.accent,
    fontWeight: '700',
  },
  addCategoryCircle: {
    alignItems: 'center',
    marginHorizontal: 8,
    width: 80,
  },
  addCategoryCircleInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Colors.light.accent,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    backgroundColor: Colors.light.background,
  },
  addCategoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.accent,
    textAlign: 'center',
  },

  // Categories List Styles
  categoriesListContainer: {
    flex: 1,
    padding: 16,
  },
  categoriesListTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  categoriesListSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 16,
  },
  categoryListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  categoryListImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    marginRight: 12,
    backgroundColor: Colors.light.background,
  },
  categoryListImage: {
    width: '100%',
    height: '100%',
  },
  categoryListPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryListInfo: {
    flex: 1,
  },
  categoryListName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  categoryListDescription: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  categoryListOrder: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  categoryListActions: {
    marginLeft: 12,
  },
  categoryEditButton: {
    padding: 8,
  },
  categoriesEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  categoriesEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
  },
  categoriesEmptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },

  // Loading Components
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingContent: {
    backgroundColor: '#FFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingMessage: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  progressText: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  progressBarContainer: {
    width: 200,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    marginTop: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
    transition: 'width 0.3s ease-in-out',
  },

  // Image Loading
  imageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  imageLoadingText: {
    color: '#FFF',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },

  // Submit Button Loading
  submitButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonLoadingText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },

  // Product List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  productCard: {
    backgroundColor: Colors.light.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  featuredBadge: {
    position: 'absolute',
    top: -4,
    left: -4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  featuredText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },
  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockText: {
    fontSize: 11,
    color: '#F44336',
    fontWeight: '600',
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
    marginRight: 8,
  },
  unitText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '500',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  productCategory: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 6,
  },
  productDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  barcodeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  barcodeTypes: {
    flex: 1,
    marginLeft: 6,
  },
  barcodeTypeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  barcodeText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontFamily: 'monospace',
    flex: 1,
  },
  barcodeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  scannedBadge: {
    backgroundColor: '#E3F2FD',
  },
  generatedBadge: {
    backgroundColor: '#E8F5E9',
  },
  barcodeBadgeText: {
    fontSize: 9,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  priceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  discountContainer: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountBadge: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
  stockText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  actionButtons: {
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
  barcodeButton: {
    backgroundColor: '#E8F5E9',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },

  // FAB
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

  // Empty State
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
  addFirstButton: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  addFirstButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },

  // Modal Styles
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
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  closeButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
  },

  // Section Styles
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginLeft: 'auto',
  },

  // Minimal Scan Section
  scanSection: {
    marginBottom: 24,
    alignItems: 'center',
  },
  minimalScanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196F3',
    gap: 8,
  },
  minimalScanButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
  },

  // Form Styles
  formRow: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  inputGroup: {
    marginBottom: 16,
  },
  flex1: {
    flex: 1,
    marginHorizontal: 6,
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
  autoFilledField: {
    backgroundColor: '#F0F8FF',
    borderColor: '#2196F3',
  },
  inputValid: {
    borderColor: Colors.light.accent,
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

  // Improved Image Upload Styles
  imagePreviewContainer: {
    position: 'relative',
    width: '100%',
    height: 200,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(244, 67, 54, 0.9)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  imageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  galleryButton: {
    backgroundColor: '#F8F9FA',
  },
  cameraButton: {
    backgroundColor: '#F8F9FA',
  },
  imageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.accent,
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

  // Chip Styles
  chipScroll: {
    marginBottom: 8,
  },
  chipScrollContent: {
    paddingRight: 20,
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

  // Nutrition Grid
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

  // Toggle Styles
  toggleRow: {
    gap: 16,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.light.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.accent,
  },
  toggleTexts: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  toggleDescription: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },

  // Modal Footer
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
  buttonDisabled: {
    opacity: 0.6,
  },

  // Barcode Scanner Modal
  barcodeScannerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  barcodeScannerContent: {
    backgroundColor: '#000',
    borderRadius: 0,
    width: '100%',
    height: '100%',
  },
  barcodeScannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    paddingTop: 60,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  barcodeScannerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  barcodeScannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  cameraContainer: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    margin: 20,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrameContainer: {
    alignItems: 'center',
  },
  scanFrame: {
    width: 250,
    height: 150,
    borderWidth: 2,
    borderColor: '#FFF',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  cameraInstruction: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  barcodeScannerFooter: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
  },
  scannerHelpText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 16,
  },
  cancelScanButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelScanButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },

  // Product Data Preview Modal
  previewModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  previewModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  previewModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  previewModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  previewModalSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  previewModalBody: {
    marginBottom: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  previewData: {
    gap: 16,
  },
  previewSection: {
    marginBottom: 16,
  },
  previewSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  previewField: {
    marginBottom: 12,
  },
  previewFieldRow: {
    flexDirection: 'row',
    gap: 12,
  },
  previewFieldHalf: {
    flex: 1,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  previewValue: {
    fontSize: 16,
    color: Colors.light.text,
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  previewImagesContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
  },
  previewImageContainer: {
    position: 'relative',
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  previewImageBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  previewImageBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  previewImageNote: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
  },
  previewModalFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  previewCancelButton: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  previewCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  previewApplyButton: {
    flex: 1,
    backgroundColor: Colors.light.accent,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  previewApplyButtonDisabled: {
    opacity: 0.6,
  },
  previewApplyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },

  // Warning & Info Sections
  warningSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    marginBottom: 16,
    gap: 8,
  },
  successSection: {
    backgroundColor: '#E8F5E9',
    borderLeftColor: '#4CAF50',
  },
  infoSection: {
    backgroundColor: '#E3F2FD',
    borderLeftColor: '#2196F3',
  },
  warningContent: {
    flex: 1,
  },
  infoContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFA000',
    marginBottom: 2,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 2,
  },
  warningText: {
    fontSize: 14,
    color: '#FFA000',
    flex: 1,
  },
  successText: {
    color: '#4CAF50',
  },
  infoText: {
    color: '#2196F3',
  },

  // Barcode Management Modal
  barcodeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  barcodeModalContent: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: screenHeight * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
  },
  barcodeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 16,
  },
  barcodeModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  barcodeModalSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 4,
  },
  barcodeScrollView: {
    width: '100%',
  },
  barcodeScrollContent: {
    flexGrow: 1,
  },
  barcodeInfoContainer: {
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
    marginBottom: 16,
    alignItems: 'center',
    width: '100%',
  },
  barcodeSection: {
    width: '100%',
    marginBottom: 20,
  },
  barcodeContainer: {
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E8F5E9',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
  },
  barcodeImage: {
    width: Math.min(screenWidth * 0.6, 220),
    height: Math.min(screenWidth * 0.35, 130),
    borderRadius: 8,
  },
  barcodeOverlay: {
    marginTop: 8,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  barcodeOverlayText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  barcodeDescription: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  scannedBarcodeDisplay: {
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
    marginBottom: 8,
    width: '100%',
  },
  scannedBarcodeIconContainer: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  scannedBarcodeValue: {
    fontSize: 16,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  scannedBarcodeNote: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  barcodeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.light.border,
  },
  dividerText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    marginHorizontal: 12,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 8,
  },
  barcodeEmpty: {
    alignItems: 'center',
    padding: 20,
  },
  barcodeEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 12,
  },
  barcodeEmptySubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 8,
    textAlign: 'center',
  },
  barcodeActions: {
    width: '100%',
    gap: 12,
  },
  generateBarcodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  generateBarcodeButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  scanBarcodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  scanBarcodeButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  downloadBarcodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  downloadBarcodeButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  removeBarcodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  removeBarcodeButtonText: {
    color: '#F44336',
    fontWeight: '600',
    fontSize: 16,
  },
  removeButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  removeScannedButton: {
    flex: 1,
  },
  removeGeneratedButton: {
    flex: 1,
  },
});