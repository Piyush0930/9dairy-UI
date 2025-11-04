import CategoryTile from '@/components/CategoryTile';
import ProductCard from '@/components/ProductCard';
import Colors from '@/constants/colors';
import { useCart } from '@/contexts/CartContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 64;
const CARD_SPACING = 16;
const POPULAR_CARD_WIDTH = 165;
const POPULAR_CARD_SPACING = 12;

const storeCards = [
  {
    id: 1,
    title: 'Fresh Dairy',
    subtitle: 'Milk, butter, cheese,\nfresh paneer...',
    image: require('../../assets/images/banner1.jpg'),
    color: '#E3F2FD',
  },
  {
    id: 2,
    title: 'Ice Cream Store',
    subtitle: 'Vanilla, chocolate,\nstrawberry, mango...',
    image: require('../../assets/images/banner2.jpg'),
    color: '#FFE4E1',
  },
  {
    id: 3,
    title: 'Ghee & Butter',
    subtitle: 'Pure cow ghee,\nsalted & unsalted butter...',
    image: require('../../assets/images/banner3.jpg'),
    color: '#FFF8DC',
  },
  {
    id: 4,
    title: 'Organic Produce',
    subtitle: 'Fresh vegetables,\nfruits & greens...',
    image: require('../../assets/images/banner4.jpg'),
    color: '#E8F5E9',
  },
  {
    id: 5,
    title: 'Bakery Items',
    subtitle: 'Fresh bread, cakes,\npastries & cookies...',
    image: require('../../assets/images/banner5.jpg'),
    color: '#FFF3E0',
  },
];

