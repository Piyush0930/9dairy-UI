import Colors from "@/constants/colors";
import { FontAwesome, Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function getStatusIcon(status) {
  switch (status) {
    case "delivered":
      return <FontAwesome name="check-circle" size={20} color="#4CAF50" />;
    case "out_for_delivery":
      return <MaterialIcons name="local-shipping" size={20} color={Colors.light.accent} />;
    case "pending":
      return <Ionicons name="time-outline" size={20} color="#FF9800" />;
    case "cancelled":
      return <MaterialIcons name="cancel" size={20} color="#F44336" />;
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
    case "cancelled":
      return "Cancelled";
  }
}

function getStatusColor(status) {
  switch (status) {
    case "delivered":
      return "#4CAF50";
    case "out_for_delivery":
      return Colors.light.accent;
    case "pending":
      return "#FF9800";
    case "cancelled":
      return "#F44336";
  }
}

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState([]);
  const [orderStats, setOrderStats] = useState({
    total: 0,
    pending: 0,
    delivered: 0,
    outForDelivery: 0,
    cancelled: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/admin/orders`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch orders');
      }

      if (data.success) {
        setOrders(data.orders || []);
        if (data.orderStats) {
          setOrderStats(data.orderStats);
        }
      } else {
        throw new Error(data.message || 'Failed to fetch orders');
      }
    } catch (error) {
      console.error('Fetch Orders Error:', error);
      Alert.alert('Error', error.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update order status');
      }

      if (data.success) {
        Alert.alert('Success', 'Order status updated successfully');
        fetchOrders(); // Refresh orders
      } else {
        throw new Error(data.message || 'Failed to update order status');
      }
    } catch (error) {
      console.error('Update Order Status Error:', error);
      Alert.alert('Error', error.message || 'Failed to update order status');
    }
  };

  const handleStatusChange = (orderId, currentStatus) => {
    const statuses = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];
    const currentIndex = statuses.indexOf(currentStatus);
    const nextStatus = statuses[currentIndex + 1];

    if (nextStatus) {
      Alert.alert(
        'Update Order Status',
        `Change status to ${getStatusText(nextStatus)}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Update', onPress: () => updateOrderStatus(orderId, nextStatus) },
        ]
      );
    } else {
      Alert.alert('Info', 'Order is already delivered');
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Use orderStats from state, fallback to calculated values
  const displayStats = {
    total: orderStats.total || orders.length,
    pending: orderStats.pending || orders.filter(o => o.orderStatus === 'pending').length,
    delivered: orderStats.delivered || orders.filter(o => o.orderStatus === 'delivered').length,
    outForDelivery: orderStats.outForDelivery || orders.filter(o => o.orderStatus === 'out_for_delivery').length,
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsContainer}>
          <View key="total" style={styles.statCard}>
            <MaterialIcons name="list-alt" size={32} color="#2196F3" />
            <Text style={styles.statValue}>{displayStats.total}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>
          <View key="pending" style={styles.statCard}>
            <Ionicons name="time-outline" size={32} color="#FF9800" />
            <Text style={styles.statValue}>{displayStats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View key="outForDelivery" style={styles.statCard}>
            <MaterialIcons name="local-shipping" size={32} color={Colors.light.accent} />
            <Text style={styles.statValue}>{displayStats.outForDelivery}</Text>
            <Text style={styles.statLabel}>Out for Delivery</Text>
          </View>
          <View key="delivered" style={styles.statCard}>
            <FontAwesome name="check-circle" size={28} color="#4CAF50" />
            <Text style={styles.statValue}>{displayStats.delivered}</Text>
            <Text style={styles.statLabel}>Delivered</Text>
          </View>
        </View>

        <View style={styles.ordersContainer}>
          <Text style={styles.sectionTitle}>All Orders</Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.light.accent} />
              <Text style={styles.loadingText}>Loading orders...</Text>
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialIcons name="inventory" size={48} color={Colors.light.textSecondary} />
              <Text style={styles.emptyText}>No orders found</Text>
            </View>
          ) : (
            orders.map((order) => (
              <TouchableOpacity key={order._id} style={styles.orderCard}>
                <View style={styles.orderHeader}>
                  <View style={styles.orderIdSection}>
                    <MaterialIcons name="inventory" size={18} color={Colors.light.text} />
                    <Text style={styles.orderId}>{order.orderId}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: `${getStatusColor(order.orderStatus)}20` },
                    ]}
                  >
                    {getStatusIcon(order.orderStatus)}
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(order.orderStatus) },
                      ]}
                    >
                      {getStatusText(order.orderStatus)}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.orderItems}>
                  {order.items.map((item, index) => (
                    <Text key={`${order._id}-item-${index}`} style={styles.itemText}>
                      {item.product?.name || 'Product'} - {item.quantity}x {item.unit || 'unit'} @ ₹{item.price || 'N/A'} = ₹{(item.quantity * (item.price || 0)).toFixed(2)}
                    </Text>
                  ))}
                </View>

                <View style={styles.orderFooter}>
                  <View>
                    <Text style={styles.orderDate}>
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                    <Text style={styles.customerInfo}>
                      Customer: {order.customerName || order.customer?.personalInfo?.fullName || 'N/A'}
                    </Text>
                    <Text style={styles.deliveryInfo}>
                      Delivery: {order.deliveryTime || 'N/A'} - {new Date(order.deliveryDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                  <View style={styles.amountSection}>
                    <Text style={styles.orderTotal}>₹{order.finalAmount}</Text>
                    {order.discount > 0 && (
                      <Text style={styles.discountText}>Discount: ₹{order.discount}</Text>
                    )}
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleStatusChange(order.orderId, order.orderStatus)}
                    >
                      <Text style={styles.actionButtonText}>
                        {order.orderStatus === 'pending' ? 'Process' : 'Update Status'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
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
    padding: 16,
    paddingBottom: 100,
  },
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statCard: {
    width: "48%",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 4,
    textAlign: "center",
  },
  ordersContainer: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 16,
  },
  orderCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  orderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  orderIdSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.light.text,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.light.border,
    marginBottom: 12,
  },
  orderItems: {
    marginBottom: 12,
  },
  itemText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  orderDate: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  customerInfo: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  deliveryInfo: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
  discountText: {
    fontSize: 12,
    color: Colors.light.accent,
    marginTop: 2,
  },
  amountSection: {
    alignItems: "flex-end",
  },
  orderTotal: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
  },
  actionButton: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 4,
  },
  actionButtonText: {
    color: "#FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
});
