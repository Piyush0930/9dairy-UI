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
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CameraView, useCameraPermissions } from "expo-camera";


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
  const [permission, requestPermission] = useCameraPermissions();
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
    if (permission) {
      setHasPermission(permission.granted);
    }
  }, [permission]);

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
  /* FIXED PROFESSIONAL SCANNER MODAL                                  */
  /* ------------------------------------------------------------------ */
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
            <Text className="text-base font-bold text-white mb-1">{scannedItems.length}</Text>
            <Text className="text-xs text-gray-300 font-medium">Products</Text>
          </View>
          <View className="w-px h-5 bg-white/30 mx-2" />
          <View className="items-center px-3">
            <Text className="text-base font-bold text-white mb-1">
              {scannedItems.reduce((sum, item) => sum + item.quantity, 0)}
            </Text>
            <Text className="text-xs text-gray-300 font-medium">Items</Text>
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

      {/* Camera Container */}
      <View className="flex-1">
        {hasPermission === null ? (
          <View className="flex-1 justify-center items-center bg-black px-10">
            <ActivityIndicator size="large" color="#FFF" />
            <Text className="text-white text-lg mt-4 text-center font-semibold">Checking camera access</Text>
          </View>
        ) : hasPermission === false ? (
          <View className="flex-1 justify-center items-center bg-black px-10">
            <Ionicons name="camera-off" size={64} color="#FFF" />
            <Text className="text-white text-lg mt-4 text-center font-semibold">Camera access required</Text>
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
            
            <View className="absolute inset-0 z-10">
              <View className="flex-[2] bg-black/70" />
              <View className="h-50 justify-center items-center bg-transparent">
                <View className="w-62 h-38 border-2 border-white rounded-xl relative">
                  <View className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-white rounded-tl-lg" />
                  <View className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-white rounded-tr-lg" />
                  <View className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-white rounded-bl-lg" />
                  <View className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-white rounded-br-lg" />
                </View>
                <Text className="text-white text-sm mt-5 text-center font-medium">
                  Position barcode within frame
                </Text>
              </View>
              <View className="flex-[2] bg-black/70" />
            </View>
          </View>
        )}
      </View>

      {/* Footer */}
      <View className="bg-black/90 px-5 py-5">
        {scannedItems.length > 0 && (
          <TouchableOpacity
            className="flex-row items-center bg-green-500 px-6 py-4 rounded-full min-w-50 justify-center gap-2"
            onPress={proceedToCheckout}
          >
            <Text className="text-white text-base font-semibold">
              Create Bill ({scannedItems.length} items)
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  </Modal>
);
  /* ------------------------------------------------------------------ */
  /* CHECKOUT VIEW                                                     */
  /* ------------------------------------------------------------------ */
  const renderCheckoutView = () => (
    <View className="flex-1 bg-white">
      {/* Header with proper padding */}
      <View className={`flex-row items-center justify-between px-4 pb-4 bg-white border-b border-gray-200`} style={{ paddingTop: insets.top + 16 }}>
        <TouchableOpacity 
          className="p-1"
          onPress={backToScanning}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-800">Create Offline Bill</Text>
        <View className="w-8" />
      </View>

      <ScrollView className="flex-1">
        {/* Order Items */}
        <View className="bg-white mx-4 mt-4 p-4 rounded-xl shadow">
          <Text className="text-lg font-bold text-gray-800 mb-4">Order Items ({scannedItems.length})</Text>
          {scannedItems.map((item, index) => (
            <View key={`${item.barcodeId}-${index}`} className="flex-row items-center py-3 border-b border-gray-100">
              <Image
                source={{ uri: item.image || "https://via.placeholder.com/60" }}
                className="w-12 h-12 rounded-lg mr-3"
              />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-gray-800 mb-1" numberOfLines={2}>
                  {item.name}
                </Text>
                <Text className="text-xs text-gray-500">
                  ₹{item.discountedPrice || item.price} × {item.quantity}
                </Text>
                {item.scannedBarcodeId && (
                  <Text className="text-2.5 text-gray-500 font-mono">
                    Barcode: {item.scannedBarcodeId}
                  </Text>
                )}
              </View>
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  className="w-8 h-8 rounded-full bg-gray-100 justify-center items-center"
                  onPress={() => decrementQuantity(item.barcodeId || item.scannedBarcodeId)}
                >
                  <Ionicons name="remove" size={16} color={Colors.light.text} />
                </TouchableOpacity>
                <Text className="text-base font-semibold text-gray-800 min-w-5 text-center">{item.quantity}</Text>
                <TouchableOpacity
                  className="w-8 h-8 rounded-full bg-gray-100 justify-center items-center"
                  onPress={() => incrementQuantity(item.barcodeId || item.scannedBarcodeId)}
                >
                  <Ionicons name="add" size={16} color={Colors.light.text} />
                </TouchableOpacity>
              </View>
              <Text className="text-base font-bold text-blue-500 ml-3">
                ₹{((item.discountedPrice || item.price) * item.quantity).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        {/* Bill Summary */}
        <View className="bg-white mx-4 mt-4 p-4 rounded-xl shadow">
          <Text className="text-lg font-bold text-gray-800 mb-4">Bill Summary</Text>
          <View className="mt-2">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm text-gray-500">Subtotal:</Text>
              <Text className="text-sm font-semibold text-gray-800">₹{calculateSubtotal().toFixed(2)}</Text>
            </View>
            {calculateDiscount() > 0 && (
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm text-gray-500">Discount:</Text>
                <Text className="text-sm font-semibold text-green-500">
                  -₹{calculateDiscount().toFixed(2)}
                </Text>
              </View>
            )}
            <View className="flex-row justify-between items-center pt-2 mt-2 border-t border-gray-200">
              <Text className="text-base font-bold text-gray-800">Total Amount:</Text>
              <Text className="text-lg font-bold text-blue-500">₹{calculateTotal().toFixed(2)}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Checkout Footer */}
      <View className="bg-white px-4 py-4 border-t border-gray-200">
        <TouchableOpacity 
          className="flex-row items-center justify-center bg-green-500 px-6 py-4 rounded-xl gap-2"
          onPress={placeOrder}
          disabled={loading || scannedItems.length === 0}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Text className="text-white text-base font-semibold">
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
    <View key={`${item.barcodeId}-${index}`} className="bg-white p-4 rounded-xl shadow mb-3 flex-row items-center relative">
      <Image
        source={{ uri: item.image || "https://via.placeholder.com/80" }}
        className="w-15 h-15 rounded-lg mr-3"
      />
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-800 mb-1" numberOfLines={2}>{item.name}</Text>
        
        {/* Show price override indicator */}
        <View className="flex-row items-center gap-1.5 mb-0.5">
          <Text className="text-sm font-bold text-blue-500">₹{item.discountedPrice || item.price}</Text>
          {item.isPriceOverridden && (
            <View className="flex-row items-center bg-blue-500 px-1.5 py-0.5 rounded gap-0.5">
              <Ionicons name="pricetag" size={10} color="#FFF" />
              <Text className="text-white text-2.25 font-semibold">Custom</Text>
            </View>
          )}
        </View>
        
        {item.originalPrice && item.isPriceOverridden && (
          <Text className="text-2.5 text-gray-500 line-through">
            Default: ₹{item.originalPrice}
          </Text>
        )}
        
        {item.scannedBarcodeId && (
          <Text className="text-2.5 text-gray-500 font-mono">Barcode: {item.scannedBarcodeId}</Text>
        )}
      </View>
      <View className="flex-row items-center gap-2">
        <TouchableOpacity
          className="w-8 h-8 rounded-full bg-gray-100 justify-center items-center"
          onPress={() => decrementQuantity(item.barcodeId || item.scannedBarcodeId)}
        >
          <Ionicons name="remove" size={16} color={Colors.light.text} />
        </TouchableOpacity>
        <Text className="text-base font-semibold text-gray-800 min-w-5 text-center">{item.quantity}</Text>
        <TouchableOpacity
          className="w-8 h-8 rounded-full bg-gray-100 justify-center items-center"
          onPress={() => incrementQuantity(item.barcodeId || item.scannedBarcodeId)}
        >
          <Ionicons name="add" size={16} color={Colors.light.text} />
        </TouchableOpacity>
        <TouchableOpacity
          className="w-8 h-8 rounded-full bg-red-50 justify-center items-center"
          onPress={() => removeItem(item.barcodeId || item.scannedBarcodeId)}
        >
          <Ionicons name="trash-outline" size={16} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const EmptyList = () => (
    <View className="items-center justify-center py-15 px-10">
      <Ionicons name="barcode-outline" size={80} color={Colors.light.textSecondary} />
      <Text className="text-lg font-semibold text-gray-800 mt-4 mb-2">Ready to Scan</Text>
      <Text className="text-sm text-gray-500 text-center mb-6 leading-5">
        Scan product barcodes to add them to your order
      </Text>
      <TouchableOpacity 
        className="flex-row items-center bg-blue-500 px-6 py-3 rounded-full gap-2"
        onPress={openScanner}
      >
        <Ionicons name="barcode-outline" size={20} color="#FFF" />
        <Text className="text-white font-semibold">Start Scanning</Text>
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
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* Header with proper padding */}
      <View className={`px-4 pb-4 bg-white border-b border-gray-200`} style={{ paddingTop: insets.top + 8 }}>
        <View className="flex-row items-center justify-between h-10">
          <TouchableOpacity 
            className="p-1"
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-800">Create Offline Bill</Text>
          <View className="flex-row items-center">
            {scannedItems.length > 0 && (
              <TouchableOpacity 
                className="flex-row items-center px-3 py-1.5 bg-blue-50 rounded gap-1"
                onPress={openScanner}
              >
                <Ionicons name="barcode-outline" size={20} color={Colors.light.accent} />
                <Text className="text-blue-500 text-sm font-semibold">Scan More</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="p-4">
          {/* Order Summary */}
          {scannedItems.length > 0 && (
            <View className="bg-white p-4 rounded-xl shadow mb-4">
              <Text className="text-lg font-bold text-gray-800 mb-3">Order Summary</Text>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm text-gray-500">Items:</Text>
                <Text className="text-sm font-semibold text-gray-800">
                  {scannedItems.reduce((sum, item) => sum + item.quantity, 0)}
                </Text>
              </View>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm text-gray-500">Products:</Text>
                <Text className="text-sm font-semibold text-gray-800">{scannedItems.length}</Text>
              </View>
              {calculateDiscount() > 0 && (
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-sm text-gray-500">Discount:</Text>
                  <Text className="text-sm font-semibold text-green-500">
                    -₹{calculateDiscount().toFixed(2)}
                  </Text>
                </View>
              )}
              <View className="flex-row justify-between items-center pt-2 mt-2 border-t border-gray-200">
                <Text className="text-base font-bold text-gray-800">Total:</Text>
                <Text className="text-lg font-bold text-blue-500">₹{calculateTotal().toFixed(2)}</Text>
              </View>
            </View>
          )}

          {/* Scanned Items */}
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-800 mb-3">
              Scanned Items ({scannedItems.length})
            </Text>
            {scannedItems.length === 0 ? (
              <EmptyList />
            ) : (
              scannedItems.map(renderItemCard)
            )}
          </View>
        </View>
      </ScrollView>

      {/* Checkout Button */}
      {scannedItems.length > 0 && (
        <View className="bg-white px-4 py-4 border-t border-gray-200">
          <TouchableOpacity 
            className="flex-row items-center justify-center bg-blue-500 px-6 py-4 rounded-xl gap-2"
            onPress={proceedToCheckout}
          >
            <Text className="text-white text-base font-semibold">
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
        <View className="absolute inset-0 bg-black/70 justify-center items-center z-50">
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text className="text-white text-base mt-4 font-semibold">Processing...</Text>
        </View>
      )}
    </View>
  );
}