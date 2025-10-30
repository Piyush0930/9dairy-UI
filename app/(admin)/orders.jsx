import Colors from "@/constants/colors";
import { FontAwesome, Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Status Helpers
function getStatusIcon(status) {
  switch (status) {
    case "delivered": return <FontAwesome name="check-circle" size={16} color="#4CAF50" />;
    case "out_for_delivery": return <MaterialIcons name="local-shipping" size={16} color={Colors.light.accent} />;
    case "pending": return <Ionicons name="time-outline" size={16} color="#FF9800" />;
    case "confirmed": return <FontAwesome name="check" size={16} color="#4CAF50" />;
    case "preparing": return <MaterialIcons name="build" size={16} color="#FF9800" />;
    case "cancelled": return <MaterialIcons name="cancel" size={16} color="#F44336" />;
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
  }
}

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;
const statusOrder = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('orders');
  const [expandedOrder, setExpandedOrder] = useState(null);

  const fetchOrders = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return Alert.alert('Error', 'Authentication required');

      const response = await fetch(`${API_BASE_URL}/admin/orders`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch orders');
      if (data.success) setOrders(data.orders || []);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const toggleOrderExpansion = (orderId) => {
    setExpandedOrder(prev => prev === orderId ? null : orderId);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      Alert.alert('Success', 'Status updated');
      fetchOrders();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const cancelOrder = async (orderId) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const res = await fetch(`${API_BASE_URL}/orders/${orderId}/cancel`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      Alert.alert('Success', 'Order cancelled');
      fetchOrders();
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleStatusChange = (orderId, selectedStatus) => {
    const order = orders.find(o => o.orderId === orderId);
    const currentIndex = statusOrder.indexOf(order.orderStatus);
    const selectedIndex = statusOrder.indexOf(selectedStatus);

    if (selectedStatus === 'cancelled') {
      Alert.alert('Cancel Order', 'Are you sure?', [
        { text: 'No' },
        { text: 'Yes', style: 'destructive', onPress: () => cancelOrder(orderId) },
      ]);
      return;
    }

    if (selectedIndex < currentIndex) {
      Alert.alert('Invalid', 'Cannot revert status');
      return;
    }

    Alert.alert('Update Status', `Change to ${getStatusText(selectedStatus)}?`, [
      { text: 'Cancel' },
      { text: 'Update', onPress: () => updateOrderStatus(orderId, selectedStatus) },
    ]);
  };

  const shareOrderInvoice = async (orderId) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const fileUri = FileSystem.documentDirectory + `invoice-${orderId}.pdf`;
      const download = await FileSystem.downloadAsync(
        `${API_BASE_URL}/orders/${orderId}/invoice`,
        fileUri,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (download.status !== 200) throw new Error('Failed');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  // FIXED: Correct function name
  const shareOverallInvoice = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const fileUri = FileSystem.documentDirectory + `overall-${new Date().toISOString().split('T')[0]}.pdf`;
      const download = await FileSystem.downloadAsync(
        `${API_BASE_URL}/admin/invoices/pdf`,
        fileUri,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (download.status !== 200) throw new Error('Failed');
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf' });
      }
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = activeFilter === 'orders'
    ? orders.filter(o => o.orderStatus !== 'delivered')
    : orders.filter(o => o.orderStatus === 'delivered');

  return (
    <View style={[styles.container, { paddingTop: insets.top * 0.5 }]}>
      {/* Filter Tabs */}
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

      {/* Header for Share All Button */}
      {activeFilter === 'history' && (
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={shareOverallInvoice} style={styles.shareAllHeaderBtn}>
            <MaterialIcons name="share" size={18} color="#FFF" />
            <Text style={styles.shareAllHeaderText}>Share All</Text>
          </TouchableOpacity>
        </View>
      )}

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
              {activeFilter === 'orders' ? 'No active orders' : 'No order history'}
            </Text>
            <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredOrders.map((order) => {
            const customerName = order.customerName || order.customer?.personalInfo?.fullName || 'N/A';
            const customerPhone = order.customer?.personalInfo?.phone || 'N/A';
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
                    { backgroundColor: getStatusBackgroundColor(order.orderStatus), borderColor: getStatusColor(order.orderStatus) }
                  ]}>
                    {getStatusIcon(order.orderStatus)}
                    <Text style={[styles.statusText, { color: getStatusColor(order.orderStatus) }]}>
                      {getStatusText(order.orderStatus)}
                    </Text>
                  </View>
                </View>

                {/* Customer Info */}
                <View style={styles.customerSection}>
                  <Text style={styles.sectionTitleSmall}>Customer:</Text>
                  <Text style={styles.itemText}>{customerName}</Text>
                  <Text style={styles.itemText}>{customerPhone}</Text>
                </View>

                {/* Items */}
                <View style={styles.itemsSection}>
                  <Text style={styles.sectionTitleSmall}>Items:</Text>
                  {order.items.slice(0, 2).map((item, idx) => (
                    <Text key={idx} style={styles.itemText}>
                      {item.product?.name || 'Product'} - {item.quantity}x {item.unit || 'unit'}
                    </Text>
                  ))}
                  {order.items.length > 2 && (
                    <Text style={styles.moreItemsText}>+{order.items.length - 2} more items</Text>
                  )}
                </View>

                {/* Billing */}
                <View style={styles.billingSection}>
                  <View style={styles.billingRow}>
                    <Text style={styles.billingLabel}>Total Amount:</Text>
                    <Text style={styles.totalValue}>₹{finalAmount.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Delivery */}
                <View style={styles.deliverySection}>
                  <MaterialIcons name="schedule" size={14} color={Colors.light.textSecondary} />
                  <Text style={styles.deliveryLabel}>
                    Delivery: {new Date(order.deliveryDate).toLocaleDateString("en-IN")} at {order.deliveryTime || 'N/A'}
                  </Text>
                </View>

                {/* Expand */}
                <TouchableOpacity style={styles.expandButton} onPress={() => toggleOrderExpansion(order._id)}>
                  <Text style={styles.expandButtonText}>
                    {isExpanded ? 'Show Less' : 'Show More Details'}
                  </Text>
                  <MaterialIcons name={isExpanded ? "expand-less" : "expand-more"} size={20} color={Colors.light.accent} />
                </TouchableOpacity>

                {/* Expanded Content */}
                {isExpanded && (
                  <View style={styles.expandedContent}>
                    {/* Items */}
                    <View style={styles.detailedItemsSection}>
                      <Text style={styles.sectionTitleSmall}>All Items:</Text>
                      {order.items.map((item, idx) => (
                        <View key={idx} style={styles.detailedItemRow}>
                          <Text style={styles.detailedItemText}>{item.product?.name || 'Product'}</Text>
                          <Text style={styles.detailedItemText}>
                            {item.quantity}x {item.unit || 'unit'} @ ₹{item.price || 'N/A'}
                          </Text>
                          <Text style={styles.detailedItemTotal}>
                            ₹{(item.quantity * (item.price || 0)).toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* Billing */}
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

                    {/* Address */}
                    {order.deliveryAddress && (
                      <View style={styles.addressSection}>
                        <Text style={styles.sectionTitleSmall}>Delivery Address:</Text>
                        <Text style={styles.addressText}>{order.deliveryAddress.addressLine1}{order.deliveryAddress.addressLine2 ? `, ${order.deliveryAddress.addressLine2}` : ''}</Text>
                        <Text style={styles.addressText}>{order.deliveryAddress.city}, {order.deliveryAddress.state} - {order.deliveryAddress.pincode}</Text>
                        {order.deliveryAddress.landmark && <Text style={styles.addressText}>Landmark: {order.deliveryAddress.landmark}</Text>}
                      </View>
                    )}

                    {/* Payment */}
                    <View style={styles.paymentSection}>
                      <Text style={styles.sectionTitleSmall}>Payment:</Text>
                      <Text style={styles.paymentText}>Method: {order.paymentMethod || 'N/A'}</Text>
                      <Text style={styles.paymentText}>Status: {order.paymentStatus || 'N/A'}</Text>
                    </View>

                    {/* Instructions */}
                    {order.specialInstructions && (
                      <View style={styles.instructionsSection}>
                        <Text style={styles.sectionTitleSmall}>Instructions:</Text>
                        <Text style={styles.instructionsText}>{order.specialInstructions}</Text>
                      </View>
                    )}

                    {/* Progress */}
                    {activeFilter === 'orders' && order.orderStatus !== 'cancelled' && (
                      <View style={styles.progressContainer}>
                        <Text style={styles.sectionTitleSmall}>Order Progress:</Text>
                        <View style={styles.progressBar}>
                          {statusOrder.map((status, idx) => {
                            const currentIdx = statusOrder.indexOf(order.orderStatus);
                            const isDone = idx <= currentIdx;
                            const isCurrent = idx === currentIdx;
                            const canClick = idx >= currentIdx;
                            return (
                              <View key={status} style={styles.progressStep}>
                                <TouchableOpacity
                                  style={[styles.progressDot, isDone && styles.progressDotCompleted, isCurrent && styles.progressDotCurrent]}
                                  onPress={() => canClick && handleStatusChange(order.orderId, status)}
                                  disabled={!canClick}
                                >
                                  {isDone && <FontAwesome name="check" size={10} color="#FFF" />}
                                </TouchableOpacity>
                                {idx < statusOrder.length - 1 && (
                                  <View style={[styles.progressLine, isDone && styles.progressLineCompleted]} />
                                )}
                              </View>
                            );
                          })}
                        </View>
                        <View style={styles.progressLabels}>
                          {statusOrder.map((status, idx) => {
                            const currentIdx = statusOrder.indexOf(order.orderStatus);
                            const isDone = idx <= currentIdx;
                            const isCurrent = idx === currentIdx;
                            return (
                              <Text key={status} style={[styles.progressLabel, isDone && styles.progressLabelCompleted, isCurrent && styles.progressLabelCurrent]}>
                                {getStatusText(status)}
                              </Text>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Admin Actions */}
                    <View style={styles.adminActions}>
                      <TouchableOpacity style={styles.actionButton} onPress={() => shareOrderInvoice(order.orderId)}>
                        <MaterialIcons name="share" size={18} color={Colors.light.accent} />
                        <Text style={styles.actionButtonText}>Share Invoice</Text>
                      </TouchableOpacity>
                      {order.orderStatus !== 'cancelled' && order.orderStatus !== 'delivered' && (
                        <TouchableOpacity style={[styles.actionButton, styles.cancelButton]} onPress={() => cancelOrder(order.orderId)}>
                          <MaterialIcons name="cancel" size={18} color="#F44336" />
                          <Text style={[styles.actionButtonText, { color: '#F44336' }]}>Cancel Order</Text>
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

// === STYLES: Minimal top padding, clean layout ===
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  filterContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  filterButtonActive: {
    backgroundColor: Colors.light.accent,
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  filterButtonTextActive: {
    color: '#FFF',
  },
  headerContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    alignItems: 'flex-end',
  },
  shareAllHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  shareAllHeaderText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 100 },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText: { marginTop: 16, fontSize: 16, color: Colors.light.textSecondary },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { marginTop: 16, fontSize: 16, color: Colors.light.textSecondary, textAlign: 'center' },
  refreshButton: { marginTop: 16, backgroundColor: Colors.light.accent, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  refreshButtonText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  orderCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  orderIdRow: { flex: 1, marginRight: 12 },
  orderIdLarge: { fontSize: 16, fontWeight: '700', color: Colors.light.text, marginBottom: 4 },
  orderDate: { fontSize: 13, color: Colors.light.textSecondary },
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
  statusText: { fontSize: 12, fontWeight: "700" },
  customerSection: { marginBottom: 12 },
  itemsSection: { marginBottom: 12 },
  sectionTitleSmall: { fontSize: 14, fontWeight: '600', color: Colors.light.text, marginBottom: 6 },
  itemText: { fontSize: 14, color: Colors.light.textSecondary, marginBottom: 4 },
  moreItemsText: { fontSize: 12, color: Colors.light.textSecondary, fontStyle: 'italic' },
  billingSection: { marginBottom: 12 },
  billingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  billingLabel: { fontSize: 14, color: Colors.light.textSecondary },
  billingValue: { fontSize: 14, color: Colors.light.text },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.light.border, paddingTop: 8, marginTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: '600', color: Colors.light.text },
  totalValue: { fontSize: 16, fontWeight: '700', color: Colors.light.accent },
  discountText: { fontSize: 14, color: '#4CAF50', fontWeight: '600' },
  deliverySection: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
  deliveryLabel: { fontSize: 14, color: Colors.light.textSecondary },
  expandButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.light.border },
  expandButtonText: { fontSize: 14, fontWeight: '600', color: Colors.light.accent, marginRight: 8 },
  expandedContent: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.light.border },
  detailedItemsSection: { marginBottom: 16 },
  detailedItemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingLeft: 8 },
  detailedItemText: { fontSize: 13, color: Colors.light.textSecondary, flex: 1 },
  detailedItemTotal: { fontSize: 13, fontWeight: '600', color: Colors.light.text, width: 80, textAlign: 'right' },
  detailedBillingSection: {
    backgroundColor: 'rgba(33, 150, 243, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(33, 150, 243, 0.1)',
  },
  addressSection: { marginBottom: 16 },
  addressText: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: 2 },
  paymentSection: { marginBottom: 16 },
  paymentText: { fontSize: 13, color: Colors.light.textSecondary, marginBottom: 2 },
  instructionsSection: { marginBottom: 16 },
  instructionsText: { fontSize: 13, color: Colors.light.textSecondary, fontStyle: 'italic' },
  progressContainer: { marginTop: 8 },
  progressBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, marginTop: 8 },
  progressStep: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  progressDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.light.border, alignItems: 'center', justifyContent: 'center' },
  progressDotCompleted: { backgroundColor: Colors.light.accent },
  progressDotCurrent: { backgroundColor: Colors.light.accent, borderWidth: 2, borderColor: '#FFF', shadowColor: Colors.light.accent, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 },
  progressLine: { flex: 1, height: 2, backgroundColor: Colors.light.border, marginHorizontal: 4 },
  progressLineCompleted: { backgroundColor: Colors.light.accent },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: 10, color: Colors.light.textSecondary, textAlign: 'center', flex: 1 },
  progressLabelCompleted: { color: Colors.light.accent, fontWeight: '600' },
  progressLabelCurrent: { color: Colors.light.accent, fontWeight: '700' },
  adminActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.light.border },
  actionButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(33, 150, 243, 0.1)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, flex: 1, marginRight: 8, justifyContent: 'center' },
  cancelButton: { backgroundColor: 'rgba(244, 67, 54, 0.1)', marginRight: 0, marginLeft: 8 },
  actionButtonText: { marginLeft: 6, fontSize: 14, fontWeight: '600', color: Colors.light.accent },
});