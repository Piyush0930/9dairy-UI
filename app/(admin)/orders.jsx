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
  return item.price || item.finalPrice || 0;
};

const isPriceOverridden = (item) => {
  return item.isPriceOverridden || false;
};

const getItemTotal = (item) => {
  const price = getItemPrice(item);
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
      
      const processedOrders = (data.orders || []).map(order => {
        const processedItems = order.items?.map(item => {
          const finalPrice = getItemPrice(item);
          const isOverridden = isPriceOverridden(item);
          
          return {
            ...item,
            product: item.product ? {
              ...item.product,
              price: finalPrice
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
      
      const processedOrders = (data.orders || []).map(order => {
        const processedItems = order.items?.map(item => {
          const finalPrice = getItemPrice(item);
          const isOverridden = isPriceOverridden(item);
          
          return {
            ...item,
            product: item.product ? {
              ...item.product,
              price: finalPrice
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
      
      const processedOrders = (data.orders || []).map(order => {
        const processedItems = order.items?.map(item => {
          const finalPrice = getItemPrice(item);
          const isOverridden = isPriceOverridden(item);
          
          return {
            ...item,
            product: item.product ? {
              ...item.product,
              price: finalPrice
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

  const navigateToOfflineOrder = () => {
    router.push("/(admin)/offline-order");
  };

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

  const filteredOrders =
    activeFilter === "orders"
      ? (orders || []).filter(o => o.orderStatus !== "delivered" && o.orderStatus !== "cancelled")
      : activeFilter === "history"
        ? (orders || []).filter(o => o.orderStatus === "delivered")
        : offlineOrders;

  if (authLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-white" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color={Colors.light.accent} />
        <Text className="mt-4 text-base text-gray-500">Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      {/* PROFESSIONAL HEADER */}
      <View className="px-4 pt-4 pb-4 bg-white border-b border-gray-200 min-h-18 justify-center">
        <View className="flex-row items-center justify-between h-10">
          <Text className="text-2xl font-bold text-gray-900">Orders</Text>
          {(activeFilter === "history" || activeFilter === "offline") && (
            <TouchableOpacity 
              className="w-10 h-10 rounded-lg bg-blue-50 justify-center items-center border border-blue-200"
              onPress={handleShareAll}
            >
              <MaterialIcons name="share" size={20} color={Colors.light.accent} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* FILTER TABS */}
      <View className="flex-row mx-4 mt-2 mb-4 bg-white rounded-xl p-1 border border-gray-300 shadow-sm">
        <TouchableOpacity
          className={`flex-1 items-center justify-center py-2.5 rounded-lg ${activeFilter === "orders" ? "bg-blue-500" : ""}`}
          onPress={() => setActiveFilter("orders")}
        >
          <Text className={`text-sm font-semibold ${activeFilter === "orders" ? "text-white" : "text-gray-500"}`}>
            Active Orders
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 items-center justify-center py-2.5 rounded-lg ${activeFilter === "history" ? "bg-blue-500" : ""}`}
          onPress={() => setActiveFilter("history")}
        >
          <Text className={`text-sm font-semibold ${activeFilter === "history" ? "text-white" : "text-gray-500"}`}>
            Order History
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 items-center justify-center py-2.5 rounded-lg ${activeFilter === "offline" ? "bg-blue-500" : ""}`}
          onPress={() => setActiveFilter("offline")}
        >
          <Text className={`text-sm font-semibold ${activeFilter === "offline" ? "text-white" : "text-gray-500"}`}>
            Offline Orders
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.light.accent]} />}
      >
        {loading && !refreshing ? (
          <View className="items-center justify-center p-10">
            <ActivityIndicator size="large" color={Colors.light.accent} />
            <Text className="mt-4 text-base text-gray-500">Loading orders...</Text>
          </View>
        ) : filteredOrders.length === 0 ? (
          <View className="items-center justify-center p-10">
            <MaterialIcons name="inventory" size={48} color={Colors.light.textSecondary} />
            <Text className="mt-4 text-base text-gray-500 text-center">
              {activeFilter === "orders"
                ? "No active orders"
                : activeFilter === "history"
                  ? "No order history"
                  : "No offline orders"}
            </Text>
            <TouchableOpacity className="mt-4 bg-blue-500 px-5 py-2.5 rounded-lg" onPress={onRefresh}>
              <Text className="text-white text-sm font-semibold">Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredOrders.map(order => {
            if (!order) return null;
            const isExpanded = expandedOrder === order._id;
            const finalAmount = getOrderTotal(order);
            
            return (
              <TouchableOpacity
                key={order._id}
                className="bg-white rounded-2xl p-4 mb-4 border border-gray-300 shadow-sm"
                onPress={() => setExpandedOrder(isExpanded ? null : order._id)}
                activeOpacity={0.7}
              >
                {/* CARD HEADER */}
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1 mr-3">
                    <Text className="text-base font-bold text-gray-900 mb-1">Order #{order.orderId}</Text>
                    <Text className="text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString("en-IN")}
                    </Text>
                    <Text className={`text-xs font-semibold px-1.5 py-0.5 rounded mt-0.5 self-start ${
                      order.orderType === 'offline' 
                        ? 'text-blue-500 bg-blue-50' 
                        : 'text-green-500 bg-green-50'
                    }`}>
                      {order.orderType === 'offline' ? 'Offline' : 'Online'}
                    </Text>
                  </View>
                  <View
                    className="flex-row items-center gap-1.5 py-1.5 px-3 rounded-full border min-w-25 justify-center"
                    style={{
                      backgroundColor: getStatusBackgroundColor(order.orderStatus),
                      borderColor: getStatusColor(order.orderStatus),
                    }}
                  >
                    {getStatusIcon(order.orderStatus)}
                    <Text className="text-xs font-bold" style={{ color: getStatusColor(order.orderStatus) }}>
                      {getStatusText(order.orderStatus)}
                    </Text>
                  </View>
                </View>

                {/* CUSTOMER */}
                <View className="mb-3">
                  <Text className="text-sm font-semibold text-gray-900 mb-1.5">Customer:</Text>
                  <Text className="text-sm text-gray-500 mb-1">
                    {order.customerName ||
                      order.customer?.personalInfo?.fullName ||
                      order.customer?.fullName ||
                      (order.orderType === 'offline' ? "Walk-in Customer" : "N/A")}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    {order.customer?.personalInfo?.phone || order.customer?.phone || order.customerPhone || "N/A"}
                  </Text>
                </View>

                {/* DISTANCE */}
                {order.distance && (
                  <View className="flex-row items-center mb-2 gap-1.5">
                    <MaterialIcons name="location-pin" size={14} color={Colors.light.accent} />
                    <Text className="text-sm text-blue-500 font-semibold">{order.distance} km away</Text>
                  </View>
                )}

                {/* ITEMS SUMMARY */}
                <View className="mb-3">
                  <Text className="text-sm font-semibold text-gray-900 mb-1.5">Items:</Text>
                  {order.items?.slice(0, 2).map((it, i) => (
                    <View key={i} className="flex-row justify-between items-center mb-1">
                      <Text className="text-sm text-gray-500">
                        {it.product?.name || it.name} - {it.quantity}x {it.unit || "unit"}
                      </Text>
                      <View className="flex-row items-center gap-1">
                        <Text className="text-sm font-semibold text-blue-500">
                          ₹{getItemPrice(it).toFixed(2)}
                        </Text>
                        {isPriceOverridden(it) && (
                          <View className="flex-row items-center bg-blue-500 px-1 py-0.25 rounded gap-0.25">
                            <Ionicons name="pricetag" size={8} color="#FFF" />
                            <Text className="text-xxs text-white font-semibold">Custom</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                  {order.items?.length > 2 && (
                    <Text className="text-sm text-gray-500 italic">+{order.items.length - 2} more</Text>
                  )}
                </View>

                {/* BILLING */}
                <View className="mb-3">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-sm text-gray-500">Total Amount:</Text>
                    <Text className="text-base font-bold text-blue-500">₹{finalAmount.toFixed(2)}</Text>
                  </View>
                </View>

                {/* DELIVERY */}
                <View className="flex-row items-center mb-3 gap-1.5">
                  <MaterialIcons name="schedule" size={14} color={Colors.light.textSecondary} />
                  <Text className="text-sm text-gray-500">
                    Delivery: {order.deliveryDate ? new Date(order.deliveryDate).toLocaleDateString("en-IN") : "N/A"} at{" "}
                    {order.deliveryTime || "N/A"}
                  </Text>
                </View>

                {/* EXPAND BUTTON */}
                <TouchableOpacity
                  className="flex-row items-center justify-center py-2.5 border-t border-gray-300"
                  onPress={() => setExpandedOrder(isExpanded ? null : order._id)}
                >
                  <Text className="text-sm font-semibold text-blue-500 mr-2">{isExpanded ? "Show Less" : "Show More Details"}</Text>
                  <MaterialIcons
                    name={isExpanded ? "expand-less" : "expand-more"}
                    size={20}
                    color={Colors.light.accent}
                  />
                </TouchableOpacity>

                {/* EXPANDED CONTENT */}
                {isExpanded && (
                  <View className="mt-3 pt-3 border-t border-gray-300">
                    {/* ALL ITEMS */}
                    <View className="mb-4">
                      <Text className="text-sm font-semibold text-gray-900 mb-1.5">All Items:</Text>
                      {order.items?.map((it, i) => (
                        <View key={i} className="flex-row justify-between items-start mb-3 pl-2">
                          <View className="flex-1">
                            <Text className="text-sm text-gray-900 font-semibold mb-1">{it.product?.name || it.name}</Text>
                            {isPriceOverridden(it) && (
                              <View className="flex-row items-center bg-blue-500 px-1.5 py-0.5 rounded gap-0.5 self-start">
                                <Ionicons name="pricetag" size={10} color="#FFF" />
                                <Text className="text-xxs text-white font-semibold">Custom Price</Text>
                              </View>
                            )}
                          </View>
                          <View className="items-end">
                            <Text className="text-sm text-gray-500 mb-0.5">
                              {it.quantity}x {it.unit || "unit"} @ ₹{getItemPrice(it).toFixed(2)}
                            </Text>
                            <Text className="text-sm font-bold text-blue-500">
                              ₹{getItemTotal(it).toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>

                    {/* BILLING DETAIL */}
                    <View className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200">
                      <View className="flex-row justify-between items-center mb-1">
                        <Text className="text-sm text-gray-500">Subtotal:</Text>
                        <Text className="text-sm text-gray-900">
                          ₹{(order.calculatedSubtotal || order.totalAmount || 0).toFixed(2)}
                        </Text>
                      </View>
                      {order.discount > 0 && (
                        <View className="flex-row justify-between items-center mb-1">
                          <Text className="text-sm text-gray-500">Discount:</Text>
                          <Text className="text-sm text-green-500 font-semibold">-₹{order.discount.toFixed(2)}</Text>
                        </View>
                      )}
                      <View className="flex-row justify-between items-center pt-2 mt-1 border-t border-blue-200">
                        <Text className="text-base font-semibold text-gray-900">Total Amount:</Text>
                        <Text className="text-base font-bold text-blue-500">₹{finalAmount.toFixed(2)}</Text>
                      </View>
                    </View>

                    {/* ADDRESS */}
                    {order.deliveryAddress && (
                      <View className="mb-4">
                        <Text className="text-sm font-semibold text-gray-900 mb-1.5">Delivery Address:</Text>
                        <Text className="text-sm text-gray-500 mb-0.5">{order.deliveryAddress.addressLine1}</Text>
                        {order.deliveryAddress.addressLine2 && (
                          <Text className="text-sm text-gray-500 mb-0.5">{order.deliveryAddress.addressLine2}</Text>
                        )}
                        <Text className="text-sm text-gray-500 mb-0.5">
                          {order.deliveryAddress.city}, {order.deliveryAddress.state} - {order.deliveryAddress.pincode}
                        </Text>
                        {order.deliveryAddress.landmark && (
                          <Text className="text-sm text-gray-500">Landmark: {order.deliveryAddress.landmark}</Text>
                        )}
                      </View>
                    )}

                    {/* PAYMENT */}
                    <View className="mb-4">
                      <Text className="text-sm font-semibold text-gray-900 mb-1.5">Payment:</Text>
                      <Text className="text-sm text-gray-500 mb-0.5">Method: {order.paymentMethod || "N/A"}</Text>
                      <Text className="text-sm text-gray-500 mb-0.5">Status: {order.paymentStatus || "N/A"}</Text>
                      <Text className="text-sm text-gray-500">
                        Type: {order.orderType === 'offline' ? 'Offline Order' : 'Online Order'}
                      </Text>
                    </View>

                    {/* INSTRUCTIONS */}
                    {order.specialInstructions && (
                      <View className="mb-4">
                        <Text className="text-sm font-semibold text-gray-900 mb-1.5">Instructions:</Text>
                        <Text className="text-sm text-gray-500 italic">{order.specialInstructions}</Text>
                      </View>
                    )}

                    {/* PROGRESS BAR */}
                    {activeFilter !== "offline" && order.orderStatus !== "cancelled" && (
                      <View className="mt-2">
                        <Text className="text-sm font-semibold text-gray-900 mb-1.5">Order Progress:</Text>
                        <View className="flex-row items-center mb-1 mt-2">
                          {statusOrder.map((st, idx) => {
                            const cur = statusOrder.indexOf(order.orderStatus);
                            const done = idx <= cur;
                            const current = idx === cur;
                            const clickable = idx >= cur;
                            return (
                              <View key={st} className="flex-row items-center flex-1">
                                <TouchableOpacity
                                  className={`w-6 h-6 rounded-full items-center justify-center ${
                                    done ? "bg-blue-500" : "bg-gray-300"
                                  } ${current ? "border-2 border-white" : ""}`}
                                  onPress={() => clickable && handleStatusChange(order.orderId, st)}
                                  disabled={!clickable}
                                >
                                  {done && <FontAwesome name="check" size={10} color="#FFF" />}
                                </TouchableOpacity>
                                {idx < statusOrder.length - 1 && (
                                  <View
                                    className={`flex-1 h-0.5 ${done ? "bg-blue-500" : "bg-gray-300"}`}
                                  />
                                )}
                              </View>
                            );
                          })}
                        </View>
                        <View className="flex-row justify-between">
                          {statusOrder.map((st, idx) => {
                            const cur = statusOrder.indexOf(order.orderStatus);
                            const done = idx <= cur;
                            const current = idx === cur;
                            return (
                              <Text
                                key={st}
                                className={`text-xxs text-center flex-1 ${
                                  done ? "text-blue-500 font-semibold" : "text-gray-500"
                                } ${current ? "font-bold" : ""}`}
                              >
                                {getStatusText(st)}
                              </Text>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* ADMIN ACTIONS */}
                    <View className="flex-row justify-between mt-3 pt-3 border-t border-gray-300">
                      <TouchableOpacity className="flex-row items-center bg-blue-50 px-4 py-2.5 rounded-lg flex-1 mr-2 justify-center" onPress={() => shareOrderInvoice(order.orderId)}>
                        <MaterialIcons name="share" size={18} color={Colors.light.accent} />
                        <Text className="ml-1.5 text-sm font-semibold text-blue-500">Share Invoice</Text>
                      </TouchableOpacity>
                      {order.orderStatus !== "cancelled" && order.orderStatus !== "delivered" && (
                        <TouchableOpacity
                          className="flex-row items-center bg-red-50 px-4 py-2.5 rounded-lg flex-1 ml-2 justify-center"
                          onPress={() => cancelOrder(order.orderId)}
                        >
                          <MaterialIcons name="cancel" size={18} color="#F44336" />
                          <Text className="ml-1.5 text-sm font-semibold text-red-500">Cancel Order</Text>
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

      {/* Floating Scanner Button */}
      <TouchableOpacity className="absolute bottom-5 right-5 bg-blue-500 w-15 h-15 rounded-full items-center justify-center shadow-lg" onPress={navigateToOfflineOrder}>
        <Ionicons name="barcode" size={40} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}