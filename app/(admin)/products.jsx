import Colors from '@/constants/colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [addingProducts, setAddingProducts] = useState({});
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productDetailVisible, setProductDetailVisible] = useState(false);

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

  const getAuthHeaders = () => {
    return { 
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };
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

      setProducts(
        Array.isArray(productsData) ? productsData : productsData.products || []
      );
      setCategories(
        Array.isArray(categoriesData)
          ? categoriesData
          : categoriesData.categories || []
      );
    } catch (error) {
      handleApiError(error, 'Failed to load data.');
      setProducts([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // ──────────────────────────────────────────────────────────────
  // PRODUCT DETAIL HANDLERS
  // ──────────────────────────────────────────────────────────────
  const openProductDetail = (product) => {
    setSelectedProduct(product);
    setProductDetailVisible(true);
  };

  const closeProductDetail = () => {
    setProductDetailVisible(false);
    setSelectedProduct(null);
  };

  // ──────────────────────────────────────────────────────────────
  // ADD PRODUCT TO RETAILER INVENTORY
  // ──────────────────────────────────────────────────────────────
  const addProductToInventory = async (product) => {
    const isValid = await validateAuthBeforeCall();
    if (!isValid) return;

    try {
      setAddingProducts(prev => ({ ...prev, [product._id]: true }));

      const requestBody = {
        productId: product._id,
        sellingPrice: product.price, // Use product's default price
        initialStock: 0 // Start with 0 stock
      };

      const response = await fetch(`${API_BASE_URL}/api/retailer/inventory/products`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to add product to inventory');
      }

      if (result.success) {
        Alert.alert(
          'Success!',
          `${product.name} has been added to your inventory.`,
          [{ text: 'OK' }]
        );

        // Close detail modal if open
        if (productDetailVisible) {
          closeProductDetail();
        }
      } else {
        throw new Error(result.message || 'Failed to add product');
      }

    } catch (error) {
      console.error('Add product error:', error);
      if (error.message.includes('already exists')) {
        Alert.alert('Product Exists', 'This product is already in your inventory.');
      } else {
        handleApiError(error, 'Failed to add product to inventory.');
      }
    } finally {
      setAddingProducts(prev => ({ ...prev, [product._id]: false }));
    }
  };

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.category?.name?.toLowerCase().includes(query) ||
          p.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }
    return filtered;
  }, [products, searchQuery]);

  // ──────────────────────────────────────────────────────────────
  // RENDER PRODUCT CARD (SIMPLIFIED - ONLY SHOW PRODUCT PRICE)
  // ──────────────────────────────────────────────────────────────
  const renderProduct = ({ item }) => {
    const discount = item.discount > 0 ? `${item.discount}% off` : null;
    const unitDisplay = item.unitSize ? `${item.unitSize}${item.unit}` : item.unit;
    const isAdding = addingProducts[item._id];
    
    return (
      <TouchableOpacity 
        className="bg-white rounded-xl p-4 mb-3 border border-gray-200 flex-row items-start shadow-sm min-h-[140px]"
        onPress={() => openProductDetail(item)}
        activeOpacity={0.7}
      >
        {/* Product Image */}
        <View className="relative mr-4">
          <Image
            source={{ 
              uri: item.image || 'https://via.placeholder.com/100'
            }}
            className="w-20 h-20 rounded-xl bg-gray-100"
            resizeMode="cover"
          />
          {/* Featured Badge */}
          {item.isFeatured && (
            <View className="absolute -top-1.5 -left-1.5 bg-blue-500 rounded-lg w-5 h-5 justify-center items-center shadow">
              <Ionicons name="star" size={12} color="#FFF" />
            </View>
          )}
        </View>

        {/* Product Info */}
        <View className="flex-1 mr-3">
          {/* Title Row */}
          <View className="flex-row justify-between items-start mb-1.5">
            <Text className="text-base font-bold text-gray-900 flex-1 mr-2 leading-5" numberOfLines={1}>
              {item.name}
            </Text>
          </View>

          {/* Category */}
          <Text className="text-sm text-blue-500 font-semibold mb-2" numberOfLines={1}>
            {item.category?.name || 'Uncategorized'}
          </Text>

          {/* Description */}
          {item.description && (
            <Text className="text-sm text-gray-500 leading-4.5 mb-3" numberOfLines={2}>
              {item.description}
            </Text>
          )}

          {/* Size Badge and Price Row */}
          <View className="mt-auto">
            <View className="flex-row items-center justify-between">
              <View className="bg-gray-100 px-2.5 py-1.5 rounded-lg">
                <Text className="text-xs text-gray-500 font-semibold">{unitDisplay}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-lg font-bold text-blue-500">₹{item.price}</Text>
                {discount && (
                  <View className="bg-green-50 px-2 py-1 rounded">
                    <Text className="text-xs text-green-600 font-semibold">{discount}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Minimal Add Button */}
        <TouchableOpacity
          className={`bg-blue-500 w-11 h-11 rounded-xl justify-center items-center shadow ${isAdding ? 'opacity-60' : ''}`}
          onPress={(e) => {
            e.stopPropagation();
            addProductToInventory(item);
          }}
          disabled={isAdding}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="add" size={18} color="#FFF" />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  // ──────────────────────────────────────────────────────────────
  // PRODUCT DETAIL COMPONENT (SIMPLIFIED - NO EDITABLE FIELDS)
  // ──────────────────────────────────────────────────────────────
  const ProductDetailModal = () => {
    if (!selectedProduct) return null;

    const product = selectedProduct;
    const isAdding = addingProducts[product._id];
    const discount = product.discount > 0 ? `${product.discount}% off` : null;
    const unitDisplay = product.unitSize ? `${product.unitSize}${product.unit}` : product.unit;

    return (
      <Modal
        visible={productDetailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeProductDetail}
      >
        <View className="flex-1 bg-gray-50">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity 
              className="p-1"
              onPress={closeProductDetail}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
            </TouchableOpacity>
            <Text className="text-lg font-bold text-gray-900">Product Details</Text>
            <View className="w-8" />
          </View>

          <ScrollView 
            className="flex-1"
            showsVerticalScrollIndicator={false}
          >
            {/* Product Image */}
            <View className="relative h-64 bg-white">
              <Image
                source={{ uri: product.image || 'https://via.placeholder.com/300' }}
                className="w-full h-full"
                resizeMode="cover"
              />
              {product.isFeatured && (
                <View className="absolute top-3 left-3 flex-row items-center bg-blue-500 px-2.5 py-1 rounded gap-1">
                  <Ionicons name="star" size={14} color="#FFF" />
                  <Text className="text-xs text-white font-semibold">Featured</Text>
                </View>
              )}
            </View>

            {/* Product Info Card */}
            <View className="bg-white m-4 rounded-xl p-5 shadow-sm">
              {/* Basic Info */}
              <View className="mb-5">
                <Text className="text-xl font-bold text-gray-900 mb-2 leading-6">{product.name}</Text>
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="text-base text-blue-500 font-semibold">{product.category?.name || 'Uncategorized'}</Text>
                  <Text className="text-sm text-gray-500 font-semibold bg-gray-100 px-2.5 py-1.5 rounded-lg">
                    {unitDisplay}
                  </Text>
                </View>
                
                {/* Product Price */}
                <View className="flex-row items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                  <Text className="text-sm text-gray-500 font-semibold">Product Price:</Text>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-base font-bold text-blue-500">₹{product.price}</Text>
                    {discount && (
                      <View className="bg-green-50 px-2 py-1 rounded">
                        <Text className="text-xs text-green-600 font-semibold">{discount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Description */}
              {product.description && (
                <View className="mb-5 pb-4 border-b border-gray-200">
                  <Text className="text-base font-bold text-gray-900 mb-2">Description</Text>
                  <Text className="text-sm text-gray-900 leading-5">{product.description}</Text>
                </View>
              )}

              {/* Product Details - 2x2 Grid */}
              <View className="mb-5 pb-4 border-b border-gray-200">
                <Text className="text-base font-bold text-gray-900 mb-2">Product Details</Text>
                <View className="flex-row flex-wrap gap-3">
                  <View className="w-[48%] bg-gray-50 p-3 rounded-lg border border-gray-200 items-center">
                    <Ionicons name="cube-outline" size={16} color={Colors.light.textSecondary} />
                    <Text className="text-xs text-gray-500 mt-1.5 mb-0.5 text-center">Unit Type</Text>
                    <Text className="text-sm font-semibold text-gray-900 text-center">{product.unit}</Text>
                  </View>
                  {product.unitSize && (
                    <View className="w-[48%] bg-gray-50 p-3 rounded-lg border border-gray-200 items-center">
                      <Ionicons name="resize-outline" size={16} color={Colors.light.textSecondary} />
                      <Text className="text-xs text-gray-500 mt-1.5 mb-0.5 text-center">Size/Weight</Text>
                      <Text className="text-sm font-semibold text-gray-900 text-center">{product.unitSize}</Text>
                    </View>
                  )}
                  <View className="w-[48%] bg-gray-50 p-3 rounded-lg border border-gray-200 items-center">
                    <Ionicons name="water-outline" size={16} color={Colors.light.textSecondary} />
                    <Text className="text-xs text-gray-500 mt-1.5 mb-0.5 text-center">Milk Type</Text>
                    <Text className="text-sm font-semibold text-gray-900 text-center">{product.milkType || 'Not specified'}</Text>
                  </View>
                  <View className="w-[48%] bg-gray-50 p-3 rounded-lg border border-gray-200 items-center">
                    <Ionicons name="pricetag-outline" size={16} color={Colors.light.textSecondary} />
                    <Text className="text-xs text-gray-500 mt-1.5 mb-0.5 text-center">Category</Text>
                    <Text className="text-sm font-semibold text-gray-900 text-center">
                      {product.category?.name || 'Uncategorized'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Nutritional Information - 2x2 Grid */}
              {product.nutritionalInfo && Object.values(product.nutritionalInfo).some(val => val) && (
                <View className="mb-5 pb-4 border-b border-gray-200">
                  <Text className="text-base font-bold text-gray-900 mb-2">Nutritional Information</Text>
                  <Text className="text-xs text-gray-500 mb-3 italic">(per 100{product.unit})</Text>
                  <View className="flex-row flex-wrap gap-3">
                    {product.nutritionalInfo.calories && (
                      <View className="w-[48%] items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <Text className="text-sm font-bold text-blue-500 mb-1">{product.nutritionalInfo.calories}</Text>
                        <Text className="text-xs text-gray-500 text-center">Calories</Text>
                      </View>
                    )}
                    {product.nutritionalInfo.protein && (
                      <View className="w-[48%] items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <Text className="text-sm font-bold text-blue-500 mb-1">{product.nutritionalInfo.protein}g</Text>
                        <Text className="text-xs text-gray-500 text-center">Protein</Text>
                      </View>
                    )}
                    {product.nutritionalInfo.fat && (
                      <View className="w-[48%] items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <Text className="text-sm font-bold text-blue-500 mb-1">{product.nutritionalInfo.fat}g</Text>
                        <Text className="text-xs text-gray-500 text-center">Fat</Text>
                      </View>
                    )}
                    {product.nutritionalInfo.carbohydrates && (
                      <View className="w-[48%] items-center bg-blue-50 p-3 rounded-lg border border-blue-100">
                        <Text className="text-sm font-bold text-blue-500 mb-1">{product.nutritionalInfo.carbohydrates}g</Text>
                        <Text className="text-xs text-gray-500 text-center">Carbs</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <View className="mb-5 pb-4 border-b border-gray-200">
                  <Text className="text-base font-bold text-gray-900 mb-2">Tags</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {product.tags.map((tag, index) => (
                      <View key={index} className="bg-gray-100 px-2.5 py-1 rounded-xl border border-gray-200">
                        <Text className="text-xs text-gray-900">{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Add to Inventory Button */}
          <View className="p-4 bg-white border-t border-gray-200">
            <TouchableOpacity
              className={`bg-blue-500 flex-row items-center justify-center py-3.5 rounded-lg gap-2 ${isAdding ? 'bg-gray-400' : ''}`}
              onPress={() => addProductToInventory(product)}
              disabled={isAdding}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={20} color="#FFF" />
                  <Text className="text-white font-semibold text-base">
                    Add to Inventory
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const EmptyList = () => (
    <View className="items-center justify-center py-15">
      <MaterialIcons name="inventory-2" size={56} color={Colors.light.textSecondary} />
      <Text className="text-lg font-semibold text-gray-900 mt-4">
        {searchQuery ? 'No products found' : 'No products available'}
      </Text>
      <Text className="text-sm text-gray-500 mt-2 text-center px-8">
        {searchQuery
          ? 'Try a different search term'
          : 'Products will appear here once added by admin'}
      </Text>
    </View>
  );

  // ──────────────────────────────────────────────────────────────
  // LOADING STATES
  // ──────────────────────────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <View className={`flex-1 bg-gray-50 justify-center items-center pt-[${insets.top + 16}px]`}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text className="mt-4 text-base text-gray-500">Loading Products…</Text>
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // MAIN RETURN (READ-ONLY PRODUCTS PAGE)
  // ──────────────────────────────────────────────────────────────
  return (
    <View className={`flex-1 bg-gray-50 pt-[${insets.top}px]`}>
      {/* OPTIMIZED HEADER WITH SEARCH */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <Text className="text-2xl font-bold text-gray-900 flex-1">Products</Text>
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2 flex-1 ml-4">
          <Ionicons name="search" size={18} color={Colors.light.textSecondary} className="mr-2" />
          <TextInput
            className="flex-1 text-sm text-gray-900 p-0"
            placeholder="Search products..."
            placeholderTextColor={Colors.light.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* IMPROVED STATS CARD */}
      <View className="flex-row items-center bg-white mx-5 my-4 rounded-xl py-5 px-2.5 shadow-sm">
        <View className="flex-1 items-center px-2.5">
          <Text className="text-2xl font-bold text-blue-500 mb-1">{products.length}</Text>
          <Text className="text-xs text-gray-500 font-semibold text-center">Total Products</Text>
        </View>
        <View className="w-px h-10 bg-gray-100" />
        <View className="flex-1 items-center px-2.5">
          <Text className="text-2xl font-bold text-blue-500 mb-1">
            {products.filter(p => p.isFeatured).length}
          </Text>
          <Text className="text-xs text-gray-500 font-semibold text-center">Featured Products</Text>
        </View>
      </View>

      {/* Product List with Pull to Refresh */}
      <FlatList
        data={filteredProducts}
        renderItem={renderProduct}
        keyExtractor={(item) => item._id}
        className="px-5 pb-5"
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

      {/* Product Detail Modal */}
      <ProductDetailModal />
    </View>
  );
}