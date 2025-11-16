import Colors from "@/constants/colors";
import { useCart } from "@/contexts/CartContext";
import { Feather, FontAwesome, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
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
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/contexts/ProfileContext";

const getImageSource = (imageName) => {
  // If it's a full URL (from Cloudinary/database), use it directly
  if (
    imageName &&
    (imageName.startsWith("http") || imageName.startsWith("https"))
  ) {
    return { uri: imageName };
  }

  // Otherwise, use local asset mapping
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
  return imageMap[imageName] || require("../../assets/images/MilkCategory.png"); // fallback
};

const { width } = Dimensions.get("window");

export default function CategoriesScreen() {
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showSortModal, setShowSortModal] = useState(false);
  const [sortOption, setSortOption] = useState("relevance");
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const { getTotalItems, items, addToCart, removeFromCart, getItemQuantity } =
    useCart();
  const cartCount = getTotalItems();
  const insets = useSafeAreaInsets();

  // Context hooks for auth and retailer data
  const { authToken } = useAuth();
  const token = authToken;
  const { assignedRetailer } = useProfile();

  //for favourite products ---
  const [favoriteProducts, setFavoriteProducts] = useState([]);
  const toggleFavorite = (productId) => {
    setFavoriteProducts((prev) => {
      if (prev.includes(productId)) {
        // If already favorited → remove it
        return prev.filter((id) => id !== productId);
      } else {
        // If not favorited → add it
        return [...prev, productId];
      }
    });
  };

  // State for dynamic data
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // API Base URL
  const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;

  // Fetch categories from API
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/catalog/categories`);
      const data = await response.json();

      if (response.ok && Array.isArray(data)) {
        return data;
      } else {
        return [];
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      return [];
    }
  };

  // Fetch products from API
  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/catalog/products`);
      const data = await response.json();

      if (response.ok && Array.isArray(data)) {
        return data;
      } else {
        return [];
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      return [];
    }
  };

  // Fetch inventory for assigned retailer
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

      if (!res.ok) {
        console.warn("Inventory error:", payload);
        return [];
      }
      
      return payload?.data?.inventory || [];
      
    } catch (err) {
      console.error("Inventory fetch error:", err);
      return [];
    }
  };

  // Attach inventory to products
  const attachInventoryToProducts = (products, inventory) => {
    if (!Array.isArray(products)) return [];
    if (!Array.isArray(inventory)) return products;

    const inventoryMap = new Map();
    
    inventory.forEach(inv => {
      const product = inv?.product;
      if (!product) return;
      
      const productId = product?.id || product?._id;
      const productName = product?.name?.toLowerCase().trim();
      
      if (productId) {
        inventoryMap.set(productId, {
          ...inv,
          currentStock: inv.currentStock,
          sellingPrice: inv.sellingPrice,
          isActive: inv.isActive
        });
      }
      
      if (productName) {
        inventoryMap.set(productName, {
          ...inv,
          currentStock: inv.currentStock,
          sellingPrice: inv.sellingPrice,
          isActive: inv.isActive
        });
      }
    });

    return products.map(product => {
      const productId = product?.id || product?._id;
      const productName = product?.name?.toLowerCase().trim();
      
      let matchedInventory = null;
      
      // Try ID match first
      if (productId && inventoryMap.has(productId)) {
        matchedInventory = inventoryMap.get(productId);
      } 
      // Then try name match
      else if (productName && inventoryMap.has(productName)) {
        matchedInventory = inventoryMap.get(productName);
      }
      
      // Determine if retailer sells this product
      const soldByRetailer = matchedInventory !== null;
      
      // Stock status: Only mark as out of stock if retailer sells it AND has zero stock
      const retailerStock = matchedInventory?.currentStock;
      const isOutOfStock = soldByRetailer && retailerStock !== undefined && Number(retailerStock) <= 0;
      
      // Price priority: retailer price first, then product price
      const price = matchedInventory?.sellingPrice ?? 
                   product?.discountedPrice ?? 
                   product?.price ?? 0;

      return {
        ...product,
        _inventory: matchedInventory,
        outOfStock: isOutOfStock,
        price: price,
        stock: product?.stock,
        currentStock: matchedInventory?.currentStock,
        soldByRetailer: soldByRetailer,
        retailerPrice: matchedInventory?.sellingPrice,
        // Add availability info
        availableFromRetailer: soldByRetailer && !isOutOfStock,
        availableFromCatalog: !soldByRetailer,
      };
    });
  };

  // Fetch data on component mount
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
        
        // Attach inventory to products and set them
        const productsWithInventory = attachInventoryToProducts(productsData, inventoryData);
        setProducts(productsWithInventory);
        setInventory(inventoryData);

      } catch (error) {
        console.error("Error fetching data:", error);
        // Fallback to products without inventory
        const productsData = await fetchProducts();
        setProducts(productsData);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, assignedRetailer]);

  // Handle pull to refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const [categoriesData, productsData, inventoryData] = await Promise.all([
        fetchCategories(),
        fetchProducts(),
        fetchInventory(),
      ]);

      setCategories(categoriesData);
      
      // Attach inventory to products
      const productsWithInventory = attachInventoryToProducts(productsData, inventoryData);
      setProducts(productsWithInventory);
      setInventory(inventoryData);

    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  };

  // Filter and sort products
  let filteredProducts =
    selectedCategory === "all"
      ? products
      : products.filter((p) => p.category?._id?.toString() === selectedCategory);

  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filteredProducts = filteredProducts.filter((p) =>
      p.name.toLowerCase().includes(query)
    );
  }

  if (sortOption === "pricelow") {
    filteredProducts = [...filteredProducts].sort((a, b) => a.price - b.price);
  } else if (sortOption === "pricehigh") {
    filteredProducts = [...filteredProducts].sort((a, b) => b.price - a.price);
  } else if (sortOption === "rating") {
    filteredProducts = [...filteredProducts].sort(
      (a, b) => (b.rating?.average || 0) - (a.rating?.average || 0)
    );
  }

  const cartTotal = items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0
  );

  // Handle add to cart with inventory check
  const handleAddToCart = (product) => {
    // Check if product is out of stock at retailer
    if (product.outOfStock) {
      if (product.soldByRetailer) {
        Alert.alert("Out of stock", "This product is currently out of stock at your assigned retailer.");
      } else {
        Alert.alert("Not available", "This product is not currently available from your assigned retailer.");
      }
      return;
    }
    
    // If product is not sold by retailer but has catalog price, allow adding to cart
    if (!product.soldByRetailer) {
      Alert.alert(
        "Product Not Available", 
        "This product is not available from your assigned retailer, but you can browse it in our catalog.",
        [{ text: "OK" }]
      );
      return;
    }
    
    addToCart(product);
  };

  // Get availability status for styling
  const getAvailabilityStatus = (product) => {
    if (!product.soldByRetailer) return 'catalog';
    if (product.outOfStock) return 'out_of_stock';
    return 'available';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>My List</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                setShowSearch(!showSearch);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="search" size={22} color="#1A1A1A" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push("/cart")}
            >
              <Ionicons name="cart-outline" size={22} color="#1A1A1A" />
              {cartCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Retailer Info */}
        {assignedRetailer && (
          <View style={styles.retailerInfo}>
            <Ionicons name="storefront" size={14} color={Colors.light.tint} />
            <Text style={styles.retailerInfoText}>
              Shopping from: {assignedRetailer.shopName}
            </Text>
          </View>
        )}

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

        <View style={styles.saveTip}>
          <Text style={styles.saveTipIcon}>💰</Text>
          <Text style={styles.saveTipText}>
            Save more — try sort by &apos;Price per Kg&apos;
          </Text>
        </View>

        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.gridButton}
            onPress={() => {
              console.log("Grid view toggled");
            }}
            activeOpacity={0.7}
          >
            <View style={styles.gridIcon} />
            <View style={styles.gridIcon} />
            <View style={styles.gridIcon} />
            <View style={styles.gridIcon} />
          </TouchableOpacity>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterButtons}
          >
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => {
                setShowSortModal(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.filterButtonText}>Sort</Text>
              <Text style={styles.filterArrow}>▼</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => {
                console.log("Rated 4.0+ filter toggled");
              }}
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
              onPress={() => {
                console.log("All categories selected");
                setSelectedCategory("all");
              }}
              activeOpacity={0.7}
            >
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
                  selectedCategory === category._id &&
                    styles.categoryItemActive,
                ]}
                onPress={() => {
                  console.log(`Category ${category.name} selected`);
                  setSelectedCategory(category._id);
                }}
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
                    selectedCategory === category._id &&
                      styles.categoryNameActive,
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
              filteredProducts.map((product) => {
                const availabilityStatus = getAvailabilityStatus(product);
                
                return (
                  <View key={product._id} style={[
                    styles.productCard,
                    availabilityStatus === 'out_of_stock' && styles.productCardOutOfStock,
                    availabilityStatus === 'catalog' && styles.productCardCatalog
                  ]}>
                    {/* Availability Badge */}
                    {availabilityStatus === 'out_of_stock' && (
                      <View style={styles.availabilityBadge}>
                        <Text style={styles.availabilityBadgeText}>OUT OF STOCK</Text>
                      </View>
                    )}
                    {availabilityStatus === 'catalog' && (
                      <View style={styles.catalogBadge}>
                        <Text style={styles.catalogBadgeText}>CATALOG</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={styles.heartButton}
                      onPress={() => toggleFavorite(product._id)}
                      activeOpacity={0.6}
                    >
                      <FontAwesome
                        name={
                          favoriteProducts.includes(product._id)
                            ? "heart"
                            : "heart-o"
                        }
                        size={20}
                        color="#EF4444"
                      />
                    </TouchableOpacity>
                    <View style={styles.productHeader}>
                      {product.discount > 0 ? (
                        <View style={styles.offerBadge}>
                          <Text style={styles.offerBadgeText}>
                            {product.discount}% OFF MRP
                          </Text>
                        </View>
                      ) : (
                        // Empty placeholder to maintain spacing
                        <View style={{ height: 22 }} />
                      )}
                    </View>

                    <View style={styles.productContent}>
                      <View style={styles.productInfo}>
                        <Text style={styles.productName}>{product.name}</Text>
                        <Text style={styles.productUnit}>{product.unit}</Text>

                        {/* Retailer Stock Info */}
                        {product.soldByRetailer && product.currentStock !== undefined && (
                          <Text style={[
                            styles.stockInfo,
                            availabilityStatus === 'out_of_stock' && styles.stockInfoOut
                          ]}>
                            Stock: {product.currentStock}
                          </Text>
                        )}

                        {/* Catalog Notice */}
                        {availabilityStatus === 'catalog' && (
                          <Text style={styles.catalogNotice}>
                            Available in catalog
                          </Text>
                        )}

                        {product.rating && product.rating.average > 0 && (
                          <View style={styles.ratingRow}>
                            <View style={styles.ratingBadge}>
                              <FontAwesome
                                name="star"
                                size={12}
                                color="#FFFFFF"
                              />
                              <Text style={styles.ratingText}>
                                {product.rating.average}
                              </Text>
                            </View>
                            <Text style={styles.reviewsText}>
                              ({product.rating.count})
                            </Text>
                          </View>
                        )}

                        <View style={styles.priceRow}>
                          <View style={styles.priceContainer}>
                            {/* Retailer Price Indicator */}
                            {product.soldByRetailer && product.retailerPrice && (
                              <Text style={styles.retailerPriceIndicator}>Retailer Price</Text>
                            )}
                            
                            <Text style={styles.price}>
                              ₹{product.price}
                            </Text>
                            {product.discount > 0 && product.discountedPrice && (
                              <Text style={styles.priceOriginal}>
                                ₹{product.discountedPrice}
                              </Text>
                            )}
                          </View>
                          {product.bulkPrices &&
                            (product.bulkPrices[6] || product.bulkPrices[15]) && (
                              <>
                                <View style={styles.priceSeparator} />
                                <View style={styles.bulkContainer}>
                                  {product.bulkPrices[6] && (
                                    <Text style={styles.bulkPrice}>
                                      6+ @ ₹{product.bulkPrices[6]}
                                    </Text>
                                  )}
                                  {product.bulkPrices[15] && (
                                    <Text style={styles.bulkPrice}>
                                      15+ @ ₹{product.bulkPrices[15]}
                                    </Text>
                                  )}
                                </View>
                              </>
                            )}
                        </View>
                      </View>

                      <View style={styles.productRight}>
                        {product.image || product.imageUrl ? (
                          <Image
                            source={getImageSource(
                              product.image || product.imageUrl
                            )}
                            style={[
                              styles.productImage,
                              availabilityStatus === 'out_of_stock' && styles.productImageOut,
                              availabilityStatus === 'catalog' && styles.productImageCatalog
                            ]}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.productImagePlaceholder}>
                            <Text style={styles.productImageText}>📦</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.productActions}>
                      {availabilityStatus === 'out_of_stock' ? (
                        <View style={styles.outOfStockButton}>
                          <Text style={styles.outOfStockButtonText}>Out of Stock</Text>
                        </View>
                      ) : availabilityStatus === 'catalog' ? (
                        <TouchableOpacity 
                          style={styles.catalogButton}
                          onPress={() => {
                            Alert.alert(
                              "Catalog Product", 
                              "This product is available in our catalog but not from your assigned retailer.",
                              [{ text: "OK" }]
                            );
                          }}
                        >
                          <Text style={styles.catalogButtonText}>View Details</Text>
                        </TouchableOpacity>
                      ) : getItemQuantity(product._id) === 0 ? (
                        <TouchableOpacity
                          style={styles.addButton}
                          onPress={() => handleAddToCart(product)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.addButtonText}>ADD</Text>
                          <Text style={styles.addButtonPlus}>+</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.addButton}>
                          <TouchableOpacity
                            onPress={() => removeFromCart(product._id)}
                            style={styles.qtyBtn}
                            activeOpacity={0.7}
                          >
                            <Feather
                              name="minus"
                              size={16}
                              color={Colors.light.tint}
                            />
                          </TouchableOpacity>
                          <Text style={styles.qtyText}>
                            {getItemQuantity(product._id)}
                          </Text>
                          <TouchableOpacity
                            onPress={() => handleAddToCart(product)}
                            style={styles.qtyBtn}
                            activeOpacity={0.7}
                          >
                            <Feather
                              name="plus"
                              size={16}
                              color={Colors.light.tint}
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                      
                      {/* Bulk actions only for available retailer products */}
                      {availabilityStatus === 'available' && (
                        <>
                          <TouchableOpacity
                            style={styles.bulkAction}
                            onPress={() => {
                              for (let i = 0; i < 6; i++) {
                                handleAddToCart(product);
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.bulkActionText}>Add 6</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.bulkAction}
                            onPress={() => {
                              for (let i = 0; i < 15; i++) {
                                handleAddToCart(product);
                              }
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.bulkActionText}>Add 15</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                );
              })
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
                    Tell us and we&apos;ll add it to the shop
                  </Text>
                  <TouchableOpacity
                    style={styles.requestButton}
                    onPress={() => {
                      console.log("Request a product clicked");
                    }}
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
              <TouchableOpacity
                style={[
                  styles.sortOption,
                  sortOption === "relevance" && styles.sortOptionActive,
                ]}
                onPress={() => {
                  setSortOption("relevance");
                  setShowSortModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    sortOption === "relevance" && styles.sortOptionTextActive,
                  ]}
                >
                  Relevance
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sortOption,
                  sortOption === "pricelow" && styles.sortOptionActive,
                ]}
                onPress={() => {
                  setSortOption("pricelow");
                  setShowSortModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    sortOption === "pricelow" && styles.sortOptionTextActive,
                  ]}
                >
                  Price: Low to High
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sortOption,
                  sortOption === "pricehigh" && styles.sortOptionActive,
                ]}
                onPress={() => {
                  setSortOption("pricehigh");
                  setShowSortModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    sortOption === "pricehigh" && styles.sortOptionTextActive,
                  ]}
                >
                  Price: High to Low
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.sortOption,
                  sortOption === "rating" && styles.sortOptionActive,
                ]}
                onPress={() => {
                  setSortOption("rating");
                  setShowSortModal(false);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.sortOptionText,
                    sortOption === "rating" && styles.sortOptionTextActive,
                  ]}
                >
                  Rating
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    gap: 8,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.backgroundLight,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  cartBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
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
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.light.text,
  },
  searchIcon: {
    padding: 4,
  },
  saveTip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFAEB",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 8,
  },
  saveTipIcon: {
    fontSize: 18,
  },
  saveTipText: {
    flex: 1,
    fontSize: 13,
    color: "#92400E",
    fontWeight: "500",
  },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    alignItems: "center",
  },
  gridButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#FFF0F5",
    padding: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  gridIcon: {
    width: 6,
    height: 6,
    borderRadius: 2,
    backgroundColor: "#1A1A1A",
  },
  filterButtons: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 16,
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
    borderRightWidth: 4,
    borderRightColor: Colors.light.tint,
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
  categoryIcon: {
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
    padding: 16,
    paddingBottom: 100,
    gap: 16,
  },
  productCard: {
    backgroundColor: Colors.light.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    position: "relative",
  },
  productCardOutOfStock: {
    backgroundColor: "#FFF7F7",
    borderColor: "#F3D3D3",
  },
  productCardCatalog: {
    backgroundColor: "#F8FAFF",
    borderColor: "#E3F2FD",
  },
  productHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  buyersInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  buyersIcon: {
    fontSize: 14,
  },
  buyersText: {
    fontSize: 12,
    color: "#7C3AED",
    fontWeight: "600",
  },
  offerBadge: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  offerBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  productContent: {
    flexDirection: "row",
    gap: 12,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  productUnit: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B981",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  ratingText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  reviewsText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  vegIcon: {
    fontSize: 12,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
    marginTop: 10,
  },
  price: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
  },
  priceOriginal: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textDecorationLine: "line-through",
  },
  priceContainer: {
    alignItems: "flex-start",
    minWidth: 100,
  },
  priceSeparator: {
    width: 1,
    height: 40,
    backgroundColor: "#E8E8E8",
    marginHorizontal: 4,
  },
  bulkContainer: {
    alignItems: "flex-start",
    gap: 4,
  },
  bulkPrice: {
    fontSize: 14,
    color: "#1E40AF",
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  productRight: {
    alignItems: "center",
    gap: 8,
  },
  productImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#F5F5F5",
  },
  productImageOut: {
    opacity: 0.45,
  },
  productImageCatalog: {
    opacity: 0.7,
  },
  productImagePlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: "#F5F5F5",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  productImageText: {
    fontSize: 36,
  },
  heartButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  productActions: {
    flexDirection: "row",
    gap: width < 400 ? 4 : 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  addButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.light.tint,
    borderRadius: 8,
    paddingVertical: width < 400 ? 6 : 10,
    gap: 2,
  },
  qtyBtn: {
    padding: 4,
  },
  qtyText: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    minWidth: 28,
    textAlign: "center",
  },
  addButtonText: {
    fontSize: width < 400 ? 14 : 16,
    fontWeight: "700",
    color: Colors.light.tint,
  },
  addButtonPlus: {
    fontSize: width < 400 ? 14 : 16,
    fontWeight: "700",
    color: Colors.light.tint,
  },
  bulkAction: {
    paddingHorizontal: width < 400 ? 8 : 16,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  bulkActionText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.light.tint,
  },
  requestSection: {
    backgroundColor: Colors.light.white,
    borderRadius: 16,
    padding: 24,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
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
  cartSummary: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.light.white,
    borderTopWidth: 1,
    borderTopColor: "#E8E8E8",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  cartSummaryContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cartSummaryLeft: {
    flex: 1,
  },
  cartSummaryItems: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.light.textSecondary,
    marginBottom: 2,
  },
  cartSummaryTotal: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
  },
  viewCartButton: {
    backgroundColor: Colors.light.tint,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  viewCartText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
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
  // New styles for retailer-specific features
  retailerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F9FF',
    padding: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E0F2FE',
  },
  retailerInfoText: {
    fontSize: 12,
    color: Colors.light.tint,
    fontWeight: '600',
    marginLeft: 6,
  },
  // Availability badges
  availabilityBadge: {
    position: "absolute",
    left: 16,
    top: 16,
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
  },
  availabilityBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 10,
  },
  catalogBadge: {
    position: "absolute",
    left: 16,
    top: 16,
    backgroundColor: "#3B82F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    zIndex: 1,
  },
  catalogBadgeText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 10,
  },
  // Stock information
  stockInfo: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
    fontStyle: "italic",
  },
  stockInfoOut: {
    color: "#EF4444",
  },
  // Catalog notice
  catalogNotice: {
    fontSize: 12,
    color: "#3B82F6",
    marginBottom: 6,
    fontStyle: "italic",
  },
  // Retailer price indicator
  retailerPriceIndicator: {
    fontSize: 10,
    color: Colors.light.tint,
    fontWeight: "600",
    marginBottom: 2,
  },
  // Button variations
  outOfStockButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 8,
    paddingVertical: 10,
  },
  outOfStockButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#B91C1C",
  },
  catalogButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E3F2FD",
    borderWidth: 1,
    borderColor: "#3B82F6",
    borderRadius: 8,
    paddingVertical: 10,
  },
  catalogButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3B82F6",
  },
});