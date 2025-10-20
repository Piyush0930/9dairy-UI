import createContextHook from "@nkzw/create-context-hook";
import { useCallback, useMemo, useState } from "react";

export const [CartProvider, useCart] = createContextHook(() => {
  const [items, setItems] = useState([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const addToCart = useCallback((product) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        setToastMessage(`${product.name} quantity updated`);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
        return prev.map((item) =>
          item.product.id === product.id
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
      const existing = prev.find((item) => item.product.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      }
      return prev.filter((item) => item.product.id !== productId);
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
    const item = items.find((item) => item.product.id === productId);
    return item ? item.quantity : 0;
  }, [items]);

  return useMemo(() => ({
    items,
    addToCart,
    removeFromCart,
    clearCart,
    getTotalPrice,
    getTotalItems,
    getItemQuantity,
    showToast,
    toastMessage,
  }), [items, addToCart, removeFromCart, clearCart, getTotalPrice, getTotalItems, getItemQuantity, showToast, toastMessage]);
});