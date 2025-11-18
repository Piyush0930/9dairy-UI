// app/(tabs)/supadmin/products.jsx
import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

const { width } = Dimensions.get('window');
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function ProductsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { authToken, isLoading: authLoading, isAuthenticated, logout } = useAuth();

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals state
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [productDetailsModalVisible, setProductDetailsModalVisible] = useState(false);
  const [categoryManageModalVisible, setCategoryManageModalVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Barcode Modal & Camera States
  const [barcodeModalVisible, setBarcodeModalVisible] = useState(false);
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState(null);
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef();
  const viewShotRef = useRef();

  // New Product Scanner States
  const [barcodeScannerVisible, setBarcodeScannerVisible] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [fetchingProductData, setFetchingProductData] = useState(false);
  const [scannedProductData, setScannedProductData] = useState(null);

  // Form data states
  const [productFormData, setProductFormData] = useState({
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
  });

  const [categoryFormData, setCategoryFormData] = useState({
    name: '',
    description: '',
    image: null,
    displayOrder: 0,
  });

  const [productImageUri, setProductImageUri] = useState('');
  const [categoryImageUri, setCategoryImageUri] = useState('');

  // Fetch data function - FIXED to ensure products display properly
  const fetchData = async () => {
    if (!authToken) return;

    try {
      setLoading(true);
      
      const [categoriesRes, productsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/catalog/categories`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
        }),
        fetch(`${API_BASE_URL}/api/catalog/products`, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
        })
      ]);

      if (!categoriesRes.ok || !productsRes.ok) {
        throw new Error('Failed to fetch data');
      }

      const categoriesData = await categoriesRes.json();
      const productsData = await productsRes.json();

      // Handle different response formats - FIXED to ensure proper array handling
      const categoriesArray = Array.isArray(categoriesData) 
        ? categoriesData 
        : categoriesData.categories || categoriesData.data || [];
      
      const productsArray = Array.isArray(productsData)
        ? productsData
        : productsData.products || productsData.data || [];

      console.log('Fetched products:', productsArray.length);
      console.log('Fetched categories:', categoriesArray.length);

      setCategories(categoriesArray);
      setProducts(productsArray);
      setFilteredProducts(productsArray); // Initialize filtered products

    } catch (error) {
      console.error('Fetch error:', error);
      Alert.alert('Error', 'Failed to load data');
      setCategories([]);
      setProducts([]);
      setFilteredProducts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Filter products based on category and search - FIXED filtering logic
  useEffect(() => {
    let filtered = [...products]; // Create a copy to avoid mutation

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => {
        const categoryId = product.category?._id || product.category;
        return categoryId === selectedCategory;
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.name?.toLowerCase().includes(query) ||
        product.category?.name?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
      );
    }

    console.log('Filtered products:', filtered.length);
    setFilteredProducts(filtered);
  }, [products, selectedCategory, searchQuery]);

  // Initial data fetch
  useEffect(() => {
    if (!authLoading && authToken && isAuthenticated) {
      fetchData();
    }
  }, [authToken, authLoading, isAuthenticated]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  // Image Picker Functions
  const pickProductImage = async () => {
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
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setProductFormData(prev => ({ 
          ...prev, 
          image: {
            uri: result.assets[0].uri,
            type: 'image/jpeg',
            fileName: `product-${Date.now()}.jpg`
          }
        }));
        setProductImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Could not select image. Please try again.');
    }
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
        setCategoryFormData(prev => ({ 
          ...prev, 
          image: {
            uri: result.assets[0].uri,
            type: 'image/jpeg',
            fileName: `category-${Date.now()}.jpg`
          }
        }));
        setCategoryImageUri(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Could not select image. Please try again.');
    }
  };

  // Product Modal Functions
  const openAddProductModal = () => {
    setProductFormData({
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
    });
    setProductImageUri('');
    setScannedProductData(null);
    setScannedBarcode('');
    setProductModalVisible(true);
  };

  const openEditProductModal = (product) => {
    setProductFormData({
      name: product.name,
      description: product.description || '',
      price: product.price.toString(),
      category: product.category?._id || product.category || '',
      unit: product.unit || 'liter',
      unitSize: product.unitSize?.toString() || '',
      stock: product.stock?.toString() || '',
      milkType: product.milkType || 'Cow',
      image: null,
      discount: product.discount?.toString() || '',
      isFeatured: product.isFeatured || false,
      isAvailable: product.isAvailable !== false,
    });
    setProductImageUri(product.image || '');
    setProductModalVisible(true);
  };

  const closeProductModal = () => {
    setProductModalVisible(false);
    setScannedProductData(null);
    setScannedBarcode('');
  };

  // FIXED: Enhanced product submission to ensure proper state update
  const handleAddProduct = async () => {
    if (!productFormData.name.trim() || !productFormData.price || !productFormData.category) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setUploading(true);
      const submitFormData = new FormData();

      submitFormData.append('name', productFormData.name);
      submitFormData.append('description', productFormData.description);
      submitFormData.append('price', parseFloat(productFormData.price).toString());
      submitFormData.append('category', productFormData.category);
      submitFormData.append('unit', productFormData.unit);
      submitFormData.append('unitSize', (parseInt(productFormData.unitSize) || 0).toString());
      submitFormData.append('stock', (parseInt(productFormData.stock) || 0).toString());
      submitFormData.append('milkType', productFormData.milkType);
      submitFormData.append('discount', (parseFloat(productFormData.discount) || 0).toString());
      submitFormData.append('isFeatured', productFormData.isFeatured.toString());
      submitFormData.append('isAvailable', productFormData.isAvailable.toString());

      // Add scanned barcode if available
      if (scannedBarcode) {
        submitFormData.append('scannedBarcodeId', scannedBarcode);
      }

      if (productFormData.image) {
        submitFormData.append('image', {
          uri: productFormData.image.uri,
          type: productFormData.image.type,
          name: productFormData.image.fileName,
        });
      }

      const response = await fetch(`${API_BASE_URL}/api/superadmin/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: submitFormData,
      });

      const data = await response.json();
      
      if (response.ok) {
        Alert.alert('Success', 'Product added successfully!');
        closeProductModal();
        
        // FIXED: Enhanced data refresh to ensure products display properly
        await fetchData(); // Wait for refresh to complete
        
        // Additional safety: Force state update
        setTimeout(() => {
          fetchData();
        }, 500);
        
      } else {
        Alert.alert('Error', data.message || 'Failed to add product');
      }
    } catch (error) {
      console.error('Add product error:', error);
      Alert.alert('Error', 'Failed to add product');
    } finally {
      setUploading(false);
    }
  };

  // Delete Product Function
  const handleDeleteProduct = async (productId, productName) => {
    Alert.alert(
      'Delete Product',
      `Are you sure you want to delete "${productName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/superadmin/products/${productId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json'
                },
              });

              if (response.ok) {
                Alert.alert('Success', 'Product deleted successfully!');
                // FIXED: Enhanced refresh
                await fetchData();
              } else {
                const data = await response.json();
                Alert.alert('Error', data.message || 'Failed to delete product');
              }
            } catch (error) {
              console.error('Delete product error:', error);
              Alert.alert('Error', 'Failed to delete product');
            }
          },
        },
      ]
    );
  };

  // Category Modal Functions
  const openAddCategoryModal = () => {
    setCategoryFormData({
      name: '',
      description: '',
      image: null,
      displayOrder: 0,
    });
    setCategoryImageUri('');
    setCategoryModalVisible(true);
  };

  const closeCategoryModal = () => {
    setCategoryModalVisible(false);
  };

  const handleAddCategory = async () => {
    if (!categoryFormData.name.trim()) {
      Alert.alert('Error', 'Category name is required');
      return;
    }

    try {
      setUploading(true);
      const submitFormData = new FormData();

      submitFormData.append('name', categoryFormData.name);
      submitFormData.append('description', categoryFormData.description);
      submitFormData.append('displayOrder', categoryFormData.displayOrder.toString());

      if (categoryFormData.image) {
        submitFormData.append('image', {
          uri: categoryFormData.image.uri,
          type: categoryFormData.image.type,
          name: categoryFormData.image.fileName,
        });
      }

      const response = await fetch(`${API_BASE_URL}/api/superadmin/categories`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
        },
        body: submitFormData,
      });

      const data = await response.json();
      
      if (response.ok) {
        Alert.alert('Success', 'Category added successfully!');
        closeCategoryModal();
        await fetchData(); // FIXED: Enhanced refresh
      } else {
        Alert.alert('Error', data.message || 'Failed to add category');
      }
    } catch (error) {
      console.error('Add category error:', error);
      Alert.alert('Error', 'Failed to add category');
    } finally {
      setUploading(false);
    }
  };

  // Category Management Functions
  const openCategoryManageModal = () => {
    setCategoryManageModalVisible(true);
  };

  const closeCategoryManageModal = () => {
    setCategoryManageModalVisible(false);
  };

  const handleEditCategory = (category) => {
    setCategoryFormData({
      name: category.name,
      description: category.description || '',
      image: null,
      displayOrder: category.displayOrder || 0,
    });
    setCategoryImageUri(category.image || '');
    setCategoryManageModalVisible(false);
    setCategoryModalVisible(true);
  };

  const handleDeleteCategory = async (categoryId, categoryName) => {
    // Check if category has products
    const productsInCategory = products.filter(product => 
      product.category?._id === categoryId || product.category === categoryId
    );

    if (productsInCategory.length > 0) {
      Alert.alert(
        'Cannot Delete Category',
        `This category has ${productsInCategory.length} product(s). Please remove or reassign these products before deleting the category.`,
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${categoryName}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${API_BASE_URL}/api/superadmin/categories/${categoryId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json'
                },
              });

              if (response.ok) {
                Alert.alert('Success', 'Category deleted successfully!');
                await fetchData(); // FIXED: Enhanced refresh
              } else {
                const data = await response.json();
                Alert.alert('Error', data.message || 'Failed to delete category');
              }
            } catch (error) {
              console.error('Delete category error:', error);
              Alert.alert('Error', 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  // Product Details Modal
  const openProductDetails = (product) => {
    setSelectedProduct(product);
    setProductDetailsModalVisible(true);
  };

  const closeProductDetails = () => {
    setProductDetailsModalVisible(false);
    setSelectedProduct(null);
  };

  // ──────────────────────────────────────────────────────────────
  // NEW PRODUCT SCANNER FUNCTIONS
  // ──────────────────────────────────────────────────────────────
  const openBarcodeScanner = () => {
    setBarcodeScannerVisible(true);
  };

  const closeBarcodeScanner = () => {
    setBarcodeScannerVisible(false);
    setFetchingProductData(false);
    setScannedProductData(null);
  };

  const handleBarcodeScannedForNewProduct = async ({ data }) => {
    if (!data) return;

    try {
      setFetchingProductData(true);
      setScannedBarcode(data);
      
      console.log('🔍 Scanning barcode for new product:', data);

      // Call your API to fetch product data by barcode
      const response = await fetch(`${API_BASE_URL}/api/catalog/products/scan-barcode`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ barcode: data })
      });

      const result = await response.json();
      
      if (response.ok) {
        // Handle existing product
        if (result.productExists && result.existingProduct) {
          Alert.alert(
            'Product Already Exists',
            `"${result.existingProduct.name}" already uses this barcode.`,
            [{ text: 'OK', style: 'default' }]
          );
          return;
        }

        if (result.success && result.suggestedData) {
          setScannedProductData(result.suggestedData);
          Alert.alert(
            'Product Data Found', 
            'Product information has been auto-filled. Please review and complete the form.',
            [{ text: 'OK', onPress: applyScannedProductData }]
          );
        } else {
          Alert.alert(
            'No Product Data Found',
            'No product information found for this barcode. Please fill in the details manually.',
            [{ text: 'OK', onPress: () => setBarcodeScannerVisible(false) }]
          );
        }
      } else {
        throw new Error(result.message || 'Failed to scan barcode');
      }
    } catch (error) {
      console.error('Barcode scan error:', error);
      Alert.alert('Error', 'Failed to scan barcode. Please try again.');
    } finally {
      setFetchingProductData(false);
      setBarcodeScannerVisible(false);
    }
  };

  const applyScannedProductData = () => {
    if (scannedProductData) {
      setProductFormData(prev => ({
        ...prev,
        name: scannedProductData.name || prev.name,
        description: scannedProductData.description || prev.description,
        unit: scannedProductData.unit || prev.unit,
        unitSize: scannedProductData.unitSize || prev.unitSize,
        milkType: scannedProductData.milkType || prev.milkType,
        price: scannedProductData.price ? scannedProductData.price.toString() : prev.price,
      }));
      
      // Auto-select category if available
      if (scannedProductData.category && categories.length > 0) {
        const matchingCategory = categories.find(cat => 
          cat.name.toLowerCase().includes(scannedProductData.category.toLowerCase())
        );
        if (matchingCategory) {
          setProductFormData(prev => ({
            ...prev,
            category: matchingCategory._id
          }));
        }
      }
    }
  };

  // ──────────────────────────────────────────────────────────────
  // EXISTING BARCODE MANAGEMENT FUNCTIONS
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
      
      const response = await fetch(
        `${API_BASE_URL}/api/catalog/products/${selectedProductForBarcode._id}/scan-barcode`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
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
      Alert.alert('Error', 'Failed to assign scanned barcode');
    } finally {
      setShowCamera(false);
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
            const response = await fetch(
              `${API_BASE_URL}/api/catalog/products/${selectedProductForBarcode._id}/scanned-barcode`,
              {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json'
                },
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
            Alert.alert('Error', 'Failed to remove scanned barcode');
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
            const response = await fetch(
              `${API_BASE_URL}/api/superadmin/${selectedProductForBarcode._id}/generated-barcode`,
              {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${authToken}`,
                  'Content-Type': 'application/json'
                },
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
            Alert.alert('Error', 'Failed to remove generated barcode');
          }
        },
      },
    ]);
  };

  const generateBarcode = async () => {
    if (!selectedProductForBarcode?._id) return;
    
    try {
      setBarcodeScanning(true);
      
      const res = await fetch(
        `${API_BASE_URL}/api/superadmin/${selectedProductForBarcode._id}/generate-barcode`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
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
      Alert.alert('Error', 'Failed to generate barcode.');
    } finally {
      setBarcodeScanning(false);
    }
  };

  const downloadBarcode = async () => {
    if (!selectedProductForBarcode?.barcodeUrl) return;
    try {
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
    }
  };

  // Instagram Stories-like Category Component
  const CategoryStories = () => (
    <View style={styles.storiesContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesScrollContent}
      >
        {/* All Categories Story */}
        <TouchableOpacity 
          style={[
            styles.storyItem,
            selectedCategory === 'all' && styles.storyItemActive
          ]}
          onPress={() => setSelectedCategory('all')}
        >
          <View style={[
            styles.storyCircle,
            styles.allStoriesCircle,
            selectedCategory === 'all' && styles.storyCircleActive
          ]}>
            <MaterialIcons name="apps" size={22} color="#FFFFFF" />
          </View>
          <Text style={[
            styles.storyText,
            selectedCategory === 'all' && styles.storyTextActive
          ]}>
            All
          </Text>
        </TouchableOpacity>

        {/* Category Stories */}
        {categories.slice(0, 90).map((category) => (
          <TouchableOpacity 
            key={category._id}
            style={[
              styles.storyItem,
              selectedCategory === category._id && styles.storyItemActive
            ]}
            onPress={() => setSelectedCategory(category._id)}
          >
            <View style={[
              styles.storyCircle,
              selectedCategory === category._id && styles.storyCircleActive
            ]}>
              {category.image ? (
                <Image 
                  source={{ uri: category.image }} 
                  style={styles.storyImage}
                />
              ) : (
                <MaterialIcons name="category" size={22} color="#FFFFFF" />
              )}
            </View>
            <Text 
              style={[
                styles.storyText,
                selectedCategory === category._id && styles.storyTextActive
              ]}
              numberOfLines={1}
            >
              {category.name}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Add Category Button */}
        <TouchableOpacity 
          style={styles.storyItem}
          onPress={openAddCategoryModal}
        >
          <View style={[styles.storyCircle, styles.addStoryCircle]}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.storyText}>
            Add
          </Text>
        </TouchableOpacity>

        {/* Manage Categories Button */}
        <TouchableOpacity 
          style={styles.storyItem}
          onPress={openCategoryManageModal}
        >
          <View style={[styles.storyCircle, styles.manageStoryCircle]}>
            <Ionicons name="settings" size={22} color="#FFFFFF" />
          </View>
          <Text style={styles.storyText}>
            Manage
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  // Product Card Component with Barcode Integration
  const ProductCard = ({ item }) => {
    const isOutOfStock = item.stock <= 0;
    const discount = item.discount > 0 ? `${item.discount}% off` : null;
    const unitDisplay = item.unitSize ? `${item.unitSize}${item.unit}` : item.unit;

    return (
      <TouchableOpacity 
        style={styles.productCard}
        onPress={() => openProductDetails(item)}
        activeOpacity={0.8}
      >
        {/* Product Image with Overlays */}
        <View style={styles.imageContainer}>
          <Image
            source={{ 
              uri: item.image || 'https://via.placeholder.com/200x200/FF6B35/FFFFFF?text=Product'
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

          {/* Discount Badge */}
          {discount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{discount}</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.productInfo}>
          {/* Title and Category */}
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>
          
          <Text style={styles.productCategory} numberOfLines={1}>
            {item.category?.name || 'Uncategorized'}
          </Text>

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

          {/* Price and Actions */}
          <View style={styles.priceSection}>
            <Text style={styles.productPrice}>₹{item.price}</Text>
            <View style={styles.actionButtons}>
              {/* Barcode Button */}
              <TouchableOpacity 
                style={[styles.actionButton, styles.barcodeButton]}
                onPress={(e) => {
                  e.stopPropagation();
                  openBarcodeModal(item);
                }}
              >
                <Ionicons name="barcode-outline" size={14} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Edit Button */}
              <TouchableOpacity 
                style={[styles.actionButton, styles.editButton]}
                onPress={(e) => {
                  e.stopPropagation();
                  openEditProductModal(item);
                }}
              >
                <Ionicons name="create-outline" size={14} color="#FFFFFF" />
              </TouchableOpacity>

              {/* Delete Button */}
              <TouchableOpacity 
                style={[styles.actionButton, styles.deleteButton]}
                onPress={(e) => {
                  e.stopPropagation();
                  handleDeleteProduct(item._id, item.name);
                }}
              >
                <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Empty State Component
  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="inventory-2" size={60} color={Colors.light.textSecondary} />
      <Text style={styles.emptyTitle}>
        {searchQuery || selectedCategory !== 'all' ? 'No Products Found' : 'No Products Yet'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery 
          ? 'Try adjusting your search or filter' 
          : selectedCategory !== 'all'
          ? 'No products in this category'
          : 'Start by adding your first product'
        }
      </Text>
      {(selectedCategory === 'all' && !searchQuery) && (
        <TouchableOpacity style={styles.addFirstButton} onPress={openAddProductModal}>
          <Text style={styles.addFirstButtonText}>Add First Product</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // Loading State
  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingText}>Loading Products...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Stats Bar - Sticky to navbar */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{products.length}</Text>
          <Text style={styles.statLabel}>Products</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{categories.length}</Text>
          <Text style={styles.statLabel}>Categories</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {products.filter(p => p.barcodeId || p.scannedBarcodeId).length}
          </Text>
          <Text style={styles.statLabel}>With Barcodes</Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={16} color={Colors.light.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor={Colors.light.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Instagram Stories-like Categories */}
      <CategoryStories />

      {/* Products Grid */}
      <FlatList
        data={filteredProducts}
        renderItem={({ item }) => <ProductCard item={item} />}
        keyExtractor={(item) => item._id}
        numColumns={2}
        contentContainerStyle={styles.productsGrid}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[Colors.light.accent]}
            tintColor={Colors.light.accent}
          />
        }
        ListEmptyComponent={<EmptyState />}
        columnWrapperStyle={styles.columnWrapper}
      />

      {/* Add Product FAB */}
      <TouchableOpacity style={styles.fab} onPress={openAddProductModal}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add Product Modal */}
      <Modal visible={productModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Product</Text>
              <TouchableOpacity onPress={closeProductModal}>
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Scan Barcode Section */}
              <View style={styles.scanSection}>
                <TouchableOpacity 
                  style={styles.scanBarcodeButton}
                  onPress={openBarcodeScanner}
                >
                  <Ionicons name="barcode-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.scanBarcodeButtonText}>Scan Product Barcode</Text>
                </TouchableOpacity>
                {scannedBarcode && (
                  <Text style={styles.scannedBarcodeText}>
                    Scanned Barcode: {scannedBarcode}
                  </Text>
                )}
              </View>

              {/* Product Image Upload */}
              {(productImageUri || productFormData.image) && (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: productImageUri || productFormData.image?.uri }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => {
                      setProductFormData({ ...productFormData, image: null });
                      setProductImageUri('');
                    }}
                  >
                    <Ionicons name="close" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Image</Text>
                <TouchableOpacity style={styles.imageUploadButton} onPress={pickProductImage}>
                  <Ionicons name="camera" size={20} color={Colors.light.accent} />
                  <Text style={styles.imageUploadText}>
                    {productFormData.image ? 'Change Image' : 'Select Product Image'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Product Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={productFormData.name}
                  onChangeText={(text) => setProductFormData({ ...productFormData, name: text })}
                  placeholder="Enter product name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={productFormData.description}
                  onChangeText={(text) => setProductFormData({ ...productFormData, description: text })}
                  placeholder="Enter product description"
                  multiline
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Price (₹) *</Text>
                <TextInput
                  style={styles.textInput}
                  value={productFormData.price}
                  onChangeText={(text) => setProductFormData({ ...productFormData, price: text })}
                  placeholder="Enter price"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat._id}
                      style={[styles.chip, productFormData.category === cat._id && styles.chipSelected]}
                      onPress={() => setProductFormData({ ...productFormData, category: cat._id })}
                    >
                      <Text style={[styles.chipText, productFormData.category === cat._id && styles.chipTextSelected]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.row}>
                <View style={styles.inputGroupFlex}>
                  <Text style={styles.inputLabel}>Stock</Text>
                  <TextInput
                    style={styles.textInput}
                    value={productFormData.stock}
                    onChangeText={(text) => setProductFormData({ ...productFormData, stock: text })}
                    placeholder="100"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputGroupFlex}>
                  <Text style={styles.inputLabel}>Unit Size</Text>
                  <TextInput
                    style={styles.textInput}
                    value={productFormData.unitSize}
                    onChangeText={(text) => setProductFormData({ ...productFormData, unitSize: text })}
                    placeholder="1"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Unit</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                  {['ml', 'liter', 'gm', 'kg', 'pack', 'piece'].map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={[styles.chip, productFormData.unit === unit && styles.chipSelected]}
                      onPress={() => setProductFormData({ ...productFormData, unit: unit })}
                    >
                      <Text style={[styles.chipText, productFormData.unit === unit && styles.chipTextSelected]}>
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeProductModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitButton, uploading && styles.submitButtonDisabled]} 
                onPress={handleAddProduct}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Add Product</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Barcode Scanner Modal for New Products */}
      <Modal
        visible={barcodeScannerVisible}
        transparent
        animationType="fade"
        onRequestClose={closeBarcodeScanner}
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
                onPress={closeBarcodeScanner}
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
                onBarcodeScanned={fetchingProductData ? undefined : handleBarcodeScannedForNewProduct}
              />
              <View style={styles.cameraOverlay}>
                <View style={styles.scanFrameContainer}>
                  <View style={styles.scanFrame} />
                  <Text style={styles.cameraInstruction}>
                    {fetchingProductData ? 'Fetching product data...' : 'Align barcode within the frame'}
                  </Text>
                </View>
                {fetchingProductData && (
                  <ActivityIndicator size="large" color="#FFF" style={styles.scanningIndicator} />
                )}
              </View>
            </View>

            <View style={styles.barcodeScannerFooter}>
              <Text style={styles.scannerHelpText}>
                Scanning will automatically fetch product details if available
              </Text>
              <TouchableOpacity
                style={styles.cancelScanButton}
                onPress={closeBarcodeScanner}
              >
                <Text style={styles.cancelScanButtonText}>Cancel Scan</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Category Modal */}
      <Modal visible={categoryModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {categoryFormData.name ? 'Edit Category' : 'Add New Category'}
              </Text>
              <TouchableOpacity onPress={closeCategoryModal}>
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Category Image Upload */}
              {(categoryImageUri || categoryFormData.image) && (
                <View style={styles.imagePreviewContainer}>
                  <Image
                    source={{ uri: categoryImageUri || categoryFormData.image?.uri }}
                    style={styles.imagePreview}
                    resizeMode="cover"
                  />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => {
                      setCategoryFormData({ ...categoryFormData, image: null });
                      setCategoryImageUri('');
                    }}
                  >
                    <Ionicons name="close" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category Image</Text>
                <TouchableOpacity style={styles.imageUploadButton} onPress={pickCategoryImage}>
                  <Ionicons name="camera" size={20} color={Colors.light.accent} />
                  <Text style={styles.imageUploadText}>
                    {categoryFormData.image ? 'Change Image' : 'Select Category Image'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Category Name *</Text>
                <TextInput
                  style={styles.textInput}
                  value={categoryFormData.name}
                  onChangeText={(text) => setCategoryFormData({ ...categoryFormData, name: text })}
                  placeholder="Enter category name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={categoryFormData.description}
                  onChangeText={(text) => setCategoryFormData({ ...categoryFormData, description: text })}
                  placeholder="Enter category description"
                  multiline
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Display Order</Text>
                <TextInput
                  style={styles.textInput}
                  value={categoryFormData.displayOrder.toString()}
                  onChangeText={(text) => {
                    const num = parseInt(text) || 0;
                    setCategoryFormData({ ...categoryFormData, displayOrder: Math.max(0, num) });
                  }}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeCategoryModal}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.submitButton, uploading && styles.submitButtonDisabled]} 
                onPress={handleAddCategory}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {categoryFormData.name ? 'Update Category' : 'Add Category'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manage Categories Modal */}
      <Modal visible={categoryManageModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manage Categories</Text>
              <TouchableOpacity onPress={closeCategoryManageModal}>
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {categories.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="category" size={60} color={Colors.light.textSecondary} />
                  <Text style={styles.emptyStateTitle}>No Categories Yet</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Start by adding your first category
                  </Text>
                </View>
              ) : (
                categories.map((category) => (
                  <View key={category._id} style={styles.categoryItem}>
                    <View style={styles.categoryInfo}>
                      {category.image ? (
                        <Image 
                          source={{ uri: category.image }} 
                          style={styles.categoryThumbnail}
                        />
                      ) : (
                        <View style={[styles.categoryThumbnail, styles.categoryThumbnailPlaceholder]}>
                          <MaterialIcons name="category" size={20} color="#64748B" />
                        </View>
                      )}
                      <View style={styles.categoryDetails}>
                        <Text style={styles.categoryName}>{category.name}</Text>
                        {category.description ? (
                          <Text style={styles.categoryDescription} numberOfLines={2}>
                            {category.description}
                          </Text>
                        ) : null}
                        <Text style={styles.categoryMeta}>
                          Display Order: {category.displayOrder || 0}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.categoryActions}>
                      <TouchableOpacity 
                        style={[styles.categoryActionButton, styles.editCategoryButton]}
                        onPress={() => handleEditCategory(category)}
                      >
                        <Ionicons name="create-outline" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.categoryActionButton, styles.deleteCategoryButton]}
                        onPress={() => handleDeleteCategory(category._id, category.name)}
                      >
                        <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeCategoryManageModal}>
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitButton} 
                onPress={openAddCategoryModal}
              >
                <Text style={styles.submitButtonText}>Add New Category</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Product Details Modal */}
      <Modal visible={productDetailsModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Product Details</Text>
              <TouchableOpacity onPress={closeProductDetails}>
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {selectedProduct && (
                <>
                  <View style={styles.productDetailsImageContainer}>
                    <Image
                      source={{ uri: selectedProduct.image || 'https://via.placeholder.com/200x200/FF6B35/FFFFFF?text=Product' }}
                      style={styles.productDetailsImage}
                      resizeMode="cover"
                    />
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Product Name</Text>
                    <Text style={styles.detailValue}>{selectedProduct.name}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <Text style={styles.detailValue}>{selectedProduct.category?.name || 'Uncategorized'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Price</Text>
                    <Text style={styles.detailValue}>₹{selectedProduct.price}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Stock</Text>
                    <Text style={[styles.detailValue, selectedProduct.stock <= 0 && styles.outOfStockText]}>
                      {selectedProduct.stock} {selectedProduct.unitSize}{selectedProduct.unit}
                    </Text>
                  </View>

                  {selectedProduct.discount > 0 && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Discount</Text>
                      <Text style={styles.detailValue}>{selectedProduct.discount}% off</Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Milk Type</Text>
                    <Text style={styles.detailValue}>{selectedProduct.milkType}</Text>
                  </View>

                  {/* Barcode Information in Details */}
                  {(selectedProduct.barcodeId || selectedProduct.scannedBarcodeId) && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Barcode Information</Text>
                      <View style={styles.barcodeDetails}>
                        {selectedProduct.scannedBarcodeId && (
                          <View style={styles.barcodeDetailItem}>
                            <Text style={styles.barcodeDetailLabel}>Scanned Barcode:</Text>
                            <Text style={styles.barcodeDetailValue}>{selectedProduct.scannedBarcodeId}</Text>
                          </View>
                        )}
                        {selectedProduct.barcodeId && (
                          <View style={styles.barcodeDetailItem}>
                            <Text style={styles.barcodeDetailLabel}>Generated Barcode:</Text>
                            <Text style={styles.barcodeDetailValue}>{selectedProduct.barcodeId}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {selectedProduct.description && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Description</Text>
                      <Text style={styles.detailValue}>{selectedProduct.description}</Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View style={styles.statusContainer}>
                      <View style={[styles.statusBadge, selectedProduct.isFeatured && styles.featuredBadge]}>
                        <Text style={styles.statusText}>
                          {selectedProduct.isFeatured ? 'Featured' : 'Regular'}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, selectedProduct.isAvailable ? styles.availableBadge : styles.unavailableBadge]}>
                        <Text style={styles.statusText}>
                          {selectedProduct.isAvailable ? 'Available' : 'Unavailable'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeProductDetails}>
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
              {selectedProduct && (
                <TouchableOpacity 
                  style={styles.submitButton} 
                  onPress={() => {
                    closeProductDetails();
                    openEditProductModal(selectedProduct);
                  }}
                >
                  <Text style={styles.submitButtonText}>Edit Product</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Barcode Management Modal */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },

  // Stats Bar - Sticky design
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    top: -29,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.accent,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
    marginHorizontal: 16,
  },

  // Search Bar
  searchContainer: {
    paddingHorizontal: 14,
    paddingTop: 5,
    paddingBottom: 1,
    backgroundColor: '#FFFFFF',
    top: -29,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 13,
    color: '#1E293B',
    fontWeight: '500',
  },

  // Instagram Stories Styles - Slightly larger icons
  storiesContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    top: -29,
  },
  storiesScrollContent: {
    paddingHorizontal: 10,
  },
  storyItem: {
    alignItems: 'center',
    marginHorizontal: 6,
    width: 70,
  },
  storyItemActive: {
    // Active state styling
  },
  storyCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.light.accent,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  storyCircleActive: {
    borderColor: Colors.light.accent,
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  allStoriesCircle: {
    backgroundColor: '#8B5CF6',
  },
  addStoryCircle: {
    backgroundColor: '#10B981',
  },
  manageStoryCircle: {
    backgroundColor: '#8B5CF6',
  },
  storyImage: {
    width: '100%',
    height: '100%',
    borderRadius: 31,
  },
  storyText: {
    marginTop: 5,
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
  },
  storyTextActive: {
    color: Colors.light.accent,
    fontWeight: '700',
  },

  // Products Grid - Reduced gap
  productsGrid: {
    padding: 8,
    paddingBottom: 100,
    paddingTop: 4, // Reduced top padding to move cards up
  },
  columnWrapper: {
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },

  // Product Card Styles with Barcode Integration
  productCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    margin: 6,
    width: (width - 40) / 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    height: 120,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  featuredBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  featuredText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  discountBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  productInfo: {
    padding: 10,
  },
  productName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
    lineHeight: 16,
  },
  productCategory: {
    fontSize: 11,
    color: Colors.light.accent,
    fontWeight: '600',
    marginBottom: 6,
  },
  
  // Barcode Info Styles
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
    fontSize: 9,
    color: Colors.light.textSecondary,
    fontFamily: 'monospace',
    flex: 1,
  },
  barcodeBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    marginLeft: 4,
  },
  scannedBadge: {
    backgroundColor: '#E3F2FD',
  },
  generatedBadge: {
    backgroundColor: '#E8F5E9',
  },
  barcodeBadgeText: {
    fontSize: 8,
    fontWeight: '600',
  },

  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.light.accent,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  actionButton: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barcodeButton: {
    backgroundColor: '#4CAF50',
  },
  editButton: {
    backgroundColor: '#3B82F6',
  },
  deleteButton: {
    backgroundColor: '#EF4444',
  },

  // FAB (Floating Action Button)
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: Colors.light.accent,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // Empty State Styles
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  addFirstButton: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  addFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
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
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  chipScroll: {
    marginBottom: 8,
  },
  chip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: Colors.light.accent,
  },
  chipText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  submitButton: {
    flex: 1,
    backgroundColor: Colors.light.accent,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Image Upload Styles
  imagePreviewContainer: {
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 16,
    backgroundColor: '#F9F9F9',
  },
  imageUploadText: {
    marginLeft: 8,
    fontSize: 14,
    color: Colors.light.accent,
    fontWeight: '600',
  },

  // Scan Barcode Section
  scanSection: {
    marginBottom: 20,
    alignItems: 'center',
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
    width: '100%',
  },
  scanBarcodeButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  scannedBarcodeText: {
    marginTop: 8,
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
    textAlign: 'center',
  },

  // Barcode Scanner Modal Styles
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
  scanningIndicator: {
    marginTop: 20,
  },

  // Product Details Styles
  productDetailsImageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  productDetailsImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  detailRow: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  
  // Barcode Details in Product Details Modal
  barcodeDetails: {
    marginTop: 8,
  },
  barcodeDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  barcodeDetailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  barcodeDetailValue: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#1E293B',
    fontWeight: '600',
  },

  statusContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  featuredBadge: {
    backgroundColor: '#FF6B35',
  },
  availableBadge: {
    backgroundColor: '#10B981',
  },
  unavailableBadge: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Category Management Styles
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
    textAlign: 'center',
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryThumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  categoryThumbnailPlaceholder: {
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryDetails: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  categoryMeta: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryActionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editCategoryButton: {
    backgroundColor: '#3B82F6',
  },
  deleteCategoryButton: {
    backgroundColor: '#EF4444',
  },

  // Barcode Modal Styles
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
    maxHeight: '85%',
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
  closeButton: {
    padding: 4,
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
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
    width: 220,
    height: 130,
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

  // Camera Styles
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
  cancelScanButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  cancelScanButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
});