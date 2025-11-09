// J:\dairy9\9dairy-UI\app\(admin)\inventory.jsx
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

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
  const [selectedItem, setSelectedItem] = useState(null);

  // Stock update
  const [qty, setQty] = useState("");
  const [transactionType, setTransactionType] = useState("STOCK_IN");
  const [reason, setReason] = useState("PURCHASE");

  // Edit product
  const [editSellingPrice, setEditSellingPrice] = useState("");
  const [editMinStock, setEditMinStock] = useState("");
  const [editMaxStock, setEditMaxStock] = useState("");

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
        const logRes = await fetch(`${API_BASE_URL}/logs?limit=5`, { headers });
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
    return item.product?.image || item.image || "https://via.placeholder.com/60x60?text=No+Img";
  };

  // Get product unit
  const getProductUnit = (item) => {
    return item.product?.unit || 'unit';
  };

  // Get product SKU
  const getProductSKU = (item) => {
    return item.product?.sku || 'N/A';
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
      {/* Summary Cards - Using backend calculated values */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <MaterialIcons name="inventory" size={24} color={Colors.light.accent} />
          <Text style={styles.summaryValue}>{summary.totalProducts || 0}</Text>
          <Text style={styles.summaryLabel}>Total Products</Text>
        </View>
        
        {/* TOTAL SALES - From backend */}
        <View style={styles.summaryCard}>
          <MaterialIcons name="attach-money" size={24} color="#4CAF50" />
          <Text style={styles.summaryValue}>₹{(summary.totalSales || 0).toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Total Sales</Text>
        </View>
        
        {/* STOCK VALUE - From backend */}
        <View style={styles.summaryCard}>
          <MaterialIcons name="warehouse" size={24} color="#2196F3" />
          <Text style={styles.summaryValue}>₹{(summary.totalInventoryValue || 0).toLocaleString()}</Text>
          <Text style={styles.summaryLabel}>Stock Value</Text>
        </View>
        
        <View style={styles.summaryCard}>
          <MaterialIcons name="warning" size={24} color="#FF9800" />
          <Text style={styles.summaryValue}>{summary.lowStockCount || 0}</Text>
          <Text style={styles.summaryLabel}>Low Stock</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={Colors.light.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by product name or SKU..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredInventory}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            {/* Low Stock Alerts Banner */}
            {(lowStockAlerts.total > 0) && (
              <View style={styles.alertBanner}>
                <MaterialIcons name="warning" size={18} color="#FF9800" />
                <Text style={styles.alertText}>
                  {lowStockAlerts.total} items need restocking
                  {lowStockAlerts.critical.length > 0 && ` (${lowStockAlerts.critical.length} critical)`}
                </Text>
              </View>
            )}

            {/* Recent Activity */}
            {recentActivity.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                {recentActivity.slice(0, 5).map((log, index) => (
                  <View key={log._id || index} style={styles.logItem}>
                    <View style={styles.logDot} />
                    <View style={styles.logContent}>
                      <Text style={styles.logText}>
                        {log.quantity} {log.product?.unit || 'units'} {log.transactionType?.replace(/_/g, " ")}
                      </Text>
                      <Text style={styles.logReason}>{log.reason}</Text>
                    </View>
                    <Text style={styles.logTime}>
                      {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>
              Inventory Items ({filteredInventory.length})
              {summary.totalInventoryValue > 0 && (
                <Text style={styles.totalValueText}> • Total Stock Value: ₹{summary.totalInventoryValue.toLocaleString()}</Text>
              )}
            </Text>
          </>
        }
        renderItem={({ item }) => {
          const availableStock = getAvailableStock(item);
          const isLowStock = availableStock <= (item.minStockLevel || 0);
          const isOutOfStock = availableStock === 0;
          const productName = getProductName(item);
          const productImage = getProductImage(item);
          const productUnit = getProductUnit(item);
          const productSKU = getProductSKU(item);
          const itemSalesValue = getItemSalesValue(item);
          const itemInventoryValue = getItemInventoryValue(item);

          return (
            <View style={styles.itemCard}>
              <Image
                source={{ uri: productImage }}
                style={styles.productImage}
                defaultSource={{ uri: "https://via.placeholder.com/60x60?text=No+Img" }}
              />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {productName}
                </Text>
                <Text style={styles.skuText}>SKU: {productSKU}</Text>
                
                <View style={styles.stockRow}>
                  <Text
                    style={[
                      styles.stockText,
                      isOutOfStock ? styles.outOfStock : isLowStock ? styles.lowStock : styles.inStock,
                    ]}
                  >
                    Available: {availableStock} {productUnit}
                  </Text>
                  {isLowStock && !isOutOfStock && (
                    <MaterialIcons name="warning" size={16} color="#FF9800" />
                  )}
                  {isOutOfStock && (
                    <MaterialIcons name="error" size={16} color="#F44336" />
                  )}
                </View>
                
                <Text style={styles.stockDetailText}>
                  Current: {item.currentStock || 0} | Committed: {item.committedStock || 0}
                </Text>
                
                {/* Sales & Inventory Information */}
                <View style={styles.salesRow}>
                  <Text style={styles.priceText}>Price: ₹{item.sellingPrice?.toFixed(2) || '0.00'}</Text>
                  <Text style={styles.salesText}>Sold: {item.totalSold || 0}</Text>
                  <Text style={styles.salesValueText}>Sales: ₹{itemSalesValue.toFixed(2)}</Text>
                </View>

                {/* Inventory Value for this item */}
                <View style={styles.inventoryValueRow}>
                  <Text style={styles.inventoryValueText}>
                    Stock Value: ₹{itemInventoryValue.toFixed(2)}
                  </Text>
                  <Text style={styles.costText}>
                    Cost: ₹{item.costPrice?.toFixed(2) || item.sellingPrice?.toFixed(2) || '0.00'}
                  </Text>
                </View>
                
                <Text style={styles.stockLevelText}>
                  Min: {item.minStockLevel || 0} | Max: {item.maxStockLevel || 0}
                </Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openStockModal(item)}
                >
                  <MaterialIcons name="add-circle" size={22} color={Colors.light.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openEditModal(item)}
                >
                  <MaterialIcons name="edit" size={20} color={Colors.light.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="inventory-2" size={48} color={Colors.light.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery ? "No products found" : "No inventory items"}
            </Text>
            <Text style={styles.emptySub}>
              {searchQuery ? "Try a different search" : "Add products to get started"}
            </Text>
          </View>
        }
      />

      {/* FAB - Add Product */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => router.push("/(admin)/add-product")}
      >
        <MaterialIcons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* Stock Update Modal */}
      <Modal visible={stockModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Update Stock</Text>
            <Text style={styles.modalSubtitle}>
              {selectedItem ? getProductName(selectedItem) : ''}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Quantity *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={qty}
                onChangeText={setQty}
                placeholder="Enter quantity"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Transaction Type *</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.pickerRow}
              >
                {TRANSACTION_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pickerBtn,
                      transactionType === type && styles.pickerBtnActive,
                    ]}
                    onPress={() => setTransactionType(type)}
                  >
                    <Text
                      style={[
                        styles.pickerText,
                        transactionType === type && styles.pickerTextActive,
                      ]}
                    >
                      {type.replace(/_/g, " ")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Reason *</Text>
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

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setStockModal(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.confirmBtn,
                  (!qty || isNaN(parseInt(qty))) && styles.confirmBtnDisabled
                ]} 
                onPress={handleStockUpdate}
                disabled={!qty || isNaN(parseInt(qty))}
              >
                <Text style={styles.confirmText}>Update Stock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Product Modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Edit Product Settings</Text>
            <Text style={styles.modalSubtitle}>
              {selectedItem ? getProductName(selectedItem) : ''}
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Selling Price (₹) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={editSellingPrice}
                onChangeText={setEditSellingPrice}
                placeholder="Enter selling price"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Min Stock Level *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={editMinStock}
                onChangeText={setEditMinStock}
                placeholder="Enter minimum stock level"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Max Stock Level *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={editMaxStock}
                onChangeText={setEditMaxStock}
                placeholder="Enter maximum stock level"
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn} 
                onPress={() => setEditModal(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.confirmBtn} 
                onPress={handleEditProduct}
              >
                <Text style={styles.confirmText}>Save Changes</Text>
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

  summaryRow: { 
    flexDirection: "row", 
    padding: 16, 
    gap: 8, 
    flexWrap: "wrap",
    backgroundColor: "#FFF",
    marginBottom: 8,
  },
  summaryCard: {
    flex: 1,
    minWidth: 80,
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  summaryValue: { 
    fontSize: 16, 
    fontWeight: "700", 
    color: Colors.light.text, 
    marginTop: 4 
  },
  summaryLabel: { 
    fontSize: 11, 
    color: Colors.light.textSecondary, 
    marginTop: 2,
    textAlign: 'center'
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  searchInput: { 
    flex: 1, 
    paddingVertical: 12, 
    marginLeft: 8, 
    fontSize: 16 
  },

  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3E0",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#FF9800",
  },
  alertText: { 
    marginLeft: 8, 
    color: "#F57C00", 
    fontWeight: "600",
    fontSize: 14 
  },

  section: { 
    paddingHorizontal: 16, 
    marginBottom: 16 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: "700", 
    color: Colors.light.text, 
    marginBottom: 12,
    marginHorizontal: 16 
  },
  totalValueText: {
    fontSize: 14,
    color: "#2196F3",
    fontWeight: "600"
  },

  logItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  logDot: { 
    width: 8, 
    height: 8, 
    borderRadius: 4, 
    backgroundColor: Colors.light.accent, 
    marginRight: 12 
  },
  logContent: {
    flex: 1,
  },
  logText: { 
    fontSize: 14, 
    color: Colors.light.text,
    fontWeight: '500'
  },
  logReason: { 
    fontSize: 12, 
    color: Colors.light.textSecondary,
    marginTop: 2
  },
  logTime: { 
    fontSize: 12, 
    color: Colors.light.textSecondary 
  },

  itemCard: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productImage: { 
    width: 60, 
    height: 60, 
    borderRadius: 8, 
    marginRight: 12 
  },
  itemInfo: { 
    flex: 1 
  },
  itemName: { 
    fontSize: 16, 
    fontWeight: "600", 
    color: Colors.light.text,
    marginBottom: 4 
  },
  skuText: { 
    fontSize: 13, 
    color: Colors.light.textSecondary, 
    marginBottom: 6 
  },
  stockRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 4 
  },
  stockText: { 
    fontSize: 14, 
    fontWeight: "600",
    marginRight: 6 
  },
  inStock: { color: "#4CAF50" },
  lowStock: { color: "#FF9800" },
  outOfStock: { color: "#F44336" },
  stockDetailText: { 
    fontSize: 12, 
    color: Colors.light.textSecondary, 
    marginBottom: 2 
  },
  // Sales & Inventory rows
  salesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  inventoryValueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  priceText: {
    fontSize: 12,
    color: Colors.light.accent,
    fontWeight: "600"
  },
  salesText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  salesValueText: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "600"
  },
  inventoryValueText: {
    fontSize: 12,
    color: "#2196F3",
    fontWeight: "600"
  },
  costText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  stockLevelText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 4
  },
  actions: { 
    flexDirection: "column", 
    gap: 8,
    justifyContent: 'center'
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(33, 150, 243, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  empty: { 
    alignItems: "center", 
    padding: 40 
  },
  emptyText: { 
    marginTop: 12, 
    fontSize: 16, 
    color: Colors.light.textSecondary,
    fontWeight: '500'
  },
  emptySub: { 
    fontSize: 14, 
    color: Colors.light.textSecondary, 
    marginTop: 4,
    textAlign: 'center'
  },

  fab: {
    position: "absolute",
    bottom: 24,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.light.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },

  /* Modal Styles */
  modalOverlay: { 
    flex: 1, 
    backgroundColor: "rgba(0,0,0,0.5)", 
    justifyContent: "center", 
    padding: 20 
  },
  modal: { 
    backgroundColor: "#FFF", 
    borderRadius: 16, 
    padding: 20, 
    maxHeight: "80%" 
  },
  modalTitle: { 
    fontSize: 20, 
    fontWeight: "700", 
    textAlign: "center",
    marginBottom: 4 
  },
  modalSubtitle: { 
    fontSize: 14, 
    color: Colors.light.textSecondary, 
    textAlign: "center", 
    marginBottom: 20 
  },

  inputGroup: { 
    marginBottom: 20 
  },
  label: { 
    fontSize: 16, 
    fontWeight: "600", 
    marginBottom: 8,
    color: Colors.light.text 
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFF'
  },

  pickerRow: { 
    flexDirection: "row", 
    marginBottom: 8 
  },
  pickerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginRight: 8,
    backgroundColor: '#FFF'
  },
  pickerBtnActive: { 
    backgroundColor: Colors.light.accent, 
    borderColor: Colors.light.accent 
  },
  pickerText: { 
    fontSize: 12, 
    color: Colors.light.text 
  },
  pickerTextActive: { 
    color: "#FFF", 
    fontWeight: "600" 
  },

  reasonScroll: {
    maxHeight: 150,
  },
  reasonGrid: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 8 
  },
  reasonBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
    backgroundColor: '#FFF'
  },
  reasonBtnActive: { 
    backgroundColor: Colors.light.accent, 
    borderColor: Colors.light.accent 
  },
  reasonText: { 
    fontSize: 12, 
    color: Colors.light.text,
    textAlign: 'center'
  },
  reasonTextActive: { 
    color: "#FFF", 
    fontWeight: "600" 
  },

  modalActions: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    marginTop: 20 
  },
  cancelBtn: { 
    flex: 1, 
    padding: 14, 
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
    marginRight: 8
  },
  cancelText: { 
    color: Colors.light.textSecondary, 
    fontWeight: "600",
    fontSize: 16
  },
  confirmBtn: {
    flex: 1,
    padding: 14,
    backgroundColor: Colors.light.accent,
    borderRadius: 8,
    alignItems: "center",
  },
  confirmBtnDisabled: {
    backgroundColor: Colors.light.border,
  },
  confirmText: { 
    color: "#FFF", 
    fontWeight: "600",
    fontSize: 16
  },
});