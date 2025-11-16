// contexts/CartContext.jsx
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useMemo, useState, useEffect } from "react";
import { useProfile } from "./ProfileContext";

export const [CartProvider, useCart] = createContextHook(() => {
  const { checkCartItemsAvailability, cartItemsStatus } = useProfile();
  
  const [items, setItems] = useState([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // ⭐ NEW: Check cart items availability when items change
  useEffect(() => {
    if (items.length > 0) {
      checkCartItemsAvailability(items);
    }
  }, [items.length, checkCartItemsAvailability]);

  const addToCart = useCallback((product) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product._id === product._id);
      if (existing) {
        setToastMessage(`${product.name} quantity updated`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
        return prev.map((item) =>
          item.product._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      setToastMessage(`${product.name} added to cart`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const removeFromCart = useCallback((productId) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product._id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map((item) =>
          item.product._id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      }
      return prev.filter((item) => item.product._id !== productId);
    });
  }, []);

  const setItemQuantity = useCallback((productId, quantity) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((item) => item.product._id !== productId);
      }
      return prev.map((item) =>
        item.product._id === productId
          ? { ...item, quantity }
          : item
      );
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const getTotalPrice = useCallback(() => {
    return items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );
  }, [items]);

  const getTotalItems = useCallback(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const getItemQuantity = useCallback((productId) => {
    const item = items.find((item) => item.product._id === productId);
    return item ? item.quantity : 0;
  }, [items]);

  // ⭐ NEW: Get unavailable items count
  const getUnavailableItemsCount = useCallback(() => {
    return cartItemsStatus.filter(item => item.isOutOfStock).length;
  }, [cartItemsStatus]);

  // ⭐ NEW: Check if cart has unavailable items
  const hasUnavailableItems = useCallback(() => {
    return cartItemsStatus.some(item => item.isOutOfStock);
  }, [cartItemsStatus]);

  // ⭐ NEW: Get items that need quantity adjustment
  const getItemsNeedingAdjustment = useCallback(() => {
    return cartItemsStatus.filter(item => 
      item.isAvailable && item.availableStock < item.requestedQuantity
    );
  }, [cartItemsStatus]);

  return useMemo(() => ({
    items,
    addToCart,
    removeFromCart,
    setItemQuantity, // ⭐ NEW
    clearCart,
    getTotalPrice,
    getTotalItems,
    getItemQuantity,
    showToast,
    toastMessage,
    // ⭐ NEW functions
    getUnavailableItemsCount,
    hasUnavailableItems,
    getItemsNeedingAdjustment,
    cartItemsStatus
  }), [
    items, addToCart, removeFromCart, setItemQuantity, clearCart, 
    getTotalPrice, getTotalItems, getItemQuantity, showToast, toastMessage,
    getUnavailableItemsCount, hasUnavailableItems, getItemsNeedingAdjustment, cartItemsStatus
  ]);
});