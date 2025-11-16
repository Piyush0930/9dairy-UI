// contexts/CartContext.jsx
import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { useProfile } from "./ProfileContext";

export const [CartProvider, useCart] = createContextHook(() => {
  const { checkCartItemsAvailability, cartItemsStatus, clearCartStatus } = useProfile();
  
  const [items, setItems] = useState([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  
  // ⭐ Use ref to prevent infinite loops
  const itemsRef = useRef(items);
  const isCheckingRef = useRef(false);

  // Update ref when items change
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // ⭐ FIXED: Check cart items availability with proper dependencies
  useEffect(() => {
    if (isCheckingRef.current) return;
    
    if (items.length > 0) {
      isCheckingRef.current = true;
      checkCartItemsAvailability(items).finally(() => {
        isCheckingRef.current = false;
      });
    } else {
      clearCartStatus();
    }
  }, [items.length]); // ⭐ Only depend on items.length, not items array

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
    clearCartStatus();
  }, [clearCartStatus]);

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

  // ⭐ Get unavailable items count
  const getUnavailableItemsCount = useCallback(() => {
    return cartItemsStatus.filter(item => item.isOutOfStock).length;
  }, [cartItemsStatus]);

  // ⭐ Check if cart has unavailable items
  const hasUnavailableItems = useCallback(() => {
    return cartItemsStatus.some(item => item.isOutOfStock);
  }, [cartItemsStatus]);

  // ⭐ Get items that need quantity adjustment
  const getItemsNeedingAdjustment = useCallback(() => {
    return cartItemsStatus.filter(item => 
      item.isAvailable && item.availableStock < item.requestedQuantity
    );
  }, [cartItemsStatus]);

  // ⭐ Get item status by product ID
  const getItemStatus = useCallback((productId) => {
    return cartItemsStatus.find(status => 
      status.productId === productId
    );
  }, [cartItemsStatus]);

  return useMemo(() => ({
    items,
    addToCart,
    removeFromCart,
    setItemQuantity,
    clearCart,
    getTotalPrice,
    getTotalItems,
    getItemQuantity,
    showToast,
    toastMessage,
    // ⭐ Cart status functions
    getUnavailableItemsCount,
    hasUnavailableItems,
    getItemsNeedingAdjustment,
    getItemStatus,
    cartItemsStatus
  }), [
    items, addToCart, removeFromCart, setItemQuantity, clearCart, 
    getTotalPrice, getTotalItems, getItemQuantity, showToast, toastMessage,
    getUnavailableItemsCount, hasUnavailableItems, getItemsNeedingAdjustment, 
    getItemStatus, cartItemsStatus
  ]);
});