// app/(admin)/orders.jsx

import { FontAwesome, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { File } from 'expo-file-system';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { downloadAsync } from 'expo-file-system/legacy';

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;

const statusOrder = [
  "pending",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
];

/* ---------- STATUS HELPERS ---------- */

function getStatusIcon(status) {
  switch (status) {
    case "delivered":
      return <FontAwesome name="check-circle" size={16} color="#4CAF50" />;
    case "out_for_delivery":
      return <MaterialIcons name="local-shipping" size={16} color={Colors.light.accent} />;
    case "pending":
      return <Ionicons name="time-outline" size={16} color="#FF9800" />;
    case "confirmed":
      return <FontAwesome name="check" size={16} color="#4CAF50" />;
    case "preparing":
      return <MaterialIcons name="build" size={16} color="#FF9800" />;
    case "cancelled":
      return <MaterialIcons name="cancel" size={16} color="#F44336" />;
    default:
      return <Ionicons name="time-outline" size={16} color="#FF9800" />;
  }
}

function getStatusText(status) {
  switch (status) {
    case "delivered": return "Delivered";
    case "out_for_delivery": return "Out for Delivery";
    case "pending": return "Pending";
    case "confirmed": return "Confirmed";
    case "preparing": return "Preparing";
    case "cancelled": return "Cancelled";
    default: return "Pending";
  }
}

function getStatusColor(status) {
  switch (status) {
    case "delivered": return "#4CAF50";
    case "out_for_delivery": return Colors.light.accent;
    case "pending": return "#FF9800";
    case "confirmed": return "#2196F3";
    case "preparing": return "#FF9800";
    case "cancelled": return "#F44336";
    default: return "#FF9800";
  }
}

function getStatusBackgroundColor(status) {
  switch (status) {
    case "delivered": return "rgba(76, 175, 80, 0.1)";
    case "out_for_delivery": return "rgba(33, 150, 243, 0.1)";
    case "pending": return "rgba(255, 152, 0, 0.1)";
    case "confirmed": return "rgba(33, 150, 243, 0.1)";
    case "preparing": return "rgba(255, 152, 0, 0.1)";
    case "cancelled": return "rgba(244, 67, 54, 0.1)";
    default: return "rgba(255, 152, 0, 0.1)";
  }
}

/* ---------- PRICE HELPER FUNCTIONS ---------- */

const getItemPrice = (item) => {
  // 🔥 CRITICAL FIX: Always use the price stored in the order item (this is the final charged override price)
  // NOT the product.price which is the default catalog price
  return item.price || item.finalPrice || 0;
};

const isPriceOverridden = (item) => {
  return item.isPriceOverridden || false;
};

const getItemTotal = (item) => {
  const price = getItemPrice(item); // This uses the override price
  const quantity = item.quantity || 0;
  return price * quantity;
};

const getOrderTotal = (order) => {
  return order.finalAmount || order.totalAmount || 0;
};

/* ---------- MAIN COMPONENT ---------- */

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const { authToken, isLoading: authLoading, isAuthenticated, validateToken } = useAuth();
  const router = useRouter();
  
  const [orders, setOrders] = useState([]);
  const [offlineOrders, setOfflineOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("orders");
  const [expandedOrder, setExpandedOrder] = useState(null);

  /* ---------- API HELPERS ---------- */
  const handleApiError = (error, msg) => {
    console.error("API Error:", error);
    Alert.alert("Error", msg || "Something went wrong.");
  };

  const validateAuthBeforeCall = async () => {
    if (!authToken || !isAuthenticated) return false;
    const ok = await validateToken();
    if (!ok) {
      Alert.alert("Session Expired", "Please login again");
      return false;
    }
    return true;
  };

  const fetchOrders = async () => {
    if (!(await validateAuthBeforeCall())) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/orders/retailer/my-orders`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch orders");
      
      console.log('📦 Raw orders data:', data.orders);
      
      // Process orders - ENSURE ONLY OVERRIDE PRICES ARE USED
      const processedOrders = (data.orders || []).map(order => {
        console.log(`🛒 Processing order ${order.orderId}:`, {
          items: order.items,
          totalAmount: order.totalAmount,
          finalAmount: order.finalAmount,
          priceSource: order.priceSource
        });
        
        const processedItems = order.items?.map(item => {
          const finalPrice = getItemPrice(item); // This is the override price
          const isOverridden = isPriceOverridden(item);
          
          console.log(`📦 Order item ${item.product?.name}:`, {
            storedPrice: item.price, // This should be the override price
            productPrice: item.product?.price, // This is the default price (IGNORE THIS)
            finalPrice: finalPrice,
            isPriceOverridden: isOverridden,
          });
          
          return {
            ...item,
            // 🔥 OVERRIDE the product price with the actual charged price
            product: item.product ? {
              ...item.product,
              price: finalPrice // Replace product price with override price
            } : item.product,
            price: finalPrice,
            finalPrice: finalPrice,
            displayPrice: finalPrice,
            isPriceOverridden: isOverridden,
          };
        }) || [];
        
        // Calculate totals based on override prices
        const calculatedSubtotal = processedItems.reduce((sum, item) => sum + getItemTotal(item), 0);
        const calculatedTotal = order.finalAmount || calculatedSubtotal;
        
        console.log(`💰 Order ${order.orderId} totals:`, {
          calculatedSubtotal,
          calculatedTotal,
          storedFinalAmount: order.finalAmount,
        });
        
        return {
          ...order,
          items: processedItems,
          calculatedSubtotal,
          calculatedTotal,
          finalAmount: calculatedTotal,
          totalAmount: calculatedSubtotal
        };
      });
      
      setOrders(processedOrders);
    } catch (e) {
      handleApiError(e, "Failed to fetch orders");
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchOfflineOrders = async () => {
    if (!(await validateAuthBeforeCall())) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/orders/retailer/order-history?type=offline`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch offline orders");
      
      console.log('📦 Raw offline orders data:', data.orders);
      
      // Process offline orders - ENSURE ONLY OVERRIDE PRICES ARE USED
      const processedOrders = (data.orders || []).map(order => {
        const processedItems = order.items?.map(item => {
          const finalPrice = getItemPrice(item);
          const isOverridden = isPriceOverridden(item);
          
          return {
            ...item,
            // 🔥 OVERRIDE the product price with the actual charged price
            product: item.product ? {
              ...item.product,
              price: finalPrice // Replace product price with override price
            } : item.product,
            price: finalPrice,
            finalPrice: finalPrice,
            displayPrice: finalPrice,
            isPriceOverridden: isOverridden,
          };
        }) || [];
        
        // Calculate totals based on override prices
        const calculatedSubtotal = processedItems.reduce((sum, item) => sum + getItemTotal(item), 0);
        const calculatedTotal = order.finalAmount || calculatedSubtotal;
        
        return {
          ...order,
          items: processedItems,
          calculatedSubtotal,
          calculatedTotal,
          finalAmount: calculatedTotal,
          totalAmount: calculatedSubtotal
        };
      });
      
      setOfflineOrders(processedOrders);
    } catch (e) {
      handleApiError(e, "Failed to fetch offline orders");
      setOfflineOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchOrderHistory = async () => {
    if (!(await validateAuthBeforeCall())) {
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/orders/retailer/order-history`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch order history");
      
      console.log('📦 Raw order history data:', data.orders);
      
      // Process orders for history view - ENSURE ONLY OVERRIDE PRICES ARE USED
      const processedOrders = (data.orders || []).map(order => {
        const processedItems = order.items?.map(item => {
          const finalPrice = getItemPrice(item);
          const isOverridden = isPriceOverridden(item);
          
          return {
            ...item,
            // 🔥 OVERRIDE the product price with the actual charged price
            product: item.product ? {
              ...item.product,
              price: finalPrice // Replace product price with override price
            } : item.product,
            price: finalPrice,
            finalPrice: finalPrice,
            displayPrice: finalPrice,
            isPriceOverridden: isOverridden,
          };
        }) || [];
        
        const calculatedSubtotal = processedItems.reduce((sum, item) => sum + getItemTotal(item), 0);
        const calculatedTotal = order.finalAmount || calculatedSubtotal;
        
        return {
          ...order,
          items: processedItems,
          calculatedSubtotal,
          calculatedTotal,
          finalAmount: calculatedTotal,
          totalAmount: calculatedSubtotal
        };
      });
      
      setOrders(processedOrders);
    } catch (e) {
      handleApiError(e, "Failed to fetch order history");
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (activeFilter === "offline") {
      await fetchOfflineOrders();
    } else if (activeFilter === "history") {
      await fetchOrderHistory();
    } else {
      await fetchOrders();
    }
  };

  /* ---------- LOAD DATA ON FILTER CHANGE ---------- */
  useEffect(() => {
    if (!authLoading && authToken && isAuthenticated) {
      setLoading(true);
      if (activeFilter === "offline") {
        fetchOfflineOrders();
      } else if (activeFilter === "history") {
        fetchOrderHistory();
      } else {
        fetchOrders();
      }
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [activeFilter, authToken, authLoading, isAuthenticated]);

  /* ---------- NAVIGATE TO OFFLINE ORDER PAGE WITH SCANNER AUTO-OPEN ---------- */
  const navigateToOfflineOrder = () => {
    router.push({
      pathname: "/(admin)/offline-order",
      params: { autoOpenScanner: "true" }
    });
  };

  /* ---------- ORDER STATUS ACTIONS ---------- */
  const updateOrderStatus = async (orderId, newStatus) => {
    if (!(await validateAuthBeforeCall())) return;
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      Alert.alert("Success", "Status updated");
      onRefresh(); // Refresh current view
    } catch (e) {
      handleApiError(e);
    }
  };

  const cancelOrder = async (orderId) => {
    if (!(await validateAuthBeforeCall())) return;
    try {
      const res = await fetch(`${API_BASE_URL}/orders/${orderId}/cancel`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error((await res.json()).message);
      Alert.alert("Success", "Order cancelled");
      onRefresh(); // Refresh current view
    } catch (e) {
      handleApiError(e);
    }
  };

  const handleStatusChange = (orderId, selectedStatus) => {
    const order = activeFilter === "offline"
      ? offlineOrders.find(o => o.orderId === orderId)
      : orders.find(o => o.orderId === orderId);
    if (!order) return;
    const curIdx = statusOrder.indexOf(order.orderStatus);
    const selIdx = statusOrder.indexOf(selectedStatus);
    if (selectedStatus === "cancelled") {
      Alert.alert("Cancel Order", "Are you sure?", [
        { text: "No" },
        { text: "Yes", style: "destructive", onPress: () => cancelOrder(orderId) },
      ]);
      return;
    }
    if (selIdx < curIdx) {
      Alert.alert("Invalid", "Cannot revert status");
      return;
    }
    Alert.alert("Update Status", `Change to ${getStatusText(selectedStatus)}?`, [
      { text: "Cancel" },
      { text: "Update", onPress: () => updateOrderStatus(orderId, selectedStatus) },
    ]);
  };

  /* ---------- FIXED SHARE FUNCTIONS (NO DEPRECATION) ---------- */
  const shareOrderInvoice = async (orderId) => {
  if (!(await validateAuthBeforeCall())) return;
  try {
    const uri = FileSystem.documentDirectory + `invoice-${orderId}.pdf`;
    
    // Use legacy downloadAsync temporarily
    const dl = await downloadAsync(
      `${API_BASE_URL}/orders/${orderId}/invoice`,
      uri,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    if (dl.status !== 200) throw new Error('Download failed');
    await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
  } catch (e) {
    handleApiError(e, "Failed to share invoice");
  }
};

const shareOverallInvoice = async () => {
  if (!(await validateAuthBeforeCall())) return;
  try {
    const uri = FileSystem.documentDirectory + `overall-${new Date().toISOString().split("T")[0]}.pdf`;
    
    const dl = await downloadAsync(
      `${API_BASE_URL}/admin/invoices/pdf`,
      uri,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    if (dl.status !== 200) throw new Error('Download failed');
    await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
  } catch (e) {
    handleApiError(e, "Failed to share invoice");
  }
};

const shareOfflineOrders = async () => {
  if (!(await validateAuthBeforeCall())) return;
  try {
    const uri = FileSystem.documentDirectory + `offline-orders-${new Date().toISOString().split("T")[0]}.pdf`;
    
    const dl = await downloadAsync(
      `${API_BASE_URL}/admin/invoices/offline-orders`,
      uri,
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    if (dl.status !== 200) throw new Error('Download failed');
    await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
  } catch (e) {
    handleApiError(e, "Failed to share offline orders");
  }
};

  const handleShareAll = () => {
    if (activeFilter === "history") {
      shareOverallInvoice();
    } else if (activeFilter === "offline") {
      shareOfflineOrders();
    }
  };

  /* ---------- FILTERED DATA ---------- */
  const filteredOrders =
    activeFilter === "orders"
      ? (orders || []).filter(o => o.orderStatus !== "delivered" && o.orderStatus !== "cancelled")
      : activeFilter === "history"
        ? (orders || []).filter(o => o.orderStatus === "delivered")
        : offlineOrders;

  if (authLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* PROFESSIONAL HEADER */}
      <View style={styles.professionalHeader}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Orders</Text>
          {(activeFilter === "history" || activeFilter === "offline") && (
            <TouchableOpacity 
              style={styles.shareButton} 
              onPress={handleShareAll}
            >
              <MaterialIcons name="share" size={20} color={Colors.light.accent} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* FILTER TABS */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === "orders" && styles.filterButtonActive]}
          onPress={() => setActiveFilter("orders")}
        >
          <Text style={[styles.filterButtonText, activeFilter === "orders" && styles.filterButtonTextActive]}>
            Active Orders
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === "history" && styles.filterButtonActive]}
          onPress={() => setActiveFilter("history")}
        >
          <Text style={[styles.filterButtonText, activeFilter === "history" && styles.filterButtonTextActive]}>
            Order History
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === "offline" && styles.filterButtonActive]}
          onPress={() => setActiveFilter("offline")}
        >
          <Text style={[styles.filterButtonText, activeFilter === "offline" && styles.filterButtonTextActive]}>
            Offline Orders
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.light.accent]} />}
      >
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.accent} />
            <Text style={styles.loadingText}>Loading orders...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inventory" size={48} color={Colors.light.textSecondary} />
            <Text style={styles.emptyText}>
              {activeFilter === "orders"
                ? "No active orders"
                : activeFilter === "history"
                  ? "No order history"
                  : "No offline orders"}
            </Text>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredOrders.map(order => {
            if (!order) return null;
            const isExpanded = expandedOrder === order._id;
            const finalAmount = getOrderTotal(order);
            
            console.log(`🎯 Rendering order ${order.orderId}:`, {
              finalAmount,
              calculatedTotal: order.calculatedTotal,
              priceSource: order.priceSource,
              items: order.items?.map(item => ({
                name: item.product?.name,
                price: item.price, // This is the override price
                productPrice: item.product?.price, // This should now match the override price
                isOverridden: item.isPriceOverridden,
              }))
            });
            
            return (
              <TouchableOpacity
                key={order._id}
                style={styles.orderCard}
                onPress={() => setExpandedOrder(isExpanded ? null : order._id)}
                activeOpacity={0.7}
              >
                {/* CARD HEADER */}
                <View style={styles.orderHeader}>
                  <View style={styles.orderIdRow}>
                    <Text style={styles.orderIdLarge}>Order #{order.orderId}</Text>
                    <Text style={styles.orderDate}>
                      {new Date(order.createdAt).toLocaleDateString("en-IN")}
                    </Text>
                    <Text style={[
                      styles.orderTypeBadge,
                      order.orderType === 'offline' ? styles.offlineBadge : styles.onlineBadge
                    ]}>
                      {order.orderType === 'offline' ? 'Offline' : 'Online'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: getStatusBackgroundColor(order.orderStatus),
                        borderColor: getStatusColor(order.orderStatus),
                      },
                    ]}
                  >
                    {getStatusIcon(order.orderStatus)}
                    <Text style={[styles.statusText, { color: getStatusColor(order.orderStatus) }]}>
                      {getStatusText(order.orderStatus)}
                    </Text>
                  </View>
                </View>

                {/* CUSTOMER */}
                <View style={styles.customerSection}>
                  <Text style={styles.sectionTitleSmall}>Customer:</Text>
                  <Text style={styles.itemText}>
                    {order.customerName ||
                      order.customer?.personalInfo?.fullName ||
                      order.customer?.fullName ||
                      (order.orderType === 'offline' ? "Walk-in Customer" : "N/A")}
                  </Text>
                  <Text style={styles.itemText}>
                    {order.customer?.personalInfo?.phone || order.customer?.phone || order.customerPhone || "N/A"}
                  </Text>
                </View>

                {/* DISTANCE */}
                {order.distance && (
                  <View style={styles.distanceSection}>
                    <MaterialIcons name="location-pin" size={14} color={Colors.light.accent} />
                    <Text style={styles.distanceText}>{order.distance} km away</Text>
                  </View>
                )}

                {/* ITEMS SUMMARY */}
                <View style={styles.itemsSection}>
                  <Text style={styles.sectionTitleSmall}>Items:</Text>
                  {order.items?.slice(0, 2).map((it, i) => (
                    <View key={i} style={styles.itemRow}>
                      <Text style={styles.itemText}>
                        {it.product?.name || it.name} - {it.quantity}x {it.unit || "unit"}
                      </Text>
                      <View style={styles.priceContainer}>
                        <Text style={styles.itemPriceText}>
                          {/* 🔥 This now shows the override price consistently */}
                          ₹{getItemPrice(it).toFixed(2)}
                        </Text>
                        {isPriceOverridden(it) && (
                          <View style={styles.overrideBadgeSmall}>
                            <Ionicons name="pricetag" size={8} color="#FFF" />
                            <Text style={styles.overrideTextSmall}>Custom</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                  {order.items?.length > 2 && (
                    <Text style={styles.moreItemsText}>+{order.items.length - 2} more</Text>
                  )}
                </View>

                {/* BILLING */}
                <View style={styles.billingSection}>
                  <View style={styles.billingRow}>
                    <Text style={styles.billingLabel}>Total Amount:</Text>
                    <Text style={styles.totalValue}>₹{finalAmount.toFixed(2)}</Text>
                  </View>
                </View>

                {/* DELIVERY */}
                <View style={styles.deliverySection}>
                  <MaterialIcons name="schedule" size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.deliveryLabel}>
                    Delivery: {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("en-IN") : "N/A"} at{" "}
                    {order.deliveryTime || "N/A"}
                  </Text>
                </View>

                {/* EXPAND BUTTON */}
                <TouchableOpacity
                  style={styles.expandButton}
                  onPress={() => setExpandedOrder(isExpanded ? null : order._id)}
                >
                  <Text style={styles.expandButtonText}>{isExpanded ? "Show Less" : "Show More Details"}</Text>
                  <MaterialIcons
                    name={isExpanded ? "expand-less" : "expand-more"}
                    size={20}
                    color={Colors.light.accent}
                  />
                </TouchableOpacity>

                {/* EXPANDED CONTENT */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {/* ALL ITEMS */}
                    <View style={styles.detailedItemsSection}>
                      <Text style={styles.sectionTitleSmall}>All Items:</Text>
                      {order.items?.map((it, i) => (
                        <View key={i} style={styles.detailedItemRow}>
                          <View style={styles.detailedItemInfo}>
                            <Text style={styles.detailedItemName}>{it.product?.name || it.name}</Text>
                            {isPriceOverridden(it) && (
                              <View style={styles.overrideBadge}>
                                <Ionicons name="pricetag" size={10} color="#FFF" />
                                <Text style={styles.overrideText}>Custom Price</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.detailedItemPricing}>
                            <Text style={styles.detailedItemText}>
                              {/* 🔥 This now shows the override price consistently */}
                              {it.quantity}x {it.unit || "unit"} @ ₹{getItemPrice(it).toFixed(2)}
                            </Text>
                            <Text style={styles.detailedItemTotal}>
                              ₹{getItemTotal(it).toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>

                    {/* BILLING DETAIL */}
                    <View style={styles.detailedBillingSection}>
                      <View style={styles.billingRow}>
                        <Text style={styles.billingLabel}>Subtotal:</Text>
                        <Text style={styles.billingValue}>
                          ₹{(order.calculatedSubtotal || order.totalAmount || 0).toFixed(2)}
                        </Text>
                      </View>
                      {order.discount > 0 && (
                        <View style={styles.billingRow}>
                          <Text style={styles.billingLabel}>Discount:</Text>
                          <Text style={styles.discountText}>-₹{order.discount.toFixed(2)}</Text>
                        </View>
                      )}
                      <View style={[styles.billingRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total Amount:</Text>
                        <Text style={styles.totalValue}>₹{finalAmount.toFixed(2)}</Text>
                      </View>
                    </View>

                    {/* ADDRESS */}
                    {order.deliveryAddress && (
                      <View style={styles.addressSection}>
                        <Text style={styles.sectionTitleSmall}>Delivery Address:</Text>
                        <Text style={styles.addressText}>{order.deliveryAddress.addressLine1}</Text>
                        {order.deliveryAddress.addressLine2 && (
                          <Text style={styles.addressText}>{order.deliveryAddress.addressLine2}</Text>
                        )}
                        <Text style={styles.addressText}>
                          {order.deliveryAddress.city}, {order.deliveryAddress.state} - {order.deliveryAddress.pincode}
                        </Text>
                        {order.deliveryAddress.landmark && (
                          <Text style={styles.addressText}>Landmark: {order.deliveryAddress.landmark}</Text>
                        )}
                      </View>
                    )}

                    {/* PAYMENT */}
                    <View style={styles.paymentSection}>
                      <Text style={styles.sectionTitleSmall}>Payment:</Text>
                      <Text style={styles.paymentText}>Method: {order.paymentMethod || "N/A"}</Text>
                      <Text style={styles.paymentText}>Status: {order.paymentStatus || "N/A"}</Text>
                      <Text style={styles.paymentText}>
                        Type: {order.orderType === 'offline' ? 'Offline Order' : 'Online Order'}
                      </Text>
                    </View>

                    {/* INSTRUCTIONS */}
                    {order.specialInstructions && (
                      <View style={styles.instructionsSection}>
                        <Text style={styles.sectionTitleSmall}>Instructions:</Text>
                        <Text style={styles.instructionsText}>{order.specialInstructions}</Text>
                      </View>
                    )}

                    {/* PROGRESS BAR */}
                    {activeFilter !== "offline" && order.orderStatus !== "cancelled" && (
                      <View style={styles.progressContainer}>
                        <Text style={styles.sectionTitleSmall}>Order Progress:</Text>
                        <View style={styles.progressBar}>
                          {statusOrder.map((st, idx) => {
                            const cur = statusOrder.indexOf(order.orderStatus);
                            const done = idx <= cur;
                            const current = idx === cur;
                            const clickable = idx >= cur;
                            return (
                              <View key={st} style={styles.progressStep}>
                                <TouchableOpacity
                                  style={[
                                    styles.progressDot,
                                    done && styles.progressDotCompleted,
                                    current && styles.progressDotCurrent,
                                  ]}
                                  onPress={() => clickable && handleStatusChange(order.orderId, st)}
                                  disabled={!clickable}
                                >
                                  {done && <FontAwesome name="check" size={10} color="#FFF" />}
                                </TouchableOpacity>
                                {idx < statusOrder.length - 1 && (
                                  <View
                                    style={[styles.progressLine, done && styles.progressLineCompleted]}
                                  />
                                )}
                              </View>
                            );
                          })}
                        </View>
                        <View style={styles.progressLabels}>
                          {statusOrder.map((st, idx) => {
                            const cur = statusOrder.indexOf(order.orderStatus);
                            const done = idx <= cur;
                            const current = idx === cur;
                            return (
                              <Text
                                key={st}
                                style={[
                                  styles.progressLabel,
                                  done && styles.progressLabelCompleted,
                                  current && styles.progressLabelCurrent,
                                ]}
                              >
                                {getStatusText(st)}
                              </Text>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* ADMIN ACTIONS */}
                    <View style={styles.adminActions}>
                      <TouchableOpacity style={styles.actionButton} onPress={() => shareOrderInvoice(order.orderId)}>
                        <MaterialIcons name="share" size={18} color={Colors.light.accent} />
                        <Text style={styles.actionButtonText}>Share Invoice</Text>
                      </TouchableOpacity>
                      {order.orderStatus !== "cancelled" && order.orderStatus !== "delivered" && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.cancelButton]}
                          onPress={() => cancelOrder(order.orderId)}
                        >
                          <MaterialIcons name="cancel" size={18} color="#F44336" />
                          <Text style={[styles.actionButtonText, { color: "#F44336" }]}>Cancel Order</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Floating Scanner Button - Now navigates directly to offline order page with auto-open scanner */}
      <TouchableOpacity style={styles.floatingScannerButton} onPress={navigateToOfflineOrder}>
        <Ionicons name="barcode" size={24} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

/* ---------- STYLES ---------- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.light.background },
  centered: { justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 16, color: Colors.light.textSecondary },
  
  /* PROFESSIONAL HEADER */
  professionalHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    minHeight: 72,
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.2)',
  },

  filterContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButton: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 8 },
  filterButtonActive: { backgroundColor: Colors.light.accent },
  filterButtonText: { fontSize: 14, fontWeight: "600", color: Colors.light.textSecondary },
  filterButtonTextActive: { color: "#FFF" },
  scrollView: { flex: 1 },
  scrollContent: { 
    paddingHorizontal: 16, 
    paddingTop: 8,
    paddingBottom: 100 
  },
  loadingContainer: { alignItems: "center", justifyContent: "center", padding: 40 },
  emptyContainer: { alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { marginTop: 16, fontSize: 16, color: Colors.light.textSecondary, textAlign: "center" },
  refreshButton: { marginTop: 16, backgroundColor: Colors.light.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  refreshButtonText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  orderCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  orderHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  orderIdRow: { flex: 1, marginRight: 12 },
  orderIdLarge: { fontSize: 16, fontWeight: "700", color: Colors.light.text, marginBottom: 4 },
  orderDate: { fontSize: 13, color: Colors.light.textSecondary },
  orderTypeBadge: {
    fontSize: 10,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  offlineBadge: {
    color: Colors.light.accent,
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  onlineBadge: {
    color: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 100,
    justifyContent: "center",
  },
  statusText: { fontSize: 12, fontWeight: "700" },
  customerSection: { marginBottom: 12 },
  itemsSection: { marginBottom: 12 },
  sectionTitleSmall: { fontSize: 14, fontWeight: "600", color: Colors.light.text, marginBottom: 6 },
  itemText: { fontSize: 14, color: Colors.light.textSecondary, marginBottom: 4 },
  itemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  priceContainer: { flexDirection: "row", alignItems: "center", gap: 4 },
  itemPriceText: { fontSize: 14, fontWeight: "600", color: Colors.light.accent },
  overrideBadgeSmall: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    gap: 1,
  },
  overrideTextSmall: { fontSize: 7, color: "#FFF", fontWeight: "600" },
  moreItemsText: { fontSize: 12, color: Colors.light.textSecondary, fontStyle: "italic" },
  billingSection: { marginBottom: 12 },
  billingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  billingLabel: { fontSize: 14, color: Colors.light.textSecondary },
  billingValue: { fontSize: 14, color: Colors.light.text },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: 8, marginTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: "600", color: Colors.light.text },
  totalValue: { fontSize: 16, fontWeight: "700", color: Colors.light.accent },
  discountText: { fontSize: 14, color: "#4CAF50", fontWeight: "600" },
  deliverySection: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 6 },
  deliveryLabel: { fontSize: 14, color: Colors.light.textSecondary },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  expandButtonText: { fontSize: 14, fontWeight: "600", color: Colors.light.accent, marginRight: 8 },
  expandedContent: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.light.border },
  detailedItemsSection: { marginBottom: 16 },
  detailedItemRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "flex-start", 
    marginBottom: 12, 
    paddingLeft: 8 
  },
  detailedItemInfo: { flex: 1 },
  detailedItemName: { fontSize: 14, color: Colors.light.text, marginBottom: 4, fontWeight: "600" },
  detailedItemPricing: { alignItems: "flex-end" },
  detailedItemText: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: 2 },
  detailedItemTotal: { fontSize: 14, fontWeight: "700", color: Colors.light.accent },
  overrideBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
    alignSelf: 'flex-start',
  },
  overrideText: { fontSize: 8, color: "#FFF", fontWeight: "600" },
  detailedBillingSection: {
    backgroundColor: "rgba(33, 150, 243, 0.05)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(33, 150, 243, 0.1)",
  },
  addressSection: { marginBottom: 16 },
  addressText: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: 2 },
  paymentSection: { marginBottom: 16 },
  paymentText: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: 2 },
  instructionsSection: { marginBottom: 16 },
  instructionsText: { fontSize: 13, color: Colors.light.textSecondary, fontStyle: "italic" },
  progressContainer: { marginTop: 8 },
  progressBar: { flexDirection: "row", alignItems: "center", marginBottom: 4, marginTop: 8 },
  progressStep: { flexDirection: "row", alignItems: "center", flex: 1 },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.light.border,
    alignItems: "center",
    justifyContent: "center",
  },
  progressDotCompleted: { backgroundColor: Colors.light.accent },
  progressDotCurrent: { backgroundColor: Colors.light.accent, borderWidth: 2, borderColor: "#FFF" },
  progressLine: { flex: 1, height: 2, backgroundColor: Colors.light.border, marginHorizontal: 4 },
  progressLineCompleted: { backgroundColor: Colors.light.accent },
  progressLabels: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { fontSize: 10, color: Colors.light.textSecondary, textAlign: "center", flex: 1 },
  progressLabelCompleted: { color: Colors.light.accent, fontWeight: "600" },
  progressLabelCurrent: { color: Colors.light.accent, fontWeight: "700" },
  adminActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(33, 150, 243, 0.1)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    justifyContent: "center",
  },
  cancelButton: { backgroundColor: "rgba(244, 67, 54, 0.1)", marginRight: 0, marginLeft: 8 },
  actionButtonText: { marginLeft: 6, fontSize: 14, fontWeight: "600", color: Colors.light.accent },
  distanceSection: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 6 },
  distanceText: { fontSize: 13, color: Colors.light.accent, fontWeight: "600" },

  floatingScannerButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: Colors.light.accent,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});