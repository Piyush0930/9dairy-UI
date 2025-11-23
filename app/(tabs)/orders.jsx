// C:\Users\Krishna\OneDrive\Desktop\frontend-dairy9\9dairy-UI\app\(tabs)\orders.jsx

import { useAuth } from "@/contexts/AuthContext";
import { FontAwesome, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Updated color theme to red (Zomato-like)
const ZomatoColors = {
  primary: '#E23744',
  primaryLight: '#FF6B7A',
  primaryDark: '#CB1E2B',
  background: '#FFFFFF',
  text: '#1C1C1C',
  textSecondary: '#696969',
  border: '#E5E5E5',
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
};

function getStatusIcon(status) {
  switch (status) {
    case "delivered":
      return <FontAwesome name="check-circle" size={16} color="#4CAF50" />;
    case "out_for_delivery":
      return <MaterialIcons name="local-shipping" size={16} color={ZomatoColors.primary} />;
    case "pending":
      return <Ionicons name="time-outline" size={16} color="#FF9800" />;
    case "confirmed":
      return <FontAwesome name="check" size={16} color="#4CAF50" />;
    case "preparing":
      return <MaterialIcons name="build" size={16} color="#FF9800" />;
    case "cancelled":
      return <MaterialIcons name="cancel" size={16} color="#F44336" />;
  }
}

function getStatusText(status) {
  switch (status) {
    case "delivered":
      return "Delivered";
    case "out_for_delivery":
      return "Out for Delivery";
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "preparing":
      return "Preparing";
    case "cancelled":
      return "Cancelled";
  }
}

function getStatusColor(status) {
  switch (status) {
    case "delivered":
      return "#4CAF50";
    case "out_for_delivery":
      return ZomatoColors.primary;
    case "pending":
      return "#FF9800";
    case "confirmed":
      return "#2196F3";
    case "preparing":
      return "#FF9800";
    case "cancelled":
      return "#F44336";
  }
}

function getStatusBackgroundColor(status) {
  switch (status) {
    case "delivered":
      return "rgba(76, 175, 80, 0.1)";
    case "out_for_delivery":
      return "rgba(226, 55, 68, 0.1)";
    case "pending":
      return "rgba(255, 152, 0, 0.1)";
    case "confirmed":
      return "rgba(33, 150, 243, 0.1)";
    case "preparing":
      return "rgba(255, 152, 0, 0.1)";
    case "cancelled":
      return "rgba(244, 67, 54, 0.1)";
  }
}

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;

const statusOrder = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];

