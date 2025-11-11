// J:\dairy9\9dairy-UI\app\(admin)\inventory.jsx
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api/retailer/inventory`;

// Full list from your controller
const TRANSACTION_TYPES = [
  "STOCK_IN", "STOCK_OUT", "STOCK_ADJUSTMENT", "STOCK_TRANSFER", "STOCK_TAKE",
  "COMMITMENT", "RELEASE_COMMITMENT", "DAMAGE", "EXPIRY", "RETURN",
];

const REASONS = [
  "PURCHASE", "RETURN", "TRANSFER_IN", "PRODUCTION", "ADJUSTMENT_IN",
  "SALE", "DAMAGE", "EXPIRY", "TRANSFER_OUT", "SAMPLE", "ADJUSTMENT_OUT",
  "ORDER_RESERVATION", "ORDER_CANCELLED", "ORDER_DELIVERED",
  "INITIAL_SETUP", "CORRECTION", "PHYSICAL_COUNT", "SYSTEM_ADJUSTMENT",
];

export default function InventoryScreen() {
  const insets = useSafeAreaInsets();
  const { authToken, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [inventory, setInventory] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState({ critical: [], warning: [], total: 0 });
  const [recentActivity, setRecentActivity] = useState([]);
  const [summary, setSummary] = useState({
    totalProducts: 0,
    totalInventoryValue: 0,
    totalSales: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [stockModal, setStockModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [addProductModal, setAddProductModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Stock update
  const [qty, setQty] = useState("");
  const [transactionType, setTransactionType] = useState("STOCK_IN");
  const [reason, setReason] = useState("PURCHASE");

  // Edit product
  const [editSellingPrice, setEditSellingPrice] = useState("");
  const [editMinStock, setEditMinStock] = useState("");
  const [editMaxStock, setEditMaxStock] = useState("");

  // Add product to inventory
  const [productSearch, setProductSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [initialStock, setInitialStock] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [minStockLevel, setMinStockLevel] = useState("");
  const [maxStockLevel, setMaxStockLevel] = useState("");
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [addingProduct, setAddingProduct] = useState(false);

  // Fetch All Data
  const fetchData = useCallback(async () => {
    if (!authToken) {
      console.log("No auth token available");
      return;
    }
    
    try {
      setLoading(true);
      console.log("Starting to fetch inventory data...");
      
      const headers = { 
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      };

      // Fetch inventory data
      const invRes = await fetch(`${API_BASE_URL}`, { headers });
      console.log("Inventory response status:", invRes.status);
      
      if (!invRes.ok) {
        throw new Error(`HTTP error! status: ${invRes.status}`);
      }
      
      const invData = await invRes.json();
      console.log("Inventory API Response:", invData);
      
      if (invData.success) {
        const inventoryItems = invData.data?.inventory || [];
        console.log('📦 Inventory items received:', inventoryItems.length);
        
        setInventory(inventoryItems);
        
        // Use the summary from backend (now it has correct calculations)
        setSummary({
          totalProducts: invData.data?.summary?.totalProducts || 0,
          totalInventoryValue: invData.data?.summary?.totalInventoryValue || 0,
          totalSales: invData.data?.summary?.totalSalesValue || 0,
          lowStockCount: invData.data?.summary?.lowStockCount || 0,
          outOfStockCount: invData.data?.summary?.outOfStockCount || 0
        });

        console.log('🎯 Backend Summary:', invData.data?.summary);
      } else {
        console.error('Inventory API error:', invData.message);
      }

      // Fetch low stock alerts
      try {
        const alertRes = await fetch(`${API_BASE_URL}/alerts/low-stock`, { headers });
        if (alertRes.ok) {
          const alertData = await alertRes.json();
          if (alertData.success) {
            setLowStockAlerts(alertData.data || { critical: [], warning: [], total: 0 });
          }
        }
      } catch (alertError) {
        console.error('Error fetching alerts:', alertError);
      }

      // Fetch recent activity logs
      try {
        const logRes = await fetch(`${API_BASE_URL}/logs?limit=6`, { headers });
        if (logRes.ok) {
          const logData = await logRes.json();
          if (logData.success) {
            setRecentActivity(logData.data?.logs || []);
          }
        }
      } catch (logError) {
        console.error('Error fetching logs:', logError);
      }

    } catch (e) {
      console.error("Fetch Error:", e);
      Alert.alert("Error", "Failed to load inventory data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authToken]);

  useEffect(() => {
    if (!authLoading && authToken) {
      console.log("Auth loaded, token available, fetching data...");
      fetchData();
    } else if (authLoading) {
      console.log("Auth still loading...");
    } else if (!authToken) {
      console.log("No auth token available");
    }
  }, [authLoading, authToken, fetchData]);

  const onRefresh = () => {
    console.log("Refreshing data...");
    setRefreshing(true);
    fetchData();
  };

  // Search Products for Adding to Inventory
  const searchProducts = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchingProducts(true);
      const headers = { 
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/catalog/products/search?q=${encodeURIComponent(query)}`, { headers });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.data || []);
        } else {
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search products error:', error);
      setSearchResults([]);
    } finally {
      setSearchingProducts(false);
    }
  };

  // Add Product to Inventory
  const handleAddProductToInventory = async () => {
    if (!selectedProduct) {
      Alert.alert("Error", "Please select a product");
      return;
    }

    if (!sellingPrice) {
      Alert.alert("Error", "Please enter selling price");
      return;
    }

    try {
      setAddingProduct(true);
      
      const res = await fetch(`${API_BASE_URL}/products`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: selectedProduct._id,
          initialStock: parseInt(initialStock) || 0,
          sellingPrice: parseFloat(sellingPrice),
          costPrice: costPrice ? parseFloat(costPrice) : undefined,
          minStockLevel: minStockLevel ? parseInt(minStockLevel) : undefined,
          maxStockLevel: maxStockLevel ? parseInt(maxStockLevel) : undefined,
        }),
      });

      const data = await res.json();
      console.log("Add product response:", data);
      
      if (!data.success) throw new Error(data.message);

      Alert.alert("Success", "Product added to inventory successfully!");
      resetAddProductModal();
      setAddProductModal(false);
      fetchData();
    } catch (e) {
      console.error("Add product error:", e);
      Alert.alert("Error", e.message || "Failed to add product to inventory");
    } finally {
      setAddingProduct(false);
    }
  };

  // Reset Add Product Modal
  const resetAddProductModal = () => {
    setProductSearch("");
    setSearchResults([]);
    setSelectedProduct(null);
    setInitialStock("");
    setSellingPrice("");
    setCostPrice("");
    setMinStockLevel("");
    setMaxStockLevel("");
  };

  // Open Add Product Modal
  const openAddProductModal = () => {
    resetAddProductModal();
    setAddProductModal(true);
  };

  // Stock Update
  const handleStockUpdate = async () => {
    if (!selectedItem || !qty) {
      Alert.alert("Error", "Please enter quantity");
      return;
    }

    try {
      const productId = selectedItem.product?._id || selectedItem.product;
      
      console.log("Updating stock for product:", productId, "Quantity:", qty);
      
      const res = await fetch(`${API_BASE_URL}/stock`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: productId,
          quantity: parseInt(qty),
          transactionType,
          reason,
        }),
      });

      const data = await res.json();
      console.log("Stock update response:", data);
      
      if (!data.success) throw new Error(data.message);

      Alert.alert("Success", "Stock updated successfully!");
      setStockModal(false);
      resetStockModal();
      fetchData();
    } catch (e) {
      console.error("Stock update error:", e);
      Alert.alert("Error", e.message || "Failed to update stock");
    }
  };

  const openStockModal = (item) => {
    setSelectedItem(item);
    setQty("");
    setTransactionType("STOCK_IN");
    setReason("PURCHASE");
    setStockModal(true);
  };

  const resetStockModal = () => {
    setQty("");
    setTransactionType("STOCK_IN");
    setReason("PURCHASE");
  };

  // Edit Product
  const openEditModal = (item) => {
    setSelectedItem(item);
    setEditSellingPrice(item.sellingPrice?.toString() || "");
    setEditMinStock(item.minStockLevel?.toString() || "");
    setEditMaxStock(item.maxStockLevel?.toString() || "");
    setEditModal(true);
  };

  const handleEditProduct = async () => {
    if (!selectedItem) return;

    try {
      const res = await fetch(`${API_BASE_URL}/products/${selectedItem._id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sellingPrice: parseFloat(editSellingPrice) || 0,
          minStockLevel: parseInt(editMinStock) || 0,
          maxStockLevel: parseInt(editMaxStock) || 0,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      Alert.alert("Success", "Product updated successfully!");
      setEditModal(false);
      fetchData();
    } catch (e) {
      Alert.alert("Error", e.message || "Failed to update product");
    }
  };

  // Open Detail Modal
  const openDetailModal = (item) => {
    setSelectedItem(item);
    setDetailModal(true);
  };

  // Search - filter inventory items
  const filteredInventory = inventory.filter((item) => {
    const productName = item.productName || item.product?.name || '';
    const sku = item.product?.sku || '';
    return (
      productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sku.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  // Calculate available stock
  const getAvailableStock = (item) => {
    return Math.max(0, (item.currentStock || 0) - (item.committedStock || 0));
  };

  // Get product display name
  const getProductName = (item) => {
    return item.productName || item.product?.name || 'Unknown Product';
  };

  // Get product image
  const getProductImage = (item) => {
    return item.product?.image || item.image || "https://via.placeholder.com/80x80?text=No+Img";
  };

  // Get product unit
  const getProductUnit = (item) => {
    return item.product?.unit || 'unit';
  };

  // Calculate item sales value
  const getItemSalesValue = (item) => {
    return (item.totalSold || 0) * (item.sellingPrice || 0);
  };

  // Calculate item inventory value
  const getItemInventoryValue = (item) => {
    const itemCost = item.costPrice || item.sellingPrice || 0;
    return (item.currentStock || 0) * itemCost;
  };

  // Get stock status color and icon
  const getStockStatus = (availableStock, minStockLevel) => {
    if (availableStock === 0) {
      return { color: '#F44336', icon: 'error', text: 'Out of Stock' };
    } else if (availableStock <= minStockLevel) {
      return { color: '#FF9800', icon: 'warning', text: 'Low Stock' };
    } else {
      return { color: '#4CAF50', icon: 'check-circle', text: 'In Stock' };
    }
  };

  if (authLoading || loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingText}>Loading inventory...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Professional Header */}
      <View style={styles.professionalHeader}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Inventory</Text>
        </View>
      </View>

      <FlatList
        data={filteredInventory}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            {/* Consistent 2x2 Summary Grid */}
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryCard, styles.card1]}>
                <View style={[styles.iconContainer, { backgroundColor: Colors.light.accent }]}>
                  <Ionicons name="cube-outline" size={20} color="#FFF" />
                </View>
                <Text style={styles.summaryValue}>{summary.totalProducts || 0}</Text>
                <Text style={styles.summaryLabel}>Total Products</Text>
              </View>

              <View style={[styles.summaryCard, styles.card2]}>
                <View style={[styles.iconContainer, { backgroundColor: "#4CAF50" }]}>
                  <Ionicons name="trending-up" size={20} color="#FFF" />
                </View>
                <Text style={styles.summaryValue}>₹{(summary.totalSales || 0).toLocaleString()}</Text>
                <Text style={styles.summaryLabel}>Total Sales</Text>
              </View>

              <View style={[styles.summaryCard, styles.card3]}>
                <View style={[styles.iconContainer, { backgroundColor: "#2196F3" }]}>
                  <Ionicons name="business" size={20} color="#FFF" />
                </View>
                <Text style={styles.summaryValue}>₹{(summary.totalInventoryValue || 0).toLocaleString()}</Text>
                <Text style={styles.summaryLabel}>Stock Value</Text>
              </View>

              <View style={[styles.summaryCard, styles.card4]}>
                <View style={[styles.iconContainer, { backgroundColor: "#FF9800" }]}>
                  <Ionicons name="alert-circle" size={20} color="#FFF" />
                </View>
                <Text style={styles.summaryValue}>{summary.lowStockCount || 0}</Text>
                <Text style={styles.summaryLabel}>Low Stock</Text>
              </View>
            </View>

            {/* Compact Horizontal Recent Activities */}
            {recentActivity.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recent Activity</Text>
                  <TouchableOpacity>
                    <Text style={styles.seeAllText}>See All</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.activityScroll}
                >
                  {recentActivity.map((log, index) => (
                    <View key={log._id || index} style={styles.activityCard}>
                      <View style={[
                        styles.activityIcon,
                        { backgroundColor: log.transactionType?.includes('IN') ? '#E8F5E9' : '#FFEBEE' }
                      ]}>
                        <MaterialIcons
                          name={log.transactionType?.includes('IN') ? 'arrow-downward' : 'arrow-upward'}
                          size={16}
                          color={log.transactionType?.includes('IN') ? '#4CAF50' : '#F44336'}
                        />
                      </View>
                      <Text style={styles.activityQuantity}>
                        {log.quantity}
                      </Text>
                      <Text style={styles.activityProduct} numberOfLines={1}>
                        {log.product?.name || 'Product'}
                      </Text>
                      <Text style={styles.activityTime}>
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Search Bar - Consistent with Products Page */}
            <View style={styles.searchSection}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color={Colors.light.accent} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search inventory..."
                  placeholderTextColor="#BDBDBD"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>
              Inventory Items ({filteredInventory.length})
            </Text>
          </>
        }
        renderItem={({ item }) => {
          const availableStock = getAvailableStock(item);
          const productName = getProductName(item);
          const productImage = getProductImage(item);
          const productUnit = getProductUnit(item);
          const stockStatus = getStockStatus(availableStock, item.minStockLevel || 0);
          const itemSalesValue = getItemSalesValue(item);

          return (
            <TouchableOpacity 
              style={styles.productCard}
              onPress={() => openDetailModal(item)}
              activeOpacity={0.7}
            >
              <Image
                source={{ uri: productImage }}
                style={styles.productImage}
                defaultSource={{ uri: "https://via.placeholder.com/80x80?text=No+Img" }}
              />
              
              <View style={styles.productInfo}>
                <View style={styles.itemHeader}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {productName}
                  </Text>
                  <Text style={styles.salesValue}>
                    ₹{itemSalesValue.toLocaleString()}
                  </Text>
                </View>
                
                <View style={styles.stockStatusRow}>
                  <MaterialIcons 
                    name={stockStatus.icon} 
                    size={16} 
                    color={stockStatus.color} 
                  />
                  <Text style={[styles.stockStatusText, { color: stockStatus.color }]}>
                    {stockStatus.text}
                  </Text>
                </View>

                <View style={styles.stockInfo}>
                  <Text style={styles.availableStock}>
                    Available: <Text style={styles.stockNumber}>{availableStock}</Text> {productUnit}
                  </Text>
                </View>

                <View style={styles.detailsRow}>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Reserved</Text>
                    <Text style={styles.detailValue}>{item.committedStock || 0}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Sold</Text>
                    <Text style={styles.detailValue}>{item.totalSold || 0}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Price</Text>
                    <Text style={styles.detailValue}>₹{item.sellingPrice?.toFixed(0) || '0'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.categoryActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.qrButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    openStockModal(item);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={18} color={Colors.light.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    openEditModal(item);
                  }}
                >
                  <Feather name="edit-2" size={18} color={Colors.light.accent} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inventory-2" size={56} color={Colors.light.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery ? "No products found" : "No inventory items"}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? "Try a different search term" : "Add products to get started"}
            </Text>
            {!searchQuery && (
              <TouchableOpacity style={styles.addFirstButton} onPress={openAddProductModal}>
                <Text style={styles.addFirstButtonText}>Add Product to Inventory</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* FAB - Add Product to Inventory */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={openAddProductModal}
      >
        <Ionicons name="add" size={24} color="#FFF" />
      </TouchableOpacity>

      {/* Add Product to Inventory Modal */}
      <Modal visible={addProductModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.addProductModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Product to Inventory</Text>
              <TouchableOpacity onPress={() => setAddProductModal(false)}>
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Product Search */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Search Product *</Text>
                <View style={styles.searchContainer}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search products by name or SKU..."
                    placeholderTextColor="#BDBDBD"
                    value={productSearch}
                    onChangeText={(text) => {
                      setProductSearch(text);
                      searchProducts(text);
                    }}
                  />
                  {searchingProducts && (
                    <ActivityIndicator size="small" color={Colors.light.accent} />
                  )}
                </View>

                {/* Search Results */}
                {productSearch && searchResults.length > 0 && (
                  <View style={styles.searchResults}>
                    {searchResults.map((product) => (
                      <TouchableOpacity
                        key={product._id}
                        style={[
                          styles.searchResultItem,
                          selectedProduct?._id === product._id && styles.searchResultItemSelected
                        ]}
                        onPress={() => setSelectedProduct(product)}
                      >
                        <Image
                          source={{ uri: product.image || "https://via.placeholder.com/40x40?text=No+Img" }}
                          style={styles.searchResultImage}
                        />
                        <View style={styles.searchResultInfo}>
                          <Text style={styles.searchResultName}>{product.name}</Text>
                          <Text style={styles.searchResultSku}>SKU: {product.sku}</Text>
                          <Text style={styles.searchResultCategory}>{product.category?.name || 'Uncategorized'}</Text>
                        </View>
                        {selectedProduct?._id === product._id && (
                          <MaterialIcons name="check-circle" size={20} color={Colors.light.accent} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {productSearch && searchResults.length === 0 && !searchingProducts && (
                  <View style={styles.noResults}>
                    <Text style={styles.noResultsText}>No products found</Text>
                  </View>
                )}
              </View>

              {/* Selected Product Preview */}
              {selectedProduct && (
                <View style={styles.selectedProductPreview}>
                  <Text style={styles.previewTitle}>Selected Product</Text>
                  <View style={styles.previewContent}>
                    <Image
                      source={{ uri: selectedProduct.image || "https://via.placeholder.com/60x60?text=No+Img" }}
                      style={styles.previewImage}
                    />
                    <View style={styles.previewInfo}>
                      <Text style={styles.previewName}>{selectedProduct.name}</Text>
                      <Text style={styles.previewSku}>SKU: {selectedProduct.sku}</Text>
                      <Text style={styles.previewCategory}>{selectedProduct.category?.name || 'Uncategorized'}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Stock Information */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Initial Stock</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={initialStock}
                  onChangeText={setInitialStock}
                  placeholder="Enter initial stock quantity"
                />
              </View>

              {/* Pricing Information */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Selling Price (₹) *</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={sellingPrice}
                  onChangeText={setSellingPrice}
                  placeholder="Enter selling price"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Cost Price (₹)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={costPrice}
                  onChangeText={setCostPrice}
                  placeholder="Enter cost price (optional)"
                />
              </View>

              {/* Stock Levels */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Min Stock Level</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={minStockLevel}
                  onChangeText={setMinStockLevel}
                  placeholder="Enter minimum stock level (optional)"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Max Stock Level</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={maxStockLevel}
                  onChangeText={setMaxStockLevel}
                  placeholder="Enter maximum stock level (optional)"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setAddProductModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.submitButton,
                  (!selectedProduct || !sellingPrice || addingProduct) && styles.submitButtonDisabled
                ]} 
                onPress={handleAddProductToInventory}
                disabled={!selectedProduct || !sellingPrice || addingProduct}
              >
                {addingProduct ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.submitButtonText}>Add to Inventory</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Stock Update Modal */}
      <Modal visible={stockModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Stock</Text>
              <TouchableOpacity onPress={() => setStockModal(false)}>
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSubtitle}>
                {selectedItem ? getProductName(selectedItem) : ''}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Quantity *</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={qty}
                  onChangeText={setQty}
                  placeholder="Enter quantity"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Transaction Type *</Text>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.chipScroll}
                >
                  {TRANSACTION_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.chip,
                        transactionType === type && styles.chipSelected,
                      ]}
                      onPress={() => setTransactionType(type)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          transactionType === type && styles.chipTextSelected,
                        ]}
                      >
                        {type.replace(/_/g, " ")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reason *</Text>
                <ScrollView style={styles.reasonScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.reasonGrid}>
                    {REASONS.map((reasonItem) => (
                      <TouchableOpacity
                        key={reasonItem}
                        style={[
                          styles.reasonBtn,
                          reason === reasonItem && styles.reasonBtnActive,
                        ]}
                        onPress={() => setReason(reasonItem)}
                      >
                        <Text
                          style={[
                            styles.reasonText,
                            reason === reasonItem && styles.reasonTextActive,
                          ]}
                          numberOfLines={2}
                        >
                          {reasonItem.replace(/_/g, " ")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setStockModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.submitButton,
                  (!qty || isNaN(parseInt(qty))) && styles.submitButtonDisabled
                ]} 
                onPress={handleStockUpdate}
                disabled={!qty || isNaN(parseInt(qty))}
              >
                <Text style={styles.submitButtonText}>Update Stock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Product Modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Product Settings</Text>
              <TouchableOpacity onPress={() => setEditModal(false)}>
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSubtitle}>
                {selectedItem ? getProductName(selectedItem) : ''}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Selling Price (₹) *</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={editSellingPrice}
                  onChangeText={setEditSellingPrice}
                  placeholder="Enter selling price"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Min Stock Level *</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={editMinStock}
                  onChangeText={setEditMinStock}
                  placeholder="Enter minimum stock level"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Max Stock Level *</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={editMaxStock}
                  onChangeText={setEditMaxStock}
                  placeholder="Enter maximum stock level"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setEditModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitButton} 
                onPress={handleEditProduct}
              >
                <Text style={styles.submitButtonText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Product Detail Modal */}
      <Modal visible={detailModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.detailModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Product Details</Text>
              <TouchableOpacity onPress={() => setDetailModal(false)}>
                <MaterialIcons name="close" size={24} color={Colors.light.text} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.detailHeader}>
                <Image
                  source={{ uri: selectedItem ? getProductImage(selectedItem) : "https://via.placeholder.com/100x100?text=No+Img" }}
                  style={styles.detailImage}
                />
                <View style={styles.detailTitle}>
                  <Text style={styles.detailName}>
                    {selectedItem ? getProductName(selectedItem) : ''}
                  </Text>
                  <Text style={styles.detailSKU}>
                    SKU: {selectedItem?.product?.sku || 'N/A'}
                  </Text>
                </View>
              </View>

              {/* Stock Information */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Stock Information</Text>
                <View style={styles.detailGrid}>
                  <View style={styles.detailItemLarge}>
                    <Text style={styles.detailLabelLarge}>Available Stock</Text>
                    <Text style={styles.detailValueLarge}>
                      {selectedItem ? getAvailableStock(selectedItem) : 0} {selectedItem ? getProductUnit(selectedItem) : ''}
                    </Text>
                  </View>
                  <View style={styles.detailItemLarge}>
                    <Text style={styles.detailLabelLarge}>Current Stock</Text>
                    <Text style={styles.detailValueLarge}>{selectedItem?.currentStock || 0}</Text>
                  </View>
                  <View style={styles.detailItemLarge}>
                    <Text style={styles.detailLabelLarge}>Reserved Stock</Text>
                    <Text style={styles.detailValueLarge}>{selectedItem?.committedStock || 0}</Text>
                  </View>
                  <View style={styles.detailItemLarge}>
                    <Text style={styles.detailLabelLarge}>Total Sold</Text>
                    <Text style={styles.detailValueLarge}>{selectedItem?.totalSold || 0}</Text>
                  </View>
                </View>
              </View>

              {/* Pricing Information */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Pricing & Value</Text>
                <View style={styles.detailGrid}>
                  <View style={styles.detailItemLarge}>
                    <Text style={styles.detailLabelLarge}>Selling Price</Text>
                    <Text style={styles.detailValueLarge}>₹{selectedItem?.sellingPrice?.toFixed(2) || '0.00'}</Text>
                  </View>
                  <View style={styles.detailItemLarge}>
                    <Text style={styles.detailLabelLarge}>Cost Price</Text>
                    <Text style={styles.detailValueLarge}>₹{selectedItem?.costPrice?.toFixed(2) || selectedItem?.sellingPrice?.toFixed(2) || '0.00'}</Text>
                  </View>
                  <View style={styles.detailItemLarge}>
                    <Text style={styles.detailLabelLarge}>Sales Value</Text>
                    <Text style={styles.detailValueLarge}>₹{selectedItem ? getItemSalesValue(selectedItem).toLocaleString() : '0'}</Text>
                  </View>
                  <View style={styles.detailItemLarge}>
                    <Text style={styles.detailLabelLarge}>Stock Value</Text>
                    <Text style={styles.detailValueLarge}>₹{selectedItem ? getItemInventoryValue(selectedItem).toLocaleString() : '0'}</Text>
                  </View>
                </View>
              </View>

              {/* Stock Levels */}
              <View style={styles.detailSection}>
                <Text style={styles.detailSectionTitle}>Stock Levels</Text>
                <View style={styles.detailGrid}>
                  <View style={styles.detailItemLarge}>
                    <Text style={styles.detailLabelLarge}>Min Stock Level</Text>
                    <Text style={styles.detailValueLarge}>{selectedItem?.minStockLevel || 0}</Text>
                  </View>
                  <View style={styles.detailItemLarge}>
                    <Text style={styles.detailLabelLarge}>Max Stock Level</Text>
                    <Text style={styles.detailValueLarge}>{selectedItem?.maxStockLevel || 0}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setDetailModal(false)}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={() => {
                  setDetailModal(false);
                  openStockModal(selectedItem);
                }}
              >
                <Text style={styles.submitButtonText}>Update Stock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centered: { justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 16, color: Colors.light.textSecondary },

  // Professional Header - Consistent with Products Page
  professionalHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
  },

  // Search Section - Consistent with Products Page
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 8,
    alignItems: 'center',
    backgroundColor: Colors.light.white,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.white,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    paddingHorizontal: 16,
    height: 52,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.light.text,
    fontWeight: '400',
  },

  // Consistent 2x2 Summary Grid
  summaryGrid: { 
    flexDirection: "row", 
    flexWrap: "wrap",
    padding: 16,
    gap: 12,
    backgroundColor: "#FFF",
  },
  summaryCard: {
    width: '47%',
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  card1: { 
    borderLeftWidth: 4, 
    borderLeftColor: Colors.light.accent,
  },
  card2: {
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  card3: {
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
  },
  card4: {
    borderLeftWidth: 4,
    borderLeftColor: "#FF9800",
  },
  summaryValue: { 
    fontSize: 18, 
    fontWeight: "700", 
    color: Colors.light.text, 
    marginBottom: 4 
  },
  summaryLabel: { 
    fontSize: 12, 
    color: Colors.light.textSecondary,
    fontWeight: '500'
  },

  // Compact Horizontal Recent Activities
  section: { 
    marginBottom: 8,
    backgroundColor: Colors.light.white,
    paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: { 
    fontSize: 20, 
    fontWeight: "700", 
    color: Colors.light.text,
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
  },
  seeAllText: {
    fontSize: 14,
    color: Colors.light.accent,
    fontWeight: '600'
  },
  activityScroll: {
    paddingHorizontal: 16,
  },
  activityCard: {
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    minWidth: 120,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  activityQuantity: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  activityProduct: {
    fontSize: 13,
    color: Colors.light.text,
    fontWeight: '500',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },

  // Consistent Product Card - Matching Products Page
  productCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productImage: { 
    width: 80, 
    height: 80, 
    borderRadius: 12, 
    marginRight: 16 
  },
  productInfo: { 
    flex: 1,
  },
  productName: { 
    fontSize: 16, 
    fontWeight: "600", 
    color: Colors.light.text,
    marginBottom: 4 
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  salesValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4CAF50',
  },
  stockStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  stockStatusText: {
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  stockInfo: {
    marginBottom: 8,
  },
  availableStock: {
    fontSize: 14,
    color: Colors.light.text,
  },
  stockNumber: {
    fontWeight: '700',
    color: Colors.light.accent,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
  categoryActions: {
    flexDirection: "column",
    gap: 8,
  },
  actionButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  qrButton: {
    backgroundColor: '#E3F2FD',
  },
  editButton: {
    backgroundColor: '#E8F5E9',
  },

  // Empty State - Consistent with Products Page
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
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

  fab: {
    position: "absolute",
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

  /* Modal Styles - Consistent with Products Page */
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
  addProductModal: {
    maxHeight: '95%',
  },
  detailModal: {
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
  modalSubtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: Colors.light.text,
    backgroundColor: '#FFF',
    flex: 1,
  },
  
  // Search Results Styles
  searchResults: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    maxHeight: 200,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  searchResultItemSelected: {
    backgroundColor: '#F0F8FF',
  },
  searchResultImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 12,
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  searchResultSku: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  searchResultCategory: {
    fontSize: 11,
    color: Colors.light.accent,
  },
  noResults: {
    padding: 16,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  
  // Selected Product Preview
  selectedProductPreview: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  previewContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  previewSku: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  previewCategory: {
    fontSize: 12,
    color: Colors.light.accent,
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
  reasonScroll: {
    maxHeight: 150,
  },
  reasonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FFF',
    minWidth: '48%',
  },
  reasonBtnActive: {
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.accent,
  },
  reasonText: {
    fontSize: 13,
    color: Colors.light.text,
    textAlign: 'center',
  },
  reasonTextActive: {
    color: '#FFF',
    fontWeight: '600',
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

  // Detail Modal Styles
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  detailImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    marginRight: 16,
  },
  detailTitle: {
    flex: 1,
  },
  detailName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  detailSKU: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  detailItemLarge: {
    width: '48%',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  detailLabelLarge: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 8,
    fontWeight: '500',
  },
  detailValueLarge: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
});