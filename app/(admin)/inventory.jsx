import PricingSlabsModal from "@/components/PricingSlabsModal";
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
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

// Prioritized transaction types and reasons
const TRANSACTION_TYPES = [
  "STOCK_IN", "STOCK_OUT", "STOCK_ADJUSTMENT"
];

const REASONS = [
  "PURCHASE", "SALE", "RETURN", "DAMAGE", "ADJUSTMENT_IN", "ADJUSTMENT_OUT"
];

// Time filter options
const TIME_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: '3months', label: '3 Months' },
  { key: '6months', label: '6 Months' },
  { key: 'year', label: 'This Year' },
  { key: 'all', label: 'All Time' }
];

// Filter types for summary cards
const FILTER_TYPES = {
  ALL: 'all',
  LOW_STOCK: 'low_stock',
  TOP_SELLING: 'top_selling',
  HIGH_STOCK: 'high_stock'
};

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
    totalRevenue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalItemsSold: 0,
    profitMargin: 0,
    averageOrderValue: 0
  });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState(FILTER_TYPES.ALL); // NEW: Active filter state

  // Scanner states
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [hasPermission, setHasPermission] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null);
  const [isScanningLocked, setIsScanningLocked] = useState(false);
  const [scannedProduct, setScannedProduct] = useState(null);
  
  // Animation refs
  const scanIndicatorAnim = useRef(new Animated.Value(0)).current;
  const scanSuccessAnim = useRef(new Animated.Value(0)).current;
  const scanErrorAnim = useRef(new Animated.Value(0)).current;
  
  const recentlyScannedRef = useRef(new Set());
  const cameraRef = useRef(null);

  // Modal states
  const [stockModal, setStockModal] = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [addProductModal, setAddProductModal] = useState(false);
  const [pricingModal, setPricingModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Stock update
  const [qty, setQty] = useState("");
  const [transactionType, setTransactionType] = useState("STOCK_IN");
  const [reason, setReason] = useState("PURCHASE");

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

  useEffect(() => {
    if (permission) {
      setHasPermission(permission.granted);
    }
  }, [permission]);

  // Fetch All Data with Time Filter
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

      // Fetch inventory data WITH TIME FILTER
      const invRes = await fetch(`${API_BASE_URL}?timeFilter=${timeFilter}`, { headers });
      console.log("Inventory response status:", invRes.status);
      
      if (!invRes.ok) {
        throw new Error(`HTTP error! status: ${invRes.status}`);
      }
      
      const invData = await invRes.json();
      console.log("Inventory API Response:", invData);
      
      if (invData.success) {
        const inventoryItems = invData.data?.inventory || [];
        console.log('📦 Inventory items received:', inventoryItems.length);

        // Filter out null items and items with null product references
        const validInventoryItems = inventoryItems.filter(item => item != null && item.product != null);
        console.log('📦 Valid inventory items:', validInventoryItems.length);

        setInventory(validInventoryItems);
        
        // Use the REVENUE-BASED summary from backend
        setSummary({
          totalProducts: invData.data?.summary?.totalProducts || 0,
          totalInventoryValue: invData.data?.summary?.totalInventoryValue || 0,
          totalSales: invData.data?.summary?.totalSales || 0,
          totalRevenue: invData.data?.summary?.totalRevenue || 0,
          lowStockCount: invData.data?.summary?.lowStockCount || 0,
          outOfStockCount: invData.data?.summary?.outOfStockCount || 0,
          totalItemsSold: invData.data?.summary?.totalItemsSold || 0,
          profitMargin: invData.data?.summary?.profitMargin || 0,
          averageOrderValue: invData.data?.summary?.averageOrderValue || 0
        });

        console.log('🎯 Revenue-Based Summary:', invData.data?.summary);
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
  }, [authToken, timeFilter]);

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

  // Time Filter Handler
  const handleTimeFilterChange = (filter) => {
    setTimeFilter(filter);
    setLoading(true);
  };

  // Filter Handler for Summary Cards
  const handleFilterChange = (filterType) => {
    setActiveFilter(filterType);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  // Calculate available stock
  const getAvailableStock = (item) => {
    if (!item) return 0;
    return Math.max(0, (item.currentStock || 0) - (item.committedStock || 0));
  };

  // Get product display name
  const getProductName = (item) => {
    if (!item) return 'Unknown Product';
    return item.productName || item.product?.name || 'Unknown Product';
  };

  // Get product image
  const getProductImage = (item) => {
    if (!item) return "https://via.placeholder.com/80x80?text=No+Img";
    return item.product?.image || item.image || "https://via.placeholder.com/80x80?text=No+Img";
  };

  // Get default price from product
  const getDefaultPrice = (item) => {
    if (!item) return 0;
    return item.product?.price || 0;
  };

  // Calculate item sales value (frontend calculation)
  const getItemSalesValue = (item) => {
    if (!item) return 0;
    return (item.totalSold || 0) * (item.sellingPrice || 0);
  };

  // Calculate item inventory value (frontend calculation)
  const getItemInventoryValue = (item) => {
    if (!item) return 0;
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

  // Check if product has quantity pricing enabled
  const hasQuantityPricing = (item) => {
    if (!item) return false;
    return item.enableQuantityPricing && item.pricingSlabs && item.pricingSlabs.length > 0;
  };

  // Check if price is overridden
  const isPriceOverridden = (item) => {
    if (!item) return false; 
    const defaultPrice = getDefaultPrice(item);
    const sellingPrice = item.sellingPrice || 0;
    return sellingPrice !== defaultPrice;
  };

  // Filter inventory based on active filter
  const getFilteredInventory = () => {
    let filtered = inventory.filter((item) => {
      const productName = item.productName || item.product?.name || '';
      const sku = item.product?.sku || '';
      return (
        productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sku.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });

    // Apply additional filters based on activeFilter
    switch (activeFilter) {
      case FILTER_TYPES.LOW_STOCK:
        filtered = filtered.filter(item => {
          const availableStock = getAvailableStock(item);
          const minStockLevel = item.minStockLevel || 0;
          return availableStock <= minStockLevel && availableStock > 0;
        }).sort((a, b) => {
          const stockA = getAvailableStock(a);
          const stockB = getAvailableStock(b);
          return stockA - stockB; // Sort by lowest stock first
        });
        break;

      case FILTER_TYPES.TOP_SELLING:
        filtered = filtered.filter(item => (item.totalSold || 0) > 0)
          .sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0)); // Sort by most sold first
        break;

      case FILTER_TYPES.HIGH_STOCK:
        filtered = filtered.sort((a, b) => {
          const stockA = getAvailableStock(a);
          const stockB = getAvailableStock(b);
          return stockB - stockA; // Sort by highest stock first
        });
        break;

      case FILTER_TYPES.ALL:
      default:
        // Default sorting - by product name
        filtered = filtered.sort((a, b) => {
          const nameA = getProductName(a).toLowerCase();
          const nameB = getProductName(b).toLowerCase();
          return nameA.localeCompare(nameB);
        });
        break;
    }

    return filtered;
  };

  const filteredInventory = getFilteredInventory();

  // Time Filter Component
  const TimeFilterSelector = () => (
    <View style={styles.timeFilterContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timeFilterScroll}
      >
        {TIME_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.timeFilterButton,
              timeFilter === filter.key && styles.timeFilterButtonActive
            ]}
            onPress={() => handleTimeFilterChange(filter.key)}
          >
            <Text style={[
              styles.timeFilterText,
              timeFilter === filter.key && styles.timeFilterTextActive
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Interactive Summary Grid Component
  const InteractiveSummaryGrid = () => (
    <View style={styles.summaryGrid}>
      {/* Total Sales Card - Click to show top selling products */}
      <TouchableOpacity 
        style={[
          styles.summaryCard, 
          styles.salesCard,
          activeFilter === FILTER_TYPES.TOP_SELLING && styles.summaryCardActive
        ]}
        onPress={() => handleFilterChange(
          activeFilter === FILTER_TYPES.TOP_SELLING ? FILTER_TYPES.ALL : FILTER_TYPES.TOP_SELLING
        )}
      >
        <View style={[styles.iconContainer, { backgroundColor: '#4CAF50' }]}>
          <Ionicons name="trending-up" size={20} color="#FFF" />
        </View>
        <Text style={styles.summaryValue}>₹{(summary.totalSales || 0).toLocaleString()}</Text>
        <Text style={styles.summaryLabel}>Total Sales</Text>
        <Text style={styles.timePeriodText}>
          {TIME_FILTERS.find(f => f.key === timeFilter)?.label || 'All Time'}
        </Text>
        {activeFilter === FILTER_TYPES.TOP_SELLING && (
          <View style={styles.activeFilterIndicator}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
          </View>
        )}
      </TouchableOpacity>

      {/* Low Stock Card - Click to show low stock products */}
      <TouchableOpacity 
        style={[
          styles.summaryCard, 
          styles.lowStockCard,
          activeFilter === FILTER_TYPES.LOW_STOCK && styles.summaryCardActive
        ]}
        onPress={() => handleFilterChange(
          activeFilter === FILTER_TYPES.LOW_STOCK ? FILTER_TYPES.ALL : FILTER_TYPES.LOW_STOCK
        )}
      >
        <View style={[styles.iconContainer, { backgroundColor: '#FF9800' }]}>
          <Ionicons name="warning" size={20} color="#FFF" />
        </View>
        <Text style={styles.summaryValue}>{summary.lowStockCount || 0}</Text>
        <Text style={styles.summaryLabel}>Low Stock</Text>
        <Text style={styles.stockAlertText}>
          {summary.outOfStockCount || 0} out of stock
        </Text>
        {activeFilter === FILTER_TYPES.LOW_STOCK && (
          <View style={styles.activeFilterIndicator}>
            <Ionicons name="checkmark-circle" size={16} color="#FF9800" />
          </View>
        )}
      </TouchableOpacity>

      {/* Inventory Value Card - Click to show high stock products */}
      <TouchableOpacity 
        style={[
          styles.summaryCard, 
          styles.inventoryCard,
          activeFilter === FILTER_TYPES.HIGH_STOCK && styles.summaryCardActive
        ]}
        onPress={() => handleFilterChange(
          activeFilter === FILTER_TYPES.HIGH_STOCK ? FILTER_TYPES.ALL : FILTER_TYPES.HIGH_STOCK
        )}
      >
        <View style={[styles.iconContainer, { backgroundColor: Colors.light.accent }]}>
          <Ionicons name="business" size={20} color="#FFF" />
        </View>
        <Text style={styles.summaryValue}>₹{(summary.totalInventoryValue || 0).toLocaleString()}</Text>
        <Text style={styles.summaryLabel}>Stock Value</Text>
        <Text style={styles.stockInfoText}>
          {summary.totalProducts || 0} products
        </Text>
        {activeFilter === FILTER_TYPES.HIGH_STOCK && (
          <View style={styles.activeFilterIndicator}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.light.accent} />
          </View>
        )}
      </TouchableOpacity>

      {/* Items Sold Card */}
      <View style={[styles.summaryCard, styles.itemsCard]}>
        <View style={[styles.iconContainer, { backgroundColor: '#2196F3' }]}>
          <Ionicons name="cube" size={20} color="#FFF" />
        </View>
        <Text style={styles.summaryValue}>{(summary.totalItemsSold || 0).toLocaleString()}</Text>
        <Text style={styles.summaryLabel}>Items Sold</Text>
        <Text style={styles.averageOrderText}>
          Avg: ₹{summary.averageOrderValue?.toFixed(0) || '0'}
        </Text>
      </View>
    </View>
  );

  // Filter Indicator Component
  const FilterIndicator = () => {
    if (activeFilter === FILTER_TYPES.ALL) return null;

    const getFilterText = () => {
      switch (activeFilter) {
        case FILTER_TYPES.LOW_STOCK:
          return `Showing Low Stock Items (${filteredInventory.length})`;
        case FILTER_TYPES.TOP_SELLING:
          return `Showing Top Selling Items (${filteredInventory.length})`;
        case FILTER_TYPES.HIGH_STOCK:
          return `Showing High Stock Items (${filteredInventory.length})`;
        default:
          return `Showing ${filteredInventory.length} items`;
      }
    };

    return (
      <View style={styles.filterIndicator}>
        <Text style={styles.filterIndicatorText}>{getFilterText()}</Text>
        <TouchableOpacity 
          style={styles.clearFilterButton}
          onPress={() => handleFilterChange(FILTER_TYPES.ALL)}
        >
          <Ionicons name="close" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>
    );
  };

  /* ------------------------------------------------------------------ */
  /* ALL REMAINING FUNCTIONS (Scanner, Modals, etc.) - KEEP EXACTLY AS THEY WERE */
  /* ------------------------------------------------------------------ */

  const requestCameraPermission = async () => {
    if (requestPermission) {
      const result = await requestPermission();
      setHasPermission(result.granted);
    }
  };

  const resetScannerState = () => {
    setScanFeedback(null);
    setIsScanningLocked(false);
    setTorchOn(false);
    recentlyScannedRef.current.clear();
    setScannedProduct(null);
    scanIndicatorAnim.setValue(0);
    scanSuccessAnim.setValue(0);
    scanErrorAnim.setValue(0);
  };

  const openScanner = () => {
    setIsScannerOpen(true);
    resetScannerState();
  };

  const closeScanner = () => {
    setIsScannerOpen(false);
    setTimeout(resetScannerState, 300);
  };

  // Animation functions
  const triggerScanIndicator = () => {
    Animated.sequence([
      Animated.timing(scanIndicatorAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scanIndicatorAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const triggerSuccessAnimation = () => {
    Animated.sequence([
      Animated.timing(scanSuccessAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scanSuccessAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const triggerErrorAnimation = () => {
    Animated.sequence([
      Animated.timing(scanErrorAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scanErrorAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (isScanningLocked) return;

    const barcodeId = data.trim();
    console.log('🔍 Scanning barcode:', barcodeId);

    if (recentlyScannedRef.current.has(barcodeId)) {
      console.log('⏭️ Skipping recently scanned barcode:', barcodeId);
      return;
    }

    setIsScanningLocked(true);
    recentlyScannedRef.current.add(barcodeId);
    setTimeout(() => {
      recentlyScannedRef.current.delete(barcodeId);
    }, 3000);

    triggerScanIndicator();
    setScanFeedback("scanning");

    try {
      console.log('📡 Searching product via catalog API for barcode:', barcodeId);
      
      let foundProduct = null;
      
      try {
        const headers = { 
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        };

        const catalogEndpoints = [
          `${process.env.EXPO_PUBLIC_API_URL}/api/catalog/products/barcode/${barcodeId}`,
          `${process.env.EXPO_PUBLIC_API_URL}/api/catalog/products/search?barcode=${encodeURIComponent(barcodeId)}`,
          `${process.env.EXPO_PUBLIC_API_URL}/api/catalog/products/${barcodeId}`
        ];

        for (const endpoint of catalogEndpoints) {
          try {
            console.log('🔍 Trying catalog endpoint:', endpoint);
            const searchRes = await fetch(endpoint, { headers });
            
            if (searchRes.ok) {
              const searchData = await searchRes.json();
              console.log('🔍 Catalog API response:', searchData);
              
              if (searchData.success && searchData.data) {
                foundProduct = searchData.data;
                console.log('✅ Found product via catalog API:', getProductName(foundProduct));
                break;
              } else if (searchData.product) {
                foundProduct = searchData.product;
                console.log('✅ Found product via catalog API:', getProductName(foundProduct));
                break;
              } else if (searchData.products && searchData.products.length > 0) {
                foundProduct = searchData.products[0];
                console.log('✅ Found product via search API:', getProductName(foundProduct));
                break;
              }
            }
          } catch (endpointError) {
            console.log('❌ Catalog endpoint failed:', endpoint, endpointError.message);
          }
        }
      } catch (apiError) {
        console.log('❌ All catalog API searches failed:', apiError.message);
      }

      if (foundProduct) {
        console.log('🎉 Product found in catalog:', getProductName(foundProduct));
        
        const isInInventory = inventory.some(item => {
          const itemProductId = item.product?._id || item.product;
          const foundProductId = foundProduct._id || foundProduct.product?._id;
          return itemProductId === foundProductId;
        });
        
        if (isInInventory) {
          console.log('🔄 Product is in inventory, opening stock modal...');
          
          setScanFeedback("success");
          triggerSuccessAnimation();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          setTimeout(() => {
            closeScanner();
            const inventoryItem = inventory.find(item => {
              const itemProductId = item.product?._id || item.product;
              const foundProductId = foundProduct._id || foundProduct.product?._id;
              return itemProductId === foundProductId;
            });
            
            if (inventoryItem) {
              setSelectedItem(inventoryItem);
              setTransactionType("STOCK_IN");
              setReason("PURCHASE");
              setQty("");
              setTimeout(() => setStockModal(true), 300);
            }
          }, 1200);
        } else {
          console.log('📦 Product found in catalog but not in inventory');
          
          setScanFeedback("warning");
          triggerSuccessAnimation();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          
          setTimeout(() => {
            closeScanner();
            setSelectedItem(foundProduct);
            setDetailModal(true);
          }, 1200);
        }
      } else {
        console.log('❌ Product not found in catalog for barcode:', barcodeId);
        
        setScanFeedback("error");
        triggerErrorAnimation();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        
        setTimeout(() => {
          setScanFeedback(null);
          setIsScanningLocked(false);
        }, 2000);
      }

    } catch (error) {
      console.error("❌ Scan error:", error);
      setScanFeedback("error");
      triggerErrorAnimation();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      setTimeout(() => {
        setScanFeedback(null);
        setIsScanningLocked(false);
      }, 2000);
    }
  };

  const renderScannerModal = () => (
    <Modal
      visible={isScannerOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={closeScanner}
    >
      <View style={styles.scannerContainer}>
        {/* Header */}
        <View style={styles.scannerHeader}>
          <TouchableOpacity
            style={styles.scannerBackButton}
            onPress={closeScanner}
          >
            <Ionicons name="chevron-down" size={28} color="#FFF" />
          </TouchableOpacity>
          
          <View style={styles.scannerStatsTop}>
            <View style={styles.statItemTop}>
              <Text style={styles.statNumberTop}>{inventory.length}</Text>
              <Text style={styles.statLabelTop}>Products</Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={[styles.flashButton, torchOn && styles.flashButtonActive]}
            onPress={() => setTorchOn(!torchOn)}
          >
            <Ionicons 
              name={torchOn ? "flashlight" : "flashlight-outline"} 
              size={22} 
              color={torchOn ? Colors.light.accent : "#FFF"} 
            />
          </TouchableOpacity>
        </View>

        {/* Camera Container with Visual Feedback */}
        <View style={styles.cameraContainer}>
          {hasPermission === null ? (
            <View style={styles.permissionContainer}>
              <ActivityIndicator size="large" color="#FFF" />
              <Text style={styles.permissionText}>Checking camera access</Text>
            </View>
          ) : hasPermission === false ? (
            <View style={styles.permissionContainer}>
              <Ionicons name="camera-off" size={64} color="#FFF" />
              <Text style={styles.permissionText}>Camera access required</Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={requestCameraPermission}
              >
                <Text style={styles.permissionButtonText}>Allow Camera Access</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraWrapper}>
              <CameraView
                ref={cameraRef}
                style={styles.camera}
                onBarcodeScanned={isScanningLocked ? undefined : handleBarcodeScanned}
                flash={torchOn ? "torch" : "off"}
                facing="back"
              />
              
              {/* Scan Overlay with Visual Feedback */}
              <View style={styles.scanOverlay}>
                <View style={styles.maskTop} />
                <View style={styles.scanArea}>
                  
                  {/* Animated Scan Frame with Color Feedback */}
                  <Animated.View style={[
                    styles.scanFrame,
                    scanFeedback === "success" && styles.scanFrameSuccess,
                    scanFeedback === "error" && styles.scanFrameError,
                    scanFeedback === "scanning" && styles.scanFrameScanning,
                    {
                      transform: [{
                        scale: scanIndicatorAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 1.05]
                        })
                      }]
                    }
                  ]}>
                    {/* Animated Success Overlay */}
                    <Animated.View style={[
                      styles.successOverlay,
                      {
                        opacity: scanSuccessAnim,
                        transform: [{
                          scale: scanSuccessAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1.2]
                          })
                        }]
                      }
                    ]}>
                      <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
                    </Animated.View>

                    {/* Animated Error Overlay */}
                    <Animated.View style={[
                      styles.errorOverlay,
                      {
                        opacity: scanErrorAnim,
                        transform: [{
                          scale: scanErrorAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1.2]
                          })
                        }]
                      }
                    ]}>
                      <Ionicons name="close-circle" size={80} color="#F44336" />
                    </Animated.View>

                    {/* Scan Frame Corners */}
                    <View style={[styles.corner, styles.cornerTopLeft]} />
                    <View style={[styles.corner, styles.cornerTopRight]} />
                    <View style={[styles.corner, styles.cornerBottomLeft]} />
                    <View style={[styles.corner, styles.cornerBottomRight]} />
                  </Animated.View>

                  {/* Scan Status Text */}
                  <View style={styles.scanStatusContainer}>
                    <Animated.Text style={[
                      styles.scanInstruction,
                      scanFeedback === "success" && styles.scanInstructionSuccess,
                      scanFeedback === "error" && styles.scanInstructionError,
                      {
                        opacity: scanIndicatorAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0.7]
                        })
                      }
                    ]}>
                      {scanFeedback === "scanning" ? "Searching product..." :
                       scanFeedback === "success" ? "Product found! Opening stock..." :
                       scanFeedback === "error" ? "Product not found" :
                       "Scan product barcode"}
                    </Animated.Text>
                    
                    {scanFeedback === "error" && (
                      <Animated.Text style={[
                        styles.scanErrorSubtext,
                        { opacity: scanErrorAnim }
                      ]}>
                        Try scanning a different barcode
                      </Animated.Text>
                    )}
                  </View>

                </View>
                <View style={styles.maskBottom} />
              </View>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.scannerFooter}>
          <Text style={styles.scannerHelpText}>
            {scanFeedback === "success" ? "Opening stock management..." :
             scanFeedback === "error" ? "Product not found in catalog" :
             "Point camera at product barcode to manage stock"}
          </Text>
          <Text style={styles.scannerDebugText}>
            Catalog API: {scanFeedback === "scanning" ? "Searching..." : "Ready"}
          </Text>
        </View>
      </View>
    </Modal>
  );

  // Delete Inventory Item
  const handleDeleteItem = async (item) => {
    Alert.alert(
      "Delete Product",
      `Are you sure you want to remove ${getProductName(item)} from your inventory?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/products/${item._id}`, {
                method: "DELETE",
                headers: {
                  Authorization: `Bearer ${authToken}`,
                  "Content-Type": "application/json",
                },
              });

              const data = await res.json();
              if (!data.success) throw new Error(data.message);

              Alert.alert("Success", "Product removed from inventory successfully!");
              await fetchData();
              
            } catch (e) {
              console.error("Delete error:", e);
              Alert.alert("Error", e.message || "Failed to delete product from inventory");
            }
          }
        }
      ]
    );
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

  // Add Product to Inventory - WITH AUTO-REFRESH
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
      await fetchData();
      
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

  // Stock Update - WITH AUTO-REFRESH
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
      await fetchData();
      
    } catch (e) {
      console.error("Stock update error:", e);
      Alert.alert("Error", e.message || "Failed to update stock");
    }
  };

  const openStockModal = (item) => {
    if (!item) {
      console.error('Cannot open stock modal: item is null');
      return;
    }
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

  // Open Detail Modal
  const openDetailModal = (item) => {
    if (!item) {
      console.error('Cannot open detail modal: item is null');
      return;
    }
    setSelectedItem(item);
    setDetailModal(true);
  };

  // Open Pricing Modal
  const openPricingModal = (item) => {
    if (!item) {
      console.error('Cannot open pricing modal: item is null');
      return;
    }
    setSelectedItem(item);
    setPricingModal(true);
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
      {/* Professional Header with Scanner */}
      <View style={styles.professionalHeader}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Inventory</Text>
          <TouchableOpacity 
            style={styles.scannerHeaderButton}
            onPress={openScanner}
          >
            <Ionicons name="barcode-outline" size={24} color={Colors.light.accent} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Time Filter Selector */}
      <TimeFilterSelector />

      <FlatList
        data={filteredInventory}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <>
            {/* Interactive Summary Grid */}
            <InteractiveSummaryGrid />

            {/* Filter Indicator */}
            <FilterIndicator />

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

            {/* Search Bar */}
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
              {activeFilter === FILTER_TYPES.LOW_STOCK ? 'Low Stock Items' :
               activeFilter === FILTER_TYPES.TOP_SELLING ? 'Top Selling Items' :
               activeFilter === FILTER_TYPES.HIGH_STOCK ? 'High Stock Items' :
               'Inventory Items'} ({filteredInventory.length})
            </Text>
          </>
        }
        renderItem={({ item, index }) => {
          if (!item) return null;
          const availableStock = getAvailableStock(item);
          const productName = getProductName(item);
          const productImage = getProductImage(item);
          const stockStatus = getStockStatus(availableStock, item.minStockLevel || 0);
          const itemSalesValue = getItemSalesValue(item);
          const defaultPrice = getDefaultPrice(item);
          const sellingPrice = item.sellingPrice || 0;
          const hasQPricing = hasQuantityPricing(item);
          const isOverridden = isPriceOverridden(item);

          return (
            <TouchableOpacity 
              style={styles.productCard}
              onPress={() => openDetailModal(item)}
              activeOpacity={0.7}
            >
              {/* Ranking indicator for top selling */}
              {activeFilter === FILTER_TYPES.TOP_SELLING && (
                <View style={styles.rankingBadge}>
                  <Text style={styles.rankingText}>#{index + 1}</Text>
                </View>
              )}

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
                
                {/* Price Display */}
                <View style={styles.priceContainer}>
                  <View style={styles.priceBackground}>
                    <Text style={styles.currentPrice}>₹{sellingPrice.toFixed(0) || '0'}</Text>
                    {isOverridden && (
                      <Text style={styles.defaultPrice}>₹{defaultPrice}</Text>
                    )}
                    {hasQPricing && (
                      <View style={styles.pricingBadge}>
                        <Ionicons name="pricetag" size={12} color="#FFF" />
                        <Text style={styles.pricingBadgeText}>Qty Pricing</Text>
                      </View>
                    )}
                    {isOverridden && !hasQPricing && (
                      <View style={styles.customPriceBadge}>
                        <Text style={styles.customPriceBadgeText}>Custom</Text>
                      </View>
                    )}
                  </View>
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
                    Available: <Text style={styles.stockNumber}>{availableStock}</Text>
                  </Text>
                  {activeFilter === FILTER_TYPES.TOP_SELLING && (
                    <Text style={styles.soldCount}>
                      Sold: <Text style={styles.soldNumber}>{item.totalSold || 0}</Text>
                    </Text>
                  )}
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
                    <Text style={styles.detailLabel}>Min Stock</Text>
                    <Text style={styles.detailValue}>{item.minStockLevel || 0}</Text>
                  </View>
                </View>
              </View>

              {/* SIMPLIFIED ACTIONS: +, Pricing, Delete Only */}
              <View style={styles.categoryActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.stockButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    openStockModal(item);
                  }}
                >
                  <Ionicons name="add" size={18} color={Colors.light.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.pricingButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    openPricingModal(item);
                  }}
                >
                  <Ionicons name="pricetag" size={18} color={Colors.light.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteItem(item);
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color="#F44336" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inventory-2" size={56} color={Colors.light.textSecondary} />
            <Text style={styles.emptyText}>
              {searchQuery ? "No products found" : 
               activeFilter === FILTER_TYPES.LOW_STOCK ? "No low stock items" :
               activeFilter === FILTER_TYPES.TOP_SELLING ? "No sales data available" :
               activeFilter === FILTER_TYPES.HIGH_STOCK ? "No inventory items" :
               "No inventory items"}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery ? "Try a different search term" : 
               activeFilter === FILTER_TYPES.LOW_STOCK ? "All products are well stocked" :
               activeFilter === FILTER_TYPES.TOP_SELLING ? "Sales data will appear here" :
               "Add products to get started"}
            </Text>
            {!searchQuery && activeFilter === FILTER_TYPES.ALL && (
              <TouchableOpacity style={styles.addFirstButton} onPress={openAddProductModal}>
                <Text style={styles.addFirstButtonText}>Add Product to Inventory</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* Enhanced Scanner Modal with Visual Feedback */}
      {renderScannerModal()}

      {/* Pricing Slabs Modal */}
      <PricingSlabsModal
        visible={pricingModal}
        onClose={() => setPricingModal(false)}
        inventoryItem={selectedItem}
        onSave={(updatedItem) => {
          setPricingModal(false);
          fetchData();
        }}
        authToken={authToken}
      />

      {/* FAB - Add Product to Inventory */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={openAddProductModal}
      >
        <Ionicons name="add" size={24} color="#FFF" />
      </TouchableOpacity>

      {/* ALL REMAINING MODALS - KEEP EXACTLY AS THEY WERE */}
      {/* Stock Update Modal, Product Detail Modal, Add Product Modal */}
      {/* ... (Keep all your existing modal code exactly as it was) */}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centered: { justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 16, color: Colors.light.textSecondary },

  // Time Filter Styles
  timeFilterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  timeFilterScroll: {
    paddingRight: 16,
  },
  timeFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  timeFilterButtonActive: {
    backgroundColor: Colors.light.accent,
  },
  timeFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  timeFilterTextActive: {
    color: '#FFF',
  },

  // Interactive Summary Grid Styles
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
    position: 'relative',
  },
  summaryCardActive: {
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  salesCard: { 
    borderLeftWidth: 4, 
    borderLeftColor: '#4CAF50',
  },
  lowStockCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  inventoryCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.accent,
  },
  itemsCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
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
  timePeriodText: {
    fontSize: 10,
    color: '#4CAF50',
    marginTop: 2,
    fontWeight: '500',
  },
  stockAlertText: {
    fontSize: 10,
    color: '#FF9800',
    marginTop: 2,
    fontWeight: '500',
  },
  stockInfoText: {
    fontSize: 10,
    color: Colors.light.accent,
    marginTop: 2,
    fontWeight: '500',
  },
  averageOrderText: {
    fontSize: 10,
    color: '#2196F3',
    marginTop: 2,
    fontWeight: '500',
  },
  activeFilterIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
  },

  // Filter Indicator
  filterIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.accent,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  filterIndicatorText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  clearFilterButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Ranking Badge for Top Selling
  rankingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#4CAF50',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  rankingText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Sold Count Style
  soldCount: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginLeft: 12,
  },
  soldNumber: {
    fontWeight: '700',
    color: '#4CAF50',
  },

  // Professional Header with Scanner
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
  scannerHeaderButton: {
    padding: 8,
    backgroundColor: '#F0F8FF',
    borderRadius: 12,
  },

  // All other existing styles remain exactly the same...
  // ... (Keep all your existing scanner styles, modal styles, product card styles, etc.)

  // Enhanced Scanner Styles with Visual Feedback
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  scannerBackButton: {
    padding: 8,
    width: 40,
  },
  flashButton: {
    padding: 8,
    width: 40,
    alignItems: 'center',
  },
  flashButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  scannerStatsTop: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statItemTop: {
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  statNumberTop: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  statLabelTop: {
    fontSize: 10,
    color: '#CCC',
    fontWeight: '500',
  },
  cameraContainer: {
    flex: 1,
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  maskTop: {
    flex: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  maskBottom: {
    flex: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  scanArea: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  scanFrame: {
    width: 250,
    height: 150,
    borderWidth: 2,
    borderColor: '#FFF',
    backgroundColor: 'transparent',
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  scanFrameSuccess: {
    borderColor: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  scanFrameError: {
    borderColor: '#F44336',
    backgroundColor: 'rgba(244, 67, 54, 0.1)',
  },
  scanFrameScanning: {
    borderColor: Colors.light.accent,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 25,
    height: 25,
    borderColor: '#FFF',
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scanStatusContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  scanInstruction: {
    fontSize: 14,
    color: '#FFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  scanInstructionSuccess: {
    color: '#4CAF50',
  },
  scanInstructionError: {
    color: '#F44336',
  },
  scanErrorSubtext: {
    fontSize: 12,
    color: '#F44336',
    textAlign: 'center',
    marginTop: 4,
  },
  scanSubInstruction: {
    fontSize: 12,
    color: '#CCC',
    textAlign: 'center',
    marginTop: 4,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    paddingHorizontal: 40,
  },
  permissionText: {
    fontSize: 18,
    color: '#FFF',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  permissionButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.light.accent,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scannerFooter: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  scannerHelpText: {
    fontSize: 14,
    color: '#CCC',
    textAlign: 'center',
  },
  scannerDebugText: {
    marginTop: 4,
    fontSize: 10,
    color: '#999',
    textAlign: 'center',
  },

  // Enhanced Product Header for Stock Modal
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  productHeaderImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  productHeaderInfo: {
    flex: 1,
  },
  productHeaderName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  productHeaderSku: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },

  // Enhanced Submit Button with Centered Content
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  // Simplified Product Card Actions
  categoryActions: {
    flexDirection: "column",
    gap: 8,
  },
  actionButton: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  stockButton: {
    backgroundColor: '#E3F2FD',
  },
  pricingButton: {
    backgroundColor: '#FFF3E0',
  },
  deleteButton: {
    backgroundColor: '#FFEBEE',
  },

  // Pricing Badge
  pricingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
    gap: 2,
  },
  pricingBadgeText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },
  customPriceBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  customPriceBadgeText: {
    fontSize: 10,
    color: '#FFF',
    fontWeight: '600',
  },

  // Override Indicator
  overrideIndicator: {
    fontSize: 12,
    color: '#4CAF50',
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Stock Modal Styles
  currentStockInfo: {
    backgroundColor: '#F8F9FA',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  currentStockLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  currentStockValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  transactionTypeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  transactionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    gap: 8,
  },
  transactionButtonInActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  transactionButtonOutActive: {
    backgroundColor: '#F44336',
    borderColor: '#F44336',
  },
  transactionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  transactionButtonTextActive: {
    color: '#FFF',
  },
  submitButtonIn: {
    backgroundColor: '#4CAF50',
  },
  submitButtonOut: {
    backgroundColor: '#F44336',
  },

  // Detail Modal Action Buttons
  detailActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  detailActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  stockInAction: {
    backgroundColor: '#4CAF50',
  },
  stockOutAction: {
    backgroundColor: '#F44336',
  },
  pricingAction: {
    backgroundColor: '#FF9800',
  },
  detailActionText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // Pricing Slabs Preview
  pricingSlabsPreview: {
    gap: 8,
  },
  slabPreviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  slabRange: {
    flex: 1,
  },
  slabRangeText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  slabDiscount: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  slabDiscountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E7D32',
  },

  // All other existing styles
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
    position: 'relative',
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
  priceContainer: {
    marginBottom: 6,
  },
  priceBackground: {
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  currentPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  defaultPrice: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textDecorationLine: 'line-through',
    marginLeft: 8,
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
    flexDirection: 'row',
    alignItems: 'center',
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
  priceOverrideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  defaultPriceNote: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  helperText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
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
  searchResultPrice: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  noResults: {
    padding: 16,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
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
  previewPrice: {
    fontSize: 12,
    color: Colors.light.textSecondary,
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