export default function HomeScreen() {
  const { getTotalItems, getTotalPrice, addToCart } = useCart();
  const cartCount = getTotalItems();
  const totalPrice = getTotalPrice();
  const insets = useSafeAreaInsets();
  const storeScrollRef = useRef(null);
  const popularScrollRef = useRef(null);
  const [currentStoreIndex, setCurrentStoreIndex] = useState(0);
  const [currentPopularIndex, setCurrentPopularIndex] = useState(0);
  const isStoreScrolling = useRef(false);
  const isPopularScrolling = useRef(false);

  // State for dynamic data
  const [categories, setCategories] = useState([]);
  const [popularProducts, setPopularProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // API Base URL - corrected based on your Postman
  const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

  // Fetch categories from API
  const fetchCategories = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/catalog/categories`);
      if (!response.ok) throw new Error('Failed to fetch categories');
      
      const data = await response.json();
      console.log('Categories data:', data);

      // Handle different response formats
      if (Array.isArray(data)) {
        setCategories(data);
      } else if (data.categories && Array.isArray(data.categories)) {
        setCategories(data.categories);
      } else if (data.success !== false) {
        setCategories(Array.isArray(data) ? data : []);
      } else {
        setCategories([]);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      Alert.alert('Error', 'Failed to load categories');
      setCategories([]);
    }
  };

  // Fetch popular products from API - corrected endpoint
  const fetchPopularProducts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/catalog/products/featured`);
      if (!response.ok) throw new Error('Failed to fetch featured products');
      
      const data = await response.json();
      console.log('Featured products data:', data);

      // Handle different response formats
      if (Array.isArray(data)) {
        setPopularProducts(data);
      } else if (data.products && Array.isArray(data.products)) {
        setPopularProducts(data.products);
      } else if (data.success !== false) {
        setPopularProducts(Array.isArray(data) ? data : []);
      } else {
        setPopularProducts([]);
      }
    } catch (error) {
      console.error('Error fetching popular products:', error);
      Alert.alert('Error', 'Failed to load popular products');
      setPopularProducts([]);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchCategories(), fetchPopularProducts()]);
      setLoading(false);
    };

    fetchData();
  }, []);

  // Handle pull-to-refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchCategories(), fetchPopularProducts()]);
    setRefreshing(false);
  };

  // Create infinite loop arrays only when data is available
  const infiniteStoreCards = [...storeCards, ...storeCards, ...storeCards];
  const infinitePopularProducts = popularProducts.length > 0 
    ? [...popularProducts, ...popularProducts, ...popularProducts, ...popularProducts, ...popularProducts]
    : [];

  useEffect(() => {
    // Set initial position to middle set of cards
    setTimeout(() => {
      storeScrollRef.current?.scrollTo({
        x: storeCards.length * (CARD_WIDTH + CARD_SPACING),
        animated: false,
      });
      
      if (popularProducts.length > 0) {
        popularScrollRef.current?.scrollTo({
          x: popularProducts.length * (POPULAR_CARD_WIDTH + POPULAR_CARD_SPACING),
          animated: false,
        });
      }
    }, 100);
  }, [popularProducts.length]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isStoreScrolling.current) {
        setCurrentStoreIndex((prevIndex) => {
          const nextIndex = prevIndex + 1;
          const scrollX = (storeCards.length + (nextIndex % storeCards.length)) * (CARD_WIDTH + CARD_SPACING);
          storeScrollRef.current?.scrollTo({
            x: scrollX,
            animated: true,
          });
          return nextIndex % storeCards.length;
        });
      }
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  const handleStoreScroll = (event) => {
    const scrollX = event.nativeEvent.contentOffset.x;
    const cardTotalWidth = CARD_WIDTH + CARD_SPACING;
    const totalWidth = storeCards.length * cardTotalWidth;

    // Reset to middle set if we've scrolled too far in either direction
    if (scrollX <= 0) {
      storeScrollRef.current?.scrollTo({
        x: totalWidth,
        animated: false,
      });
    } else if (scrollX >= totalWidth * 2) {
      storeScrollRef.current?.scrollTo({
        x: totalWidth,
        animated: false,
      });
    }
  };

  const handlePopularScroll = (event) => {
    if (popularProducts.length === 0) return;
    
    const scrollX = event.nativeEvent.contentOffset.x;
    const cardTotalWidth = POPULAR_CARD_WIDTH + POPULAR_CARD_SPACING;
    const totalWidth = popularProducts.length * cardTotalWidth;

    // Seamless infinite loop: when reaching the end of first set, jump to start of second set
    if (scrollX >= totalWidth * 2) {
      popularScrollRef.current?.scrollTo({
        x: totalWidth,
        animated: false,
      });
    }
    // When reaching the start of second set, jump to end of first set
    else if (scrollX <= totalWidth - cardTotalWidth) {
      popularScrollRef.current?.scrollTo({
        x: totalWidth * 2 - cardTotalWidth,
        animated: false,
      });
    }
  };

  const handleAddToCart = (product) => {
    addToCart(product);
  };

  const handleMiniCartPress = () => {
    router.push('/cart');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.light.tint]}
            tintColor={Colors.light.tint}
          />
        }
      >
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#EF4444" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search 'Salted Butter'"
              placeholderTextColor="#BDBDBD"
            />
          </View>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/cart')}
          >
            <Ionicons name="cart-outline" size={22} color="#1A1A1A" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Featured Stores</Text>
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          </View>
          <View style={styles.storesContainer}>
            <ScrollView
              ref={storeScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={CARD_WIDTH + CARD_SPACING}
              decelerationRate="fast"
              contentContainerStyle={styles.storesScroll}
              style={styles.storesScrollContainer}
              onScroll={handleStoreScroll}
              scrollEventThrottle={16}
              onScrollBeginDrag={() => { isStoreScrolling.current = true; }}
              onScrollEndDrag={() => { isStoreScrolling.current = false; }}
            >
              {infiniteStoreCards.map((store, index) => (
                <TouchableOpacity
                  key={`${store.id}-${index}`}
                  style={styles.storeCard}
                  onPress={() => {
                    console.log(`Navigating to ${store.title}`);
                    router.push('/categories');
                  }}
                  activeOpacity={0.9}
                >
                  <Image source={store.image} style={styles.storeImageFull} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shop by category</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.tint} />
              <Text style={styles.loadingText}>Loading categories...</Text>
            </View>
          ) : categories.length > 0 ? (
            <View style={styles.categoriesGrid}>
              {categories.map((category) => (
                <CategoryTile
                  key={category._id || category.id}
                  name={category.name}
                  image={category.image}
                  color={category.color || '#E3F2FD'}
                  onPress={() => {
                    console.log(`Category ${category.name} clicked`);
                    router.push({
                      pathname: '/categories',
                      params: { categoryId: category._id }
                    });
                  }}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No categories found</Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular</Text>
            <View style={styles.fireIcon}>
              <Text style={styles.fireEmoji}>🔥</Text>
            </View>
          </View>
          <Text style={styles.popularSubtext}>Most frequently bought</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.tint} />
              <Text style={styles.loadingText}>Loading popular products...</Text>
            </View>
          ) : popularProducts.length > 0 ? (
            <View style={styles.popularContainer}>
              <ScrollView
                ref={popularScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.popularScroll}
                snapToInterval={POPULAR_CARD_WIDTH + POPULAR_CARD_SPACING}
                decelerationRate="fast"
                style={styles.popularScrollContainer}
                onScroll={handlePopularScroll}
                scrollEventThrottle={16}
                onScrollBeginDrag={() => { isPopularScrolling.current = true; }}
                onScrollEndDrag={() => { isPopularScrolling.current = false; }}
              >
                {infinitePopularProducts.map((product, index) => (
                  <View key={`${product._id || product.id}-${index}`} style={styles.productCardWrapper}>
                    <ProductCard
                      product={product}
                      onAddToCart={handleAddToCart}
                    />
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No popular products found</Text>
            </View>
          )}
        </View>

        <View style={[styles.section, { marginBottom: 100 }]}>
          <Text style={styles.sectionTitle}>Quick links</Text>
          <View style={styles.quickLinksRow}>
            <TouchableOpacity
              style={styles.quickLinkCard}
              onPress={() => {
                console.log('Wallet clicked');
                router.push('/wallet');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.quickLinkIconContainer, { backgroundColor: '#06B6D4' }]}>
                <Text style={styles.quickLinkEmoji}>💳</Text>
              </View>
              <Text style={styles.quickLinkTitle}>Wallet</Text>
              <Text style={styles.quickLinkSubtext}>₹0.3k</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickLinkCard}
              onPress={() => {
                console.log('Orders clicked');
                router.push('/orders');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.quickLinkIconContainer, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.quickLinkEmoji}>📋</Text>
              </View>
              <Text style={styles.quickLinkTitle}>Orders</Text>
              <Text style={styles.quickLinkSubtext}>Track orders</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickLinkCard}
              onPress={() => {
                console.log('My list clicked');
                router.push('/categories');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.quickLinkIconContainer, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.quickLinkEmoji}>❤️</Text>
              </View>
              <Text style={styles.quickLinkTitle}>My list</Text>
              <Text style={styles.quickLinkSubtext}>Shop</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
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
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.light.white,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.light.tint,
    borderRadius: 10,
    minWidth: 45,
    height: 22,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
  },
  newBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  storesContainer: {
    marginHorizontal: -16,
  },
  storesScrollContainer: {
    overflow: 'visible',
  },
  storesScroll: {
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  storeCard: {
    width: CARD_WIDTH,
    aspectRatio: 16 / 9,
    marginRight: CARD_SPACING,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  storeImageFull: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  popularSubtext: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginTop: 4,
    marginBottom: 12,
    fontWeight: '400',
  },
  popularContainer: {
    marginHorizontal: -16,
  },
  popularScrollContainer: {
    overflow: 'visible',
  },
  popularScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  productCardWrapper: {
    width: POPULAR_CARD_WIDTH,
    marginRight: POPULAR_CARD_SPACING,
  },
  fireIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFF4E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fireEmoji: {
    fontSize: 18,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  quickLinksRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  quickLinkCard: {
    flex: 1,
    alignItems: 'center',
  },
  quickLinkIconContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  quickLinkEmoji: {
    fontSize: 36,
  },
  quickLinkTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 2,
  },
  quickLinkSubtext: {
    fontSize: 13,
    color: '#9E9E9E',
    fontWeight: '400',
  },
});
