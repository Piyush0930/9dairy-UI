import CartToast from '@/components/CartToast';
import CategoryTile from '@/components/CategoryTile';
import ProductCard from '@/components/ProductCard';
import Colors from '@/constants/colors';
import { useCart } from '@/contexts/CartContext';
import { categories, popularProducts } from '@/mocks/products';
import { Feather, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const storeCards = [
  {
    id: 1,
    title: 'Fresh Dairy',
    subtitle: 'Milk, butter, cheese,\nfresh paneer...',
    image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=300',
    color: '#E3F2FD',
  },
  {
    id: 2,
    title: 'Ice Cream Store',
    subtitle: 'Vanilla, chocolate,\nstrawberry, mango...',
    image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=300',
    color: '#FFE4E1',
  },
  {
    id: 3,
    title: 'Ghee & Butter',
    subtitle: 'Pure cow ghee,\nsalted & unsalted butter...',
    image: 'https://images.unsplash.com/photo-1619108224582-b8b4c3f6e83d?w=300',
    color: '#FFF8DC',
  },
];

export default function HomeScreen() {
  const { getTotalItems, addToCart } = useCart();
  const cartCount = getTotalItems();
  const insets = useSafeAreaInsets();
  const storeScrollRef = useRef(null);
  const popularScrollRef = useRef(null);
  const [currentStoreIndex, setCurrentStoreIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStoreIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % storeCards.length;
        storeScrollRef.current?.scrollTo({
          x: nextIndex * (width - 44),
          animated: true,
        });
        return nextIndex;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <CartToast />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
          <TouchableOpacity style={styles.iconButton}>
            <MaterialIcons name="qr-code-scanner" size={22} color="#EF4444" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push('/cart')}
          >
            <Ionicons name="cart-outline" size={22} color="#1A1A1A" />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartCount}</Text>
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
          <ScrollView
            ref={storeScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={width - 44}
            decelerationRate="fast"
            pagingEnabled
            contentContainerStyle={styles.storesScroll}
          >
            {storeCards.map((store) => (
              <TouchableOpacity
                key={store.id}
                style={[styles.storeCard, { backgroundColor: store.color }]}
                onPress={() => {
                  console.log(`Navigating to ${store.title}`);
                  router.push('/categories');
                }}
                activeOpacity={0.9}
              >
                <View style={styles.storeContent}>
                  <Text style={styles.storeTitle}>{store.title}</Text>
                  <Text style={styles.storeSubtext}>{store.subtitle}</Text>
                  <TouchableOpacity
                    style={styles.shopNowButton}
                    onPress={() => {
                      console.log(`Shop now clicked for ${store.title}`);
                      router.push('/categories');
                    }}
                  >
                    <Text style={styles.shopNowText}>Shop Now</Text>
                    <Feather name="chevron-right" size={14} color="#1A1A1A" />
                  </TouchableOpacity>
                </View>
                <Image source={{ uri: store.image }} style={styles.storeImage} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.storeIndicators}>
            {storeCards.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  currentStoreIndex === index && styles.indicatorActive,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shop by category</Text>
          <View style={styles.categoriesGrid}>
            {categories.map((category) => (
              <CategoryTile
                key={category.id}
                name={category.name}
                icon={category.icon}
                color={category.color}
                onPress={() => {
                  console.log(`Category ${category.name} clicked`);
                  router.push('/categories');
                }}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Popular</Text>
            <View style={styles.fireIcon}>
              <Text style={styles.fireEmoji}>🔥</Text>
            </View>
          </View>
          <Text style={styles.popularSubtext}>Most frequently bought</Text>
          <ScrollView
            ref={popularScrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.popularScroll}
            decelerationRate="normal"
          >
            {popularProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={addToCart}
              />
            ))}
          </ScrollView>
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
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
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
  storesScroll: {
    paddingRight: 16,
  },
  storeCard: {
    width: width - 44,
    marginRight: 12,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  storeContent: {
    flex: 1,
    justifyContent: 'center',
  },
  storeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 8,
  },
  storeSubtext: {
    fontSize: 13,
    color: '#757575',
    lineHeight: 19,
    fontWeight: '400',
    marginBottom: 12,
  },
  shopNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  shopNowText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  storeImage: {
    width: 110,
    height: 110,
    borderRadius: 16,
  },
  storeIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  indicatorActive: {
    backgroundColor: Colors.light.tint,
    width: 24,
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
  justInBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  justInBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
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
  exploreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  pageIndicator: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pageIndicatorText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  exploreScroll: {
    paddingRight: 16,
  },
  promoCard: {
    backgroundColor: '#7C3AED',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 324,
    height: 200,
    marginRight: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  promoContent: {
    flex: 1,
    zIndex: 2,
  },
  promoTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 24,
  },
  promoDescription: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
    marginBottom: 16,
    fontWeight: '400',
  },
  orderNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  orderNowText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  promoImage: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 80,
    height: 140,
    borderRadius: 8,
  },
  promoImageSmall: {
    position: 'absolute',
    right: 110,
    bottom: 20,
    width: 60,
    height: 120,
    borderRadius: 8,
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
  popularScroll: {
    paddingRight: 16,
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
});