import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useReducer } from 'react';
import { useAuth } from './AuthContext';
import { useProfile } from './ProfileContext';

const CartContext = createContext();

// Action types
const CART_ACTIONS = {
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  UPDATE_QUANTITY: 'UPDATE_QUANTITY',
  CLEAR_CART: 'CLEAR_CART',
  SET_ITEMS: 'SET_ITEMS',
  SET_INVENTORY: 'SET_INVENTORY',
  SET_LOADING: 'SET_LOADING'
};

// Cart reducer
const cartReducer = (state, action) => {
  switch (action.type) {
    case CART_ACTIONS.SET_ITEMS:
      return {
        ...state,
        items: action.payload,
        loading: false
      };
    
    case CART_ACTIONS.ADD_ITEM:
      const existingItem = state.items.find(item => item._id === action.payload._id);
      
      if (existingItem) {
        // Update quantity if item already exists
        const updatedItems = state.items.map(item =>
          item._id === action.payload._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
        return { ...state, items: updatedItems };
      } else {
        // Add new item
        return { 
          ...state, 
          items: [...state.items, { ...action.payload, quantity: 1 }] 
        };
      }
    
    case CART_ACTIONS.REMOVE_ITEM:
      return {
        ...state,
        items: state.items.filter(item => item._id !== action.payload)
      };
    
    case CART_ACTIONS.UPDATE_QUANTITY:
      if (action.payload.quantity === 0) {
        return {
          ...state,
          items: state.items.filter(item => item._id !== action.payload.productId)
        };
      }
      
      return {
        ...state,
        items: state.items.map(item =>
          item._id === action.payload.productId
            ? { ...item, quantity: action.payload.quantity }
            : item
        )
      };
    
    case CART_ACTIONS.CLEAR_CART:
      return {
        ...state,
        items: []
      };
    
    case CART_ACTIONS.SET_INVENTORY:
      return {
        ...state,
        inventory: action.payload
      };
    
    case CART_ACTIONS.SET_LOADING:
      return {
        ...state,
        loading: action.payload
      };
    
    default:
      return state;
  }
};

const initialState = {
  items: [],
  inventory: [],
  loading: false
};

export const CartProvider = ({ children }) => {
  const [state, dispatch] = useReducer(cartReducer, initialState);
  const { authToken } = useAuth();
  const { assignedRetailer } = useProfile();

  // Load cart from storage on app start
  useEffect(() => {
    loadCartFromStorage();
  }, []);

  // Save cart to storage whenever items change
  useEffect(() => {
    saveCartToStorage();
  }, [state.items]);

  const loadCartFromStorage = async () => {
    try {
      const savedCart = await AsyncStorage.getItem('cart');
      if (savedCart) {
        const cartData = JSON.parse(savedCart);
        dispatch({ type: CART_ACTIONS.SET_ITEMS, payload: cartData.items || [] });
      }
    } catch (error) {
      console.error('Error loading cart from storage:', error);
    }
  };

  const saveCartToStorage = async () => {
    try {
      await AsyncStorage.setItem('cart', JSON.stringify({
        items: state.items,
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error('Error saving cart to storage:', error);
    }
  };

  // Enhanced pricing calculation (SAME AS CATEGORIES PAGE)
  const calculateProductPricing = (product, inventoryItem, currentCartQuantity = 0) => {
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
          
          // Only apply extended range if quantity meets the last slab's minimum
          if (!isExtendedRange) {
            applicableSlab = null;
          }
        }

        if (applicableSlab && applicableSlab.minQuantity > 1) {
          currentAppliedSlab = applicableSlab;
          
          // Calculate discounted price
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

          // ✅ EXTENDED RANGE FOR TIERS: Use last slab for higher quantities
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
      singlePieceDiscount,
      itemTotal: Math.round(currentPrice * currentCartQuantity * 100) / 100,
      baseTotal: Math.round(basePrice * currentCartQuantity * 100) / 100
    };
  };

  // Cart calculations with inventory
  const attachInventoryToCartItems = (cartItems, inventory) => {
    if (!Array.isArray(cartItems)) return [];
    if (!Array.isArray(inventory)) return cartItems;

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

    return cartItems.map(cartItem => {
      const productId = cartItem._id;
      
      let matchedInventory = null;
      
      if (productId && inventoryMap.has(productId)) {
        matchedInventory = inventoryMap.get(productId);
      }
      
      const soldByRetailer = matchedInventory !== null;
      const retailerStock = matchedInventory?.currentStock;
      const isOutOfStock = soldByRetailer && retailerStock !== undefined && Number(retailerStock) <= 0;
      
      const cartQuantity = getItemQuantity(cartItem._id);
      const pricing = calculateProductPricing(cartItem, matchedInventory, cartQuantity);
      
      return {
        ...cartItem,
        _inventory: matchedInventory,
        outOfStock: isOutOfStock,
        basePrice: matchedInventory?.sellingPrice || cartItem.price || 0,
        stock: cartItem?.stock,
        currentStock: matchedInventory?.currentStock,
        soldByRetailer: soldByRetailer,
        retailerPrice: matchedInventory?.sellingPrice,
        availableFromRetailer: soldByRetailer && !isOutOfStock,
        availableFromCatalog: !soldByRetailer,
        pricing: pricing
      };
    });
  };

  // Calculate cart totals with discounts
  const calculateCartTotals = () => {
    const cartItemsWithPricing = attachInventoryToCartItems(state.items, state.inventory);
    
    let subtotal = 0;
    let totalDiscount = 0;
    let totalSavings = 0;

    cartItemsWithPricing.forEach(item => {
      subtotal += item.pricing.baseTotal;
      totalDiscount += item.pricing.savings;
    });

    const finalTotal = subtotal - totalDiscount;
    totalSavings = totalDiscount;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      finalTotal: Math.round(finalTotal * 100) / 100,
      totalSavings: Math.round(totalSavings * 100) / 100,
      savingsPercentage: subtotal > 0 ? Math.round((totalSavings / subtotal) * 100 * 100) / 100 : 0,
      itemCount: state.items.length
    };
  };

  // Public methods
  const addToCart = (product) => {
    dispatch({ type: CART_ACTIONS.ADD_ITEM, payload: product });
  };

  const removeFromCart = (productId) => {
    dispatch({ type: CART_ACTIONS.REMOVE_ITEM, payload: productId });
  };

  const updateQuantity = (productId, quantity) => {
    dispatch({ type: CART_ACTIONS.UPDATE_QUANTITY, payload: { productId, quantity } });
  };

  const clearCart = () => {
    dispatch({ type: CART_ACTIONS.CLEAR_CART });
  };

  const setInventory = (inventory) => {
    dispatch({ type: CART_ACTIONS.SET_INVENTORY, payload: inventory });
  };

  // Getters
  const getItems = () => state.items;

  const getItemQuantity = (productId) => {
    const item = state.items.find(item => item._id === productId);
    return item ? item.quantity : 0;
  };

  const getTotalItems = () => {
    return state.items.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalAmount = () => {
    const totals = calculateCartTotals();
    return totals.finalTotal;
  };

  const getCartItemsWithPricing = () => {
    return attachInventoryToCartItems(state.items, state.inventory);
  };

  const getCartSummary = () => {
    return calculateCartTotals();
  };

  const isProductInCart = (productId) => {
    return state.items.some(item => item._id === productId);
  };

  const getProductQuantity = (productId) => {
    const item = state.items.find(item => item._id === productId);
    return item ? item.quantity : 0;
  };

  const value = {
    // State
    items: state.items,
    inventory: state.inventory,
    loading: state.loading,
    
    // Actions
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    setInventory,
    
    // Getters
    getItems,
    getItemQuantity,
    getTotalItems,
    getTotalAmount,
    getCartItemsWithPricing,
    getCartSummary,
    isProductInCart,
    getProductQuantity,
    
    // Calculations (export for consistency)
    calculateProductPricing,
    attachInventoryToCartItems
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};