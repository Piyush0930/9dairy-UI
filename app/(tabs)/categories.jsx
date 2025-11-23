import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useProfile } from "@/contexts/ProfileContext";
import { Feather, FontAwesome, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
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

const getImageSource = (imageName) => {
  if (
    imageName &&
    (imageName.startsWith("http") || imageName.startsWith("https"))
  ) {
    return { uri: imageName };
  }

  const imageMap = {
    "MilkCategory.png": require("../../assets/images/MilkCategory.png"),
    "ButterCategoryCategory.png": require("../../assets/images/ButterCategoryCategory.png"),
    "CheeseCategory.jpg": require("../../assets/images/CheeseCategory.jpg"),
    "Paneer.png": require("../../assets/images/Paneer.png"),
    "DahiCategory.png": require("../../assets/images/DahiCategory.png"),
    "IcecreamCategory.jpg": require("../../assets/images/IcecreamCategory.jpg"),
    "GheeCategory.png": require("../../assets/images/GheeCategory.png"),
    "CreamCategory.png": require("../../assets/images/CreamCategory.png"),
    "buttermilk.png": require("../../assets/images/butter.png"),
    "LassiCategory.png": require("../../assets/images/LassiCategory.png"),
    "flavored-milk.png": require("../../assets/images/milk.png"),
    "Dairy-SweetCategory.png": require("../../assets/images/Dairy-SweetCategory.png"),
  };
  return imageMap[imageName] || require("../../assets/images/MilkCategory.png");
};

const { width } = Dimensions.get("window");

export default function CategoriesScreen() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showSortModal, setShowSortModal] = useState(false);
  const [sortOption, setSortOption] = useState("relevance");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const { getTotalItems, items, addToCart, removeFromCart, getItemQuantity } =
    useCart();
  const cartCount = getTotalItems();
  const insets = useSafeAreaInsets();

  const { authToken } = useAuth();
  const token = authToken;
  const { assignedRetailer } = useProfile();

  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/catalog/categories`);
      const data = await response.json();
      return response.ok && Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("Error fetching categories:", error);
      return [];
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/catalog/products`);
      const data = await response.json();
      return response.ok && Array.isArray(data) ? data : [];
    } catch (error) {
      console.error("Error fetching products:", error);
      return [];
    }
  };

  const fetchInventory = async () => {
    try {
      if (!token) {
        console.log("Inventory fetch skipped (no token)");
        return [];
      }

      const res = await fetch(`${API_BASE_URL}/customer/inventory`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json();
      return res.ok ? payload?.data?.inventory || [] : [];
    } catch (err) {
      console.error("Inventory fetch error:", err);
      return [];
    }
  };

  // Enhanced pricing calculation with null checks
  const calculateProductPricing = (product, inventoryItem, currentCartQuantity = 0) => {
    if (!product) {
      console.warn("calculateProductPricing called with null product");
      return {
        basePrice: 0,
        currentPrice: 0,
        hasDiscount: false,
        discountPercentage: 0,
        savings: 0,
        bulkPricingTiers: [],
        currentAppliedSlab: null,
        totalCartQuantity: currentCartQuantity,
        isExtendedRange: false,
        singlePieceDiscount: false
      };
    }

    const basePrice = inventoryItem?.sellingPrice || product.price || 0;
    let currentPrice = basePrice;
    let hasDiscount = false;
    let discountPercentage = 0;
    let savings = 0;
    const bulkPricingTiers = [];
    let currentAppliedSlab = null;
    let isExtendedRange = false;
    let singlePieceDiscount = false;
    let singlePieceDiscountPercentage = 0;

    // Get active pricing slabs
    if (inventoryItem?.enableQuantityPricing && inventoryItem.pricingSlabs) {
      const activeSlabs = inventoryItem.pricingSlabs
        .filter(slab => slab.isActive)
        .sort((a, b) => a.minQuantity - b.minQuantity);

      // Check for single piece discount (minQuantity = 1)
      const singlePieceSlab = activeSlabs.find(slab => slab.minQuantity === 1);
      if (singlePieceSlab) {
        singlePieceDiscount = true;
        singlePieceDiscountPercentage = singlePieceSlab.discountType === 'PERCENTAGE' 
          ? singlePieceSlab.discountValue 
          : Math.round(((basePrice - (basePrice - singlePieceSlab.discountValue)) / basePrice) * 100);
        
        if (singlePieceSlab.discountType === 'FLAT') {
          currentPrice = Math.max(0, basePrice - singlePieceSlab.discountValue);
        } else if (singlePieceSlab.discountType === 'PERCENTAGE') {
          const discountAmount = (basePrice * singlePieceSlab.discountValue) / 100;
          currentPrice = Math.max(0, basePrice - discountAmount);
        }
        
        hasDiscount = currentPrice < basePrice;
        discountPercentage = singlePieceDiscountPercentage;
      }

      if (activeSlabs.length > 0) {
        // Find applicable slab - with extended range logic
        let applicableSlab = activeSlabs.find(slab => 
          currentCartQuantity >= slab.minQuantity && currentCartQuantity <= slab.maxQuantity
        );

        // ✅ EXTENDED RANGE LOGIC: Use last slab if quantity exceeds all ranges
        if (!applicableSlab && currentCartQuantity > 0) {
          applicableSlab = activeSlabs[activeSlabs.length - 1];
          isExtendedRange = currentCartQuantity >= applicableSlab.minQuantity;
          
          if (!isExtendedRange) {
            applicableSlab = null;
          }
        }

        if (applicableSlab && applicableSlab.minQuantity > 1) {
          currentAppliedSlab = applicableSlab;
          
          if (applicableSlab.discountType === 'FLAT') {
            currentPrice = Math.max(0, basePrice - applicableSlab.discountValue);
          } else if (applicableSlab.discountType === 'PERCENTAGE') {
            const discountAmount = (basePrice * applicableSlab.discountValue) / 100;
            currentPrice = Math.max(0, basePrice - discountAmount);
          }
          
          hasDiscount = currentPrice < basePrice;
          discountPercentage = applicableSlab.discountType === 'PERCENTAGE' 
            ? applicableSlab.discountValue 
            : Math.round(((basePrice - currentPrice) / basePrice) * 100);
          savings = (basePrice - currentPrice) * currentCartQuantity;
        }

        // Create bulk pricing tiers for display - with extended range info
        const tierQuantities = [1, 6, 15];
        
        tierQuantities.forEach(quantity => {
          let applicableTierSlab = activeSlabs.find(slab => 
            quantity >= slab.minQuantity && quantity <= slab.maxQuantity
          );

          if (!applicableTierSlab && quantity > activeSlabs[activeSlabs.length - 1].maxQuantity) {
            applicableTierSlab = activeSlabs[activeSlabs.length - 1];
          }

          let discountedPrice = basePrice;
          let tierDiscountPercentage = 0;
          let tierSavings = 0;
          let tierIsExtendedRange = false;

          if (applicableTierSlab) {
            tierIsExtendedRange = quantity > applicableTierSlab.maxQuantity;
            
            if (applicableTierSlab.discountType === 'FLAT') {
              discountedPrice = Math.max(0, basePrice - applicableTierSlab.discountValue);
            } else if (applicableTierSlab.discountType === 'PERCENTAGE') {
              const discountAmount = (basePrice * applicableTierSlab.discountValue) / 100;
              discountedPrice = Math.max(0, basePrice - discountAmount);
            }
            tierDiscountPercentage = applicableTierSlab.discountType === 'PERCENTAGE' 
              ? applicableTierSlab.discountValue 
              : Math.round(((basePrice - discountedPrice) / basePrice) * 100);
            tierSavings = (basePrice - discountedPrice) * quantity;
          }

          bulkPricingTiers.push({
            quantity,
            pricePerPiece: Math.round(discountedPrice * 100) / 100,
            totalPrice: Math.round(discountedPrice * quantity * 100) / 100,
            savings: Math.round(tierSavings * 100) / 100,
            discountPercentage: Math.round(tierDiscountPercentage),
            slabRange: tierIsExtendedRange ? `${quantity}+ pieces` : `${quantity} piece${quantity > 1 ? 's' : ''}`,
            hasDiscount: applicableTierSlab !== null,
            isExtendedRange: tierIsExtendedRange
          });
        });
      }
    } else {
      // For non-discount products, show same price for all tiers
      const tierQuantities = [1, 6, 15];
      tierQuantities.forEach(quantity => {
        bulkPricingTiers.push({
          quantity,
          pricePerPiece: basePrice,
          totalPrice: Math.round(basePrice * quantity * 100) / 100,
          savings: 0,
          discountPercentage: 0,
          slabRange: `${quantity} piece${quantity > 1 ? 's' : ''}`,
          hasDiscount: false,
          isExtendedRange: false
        });
      });
    }

    return {
      basePrice,
      currentPrice: Math.round(currentPrice * 100) / 100,
      hasDiscount,
      discountPercentage,
      savings: Math.round(savings * 100) / 100,
      bulkPricingTiers,
      currentAppliedSlab,
      totalCartQuantity: currentCartQuantity,
      isExtendedRange,
      singlePieceDiscount
    };
  };

  const attachInventoryToProducts = (products, inventory) => {
    if (!Array.isArray(products)) return [];
    if (!Array.isArray(inventory)) return products;

    const inventoryMap = new Map();
    
    inventory.forEach(inv => {
      const product = inv?.product;
      if (!product) return;
      
      const productId = product?.id || product?._id;
      
      if (productId) {
        inventoryMap.set(productId, {
          ...inv,
          currentStock: inv.currentStock,
          sellingPrice: inv.sellingPrice,
          isActive: inv.isActive,
          enableQuantityPricing: inv.enableQuantityPricing,
          pricingSlabs: inv.pricingSlabs || [],
          soldByRetailer: true
        });
      }
    });

    return products.map(product => {
      const productId = product?.id || product?._id;
      
      let matchedInventory = null;
      
      if (productId && inventoryMap.has(productId)) {
        matchedInventory = inventoryMap.get(productId);
      }
      
      const soldByRetailer = matchedInventory !== null;
      const retailerStock = matchedInventory?.currentStock;
      const isOutOfStock = soldByRetailer && retailerStock !== undefined && Number(retailerStock) <= 0;
      
      return {
        ...product,
        _inventory: matchedInventory,
        outOfStock: isOutOfStock,
        basePrice: matchedInventory?.sellingPrice || product.price || 0,
        stock: product?.stock,
        currentStock: matchedInventory?.currentStock,
        soldByRetailer: soldByRetailer,
        retailerPrice: matchedInventory?.sellingPrice,
        availableFromRetailer: soldByRetailer && !isOutOfStock,
        availableFromCatalog: !soldByRetailer,
      };
    });
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [categoriesData, productsData, inventoryData] = await Promise.all([
          fetchCategories(),
          fetchProducts(),
          fetchInventory(),
        ]);

        setCategories(categoriesData);
        const productsWithInventory = attachInventoryToProducts(productsData, inventoryData);
        setProducts(productsWithInventory);
        setInventory(inventoryData);

      } catch (error) {
        console.error("Error fetching data:", error);
        const productsData = await fetchProducts();
        setProducts(productsData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, assignedRetailer]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const [categoriesData, productsData, inventoryData] = await Promise.all([
        fetchCategories(),
        fetchProducts(),
        fetchInventory(),
      ]);

      setCategories(categoriesData);
      const productsWithInventory = attachInventoryToProducts(productsData, inventoryData);
      setProducts(productsWithInventory);
      setInventory(inventoryData);

    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  let filteredProducts =
    selectedCategory === "all"
      ? products
      : products.filter((p) => p.category?._id?.toString() === selectedCategory);

  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredProducts = filteredProducts.filter((p) =>
      p.name.toLowerCase().includes(query)
    );
  }

  if (sortOption === "pricelow") {
    filteredProducts = [...filteredProducts].sort((a, b) => a.basePrice - b.basePrice);
  } else if (sortOption === "pricehigh") {
    filteredProducts = [...filteredProducts].sort((a, b) => b.basePrice - a.basePrice);
  } else if (sortOption === "rating") {
    filteredProducts = [...filteredProducts].sort(
      (a, b) => (b.rating?.average || 0) - (a.rating?.average || 0)
    );
  }

  const handleAddToCart = (product, quantity = 1) => {
    if (!product) {
      console.warn("Attempted to add null product to cart");
      return;
    }

    if (product.outOfStock) {
      Alert.alert("Out of stock", "This product is currently out of stock.");
      return;
    }
    
    if (!product.soldByRetailer) {
      Alert.alert(
        "Product Not Available", 
        "This product is not available from your assigned retailer.",
        [{ text: "OK" }]
      );
      return;
    }
    
    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }
  };

  const getAvailabilityStatus = (product) => {
    if (!product) return 'not_available';
    if (!product.soldByRetailer) return 'not_available';
    if (product.outOfStock) return 'out_of_stock';
    return 'available';
  };

  const openProductDetail = (product) => {
    if (!product) {
      console.warn("Attempted to open null product detail");
      return;
    }
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const getSimilarProducts = (currentProduct) => {
    if (!currentProduct) return [];
    return products
      .filter(product => 
        product._id !== currentProduct._id && 
        product.category?._id === currentProduct.category?._id &&
        getAvailabilityStatus(product) === 'available'
      )
      .slice(0, 4);
  };

  // Product Card Component
  const ProductCard = ({ product }) => {
    if (!product) {
      console.warn("ProductCard rendered with null product");
      return null;
    }

    const cartQuantity = getItemQuantity(product._id);
    const pricing = calculateProductPricing(product, product._inventory, cartQuantity);
    const availabilityStatus = getAvailabilityStatus(product);
    const [savingsScale] = useState(new Animated.Value(1));
    const [savingsOpacity] = useState(new Animated.Value(0));
    const [buttonScale] = useState(new Animated.Value(1));

    // Enhanced animation for savings pop effect - Show for single piece discount too
    useEffect(() => {
      if (pricing.savings > 0 || (pricing.singlePieceDiscount && cartQuantity > 0)) {
        savingsOpacity.setValue(0);
        savingsScale.setValue(0.8);
        
        Animated.parallel([
          Animated.spring(savingsScale, {
            toValue: 1,
            tension: 100,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(savingsOpacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          })
        ]).start();
      } else {
        Animated.timing(savingsOpacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    }, [pricing.savings, pricing.singlePieceDiscount, cartQuantity]);

    const animateButton = () => {
      Animated.sequence([
        Animated.spring(buttonScale, {
          toValue: 0.95,
          tension: 100,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(buttonScale, {
          toValue: 1,
          tension: 100,
          friction: 5,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const handleAddPress = () => {
      animateButton();
      handleAddToCart(product);
    };

    const handleRemovePress = () => {
      animateButton();
      removeFromCart(product._id);
    };

    // Calculate savings for single piece discount
    const singlePieceSavings = pricing.singlePieceDiscount && cartQuantity > 0 
      ? (pricing.basePrice - pricing.currentPrice) * cartQuantity 
      : 0;

    return (
      <TouchableOpacity 
        className="bg-white rounded-xl p-4 mx-1 shadow-sm shadow-black min-h-[220px] relative"
        onPress={() => openProductDetail(product)}
        activeOpacity={0.9}
      >
        {/* Blue Discount Badge - Top Right Corner */}
        {pricing.hasDiscount && availabilityStatus === 'available' && (
          <View className="absolute right-3 top-3 bg-blue-500 px-3 py-1.5 rounded-lg z-10 shadow-sm shadow-black items-center">
            <Text className="text-white text-xs font-extrabold">
              {pricing.discountPercentage}% OFF
            </Text>
            {pricing.isExtendedRange && (
              <Text className="text-white text-[8px] font-bold mt-0.5 opacity-90">
                EXTENDED
              </Text>
            )}
          </View>
        )}

        {/* Status Badge - Short Titles */}
        {availabilityStatus === 'out_of_stock' && (
          <View className="absolute right-3 top-3 bg-red-500 px-2.5 py-1.5 rounded-lg z-10">
            <Text className="text-white text-[10px] font-bold">OUT OF STOCK</Text>
          </View>
        )}
        {availabilityStatus === 'not_available' && (
          <View className="absolute right-3 top-3 bg-yellow-500 px-2.5 py-1.5 rounded-lg z-10">
            <Text className="text-white text-[10px] font-bold">NOT AVAILABLE</Text>
          </View>
        )}

        {/* Product Content */}
        <View className="flex-row gap-4 mt-2">
          <View className="flex-1 justify-between">
            <Text className="text-base font-semibold text-gray-900 mb-1 leading-[22px]">{product.name}</Text>
            <Text className="text-sm text-gray-600 mb-3">{product.unit}</Text>

            {/* Dynamic Price Display */}
            <View className="mb-3">
              <View className="flex-row items-center gap-2 mb-3">
                <Text className="text-xl font-bold text-gray-900">₹{pricing.currentPrice}</Text>
                {pricing.hasDiscount && pricing.currentPrice < pricing.basePrice && (
                  <Text className="text-base text-gray-600 line-through">₹{pricing.basePrice}</Text>
                )}
              </View>
              
              {/* Savings Badge - Show for both single piece and bulk discounts */}
              {(pricing.savings > 0 || singlePieceSavings > 0) && (
                <Animated.View 
                  className="bg-green-50 px-3 py-1.5 rounded-full border border-green-200 self-start"
                  style={{ 
                    transform: [{ scale: savingsScale }],
                    opacity: savingsOpacity 
                  }}
                >
                  <Text className="text-emerald-800 text-xs font-semibold">
                    You saved ₹{pricing.savings > 0 ? pricing.savings : singlePieceSavings}
                  </Text>
                </Animated.View>
              )}
            </View>
          </View>

          <View className="items-center justify-between">
            {product.image || product.imageUrl ? (
              <Image
                source={getImageSource(product.image || product.imageUrl)}
                className="w-[90px] h-[90px] rounded-lg bg-gray-100"
                resizeMode="cover"
              />
            ) : (
              <View className="w-[90px] h-[90px] bg-gray-100 rounded-lg justify-center items-center">
                <Text className="text-2xl">📦</Text>
              </View>
            )}
            
            {/* Quantity Controls - Below Image */}
            {availabilityStatus === 'available' && (
              <View className="mt-3 w-full items-center">
                {cartQuantity > 0 ? (
                  <Animated.View 
                    className="flex-row items-center justify-between bg-blue-50 rounded-lg px-3 py-2 w-[120px]"
                    style={{ transform: [{ scale: buttonScale }] }}
                  >
                    <TouchableOpacity 
                      className="p-1" 
                      onPress={handleRemovePress}
                    >
                      <Ionicons name="remove" size={20} color={Colors.light.tint} />
                    </TouchableOpacity>
                    <Text className="text-base font-semibold text-gray-900 min-w-[30px] text-center">{cartQuantity}</Text>
                    <TouchableOpacity 
                      className="p-1" 
                      onPress={handleAddPress}
                    >
                      <Ionicons name="add" size={20} color={Colors.light.tint} />
                    </TouchableOpacity>
                  </Animated.View>
                ) : (
                  <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                    <TouchableOpacity
                      className="bg-red-50 rounded-lg py-2.5 px-4 items-center w-[80px]"
                      onPress={handleAddPress}
                      activeOpacity={0.7}
                    >
                      <Text className="text-sm font-bold text-red-700">ADD</Text>
                    </TouchableOpacity>
                  </Animated.View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Bulk Pricing Tiers */}
        {availabilityStatus === 'available' && pricing.bulkPricingTiers.length > 0 && (
          <View className="mt-4 p-3 bg-gray-50 rounded-lg">
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-sm font-semibold text-gray-900">BULK SAVINGS</Text>
              {pricing.isExtendedRange && (
                <View className="flex-row items-center bg-blue-50 px-2 py-1 rounded gap-1">
                  <Ionicons name="infinite" size={12} color="#3B82F6" />
                  <Text className="text-[10px] text-blue-500 font-semibold">
                    Extended discounts
                  </Text>
                </View>
              )}
            </View>
            {pricing.bulkPricingTiers.filter(tier => tier.quantity > 1).map((tier, index) => (
              <View key={index}>
                <View className="flex-row justify-between items-center py-2">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Text className="text-sm font-semibold text-blue-900">
                        ₹{tier.pricePerPiece}/pc for {tier.slabRange}
                      </Text>
                      {tier.isExtendedRange && (
                        <View className="bg-blue-500 px-1.5 py-0.5 rounded">
                          <Text className="text-white text-[8px] font-bold">EXTENDED</Text>
                        </View>
                      )}
                    </View>
                    {tier.hasDiscount && (
                      <Text className="text-xs text-green-600 font-semibold">
                        {tier.discountPercentage}% OFF • Save ₹{tier.savings}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    className={`bg-red-50 px-3 py-1.5 rounded min-w-[70px] ${tier.isExtendedRange ? 'bg-blue-50' : ''}`}
                    onPress={() => handleAddToCart(product, tier.quantity)}
                  >
                    <Text className="text-red-700 font-semibold text-xs text-center">
                      ADD {tier.quantity}
                    </Text>
                  </TouchableOpacity>
                </View>
                {index < pricing.bulkPricingTiers.filter(tier => tier.quantity > 1).length - 1 && (
                  <View className="h-px bg-gray-300 my-1.5" />
                )}
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // Product Detail Modal Component
  const ProductDetailModal = ({ product, visible, onClose }) => {
    if (!product) {
      return (
        <Modal
          visible={visible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={onClose}
        >
          <View className="flex-1 bg-white">
            <View className="flex-row justify-end p-4 pt-16">
              <TouchableOpacity onPress={onClose} className="w-10 h-10 rounded-full bg-gray-200 justify-center items-center">
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <View className="p-5">
              <Text className="text-base text-gray-600 text-center mt-5">Product information not available</Text>
            </View>
          </View>
        </Modal>
      );
    }

    const cartQuantity = getItemQuantity(product._id);
    const pricing = calculateProductPricing(product, product._inventory, cartQuantity);
    const availabilityStatus = getAvailabilityStatus(product);
    const similarProducts = getSimilarProducts(product);
    const [buttonScale] = useState(new Animated.Value(1));

    const animateButton = () => {
      Animated.sequence([
        Animated.spring(buttonScale, {
          toValue: 0.95,
          tension: 100,
          friction: 5,
          useNativeDriver: true,
        }),
        Animated.spring(buttonScale, {
          toValue: 1,
          tension: 100,
          friction: 5,
          useNativeDriver: true,
        }),
      ]).start();
    };

    const handleAddPress = () => {
      animateButton();
      handleAddToCart(product);
    };

    const handleRemovePress = () => {
      animateButton();
      removeFromCart(product._id);
    };

    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View className="flex-1 bg-white">
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            {/* Header with Close Button */}
            <View className="flex-row justify-end p-4 pt-16">
              <TouchableOpacity onPress={onClose} className="w-10 h-10 rounded-full bg-gray-200 justify-center items-center">
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            {/* Product Image */}
            <View className="h-[300px] justify-center items-center bg-gray-50">
              {product.image || product.imageUrl ? (
                <Image
                  source={getImageSource(product.image || product.imageUrl)}
                  className="w-4/5 h-4/5 rounded-xl"
                  resizeMode="contain"
                />
              ) : (
                <View className="w-[200px] h-[200px] bg-gray-300 rounded-xl justify-center items-center">
                  <Text className="text-5xl">📦</Text>
                </View>
              )}
            </View>

            {/* Product Info */}
            <View className="p-5">
              <View className="flex-row justify-between items-start mb-4">
                <View className="flex-1 mr-4">
                  <Text className="text-2xl font-bold text-gray-900 mb-1">{product.name}</Text>
                  <Text className="text-base text-gray-600">{product.unit}</Text>
                </View>
                
                {/* Price and Add Counter - Top Right */}
                <View className="items-end min-w-[120px]">
                  <View className="items-end mb-3">
                    <Text className="text-3xl font-bold text-gray-900">₹{pricing.currentPrice}</Text>
                    {pricing.hasDiscount && pricing.currentPrice < pricing.basePrice && (
                      <Text className="text-xl text-gray-600 line-through">₹{pricing.basePrice}</Text>
                    )}
                  </View>

                  {/* Add to Cart Controls */}
                  {availabilityStatus === 'available' && (
                    <View className="mb-0">
                      {cartQuantity > 0 ? (
                        <Animated.View 
                          className="flex-row items-center justify-between bg-blue-50 rounded-lg px-3 py-2 w-[120px]"
                          style={{ transform: [{ scale: buttonScale }] }}
                        >
                          <TouchableOpacity 
                            className="p-1" 
                            onPress={handleRemovePress}
                          >
                            <Ionicons name="remove" size={20} color={Colors.light.tint} />
                          </TouchableOpacity>
                          <Text className="text-base font-semibold text-gray-900 min-w-[30px] text-center">{cartQuantity}</Text>
                          <TouchableOpacity 
                            className="p-1" 
                            onPress={handleAddPress}
                          >
                            <Ionicons name="add" size={20} color={Colors.light.tint} />
                          </TouchableOpacity>
                        </Animated.View>
                      ) : (
                        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                          <TouchableOpacity
                            className="bg-red-50 rounded-lg py-2.5 px-4 items-center w-[80px]"
                            onPress={handleAddPress}
                            activeOpacity={0.7}
                          >
                            <Text className="text-sm font-bold text-red-700">ADD</Text>
                          </TouchableOpacity>
                        </Animated.View>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {pricing.hasDiscount && (
                <View className="bg-blue-500 px-3 py-1.5 rounded-lg self-start mb-5">
                  <Text className="text-white text-sm font-bold">
                    {pricing.discountPercentage}% OFF
                  </Text>
                </View>
              )}

              {/* Bulk Savings Section */}
              {availabilityStatus === 'available' && pricing.bulkPricingTiers.length > 0 && (
                <View className="bg-gray-50 rounded-xl p-4 mb-6">
                  <Text className="text-lg font-bold text-gray-900 mb-4">Bulk Savings</Text>
                  {pricing.bulkPricingTiers.map((tier, index) => (
                    <View key={index} className="flex-row justify-between items-center py-3 border-b border-gray-300">
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-gray-900 mb-1">{tier.slabRange}</Text>
                        <Text className="text-sm font-semibold text-blue-900 mb-1">₹{tier.pricePerPiece}/piece</Text>
                        {tier.hasDiscount && (
                          <Text className="text-xs text-green-600 font-medium">
                            Save {tier.discountPercentage}% • ₹{tier.savings} total
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        className="bg-red-50 px-3 py-2 rounded-lg"
                        onPress={() => handleAddToCart(product, tier.quantity)}
                      >
                        <Text className="text-red-700 font-semibold text-sm">
                          ADD {tier.quantity}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Description */}
              <View className="mb-6">
                <Text className="text-lg font-bold text-gray-900 mb-3">Description</Text>
                <Text className="text-base text-gray-600 leading-6">
                  {product.description || 'No description available for this product.'}
                </Text>
              </View>

              {/* Similar Products - Larger Cards */}
              {similarProducts.length > 0 && (
                <View className="mb-[100px]">
                  <Text className="text-lg font-bold text-gray-900 mb-3">Similar Products</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row gap-4">
                      {similarProducts.map(similarProduct => {
                        const similarPricing = calculateProductPricing(similarProduct, similarProduct._inventory);
                        const similarCartQuantity = getItemQuantity(similarProduct._id);
                        
                        return (
                          <View key={similarProduct._id} className="w-[200px] bg-white rounded-xl p-3 shadow-sm shadow-black">
                            <TouchableOpacity 
                              onPress={() => {
                                setSelectedProduct(similarProduct);
                              }}
                              activeOpacity={0.7}
                            >
                              <Image
                                source={getImageSource(similarProduct.image || similarProduct.imageUrl)}
                                className="w-full h-[120px] rounded-lg mb-2"
                                resizeMode="cover"
                              />
                              <View className="flex-1">
                                <Text className="text-sm font-semibold text-gray-900 mb-1 h-10" numberOfLines={2}>
                                  {similarProduct.name}
                                </Text>
                                <Text className="text-xs text-gray-600 mb-2">{similarProduct.unit}</Text>
                                <View className="flex-row items-center gap-2 mb-2">
                                  <Text className="text-base font-bold text-gray-900">
                                    ₹{similarPricing.currentPrice}
                                  </Text>
                                  {similarPricing.hasDiscount && similarPricing.currentPrice < similarPricing.basePrice && (
                                    <Text className="text-sm text-gray-600 line-through">
                                      ₹{similarPricing.basePrice}
                                    </Text>
                                  )}
                                </View>
                                
                                {/* Add to Cart in Similar Products */}
                                <View className="mb-2">
                                  {similarCartQuantity > 0 ? (
                                    <View className="flex-row items-center justify-between bg-blue-50 rounded px-2 py-1.5">
                                      <TouchableOpacity 
                                        className="p-0.5" 
                                        onPress={() => removeFromCart(similarProduct._id)}
                                      >
                                        <Ionicons name="remove" size={16} color={Colors.light.tint} />
                                      </TouchableOpacity>
                                      <Text className="text-sm font-semibold text-gray-900 min-w-[20px] text-center">{similarCartQuantity}</Text>
                                      <TouchableOpacity 
                                        className="p-0.5" 
                                        onPress={() => handleAddToCart(similarProduct)}
                                      >
                                        <Ionicons name="add" size={16} color={Colors.light.tint} />
                                      </TouchableOpacity>
                                    </View>
                                  ) : (
                                    <TouchableOpacity
                                      className="bg-red-50 rounded px-3 py-2 items-center"
                                      onPress={() => handleAddToCart(similarProduct)}
                                      activeOpacity={0.7}
                                    >
                                      <Text className="text-xs font-bold text-red-700">ADD</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>

                                {/* Bulk Pricing in Similar Products */}
                                {similarPricing.bulkPricingTiers.length > 0 && similarPricing.bulkPricingTiers.some(tier => tier.quantity > 1) && (
                                  <View className="mt-2">
                                    <Text className="text-xs font-semibold text-gray-900 mb-1">Bulk Save</Text>
                                    {similarPricing.bulkPricingTiers
                                      .filter(tier => tier.quantity > 1)
                                      .slice(0, 2)
                                      .map((tier, tierIndex) => (
                                        <TouchableOpacity
                                          key={tierIndex}
                                          className="bg-gray-50 py-1.5 px-2 rounded mb-1"
                                          onPress={() => handleAddToCart(similarProduct, tier.quantity)}
                                        >
                                          <Text className="text-[10px] font-semibold text-blue-900 text-center">
                                            ADD {tier.quantity} • ₹{tier.pricePerPiece}/pc
                                          </Text>
                                        </TouchableOpacity>
                                      ))}
                                  </View>
                                )}
                              </View>
                            </TouchableOpacity>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}
            </View>
          </ScrollView>

          {/* Fixed Continue to Cart Button - Solid Red */}
          {cartQuantity > 0 && (
            <View className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-300">
              <TouchableOpacity 
                className="bg-red-600 rounded-xl py-4 px-6 items-center"
                onPress={() => {
                  onClose();
                  router.push("/cart");
                }}
              >
                <Text className="text-white text-base font-bold">
                  Continue to Cart • {cartQuantity} items • ₹{pricing.currentPrice * cartQuantity}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    );
  };

  return (
    <View className="flex-1 bg-gray-50" style={{ paddingTop: insets.top }}>
      <View className="bg-white pb-3">
        <View className="flex-row justify-between items-center px-4 pt-3 pb-4">
          <Text className="text-2xl font-bold text-gray-900">My List</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              className="w-12 h-12 rounded-full bg-gray-50 justify-center items-center"
              onPress={() => setShowSearch(!showSearch)}
              activeOpacity={0.7}
            >
              <Ionicons name="search" size={24} color="#1A1A1A" />
            </TouchableOpacity>
            <TouchableOpacity
              className="w-12 h-12 rounded-full bg-gray-50 justify-center items-center relative"
              onPress={() => router.push("/cart")}
            >
              <Ionicons name="cart-outline" size={24} color="#1A1A1A" />
              {cartCount > 0 && (
                <View className="absolute top-2 right-2 bg-blue-500 rounded-xl min-w-[20px] h-5 justify-center items-center">
                  <Text className="text-white text-[11px] font-bold">{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {showSearch && (
          <View className="flex-row items-center bg-gray-50 rounded-xl mx-4 mb-2 px-4 py-3 gap-2">
            <TextInput
              className="flex-1 text-base text-gray-900"
              placeholder="Search products..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={Colors.light.textSecondary}
            />
            <TouchableOpacity className="p-1">
              <Ionicons
                name="search"
                size={20}
                color={Colors.light.textSecondary}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Compact Save Tip */}
        <View className="bg-amber-50 py-2 px-3 mx-4 rounded-lg mb-3">
          <Text className="text-xs text-amber-900 font-medium text-center">
            💰 Save more with quantity discounts - Extended discounts apply automatically!
          </Text>
        </View>

        <View className="flex-row px-4 gap-2 items-center">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-row gap-2"
          >
            <TouchableOpacity
              className="flex-row items-center bg-white border border-gray-300 rounded-full py-2.5 px-3.5 gap-1.5"
              onPress={() => setShowSortModal(true)}
              activeOpacity={0.7}
            >
              <Text className="text-[13px] font-semibold text-gray-900">Sort</Text>
              <Text className="text-[10px] text-gray-600">▼</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-row items-center bg-white border border-gray-300 rounded-full py-2.5 px-3.5 gap-1.5"
              onPress={() => console.log("Rated 4.0+ filter toggled")}
              activeOpacity={0.7}
            >
              <FontAwesome name="star" size={14} color="#F59E0B" />
              <Text className="text-[13px] font-semibold text-gray-900">Rated 4.0+</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      <View className="flex-1 flex-row">
        <View className="w-[90px] bg-white">
          <ScrollView
            showsVerticalScrollIndicator={false}
            className="py-2"
          >
            <TouchableOpacity
              className={`items-center py-3 px-1.5 ${selectedCategory === "all" ? 'bg-pink-50' : ''}`}
              onPress={() => setSelectedCategory("all")}
              activeOpacity={0.7}
            >
              <View className="w-[52px] h-[52px] rounded-xl justify-center items-center mb-1.5">
                <Text className="text-2xl">📦</Text>
              </View>
              <Text
                className={`text-[10px] font-medium text-gray-600 text-center leading-[13px] ${selectedCategory === "all" ? 'text-gray-900 font-bold' : ''}`}
              >
                All
              </Text>
            </TouchableOpacity>

            {categories.map((category, index) => (
              <TouchableOpacity
                key={`category-${category._id}-${index}`}
                className={`items-center py-3 px-1.5 ${selectedCategory === category._id ? 'bg-pink-50' : ''}`}
                onPress={() => setSelectedCategory(category._id)}
                activeOpacity={0.7}
              >
                <View
                  className="w-[52px] h-[52px] rounded-xl justify-center items-center mb-1.5"
                  style={{ backgroundColor: category.color || "#E3F2FD" }}
                >
                  <Image
                    source={getImageSource(category.image)}
                    className="w-full h-full rounded-xl"
                    resizeMode="cover"
                  />
                </View>
                <Text
                  className={`text-[10px] font-medium text-gray-600 text-center leading-[13px] ${selectedCategory === category._id ? 'text-gray-900 font-bold' : ''}`}
                  numberOfLines={3}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View className="flex-1">
          <ScrollView
            showsVerticalScrollIndicator={false}
            className="px-1 pb-[100px] gap-2"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))
            ) : (
              <View className="bg-white rounded-xl p-6 mx-2 flex-row gap-4 items-center">
                <View className="w-[60px] h-[60px] bg-gray-100 rounded-xl justify-center items-center">
                  <Text className="text-3xl">🔍</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900 mb-1">
                    Looking for something else?
                  </Text>
                  <Text className="text-[13px] text-gray-600 mb-3">
                    Tell us and we'll add it to the shop
                  </Text>
                  <TouchableOpacity
                    className="border-2 border-blue-500 rounded-lg py-2.5 px-4 self-start"
                    onPress={() => console.log("Request a product clicked")}
                    activeOpacity={0.8}
                  >
                    <Text className="text-sm font-bold text-blue-500">
                      Request a product
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* Sort Modal */}
      <Modal
        visible={showSortModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSortModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl pb-10">
            <View className="flex-row justify-between items-center p-5 border-b border-gray-300">
              <Text className="text-xl font-bold text-gray-900">Sort by</Text>
              <TouchableOpacity
                onPress={() => setShowSortModal(false)}
                className="p-1"
                activeOpacity={0.7}
              >
                <Feather name="x" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
            <View className="p-4 gap-2">
              {["relevance", "pricelow", "pricehigh", "rating"].map((option) => (
                <TouchableOpacity
                  key={option}
                  className={`py-4 px-5 rounded-xl bg-gray-50 ${sortOption === option ? 'bg-pink-50 border-2 border-blue-500' : ''}`}
                  onPress={() => {
                    setSortOption(option);
                    setShowSortModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-base font-medium text-gray-900 ${sortOption === option ? 'font-bold text-blue-500' : ''}`}
                  >
                    {option === "pricelow" && "Price: Low to High"}
                    {option === "pricehigh" && "Price: High to Low"}
                    {option === "rating" && "Rating"}
                    {option === "relevance" && "Relevance"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        visible={showProductModal}
        onClose={() => setShowProductModal(false)}
      />
    </View>
  );
}