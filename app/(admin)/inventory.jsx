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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState(FILTER_TYPES.ALL);
  const [error, setError] = useState(null);

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

  // Add debouncing to search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (permission) {
      setHasPermission(permission.granted);
    }
  }, [permission]);

  const fetchData = useCallback(async () => {
  if (!authToken) {
    console.log("No auth token available");
    setError("Authentication required");
    setLoading(false);
    return;
  }
  
  try {
    setLoading(true);
    setError(null);
    console.log("Starting to fetch inventory data...");
    
    const headers = { 
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    // Fetch inventory data WITH TIME FILTER
    const invRes = await fetch(`${API_BASE_URL}?timeFilter=${timeFilter}`, { headers });
    console.log("Inventory response status:", invRes.status);
    
    if (!invRes.ok) {
      const errorText = await invRes.text();
      throw new Error(`HTTP error! status: ${invRes.status}, message: ${errorText}`);
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
      throw new Error(invData.message || 'Failed to fetch inventory data');
    }

    // Fetch low stock alerts with error handling
    try {
      const alertRes = await fetch(`${API_BASE_URL}/alerts/low-stock`, { headers });
      if (alertRes.ok) {
        const alertData = await alertRes.json();
        if (alertData.success) {
          setLowStockAlerts(alertData.data || { critical: [], warning: [], total: 0 });
        }
      } else {
        console.warn('Failed to fetch low stock alerts:', alertRes.status);
      }
    } catch (alertError) {
      console.error('Error fetching alerts:', alertError);
    }

    // Fetch recent activity logs with error handling - FIXED THIS SECTION
    try {
      const logRes = await fetch(`${API_BASE_URL}/logs?limit=6`, { headers });
      if (logRes.ok) {
        const logData = await logRes.json(); // ✅ Fixed: was logData.json()
        if (logData.success) {
          setRecentActivity(logData.data?.logs || []);
        }
      } else {
        console.warn('Failed to fetch recent activity:', logRes.status);
      }
    } catch (logError) {
      console.error('Error fetching logs:', logError);
    }

  } catch (e) {
    console.error("Fetch Error:", e);
    setError(e.message);
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
      setError("Authentication required");
      setLoading(false);
    }
  }, [authLoading, authToken, fetchData]);

  const onRefresh = () => {
    console.log("Refreshing data...");
    setRefreshing(true);
    setError(null);
    fetchData();
  };

  // Time Filter Handler
  const handleTimeFilterChange = (filter) => {
    setTimeFilter(filter);
    setLoading(true);
    setError(null);
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

  // Calculate item sales value with per-piece pricing
  const getItemSalesValue = (item) => {
    if (!item) return 0;
    
    // If quantity pricing is enabled, calculate based on per-piece pricing
    if (item.enableQuantityPricing && item.pricingSlabs && item.pricingSlabs.length > 0) {
      const totalSold = item.totalSold || 0;
      const basePrice = item.sellingPrice || 0;
      
      // For sales value calculation, we'll use the base price for simplicity
      // In a real scenario, you might want to track actual discounted prices per sale
      return totalSold * basePrice;
    }
    
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

  // Input validation for stock updates
  const validateStockInput = (qty, transactionType, selectedItem) => {
    if (!qty || isNaN(qty) || parseInt(qty) <= 0) {
      Alert.alert("Error", "Please enter a valid positive quantity");
      return false;
    }
    
    if (transactionType === "STOCK_OUT") {
      const availableStock = getAvailableStock(selectedItem);
      if (parseInt(qty) > availableStock) {
        Alert.alert("Error", `Cannot remove more than available stock (${availableStock})`);
        return false;
      }
    }
    
    return true;
  };

  // Filter inventory based on active filter
  const getFilteredInventory = () => {
    let filtered = inventory.filter((item) => {
      const productName = item.productName || item.product?.name || '';
      const sku = item.product?.sku || '';
      return (
        productName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        sku.toLowerCase().includes(debouncedSearch.toLowerCase())
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

  // Scanner Functions
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
    if (!selectedItem) {
      Alert.alert("Error", "Please select a product");
      return;
    }

    // Use input validation
    if (!validateStockInput(qty, transactionType, selectedItem)) {
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

  // ==================== COMPONENT RENDERERS ====================

  // Time Filter Component
  const TimeFilterSelector = () => (
    <View className="px-4 py-2 bg-white border-b border-gray-200">
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        className="pr-4"
      >
        {TIME_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            className={`px-4 py-2 rounded-full mr-2 ${
              timeFilter === filter.key ? 'bg-blue-500' : 'bg-gray-100'
            }`}
            onPress={() => handleTimeFilterChange(filter.key)}
          >
            <Text className={`text-xs font-semibold ${
              timeFilter === filter.key ? 'text-white' : 'text-gray-500'
            }`}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Interactive Summary Grid Component
  const InteractiveSummaryGrid = () => (
    <View className="flex-row flex-wrap p-4 gap-3 bg-white">
      {/* Total Sales Card - Click to show top selling products */}
      <TouchableOpacity 
        className={`w-[47%] bg-white p-4 rounded-xl items-center border ${
          activeFilter === FILTER_TYPES.TOP_SELLING ? 'border-2 shadow-lg' : 'border-gray-200 shadow'
        }`}
        style={{ borderLeftWidth: 4, borderLeftColor: '#4CAF50' }}
        onPress={() => handleFilterChange(
          activeFilter === FILTER_TYPES.TOP_SELLING ? FILTER_TYPES.ALL : FILTER_TYPES.TOP_SELLING
        )}
      >
        <View className="w-10 h-10 rounded-full bg-green-500 justify-center items-center mb-2">
          <Ionicons name="trending-up" size={20} color="#FFF" />
        </View>
        <Text className="text-lg font-bold text-gray-800 mb-1">₹{(summary.totalSales || 0).toLocaleString()}</Text>
        <Text className="text-xs text-gray-500 font-medium">Total Sales</Text>
        <Text className="text-xs text-green-500 mt-1 font-medium">
          {TIME_FILTERS.find(f => f.key === timeFilter)?.label || 'All Time'}
        </Text>
        {activeFilter === FILTER_TYPES.TOP_SELLING && (
          <View className="absolute top-2 right-2">
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
          </View>
        )}
      </TouchableOpacity>

      {/* Low Stock Card - Click to show low stock products */}
      <TouchableOpacity 
        className={`w-[47%] bg-white p-4 rounded-xl items-center border ${
          activeFilter === FILTER_TYPES.LOW_STOCK ? 'border-2 shadow-lg' : 'border-gray-200 shadow'
        }`}
        style={{ borderLeftWidth: 4, borderLeftColor: '#FF9800' }}
        onPress={() => handleFilterChange(
          activeFilter === FILTER_TYPES.LOW_STOCK ? FILTER_TYPES.ALL : FILTER_TYPES.LOW_STOCK
        )}
      >
        <View className="w-10 h-10 rounded-full bg-orange-500 justify-center items-center mb-2">
          <Ionicons name="warning" size={20} color="#FFF" />
        </View>
        <Text className="text-lg font-bold text-gray-800 mb-1">{summary.lowStockCount || 0}</Text>
        <Text className="text-xs text-gray-500 font-medium">Low Stock</Text>
        <Text className="text-xs text-orange-500 mt-1 font-medium">
          {summary.outOfStockCount || 0} out of stock
        </Text>
        {activeFilter === FILTER_TYPES.LOW_STOCK && (
          <View className="absolute top-2 right-2">
            <Ionicons name="checkmark-circle" size={16} color="#FF9800" />
          </View>
        )}
      </TouchableOpacity>

      {/* Inventory Value Card - Click to show high stock products */}
      <TouchableOpacity 
        className={`w-[47%] bg-white p-4 rounded-xl items-center border ${
          activeFilter === FILTER_TYPES.HIGH_STOCK ? 'border-2 shadow-lg' : 'border-gray-200 shadow'
        }`}
        style={{ borderLeftWidth: 4, borderLeftColor: Colors.light.accent }}
        onPress={() => handleFilterChange(
          activeFilter === FILTER_TYPES.HIGH_STOCK ? FILTER_TYPES.ALL : FILTER_TYPES.HIGH_STOCK
        )}
      >
        <View className="w-10 h-10 rounded-full bg-blue-500 justify-center items-center mb-2">
          <Ionicons name="business" size={20} color="#FFF" />
        </View>
        <Text className="text-lg font-bold text-gray-800 mb-1">₹{(summary.totalInventoryValue || 0).toLocaleString()}</Text>
        <Text className="text-xs text-gray-500 font-medium">Stock Value</Text>
        <Text className="text-xs text-blue-500 mt-1 font-medium">
          {summary.totalProducts || 0} products
        </Text>
        {activeFilter === FILTER_TYPES.HIGH_STOCK && (
          <View className="absolute top-2 right-2">
            <Ionicons name="checkmark-circle" size={16} color={Colors.light.accent} />
          </View>
        )}
      </TouchableOpacity>

      {/* Items Sold Card */}
      <View className="w-[47%] bg-white p-4 rounded-xl items-center border border-gray-200 shadow" style={{ borderLeftWidth: 4, borderLeftColor: '#2196F3' }}>
        <View className="w-10 h-10 rounded-full bg-blue-400 justify-center items-center mb-2">
          <Ionicons name="cube" size={20} color="#FFF" />
        </View>
        <Text className="text-lg font-bold text-gray-800 mb-1">{(summary.totalItemsSold || 0).toLocaleString()}</Text>
        <Text className="text-xs text-gray-500 font-medium">Items Sold</Text>
        <Text className="text-xs text-blue-400 mt-1 font-medium">
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
      <View className="flex-row items-center justify-center bg-blue-500 mx-4 mb-3 py-2 px-4 rounded-full">
        <Text className="text-white text-sm font-semibold mr-2">{getFilterText()}</Text>
        <TouchableOpacity 
          className="w-6 h-6 rounded-full bg-white/30 justify-center items-center"
          onPress={() => handleFilterChange(FILTER_TYPES.ALL)}
        >
          <Ionicons name="close" size={16} color="#FFF" />
        </TouchableOpacity>
      </View>
    );
  };

  // Scanner Modal
  const renderScannerModal = () => (
    <Modal
      visible={isScannerOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={closeScanner}
    >
      <View className="flex-1 bg-black">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-16 pb-5 bg-black/90">
          <TouchableOpacity
            className="p-2 w-10"
            onPress={closeScanner}
          >
            <Ionicons name="chevron-down" size={28} color="#FFF" />
          </TouchableOpacity>
          
          <View className="flex-row items-center bg-white/10 rounded-2xl px-4 py-2">
            <View className="items-center px-3">
              <Text className="text-base font-bold text-white mb-1">{inventory.length}</Text>
              <Text className="text-xs text-gray-300 font-medium">Products</Text>
            </View>
          </View>
          
          <TouchableOpacity
            className={`p-2 w-10 items-center ${torchOn ? 'bg-white/10 rounded-full' : ''}`}
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
        <View className="flex-1">
          {hasPermission === null ? (
            <View className="flex-1 justify-center items-center bg-black">
              <ActivityIndicator size="large" color="#FFF" />
              <Text className="text-white text-lg mt-4">Checking camera access</Text>
            </View>
          ) : hasPermission === false ? (
            <View className="flex-1 justify-center items-center bg-black">
              <Ionicons name="camera-off" size={64} color="#FFF" />
              <Text className="text-white text-lg mt-4">Camera access required</Text>
              <TouchableOpacity
                className="bg-blue-500 px-6 py-3 rounded-xl mt-6"
                onPress={requestCameraPermission}
              >
                <Text className="text-white font-semibold">Allow Camera Access</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="flex-1 relative">
              <CameraView
                ref={cameraRef}
                className="flex-1"
                onBarcodeScanned={isScanningLocked ? undefined : handleBarcodeScanned}
                flash={torchOn ? "torch" : "off"}
                facing="back"
              />
              
              {/* Scan Overlay with Visual Feedback */}
              <View className="absolute inset-0 z-10">
                <View className="flex-[2] bg-black/70" />
                <View className="h-50 justify-center items-center bg-transparent">
                  
                  {/* Animated Scan Frame with Color Feedback */}
                  <Animated.View className={`w-62 h-38 border-2 rounded-xl relative overflow-hidden ${
                    scanFeedback === "success" ? 'border-green-500 bg-green-500/10' :
                    scanFeedback === "error" ? 'border-red-500 bg-red-500/10' :
                    scanFeedback === "scanning" ? 'border-blue-500 bg-blue-500/10' :
                    'border-white'
                  }`}
                  style={{
                    transform: [{
                      scale: scanIndicatorAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.05]
                      })
                    }]
                  }}>
                    {/* Animated Success Overlay */}
                    <Animated.View className="absolute inset-0 bg-green-500/20 justify-center items-center"
                      style={{
                        opacity: scanSuccessAnim,
                        transform: [{
                          scale: scanSuccessAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1.2]
                          })
                        }]
                      }}
                    >
                      <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
                    </Animated.View>

                    {/* Animated Error Overlay */}
                    <Animated.View className="absolute inset-0 bg-red-500/20 justify-center items-center"
                      style={{
                        opacity: scanErrorAnim,
                        transform: [{
                          scale: scanErrorAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1.2]
                          })
                        }]
                      }}
                    >
                      <Ionicons name="close-circle" size={80} color="#F44336" />
                    </Animated.View>

                    {/* Scan Frame Corners */}
                    <View className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-white rounded-tl-lg" />
                    <View className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-white rounded-tr-lg" />
                    <View className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-white rounded-bl-lg" />
                    <View className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-white rounded-br-lg" />
                  </Animated.View>

                  {/* Scan Status Text */}
                  <View className="items-center mt-5">
                    <Animated.Text className={`text-sm text-white font-medium text-center ${
                      scanFeedback === "success" ? 'text-green-500' :
                      scanFeedback === "error" ? 'text-red-500' : ''
                    }`}
                      style={{
                        opacity: scanIndicatorAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [1, 0.7]
                        })
                      }}
                    >
                      {scanFeedback === "scanning" ? "Searching product..." :
                       scanFeedback === "success" ? "Product found! Opening stock..." :
                       scanFeedback === "error" ? "Product not found" :
                       "Scan product barcode"}
                    </Animated.Text>
                    
                    {scanFeedback === "error" && (
                      <Animated.Text className="text-xs text-red-500 text-center mt-1"
                        style={{ opacity: scanErrorAnim }}
                      >
                        Try scanning a different barcode
                      </Animated.Text>
                    )}
                  </View>

                </View>
                <View className="flex-[2] bg-black/70" />
              </View>
            </View>
          )}
        </View>

        {/* Footer */}
        <View className="bg-black/90 px-5 py-5 items-center">
          <Text className="text-sm text-gray-300 text-center">
            {scanFeedback === "success" ? "Opening stock management with per-piece pricing..." :
             scanFeedback === "error" ? "Product not found in catalog" :
             "Point camera at product barcode to manage stock"}
          </Text>
          <Text className="text-xs text-gray-500 text-center mt-1">
            Catalog API: {scanFeedback === "scanning" ? "Searching..." : "Ready"}
          </Text>
        </View>
      </View>
    </Modal>
  );

  // Add Product Modal
  const renderAddProductModal = () => (
    <Modal
      visible={addProductModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setAddProductModal(false)}
    >
      <View className="bg-white rounded-t-3xl max-h-[90%]">
        <View className="flex-row justify-between items-center p-5 border-b border-gray-200">
          <Text className="text-xl font-bold text-gray-800">Add Product to Inventory</Text>
          <TouchableOpacity onPress={() => setAddProductModal(false)}>
            <Ionicons name="close" size={24} color={Colors.light.text} />
          </TouchableOpacity>
        </View>

        <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
          {/* Product Search */}
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-800 mb-2">Search Products</Text>
            <View className="flex-row items-center bg-white rounded-full border border-gray-300 px-4 h-12 gap-3">
              <Ionicons name="search" size={20} color={Colors.light.accent} />
              <TextInput
                className="flex-1 text-base text-gray-800"
                placeholder="Search products by name or SKU..."
                placeholderTextColor="#BDBDBD"
                value={productSearch}
                onChangeText={(text) => {
                  setProductSearch(text);
                  searchProducts(text);
                }}
              />
            </View>
            
            {searchingProducts && (
              <ActivityIndicator size="small" color={Colors.light.accent} className="mt-2" />
            )}
          </View>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <View className="mb-4">
              <Text className="text-base font-semibold text-gray-800 mb-2">Search Results</Text>
              {searchResults.map((product) => (
                <TouchableOpacity
                  key={product._id}
                  className={`flex-row items-center p-3 bg-gray-50 rounded-lg mb-2 border ${
                    selectedProduct?._id === product._id ? 'bg-blue-50 border-blue-500' : 'border-gray-200'
                  }`}
                  onPress={() => setSelectedProduct(product)}
                >
                  <Image
                    source={{ uri: product.image || "https://via.placeholder.com/60x60?text=No+Img" }}
                    className="w-15 h-15 rounded-lg mr-3"
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-800 mb-1">{product.name}</Text>
                    <Text className="text-xs text-gray-500 mb-1">SKU: {product.sku}</Text>
                    <Text className="text-xs text-blue-500 font-medium">Default Price: ₹{product.price}</Text>
                  </View>
                  {selectedProduct?._id === product._id && (
                    <Ionicons name="checkmark-circle" size={24} color={Colors.light.accent} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedProduct && (
            <>
              {/* Product Details */}
              <View className="mb-5">
                <Text className="text-lg font-bold text-gray-800 mb-3">Selected Product</Text>
                <View className="flex-row items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <Image
                    source={{ uri: selectedProduct.image || "https://via.placeholder.com/80x80?text=No+Img" }}
                    className="w-20 h-20 rounded-lg mr-4"
                  />
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-gray-800 mb-1">{selectedProduct.name}</Text>
                    <Text className="text-sm text-gray-500 mb-1">SKU: {selectedProduct.sku}</Text>
                    <Text className="text-xs text-gray-500">
                      Category: {selectedProduct.category?.name || 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Inventory Settings */}
              <View className="mb-4">
                <Text className="text-lg font-bold text-gray-800 mb-3">Inventory Settings</Text>
                
                <View className="flex-row gap-3 mb-4">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-800 mb-2">Initial Stock *</Text>
                    <TextInput
                      className="border border-gray-300 rounded-lg p-3 text-base text-gray-800 bg-white"
                      keyboardType="numeric"
                      placeholder="0"
                      value={initialStock}
                      onChangeText={setInitialStock}
                    />
                  </View>
                  
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-800 mb-2">Selling Price (₹) *</Text>
                    <TextInput
                      className="border border-gray-300 rounded-lg p-3 text-base text-gray-800 bg-white"
                      keyboardType="numeric"
                      placeholder="Enter selling price"
                      value={sellingPrice}
                      onChangeText={setSellingPrice}
                    />
                  </View>
                </View>

                <View className="flex-row gap-3 mb-4">
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-800 mb-2">Cost Price (₹)</Text>
                    <TextInput
                      className="border border-gray-300 rounded-lg p-3 text-base text-gray-800 bg-white"
                      keyboardType="numeric"
                      placeholder="Optional"
                      value={costPrice}
                      onChangeText={setCostPrice}
                    />
                  </View>
                  
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-gray-800 mb-2">Min Stock Level</Text>
                    <TextInput
                      className="border border-gray-300 rounded-lg p-3 text-base text-gray-800 bg-white"
                      keyboardType="numeric"
                      placeholder="10"
                      value={minStockLevel}
                      onChangeText={setMinStockLevel}
                    />
                  </View>
                </View>

                <View className="mb-4">
                  <Text className="text-sm font-semibold text-gray-800 mb-2">Max Stock Level</Text>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-3 text-base text-gray-800 bg-white"
                    keyboardType="numeric"
                    placeholder="100"
                    value={maxStockLevel}
                    onChangeText={setMaxStockLevel}
                  />
                </View>
              </View>
            </>
          )}
        </ScrollView>

        <View className="flex-row p-5 border-t border-gray-200 gap-3">
          <TouchableOpacity 
            className="flex-1 bg-gray-100 py-3.5 rounded-lg items-center"
            onPress={() => setAddProductModal(false)}
          >
            <Text className="text-base font-semibold text-gray-800">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className={`flex-1 py-3.5 rounded-lg items-center ${
              (!selectedProduct || !sellingPrice || addingProduct) ? 'bg-blue-300' : 'bg-blue-500'
            }`}
            onPress={handleAddProductToInventory}
            disabled={!selectedProduct || !sellingPrice || addingProduct}
          >
            <Text className="text-base font-semibold text-white">
              {addingProduct ? 'Adding...' : 'Add to Inventory'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // Product Detail Modal
  const renderDetailModal = () => {
    if (!selectedItem) return null;

    const availableStock = getAvailableStock(selectedItem);
    const productName = getProductName(selectedItem);
    const productImage = getProductImage(selectedItem);
    const stockStatus = getStockStatus(availableStock, selectedItem.minStockLevel || 0);
    const itemSalesValue = getItemSalesValue(selectedItem);
    const itemInventoryValue = getItemInventoryValue(selectedItem);
    const defaultPrice = getDefaultPrice(selectedItem);
    const sellingPrice = selectedItem.sellingPrice || 0;
    const hasQPricing = hasQuantityPricing(selectedItem);
    const isOverridden = isPriceOverridden(selectedItem);

    return (
      <Modal
        visible={detailModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailModal(false)}
      >
        <View className="bg-white rounded-t-3xl max-h-[95%]">
          <View className="flex-row justify-between items-center p-5 border-b border-gray-200">
            <Text className="text-xl font-bold text-gray-800">Product Details</Text>
            <TouchableOpacity onPress={() => setDetailModal(false)}>
              <Ionicons name="close" size={24} color={Colors.light.text} />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
            {/* Product Header */}
            <View className="flex-row items-center mb-6 pb-4 border-b border-gray-200">
              <Image
                source={{ uri: productImage }}
                className="w-20 h-20 rounded-xl mr-4"
                defaultSource={{ uri: "https://via.placeholder.com/80x80?text=No+Img" }}
              />
              <View className="flex-1">
                <Text className="text-lg font-bold text-gray-800 mb-1">{productName}</Text>
                <Text className="text-sm text-gray-500 mb-2">
                  SKU: {selectedItem.product?.sku || 'N/A'}
                </Text>
                <View className="flex-row items-center">
                  <MaterialIcons 
                    name={stockStatus.icon} 
                    size={16} 
                    color={stockStatus.color} 
                  />
                  <Text className="text-sm font-semibold ml-1.5" style={{ color: stockStatus.color }}>
                    {stockStatus.text}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3 mb-6">
              <TouchableOpacity 
                className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-green-500 gap-2"
                onPress={() => {
                  setDetailModal(false);
                  setTimeout(() => {
                    setTransactionType("STOCK_IN");
                    setReason("PURCHASE");
                    setQty("");
                    setStockModal(true);
                  }, 300);
                }}
              >
                <Ionicons name="arrow-down" size={20} color="#FFF" />
                <Text className="text-white font-semibold text-sm">Stock In</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-red-500 gap-2"
                onPress={() => {
                  setDetailModal(false);
                  setTimeout(() => {
                    setTransactionType("STOCK_OUT");
                    setReason("SALE");
                    setQty("");
                    setStockModal(true);
                  }, 300);
                }}
              >
                <Ionicons name="arrow-up" size={20} color="#FFF" />
                <Text className="text-white font-semibold text-sm">Stock Out</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                className="flex-1 flex-row items-center justify-center py-3 rounded-lg bg-orange-500 gap-2"
                onPress={() => {
                  setDetailModal(false);
                  setTimeout(() => handleDeleteItem(selectedItem), 300);
                }}
              >
                <Ionicons name="trash-outline" size={20} color="#FFF" />
                <Text className="text-white font-semibold text-sm">Delete</Text>
              </TouchableOpacity>
            </View>

            {/* Stock Information */}
            <View className="mb-6">
              <Text className="text-lg font-bold text-gray-800 mb-4">Stock Information</Text>
              <View className="flex-row flex-wrap gap-3">
                <View className="w-[48%] bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <Text className="text-sm text-gray-500 font-medium mb-2">Available Stock</Text>
                  <Text className="text-lg font-bold text-gray-800">{availableStock}</Text>
                </View>
                <View className="w-[48%] bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <Text className="text-sm text-gray-500 font-medium mb-2">Reserved</Text>
                  <Text className="text-lg font-bold text-gray-800">{selectedItem.committedStock || 0}</Text>
                </View>
                <View className="w-[48%] bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <Text className="text-sm text-gray-500 font-medium mb-2">Total Sold</Text>
                  <Text className="text-lg font-bold text-gray-800">{selectedItem.totalSold || 0}</Text>
                </View>
                <View className="w-[48%] bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <Text className="text-sm text-gray-500 font-medium mb-2">Min Stock Level</Text>
                  <Text className="text-lg font-bold text-gray-800">{selectedItem.minStockLevel || 0}</Text>
                </View>
              </View>
            </View>

            {/* Pricing Information */}
            <View className="mb-6">
              <Text className="text-lg font-bold text-gray-800 mb-4">Pricing</Text>
              <View className="flex-row flex-wrap gap-3">
                <View className="w-[48%] bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <Text className="text-sm text-gray-500 font-medium mb-2">Selling Price</Text>
                  <Text className="text-lg font-bold text-gray-800">₹{sellingPrice}</Text>
                  {isOverridden && (
                    <Text className="text-xs text-green-500 italic mt-1">(Custom Price)</Text>
                  )}
                </View>
                
                {/* Show quantity pricing status */}
                <View className="w-[48%] bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <Text className="text-sm text-gray-500 font-medium mb-2">Pricing Type</Text>
                  <Text className="text-lg font-bold text-gray-800">
                    {hasQPricing ? 'Quantity-Based' : 'Standard'}
                  </Text>
                  {hasQPricing && (
                    <Text className="text-xs text-green-500 italic mt-1">(Per-Piece Discount)</Text>
                  )}
                </View>
                
                <View className="w-[48%] bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <Text className="text-sm text-gray-500 font-medium mb-2">Cost Price</Text>
                  <Text className="text-lg font-bold text-gray-800">₹{selectedItem.costPrice || 'N/A'}</Text>
                </View>
                <View className="w-[48%] bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <Text className="text-sm text-gray-500 font-medium mb-2">Stock Value</Text>
                  <Text className="text-lg font-bold text-gray-800">₹{itemInventoryValue.toLocaleString()}</Text>
                </View>
              </View>
            </View>

            {/* Sales Information */}
            <View className="mb-6">
              <Text className="text-lg font-bold text-gray-800 mb-4">Sales Performance</Text>
              <View className="flex-row flex-wrap gap-3">
                <View className="w-[48%] bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <Text className="text-sm text-gray-500 font-medium mb-2">Total Sales Value</Text>
                  <Text className="text-lg font-bold text-gray-800">₹{itemSalesValue.toLocaleString()}</Text>
                </View>
                <View className="w-[48%] bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <Text className="text-sm text-gray-500 font-medium mb-2">Items Sold</Text>
                  <Text className="text-lg font-bold text-gray-800">{selectedItem.totalSold || 0}</Text>
                </View>
              </View>
            </View>

            {/* Enhanced Quantity Pricing Section with Clear Per-Piece Examples */}
            {hasQPricing && (
              <View className="mb-6">
                <Text className="text-lg font-bold text-gray-800 mb-4">Quantity Pricing (Per-Piece Discount)</Text>
                <View className="gap-2 mb-4">
                  {selectedItem.pricingSlabs
                    ?.filter(slab => slab.isActive)
                    .sort((a, b) => a.minQuantity - b.minQuantity)
                    .map((slab, index) => {
                      // Calculate per-piece discounted price
                      const basePrice = selectedItem.sellingPrice || 0;
                      let discountedPricePerPiece = basePrice;
                      
                      if (slab.discountType === 'FLAT') {
                        discountedPricePerPiece = Math.max(0, basePrice - slab.discountValue);
                      } else if (slab.discountType === 'PERCENTAGE') {
                        const discountAmount = (basePrice * slab.discountValue) / 100;
                        discountedPricePerPiece = Math.max(0, basePrice - discountAmount);
                      }
                      
                      return (
                        <View key={index} className="flex-row justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <View className="flex-1">
                            <Text className="text-sm font-semibold text-gray-800">
                              {slab.minQuantity}+ units
                            </Text>
                            <Text className="text-xs text-gray-500 mt-0.5">
                              {slab.discountType === 'FLAT' 
                                ? `₹${slab.discountValue} off per piece` 
                                : `${slab.discountValue}% off per piece`
                              }
                            </Text>
                          </View>
                          <View className="items-end">
                            <Text className="text-base font-bold text-green-700">₹{discountedPricePerPiece.toFixed(0)}</Text>
                            <Text className="text-xs text-gray-500 mt-0.5 text-center">per piece</Text>
                          </View>
                        </View>
                      );
                    })}
                </View>
                
                {/* Enhanced Pricing Example */}
                <View className="bg-blue-50 p-4 rounded-xl mt-4 border-l-4 border-blue-500">
                  <Text className="text-base font-bold text-gray-800 mb-3">📊 Price Calculation Examples:</Text>
                  
                  {selectedItem.pricingSlabs
                    ?.filter(slab => slab.isActive)
                    .sort((a, b) => a.minQuantity - b.minQuantity)
                    .map((slab, index) => {
                      const basePrice = selectedItem.sellingPrice || 0;
                      const exampleQuantity = slab.minQuantity;
                      
                      // Calculate per-piece discounted price
                      let discountedPricePerPiece = basePrice;
                      if (slab.discountType === 'FLAT') {
                        discountedPricePerPiece = Math.max(0, basePrice - slab.discountValue);
                      } else if (slab.discountType === 'PERCENTAGE') {
                        const discountAmount = (basePrice * slab.discountValue) / 100;
                        discountedPricePerPiece = Math.max(0, basePrice - discountAmount);
                      }
                      
                      const regularTotal = basePrice * exampleQuantity;
                      const discountedTotal = discountedPricePerPiece * exampleQuantity;
                      const savings = regularTotal - discountedTotal;
                      
                      return (
                        <View key={index} className="mb-3 pb-3 border-b border-blue-100">
                          <Text className="text-sm font-semibold text-blue-600 mb-1.5">
                            For {exampleQuantity} units:
                          </Text>
                          <Text className="text-xs text-gray-600 mb-1 leading-4">
                            • Regular: ₹{basePrice} × {exampleQuantity} = ₹{regularTotal.toFixed(0)}
                          </Text>
                          <Text className="text-xs text-gray-600 mb-1 leading-4">
                            • Discounted: ₹{discountedPricePerPiece.toFixed(0)} per piece
                          </Text>
                          <Text className="text-xs text-gray-600 mb-1 leading-4">
                            • Final: ₹{discountedTotal.toFixed(0)} total
                          </Text>
                          <Text className="text-xs text-green-600 font-semibold leading-4">
                            • You save: ₹{savings.toFixed(0)} ({slab.discountType === 'PERCENTAGE' ? slab.discountValue + '%' : '₹' + slab.discountValue} off per piece)
                          </Text>
                        </View>
                      );
                    })}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  // Stock Management Modal
  const renderStockModal = () => {
    if (!selectedItem) return null;

    const availableStock = getAvailableStock(selectedItem);
    const productName = getProductName(selectedItem);
    const productImage = getProductImage(selectedItem);

    return (
      <Modal
        visible={stockModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setStockModal(false)}
      >
        <View className="bg-white rounded-t-3xl max-h-[90%]">
          <View className="flex-row justify-between items-center p-5 border-b border-gray-200">
            <Text className="text-xl font-bold text-gray-800">Manage Stock</Text>
            <TouchableOpacity onPress={() => setStockModal(false)}>
              <Ionicons name="close" size={24} color={Colors.light.text} />
            </TouchableOpacity>
          </View>

          <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
            {/* Product Header */}
            <View className="flex-row items-center bg-gray-50 p-4 rounded-xl mb-4 border border-gray-200">
              <Image
                source={{ uri: productImage }}
                className="w-15 h-15 rounded-lg mr-3"
                defaultSource={{ uri: "https://via.placeholder.com/80x80?text=No+Img" }}
              />
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-800 mb-1">{productName}</Text>
                <Text className="text-sm text-gray-500">
                  SKU: {selectedItem.product?.sku || 'N/A'}
                </Text>
              </View>
            </View>

            {/* Current Stock Info */}
            <View className="bg-gray-50 p-4 rounded-lg mb-4 items-center">
              <Text className="text-sm text-gray-500 mb-1">Current Available Stock</Text>
              <Text className="text-2xl font-bold text-blue-500">{availableStock}</Text>
            </View>

            {/* Transaction Type */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-800 mb-2">Transaction Type</Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  className={`flex-1 flex-row items-center justify-center py-3 rounded-lg border-2 gap-2 ${
                    transactionType === "STOCK_IN" ? 'bg-green-500 border-green-500' : 'border-green-500'
                  }`}
                  onPress={() => setTransactionType("STOCK_IN")}
                >
                  <Ionicons 
                    name="arrow-down" 
                    size={20} 
                    color={transactionType === "STOCK_IN" ? "#FFF" : "#4CAF50"} 
                  />
                  <Text className={`text-sm font-semibold ${
                    transactionType === "STOCK_IN" ? 'text-white' : 'text-green-500'
                  }`}>
                    Stock In
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  className={`flex-1 flex-row items-center justify-center py-3 rounded-lg border-2 gap-2 ${
                    transactionType === "STOCK_OUT" ? 'bg-red-500 border-red-500' : 'border-red-500'
                  }`}
                  onPress={() => setTransactionType("STOCK_OUT")}
                >
                  <Ionicons 
                    name="arrow-up" 
                    size={20} 
                    color={transactionType === "STOCK_OUT" ? "#FFF" : "#F44336"} 
                  />
                  <Text className={`text-sm font-semibold ${
                    transactionType === "STOCK_OUT" ? 'text-white' : 'text-red-500'
                  }`}>
                    Stock Out
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quantity Input */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-800 mb-2">Quantity</Text>
              <TextInput
                className="border border-gray-300 rounded-lg p-3 text-base text-gray-800 bg-white"
                placeholder="Enter quantity"
                keyboardType="numeric"
                value={qty}
                onChangeText={setQty}
              />
              {transactionType === "STOCK_OUT" && (
                <Text className="text-xs text-gray-500 mt-1">
                  Available: {availableStock} units
                </Text>
              )}
            </View>

            {/* Reason Selection */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-800 mb-2">Reason</Text>
              <ScrollView 
                className="max-h-38"
                showsVerticalScrollIndicator={false}
              >
                <View className="flex-row flex-wrap gap-2">
                  {REASONS.map((reasonItem) => (
                    <TouchableOpacity
                      key={reasonItem}
                      className={`px-4 py-3 rounded-xl border min-w-[48%] ${
                        reason === reasonItem ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-300'
                      }`}
                      onPress={() => setReason(reasonItem)}
                    >
                      <Text className={`text-xs text-center ${
                        reason === reasonItem ? 'text-white font-semibold' : 'text-gray-800'
                      }`}>
                        {reasonItem.replace(/_/g, ' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </ScrollView>

          <View className="flex-row p-5 border-t border-gray-200 gap-3">
            <TouchableOpacity 
              className="flex-1 bg-gray-100 py-3.5 rounded-lg items-center"
              onPress={() => setStockModal(false)}
            >
              <Text className="text-base font-semibold text-gray-800">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className={`flex-1 py-3.5 rounded-lg items-center ${
                !qty ? 'bg-gray-300' : transactionType === "STOCK_IN" ? 'bg-green-500' : 'bg-red-500'
              }`}
              onPress={handleStockUpdate}
              disabled={!qty}
            >
              <View className="flex-row items-center justify-center gap-2">
                <Ionicons 
                  name={transactionType === "STOCK_IN" ? "arrow-down" : "arrow-up"} 
                  size={20} 
                  color="#FFF" 
                />
                <Text className="text-base font-semibold text-white">
                  {transactionType === "STOCK_IN" ? "Add Stock" : "Remove Stock"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ==================== MAIN RENDER ====================

  // Display errors
  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-white" style={{ paddingTop: insets.top }}>
        <MaterialIcons name="error-outline" size={64} color="#F44336" />
        <Text className="text-xl font-bold text-gray-800 mt-4 mb-2 text-center">Unable to Load Inventory</Text>
        <Text className="text-base text-gray-500 text-center mb-6 leading-5">{error}</Text>
        <View className="flex-row gap-3">
          <TouchableOpacity 
            className="bg-blue-500 px-6 py-3 rounded-lg"
            onPress={() => {
              setError(null);
              fetchData();
            }}
          >
            <Text className="text-white font-semibold text-base">Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            className="bg-gray-100 px-6 py-3 rounded-lg"
            onPress={() => router.back()}
          >
            <Text className="text-gray-800 font-semibold text-base">Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (authLoading || loading) {
    return (
      <View className="flex-1 justify-center items-center bg-white" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text className="text-base text-gray-500 mt-4">Loading inventory...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Professional Header with Scanner */}
      <View className="px-4 pt-4 pb-4 bg-white border-b border-gray-200">
        <View className="flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-gray-800">Inventory</Text>
          <TouchableOpacity 
            className="p-2 bg-blue-50 rounded-xl"
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
              <View className="mb-2 bg-white py-3">
                <View className="flex-row justify-between items-center px-4 mb-3">
                  <Text className="text-xl font-bold text-gray-800">Recent Activity</Text>
                  <TouchableOpacity>
                    <Text className="text-blue-500 text-sm font-semibold">See All</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  className="px-4"
                >
                  {recentActivity.map((log, index) => (
                    <View key={log._id || index} className="bg-white p-4 rounded-xl mr-3 min-w-30 border border-gray-200 shadow-sm">
                      <View className={`w-8 h-8 rounded-full items-center justify-center mb-2 ${
                        log.transactionType?.includes('IN') ? 'bg-green-100' : 'bg-red-100'
                      }`}>
                        <MaterialIcons
                          name={log.transactionType?.includes('IN') ? 'arrow-downward' : 'arrow-upward'}
                          size={16}
                          color={log.transactionType?.includes('IN') ? '#4CAF50' : '#F44336'}
                        />
                      </View>
                      <Text className="text-base font-bold text-gray-800 mb-1">
                        {log.quantity}
                      </Text>
                      <Text className="text-sm text-gray-800 font-medium mb-1" numberOfLines={1}>
                        {log.product?.name || 'Product'}
                      </Text>
                      <Text className="text-xs text-gray-500">
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Search Bar */}
            <View className="flex-row px-4 pt-4 pb-4 gap-2 items-center bg-white">
              <View className="flex-1 flex-row items-center bg-white rounded-full border-1.5 border-gray-200 px-4 h-13 gap-2.5">
                <Ionicons name="search" size={20} color={Colors.light.accent} />
                <TextInput
                  className="flex-1 text-base text-gray-800"
                  placeholder="Search inventory..."
                  placeholderTextColor="#BDBDBD"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>
            </View>

            <Text className="text-xl font-bold text-gray-800 mx-4 mb-3 mt-2">
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
              className="bg-white rounded-xl p-4 mx-4 mb-3 border border-gray-200 shadow-sm flex-row items-center relative"
              onPress={() => openDetailModal(item)}
              activeOpacity={0.7}
            >
              {/* Ranking indicator for top selling */}
              {activeFilter === FILTER_TYPES.TOP_SELLING && (
                <View className="absolute top-2 left-2 bg-green-500 w-6 h-6 rounded-full justify-center items-center z-10">
                  <Text className="text-white text-xs font-bold">#{index + 1}</Text>
                </View>
              )}

              <Image
                source={{ uri: productImage }}
                className="w-20 h-20 rounded-xl mr-4"
                defaultSource={{ uri: "https://via.placeholder.com/80x80?text=No+Img" }}
              />
              
              <View className="flex-1">
                <View className="flex-row justify-between items-start mb-2">
                  <Text className="text-base font-semibold text-gray-800 flex-1 mr-2" numberOfLines={1}>
                    {productName}
                  </Text>
                  <Text className="text-sm font-bold text-green-500">
                    ₹{itemSalesValue.toLocaleString()}
                  </Text>
                </View>
                
                {/* Updated Price Display with Per-Piece Pricing */}
                <View className="mb-2">
                  <View className="bg-blue-50 px-3 py-1.5 rounded-lg flex-row items-center self-start">
                    <Text className="text-lg font-bold text-blue-500">₹{sellingPrice.toFixed(0) || '0'}</Text>
                    
                    {/* Show per-piece discount badge */}
                    {hasQPricing && (
                      <View className="flex-row items-center bg-orange-500 px-1.5 py-0.5 rounded ml-2 gap-0.5">
                        <Ionicons name="pricetag" size={10} color="#FFF" />
                        <Text className="text-white text-2.25 font-semibold">Per-Piece Discount</Text>
                      </View>
                    )}
                    
                    {/* Show if price is overridden */}
                    {isOverridden && !hasQPricing && (
                      <View className="bg-green-500 px-1.5 py-0.5 rounded ml-2">
                        <Text className="text-white text-2.5 font-semibold">Custom</Text>
                      </View>
                    )}
                  </View>
                  
                  {/* Show discount range if quantity pricing is enabled */}
                  {hasQPricing && item.pricingSlabs && (
                    <View className="mt-1">
                      <Text className="text-xs text-orange-500 font-semibold">
                        Discount from {Math.min(...item.pricingSlabs.map(s => s.minQuantity))}+ units
                      </Text>
                    </View>
                  )}
                </View>

                <View className="flex-row items-center mb-3">
                  <MaterialIcons 
                    name={stockStatus.icon} 
                    size={16} 
                    color={stockStatus.color} 
                  />
                  <Text className="text-sm font-semibold ml-1.5" style={{ color: stockStatus.color }}>
                    {stockStatus.text}
                  </Text>
                </View>

                <View className="bg-gray-50 p-3 rounded-lg mb-2 flex-row justify-between">
                  <View className="items-center flex-1">
                    <Text className="text-2.75 text-gray-500 mb-1 font-medium">Available</Text>
                    <Text className="text-sm font-bold text-gray-800">{availableStock}</Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-2.75 text-gray-500 mb-1 font-medium">Reserved</Text>
                    <Text className="text-sm font-bold text-gray-800">{item.committedStock || 0}</Text>
                  </View>
                  <View className="items-center flex-1">
                    <Text className="text-2.75 text-gray-500 mb-1 font-medium">Sold</Text>
                    <Text className="text-sm font-bold text-gray-800">{item.totalSold || 0}</Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View className="flex-col gap-2 ml-3">
                <TouchableOpacity
                  className="p-2.5 rounded-xl bg-blue-50 items-center justify-center"
                  onPress={(e) => {
                    e.stopPropagation();
                    openStockModal(item);
                  }}
                >
                  <Ionicons name="add" size={18} color={Colors.light.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  className="p-2.5 rounded-xl bg-orange-50 items-center justify-center"
                  onPress={(e) => {
                    e.stopPropagation();
                    openPricingModal(item);
                  }}
                >
                  <Ionicons name="pricetag" size={18} color={Colors.light.accent} />
                </TouchableOpacity>
                <TouchableOpacity
                  className="p-2.5 rounded-xl bg-red-50 items-center justify-center"
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
          <View className="items-center justify-center py-15">
            <MaterialIcons name="inventory-2" size={56} color={Colors.light.textSecondary} />
            <Text className="text-lg font-semibold text-gray-800 mt-4">
              {debouncedSearch ? "No products found" : 
               activeFilter === FILTER_TYPES.LOW_STOCK ? "No low stock items" :
               activeFilter === FILTER_TYPES.TOP_SELLING ? "No sales data available" :
               activeFilter === FILTER_TYPES.HIGH_STOCK ? "No inventory items" :
               "No inventory items"}
            </Text>
            <Text className="text-sm text-gray-500 mt-2 text-center px-8">
              {debouncedSearch ? "Try a different search term" : 
               activeFilter === FILTER_TYPES.LOW_STOCK ? "All products are well stocked" :
               activeFilter === FILTER_TYPES.TOP_SELLING ? "Sales data will appear here" :
               "Add products and set per-piece pricing"}
            </Text>
            {!debouncedSearch && activeFilter === FILTER_TYPES.ALL && (
              <TouchableOpacity className="bg-blue-500 px-6 py-3 rounded-xl mt-4" onPress={openAddProductModal}>
                <Text className="text-white font-semibold">Add Product to Inventory</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />

      {/* All Modals */}
      {renderScannerModal()}
      {renderAddProductModal()}
      {renderDetailModal()}
      {renderStockModal()}

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
        className="absolute right-5 bottom-5 bg-blue-500 w-14 h-14 rounded-full justify-center items-center shadow-lg" 
        onPress={openAddProductModal}
      >
        <Ionicons name="add" size={24} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}