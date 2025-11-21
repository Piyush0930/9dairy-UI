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
  StyleSheet,
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
        style={styles.productCard}
        onPress={() => openProductDetail(product)}
        activeOpacity={0.9}
      >
        {/* Blue Discount Badge - Top Right Corner */}
        {pricing.hasDiscount && availabilityStatus === 'available' && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>
              {pricing.discountPercentage}% OFF
            </Text>
            {pricing.isExtendedRange && (
              <Text style={styles.extendedRangeText}>EXTENDED</Text>
            )}
          </View>
        )}

        {/* Status Badge - Short Titles */}
        {availabilityStatus === 'out_of_stock' && (
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>OUT OF STOCK</Text>
          </View>
        )}
        {availabilityStatus === 'not_available' && (
          <View style={[styles.statusBadge, styles.notAvailableBadge]}>
            <Text style={styles.statusBadgeText}>NOT AVAILABLE</Text>
          </View>
        )}

        {/* Product Content */}
        <View style={styles.productContent}>
          <View style={styles.productLeft}>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productUnit}>{product.unit}</Text>

            {/* Dynamic Price Display */}
            <View style={styles.mainPriceContainer}>
              <View style={styles.priceRow}>
                <Text style={styles.price}>₹{pricing.currentPrice}</Text>
                {pricing.hasDiscount && pricing.currentPrice < pricing.basePrice && (
                  <Text style={styles.priceOriginal}>₹{pricing.basePrice}</Text>
                )}
              </View>
              
              {/* Savings Badge - Show for both single piece and bulk discounts */}
              {(pricing.savings > 0 || singlePieceSavings > 0) && (
                <Animated.View 
                  style={[
                    styles.savingsBadge,
                    { 
                      transform: [{ scale: savingsScale }],
                      opacity: savingsOpacity 
                    }
                  ]}
                >
                  <Text style={styles.savingsBadgeText}>
                    You saved ₹{pricing.savings > 0 ? pricing.savings : singlePieceSavings}
                  </Text>
                </Animated.View>
              )}
            </View>
          </View>

          <View style={styles.productRight}>
            {product.image || product.imageUrl ? (
              <Image
                source={getImageSource(product.image || product.imageUrl)}
                style={styles.productImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.productImagePlaceholder}>
                <Text style={styles.productImageText}>📦</Text>
              </View>
            )}
            
            {/* Quantity Controls - Below Image */}
            {availabilityStatus === 'available' && (
              <View style={styles.quantitySection}>
                {cartQuantity > 0 ? (
                  <Animated.View 
                    style={[
                      styles.quantityControls,
                      { transform: [{ scale: buttonScale }] }
                    ]}
                  >
                    <TouchableOpacity 
                      style={styles.qtyBtn} 
                      onPress={handleRemovePress}
                    >
                      <Ionicons name="remove" size={20} color={Colors.light.tint} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{cartQuantity}</Text>
                    <TouchableOpacity 
                      style={styles.qtyBtn} 
                      onPress={handleAddPress}
                    >
                      <Ionicons name="add" size={20} color={Colors.light.tint} />
                    </TouchableOpacity>
                  </Animated.View>
                ) : (
                  <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={handleAddPress}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.addButtonText}>ADD</Text>
                    </TouchableOpacity>
                  </Animated.View>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Bulk Pricing Tiers */}
        {availabilityStatus === 'available' && pricing.bulkPricingTiers.length > 0 && (
          <View style={styles.bulkPricingSection}>
            <View style={styles.bulkPricingHeader}>
              <Text style={styles.bulkPricingTitle}>BULK SAVINGS</Text>
              {pricing.isExtendedRange && (
                <View style={styles.extendedRangeIndicator}>
                  <Ionicons name="infinite" size={12} color="#3B82F6" />
                  <Text style={styles.extendedRangeIndicatorText}>
                    Extended discounts
                  </Text>
                </View>
              )}
            </View>
            {pricing.bulkPricingTiers.filter(tier => tier.quantity > 1).map((tier, index) => (
              <View key={index}>
                <View style={styles.bulkTier}>
                  <View style={styles.tierInfo}>
                    <View style={styles.tierHeader}>
                      <Text style={styles.tierPriceText}>
                        ₹{tier.pricePerPiece}/pc for {tier.slabRange}
                      </Text>
                      {tier.isExtendedRange && (
                        <View style={styles.tierExtendedBadge}>
                          <Text style={styles.tierExtendedText}>EXTENDED</Text>
                        </View>
                      )}
                    </View>
                    {tier.hasDiscount && (
                      <Text style={styles.tierDiscountText}>
                        {tier.discountPercentage}% OFF • Save ₹{tier.savings}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.tierAddButton,
                      tier.isExtendedRange && styles.tierAddButtonExtended
                    ]}
                    onPress={() => handleAddToCart(product, tier.quantity)}
                  >
                    <Text style={styles.tierAddButtonText}>
                      ADD {tier.quantity}
                    </Text>
                  </TouchableOpacity>
                </View>
                {index < pricing.bulkPricingTiers.filter(tier => tier.quantity > 1).length - 1 && (
                  <View style={styles.tierSeparator} />
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
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <View style={styles.productInfoSection}>
              <Text style={styles.errorText}>Product information not available</Text>
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
        <View style={styles.modalContainer}>
          <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
            {/* Header with Close Button */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>

            {/* Product Image */}
            <View style={styles.productImageContainer}>
              {product.image || product.imageUrl ? (
                <Image
                  source={getImageSource(product.image || product.imageUrl)}
                  style={styles.largeProductImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.largeProductImagePlaceholder}>
                  <Text style={styles.largeProductImageText}>📦</Text>
                </View>
              )}
            </View>

            {/* Product Info */}
            <View style={styles.productInfoSection}>
              <View style={styles.productHeaderRow}>
                <View style={styles.productTitleContainer}>
                  <Text style={styles.productDetailName}>{product.name}</Text>
                  <Text style={styles.productDetailUnit}>{product.unit}</Text>
                </View>
                
                {/* Price and Add Counter - Top Right */}
                <View style={styles.priceCounterContainer}>
                  <View style={styles.detailPriceContainer}>
                    <Text style={styles.detailPrice}>₹{pricing.currentPrice}</Text>
                    {pricing.hasDiscount && pricing.currentPrice < pricing.basePrice && (
                      <Text style={styles.detailPriceOriginal}>₹{pricing.basePrice}</Text>
                    )}
                  </View>

                  {/* Add to Cart Controls */}
                  {availabilityStatus === 'available' && (
                    <View style={styles.detailQuantitySection}>
                      {cartQuantity > 0 ? (
                        <Animated.View 
                          style={[
                            styles.detailQuantityControls,
                            { transform: [{ scale: buttonScale }] }
                          ]}
                        >
                          <TouchableOpacity 
                            style={styles.detailQtyBtn} 
                            onPress={handleRemovePress}
                          >
                            <Ionicons name="remove" size={20} color={Colors.light.tint} />
                          </TouchableOpacity>
                          <Text style={styles.detailQtyText}>{cartQuantity}</Text>
                          <TouchableOpacity 
                            style={styles.detailQtyBtn} 
                            onPress={handleAddPress}
                          >
                            <Ionicons name="add" size={20} color={Colors.light.tint} />
                          </TouchableOpacity>
                        </Animated.View>
                      ) : (
                        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                          <TouchableOpacity
                            style={styles.detailAddButton}
                            onPress={handleAddPress}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.detailAddButtonText}>ADD</Text>
                          </TouchableOpacity>
                        </Animated.View>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {pricing.hasDiscount && (
                <View style={styles.detailDiscountBadge}>
                  <Text style={styles.detailDiscountBadgeText}>
                    {pricing.discountPercentage}% OFF
                  </Text>
                </View>
              )}

              {/* Bulk Savings Section */}
              {availabilityStatus === 'available' && pricing.bulkPricingTiers.length > 0 && (
                <View style={styles.detailBulkSection}>
                  <Text style={styles.detailBulkTitle}>Bulk Savings</Text>
                  {pricing.bulkPricingTiers.map((tier, index) => (
                    <View key={index} style={styles.detailBulkTier}>
                      <View style={styles.detailTierInfo}>
                        <Text style={styles.detailTierRange}>{tier.slabRange}</Text>
                        <Text style={styles.detailTierPrice}>₹{tier.pricePerPiece}/piece</Text>
                        {tier.hasDiscount && (
                          <Text style={styles.detailTierDiscount}>
                            Save {tier.discountPercentage}% • ₹{tier.savings} total
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.detailTierAddButton}
                        onPress={() => handleAddToCart(product, tier.quantity)}
                      >
                        <Text style={styles.detailTierAddButtonText}>
                          ADD {tier.quantity}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Description */}
              <View style={styles.descriptionSection}>
                <Text style={styles.sectionTitle}>Description</Text>
                <Text style={styles.descriptionText}>
                  {product.description || 'No description available for this product.'}
                </Text>
              </View>

              {/* Similar Products - Larger Cards */}
              {similarProducts.length > 0 && (
                <View style={styles.similarProductsSection}>
                  <Text style={styles.sectionTitle}>Similar Products</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.similarProductsList}>
                      {similarProducts.map(similarProduct => {
                        const similarPricing = calculateProductPricing(similarProduct, similarProduct._inventory);
                        const similarCartQuantity = getItemQuantity(similarProduct._id);
                        
                        return (
                          <View key={similarProduct._id} style={styles.similarProductCard}>
                            <TouchableOpacity 
                              onPress={() => {
                                setSelectedProduct(similarProduct);
                              }}
                              activeOpacity={0.7}
                            >
                              <Image
                                source={getImageSource(similarProduct.image || similarProduct.imageUrl)}
                                style={styles.similarProductImage}
                                resizeMode="cover"
                              />
                              <View style={styles.similarProductInfo}>
                                <Text style={styles.similarProductName} numberOfLines={2}>
                                  {similarProduct.name}
                                </Text>
                                <Text style={styles.similarProductUnit}>{similarProduct.unit}</Text>
                                <View style={styles.similarProductPriceRow}>
                                  <Text style={styles.similarProductPrice}>
                                    ₹{similarPricing.currentPrice}
                                  </Text>
                                  {similarPricing.hasDiscount && similarPricing.currentPrice < similarPricing.basePrice && (
                                    <Text style={styles.similarProductPriceOriginal}>
                                      ₹{similarPricing.basePrice}
                                    </Text>
                                  )}
                                </View>
                                
                                {/* Add to Cart in Similar Products */}
                                <View style={styles.similarProductActions}>
                                  {similarCartQuantity > 0 ? (
                                    <View style={styles.similarQuantityControls}>
                                      <TouchableOpacity 
                                        style={styles.similarQtyBtn} 
                                        onPress={() => removeFromCart(similarProduct._id)}
                                      >
                                        <Ionicons name="remove" size={16} color={Colors.light.tint} />
                                      </TouchableOpacity>
                                      <Text style={styles.similarQtyText}>{similarCartQuantity}</Text>
                                      <TouchableOpacity 
                                        style={styles.similarQtyBtn} 
                                        onPress={() => handleAddToCart(similarProduct)}
                                      >
                                        <Ionicons name="add" size={16} color={Colors.light.tint} />
                                      </TouchableOpacity>
                                    </View>
                                  ) : (
                                    <TouchableOpacity
                                      style={styles.similarAddButton}
                                      onPress={() => handleAddToCart(similarProduct)}
                                      activeOpacity={0.7}
                                    >
                                      <Text style={styles.similarAddButtonText}>ADD</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>

                                {/* Bulk Pricing in Similar Products */}
                                {similarPricing.bulkPricingTiers.length > 0 && similarPricing.bulkPricingTiers.some(tier => tier.quantity > 1) && (
                                  <View style={styles.similarBulkSection}>
                                    <Text style={styles.similarBulkTitle}>Bulk Save</Text>
                                    {similarPricing.bulkPricingTiers
                                      .filter(tier => tier.quantity > 1)
                                      .slice(0, 2)
                                      .map((tier, tierIndex) => (
                                        <TouchableOpacity
                                          key={tierIndex}
                                          style={styles.similarBulkButton}
                                          onPress={() => handleAddToCart(similarProduct, tier.quantity)}
                                        >
                                          <Text style={styles.similarBulkButtonText}>
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
            <View style={styles.continueToCartContainer}>
              <TouchableOpacity 
                style={styles.continueToCartButton}
                onPress={() => {
                  onClose();
                  router.push("/cart");
                }}
              >
                <Text style={styles.continueButtonText}>
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>My List</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setShowSearch(!showSearch)}
              activeOpacity={0.7}
            >
              <Ionicons name="search" size={24} color="#1A1A1A" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cartButton}
              onPress={() => router.push("/cart")}
            >
              <Ionicons name="cart-outline" size={24} color="#1A1A1A" />
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {showSearch && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search products..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={Colors.light.textSecondary}
            />
            <TouchableOpacity style={styles.searchIcon}>
              <Ionicons
                name="search"
                size={20}
                color={Colors.light.textSecondary}
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Compact Save Tip */}
        <View style={styles.saveTip}>
          <Text style={styles.saveTipText}>
            💰 Save more with quantity discounts - Extended discounts apply automatically!
          </Text>
        </View>

        <View style={styles.filterRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterButtons}
          >
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowSortModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.filterButtonText}>Sort</Text>
              <Text style={styles.filterArrow}>▼</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => console.log("Rated 4.0+ filter toggled")}
              activeOpacity={0.7}
            >
              <FontAwesome name="star" size={14} color="#F59E0B" />
              <Text style={styles.filterButtonText}>Rated 4.0+</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.sidebar}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.sidebarContent}
          >
            <TouchableOpacity
              style={[
                styles.categoryItem,
                selectedCategory === "all" && styles.categoryItemActive,
              ]}
              onPress={() => setSelectedCategory("all")}
              activeOpacity={0.7}
            >
              <View style={styles.categoryIconContainer}>
                <Text style={styles.allCategoryIcon}>📦</Text>
              </View>
              <Text
                style={[
                  styles.categoryName,
                  selectedCategory === "all" && styles.categoryNameActive,
                ]}
              >
                All
              </Text>
            </TouchableOpacity>

            {categories.map((category, index) => (
              <TouchableOpacity
                key={`category-${category._id}-${index}`}
                style={[
                  styles.categoryItem,
                  selectedCategory === category._id && styles.categoryItemActive,
                ]}
                onPress={() => setSelectedCategory(category._id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.categoryIconContainer,
                    { backgroundColor: category.color || "#E3F2FD" },
                  ]}
                >
                  <Image
                    source={getImageSource(category.image)}
                    style={styles.categoryImage}
                    resizeMode="cover"
                  />
                </View>
                <Text
                  style={[
                    styles.categoryName,
                    selectedCategory === category._id && styles.categoryNameActive,
                  ]}
                  numberOfLines={3}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.productsContainer}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.productsList}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))
            ) : (
              <View style={styles.requestSection}>
                <View style={styles.requestIcon}>
                  <Text style={styles.requestIconText}>🔍</Text>
                </View>
                <View style={styles.requestContent}>
                  <Text style={styles.requestTitle}>
                    Looking for something else?
                  </Text>
                  <Text style={styles.requestSubtitle}>
                    Tell us and we'll add it to the shop
                  </Text>
                  <TouchableOpacity
                    style={styles.requestButton}
                    onPress={() => console.log("Request a product clicked")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.requestButtonText}>
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
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sort by</Text>
              <TouchableOpacity
                onPress={() => setShowSortModal(false)}
                style={styles.modalClose}
                activeOpacity={0.7}
              >
                <Feather name="x" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            </View>
            <View style={styles.sortOptions}>
              {["relevance", "pricelow", "pricehigh", "rating"].map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.sortOption,
                    sortOption === option && styles.sortOptionActive,
                  ]}
                  onPress={() => {
                    setSortOption(option);
                    setShowSortModal(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.sortOptionText,
                      sortOption === option && styles.sortOptionTextActive,
                    ]}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundLight,
  },
  header: {
    backgroundColor: Colors.light.white,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.text,
  },
  headerIcons: {
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.backgroundLight,
    justifyContent: "center",
    alignItems: "center",
  },
  cartButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.light.backgroundLight,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: Colors.light.tint,
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  cartBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.backgroundLight,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
  },
  searchIcon: {
    padding: 4,
  },
  // Compact Save Tip
  saveTip: {
    backgroundColor: "#FFFAEB",
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  saveTipText: {
    fontSize: 12,
    color: "#92400E",
    fontWeight: "500",
    textAlign: 'center',
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  filterButtons: {
    flexDirection: "row",
    gap: 8,
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.white,
    borderWidth: 1.5,
    borderColor: "#E8E8E8",
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.light.text,
  },
  filterArrow: {
    fontSize: 10,
    color: Colors.light.textSecondary,
  },
  content: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    width: 90,
    backgroundColor: Colors.light.white,
  },
  sidebarContent: {
    paddingVertical: 8,
  },
  categoryItem: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  categoryItemActive: {
    backgroundColor: "#FFF0F5",
  },
  categoryIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  allCategoryIcon: {
    fontSize: 24,
  },
  categoryImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  categoryName: {
    fontSize: 10,
    fontWeight: "500",
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 13,
  },
  categoryNameActive: {
    color: Colors.light.text,
    fontWeight: "700",
  },
  productsContainer: {
    flex: 1,
  },
  productsList: {
    paddingHorizontal: 4,
    paddingBottom: 100,
    gap: 8,
  },
  productCard: {
    backgroundColor: Colors.light.white,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    position: "relative",
    minHeight: 220,
  },
  // Blue Discount Badge
  discountBadge: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: "#3B82F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    zIndex: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  discountBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  extendedRangeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "700",
    marginTop: 2,
    opacity: 0.9,
  },
  // Status Badges - Short Titles
  statusBadge: {
    position: "absolute",
    right: 12,
    top: 12,
    backgroundColor: "#EF4444",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    zIndex: 2,
  },
  notAvailableBadge: {
    backgroundColor: "#F59E0B",
  },
  statusBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  productContent: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  productLeft: {
    flex: 1,
    justifyContent: "space-between",
  },
  productName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
    lineHeight: 22,
  },
  productUnit: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  mainPriceContainer: {
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  price: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
  },
  priceOriginal: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textDecorationLine: "line-through",
  },
  // Light Savings Badge
  savingsBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  savingsBadgeText: {
    color: "#065F46",
    fontSize: 12,
    fontWeight: "600",
  },
  productRight: {
    alignItems: "center",
    justifyContent: "space-between",
  },
  productImage: {
    width: 90,
    height: 90,
    borderRadius: 8,
    backgroundColor: "#F5F5F5",
  },
  productImagePlaceholder: {
    width: 90,
    height: 90,
    backgroundColor: "#F5F5F5",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  productImageText: {
    fontSize: 24,
  },
  // Quantity Section - Compact Add Button
  quantitySection: {
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0F9FF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 120,
  },
  qtyBtn: {
    padding: 4,
  },
  qtyText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    minWidth: 30,
    textAlign: "center",
  },
  addButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    width: 80,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#DC2626",
  },
  // Enhanced Bulk Pricing Section
  bulkPricingSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
  },
  bulkPricingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bulkPricingTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
  },
  extendedRangeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  extendedRangeIndicatorText: {
    fontSize: 10,
    color: '#3B82F6',
    fontWeight: '600',
  },
  bulkTier: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  tierInfo: {
    flex: 1,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  tierPriceText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E40AF",
  },
  tierExtendedBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tierExtendedText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  tierDiscountText: {
    fontSize: 12,
    color: "#10B981",
    fontWeight: "600",
  },
  tierSeparator: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 6,
  },
  tierAddButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    minWidth: 70,
  },
  tierAddButtonExtended: {
    backgroundColor: "#EFF6FF",
  },
  tierAddButtonText: {
    color: "#DC2626",
    fontWeight: "600",
    fontSize: 12,
    textAlign: "center",
  },
  requestSection: {
    backgroundColor: Colors.light.white,
    borderRadius: 16,
    padding: 24,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    marginHorizontal: 8,
  },
  requestIcon: {
    width: 60,
    height: 60,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  requestIconText: {
    fontSize: 28,
  },
  requestContent: {
    flex: 1,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 4,
  },
  requestSubtitle: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 12,
  },
  requestButton: {
    borderWidth: 2,
    borderColor: Colors.light.tint,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  requestButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.tint,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.light.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8E8",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
  },
  modalClose: {
    padding: 4,
  },
  sortOptions: {
    padding: 16,
    gap: 8,
  },
  sortOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundLight,
  },
  sortOptionActive: {
    backgroundColor: "#FFF0F5",
    borderWidth: 2,
    borderColor: Colors.light.tint,
  },
  sortOptionText: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.light.text,
  },
  sortOptionTextActive: {
    fontWeight: "700",
    color: Colors.light.tint,
  },
  // Product Detail Modal Styles - Updated Layout
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.light.white,
  },
  modalScrollView: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    paddingTop: 60,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productImageContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  largeProductImage: {
    width: '80%',
    height: '80%',
    borderRadius: 12,
  },
  largeProductImagePlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  largeProductImageText: {
    fontSize: 48,
  },
  productInfoSection: {
    padding: 20,
  },
  // New Layout for Product Header Row
  productHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  productTitleContainer: {
    flex: 1,
    marginRight: 16,
  },
  productDetailName: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 4,
  },
  productDetailUnit: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  priceCounterContainer: {
    alignItems: 'flex-end',
    minWidth: 120,
  },
  detailPriceContainer: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  detailPrice: {
    fontSize: 28,
    fontWeight: "700",
    color: Colors.light.text,
  },
  detailPriceOriginal: {
    fontSize: 20,
    color: Colors.light.textSecondary,
    textDecorationLine: "line-through",
  },
  detailDiscountBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  detailDiscountBadgeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: "700",
  },
  detailQuantitySection: {
    marginBottom: 0,
  },
  detailQuantityControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0F9FF",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 120,
  },
  detailQtyBtn: {
    padding: 4,
  },
  detailQtyText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    minWidth: 30,
    textAlign: "center",
  },
  detailAddButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    width: 80,
  },
  detailAddButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#DC2626",
  },
  detailBulkSection: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  detailBulkTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 16,
  },
  detailBulkTier: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  detailTierInfo: {
    flex: 1,
  },
  detailTierRange: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  detailTierPrice: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E40AF",
    marginBottom: 4,
  },
  detailTierDiscount: {
    fontSize: 12,
    color: "#10B981",
    fontWeight: "500",
  },
  detailTierAddButton: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  detailTierAddButtonText: {
    color: "#DC2626",
    fontWeight: "600",
    fontSize: 14,
  },
  descriptionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 12,
  },
  descriptionText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    lineHeight: 24,
  },
  // Enhanced Similar Products Section
  similarProductsSection: {
    marginBottom: 100,
  },
  similarProductsList: {
    flexDirection: 'row',
    gap: 16,
  },
  similarProductCard: {
    width: 200,
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  similarProductImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  similarProductInfo: {
    flex: 1,
  },
  similarProductName: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
    height: 40,
  },
  similarProductUnit: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  similarProductPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  similarProductPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
  },
  similarProductPriceOriginal: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textDecorationLine: "line-through",
  },
  similarProductActions: {
    marginBottom: 8,
  },
  similarQuantityControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F0F9FF",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  similarQtyBtn: {
    padding: 2,
  },
  similarQtyText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.text,
    minWidth: 20,
    textAlign: "center",
  },
  similarAddButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  similarAddButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626",
  },
  similarBulkSection: {
    marginTop: 8,
  },
  similarBulkTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  similarBulkButton: {
    backgroundColor: "#F8F9FA",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  similarBulkButtonText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#1E40AF",
    textAlign: 'center',
  },
  // Continue to Cart Button - Solid Red
  continueToCartContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: Colors.light.white,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  continueToCartButton: {
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    marginTop: 20,
  },
});