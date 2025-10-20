import Colors from "@/constants/colors";
import { useCart } from "@/contexts/CartContext";
import { categories, products } from "@/mocks/products";
import { Feather, FontAwesome, Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CategoriesScreen() {
  const [selectedCategory, setSelectedCategory] = useState("milk");
  const [showSortModal, setShowSortModal] = useState(false);
  const [sortOption, setSortOption] = useState("relevance");
  const { getTotalItems, items, addToCart, removeFromCart, getItemQuantity } = useCart();
  const cartCount = getTotalItems();
  const insets = useSafeAreaInsets();

  let filteredProducts = products.filter(
    (p) => p.category === selectedCategory
  );

  if (sortOption === "pricelow") {
    filteredProducts = [...filteredProducts].sort((a, b) => a.price - b.price);
  } else if (sortOption === "pricehigh") {
    filteredProducts = [...filteredProducts].sort((a, b) => b.price - a.price);
  } else if (sortOption === "rating") {
    filteredProducts = [...filteredProducts].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  const cartTotal = items.reduce((total, item) => total + (item.product.price * item.quantity), 0);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>My List</Text>
          <View style={styles.headerIcons}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                console.log('Search clicked');
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
              console.log('Grid view toggled');
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
                console.log('Rated 4.0+ filter toggled');
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
                console.log('All categories selected');
                setSelectedCategory("all");
              }}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.categoryName,
                selectedCategory === "all" && styles.categoryNameActive,
              ]}>
                All
              </Text>
            </TouchableOpacity>

            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryItem,
                  selectedCategory === category.id && styles.categoryItemActive,
                ]}
                onPress={() => {
                  console.log(`Category ${category.name} selected`);
                  setSelectedCategory(category.id);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.categoryIconContainer,
                    { backgroundColor: category.color },
                  ]}
                >
                  <Text style={styles.categoryIcon}>{category.icon}</Text>
                </View>
                <Text
                  style={[
                    styles.categoryName,
                    selectedCategory === category.id && styles.categoryNameActive,
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
          >
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => (
                <View key={product.id} style={styles.productCard}>
                  <View style={styles.productHeader}>
                    <View style={styles.buyersInfo}>
                      <Text style={styles.buyersIcon}>🛒</Text>
                      <Text style={styles.buyersText}>1900+ recent buyers</Text>
                    </View>
                    <View style={styles.offerBadge}>
                      <Text style={styles.offerBadgeText}>12% OFF MRP</Text>
                    </View>
                  </View>

                  <View style={styles.productContent}>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productUnit}>{product.unit}</Text>
                      
                      {product.rating && (
                        <View style={styles.ratingRow}>
                          <View style={styles.ratingBadge}>
                            <FontAwesome name="star" size={12} color="#FFFFFF" />
                            <Text style={styles.ratingText}>
                              {product.rating}
                            </Text>
                          </View>
                          <Text style={styles.reviewsText}>
                            ({product.reviews})
                          </Text>
                        </View>
                      )}

                      <Text style={styles.vegIcon}>🟢</Text>

                      <View style={styles.priceRow}>
                        <Text style={styles.price}>₹{product.price}</Text>
                        <Text style={styles.priceOriginal}>
                          ₹{Math.round(product.price * 1.14)}
                        </Text>
                      </View>

                      <Text style={styles.bulkPrice}>
                        ₹{Math.round(product.price * 0.996)}/pc for 6 pcs+
                      </Text>
                      <Text style={styles.bulkPrice}>
                        ₹{Math.round(product.price * 0.98)}/pc for 15 pcs+
                      </Text>
                    </View>

                    <View style={styles.productRight}>
                      <View style={styles.productImagePlaceholder}>
                        <Text style={styles.productImageText}>📦</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.heartButton}
                        onPress={() => {
                          console.log(`${product.name} added to favorites`);
                        }}
                        activeOpacity={0.6}
                      >
                        <FontAwesome name="heart" size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.productActions}>
                    {getItemQuantity(product.id) === 0 ? (
                      <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => {
                          addToCart(product);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.addButtonText}>ADD</Text>
                        <Text style={styles.addButtonPlus}>+</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.addButton}>
                        <TouchableOpacity
                          onPress={() => removeFromCart(product.id)}
                          style={styles.qtyBtn}
                          activeOpacity={0.7}
                        >
                          <Feather name="minus" size={16} color={Colors.light.tint} />
                        </TouchableOpacity>
                        <Text style={styles.qtyText}>{getItemQuantity(product.id)}</Text>
                        <TouchableOpacity
                          onPress={() => addToCart(product)}
                          style={styles.qtyBtn}
                          activeOpacity={0.7}
                        >
                          <Feather name="plus" size={16} color={Colors.light.tint} />
                        </TouchableOpacity>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.bulkAction}
                      onPress={() => {
                        for (let i = 0; i < 6; i++) {
                          addToCart(product);
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
                          addToCart(product);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.bulkActionText}>Add 15</Text>
                    </TouchableOpacity>
                  </View>
                </View>
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
                    Tell us and we&apos;ll add it to the shop
                  </Text>
                  <TouchableOpacity
                    style={styles.requestButton}
                    onPress={() => {
                      console.log('Request a product clicked');
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
  },
  price: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
  },
  priceOriginal: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textDecorationLine: "line-through",
  },
  bulkPrice: {
    fontSize: 13,
    color: "#3B82F6",
    fontWeight: "600",
    marginBottom: 4,
  },
  productRight: {
    alignItems: "center",
    gap: 8,
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
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  productActions: {
    flexDirection: "row",
    gap: 8,
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
    paddingVertical: 10,
    gap: 4,
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
    fontSize: 15,
    fontWeight: "700",
    color: Colors.light.tint,
  },
  addButtonPlus: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.tint,
  },
  bulkAction: {
    paddingHorizontal: 16,
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
});