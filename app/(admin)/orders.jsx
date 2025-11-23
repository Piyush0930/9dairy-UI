// app/(admin)/orders.jsx

import { FontAwesome, Ionicons, MaterialIcons } from "@expo/vector-icons";
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

/* ---------- ENHANCED PRICE CALCULATION FUNCTIONS ---------- */

const getItemOriginalPrice = (item) => {
  return item.product?.price || item.originalPrice || item.price || 0;
};

const getItemFinalPrice = (item) => {
  return item.price || item.finalPrice || item.product?.price || 0;
};

const isPriceOverridden = (item) => {
  return item.isPriceOverridden || 
         (item.price && item.product?.price && item.price !== item.product.price);
};

const getItemQuantity = (item) => {
  return item.quantity || 0;
};

const getItemSubtotal = (item) => {
  const originalPrice = getItemOriginalPrice(item);
  const quantity = getItemQuantity(item);
  return originalPrice * quantity;
};

const getItemTotal = (item) => {
  const finalPrice = getItemFinalPrice(item);
  const quantity = getItemQuantity(item);
  return finalPrice * quantity;
};

const getOrderSubtotal = (order) => {
  if (!order.items || !order.items.length) return 0;
  return order.items.reduce((sum, item) => sum + getItemSubtotal(item), 0);
};

const getOrderTotalBeforeDiscount = (order) => {
  if (!order.items || !order.items.length) return 0;
  return order.items.reduce((sum, item) => sum + getItemTotal(item), 0);
};

const getOrderDiscount = (order) => {
  const subtotal = getOrderTotalBeforeDiscount(order);
  const finalAmount = order.finalAmount || subtotal;
  const discount = subtotal - finalAmount;
  return Math.max(0, discount);
};

const getOrderFinalAmount = (order) => {
  return order.finalAmount || getOrderTotalBeforeDiscount(order);
};

const calculateSavingsPercentage = (order) => {
  const subtotal = getOrderTotalBeforeDiscount(order);
  const finalAmount = getOrderFinalAmount(order);
  if (subtotal <= 0 || finalAmount >= subtotal) return 0;
  return ((subtotal - finalAmount) / subtotal * 100).toFixed(1);
};

