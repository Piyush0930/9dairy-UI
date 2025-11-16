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
  StyleSheet,
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
        style={styles.productCard}
        onPress={() => openProductDetail(item)}
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

          {/* Size Badge and Price Row */}
          <View style={styles.bottomSection}>
            <View style={styles.sizePriceRow}>
              <View style={styles.unitBadge}>
                <Text style={styles.unitText}>{unitDisplay}</Text>
              </View>
              <View style={styles.priceSection}>
                <Text style={styles.productPrice}>₹{item.price}</Text>
                {discount && (
                  <View style={styles.discountContainer}>
                    <Text style={styles.discountBadge}>{discount}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Minimal Add Button */}
        <TouchableOpacity
          style={[
            styles.addButton,
            isAdding && styles.addButtonDisabled
          ]}
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
        <View style={styles.detailContainer}>
          {/* Header */}
          <View style={styles.detailHeader}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={closeProductDetail}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.light.text} />
            </TouchableOpacity>
            <Text style={styles.detailTitle}>Product Details</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView 
            style={styles.detailContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Product Image */}
            <View style={styles.detailImageContainer}>
              <Image
                source={{ uri: product.image || 'https://via.placeholder.com/300' }}
                style={styles.detailImage}
                resizeMode="cover"
              />
              {product.isFeatured && (
                <View style={styles.detailFeaturedBadge}>
                  <Ionicons name="star" size={14} color="#FFF" />
                  <Text style={styles.detailFeaturedText}>Featured</Text>
                </View>
              )}
            </View>

            {/* Product Info Card */}
            <View style={styles.infoCard}>
              {/* Basic Info */}
              <View style={styles.basicInfoSection}>
                <Text style={styles.detailProductName}>{product.name}</Text>
                <View style={styles.metaInfoRow}>
                  <Text style={styles.detailCategory}>{product.category?.name || 'Uncategorized'}</Text>
                  <Text style={styles.detailUnitText}>{unitDisplay}</Text>
                </View>
                
                {/* Product Price */}
                <View style={styles.priceSectionDetail}>
                  <Text style={styles.priceLabel}>Product Price:</Text>
                  <View style={styles.priceValueContainer}>
                    <Text style={styles.productPriceDetail}>₹{product.price}</Text>
                    {discount && (
                      <View style={styles.discountContainerDetail}>
                        <Text style={styles.discountBadgeDetail}>{discount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Description */}
              {product.description && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Description</Text>
                  <Text style={styles.detailDescription}>{product.description}</Text>
                </View>
              )}

              {/* Product Details - 2x2 Grid */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Product Details</Text>
                <View style={styles.detailsGrid}>
                  <View style={styles.detailItem}>
                    <Ionicons name="cube-outline" size={16} color={Colors.light.textSecondary} />
                    <Text style={styles.detailLabel}>Unit Type</Text>
                    <Text style={styles.detailValue}>{product.unit}</Text>
                  </View>
                  {product.unitSize && (
                    <View style={styles.detailItem}>
                      <Ionicons name="resize-outline" size={16} color={Colors.light.textSecondary} />
                      <Text style={styles.detailLabel}>Size/Weight</Text>
                      <Text style={styles.detailValue}>{product.unitSize}</Text>
                    </View>
                  )}
                  <View style={styles.detailItem}>
                    <Ionicons name="water-outline" size={16} color={Colors.light.textSecondary} />
                    <Text style={styles.detailLabel}>Milk Type</Text>
                    <Text style={styles.detailValue}>{product.milkType || 'Not specified'}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="pricetag-outline" size={16} color={Colors.light.textSecondary} />
                    <Text style={styles.detailLabel}>Category</Text>
                    <Text style={styles.detailValue}>
                      {product.category?.name || 'Uncategorized'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Nutritional Information - 2x2 Grid */}
              {product.nutritionalInfo && Object.values(product.nutritionalInfo).some(val => val) && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Nutritional Information</Text>
                  <Text style={styles.nutritionSubtitle}>(per 100{product.unit})</Text>
                  <View style={styles.nutritionGrid}>
                    {product.nutritionalInfo.calories && (
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>{product.nutritionalInfo.calories}</Text>
                        <Text style={styles.nutritionLabel}>Calories</Text>
                      </View>
                    )}
                    {product.nutritionalInfo.protein && (
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>{product.nutritionalInfo.protein}g</Text>
                        <Text style={styles.nutritionLabel}>Protein</Text>
                      </View>
                    )}
                    {product.nutritionalInfo.fat && (
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>{product.nutritionalInfo.fat}g</Text>
                        <Text style={styles.nutritionLabel}>Fat</Text>
                      </View>
                    )}
                    {product.nutritionalInfo.carbohydrates && (
                      <View style={styles.nutritionItem}>
                        <Text style={styles.nutritionValue}>{product.nutritionalInfo.carbohydrates}g</Text>
                        <Text style={styles.nutritionLabel}>Carbs</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Tags */}
              {product.tags && product.tags.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Tags</Text>
                  <View style={styles.tagsContainer}>
                    {product.tags.map((tag, index) => (
                      <View key={index} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Add to Inventory Button */}
          <View style={styles.detailFooter}>
            <TouchableOpacity
              style={[
                styles.detailAddButton,
                isAdding && styles.detailAddButtonDisabled,
              ]}
              onPress={() => addProductToInventory(product)}
              disabled={isAdding}
            >
              {isAdding ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="add-circle-outline" size={20} color="#FFF" />
                  <Text style={styles.detailAddButtonText}>
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
    <View style={styles.emptyContainer}>
      <MaterialIcons name="inventory-2" size={56} color={Colors.light.textSecondary} />
      <Text style={styles.emptyText}>
        {searchQuery ? 'No products found' : 'No products available'}
      </Text>
      <Text style={styles.emptySubtext}>
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
      <View style={[styles.container, styles.centered, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingText}>Loading Products…</Text>
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // MAIN RETURN (READ-ONLY PRODUCTS PAGE)
  // ──────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* OPTIMIZED HEADER WITH SEARCH */}
      <View style={styles.optimizedHeader}>
        <Text style={styles.optimizedHeaderTitle}>Products</Text>
        <View style={styles.optimizedSearchContainer}>
          <Ionicons name="search" size={18} color={Colors.light.textSecondary} style={styles.optimizedSearchIcon} />
          <TextInput
            style={styles.optimizedSearchInput}
            placeholder="Search products..."
            placeholderTextColor={Colors.light.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* IMPROVED STATS CARD */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{products.length}</Text>
          <Text style={styles.statLabel}>Total Products</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>
            {products.filter(p => p.isFeatured).length}
          </Text>
          <Text style={styles.statLabel}>Featured Products</Text>
        </View>
      </View>

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

      {/* Product Detail Modal */}
      <ProductDetailModal />
    </View>
  );
}

// ──────────────────────────────────────────────────────────────
// OPTIMIZED STYLES
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
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },

  // Optimized Header
  optimizedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  optimizedHeaderTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    flex: 1,
  },
  optimizedSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
    marginLeft: 16,
  },
  optimizedSearchIcon: {
    marginRight: 8,
  },
  optimizedSearchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
    padding: 0,
  },

  // Improved Stats Card
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.white,
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.accent,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#F0F0F0',
  },

  // Product List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
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
    minHeight: 140,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 16,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  featuredBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    backgroundColor: Colors.light.accent,
    borderRadius: 8,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  productInfo: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    flex: 1,
    marginRight: 8,
    lineHeight: 20,
  },
  productCategory: {
    fontSize: 14,
    color: Colors.light.accent,
    fontWeight: '600',
    marginBottom: 8,
  },
  productDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  bottomSection: {
    marginTop: 'auto',
  },
  sizePriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitBadge: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unitText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    fontWeight: '600',
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountBadge: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },

  // Add Button
  addButton: {
    backgroundColor: Colors.light.accent,
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  addButtonDisabled: {
    opacity: 0.6,
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

  // Product Detail Styles
  detailContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  backButton: {
    padding: 4,
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  headerSpacer: {
    width: 32,
  },
  detailContent: {
    flex: 1,
  },
  detailImageContainer: {
    position: 'relative',
    height: 250,
    backgroundColor: Colors.light.white,
  },
  detailImage: {
    width: '100%',
    height: '100%',
  },
  detailFeaturedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  detailFeaturedText: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: Colors.light.white,
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  basicInfoSection: {
    marginBottom: 20,
  },
  detailProductName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
    lineHeight: 26,
  },
  metaInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailCategory: {
    fontSize: 15,
    color: Colors.light.accent,
    fontWeight: '600',
  },
  detailUnitText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '600',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  priceSectionDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },
  priceLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    fontWeight: '600',
  },
  priceValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productPriceDetail: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  discountContainerDetail: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  discountBadgeDetail: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },

  section: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  nutritionSubtitle: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  detailDescription: {
    fontSize: 14,
    color: Colors.light.text,
    lineHeight: 20,
  },
  // 2x2 Grid Layouts
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItem: {
    width: '48%',
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 6,
    marginBottom: 2,
    textAlign: 'center',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
    textAlign: 'center',
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  nutritionItem: {
    width: '48%',
    alignItems: 'center',
    backgroundColor: '#F0F8FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E3F2FD',
  },
  nutritionValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.accent,
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  tagText: {
    fontSize: 11,
    color: Colors.light.text,
  },
  detailFooter: {
    padding: 16,
    backgroundColor: Colors.light.white,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  detailAddButton: {
    backgroundColor: Colors.light.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  detailAddButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  detailAddButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
});