// API Service for orders
const ordersAPI = {
  getOrders: async (token) => {
    try {
      const response = await fetch(`${API_BASE_URL}/orders`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      throw error;
    }
  }
};

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { 
    authToken, 
    isLoading: authLoading, 
    logout, 
    validateToken,
    isAuthenticated 
  } = useAuth();
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('orders');
  const [expandedOrder, setExpandedOrder] = useState(null);

  const handleApiError = (error, customMessage = null) => {
    console.error('API Error:', error);
    
    if (error.message?.includes('401') || 
        error.message?.includes('Unauthorized') ||
        error.message?.includes('token') ||
        error.response?.status === 401) {
      
      console.log('🔐 Authentication error detected, logging out...');
      Alert.alert(
        "Session Expired",
        "Your session has expired. Please login again.",
        [
          {
            text: "OK",
            onPress: () => logout()
          }
        ]
      );
      return true;
    }
    
    Alert.alert("Error", customMessage || "Something went wrong. Please try again.");
    return false;
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log('🔒 User not authenticated, redirecting to login...');
      setTimeout(() => {
        router.replace('/Login');
      }, 100);
    }
  }, [isAuthenticated, authLoading]);

  const validateAuthBeforeCall = async () => {
    if (!authToken || !isAuthenticated) {
      Alert.alert("Session Expired", "Please login again");
      return false;
    }

    const isValid = await validateToken();
    if (!isValid) {
      Alert.alert("Session Expired", "Please login again");
      return false;
    }

    return true;
  };

  const fetchOrders = async () => {
    const isValid = await validateAuthBeforeCall();
    if (!isValid) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const response = await ordersAPI.getOrders(authToken);
      
      if (response.success) {
        setOrders(response.orders || []);
      } else {
        throw new Error(response.message || 'Failed to fetch orders');
      }
    } catch (error) {
      handleApiError(error, "Failed to fetch orders. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchOrders();
  };

  const toggleOrderExpansion = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const handleLogout = async () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { 
          text: "Cancel", 
          style: "cancel" 
        },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              console.log('👋 User initiated logout...');
              await logout();
            } catch (error) {
              console.error('❌ Logout error in UI:', error);
              Alert.alert("Error", "Failed to logout. Please try again.");
            }
          }
        }
      ]
    );
  };

  useEffect(() => {
    if (!authLoading && authToken && isAuthenticated) {
      fetchOrders();
    } else if (!authLoading && (!authToken || !isAuthenticated)) {
      console.log('❌ No auth token or not authenticated');
      setLoading(false);
    }
  }, [authToken, authLoading, isAuthenticated]);

  const filteredOrders = activeFilter === 'orders'
    ? orders.filter(order => order.orderStatus !== 'delivered' && order.orderStatus !== 'cancelled')
    : orders.filter(order => order.orderStatus === 'delivered' || order.orderStatus === 'cancelled');

  if (loading) {
    return (
      <View className="flex-1 bg-white justify-center items-center" style={{ paddingTop: insets.top }}>
        <ActivityIndicator size="large" color={ZomatoColors.primary} />
        <Text className="mt-4 text-base text-gray-500">Loading orders...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <View className="px-4 py-4 border-b border-gray-300 bg-white">
        <View className="flex-row justify-between items-center">
          <Text className="text-2xl font-bold text-gray-900">My Orders</Text>
          <TouchableOpacity onPress={handleLogout} className="p-2">
            <MaterialIcons name="logout" size={20} color={ZomatoColors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View className="mx-4 my-4 bg-white rounded-xl p-1 border border-gray-300 shadow-sm">
        <View className="flex-row">
          <TouchableOpacity
            className={`flex-1 py-2 px-3 rounded-lg items-center ${activeFilter === 'orders' ? 'bg-red-600' : ''}`}
            onPress={() => setActiveFilter('orders')}
          >
            <Text className={`text-sm font-semibold ${activeFilter === 'orders' ? 'text-white' : 'text-gray-500'}`}>
              Active Orders
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`flex-1 py-2 px-3 rounded-lg items-center ${activeFilter === 'history' ? 'bg-red-600' : ''}`}
            onPress={() => setActiveFilter('history')}
          >
            <Text className={`text-sm font-semibold ${activeFilter === 'history' ? 'text-white' : 'text-gray-500'}`}>
              Order History
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[ZomatoColors.primary]}
            tintColor={ZomatoColors.primary}
          />
        }
      >
        {filteredOrders.length === 0 ? (
          <View className="items-center justify-center p-10">
            <MaterialIcons name="inventory" size={48} color={ZomatoColors.textSecondary} />
            <Text className="mt-4 text-base text-gray-500 text-center">
              {activeFilter === 'orders' ? 'No active orders' : 'No order history'}
            </Text>
            <TouchableOpacity className="mt-4 bg-red-600 px-5 py-2 rounded-lg" onPress={onRefresh}>
              <Text className="text-white text-sm font-semibold">Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const subtotal = order.totalAmount || 0;
            const discount = order.discount || 0;
            const finalAmount = order.finalAmount || subtotal;
            const isExpanded = expandedOrder === order._id;

            return (
              <TouchableOpacity 
                key={order._id} 
                className="bg-white rounded-xl p-4 mb-4 border border-gray-300 shadow-sm"
                onPress={() => toggleOrderExpansion(order._id)}
                activeOpacity={0.7}
              >
                <View className="flex-row justify-between items-start mb-3">
                  <View className="flex-1 mr-3">
                    <Text className="text-base font-bold text-gray-900 mb-1">Order #{order.orderId}</Text>
                    <Text className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString("en-IN")}</Text>
                  </View>
                  <View 
                    className="flex-row items-center gap-1 py-1 px-3 rounded-full border min-w-24 justify-center"
                    style={{ 
                      backgroundColor: getStatusBackgroundColor(order.orderStatus),
                      borderColor: getStatusColor(order.orderStatus) 
                    }}
                  >
                    {getStatusIcon(order.orderStatus)}
                    <Text className="text-xs font-bold" style={{ color: getStatusColor(order.orderStatus) }}>
                      {getStatusText(order.orderStatus)}
                    </Text>
                  </View>
                </View>

                <View className="mb-3">
                  <Text className="text-sm font-semibold text-gray-900 mb-1">Items:</Text>
                  {order.items.slice(0, 2).map((item, index) => (
                    <Text key={index} className="text-sm text-gray-500 mb-1">
                      {item.product?.name || 'Product'} - {item.quantity}x {item.unit || 'unit'}
                    </Text>
                  ))}
                  {order.items.length > 2 && (
                    <Text className="text-sm text-gray-500 italic">+{order.items.length - 2} more items</Text>
                  )}
                </View>

                <View className="mb-3">
                  <View className="flex-row justify-between items-center">
                    <Text className="text-sm text-gray-500">Total Amount:</Text>
                    <Text className="text-base font-bold text-red-600">₹{finalAmount.toFixed(2)}</Text>
                  </View>
                </View>

                <View className="flex-row items-center mb-3 gap-1">
                  <MaterialIcons name="schedule" size={14} color={ZomatoColors.textSecondary} />
                  <Text className="text-sm text-gray-500">
                    Delivery: {new Date(order.deliveryDate).toLocaleDateString("en-IN")} at {order.deliveryTime || 'N/A'}
                  </Text>
                </View>

                <TouchableOpacity 
                  className="flex-row items-center justify-center py-2 border-t border-gray-300"
                  onPress={() => toggleOrderExpansion(order._id)}
                >
                  <Text className="text-sm font-semibold text-red-600 mr-2">
                    {isExpanded ? 'Show Less' : 'Show More Details'}
                  </Text>
                  <MaterialIcons 
                    name={isExpanded ? "expand-less" : "expand-more"} 
                    size={20} 
                    color={ZomatoColors.primary} 
                  />
                </TouchableOpacity>

                {isExpanded && (
                  <View className="mt-3 pt-3 border-t border-gray-300">
                    <View className="mb-4">
                      <Text className="text-sm font-semibold text-gray-900 mb-1">All Items:</Text>
                      {order.items.map((item, index) => (
                        <View key={index} className="flex-row justify-between items-center mb-1 pl-2">
                          <Text className="text-sm text-gray-500 flex-1">
                            {item.product?.name || 'Product'}
                          </Text>
                          <Text className="text-sm text-gray-500">
                            {item.quantity}x {item.unit || 'unit'} @ ₹{item.price || 'N/A'}
                          </Text>
                          <Text className="text-sm font-semibold text-gray-900 w-20 text-right">
                            ₹{(item.quantity * (item.price || 0)).toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <View className="bg-red-50 rounded-lg p-3 mb-4 border border-red-100">
                      <View className="flex-row justify-between items-center mb-1">
                        <Text className="text-sm text-gray-500">Subtotal:</Text>
                        <Text className="text-sm text-gray-900">₹{subtotal.toFixed(2)}</Text>
                      </View>
                      {discount > 0 && (
                        <View className="flex-row justify-between items-center mb-1">
                          <Text className="text-sm text-gray-500">Discount:</Text>
                          <Text className="text-sm font-semibold text-green-600">-₹{discount.toFixed(2)}</Text>
                        </View>
                      )}
                      <View className="flex-row justify-between items-center border-t border-gray-300 pt-2 mt-1">
                        <Text className="text-base font-semibold text-gray-900">Total Amount:</Text>
                        <Text className="text-base font-bold text-red-600">₹{finalAmount.toFixed(2)}</Text>
                      </View>
                    </View>

                    {order.deliveryAddress && (
                      <View className="mb-4">
                        <Text className="text-sm font-semibold text-gray-900 mb-1">Delivery Address:</Text>
                        <Text className="text-sm text-gray-500 mb-0">
                          {order.deliveryAddress.addressLine1}
                          {order.deliveryAddress.addressLine2 ? `, ${order.deliveryAddress.addressLine2}` : ''}
                        </Text>
                        <Text className="text-sm text-gray-500 mb-0">
                          {order.deliveryAddress.city}, {order.deliveryAddress.state} - {order.deliveryAddress.pincode}
                        </Text>
                        {order.deliveryAddress.landmark && (
                          <Text className="text-sm text-gray-500">Landmark: {order.deliveryAddress.landmark}</Text>
                        )}
                      </View>
                    )}

                    <View className="mb-4">
                      <Text className="text-sm font-semibold text-gray-900 mb-1">Payment Information:</Text>
                      <Text className="text-sm text-gray-500 mb-0">Method: {order.paymentMethod || 'N/A'}</Text>
                      <Text className="text-sm text-gray-500">Status: {order.paymentStatus || 'N/A'}</Text>
                    </View>

                    {order.specialInstructions && (
                      <View className="mb-4">
                        <Text className="text-sm font-semibold text-gray-900 mb-1">Special Instructions:</Text>
                        <Text className="text-sm text-gray-500 italic">{order.specialInstructions}</Text>
                      </View>
                    )}

                    {activeFilter === 'orders' && order.orderStatus !== 'cancelled' && (
                      <View className="mt-2">
                        <Text className="text-sm font-semibold text-gray-900 mb-1">Order Progress:</Text>
                        <View className="flex-row items-center mb-1 mt-2">
                          {statusOrder.map((status, index) => {
                            const currentIndex = statusOrder.indexOf(order.orderStatus);
                            const isCompleted = index <= currentIndex;
                            const isCurrent = index === currentIndex;
                            return (
                              <View key={status} className="flex-row items-center flex-1">
                                <View
                                  className={`w-6 h-6 rounded-full items-center justify-center ${isCompleted ? 'bg-red-600' : 'bg-gray-300'} ${isCurrent ? 'border-2 border-white' : ''}`}
                                >
                                  {isCompleted && <FontAwesome name="check" size={10} color="#FFF" />}
                                </View>
                                {index < statusOrder.length - 1 && (
                                  <View className={`flex-1 h-0.5 mx-1 ${isCompleted ? 'bg-red-600' : 'bg-gray-300'}`} />
                                )}
                              </View>
                            );
                          })}
                        </View>
                        <View className="flex-row justify-between">
                          {statusOrder.map((status, index) => {
                            const currentIndex = statusOrder.indexOf(order.orderStatus);
                            const isCompleted = index <= currentIndex;
                            const isCurrent = index === currentIndex;
                            return (
                              <Text key={status} className={`text-xs text-gray-500 text-center flex-1 ${isCompleted ? 'text-red-600 font-semibold' : ''} ${isCurrent ? 'text-red-600 font-bold' : ''}`}>
                                {getStatusText(status)}
                              </Text>
                            );
                          })}
                        </View>
                      </View>
                    )}
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