// C:\Users\Krishna\OneDrive\Desktop\frontend-dairy9\9dairy-UI\app\(tabs)\orders.jsx

import { useAuth } from "@/contexts/AuthContext"; // Add this import
import { FontAwesome, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
  } = useAuth(); // Use AuthContext like in Account screen
  
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('orders');
  const [expandedOrder, setExpandedOrder] = useState(null);

  // Enhanced API error handler (same as Account screen)
  const handleApiError = (error, customMessage = null) => {
    console.error('API Error:', error);
    
    // Check for authentication errors
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
      return true; // Indicates auth error
    }
    
    // Show custom or generic error
    Alert.alert("Error", customMessage || "Something went wrong. Please try again.");
    return false; // Indicates non-auth error
  };

  // Auto-redirect when not authenticated (same as Account screen)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      console.log('🔒 User not authenticated, redirecting to login...');
      setTimeout(() => {
        router.replace('/Login');
      }, 100);
    }
  }, [isAuthenticated, authLoading]);

  // Add token validation before API calls (same as Account screen)
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

  // Enhanced logout handler (same as Account screen)
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

  // Filter orders based on activeFilter
  const filteredOrders = activeFilter === 'orders'
    ? orders.filter(order => order.orderStatus !== 'delivered' && order.orderStatus !== 'cancelled')
    : orders.filter(order => order.orderStatus === 'delivered' || order.orderStatus === 'cancelled');

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={ZomatoColors.primary} />
        <Text style={styles.loadingText}>Loading orders...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>My Orders</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <MaterialIcons name="logout" size={20} color={ZomatoColors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'orders' && styles.filterButtonActive]}
          onPress={() => setActiveFilter('orders')}
        >
          <Text style={[styles.filterButtonText, activeFilter === 'orders' && styles.filterButtonTextActive]}>
            Active Orders
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'history' && styles.filterButtonActive]}
          onPress={() => setActiveFilter('history')}
        >
          <Text style={[styles.filterButtonText, activeFilter === 'history' && styles.filterButtonTextActive]}>
            Order History
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
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
          <View style={styles.emptyContainer}>
            <MaterialIcons name="inventory" size={48} color={ZomatoColors.textSecondary} />
            <Text style={styles.emptyText}>
              {activeFilter === 'orders' ? 'No active orders' : 'No order history'}
            </Text>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
              <Text style={styles.refreshButtonText}>Refresh</Text>
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
                style={styles.orderCard}
                onPress={() => toggleOrderExpansion(order._id)}
                activeOpacity={0.7}
              >
                {/* Order Header */}
                <View style={styles.orderHeader}>
                  <View style={styles.orderIdRow}>
                    <Text style={styles.orderIdLarge}>Order #{order.orderId}</Text>
                    <Text style={styles.orderDate}>{new Date(order.createdAt).toLocaleDateString("en-IN")}</Text>
                  </View>
                  <View style={[
                    styles.statusBadge, 
                    { 
                      backgroundColor: getStatusBackgroundColor(order.orderStatus),
                      borderColor: getStatusColor(order.orderStatus) 
                    }
                  ]}>
                    {getStatusIcon(order.orderStatus)}
                    <Text style={[styles.statusText, { color: getStatusColor(order.orderStatus) }]}>
                      {getStatusText(order.orderStatus)}
                    </Text>
                  </View>
                </View>

                {/* Items List - Always Visible */}
                <View style={styles.itemsSection}>
                  <Text style={styles.sectionTitleSmall}>Items:</Text>
                  {order.items.slice(0, 2).map((item, index) => (
                    <Text key={index} style={styles.itemText}>
                      {item.product?.name || 'Product'} - {item.quantity}x {item.unit || 'unit'}
                    </Text>
                  ))}
                  {order.items.length > 2 && (
                    <Text style={styles.moreItemsText}>+{order.items.length - 2} more items</Text>
                  )}
                </View>

                {/* Billing Summary - Always Visible */}
                <View style={styles.billingSection}>
                  <View style={styles.billingRow}>
                    <Text style={styles.billingLabel}>Total Amount:</Text>
                    <Text style={styles.totalValue}>₹{finalAmount.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Delivery Info - Always Visible */}
                <View style={styles.deliverySection}>
                  <MaterialIcons name="schedule" size={14} color={ZomatoColors.textSecondary} />
                  <Text style={styles.deliveryLabel}>
                    Delivery: {new Date(order.deliveryDate).toLocaleDateString("en-IN")} at {order.deliveryTime || 'N/A'}
                  </Text>
                </View>

                {/* Expand/Collapse Button */}
                <TouchableOpacity 
                  style={styles.expandButton}
                  onPress={() => toggleOrderExpansion(order._id)}
                >
                  <Text style={styles.expandButtonText}>
                    {isExpanded ? 'Show Less' : 'Show More Details'}
                  </Text>
                  <MaterialIcons 
                    name={isExpanded ? "expand-less" : "expand-more"} 
                    size={20} 
                    color={ZomatoColors.primary} 
                  />
                </TouchableOpacity>

                {/* Expanded Details */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {/* Detailed Items List */}
                    <View style={styles.detailedItemsSection}>
                      <Text style={styles.sectionTitleSmall}>All Items:</Text>
                      {order.items.map((item, index) => (
                        <View key={index} style={styles.detailedItemRow}>
                          <Text style={styles.detailedItemText}>
                            {item.product?.name || 'Product'}
                          </Text>
                          <Text style={styles.detailedItemText}>
                            {item.quantity}x {item.unit || 'unit'} @ ₹{item.price || 'N/A'}
                          </Text>
                          <Text style={styles.detailedItemTotal}>
                            ₹{(item.quantity * (item.price || 0)).toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Detailed Billing Summary */}
                    <View style={styles.detailedBillingSection}>
                      <View style={styles.billingRow}>
                        <Text style={styles.billingLabel}>Subtotal:</Text>
                        <Text style={styles.billingValue}>₹{subtotal.toFixed(2)}</Text>
                      </View>
                      {discount > 0 && (
                        <View style={styles.billingRow}>
                          <Text style={styles.billingLabel}>Discount:</Text>
                          <Text style={styles.discountText}>-₹{discount.toFixed(2)}</Text>
                        </View>
                      )}
                      <View style={[styles.billingRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total Amount:</Text>
                        <Text style={styles.totalValue}>₹{finalAmount.toFixed(2)}</Text>
                      </View>
                    </View>

                    {/* Delivery Address */}
                    {order.deliveryAddress && (
                      <View style={styles.addressSection}>
                        <Text style={styles.sectionTitleSmall}>Delivery Address:</Text>
                        <Text style={styles.addressText}>
                          {order.deliveryAddress.addressLine1}
                          {order.deliveryAddress.addressLine2 ? `, ${order.deliveryAddress.addressLine2}` : ''}
                        </Text>
                        <Text style={styles.addressText}>
                          {order.deliveryAddress.city}, {order.deliveryAddress.state} - {order.deliveryAddress.pincode}
                        </Text>
                        {order.deliveryAddress.landmark && (
                          <Text style={styles.addressText}>Landmark: {order.deliveryAddress.landmark}</Text>
                        )}
                      </View>
                    )}

                    {/* Payment Information */}
                    <View style={styles.paymentSection}>
                      <Text style={styles.sectionTitleSmall}>Payment Information:</Text>
                      <Text style={styles.paymentText}>Method: {order.paymentMethod || 'N/A'}</Text>
                      <Text style={styles.paymentText}>Status: {order.paymentStatus || 'N/A'}</Text>
                    </View>

                    {/* Special Instructions */}
                    {order.specialInstructions && (
                      <View style={styles.instructionsSection}>
                        <Text style={styles.sectionTitleSmall}>Special Instructions:</Text>
                        <Text style={styles.instructionsText}>{order.specialInstructions}</Text>
                      </View>
                    )}

                    {/* Progress Bar for active orders */}
                    {activeFilter === 'orders' && order.orderStatus !== 'cancelled' && (
                      <View style={styles.progressContainer}>
                        <Text style={styles.sectionTitleSmall}>Order Progress:</Text>
                        <View style={styles.progressBar}>
                          {statusOrder.map((status, index) => {
                            const currentIndex = statusOrder.indexOf(order.orderStatus);
                            const isCompleted = index <= currentIndex;
                            const isCurrent = index === currentIndex;
                            return (
                              <View key={status} style={styles.progressStep}>
                                <View
                                  style={[
                                    styles.progressDot,
                                    isCompleted && styles.progressDotCompleted,
                                    isCurrent && styles.progressDotCurrent,
                                  ]}
                                >
                                  {isCompleted && <FontAwesome name="check" size={10} color="#FFF" />}
                                </View>
                                {index < statusOrder.length - 1 && (
                                  <View style={[
                                    styles.progressLine,
                                    isCompleted && styles.progressLineCompleted
                                  ]} />
                                )}
                              </View>
                            );
                          })}
                        </View>
                        <View style={styles.progressLabels}>
                          {statusOrder.map((status, index) => {
                            const currentIndex = statusOrder.indexOf(order.orderStatus);
                            const isCompleted = index <= currentIndex;
                            const isCurrent = index === currentIndex;
                            return (
                              <Text key={status} style={[
                                styles.progressLabel,
                                isCompleted && styles.progressLabelCompleted,
                                isCurrent && styles.progressLabelCurrent
                              ]}>
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

// Keep all your existing styles exactly as they were
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ZomatoColors.background,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: ZomatoColors.textSecondary,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: ZomatoColors.border,
    backgroundColor: ZomatoColors.background,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: ZomatoColors.text,
  },
  logoutButton: {
    padding: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 12,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: ZomatoColors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: ZomatoColors.primary,
    shadowColor: ZomatoColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: ZomatoColors.textSecondary,
  },
  filterButtonTextActive: {
    color: '#FFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: ZomatoColors.textSecondary,
    textAlign: 'center',
  },
  refreshButton: {
    marginTop: 16,
    backgroundColor: ZomatoColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  orderCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: ZomatoColors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderIdRow: {
    flex: 1,
    marginRight: 12,
  },
  orderIdLarge: {
    fontSize: 16,
    fontWeight: '700',
    color: ZomatoColors.text,
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 13,
    color: ZomatoColors.textSecondary,
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
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  itemsSection: {
    marginBottom: 12,
  },
  sectionTitleSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: ZomatoColors.text,
    marginBottom: 6,
  },
  itemText: {
    fontSize: 14,
    color: ZomatoColors.textSecondary,
    marginBottom: 4,
  },
  moreItemsText: {
    fontSize: 12,
    color: ZomatoColors.textSecondary,
    fontStyle: 'italic',
  },
  billingSection: {
    marginBottom: 12,
  },
  billingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  billingLabel: {
    fontSize: 14,
    color: ZomatoColors.textSecondary,
  },
  billingValue: {
    fontSize: 14,
    color: ZomatoColors.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: ZomatoColors.border,
    paddingTop: 8,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: ZomatoColors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: ZomatoColors.primary,
  },
  discountText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
  deliverySection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 6,
  },
  deliveryLabel: {
    fontSize: 14,
    color: ZomatoColors.textSecondary,
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: ZomatoColors.border,
  },
  expandButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: ZomatoColors.primary,
    marginRight: 8,
  },
  expandedContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: ZomatoColors.border,
  },
  detailedItemsSection: {
    marginBottom: 16,
  },
  detailedItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    paddingLeft: 8,
  },
  detailedItemText: {
    fontSize: 13,
    color: ZomatoColors.textSecondary,
    flex: 1,
  },
  detailedItemTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: ZomatoColors.text,
    width: 80,
    textAlign: 'right',
  },
  detailedBillingSection: {
    backgroundColor: 'rgba(226, 55, 68, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(226, 55, 68, 0.1)',
  },
  addressSection: {
    marginBottom: 16,
  },
  addressText: {
    fontSize: 13,
    color: ZomatoColors.textSecondary,
    marginBottom: 2,
  },
  paymentSection: {
    marginBottom: 16,
  },
  paymentText: {
    fontSize: 13,
    color: ZomatoColors.textSecondary,
    marginBottom: 2,
  },
  instructionsSection: {
    marginBottom: 16,
  },
  instructionsText: {
    fontSize: 13,
    color: ZomatoColors.textSecondary,
    fontStyle: 'italic',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginTop: 8,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ZomatoColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotCompleted: {
    backgroundColor: ZomatoColors.primary,
  },
  progressDotCurrent: {
    backgroundColor: ZomatoColors.primary,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: ZomatoColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: ZomatoColors.border,
    marginHorizontal: 4,
  },
  progressLineCompleted: {
    backgroundColor: ZomatoColors.primary,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 10,
    color: ZomatoColors.textSecondary,
    textAlign: 'center',
    flex: 1,
  },
  progressLabelCompleted: {
    color: ZomatoColors.primary,
    fontWeight: '600',
  },
  progressLabelCurrent: {
    color: ZomatoColors.primary,
    fontWeight: '700',
  },
});