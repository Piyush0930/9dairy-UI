import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// Safe number utility functions
const safeNumber = (value, defaultValue = 0) => {
  if (value === null || value === undefined || isNaN(value)) return defaultValue;
  return parseFloat(value) || defaultValue;
};

const safeToFixed = (value, decimals = 2) => {
  return safeNumber(value).toFixed(decimals);
};

// Unified product identifier
const getProductIdentifier = (product) => {
  return product.barcodeId || product.scannedBarcodeId || product._id;
};

export default function OfflineOrder() {
  const insets = useSafeAreaInsets();
  const { authToken } = useAuth();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();

  const [scannedItems, setScannedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Retailer inventory state
  const [retailerInventory, setRetailerInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState(null);

  // Scanner states
  const [permission, requestPermission] = useCameraPermissions();
  const [hasPermission, setHasPermission] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null);
  const [isScanningLocked, setIsScanningLocked] = useState(false);

  // Order states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("paid");
  const [retailerProfile, setRetailerProfile] = useState(null);

  // Customer suggestions state
  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showPhoneSuggestions, setShowPhoneSuggestions] = useState(false);
  const [orderHistory, setOrderHistory] = useState([]);

  // Animation refs
  const flashAnim = useRef(new Animated.Value(0)).current;
  const recentlyScannedRef = useRef(new Set());
  const cameraRef = useRef(null);

  // Refs for suggestion handling
  const nameInputRef = useRef(null);
  const phoneInputRef = useRef(null);

  // ==================== INVENTORY FETCH LOGIC ====================
  
  const fetchRetailerInventory = async () => {
    if (!authToken) {
      console.log("No auth token available");
      setInventoryError("Authentication required");
      setInventoryLoading(false);
      return;
    }
    
    try {
      setInventoryLoading(true);
      setInventoryError(null);
      console.log("🔄 Fetching retailer inventory...");
      
      const headers = { 
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      };

      const invRes = await fetch(`${API_BASE_URL}/api/retailer/inventory`, { headers });
      console.log("📦 Inventory response status:", invRes.status);
      
      if (!invRes.ok) {
        const errorText = await invRes.text();
        throw new Error(`HTTP error! status: ${invRes.status}, message: ${errorText}`);
      }
      
      const invData = await invRes.json();
      console.log("📦 Inventory API Response:", invData);
      
      if (invData.success) {
        const inventoryItems = invData.data?.inventory || [];
        console.log('✅ Inventory items received:', inventoryItems.length);

        // Filter out null items and items with null product references
        const validInventoryItems = inventoryItems.filter(item => item != null && item.product != null);
        console.log('✅ Valid inventory items:', validInventoryItems.length);

        setRetailerInventory(validInventoryItems);
        
        console.log('🎯 Inventory loaded successfully');
      } else {
        throw new Error(invData.message || 'Failed to fetch inventory data');
      }

    } catch (e) {
      console.error("❌ Inventory Fetch Error:", e);
      setInventoryError(e.message);
    } finally {
      setInventoryLoading(false);
    }
  };

  const fetchRetailerProfile = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/retailer/profile`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setRetailerProfile(data.data || data.profile);
        console.log('🏪 Retailer profile loaded');
      }
    } catch (error) {
      console.log('Profile fetch failed:', error);
    }
  };

  // ==================== CUSTOMER SUGGESTIONS LOGIC ====================

  const fetchOrderHistory = async () => {
    if (!authToken) return;
    
    try {
      console.log('📋 Fetching order history for customer suggestions...');
      const response = await fetch(`${API_BASE_URL}/api/orders/retailer/order-history`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const orders = data.orders || data.data || [];
        
        // Filter offline orders and extract unique customers
        const offlineOrders = orders.filter(order => order.orderType === 'offline');
        setOrderHistory(offlineOrders);
        
        console.log('✅ Order history loaded:', offlineOrders.length, 'offline orders');
      }
    } catch (error) {
      console.error('❌ Error fetching order history:', error);
    }
  };

  const generateCustomerSuggestions = () => {
    if (!orderHistory.length) return [];

    const customerMap = new Map();

    orderHistory.forEach(order => {
      const name = order.customerName || order.customer?.personalInfo?.fullName || order.customer?.fullName;
      const phone = order.customerPhone || order.customer?.phone || order.customer?.personalInfo?.phone;
      
      if (name && name !== 'Walk-in Customer' && name !== 'Unknown Customer') {
        const key = `${name.toLowerCase()}-${phone || ''}`;
        if (!customerMap.has(key)) {
          customerMap.set(key, {
            name: name,
            phone: phone || '',
            orderCount: 0,
            lastOrderDate: order.createdAt
          });
        }
        
        const customer = customerMap.get(key);
        customer.orderCount++;
        
        // Update to most recent order date
        if (new Date(order.createdAt) > new Date(customer.lastOrderDate)) {
          customer.lastOrderDate = order.createdAt;
        }
      }
    });

    const suggestions = Array.from(customerMap.values())
      .sort((a, b) => new Date(b.lastOrderDate) - new Date(a.lastOrderDate))
      .slice(0, 10); // Limit to 10 most recent customers

    console.log('🎯 Generated customer suggestions:', suggestions.length);
    return suggestions;
  };

  const handleNameInputChange = (text) => {
    setCustomerName(text);
    
    if (text.length > 1) {
      const suggestions = generateCustomerSuggestions();
      const filtered = suggestions.filter(customer => 
        customer.name.toLowerCase().includes(text.toLowerCase())
      );
      setCustomerSuggestions(filtered);
      setShowNameSuggestions(true);
      setShowPhoneSuggestions(false);
    } else {
      setShowNameSuggestions(false);
      setCustomerSuggestions([]);
    }
  };

  const handlePhoneInputChange = (text) => {
    setCustomerPhone(text);
    
    if (text.length > 1) {
      const suggestions = generateCustomerSuggestions();
      const filtered = suggestions.filter(customer => 
        customer.phone && customer.phone.includes(text)
      );
      setCustomerSuggestions(filtered);
      setShowPhoneSuggestions(true);
      setShowNameSuggestions(false);
    } else {
      setShowPhoneSuggestions(false);
      setCustomerSuggestions([]);
    }
  };

  const selectCustomerSuggestion = (customer) => {
    setCustomerName(customer.name);
    if (customer.phone) {
      setCustomerPhone(customer.phone);
    }
    setShowNameSuggestions(false);
    setShowPhoneSuggestions(false);
    setCustomerSuggestions([]);
    
    console.log('✅ Selected customer:', customer.name, customer.phone);
  };

  // Close suggestions when tapping outside
  const closeAllSuggestions = () => {
    setShowNameSuggestions(false);
    setShowPhoneSuggestions(false);
  };

  // ==================== LIFECYCLE ====================

  useEffect(() => {
    if (params.scannedItems) {
      try {
        const items = JSON.parse(params.scannedItems);
        setScannedItems(items);
      } catch (e) {
        console.error("Failed to parse scannedItems:", e);
      }
    }

    if (params.autoOpenScanner === "true") {
      openScanner();
    }

    // Fetch retailer data and order history
    fetchRetailerInventory();
    fetchRetailerProfile();
    fetchOrderHistory();
  }, [authToken]);

  useEffect(() => {
    if (permission) {
      setHasPermission(permission.granted);
    }
  }, [permission]);

  // Auto-search when query changes
  useEffect(() => {
    if (searchQuery.trim()) {
      searchProducts(searchQuery);
    } else {
      setSearchResults([]);
      setSearchLoading(false);
    }
  }, [searchQuery]);

  // ==================== SCANNER FUNCTIONS ====================

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
  };

  const openScanner = () => {
    setIsScannerOpen(true);
    resetScannerState();
  };

  const closeScanner = () => {
    setIsScannerOpen(false);
    setTimeout(resetScannerState, 300);
  };

  // ==================== UNIFIED PRODUCT PROCESSING ====================

  /**
   * Find inventory item for a product (used by both scan and search)
   */
  const findInventoryItemForProduct = (product) => {
    if (!product) return null;
    
    // Try to find in retailer inventory using multiple identifiers
    const inventoryItem = retailerInventory.find(item => {
      const itemProduct = item.product || {};
      return (
        itemProduct._id === product._id ||
        itemProduct.barcodeId === product.barcodeId ||
        itemProduct.barcodeId === product.scannedBarcodeId ||
        itemProduct.scannedBarcodeId === product.barcodeId ||
        itemProduct.scannedBarcodeId === product.scannedBarcodeId ||
        item._id === product._id
      );
    });

    return inventoryItem || null;
  };

  /**
   * Unified function to process any product (from scan or search) into order item format
   */
  const processProductForOrder = (product, inventoryItem = null, quantity = 1) => {
    console.log('🔄 Processing product for order:', product.name);
    
    // If inventoryItem not provided, try to find it
    if (!inventoryItem) {
      inventoryItem = findInventoryItemForProduct(product);
    }

    const basePrice = safeNumber(product.price);
    let sellingPrice = basePrice;
    let pricingSlabs = [];
    let enableQuantityPricing = false;

    // Use inventory pricing if available - EXACT SAME LOGIC FOR BOTH SCAN AND SEARCH
    if (inventoryItem) {
      console.log('📊 Using inventory pricing for:', product.name);
      console.log('🏷️ Inventory sellingPrice:', inventoryItem.sellingPrice);
      console.log('🏷️ Base product price:', basePrice);
      
      sellingPrice = safeNumber(inventoryItem.sellingPrice || basePrice);
      pricingSlabs = inventoryItem.pricingSlabs || [];
      enableQuantityPricing = inventoryItem.enableQuantityPricing || false;
      
      console.log('💰 Final selling price:', sellingPrice);
      console.log('🎯 Pricing slabs:', pricingSlabs.length);
      console.log('🔢 Quantity pricing enabled:', enableQuantityPricing);
    } else {
      console.log('📦 Product not in inventory, using base price');
    }

    // Create consistent product identifier
    const productId = product._id;
    const productIdentifier = getProductIdentifier(product);

    // Create the base order item with consistent structure
    const orderItem = {
      // Core product info
      ...product,
      productId: productId,
      unifiedId: productIdentifier, // Unified identifier for comparison
      
      // Pricing information
      price: sellingPrice, // This should be the retailer's selling price
      originalPrice: basePrice, // Original product price
      discountedPrice: sellingPrice, // Initially same as selling price
      finalPrice: sellingPrice * quantity,
      
      // Quantity and discounts
      quantity: quantity,
      appliedDiscount: 0,
      discountType: null,
      
      // Inventory information
      fromInventory: !!inventoryItem,
      inventoryItem: inventoryItem,
      availableStock: inventoryItem ? Math.max(0, (inventoryItem.currentStock || 0) - (inventoryItem.committedStock || 0)) : 0,
      
      // Pricing configuration
      isPriceOverridden: sellingPrice !== basePrice,
      priceCorrected: false,
      pricingSlabs: pricingSlabs,
      hasQuantityPricing: enableQuantityPricing,
      
      // Barcode information
      barcodeId: product.barcodeId || '',
      scannedBarcodeId: product.scannedBarcodeId || ''
    };

    // Apply quantity pricing calculations - EXACT SAME FOR BOTH METHODS
    return calculateItemPriceWithDiscount(orderItem, quantity);
  };

  // ==================== BARCODE SCANNING ====================

  const handleBarcodeScanned = async ({ data }) => {
    if (isScanningLocked) return;

    const barcodeId = data.trim();
    console.log('🔍 Scanning barcode:', barcodeId);

    if (recentlyScannedRef.current.has(barcodeId)) {
      console.log('⏭️ Skipping recently scanned barcode');
      return;
    }

    setIsScanningLocked(true);
    recentlyScannedRef.current.add(barcodeId);
    setTimeout(() => {
      recentlyScannedRef.current.delete(barcodeId);
    }, 3000);

    showFlashFeedback();

    // Check if product already exists in cart using unified identifier
    const existingItem = scannedItems.find((item) => 
      item.unifiedId === barcodeId || 
      item.barcodeId === barcodeId || 
      item.scannedBarcodeId === barcodeId
    );

    if (existingItem) {
      console.log('⚠️ Item already in cart, increasing quantity');
      setScanFeedback("duplicate");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      
      // Increase quantity of existing item instead of adding duplicate
      incrementQuantity(existingItem.productId);
      
      setTimeout(() => {
        setIsScanningLocked(false);
        setScanFeedback(null);
      }, 1500);
      return;
    }

    setLoading(true);
    
    try {
      console.log('📡 Searching product in inventory for barcode:', barcodeId);
      
      let foundProduct = null;
      let inventoryItem = null;
      
      // Search in retailer inventory first - USING THE SAME LOGIC AS SEARCH
      inventoryItem = retailerInventory.find(item => {
        const product = item.product || {};
        return (
          product.barcodeId === barcodeId || 
          product.scannedBarcodeId === barcodeId ||
          product._id === barcodeId ||
          item._id === barcodeId
        );
      });

      if (inventoryItem) {
        foundProduct = inventoryItem.product;
        console.log('✅ Found product in inventory:', foundProduct?.name);
        console.log('🏷️ Inventory selling price:', inventoryItem.sellingPrice);
        console.log('🎯 Pricing slabs available:', inventoryItem.pricingSlabs?.length || 0);
      }

      // If not found in inventory, try catalog search
      if (!foundProduct) {
        console.log('🔍 Product not in inventory, searching catalog...');
        try {
          const catalogResponse = await fetch(
            `${API_BASE_URL}/api/catalog/products/barcode/${barcodeId}`,
            {
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            }
          );
          
          if (catalogResponse.ok) {
            const catalogData = await catalogResponse.json();
            if (catalogData.product) {
              foundProduct = catalogData.product;
              console.log('✅ Found product in catalog:', foundProduct.name);
              
              // Try to find inventory item for catalog product
              inventoryItem = findInventoryItemForProduct(foundProduct);
              if (inventoryItem) {
                console.log('🔄 Found inventory item for catalog product');
              }
            }
          }
        } catch (catalogError) {
          console.log('❌ Catalog search failed:', catalogError.message);
        }
      }

      if (!foundProduct) {
        throw new Error("Product not found for this barcode");
      }

      // Use the unified processing function - SAME AS SEARCH METHOD
      const processedItem = processProductForOrder(foundProduct, inventoryItem, 1);

      console.log('🛒 Adding to cart via SCAN:', {
        name: processedItem.name,
        basePrice: processedItem.originalPrice,
        sellingPrice: processedItem.price,
        discountedPrice: processedItem.discountedPrice,
        finalPrice: processedItem.finalPrice,
        fromInventory: processedItem.fromInventory,
        hasQuantityPricing: processedItem.hasQuantityPricing,
        pricingSlabs: processedItem.pricingSlabs?.length || 0,
        appliedDiscount: processedItem.appliedDiscount,
        unifiedId: processedItem.unifiedId
      });

      setScannedItems((prev) => [...prev, processedItem]);
      setScanFeedback("success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (error) {
      console.error("❌ Scan error:", error);
      setScanFeedback("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      Alert.alert(
        "Product Not Found",
        `No product found for barcode: ${barcodeId}`,
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
      
      setTimeout(() => {
        setIsScanningLocked(false);
        setScanFeedback(null);
      }, 1500);
    }
  };

  const showFlashFeedback = () => {
    flashAnim.setValue(0);
    Animated.sequence([
      Animated.timing(flashAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(flashAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ==================== PRODUCT SEARCH ====================

  const searchProducts = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    try {
      console.log('🔍 Searching products for:', query);
      
      let products = [];
      const searchTerm = query.toLowerCase();
      
      // Search in retailer inventory first
      const inventoryResults = retailerInventory
        .filter(item => {
          const product = item.product || {};
          return (
            product.name?.toLowerCase().includes(searchTerm) ||
            product.sku?.toLowerCase().includes(searchTerm) ||
            product.barcodeId?.includes(query) ||
            item._id === query
          );
        })
        .map(item => {
          // Process each search result through the same unified function
          const processedProduct = processProductForOrder(item.product, item, 1);
          return {
            ...processedProduct,
            source: 'inventory',
            availableStock: Math.max(0, (item.currentStock || 0) - (item.committedStock || 0))
          };
        });

      products = [...inventoryResults];
      console.log('✅ Found in inventory:', products.length);

      setSearchResults(products);
      
      if (products.length === 0) {
        console.log('❌ No products found for query:', query);
      }

    } catch (error) {
      console.error("❌ Search error:", error);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // ==================== PRODUCT MANAGEMENT ====================

  const addProductToOrder = (product) => {
    console.log('➕ Adding product to order via SEARCH:', product.name);
    
    // Check if product already exists in cart
    const existingItemIndex = scannedItems.findIndex(item => 
      item.unifiedId === getProductIdentifier(product) || 
      item.productId === product._id
    );

    if (existingItemIndex !== -1) {
      console.log('🔄 Product already in cart, increasing quantity');
      // Increase quantity of existing item
      const existingItem = scannedItems[existingItemIndex];
      incrementQuantity(existingItem.productId);
    } else {
      // Use the unified processing function to add new item
      const processedItem = processProductForOrder(
        product, 
        product.inventoryItem, 
        1
      );

      console.log('🛒 Adding to cart via SEARCH:', {
        name: processedItem.name,
        basePrice: processedItem.originalPrice,
        sellingPrice: processedItem.price,
        discountedPrice: processedItem.discountedPrice,
        finalPrice: processedItem.finalPrice,
        fromInventory: processedItem.fromInventory,
        hasQuantityPricing: processedItem.hasQuantityPricing,
        pricingSlabs: processedItem.pricingSlabs?.length || 0,
        appliedDiscount: processedItem.appliedDiscount
      });

      setScannedItems(prev => [...prev, processedItem]);
      console.log('✅ New product added to order:', processedItem.name);
    }

    setSearchQuery("");
    setSearchResults([]);
  };

  // ==================== QUANTITY & PRICING ====================

  const calculateItemPriceWithDiscount = (item, quantity) => {
    const basePrice = safeNumber(item.price); // This is already the retailer's selling price
    let discountedPrice = basePrice;
    let appliedDiscount = 0;
    let discountType = null;

    console.log(`🎯 Calculating price for ${item.name}, quantity: ${quantity}`);
    console.log(`💰 Base price: ${basePrice}, Has quantity pricing: ${item.hasQuantityPricing}`);
    console.log(`📊 Pricing slabs:`, item.pricingSlabs);

    // Apply quantity-based pricing if available - EXACT SAME LOGIC FOR BOTH METHODS
    if (item.pricingSlabs && item.pricingSlabs.length > 0 && item.hasQuantityPricing) {
      // Sort slabs by minQuantity in descending order to find the best match
      const sortedSlabs = [...item.pricingSlabs]
        .filter(slab => slab.isActive)
        .sort((a, b) => b.minQuantity - a.minQuantity);

      console.log(`🔍 Sorted active slabs:`, sortedSlabs);

      let applicableSlab = sortedSlabs.find(slab => quantity >= slab.minQuantity);

      if (applicableSlab) {
        console.log(`✅ Applying pricing slab:`, applicableSlab);
        
        if (applicableSlab.discountType === 'PERCENTAGE') {
          appliedDiscount = (basePrice * applicableSlab.discountValue) / 100;
          discountedPrice = Math.max(0, basePrice - appliedDiscount);
          discountType = 'percentage';
          console.log(`📉 Percentage discount: ${applicableSlab.discountValue}%, Applied: ${appliedDiscount}`);
        } else if (applicableSlab.discountType === 'FLAT') {
          appliedDiscount = applicableSlab.discountValue;
          discountedPrice = Math.max(0, basePrice - appliedDiscount);
          discountType = 'flat';
          console.log(`💰 Flat discount: ${applicableSlab.discountValue}, Applied: ${appliedDiscount}`);
        }
      } else {
        console.log('❌ No applicable pricing slab found for quantity:', quantity);
      }
    } else {
      console.log('ℹ️ No quantity pricing configured');
    }

    const finalPrice = discountedPrice * quantity;

    console.log(`💵 Final calculation - Discounted: ${discountedPrice}, Final: ${finalPrice}`);

    return {
      ...item,
      quantity,
      discountedPrice,
      appliedDiscount,
      discountType,
      finalPrice: finalPrice
    };
  };

  const updateItemQuantity = (productId, newQuantity) => {
    setScannedItems(prev =>
      prev.map(item => {
        if (item.productId === productId || item._id === productId) {
          const updatedQuantity = Math.max(1, newQuantity);
          const updatedItem = calculateItemPriceWithDiscount(item, updatedQuantity);
          return updatedItem;
        }
        return item;
      }).filter(item => item.quantity > 0)
    );
  };

  const incrementQuantity = (productId) => {
    const item = scannedItems.find(item => item.productId === productId || item._id === productId);
    if (item) {
      updateItemQuantity(productId, item.quantity + 1);
    }
  };

  const decrementQuantity = (productId) => {
    const item = scannedItems.find(item => item.productId === productId || item._id === productId);
    if (item) {
      updateItemQuantity(productId, item.quantity - 1);
    }
  };

  const removeItem = (productId) => {
    setScannedItems(prev => prev.filter(item => 
      item.productId !== productId && item._id !== productId
    ));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // ==================== CALCULATIONS ====================

  const calculateTotal = () => {
    return scannedItems.reduce((total, item) => {
      return total + safeNumber(item.finalPrice);
    }, 0);
  };

  const calculateSubtotal = () => {
    return scannedItems.reduce((total, item) => {
      const price = safeNumber(item.price);
      const quantity = safeNumber(item.quantity, 1);
      return total + (price * quantity);
    }, 0);
  };

  const calculateDiscount = () => {
    return scannedItems.reduce((total, item) => {
      const appliedDiscount = safeNumber(item.appliedDiscount);
      if (appliedDiscount > 0) {
        const quantity = safeNumber(item.quantity, 1);
        return total + (appliedDiscount * quantity);
      }
      return total;
    }, 0);
  };

  // ==================== CHECKOUT ====================

  const placeOrder = async () => {
    if (scannedItems.length === 0) {
      Alert.alert("No Items", "Please add some items before placing order.");
      return;
    }

    setLoading(true);
    
    try {
      const total = calculateTotal();
      const subtotal = calculateSubtotal();
      const discount = calculateDiscount();
      
      const orderData = {
        items: scannedItems.map(item => ({
          productId: item.productId || item._id,
          quantity: item.quantity || 1,
          price: item.discountedPrice || item.price || 0,
          originalPrice: item.originalPrice || item.price || 0,
          isPriceOverridden: item.isPriceOverridden || false,
          priceCorrected: item.priceCorrected || false,
          appliedDiscount: item.appliedDiscount || 0,
          discountType: item.discountType || null,
          barcodeId: item.barcodeId || '',
          scannedBarcodeId: item.scannedBarcodeId || '',
          productName: item.name || 'Unknown Product',
          fromInventory: item.fromInventory || false
        })),
        total: total,
        subtotal: subtotal,
        discount: discount,
        orderType: "offline",
        paymentMethod: "cash",
        paymentStatus: paymentStatus,
        // DO NOT include orderStatus - let backend handle it
        customerName: customerName.trim() || "Walk-in Customer",
        customerPhone: customerPhone.trim() || "",
        priceSource: "retailer_inventory"
      };

      console.log('💳 Placing offline order:', orderData);

      const response = await fetch(`${API_BASE_URL}/api/orders/offline`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(orderData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || "Failed to place order");
      }

      Alert.alert(
        "🎉 Order Placed Successfully!",
        `Offline order has been created.\n\nCustomer: ${orderData.customerName}\nItems: ${scannedItems.reduce((sum, item) => sum + (item.quantity || 1), 0)}\nTotal: ₹${total.toFixed(2)}\nPayment: ${paymentStatus === "paid" ? "Paid" : "Pending"}`,
        [
          {
            text: "OK",
            onPress: () => {
              setScannedItems([]);
              setCustomerName("");
              setCustomerPhone("");
              setPaymentStatus("paid");
              router.back();
            }
          }
        ]
      );

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    } catch (error) {
      console.error("❌ Order placement error:", error);
      Alert.alert(
        "Order Failed", 
        error.message || "Failed to place order. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDER COMPONENTS ====================

  const renderCustomerSuggestionItem = ({ item }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => selectCustomerSuggestion(item)}
    >
      <Ionicons name="person-outline" size={16} color={Colors.light.textSecondary} />
      <View style={styles.suggestionInfo}>
        <Text style={styles.suggestionName}>{item.name}</Text>
        {item.phone && (
          <Text style={styles.suggestionPhone}>{item.phone}</Text>
        )}
        <Text style={styles.suggestionMeta}>
          {item.orderCount} order{item.orderCount > 1 ? 's' : ''} • Last: {new Date(item.lastOrderDate).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short'
          })}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={Colors.light.textSecondary} />
    </TouchableOpacity>
  );

  const renderScannerModal = () => (
    <Modal
      visible={isScannerOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={closeScanner}
    >
      <View style={styles.scannerContainer}>
        <View style={[styles.scannerHeader, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity
            style={styles.scannerBackButton}
            onPress={closeScanner}
          >
            <Ionicons name="chevron-down" size={28} color="#FFF" />
            <Text style={styles.scannerBackText}>Close</Text>
          </TouchableOpacity>
          
          <View style={styles.scannerStatsTop}>
            <View style={styles.statItemTop}>
              <Text style={styles.statNumberTop}>{scannedItems.length}</Text>
              <Text style={styles.statLabelTop}>Products</Text>
            </View>
            <View style={styles.statDividerTop} />
            <View style={styles.statItemTop}>
              <Text style={styles.statNumberTop}>
                {scannedItems.reduce((sum, item) => sum + (item.quantity || 1), 0)}
              </Text>
              <Text style={styles.statLabelTop}>Items</Text>
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
            <Text style={styles.flashButtonText}>Flash</Text>
          </TouchableOpacity>
        </View>

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
              
              <View style={styles.scanOverlay}>
                <View style={styles.maskTop} />
                <View style={styles.scanArea}>
                  <View style={styles.scanFrame}>
                    <View style={[styles.corner, styles.cornerTopLeft]} />
                    <View style={[styles.corner, styles.cornerTopRight]} />
                    <View style={[styles.corner, styles.cornerBottomLeft]} />
                    <View style={[styles.corner, styles.cornerBottomRight]} />
                  </View>
                  <Text style={styles.scanInstruction}>
                    Position barcode within frame
                  </Text>
                </View>
                <View style={styles.maskBottom} />
              </View>
            </View>
          )}
        </View>

        <View style={styles.scannerFooter}>
          {scannedItems.length > 0 && (
            <TouchableOpacity
              style={styles.continueButton}
              onPress={closeScanner}
            >
              <Text style={styles.continueButtonText}>
                Continue with {scannedItems.length} items
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );

  // ==================== MAIN RENDER ====================

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Bill</Text>
          <TouchableOpacity 
            style={styles.scannerButton}
            onPress={openScanner}
          >
            <Ionicons name="barcode-outline" size={24} color="#FFF" />
            <Text style={styles.scannerButtonText}>Scan</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <FlatList
        style={styles.mainList}
        data={[{ key: 'content' }]}
        renderItem={() => (
          <View style={styles.contentContainer}>
            {/* Shop Header */}
            {retailerProfile && (
              <View style={styles.shopHeader}>
                <Text style={styles.shopName}>{retailerProfile.shopName || 'Your Shop'}</Text>
                <Text style={styles.shopInfo}>
                  {retailerProfile.address || 'Shop Address'} • {retailerProfile.contactNumber || 'Contact'}
                </Text>
                <Text style={styles.billDate}>
                  Bill Date: {new Date().toLocaleDateString('en-IN')}
                </Text>
              </View>
            )}

            {/* Product Search */}
            <View style={styles.searchSection}>
              <Text style={styles.sectionTitle}>Add Products</Text>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={Colors.light.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search products from your inventory..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={Colors.light.textSecondary}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={20} color={Colors.light.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Search Results */}
            {searchQuery.trim() && (
              <View style={styles.searchResultsSection}>
                <View style={styles.searchResultsHeader}>
                  <Text style={styles.searchResultsTitle}>
                    Search Results {searchResults.length > 0 ? `(${searchResults.length})` : ''}
                  </Text>
                  <TouchableOpacity 
                    onPress={() => {
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                  >
                    <Ionicons name="close" size={20} color={Colors.light.textSecondary} />
                  </TouchableOpacity>
                </View>

                {searchLoading ? (
                  <View style={styles.searchLoading}>
                    <ActivityIndicator size="small" color={Colors.light.accent} />
                    <Text style={styles.searchLoadingText}>Searching products...</Text>
                  </View>
                ) : searchResults.length > 0 ? (
                  <View style={styles.searchResultsList}>
                    {searchResults.map((item) => (
                      <TouchableOpacity
                        key={item._id}
                        style={styles.searchResultItem}
                        onPress={() => addProductToOrder(item)}
                      >
                        <Image
                          source={{ uri: item.image || "https://via.placeholder.com/40" }}
                          style={styles.searchResultImage}
                          defaultSource={{ uri: "https://via.placeholder.com/40" }}
                        />
                        <View style={styles.searchResultInfo}>
                          <Text style={styles.searchResultName} numberOfLines={2}>
                            {item.name || 'Unknown Product'}
                          </Text>
                          <Text style={styles.searchResultPrice}>
                            ₹{safeToFixed(item.price)}
                            {item.originalPrice !== item.price && (
                              <Text style={styles.originalPriceText}>
                                {" "}₹{safeToFixed(item.originalPrice)}
                              </Text>
                            )}
                          </Text>
                          {item.source === 'inventory' && (
                            <Text style={styles.searchResultStock}>
                              In Stock: {item.availableStock || 0}
                            </Text>
                          )}
                          {item.appliedDiscount > 0 && (
                            <Text style={styles.discountBadgeSmall}>
                              Save ₹{safeToFixed(item.appliedDiscount)}
                            </Text>
                          )}
                        </View>
                        <Ionicons name="add-circle" size={24} color={Colors.light.accent} />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noResults}>
                    <Ionicons name="search-outline" size={32} color={Colors.light.textSecondary} />
                    <Text style={styles.noResultsText}>No products found</Text>
                    <Text style={styles.noResultsSubtext}>
                      Try different keywords or scan barcodes
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Order Items */}
            <View style={styles.itemsSection}>
              <Text style={styles.sectionTitle}>
                Order Items ({scannedItems.length})
              </Text>
              
              {scannedItems.length === 0 && !searchQuery.trim() ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="cart-outline" size={80} color={Colors.light.textSecondary} />
                  <Text style={styles.emptyTitle}>No Products Added</Text>
                  <Text style={styles.emptySubtitle}>
                    Search for products above or scan barcodes to add items
                  </Text>
                </View>
              ) : scannedItems.length > 0 ? (
                <View style={styles.tableContainer}>
                  <View style={styles.tableHeader}>
                    <Text style={[styles.tableHeaderText, styles.productHeader]}>Product</Text>
                    <Text style={[styles.tableHeaderText, styles.quantityHeader]}>Qty</Text>
                    <Text style={[styles.tableHeaderText, styles.priceHeader]}>Amount</Text>
                    <Text style={[styles.tableHeaderText, styles.actionHeader]}></Text>
                  </View>
                  {scannedItems.map((item, index) => (
                    <View key={`${item.unifiedId}-${index}`} style={styles.tableRow}>
                      <View style={[styles.productCell, styles.productCellFixed]}>
                        <Image
                          source={{ uri: item.image || "https://via.placeholder.com/40" }}
                          style={styles.productImage}
                          defaultSource={{ uri: "https://via.placeholder.com/40" }}
                        />
                        <View style={styles.productInfo}>
                          <Text style={styles.productName} numberOfLines={2}>
                            {item.name || 'Unknown Product'}
                          </Text>
                          <Text style={styles.productPrice}>
                            ₹{safeToFixed(item.price)} × {item.quantity || 1}
                            {item.originalPrice !== item.price && (
                              <Text style={styles.originalPriceSmall}>
                                {" "}(was ₹{safeToFixed(item.originalPrice)})
                              </Text>
                            )}
                          </Text>
                          {item.fromInventory && (
                            <View style={styles.inventoryBadge}>
                              <Ionicons name="checkmark-circle" size={10} color="#4CAF50" />
                              <Text style={styles.inventoryBadgeText}>In Stock</Text>
                            </View>
                          )}
                          {item.appliedDiscount > 0 && (
                            <Text style={styles.discountBadge}>
                              Save ₹{safeToFixed(item.appliedDiscount * (item.quantity || 1))}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View style={[styles.quantityCell, styles.quantityCellFixed]}>
                        <View style={styles.quantityControls}>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => decrementQuantity(item.productId || item._id)}
                          >
                            <Ionicons name="remove" size={14} color={Colors.light.text} />
                          </TouchableOpacity>
                          <Text style={styles.quantityText}>{item.quantity || 1}</Text>
                          <TouchableOpacity
                            style={styles.quantityButton}
                            onPress={() => incrementQuantity(item.productId || item._id)}
                          >
                            <Ionicons name="add" size={14} color={Colors.light.text} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <View style={[styles.priceCell, styles.priceCellFixed]}>
                        <Text style={styles.itemTotal}>
                          ₹{safeToFixed(item.finalPrice)}
                        </Text>
                        {item.appliedDiscount > 0 && (
                          <Text style={styles.originalPrice}>
                            ₹{safeToFixed(item.price * (item.quantity || 1))}
                          </Text>
                        )}
                      </View>

                      <View style={[styles.actionCell, styles.actionCellFixed]}>
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => removeItem(item.productId || item._id)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Order Summary */}
            {scannedItems.length > 0 && (
              <View style={styles.summarySection}>
                <Text style={styles.sectionTitle}>Bill Summary</Text>
                <View style={styles.summaryContainer}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Subtotal:</Text>
                    <Text style={styles.summaryValue}>₹{safeToFixed(calculateSubtotal())}</Text>
                  </View>
                  {calculateDiscount() > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Discount:</Text>
                      <Text style={[styles.summaryValue, styles.discountText]}>
                        -₹{safeToFixed(calculateDiscount())}
                      </Text>
                    </View>
                  )}
                  <View style={[styles.summaryRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Total Amount:</Text>
                    <Text style={styles.totalValue}>₹{safeToFixed(calculateTotal())}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* Customer Information - Fixed Suggestions */}
            {scannedItems.length > 0 && (
              <View style={styles.customerSection}>
                <Text style={styles.sectionTitle}>Customer Information</Text>
                <View style={styles.customerFields}>
                  {/* Name Field with Suggestions */}
                  <View style={styles.fieldWithSuggestions}>
                    <Text style={styles.fieldLabel}>Customer Name</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        ref={nameInputRef}
                        style={styles.textInput}
                        placeholder="Walk-in Customer"
                        value={customerName}
                        onChangeText={handleNameInputChange}
                        placeholderTextColor={Colors.light.textSecondary}
                        onFocus={() => {
                          if (customerName.length > 1) {
                            handleNameInputChange(customerName);
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowNameSuggestions(false), 200);
                        }}
                      />
                    </View>
                    {showNameSuggestions && customerSuggestions.length > 0 && (
                      <View style={styles.suggestionsDropdown}>
                        <FlatList
                          data={customerSuggestions}
                          renderItem={renderCustomerSuggestionItem}
                          keyExtractor={(item, index) => `${item.name}-${item.phone}-${index}`}
                          style={styles.suggestionsList}
                          nestedScrollEnabled={true}
                          keyboardShouldPersistTaps="handled"
                        />
                      </View>
                    )}
                  </View>

                  {/* Phone Field with Suggestions */}
                  <View style={styles.fieldWithSuggestions}>
                    <Text style={styles.fieldLabel}>Contact Number</Text>
                    <View style={styles.inputContainer}>
                      <TextInput
                        ref={phoneInputRef}
                        style={styles.textInput}
                        placeholder="Optional"
                        value={customerPhone}
                        onChangeText={handlePhoneInputChange}
                        keyboardType="phone-pad"
                        placeholderTextColor={Colors.light.textSecondary}
                        onFocus={() => {
                          if (customerPhone.length > 1) {
                            handlePhoneInputChange(customerPhone);
                          }
                        }}
                        onBlur={() => {
                          setTimeout(() => setShowPhoneSuggestions(false), 200);
                        }}
                      />
                    </View>
                    {showPhoneSuggestions && customerSuggestions.length > 0 && (
                      <View style={styles.suggestionsDropdown}>
                        <FlatList
                          data={customerSuggestions}
                          renderItem={renderCustomerSuggestionItem}
                          keyExtractor={(item, index) => `${item.name}-${item.phone}-${index}`}
                          style={styles.suggestionsList}
                          nestedScrollEnabled={true}
                          keyboardShouldPersistTaps="handled"
                        />
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}

            {/* Payment Status */}
            {scannedItems.length > 0 && (
              <View style={styles.paymentSection}>
                <Text style={styles.sectionTitle}>Payment Status</Text>
                <View style={styles.paymentButtons}>
                  <TouchableOpacity
                    style={[
                      styles.paymentButton,
                      paymentStatus === "paid" && styles.paymentButtonActive
                    ]}
                    onPress={() => setPaymentStatus("paid")}
                  >
                    <Ionicons 
                      name={paymentStatus === "paid" ? "checkmark-circle" : "checkmark-circle-outline"} 
                      size={24} 
                      color={paymentStatus === "paid" ? "#4CAF50" : Colors.light.textSecondary} 
                    />
                    <Text style={[
                      styles.paymentButtonText,
                      paymentStatus === "paid" && styles.paymentButtonTextActive
                    ]}>
                      Paid
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.paymentButton,
                      paymentStatus === "pending" && styles.paymentButtonActive
                    ]}
                    onPress={() => setPaymentStatus("pending")}
                  >
                    <Ionicons 
                      name={paymentStatus === "pending" ? "time" : "time-outline"} 
                      size={24} 
                      color={paymentStatus === "pending" ? "#FF9800" : Colors.light.textSecondary} 
                    />
                    <Text style={[
                      styles.paymentButtonText,
                      paymentStatus === "pending" && styles.paymentButtonTextActive
                    ]}>
                      Pending
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.paymentStatusNote}>
                  Current selection: {paymentStatus === "paid" ? "Paid" : "Pending Payment"}
                </Text>
              </View>
            )}

            {/* Bottom Spacing */}
            <View style={styles.bottomSpacing} />
          </View>
        )}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
      />

      {/* Create Bill Button */}
      {scannedItems.length > 0 && (
        <View style={[styles.footer, { paddingBottom: insets.bottom > 0 ? insets.bottom : 16 }]}>
          <TouchableOpacity 
            style={styles.createBillButton}
            onPress={placeOrder}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <>
                <Text style={styles.createBillButtonText}>
                  Create Bill - ₹{safeToFixed(calculateTotal())}
                </Text>
                <Ionicons name="checkmark-done" size={20} color="#FFF" />
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Scanner Modal */}
      {renderScannerModal()}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}
    </View>
  );
}

// Updated Styles with Completely Fixed Customer Suggestions
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors.light.background 
  },
  mainList: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 120,
  },
  contentContainer: {
    flex: 1,
  },

  /* Header Styles */
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    justifyContent: 'center',
    minHeight: 72,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 100,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    gap: 6,
    minWidth: 70,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    flex: 1,
    marginHorizontal: 12,
  },
  scannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.accent,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
    minWidth: 80,
    justifyContent: 'center',
  },
  scannerButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },

  /* Shop Header */
  shopHeader: {
    backgroundColor: Colors.light.white,
    padding: 20,
    margin: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.accent,
  },
  shopName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  shopInfo: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 18,
  },
  billDate: {
    fontSize: 12,
    color: Colors.light.accent,
    textAlign: 'center',
    fontWeight: '600',
  },

  /* Search Section */
  searchSection: {
    backgroundColor: Colors.light.white,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E8E8E8',
    gap: 12,
    minHeight: 52,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
    padding: 0,
    fontWeight: '500',
  },
  
  /* Search Results Section */
  searchResultsSection: {
    backgroundColor: Colors.light.white,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    overflow: 'hidden',
  },
  searchResultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  searchResultsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
  },
  searchResultsList: {
    maxHeight: 300,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.white,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
    minHeight: 70,
  },
  searchResultImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  searchResultInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  searchResultPrice: {
    fontSize: 15,
    color: Colors.light.accent,
    fontWeight: '700',
    marginBottom: 2,
  },
  originalPriceText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textDecorationLine: 'line-through',
    fontWeight: '400',
  },
  searchResultStock: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  discountBadgeSmall: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 2,
  },
  searchLoading: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  searchLoadingText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  noResults: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: Colors.light.text,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 6,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },

  /* Items Section */
  itemsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 20,
    backgroundColor: Colors.light.white,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Table Styles */
  tableContainer: {
    backgroundColor: Colors.light.white,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  productHeader: {
    flex: 3.5,
    textAlign: 'left',
    paddingLeft: 8,
  },
  quantityHeader: {
    flex: 1.2,
  },
  priceHeader: {
    flex: 1.3,
  },
  actionHeader: {
    flex: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    minHeight: 76,
    backgroundColor: Colors.light.white,
  },
  productCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  productCellFixed: {
    flex: 3.5,
  },
  productImage: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 3,
    lineHeight: 16,
  },
  productPrice: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginBottom: 3,
    fontWeight: '500',
  },
  originalPriceSmall: {
    fontSize: 9,
    color: Colors.light.textSecondary,
    textDecorationLine: 'line-through',
  },
  inventoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    gap: 2,
    alignSelf: 'flex-start',
    marginTop: 1,
  },
  inventoryBadgeText: {
    fontSize: 8,
    color: '#2E7D32',
    fontWeight: '600',
  },
  discountBadge: {
    fontSize: 9,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 1,
  },
  quantityCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityCellFixed: {
    flex: 1.2,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    padding: 3,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  quantityButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.light.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  quantityText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
    minWidth: 18,
    textAlign: 'center',
  },
  priceCell: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  priceCellFixed: {
    flex: 1.3,
  },
  itemTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.light.text,
  },
  originalPrice: {
    fontSize: 9,
    color: Colors.light.textSecondary,
    textDecorationLine: 'line-through',
    marginTop: 1,
  },
  actionCell: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  actionCellFixed: {
    flex: 0.5,
  },
  removeButton: {
    padding: 5,
    borderRadius: 5,
    backgroundColor: '#FFF5F5',
  },

  /* Summary Section */
  summarySection: {
    backgroundColor: Colors.light.white,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  summaryContainer: {
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  discountText: {
    color: '#4CAF50',
    fontWeight: '700',
  },
  totalRow: {
    borderTopWidth: 2,
    borderTopColor: '#E8E8E8',
    paddingTop: 12,
    marginTop: 6,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.light.text,
  },
  totalValue: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.light.accent,
  },

  /* Customer Section with Completely Fixed Suggestions */
  customerSection: {
    backgroundColor: Colors.light.white,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    zIndex: 50,
  },
  customerFields: {
    gap: 20,
  },
  fieldWithSuggestions: {
    gap: 8,
    position: 'relative',
    zIndex: 100,
  },
  inputContainer: {
    position: 'relative',
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.light.text,
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.light.text,
    minHeight: 48,
    backgroundColor: '#F8F9FA',
    fontWeight: '500',
  },
  suggestionsDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: Colors.light.white,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 8,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  suggestionsList: {
    flexGrow: 0,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    gap: 12,
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  suggestionPhone: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  suggestionMeta: {
    fontSize: 10,
    color: Colors.light.textSecondary,
  },

  /* Payment Section */
  paymentSection: {
    backgroundColor: Colors.light.white,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    zIndex: 10,
  },
  paymentButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  paymentButtonActive: {
    backgroundColor: '#E8F5E8',
    borderColor: '#4CAF50',
  },
  paymentButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  paymentButtonTextActive: {
    color: '#4CAF50',
  },
  paymentStatusNote: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },

  /* Footer */
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.light.white,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 100,
  },
  createBillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  createBillButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },

  /* Bottom Spacing */
  bottomSpacing: {
    height: 20,
  },

  /* Scanner Styles */
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  scannerBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 6,
  },
  scannerBackText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  flashButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    gap: 6,
  },
  flashButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  flashButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '500',
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
  statDividerTop: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
    borderColor: 'transparent',
    backgroundColor: 'transparent',
    position: 'relative',
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
  scanInstruction: {
    marginTop: 20,
    fontSize: 14,
    color: '#FFF',
    textAlign: 'center',
    fontWeight: '500',
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
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 25,
    gap: 8,
    minWidth: 200,
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  /* Loading Overlay */
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FFF',
    fontWeight: '600',
  },
});