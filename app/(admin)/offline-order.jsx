import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Import Camera and CameraType from expo-camera
let Camera = null;
let CameraType = null;
let FlashMode = null;
let BarCodeType = null;
let useCameraPermissions = null;
let getCameraPermissionsAsync = null;
let requestCameraPermissionsAsync = null;

try {
  const cameraModule = require("expo-camera");
  Camera = cameraModule.CameraView;
  CameraType = cameraModule.CameraType;
  FlashMode = cameraModule.FlashMode;
  BarCodeType = cameraModule.BarCodeType;
  
  if (cameraModule.useCameraPermissions) {
    useCameraPermissions = cameraModule.useCameraPermissions;
  }
  getCameraPermissionsAsync = cameraModule.getCameraPermissionsAsync;
  requestCameraPermissionsAsync = cameraModule.requestCameraPermissionsAsync;
} catch (error) {
  console.warn("Camera not available:", error.message);
}

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export default function OfflineOrder() {
  const insets = useSafeAreaInsets();
  const { authToken } = useAuth();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();

  const [scannedItems, setScannedItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState('scanning'); // 'scanning' or 'checkout'

  // Scanner states
  const [permission, requestPermission] = useCameraPermissions ? useCameraPermissions() : [null, null];
  const [hasPermission, setHasPermission] = useState(null);
  const [torchOn, setTorchOn] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(null);
  const [isScanningLocked, setIsScanningLocked] = useState(false);

  // Simple animation for flash
  const flashAnim = useRef(new Animated.Value(0)).current;
  const recentlyScannedRef = useRef(new Set());

  // Camera ref
  const cameraRef = useRef(null);

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
  }, [params.scannedItems, params.autoOpenScanner]);

  useEffect(() => {
    const checkCameraPermissions = async () => {
      if (!isScannerOpen) return;

      try {
        if (useCameraPermissions && permission !== null) {
          setHasPermission(permission?.granted || false);
          return;
        }

        if (getCameraPermissionsAsync) {
          const { status } = await getCameraPermissionsAsync();
          setHasPermission(status === "granted");
        } else {
          setHasPermission(false);
        }
      } catch (error) {
        console.warn("Failed to check camera permissions:", error);
        setHasPermission(false);
      }
    };

    checkCameraPermissions();
  }, [isScannerOpen, permission]);

  const requestCameraPermission = async () => {
    try {
      if (requestPermission) {
        const result = await requestPermission();
        setHasPermission(result.granted);
      } else if (requestCameraPermissionsAsync) {
        const { status } = await requestCameraPermissionsAsync();
        setHasPermission(status === "granted");
      } else {
        setHasPermission(false);
      }
    } catch (error) {
      console.warn("Failed to request camera permission:", error);
      setHasPermission(false);
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
    setCurrentView('scanning');
  };

  const closeScanner = () => {
    setIsScannerOpen(false);
    setTimeout(resetScannerState, 300);
  };

/* ------------------------------------------------------------------ */
/* FIXED BARCODE SCANNING LOGIC WITH INVENTORY PRICES                */
/* ------------------------------------------------------------------ */
const handleBarcodeScanned = async ({ data }) => {
  if (isScanningLocked) return;

  const barcodeId = data.trim();
  console.log('🔍 Scanning barcode:', barcodeId);

  // Check if recently scanned to prevent duplicates
  if (recentlyScannedRef.current.has(barcodeId)) {
    console.log('⏭️ Skipping recently scanned barcode:', barcodeId);
    return;
  }

  // Lock scanning to prevent multiple scans
  setIsScanningLocked(true);
  
  // Add to recently scanned set with timeout
  recentlyScannedRef.current.add(barcodeId);
  setTimeout(() => {
    recentlyScannedRef.current.delete(barcodeId);
  }, 3000);

  // Show visual feedback
  showFlashFeedback();

  // Check if item already exists in cart
  const existingItem = scannedItems.find((item) => 
    item.barcodeId === barcodeId || 
    item.scannedBarcodeId === barcodeId ||
    item._id === barcodeId
  );

  if (existingItem) {
    console.log('⚠️ Item already in cart:', barcodeId);
    setScanFeedback("duplicate");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    
    setTimeout(() => {
      setIsScanningLocked(false);
      setScanFeedback(null);
    }, 1500);
    return;
  }

  setLoading(true);
  
  try {
    console.log('📡 Fetching product data for barcode:', barcodeId);
    
    let productData = null;
    let retailerPrice = null;
    
    // STEP 1: First find the product by barcode
    try {
      const response1 = await fetch(
        `${API_BASE_URL}/api/catalog/products/barcode/${barcodeId}`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );
      
      if (response1.ok) {
        const data = await response1.json();
        if (data.product) {
          productData = data.product;
          console.log('✅ Found product by scanned barcode:', productData.name);
        }
      }
    } catch (error) {
      console.log('❌ Scanned barcode search failed:', error.message);
    }

    // STEP 2: If product not found by barcode, try by product ID
    if (!productData) {
      try {
        const response2 = await fetch(
          `${API_BASE_URL}/api/catalog/products/${barcodeId}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );
        
        if (response2.ok) {
          const data = await response2.json();
          if (data.product) {
            productData = data.product;
            console.log('✅ Found product by ID (generated barcode):', productData.name);
          }
        }
      } catch (error) {
        console.log('❌ Product ID search failed:', error.message);
      }
    }

    // STEP 3: If still not found, search all products
    if (!productData) {
      try {
        const response3 = await fetch(
          `${API_BASE_URL}/api/catalog/products`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );
        
        if (response3.ok) {
          const data = await response3.json();
          const products = Array.isArray(data) ? data : data.products || [];
          
          // Look for product with matching barcodeId or scannedBarcodeId
          productData = products.find(product => 
            product.barcodeId === barcodeId || 
            product.scannedBarcodeId === barcodeId ||
            product._id === barcodeId
          );
          
          if (productData) {
            console.log('✅ Found product in products list:', productData.name);
          }
        }
      } catch (error) {
        console.log('❌ Products list search failed:', error.message);
      }
    }

    if (!productData) {
      throw new Error("Product not found for this barcode");
    }

    // STEP 4: 🔥 CRITICAL FIX - Get retailer's inventory price
    console.log('💰 Fetching retailer inventory price for product:', productData._id);
    try {
      const inventoryResponse = await fetch(
        `${API_BASE_URL}/api/retailer/inventory`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      if (inventoryResponse.ok) {
        const inventoryData = await inventoryResponse.json();
        if (inventoryData.success && inventoryData.data) {
          // Find this product in retailer's inventory
          const inventoryItem = inventoryData.data.inventory?.find(item => 
            item.product?._id === productData._id || 
            item.product?._id === productData.productId
          );

          if (inventoryItem) {
            retailerPrice = inventoryItem.sellingPrice;
            console.log('🎯 Found retailer price:', retailerPrice, 'Default price:', productData.price);
            
            if (retailerPrice && retailerPrice !== productData.price) {
              console.log('💰 Using OVERRIDDEN price from inventory');
            } else {
              console.log('💰 Using DEFAULT price from catalog');
            }
          } else {
            console.log('⚠️ Product not found in retailer inventory, using catalog price');
          }
        }
      }
    } catch (error) {
      console.log('❌ Inventory fetch failed, using catalog price:', error.message);
    }

    // STEP 5: Prepare the item for cart with correct price
    const finalPrice = retailerPrice || parseFloat(productData.price) || 0;
    const finalDiscountedPrice = productData.discount > 0 
      ? finalPrice * (1 - (productData.discount / 100))
      : finalPrice;

    const newItem = {
      ...productData,
      productId: productData._id,
      barcodeId: productData.barcodeId || barcodeId,
      scannedBarcodeId: productData.scannedBarcodeId || barcodeId,
      quantity: 1,
      price: finalPrice, // 🔥 Use retailer's overridden price
      discountedPrice: finalDiscountedPrice,
      isPriceOverridden: retailerPrice && retailerPrice !== productData.price, // Track if price is overridden
      originalPrice: parseFloat(productData.price) || 0 // Keep original for reference
    };

    console.log('🛒 Adding to cart:', {
      name: newItem.name,
      price: newItem.price,
      originalPrice: newItem.originalPrice,
      isOverridden: newItem.isPriceOverridden,
      retailerPrice: retailerPrice
    });

    // Add to scanned items
    setScannedItems((prev) => [...prev, newItem]);
    setScanFeedback("success");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

  } catch (error) {
    console.error("❌ Scan error:", error);
    setScanFeedback("error");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    
    // Show specific error message
    Alert.alert(
      "Product Not Found",
      `No product found for barcode: ${barcodeId}\n\nMake sure the product exists in your catalog and has a barcode assigned.`,
      [{ text: "OK" }]
    );
  } finally {
    setLoading(false);
    
    // Unlock scanning after delay
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

  /* ------------------------------------------------------------------ */
  /* QUANTITY MANAGEMENT                                               */
  /* ------------------------------------------------------------------ */
  const incrementQuantity = (barcodeId) => {
    setScannedItems(prev =>
      prev.map(item =>
        item.barcodeId === barcodeId || item.scannedBarcodeId === barcodeId
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    );
  };

  const decrementQuantity = (barcodeId) => {
    setScannedItems(prev =>
      prev.map(item =>
        item.barcodeId === barcodeId || item.scannedBarcodeId === barcodeId
          ? { ...item, quantity: Math.max(0, item.quantity - 1) }
          : item
      ).filter(item => item.quantity > 0)
    );
  };

  const removeItem = (barcodeId) => {
    setScannedItems(prev => prev.filter(item => 
      item.barcodeId !== barcodeId && item.scannedBarcodeId !== barcodeId
    ));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  /* ------------------------------------------------------------------ */
  /* CALCULATIONS                                                      */
  /* ------------------------------------------------------------------ */
  const calculateTotal = () => {
    return scannedItems.reduce((total, item) => {
      const price = item.discountedPrice || item.price;
      return total + (parseFloat(price) || 0) * item.quantity;
    }, 0);
  };

  const calculateSubtotal = () => {
    return scannedItems.reduce((total, item) => {
      return total + (parseFloat(item.price) || 0) * item.quantity;
    }, 0);
  };

  const calculateDiscount = () => {
    return scannedItems.reduce((total, item) => {
      if (item.discountedPrice && item.discountedPrice < item.price) {
        return total + (parseFloat(item.price) - parseFloat(item.discountedPrice)) * item.quantity;
      }
      return total;
    }, 0);
  };

  /* ------------------------------------------------------------------ */
  /* CHECKOUT FUNCTIONS                                                */
  /* ------------------------------------------------------------------ */
  const proceedToCheckout = () => {
    if (scannedItems.length === 0) {
      Alert.alert("No Items", "Please scan some items before proceeding.");
      return;
    }
    
    setCurrentView('checkout');
    setIsScannerOpen(false);
  };

const placeOrder = async () => {
  if (scannedItems.length === 0) {
    Alert.alert("No Items", "Please scan some items before placing order.");
    return;
  }

  setLoading(true);
  
  try {
    const orderData = {
      items: scannedItems.map(item => ({
        productId: item.productId || item._id,
        quantity: item.quantity,
        price: item.discountedPrice || item.price, // This now uses retailer's price
        originalPrice: item.originalPrice, // Include original price for reference
        isPriceOverridden: item.isPriceOverridden, // Track if price was overridden
        barcodeId: item.barcodeId,
        scannedBarcodeId: item.scannedBarcodeId,
        productName: item.name
      })),
      total: calculateTotal(),
      subtotal: calculateSubtotal(),
      discount: calculateDiscount(),
      orderType: "offline",
      paymentMethod: "cash",
      paymentStatus: "paid",
      status: "completed",
      priceSource: "retailer_inventory" // Indicate prices came from retailer inventory
    };

    console.log('💳 Placing offline order with retailer prices:', orderData);

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
      `Offline order has been created.\n\nItems: ${scannedItems.reduce((sum, item) => sum + item.quantity, 0)}\nTotal: ₹${calculateTotal().toFixed(2)}`,
      [
        {
          text: "OK",
          onPress: () => {
            setScannedItems([]);
            setCurrentView('scanning');
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

  const backToScanning = () => {
    setCurrentView('scanning');
    openScanner();
  };

  /* ------------------------------------------------------------------ */
  /* PROFESSIONAL SCANNER MODAL                                        */
  /* ------------------------------------------------------------------ */
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
          
          {/* Stats */}
          <View style={styles.scannerStatsTop}>
            <View style={styles.statItemTop}>
              <Text style={styles.statNumberTop}>{scannedItems.length}</Text>
              <Text style={styles.statLabelTop}>Products</Text>
            </View>
            <View style={styles.statDividerTop} />
            <View style={styles.statItemTop}>
              <Text style={styles.statNumberTop}>
                {scannedItems.reduce((sum, item) => sum + item.quantity, 0)}
              </Text>
              <Text style={styles.statLabelTop}>Items</Text>
            </View>
            <View style={styles.statDividerTop} />
            <View style={styles.statItemTop}>
              <Text style={styles.statNumberTop}>
                ₹{calculateTotal().toFixed(0)}
              </Text>
              <Text style={styles.statLabelTop}>Total</Text>
            </View>
          </View>
          
          {/* Flash */}
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

        {/* Camera Container */}
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
              <Text style={styles.permissionSubtext}>
                Enable camera permissions to scan barcodes
              </Text>
              <TouchableOpacity
                style={styles.permissionButton}
                onPress={requestCameraPermission}
              >
                <Text style={styles.permissionButtonText}>Allow Camera Access</Text>
              </TouchableOpacity>
            </View>
          ) : Camera ? (
            <View style={styles.cameraWrapper}>
              <Camera
                ref={cameraRef}
                style={styles.camera}
                type={'back'}
                flash={torchOn ? 'on' : 'off'}
                onBarcodeScanned={isScanningLocked ? undefined : handleBarcodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ['code128', 'ean13', 'ean8', 'upc_a', 'upc_e', 'qr'],
                }}
              />
              
              {/* Simple Flash Overlay */}
              <Animated.View 
                style={[
                  styles.flashOverlay,
                  {
                    opacity: flashAnim,
                    backgroundColor: scanFeedback === "success" 
                      ? 'rgba(76, 175, 80, 0.3)' 
                      : scanFeedback === "error" 
                      ? 'rgba(244, 67, 54, 0.3)' 
                      : scanFeedback === "duplicate"
                      ? 'rgba(255, 152, 0, 0.3)'
                      : 'rgba(255, 255, 255, 0.1)'
                  }
                ]} 
              />

              {/* Professional Scan Overlay */}
              <View style={styles.scanOverlay}>
                {/* Top Mask */}
                <View style={styles.maskTop} />
                
                {/* Center Scan Area */}
                <View style={styles.scanArea}>
                  <View style={styles.scanFrame}>
                    {/* Corner Borders */}
                    <View style={[styles.corner, styles.cornerTopLeft]} />
                    <View style={[styles.corner, styles.cornerTopRight]} />
                    <View style={[styles.corner, styles.cornerBottomLeft]} />
                    <View style={[styles.corner, styles.cornerBottomRight]} />
                    
                    {/* Scanning Animation */}
                    <Animated.View 
                      style={[
                        styles.scanLine,
                        {
                          transform: [{
                            translateY: flashAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, 150]
                            })
                          }]
                        }
                      ]} 
                    />
                  </View>
                  
                  <Text style={styles.scanInstruction}>
                    Position barcode within frame
                  </Text>
                  
                  {/* Simple Status Messages */}
                  {isScanningLocked && (
                    <View style={styles.statusContainer}>
                      <Text style={[
                        styles.statusText,
                        scanFeedback === "success" && styles.statusSuccess,
                        scanFeedback === "error" && styles.statusError,
                        scanFeedback === "duplicate" && styles.statusDuplicate,
                      ]}>
                        {scanFeedback === "success" ? "✅ Product added" :
                         scanFeedback === "duplicate" ? "⚠️ Already scanned" :
                         scanFeedback === "error" ? "❌ Product not found" : 
                         "🔍 Processing..."}
                      </Text>
                    </View>
                  )}
                </View>
                
                {/* Bottom Mask */}
                <View style={styles.maskBottom} />
              </View>
            </View>
          ) : (
            <View style={styles.permissionContainer}>
              <Ionicons name="alert-circle" size={64} color="#FFF" />
              <Text style={styles.permissionText}>Camera unavailable</Text>
              <Text style={styles.permissionSubtext}>
                Camera module not available on this device
              </Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.scannerFooter}>
          {scannedItems.length > 0 ? (
            <View style={styles.footerWithItems}>
              <TouchableOpacity
                style={styles.continueButton}
                onPress={proceedToCheckout}
              >
                <Text style={styles.continueButtonText}>
                  Create Bill ({scannedItems.length} items)
                </Text>
                <Ionicons name="arrow-forward" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.footerEmpty}>
              <Text style={styles.emptyFooterText}>
                {loading ? "Searching for product..." : "Scan products to begin"}
              </Text>
              {loading && <ActivityIndicator size="small" color="#FFF" style={styles.footerLoader} />}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  /* ------------------------------------------------------------------ */
  /* CHECKOUT VIEW                                                     */
  /* ------------------------------------------------------------------ */
  const renderCheckoutView = () => (
    <View style={styles.checkoutContainer}>
      {/* Header with proper padding */}
      <View style={[styles.checkoutHeader, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={backToScanning}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text style={styles.checkoutTitle}>Create Offline Bill</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.checkoutScrollView}>
        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Items ({scannedItems.length})</Text>
          {scannedItems.map((item, index) => (
            <View key={`${item.barcodeId}-${index}`} style={styles.orderItem}>
              <Image
                source={{ uri: item.image || "https://via.placeholder.com/60" }}
                style={styles.orderItemImage}
              />
              <View style={styles.orderItemInfo}>
                <Text style={styles.orderItemName} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.orderItemPrice}>
                  ₹{item.discountedPrice || item.price} × {item.quantity}
                </Text>
                {item.scannedBarcodeId && (
                  <Text style={styles.barcodeText}>
                    Barcode: {item.scannedBarcodeId}
                  </Text>
                )}
              </View>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => decrementQuantity(item.barcodeId || item.scannedBarcodeId)}
                >
                  <Ionicons name="remove" size={16} color={Colors.light.text} />
                </TouchableOpacity>
                <Text style={styles.quantityText}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => incrementQuantity(item.barcodeId || item.scannedBarcodeId)}
                >
                  <Ionicons name="add" size={16} color={Colors.light.text} />
                </TouchableOpacity>
              </View>
              <Text style={styles.orderItemTotal}>
                ₹{((item.discountedPrice || item.price) * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Bill Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Summary</Text>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>₹{calculateSubtotal().toFixed(2)}</Text>
            </View>
            {calculateDiscount() > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount:</Text>
                <Text style={[styles.summaryValue, styles.discountText]}>
                  -₹{calculateDiscount().toFixed(2)}
                </Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total Amount:</Text>
              <Text style={styles.totalValue}>₹{calculateTotal().toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Checkout Footer */}
      <View style={styles.checkoutFooter}>
        <TouchableOpacity 
          style={styles.placeOrderButton}
          onPress={placeOrder}
          disabled={loading || scannedItems.length === 0}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Text style={styles.placeOrderButtonText}>
                Place Order - ₹{calculateTotal().toFixed(2)}
              </Text>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

const renderItemCard = (item, index) => (
  <View key={`${item.barcodeId}-${index}`} style={styles.itemCard}>
    <Image
      source={{ uri: item.image || "https://via.placeholder.com/80" }}
      style={styles.itemImage}
    />
    <View style={styles.itemInfo}>
      <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
      
      {/* Show price override indicator */}
      <View style={styles.priceRow}>
        <Text style={styles.itemPrice}>₹{item.discountedPrice || item.price}</Text>
        {item.isPriceOverridden && (
          <View style={styles.overrideBadge}>
            <Ionicons name="pricetag" size={10} color="#FFF" />
            <Text style={styles.overrideText}>Custom</Text>
          </View>
        )}
      </View>
      
      {item.originalPrice && item.isPriceOverridden && (
        <Text style={styles.originalPriceText}>
          Default: ₹{item.originalPrice}
        </Text>
      )}
      
      {item.scannedBarcodeId && (
        <Text style={styles.itemBarcode}>Barcode: {item.scannedBarcodeId}</Text>
      )}
    </View>
    <View style={styles.quantityControls}>
      <TouchableOpacity
        style={styles.quantityButton}
        onPress={() => decrementQuantity(item.barcodeId || item.scannedBarcodeId)}
      >
        <Ionicons name="remove" size={16} color={Colors.light.text} />
      </TouchableOpacity>
      <Text style={styles.quantityText}>{item.quantity}</Text>
      <TouchableOpacity
        style={styles.quantityButton}
        onPress={() => incrementQuantity(item.barcodeId || item.scannedBarcodeId)}
      >
        <Ionicons name="add" size={16} color={Colors.light.text} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => removeItem(item.barcodeId || item.scannedBarcodeId)}
      >
        <Ionicons name="trash-outline" size={16} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  </View>
);

  const EmptyList = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="barcode-outline" size={80} color={Colors.light.textSecondary} />
      <Text style={styles.emptyTitle}>Ready to Scan</Text>
      <Text style={styles.emptySubtitle}>
        Scan product barcodes to add them to your order
      </Text>
      <TouchableOpacity 
        style={styles.scanNowButton}
        onPress={openScanner}
      >
        <Ionicons name="barcode-outline" size={20} color="#FFF" />
        <Text style={styles.scanNowButtonText}>Start Scanning</Text>
      </TouchableOpacity>
    </View>
  );

  /* ------------------------------------------------------------------ */
  /* MAIN RENDER                                                       */
  /* ------------------------------------------------------------------ */
  if (currentView === 'checkout') {
    return renderCheckoutView();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with proper padding */}
      <View style={[styles.professionalHeader, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Offline Bill</Text>
          <View style={styles.headerRight}>
            {scannedItems.length > 0 && (
              <TouchableOpacity 
                style={styles.scanMoreButton}
                onPress={openScanner}
              >
                <Ionicons name="barcode-outline" size={20} color={Colors.light.accent} />
                <Text style={styles.scanMoreText}>Scan More</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Summary */}
        {scannedItems.length > 0 && (
          <View style={styles.orderSummary}>
            <Text style={styles.summaryTitle}>Order Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Items:</Text>
              <Text style={styles.summaryValue}>
                {scannedItems.reduce((sum, item) => sum + item.quantity, 0)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Products:</Text>
              <Text style={styles.summaryValue}>{scannedItems.length}</Text>
            </View>
            {calculateDiscount() > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Discount:</Text>
                <Text style={[styles.summaryValue, styles.discountText]}>
                  -₹{calculateDiscount().toFixed(2)}
                </Text>
              </View>
            )}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>₹{calculateTotal().toFixed(2)}</Text>
            </View>
          </View>
        )}

        {/* Scanned Items */}
        <View style={styles.itemsSection}>
          <Text style={styles.sectionTitle}>
            Scanned Items ({scannedItems.length})
          </Text>
          {scannedItems.length === 0 ? (
            <EmptyList />
          ) : (
            scannedItems.map(renderItemCard)
          )}
        </View>
      </ScrollView>

      {/* Checkout Button */}
      {scannedItems.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.checkoutButton}
            onPress={proceedToCheckout}
          >
            <Text style={styles.checkoutButtonText}>
              Create Bill - ₹{calculateTotal().toFixed(2)}
            </Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
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

/* ------------------------------------------------------------------ */
/* PROFESSIONAL STYLES                                               */
/* ------------------------------------------------------------------ */
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: Colors.light.background 
  },

  /* Checkout View Styles */
  checkoutContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  checkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  checkoutTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  checkoutScrollView: {
    flex: 1,
  },
  checkoutFooter: {
    backgroundColor: Colors.light.white,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },

  /* Sections */
  section: {
    backgroundColor: Colors.light.white,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 16,
  },

  /* Order Items in Checkout */
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  orderItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  orderItemPrice: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  barcodeText: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    fontFamily: 'monospace',
  },
  orderItemTotal: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.accent,
    marginLeft: 12,
  },

  /* Summary */
  summaryContainer: {
    marginTop: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  discountText: {
    color: '#4CAF50',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.accent,
  },

  /* Buttons */
  placeOrderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  placeOrderButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  /* Professional Scanner Styles */
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

  /* Simple Flash Overlay */
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },

  /* Professional Scan Overlay */
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  
  /* Scan Focus Area */
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

  /* Scan Line Animation */
  scanLine: {
    width: 250,
    height: 2,
    backgroundColor: Colors.light.accent,
    position: 'absolute',
    top: 0,
  },
  
  scanInstruction: {
    marginTop: 20,
    fontSize: 14,
    color: '#FFF',
    textAlign: 'center',
    fontWeight: '500',
  },
  
  /* Simple Status Messages */
  statusContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  statusSuccess: {
    color: '#4CAF50',
  },
  statusError: {
    color: '#F44336',
  },
  statusDuplicate: {
    color: '#FF9800',
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
  permissionSubtext: {
    fontSize: 14,
    color: '#CCC',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
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
  footerWithItems: {
    alignItems: 'center',
  },
  footerEmpty: {
    alignItems: 'center',
  },
  footerLoader: {
    marginTop: 8,
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
  emptyFooterText: {
    fontSize: 14,
    color: '#CCC',
    textAlign: 'center',
  },
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  scanNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  scanNowButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  professionalHeader: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    borderRadius: 8,
    gap: 4,
  },
  scanMoreText: {
    fontSize: 12,
    color: Colors.light.accent,
    fontWeight: '600',
  },
  itemCard: {
    flexDirection: 'row',
    backgroundColor: Colors.light.white,
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 14,
    color: Colors.light.accent,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemBarcode: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    fontFamily: 'monospace',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    minWidth: 20,
    textAlign: 'center',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderSummary: {
    backgroundColor: Colors.light.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 12,
  },
  itemsSection: {
    flex: 1,
  },
  footer: {
    backgroundColor: Colors.light.white,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  checkoutButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  },
  priceRow: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  marginBottom: 2,
},
overrideBadge: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: Colors.light.accent,
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 4,
  gap: 2,
},
overrideText: {
  fontSize: 8,
  color: '#FFF',
  fontWeight: '600',
},
originalPriceText: {
  fontSize: 10,
  color: Colors.light.textSecondary,
  textDecorationLine: 'line-through',
  marginBottom: 2,
},
});