/* ---------- MAIN COMPONENT ---------- */

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const { authToken, isLoading: authLoading, isAuthenticated, validateToken } = useAuth();
  const router = useRouter();
  
  const [activeOrders, setActiveOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
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

  const processOrderData = (order) => {
    const processedItems = order.items?.map(item => {
      const originalPrice = getItemOriginalPrice(item);
      const finalPrice = getItemFinalPrice(item);
      const isOverridden = isPriceOverridden(item);
      
      return {
        ...item,
        originalPrice,
        finalPrice,
        isPriceOverridden: isOverridden,
        itemSubtotal: getItemSubtotal(item),
        itemTotal: getItemTotal(item),
      };
    }) || [];

    const orderSubtotal = getOrderSubtotal({ ...order, items: processedItems });
    const totalBeforeDiscount = getOrderTotalBeforeDiscount({ ...order, items: processedItems });
    const discount = getOrderDiscount(order);
    const finalAmount = getOrderFinalAmount(order);
    const savingsPercentage = calculateSavingsPercentage(order);

    return {
      ...order,
      items: processedItems,
      orderSubtotal,
      totalBeforeDiscount,
      discount,
      finalAmount,
      savingsPercentage,
      calculatedSubtotal: orderSubtotal,
      calculatedTotal: finalAmount,
      orderType: order.orderType || 'online'
    };
  };

  /* ---------- FETCH ALL ORDER TYPES ---------- */
  const fetchActiveOrders = async () => {
    if (!(await validateAuthBeforeCall())) return [];
    try {
      const res = await fetch(`${API_BASE_URL}/orders/retailer/my-orders`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch active orders");
      
      console.log('📦 Active orders:', data.orders?.length || 0);
      
      // Filter only online orders for active tab
      const onlineOrders = (data.orders || []).filter(order => 
        order.orderType === 'online' || !order.orderType // include legacy orders without orderType
      );
      
      return onlineOrders.map(processOrderData);
    } catch (e) {
      handleApiError(e, "Failed to fetch active orders");
      return [];
    }
  };

  const fetchOrderHistory = async () => {
    if (!(await validateAuthBeforeCall())) return [];
    try {
      const res = await fetch(`${API_BASE_URL}/orders/retailer/order-history`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch order history");
      
      console.log('📦 Raw order history:', data.orders?.length || 0);
      
      // Filter only ONLINE orders that are delivered or cancelled
      const onlineHistoryOrders = (data.orders || []).filter(order => {
        const isOnline = order.orderType === 'online' || !order.orderType;
        const isCompleted = order.orderStatus === 'delivered' || order.orderStatus === 'cancelled';
        return isOnline && isCompleted;
      });
      
      console.log('📦 Filtered online order history:', onlineHistoryOrders.length);
      
      return onlineHistoryOrders.map(processOrderData);
    } catch (e) {
      handleApiError(e, "Failed to fetch order history");
      return [];
    }
  };

  const fetchOfflineOrders = async () => {
    if (!(await validateAuthBeforeCall())) return [];
    try {
      // Fetch ALL orders first
      const res = await fetch(`${API_BASE_URL}/orders/retailer/order-history`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch orders");
      
      console.log('📦 Raw all orders for offline filter:', data.orders?.length || 0);
      
      // Filter only OFFLINE orders (all statuses)
      const offlineOrdersData = (data.orders || []).filter(order => 
        order.orderType === 'offline'
      );
      
      console.log('📦 Filtered offline orders:', offlineOrdersData.length);
      
      return offlineOrdersData.map(processOrderData);
    } catch (e) {
      handleApiError(e, "Failed to fetch offline orders");
      return [];
    }
  };

  const fetchAllOrders = async () => {
    if (!(await validateAuthBeforeCall())) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch all order types in parallel
      const [active, history, offline] = await Promise.all([
        fetchActiveOrders(),
        fetchOrderHistory(),
        fetchOfflineOrders()
      ]);

      console.log('📊 Final Orders Summary:', {
        active: active.length,
        history: history.length,
        offline: offline.length
      });

      setActiveOrders(active);
      setOrderHistory(history);
      setOfflineOrders(offline);
      
    } catch (error) {
      console.error('Error fetching orders:', error);
      Alert.alert("Error", "Failed to load orders");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAllOrders();
  };

  /* ---------- LOAD DATA ON MOUNT ---------- */
  useEffect(() => {
    if (!authLoading && authToken && isAuthenticated) {
      fetchAllOrders();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authToken, authLoading, isAuthenticated]);

  /* ---------- GET FILTERED ORDERS ---------- */
  const getFilteredOrders = () => {
    switch (activeFilter) {
      case "orders":
        // Active online orders (not delivered/cancelled)
        return activeOrders.filter(order => 
          order.orderStatus !== "delivered" && 
          order.orderStatus !== "cancelled"
        );
      case "history":
        // Online order history (delivered/cancelled)
        return orderHistory;
      case "offline":
        // All offline orders
        return offlineOrders;
      default:
        return [];
    }
  };

  const filteredOrders = getFilteredOrders();

  /* ---------- NAVIGATE TO OFFLINE ORDER PAGES ---------- */
  const navigateToCreateBill = () => {
    router.push("/(admin)/offline-order");
  };

  const navigateToWalkIn = () => {
    router.push("/offline-customer");
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
      onRefresh();
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
      onRefresh();
    } catch (e) {
      handleApiError(e);
    }
  };

  const handleStatusChange = (orderId, selectedStatus) => {
    const allOrders = [...activeOrders, ...orderHistory, ...offlineOrders];
    const order = allOrders.find(o => o.orderId === orderId);
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

  /* ---------- SHARE FUNCTIONS ---------- */
  const shareOrderInvoice = async (orderId) => {
    if (!(await validateAuthBeforeCall())) return;
    try {
      const uri = FileSystem.documentDirectory + `invoice-${orderId}.pdf`;
      
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

      {/* ACTION BUTTONS BAR */}
      <View style={styles.actionButtonsContainer}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.createBillButton]}
          onPress={navigateToCreateBill}
        >
          <MaterialIcons name="receipt-long" size={18} color="#000" />
          <Text style={styles.actionButtonText}>Create Bill</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.walkInButton]}
          onPress={navigateToWalkIn}
        >
          <MaterialIcons name="person" size={18} color="#000" />
          <Text style={styles.actionButtonText}>Walk-in</Text>
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
            <MaterialIcons 
              name={
                activeFilter === "orders" ? "pending-actions" : 
                activeFilter === "history" ? "history" : 
                "point-of-sale"
              } 
              size={48} 
              color={Colors.light.textSecondary} 
            />
            <Text style={styles.emptyText}>
              {activeFilter === "orders"
                ? "No active online orders"
                : activeFilter === "history"
                  ? "No online order history"
                  : "No offline orders"}
            </Text>
            <Text style={styles.emptySubtext}>
              {activeFilter === "offline" 
                ? "Create your first offline order using the buttons above" 
                : "Pull down to refresh"}
            </Text>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredOrders.map(order => {
            if (!order) return null;
            const isExpanded = expandedOrder === order._id;
            
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

                {/* DISTANCE - Only for online orders */}
                {order.distance && order.orderType === 'online' && (
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
                          ₹{getItemFinalPrice(it).toFixed(2)}
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

                {/* ENHANCED BILLING SUMMARY - ALWAYS VISIBLE */}
                <View style={styles.billingSection}>
                  <View style={styles.billingRow}>
                    <Text style={styles.billingLabel}>Total Amount:</Text>
                    <Text style={styles.totalValue}>₹{order.finalAmount.toFixed(2)}</Text>
                  </View>
                  {order.discount > 0 && (
                    <View style={styles.billingRow}>
                      <Text style={styles.billingLabel}>You Saved:</Text>
                      <Text style={styles.savingsText}>
                        ₹{order.discount.toFixed(2)} ({order.savingsPercentage}%)
                      </Text>
                    </View>
                  )}
                </View>

                {/* DELIVERY - Only for online orders */}
                {order.orderType === 'online' && (
                  <View style={styles.deliverySection}>
                    <MaterialIcons name="schedule" size={14} color={Colors.light.textSecondary} />
                    <Text style={styles.deliveryLabel}>
                      Delivery: {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("en-IN") : "N/A"} at{" "}
                      {order.deliveryTime || "N/A"}
                    </Text>
                  </View>
                )}

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
                    {/* ALL ITEMS WITH PRICE DETAILS */}
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
                              {it.quantity}x {it.unit || "unit"} 
                            </Text>
                            <View style={styles.priceComparison}>
                              {isPriceOverridden(it) && (
                                <Text style={styles.originalPriceText}>
                                  ₹{getItemOriginalPrice(it).toFixed(2)}
                                </Text>
                              )}
                              <Text style={styles.finalPriceText}>
                                @ ₹{getItemFinalPrice(it).toFixed(2)}
                              </Text>
                            </View>
                            <Text style={styles.detailedItemTotal}>
                              ₹{getItemTotal(it).toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>

                    {/* ENHANCED BILLING DETAIL */}
                    <View style={styles.detailedBillingSection}>
                      <Text style={styles.billingSectionTitle}>Order Summary</Text>
                      
                      <View style={styles.billingRow}>
                        <Text style={styles.billingLabel}>Subtotal (Original):</Text>
                        <Text style={styles.billingValue}>
                          ₹{order.orderSubtotal.toFixed(2)}
                        </Text>
                      </View>

                      {order.totalBeforeDiscount !== order.orderSubtotal && (
                        <View style={styles.billingRow}>
                          <Text style={styles.billingLabel}>Price Adjustments:</Text>
                          <Text style={styles.adjustmentText}>
                            -₹{(order.orderSubtotal - order.totalBeforeDiscount).toFixed(2)}
                          </Text>
                        </View>
                      )}

                      <View style={styles.billingRow}>
                        <Text style={styles.billingLabel}>Total Before Discount:</Text>
                        <Text style={styles.billingValue}>
                          ₹{order.totalBeforeDiscount.toFixed(2)}
                        </Text>
                      </View>

                      {order.discount > 0 && (
                        <View style={styles.billingRow}>
                          <Text style={styles.billingLabel}>Discount:</Text>
                          <Text style={styles.discountText}>
                            -₹{order.discount.toFixed(2)}
                          </Text>
                        </View>
                      )}

                      <View style={[styles.billingRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Final Amount:</Text>
                        <Text style={styles.totalValue}>₹{order.finalAmount.toFixed(2)}</Text>
                      </View>

                      {order.discount > 0 && (
                        <View style={styles.savingsSection}>
                          <Text style={styles.savingsLabel}>
                            🎉 You saved ₹{order.discount.toFixed(2)} ({order.savingsPercentage}%) on this order!
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* ADDRESS - Only for online orders */}
                    {order.deliveryAddress && order.orderType === 'online' && (
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

                    {/* PROGRESS BAR - Only for online orders */}
                    {order.orderType === 'online' && order.orderStatus !== "cancelled" && activeFilter === "orders" && (
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
                      {order.orderStatus !== "cancelled" && order.orderStatus !== "delivered" && order.orderType === 'online' && (
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
    </View>
  );
}

/* ---------- ENHANCED STYLES ---------- */
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

  /* ACTION BUTTONS BAR */
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createBillButton: {
    backgroundColor: '#E3F2FD', // Light blue background
    borderWidth: 1,
    borderColor: Colors.light.accent,
  },
  walkInButton: {
    backgroundColor: '#E8F5E8', // Light green background
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#000000', // Full black color for clear visibility
    fontSize: 14,
    fontWeight: '700', // Bold for better readability
  },

  filterContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 0,
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
  filterButton: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "center", 
    paddingVertical: 10, 
    borderRadius: 8,
  },
  filterButtonActive: { backgroundColor: Colors.light.accent },
  filterButtonText: { fontSize: 14, fontWeight: "600", color: Colors.light.textSecondary },
  filterButtonTextActive: { color: "#FFF" },
  scrollView: { flex: 1 },
  scrollContent: { 
    paddingHorizontal: 16, 
    paddingTop: 8,
    paddingBottom: 20
  },
  loadingContainer: { alignItems: "center", justifyContent: "center", padding: 40 },
  emptyContainer: { alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { 
    marginTop: 16, 
    fontSize: 16, 
    color: Colors.light.textSecondary, 
    textAlign: "center",
    fontWeight: '600'
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
    opacity: 0.7
  },
  refreshButton: { 
    marginTop: 16, 
    backgroundColor: Colors.light.accent, 
    paddingHorizontal: 20, 
    paddingVertical: 10, 
    borderRadius: 8 
  },
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
  
  /* ENHANCED BILLING STYLES */
  billingSection: { 
    marginBottom: 12,
    backgroundColor: 'rgba(33, 150, 243, 0.03)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.1)',
  },
  billingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  billingLabel: { fontSize: 14, color: Colors.light.textSecondary },
  billingValue: { fontSize: 14, color: Colors.light.text },
  savingsText: { fontSize: 14, color: "#4CAF50", fontWeight: "600" },
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
  priceComparison: { flexDirection: "row", alignItems: "center", gap: 4 },
  originalPriceText: { 
    fontSize: 11, 
    color: Colors.light.textSecondary, 
    textDecorationLine: 'line-through' 
  },
  finalPriceText: { 
    fontSize: 13, 
    color: Colors.light.accent, 
    fontWeight: "600" 
  },
  detailedItemTotal: { fontSize: 14, fontWeight: "700", color: Colors.light.accent, marginTop: 2 },
  overrideBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  overrideText: { fontSize: 8, color: "#FFF", fontWeight: "600" },
  
  /* ENHANCED BILLING DETAILS */
  detailedBillingSection: {
    backgroundColor: "rgba(33, 150, 243, 0.05)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(33, 150, 243, 0.1)",
  },
  billingSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 12,
    textAlign: "center",
  },
  adjustmentText: {
    fontSize: 14,
    color: "#FF9800",
    fontWeight: "600",
  },
  savingsSection: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.2)",
  },
  savingsLabel: {
    fontSize: 12,
    color: "#4CAF50",
    fontWeight: "600",
    textAlign: "center",
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
});