import Colors from "@/constants/colors";
import { FontAwesome, Ionicons, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function getStatusIcon(status) {
  switch (status) {
    case "delivered":
      return <FontAwesome name="check-circle" size={20} color="#4CAF50" />;
    case "out_for_delivery":
      return <MaterialIcons name="local-shipping" size={20} color={Colors.light.accent} />;
    case "pending":
      return <Ionicons name="time-outline" size={20} color="#FF9800" />;
    case "confirmed":
      return <FontAwesome name="check" size={20} color="#4CAF50" />;
    case "preparing":
      return <MaterialIcons name="build" size={20} color="#FF9800" />;
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
      return Colors.light.accent;
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

const API_BASE_URL = `${process.env.EXPO_PUBLIC_API_URL}/api`;

const statusOrder = ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'delivered'];

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState([]);
  const [delayedDeliveredOrders, setDelayedDeliveredOrders] = useState(new Set());

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState('orders');

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

  const cancelOrder = async (orderId) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/orders/${orderId}/cancel`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to cancel order');
      }

      if (data.success) {
        Alert.alert('Success', 'Order cancelled successfully');
        fetchOrders(); // Refresh orders
      } else {
        throw new Error(data.message || 'Failed to cancel order');
      }
    } catch (error) {
      console.error('Cancel Order Error:', error);
      Alert.alert('Error', error.message || 'Failed to cancel order');
    }
  };

  const handleStatusChange = (orderId, selectedStatus) => {
    const currentStatus = orders.find(order => order.orderId === orderId)?.orderStatus;
    const currentIndex = statusOrder.indexOf(currentStatus);
    const selectedIndex = statusOrder.indexOf(selectedStatus);

    // Handle cancel separately
    if (selectedStatus === 'cancelled') {
      Alert.alert(
        'Cancel Order',
        'Are you sure you want to cancel this order?',
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelOrder(orderId) },
        ]
      );
      return;
    }

    // Prevent going backwards in status flow
    if (selectedIndex < currentIndex) {
      Alert.alert(
        'Invalid Status Change',
        'You cannot revert to a previous status. Status can only move forward.',
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Update Order Status',
      `Change status to ${getStatusText(selectedStatus)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Update', onPress: () => updateOrderStatus(orderId, selectedStatus) },
      ]
    );
  };

  const openOrderDetails = (order) => {
    setSelectedOrder(order);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedOrder(null);
  };

  // Share individual order invoice
  const shareOrderInvoice = async (orderId) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      setLoading(true);

      const fileUri = FileSystem.documentDirectory + `invoice-${orderId}.pdf`;

      // Download the PDF to temporary storage
      const downloadResult = await FileSystem.downloadAsync(
        `${API_BASE_URL}/orders/${orderId}/invoice`,
        fileUri,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (downloadResult.status !== 200) {
        throw new Error('Failed to generate invoice');
      }

      // Share the PDF using native share sheet
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Invoice',
          UTI: 'com.adobe.pdf' // iOS specific
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }

    } catch (error) {
      console.error('Share Invoice Error:', error);
      Alert.alert('Error', error.message || 'Failed to share invoice');
    } finally {
      setLoading(false);
    }
  };

  // Share overall invoice summary (Admin only)
  const shareOverallInvoice = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        Alert.alert('Error', 'Authentication required');
        return;
      }

      setLoading(true);

      const fileUri = FileSystem.documentDirectory + `overall-invoice-${new Date().toISOString().split('T')[0]}.pdf`;

      // Download the PDF to temporary storage
      const downloadResult = await FileSystem.downloadAsync(
        `${API_BASE_URL}/admin/invoices/pdf`,
        fileUri,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (downloadResult.status !== 200) {
        throw new Error('Failed to generate overall invoice');
      }

      // Share the PDF using native share sheet
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Overall Invoice Report',
          UTI: 'com.adobe.pdf' // iOS specific
        });
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }

    } catch (error) {
      console.error('Share Overall Invoice Error:', error);
      Alert.alert('Error', error.message || 'Failed to share overall invoice');
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    fetchOrders();
  }, []);



  // Filter orders based on activeFilter
  const filteredOrders = activeFilter === 'orders'
    ? orders.filter(order => order.orderStatus !== 'delivered')
    : orders.filter(order => order.orderStatus === 'delivered');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'orders' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('orders')}
          >
            <Text style={[styles.filterButtonText, activeFilter === 'orders' && styles.filterButtonTextActive]}>Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'history' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('history')}
          >
            <Text style={[styles.filterButtonText, activeFilter === 'history' && styles.filterButtonTextActive]}>History</Text>
          </TouchableOpacity>
        </View>



        <View style={styles.ordersContainer}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {activeFilter === 'orders' ? 'Active Orders' : 'Order History'}
            </Text>
            {activeFilter === 'history' && (
              <TouchableOpacity onPress={shareOverallInvoice} style={styles.shareAllButton}>
                <MaterialIcons name="share" size={24} color="#FFF" />
                <Text style={styles.shareAllButtonText}>Share All</Text>
              </TouchableOpacity>
            )}
          </View>
          {loading ? (
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
            </View>
          ) : (
            filteredOrders.map((order) => {
              const customerName = order.customerName || order.customer?.personalInfo?.fullName || 'N/A';
              const customerPhone = order.customer?.personalInfo?.phone || 'N/A';
              const subtotal = order.totalAmount || 0;
              const discount = order.discount || 0;
              const finalAmount = order.finalAmount || subtotal;
              return (
                <TouchableOpacity key={order._id} style={styles.orderCard} onPress={() => openOrderDetails(order)}>
                  {/* Order Header */}
                  <View style={styles.orderHeader}>
                    <View style={styles.orderIdRow}>
                      <Text style={styles.orderIdLarge}>{order.orderId}</Text>
                      <Text style={styles.orderDate}>{new Date(order.createdAt).toLocaleDateString("en-IN")}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.orderStatus) }]}>
                      {getStatusIcon(order.orderStatus)}
                      <Text style={styles.statusText}>{getStatusText(order.orderStatus)}</Text>
                    </View>
                  </View>

                  {/* Customer Info */}
                  <View style={styles.customerSection}>
                    <Text style={styles.customerNameLarge}>{customerName}</Text>
                    <Text style={styles.customerPhone}>{customerPhone}</Text>
                  </View>

                  {/* Items List */}
                  <View style={styles.itemsSection}>
                    <Text style={styles.sectionTitleSmall}>Items:</Text>
                    {order.items.slice(0, 3).map((item, index) => (
                      <Text key={index} style={styles.itemText}>
                        {item.product?.name || 'Product'} - {item.quantity}x {item.unit || 'unit'} @ ₹{item.price || 'N/A'} = ₹{(item.quantity * (item.price || 0)).toFixed(2)}
                      </Text>
                    ))}
                    {order.items.length > 3 && (
                      <Text style={styles.moreItemsText}>+{order.items.length - 3} more items</Text>
                    )}
                  </View>

                  {/* Billing Summary */}
                  <View style={styles.billingSection}>
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
                      <Text style={styles.totalLabel}>Total:</Text>
                      <Text style={styles.totalValue}>₹{finalAmount.toFixed(2)}</Text>
                    </View>
                  </View>

                  {/* Delivery Info */}
                  <View style={styles.deliverySection}>
                    <Text style={styles.deliveryLabel}>Delivery: {new Date(order.deliveryDate).toLocaleDateString("en-IN")} at {order.deliveryTime || 'N/A'}</Text>
                  </View>

                  {/* Progress Bar */}
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      {statusOrder.map((status, index) => {
                        const currentIndex = statusOrder.indexOf(order.orderStatus);
                        const isCompleted = index <= currentIndex;
                        const isCurrent = index === currentIndex;
                        const isClickable = index >= currentIndex;
                        return (
                          <View key={status} style={styles.progressStep}>
                            <TouchableOpacity
                              style={[
                                styles.progressDot,
                                isCompleted && styles.progressDotCompleted,
                                isCurrent && styles.progressDotCurrent,
                                isClickable && styles.progressDotClickable
                              ]}
                              onPress={() => isClickable && handleStatusChange(order.orderId, status)}
                              disabled={!isClickable}
                            >
                              {isCompleted && <FontAwesome name="check" size={12} color="#FFF" />}
                            </TouchableOpacity>
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
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {selectedOrder && (
        <Modal
          visible={modalVisible}
          animationType="slide"
          onRequestClose={closeModal}
        >
          <View style={styles.modalContainer}>
            <ScrollView style={styles.modalScrollView} contentContainerStyle={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Order Invoice</Text>
                <View style={styles.modalHeaderButtons}>
                  <TouchableOpacity onPress={() => shareOrderInvoice(selectedOrder.orderId)} style={styles.downloadButton}>
                    <MaterialIcons name="share" size={24} color={Colors.light.accent} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                    <MaterialIcons name="close" size={24} color={Colors.light.text} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.invoiceContainer}>
                {/* Invoice Header */}
                <View style={styles.invoiceHeader}>
                  <Text style={styles.companyName}>Dairy Nine</Text>
                  <Text style={styles.invoiceTitle}>Order Invoice</Text>
                </View>

                {/* Invoice Details */}
                <View style={styles.invoiceDetails}>
                  <View style={styles.invoiceDetailLeft}>
                    <Text style={styles.invoiceDetailText}>Order ID: {selectedOrder.orderId}</Text>
                    <Text style={styles.invoiceDetailText}>Status: {getStatusText(selectedOrder.orderStatus)}</Text>
                    <Text style={styles.invoiceDetailText}>Created: {new Date(selectedOrder.createdAt).toLocaleDateString("en-IN")}</Text>
                  </View>
                  <View style={styles.invoiceDetailRight}>
                    <Text style={styles.invoiceDetailText}>Delivery Date: {new Date(selectedOrder.deliveryDate).toLocaleDateString("en-IN")}</Text>
                    <Text style={styles.invoiceDetailText}>Delivery Time: {selectedOrder.deliveryTime || 'N/A'}</Text>
                  </View>
                </View>

                {/* Customer Details */}
                <View style={styles.customerSectionInvoice}>
                  <Text style={styles.sectionTitleInvoice}>Customer Details</Text>
                  <Text style={styles.customerDetailText}>Name: {selectedOrder.customerName || selectedOrder.customer?.personalInfo?.fullName || 'N/A'}</Text>
                  <Text style={styles.customerDetailText}>Phone: {selectedOrder.customer?.personalInfo?.phone || 'N/A'}</Text>
                  <Text style={styles.customerDetailText}>Email: {selectedOrder.customer?.personalInfo?.email || 'N/A'}</Text>
                  <Text style={styles.customerDetailText}>Address: {selectedOrder.deliveryAddress ? `${selectedOrder.deliveryAddress.addressLine1}${selectedOrder.deliveryAddress.addressLine2 ? ', ' + selectedOrder.deliveryAddress.addressLine2 : ''}, ${selectedOrder.deliveryAddress.city}, ${selectedOrder.deliveryAddress.state} ${selectedOrder.deliveryAddress.pincode}${selectedOrder.deliveryAddress.landmark ? ', Landmark: ' + selectedOrder.deliveryAddress.landmark : ''}` : 'Address not available'}</Text>
                </View>

                {/* Items Table */}
                <View style={styles.table}>
                  <View style={styles.tableHeader}>
                    <Text style={styles.tableHeaderText}>S.No</Text>
                    <Text style={styles.tableHeaderText}>Item</Text>
                    <Text style={styles.tableHeaderText}>Qty</Text>
                    <Text style={styles.tableHeaderText}>Unit</Text>
                    <Text style={styles.tableHeaderText}>Price</Text>
                    <Text style={styles.tableHeaderText}>Total</Text>
                  </View>
                  {selectedOrder.items.map((item, index) => (
                    <View key={index} style={styles.tableRow}>
                      <Text style={styles.tableCell}>{index + 1}</Text>
                      <Text style={styles.tableCell}>{item.product?.name || 'Product'}</Text>
                      <Text style={styles.tableCell}>{item.quantity}</Text>
                      <Text style={styles.tableCell}>{item.unit || 'unit'}</Text>
                      <Text style={styles.tableCell}>₹{item.price || 'N/A'}</Text>
                      <Text style={styles.tableCell}>₹{(item.quantity * (item.price || 0)).toFixed(2)}</Text>
                    </View>
                  ))}
                </View>

                {/* Billing Summary */}
                <View style={styles.billingSummary}>
                  <View style={styles.billingSummaryRow}>
                    <Text style={styles.billingSummaryLabel}>Subtotal:</Text>
                    <Text style={styles.billingSummaryValue}>₹{selectedOrder.totalAmount || 0}</Text>
                  </View>
                  {selectedOrder.discount > 0 && (
                    <View style={styles.billingSummaryRow}>
                      <Text style={styles.billingSummaryLabel}>Discount:</Text>
                      <Text style={styles.billingSummaryValue}>-₹{selectedOrder.discount}</Text>
                    </View>
                  )}
                  <View style={[styles.billingSummaryRow, styles.totalSummaryRow]}>
                    <Text style={styles.totalSummaryLabel}>Total:</Text>
                    <Text style={styles.totalSummaryValue}>₹{selectedOrder.finalAmount}</Text>
                  </View>
                </View>

                {/* Footer */}
                <View style={styles.footerSection}>
                  <Text style={styles.footerText}>Payment Method: {selectedOrder.paymentMethod || 'N/A'}</Text>
                  <Text style={styles.footerText}>Payment Status: {selectedOrder.paymentStatus || 'N/A'}</Text>
                  {selectedOrder.specialInstructions && (
                    <Text style={styles.footerText}>Special Instructions: {selectedOrder.specialInstructions}</Text>
                  )}
                </View>
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  filterContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: Colors.light.accent,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  filterButtonTextActive: {
    color: '#FFF',
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
  },
  shareAllButton: {
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareAllButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
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
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderIdRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: 8,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  priceBadge: {
    backgroundColor: '#ADD8E6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  priceBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  orderIdSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "700",
  },
  itemText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  discountText: {
    fontSize: 12,
    color: Colors.light.accent,
    marginTop: 2,
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
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  modalScrollView: {
    flex: 1,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 100,
  },
  invoiceContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  invoiceHeader: {
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
    paddingBottom: 10,
  },
  companyName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  invoiceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
  },
  invoiceDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  invoiceDetailLeft: {
    flex: 1,
  },
  invoiceDetailRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  invoiceDetailText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  customerSectionInvoice: {
    marginBottom: 20,
  },
  sectionTitleInvoice: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  customerDetailText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: Colors.light.background,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.light.text,
    flex: 1,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  tableCell: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    flex: 1,
    textAlign: 'center',
  },
  billingSummary: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  billingSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '50%',
    marginBottom: 4,
  },
  billingSummaryLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  billingSummaryValue: {
    fontSize: 14,
    color: Colors.light.text,
  },
  totalSummaryRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: 4,
    marginTop: 4,
  },
  totalSummaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  totalSummaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  footerSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: 10,
  },
  footerText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.light.text,
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadButton: {
    padding: 8,
    marginRight: 8,
  },
  closeButton: {
    padding: 8,
  },
  modalSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  detailText: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  orderIdLarge: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
  },
  customerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileLetter: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  customerNameLarge: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  customerPhone: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  itemsSection: {
    marginBottom: 12,
  },
  sectionTitleSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  moreItemsText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
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
    color: Colors.light.textSecondary,
  },
  billingValue: {
    fontSize: 14,
    color: Colors.light.text,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.light.border,
    paddingTop: 4,
    marginTop: 4,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  deliverySection: {
    marginBottom: 12,
  },
  deliveryLabel: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  totalBill: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  orderIdSmall: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.light.textSecondary,
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  orderDate: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  statusPicker: {
    width: 150,
    height: 40,
    borderWidth: 1,
    borderColor: Colors.light.border,
    borderRadius: 6,
  },
  progressContainer: {
    flex: 1,
    marginRight: 12,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressStep: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.light.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  progressDotCompleted: {
    backgroundColor: Colors.light.accent,
  },
  progressDotCurrent: {
    backgroundColor: Colors.light.accent,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  progressDotClickable: {
    shadowColor: Colors.light.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.light.border,
    marginHorizontal: 4,
  },
  progressLineCompleted: {
    backgroundColor: Colors.light.accent,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 10,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    flex: 1,
  },
  progressLabelCompleted: {
    color: Colors.light.accent,
    fontWeight: '600',
  },
  progressLabelCurrent: {
    color: Colors.light.accent,
    fontWeight: '700',
  },
  pickerContainer: {
    alignItems: 'flex-end',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 120,
    justifyContent: 'space-between',
  },
  statusButtonText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownModal: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
    maxWidth: 300,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  dropdownItemDisabled: {
    backgroundColor: Colors.light.background,
  },
  dropdownItemText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  dropdownItemTextDisabled: {
    color: Colors.light.textSecondary,
  },
});
