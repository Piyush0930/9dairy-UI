// app/(tabs)/supadmin/orders.jsx
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import { MaterialIcons, FontAwesome5, Ionicons, Feather, Octicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

// Mock orders data
const MOCK_ORDERS = {
  summary: {
    total: 1567,
    pending: 23,
    confirmed: 45,
    processing: 34,
    shipped: 12,
    delivered: 1453,
    cancelled: 15,
    todayOrders: 89,
    todayRevenue: 12500,
    avgOrderValue: 285,
    growth: 15,
  },
  orders: [
    {
      id: 'ORD-001234',
      customer: {
        name: 'Amit Sharma',
        mobile: '9876543210',
        location: 'Mumbai, Maharashtra'
      },
      retailer: {
        name: 'Fresh Dairy Mart',
        id: 'RET-001'
      },
      products: [
        { name: 'Buffalo Milk', quantity: 2, price: 80 },
        { name: 'Fresh Curd', quantity: 1, price: 40 },
        { name: 'Paneer', quantity: 1, price: 120 }
      ],
      totalAmount: 320,
      discount: 20,
      finalAmount: 300,
      paymentMethod: 'online',
      paymentStatus: 'paid',
      orderStatus: 'delivered',
      orderDate: '2024-03-15T10:30:00',
      deliveryDate: '2024-03-15T14:45:00',
      deliveryAddress: '123 Main Street, Andheri East, Mumbai',
      deliveryType: 'express',
      rating: 4.5,
      notes: 'Leave at security desk',
      timeline: [
        { status: 'ordered', timestamp: '2024-03-15T10:30:00', description: 'Order placed' },
        { status: 'confirmed', timestamp: '2024-03-15T10:35:00', description: 'Order confirmed' },
        { status: 'processing', timestamp: '2024-03-15T11:00:00', description: 'Preparing order' },
        { status: 'shipped', timestamp: '2024-03-15T13:15:00', description: 'Out for delivery' },
        { status: 'delivered', timestamp: '2024-03-15T14:45:00', description: 'Delivered successfully' }
      ]
    },
    {
      id: 'ORD-001235',
      customer: {
        name: 'Priya Patel',
        mobile: '8765432109',
        location: 'Delhi, NCR'
      },
      retailer: {
        name: 'Milk & More',
        id: 'RET-002'
      },
      products: [
        { name: 'Cow Milk', quantity: 1, price: 60 },
        { name: 'White Butter', quantity: 2, price: 110 }
      ],
      totalAmount: 280,
      discount: 0,
      finalAmount: 280,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      orderStatus: 'processing',
      orderDate: '2024-03-15T11:15:00',
      deliveryDate: null,
      deliveryAddress: '456 Sector 15, Noida, Uttar Pradesh',
      deliveryType: 'standard',
      rating: null,
      notes: 'Call before delivery',
      timeline: [
        { status: 'ordered', timestamp: '2024-03-15T11:15:00', description: 'Order placed' },
        { status: 'confirmed', timestamp: '2024-03-15T11:20:00', description: 'Order confirmed' },
        { status: 'processing', timestamp: '2024-03-15T11:45:00', description: 'Preparing order' }
      ]
    },
    {
      id: 'ORD-001236',
      customer: {
        name: 'Rajesh Kumar',
        mobile: '7654321098',
        location: 'Bangalore, Karnataka'
      },
      retailer: {
        name: 'Dairy King',
        id: 'RET-003'
      },
      products: [
        { name: 'Mozzarella Cheese', quantity: 1, price: 180 },
        { name: 'Fresh Curd', quantity: 2, price: 40 }
      ],
      totalAmount: 260,
      discount: 26,
      finalAmount: 234,
      paymentMethod: 'online',
      paymentStatus: 'paid',
      orderStatus: 'shipped',
      orderDate: '2024-03-15T09:45:00',
      deliveryDate: null,
      deliveryAddress: '789 Koramangala, Bangalore',
      deliveryType: 'express',
      rating: null,
      notes: '',
      timeline: [
        { status: 'ordered', timestamp: '2024-03-15T09:45:00', description: 'Order placed' },
        { status: 'confirmed', timestamp: '2024-03-15T09:50:00', description: 'Order confirmed' },
        { status: 'processing', timestamp: '2024-03-15T10:15:00', description: 'Preparing order' },
        { status: 'shipped', timestamp: '2024-03-15T12:30:00', description: 'Out for delivery' }
      ]
    },
    {
      id: 'ORD-001237',
      customer: {
        name: 'Neha Singh',
        mobile: '6543210987',
        location: 'Pune, Maharashtra'
      },
      retailer: {
        name: 'Pure Milk Center',
        id: 'RET-004'
      },
      products: [
        { name: 'Buffalo Milk', quantity: 1, price: 80 },
        { name: 'Paneer', quantity: 1, price: 120 },
        { name: 'Butter Milk', quantity: 2, price: 30 }
      ],
      totalAmount: 260,
      discount: 0,
      finalAmount: 260,
      paymentMethod: 'online',
      paymentStatus: 'failed',
      orderStatus: 'cancelled',
      orderDate: '2024-03-15T08:20:00',
      deliveryDate: null,
      deliveryAddress: '321 FC Road, Pune',
      deliveryType: 'standard',
      rating: null,
      notes: 'Payment failed - order cancelled',
      timeline: [
        { status: 'ordered', timestamp: '2024-03-15T08:20:00', description: 'Order placed' },
        { status: 'cancelled', timestamp: '2024-03-15T08:25:00', description: 'Payment failed - order cancelled' }
      ]
    },
    {
      id: 'ORD-001238',
      customer: {
        name: 'Vikram Joshi',
        mobile: '9432109876',
        location: 'Hyderabad, Telangana'
      },
      retailer: {
        name: 'Farm Fresh Dairy',
        id: 'RET-005'
      },
      products: [
        { name: 'Cow Milk', quantity: 2, price: 60 },
        { name: 'Fresh Curd', quantity: 1, price: 40 }
      ],
      totalAmount: 160,
      discount: 16,
      finalAmount: 144,
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      orderStatus: 'pending',
      orderDate: '2024-03-15T14:10:00',
      deliveryDate: null,
      deliveryAddress: '654 Banjara Hills, Hyderabad',
      deliveryType: 'standard',
      rating: null,
      notes: '',
      timeline: [
        { status: 'ordered', timestamp: '2024-03-15T14:10:00', description: 'Order placed' }
      ]
    }
  ]
};

export default function OrdersScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [ordersData, setOrdersData] = useState(MOCK_ORDERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPayment, setFilterPayment] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [dateRange, setDateRange] = useState('today');
  const router = useRouter();
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setTimeout(() => {
      setOrdersData(MOCK_ORDERS);
      setRefreshing(false);
      Alert.alert('✅ Refreshed', 'Orders data updated');
    }, 1200);
  };

  // Filter orders based on search and filters
  const filteredOrders = ordersData.orders.filter(order => {
    const matchesSearch = order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         order.retailer.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || order.orderStatus === filterStatus;
    const matchesPayment = filterPayment === 'all' || order.paymentStatus === filterPayment;
    
    return matchesSearch && matchesStatus && matchesPayment;
  });

  // Status Badge Component
  const StatusBadge = ({ status, type = 'order' }) => {
    const getStatusConfig = (status, type) => {
      if (type === 'payment') {
        switch (status) {
          case 'paid':
            return { color: '#10B981', bgColor: '#D1FAE5', text: 'Paid', icon: 'check-circle' };
          case 'pending':
            return { color: '#F59E0B', bgColor: '#FEF3C7', text: 'Pending', icon: 'schedule' };
          case 'failed':
            return { color: '#EF4444', bgColor: '#FEE2E2', text: 'Failed', icon: 'error' };
          case 'refunded':
            return { color: '#8B5CF6', bgColor: '#EDE9FE', text: 'Refunded', icon: 'assignment-return' };
          default:
            return { color: '#6B7280', bgColor: '#F3F4F6', text: 'Unknown', icon: 'help' };
        }
      } else {
        switch (status) {
          case 'pending':
            return { color: '#F59E0B', bgColor: '#FEF3C7', text: 'Pending', icon: 'pending' };
          case 'confirmed':
            return { color: '#3B82F6', bgColor: '#DBEAFE', text: 'Confirmed', icon: 'check' };
          case 'processing':
            return { color: '#8B5CF6', bgColor: '#EDE9FE', text: 'Processing', icon: 'settings' };
          case 'shipped':
            return { color: '#F59E0B', bgColor: '#FEF3C7', text: 'Shipped', icon: 'local-shipping' };
          case 'delivered':
            return { color: '#10B981', bgColor: '#D1FAE5', text: 'Delivered', icon: 'check-circle' };
          case 'cancelled':
            return { color: '#EF4444', bgColor: '#FEE2E2', text: 'Cancelled', icon: 'cancel' };
          default:
            return { color: '#6B7280', bgColor: '#F3F4F6', text: 'Unknown', icon: 'help' };
        }
      }
    };

    const config = getStatusConfig(status, type);

    return (
      <View style={[styles.statusBadge, { backgroundColor: config.bgColor }]}>
        <MaterialIcons name={config.icon} size={12} color={config.color} />
        <Text style={[styles.statusText, { color: config.color }]}>
          {config.text}
        </Text>
      </View>
    );
  };

  // Summary Card Component
  const SummaryCard = ({ title, value, subtitle, color, icon, onPress }) => {
    return (
      <TouchableOpacity 
        style={[styles.summaryCard, { borderLeftColor: color }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.summaryHeader}>
          <View style={[styles.summaryIcon, { backgroundColor: color }]}>
            {icon}
          </View>
          <Text style={styles.summaryValue}>{value}</Text>
        </View>
        <Text style={styles.summaryTitle}>{title}</Text>
        {subtitle && <Text style={styles.summarySubtitle}>{subtitle}</Text>}
      </TouchableOpacity>
    );
  };

  // Order Card Component
  const OrderCard = ({ order }) => {
    const scaleAnim = useState(new Animated.Value(1))[0];

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.98,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    const handleViewDetails = () => {
      setSelectedOrder(order);
      setShowDetailsModal(true);
    };

    const handleQuickAction = (action) => {
      switch (action) {
        case 'contact_customer':
          Alert.alert('Contact Customer', `Call ${order.customer.name} at ${order.customer.mobile}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Call', onPress: () => console.log('Calling:', order.customer.mobile) }
          ]);
          break;
        case 'contact_retailer':
          Alert.alert('Contact Retailer', `Contact ${order.retailer.name}?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Contact', onPress: () => console.log('Contacting retailer:', order.retailer.name) }
          ]);
          break;
        case 'update_status':
          Alert.alert('Update Status', `Update order ${order.id} status?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Update', onPress: () => console.log('Updating status for:', order.id) }
          ]);
          break;
      }
    };

    const getProductSummary = () => {
      if (order.products.length === 1) {
        return order.products[0].name;
      } else {
        return `${order.products[0].name} + ${order.products.length - 1} more`;
      }
    };

    return (
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={styles.orderCard}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handleViewDetails}
          activeOpacity={0.8}
        >
          <View style={styles.orderHeader}>
            <View style={styles.orderInfo}>
              <Text style={styles.orderId}>{order.id}</Text>
              <Text style={styles.orderDate}>
                {new Date(order.orderDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </Text>
            </View>
            <View style={styles.statusContainer}>
              <StatusBadge status={order.orderStatus} type="order" />
              <StatusBadge status={order.paymentStatus} type="payment" />
            </View>
          </View>

          <View style={styles.orderDetails}>
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Feather name="user" size={14} color="#64748B" />
                <Text style={styles.detailText}>{order.customer.name}</Text>
              </View>
              <View style={styles.detailItem}>
                <FontAwesome5 name="store" size={12} color="#64748B" />
                <Text style={styles.detailText}>{order.retailer.name}</Text>
              </View>
            </View>
            
            <View style={styles.detailRow}>
              <View style={styles.detailItem}>
                <Feather name="package" size={14} color="#64748B" />
                <Text style={styles.detailText}>{getProductSummary()}</Text>
              </View>
              <View style={styles.detailItem}>
                <Feather name="map-pin" size={14} color="#64748B" />
                <Text style={styles.detailText}>{order.deliveryType}</Text>
              </View>
            </View>
          </View>

          <View style={styles.orderFooter}>
            <View style={styles.amountSection}>
              <Text style={styles.amountLabel}>Total Amount</Text>
              <Text style={styles.amountValue}>₹{order.finalAmount}</Text>
              {order.discount > 0 && (
                <Text style={styles.discountText}>Saved ₹{order.discount}</Text>
              )}
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity 
                style={[styles.actionButton, styles.contactButton]}
                onPress={() => handleQuickAction('contact_customer')}
              >
                <Feather name="phone" size={14} color="#FFFFFF" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.updateButton]}
                onPress={() => handleQuickAction('update_status')}
              >
                <Feather name="edit" size={14} color="#FFFFFF" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.actionButton, styles.detailsButton]}
                onPress={handleViewDetails}
              >
                <Feather name="eye" size={14} color="#3B82F6" />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const StatusFilter = () => {
    const statusFilters = [
      { key: 'all', label: 'All', count: ordersData.summary.total },
      { key: 'pending', label: 'Pending', count: ordersData.summary.pending },
      { key: 'confirmed', label: 'Confirmed', count: ordersData.summary.confirmed },
      { key: 'processing', label: 'Processing', count: ordersData.summary.processing },
      { key: 'shipped', label: 'Shipped', count: ordersData.summary.shipped },
      { key: 'delivered', label: 'Delivered', count: ordersData.summary.delivered },
      { key: 'cancelled', label: 'Cancelled', count: ordersData.summary.cancelled },
    ];

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        {statusFilters.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterButton,
              filterStatus === filter.key && styles.filterButtonActive
            ]}
            onPress={() => setFilterStatus(filter.key)}
          >
            <Text style={[
              styles.filterText,
              filterStatus === filter.key && styles.filterTextActive
            ]}>
              {filter.label}
            </Text>
            <View style={[
              styles.filterCount,
              filterStatus === filter.key && styles.filterCountActive
            ]}>
              <Text style={styles.filterCountText}>{filter.count}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const PaymentFilter = () => {
    const paymentFilters = [
      { key: 'all', label: 'All Payments' },
      { key: 'paid', label: 'Paid' },
      { key: 'pending', label: 'Pending' },
      { key: 'failed', label: 'Failed' },
    ];

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
      >
        {paymentFilters.map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterButton,
              filterPayment === filter.key && styles.filterButtonActive
            ]}
            onPress={() => setFilterPayment(filter.key)}
          >
            <Text style={[
              styles.filterText,
              filterPayment === filter.key && styles.filterTextActive
            ]}>
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const TimelineItem = ({ item, isLast }) => {
    const getStatusIcon = (status) => {
      switch (status) {
        case 'ordered': return 'shopping-cart';
        case 'confirmed': return 'check';
        case 'processing': return 'settings';
        case 'shipped': return 'local-shipping';
        case 'delivered': return 'check-circle';
        case 'cancelled': return 'cancel';
        default: return 'help';
      }
    };

    const getStatusColor = (status) => {
      switch (status) {
        case 'ordered': return '#3B82F6';
        case 'confirmed': return '#8B5CF6';
        case 'processing': return '#F59E0B';
        case 'shipped': return '#10B981';
        case 'delivered': return '#10B981';
        case 'cancelled': return '#EF4444';
        default: return '#6B7280';
      }
    };

    return (
      <View style={styles.timelineItem}>
        <View style={styles.timelineIconContainer}>
          <View style={[styles.timelineIcon, { backgroundColor: getStatusColor(item.status) }]}>
            <MaterialIcons name={getStatusIcon(item.status)} size={16} color="#FFFFFF" />
          </View>
          {!isLast && <View style={styles.timelineConnector} />}
        </View>
        <View style={styles.timelineContent}>
          <Text style={styles.timelineDescription}>{item.description}</Text>
          <Text style={styles.timelineTime}>
            {new Date(item.timestamp).toLocaleString('en-IN', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Orders Management</Text>
          <Text style={styles.headerSubtitle}>Monitor and manage all platform orders</Text>
        </View>
        <TouchableOpacity style={styles.exportButton}>
          <Feather name="download" size={18} color="#FFFFFF" />
          <Text style={styles.exportButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Cards */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Orders Overview</Text>
            <TouchableOpacity onPress={onRefresh}>
              <MaterialIcons name="refresh" size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
          <View style={styles.summaryGrid}>
            <SummaryCard
              title="Total Orders"
              value={ordersData.summary.total}
              subtitle={`${ordersData.summary.growth}% growth`}
              color="#3B82F6"
              icon={<Feather name="shopping-bag" size={18} color="#FFFFFF" />}
              onPress={() => setFilterStatus('all')}
            />
            <SummaryCard
              title="Today's Orders"
              value={ordersData.summary.todayOrders}
              subtitle="Placed today"
              color="#10B981"
              icon={<MaterialIcons name="today" size={20} color="#FFFFFF" />}
              onPress={() => setDateRange('today')}
            />
            <SummaryCard
              title="Pending"
              value={ordersData.summary.pending}
              subtitle="Awaiting action"
              color="#F59E0B"
              icon={<MaterialIcons name="pending" size={20} color="#FFFFFF" />}
              onPress={() => setFilterStatus('pending')}
            />
            <SummaryCard
              title="Revenue"
              value={`₹${(ordersData.summary.todayRevenue / 1000).toFixed(1)}K`}
              subtitle="Today's revenue"
              color="#8B5CF6"
              icon={<FontAwesome5 name="rupee-sign" size={16} color="#FFFFFF" />}
              onPress={() => console.log('Revenue details')}
            />
          </View>
        </View>

        {/* Search and Filters */}
        <View style={styles.section}>
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Feather name="search" size={20} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search orders by ID, customer, or retailer..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#94A3B8"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialIcons name="clear" size={20} color="#64748B" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <Text style={styles.filterLabel}>Order Status</Text>
          <StatusFilter />
          
          <Text style={styles.filterLabel}>Payment Status</Text>
          <PaymentFilter />
        </View>

        {/* Orders List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {filterStatus === 'all' ? 'All Orders' : 
               `${filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)} Orders`}
            </Text>
            <Text style={styles.resultsCount}>
              {filteredOrders.length} results
            </Text>
          </View>

          {filteredOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Feather name="package" size={48} color="#E2E8F0" />
              <Text style={styles.emptyStateTitle}>No orders found</Text>
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'Try adjusting your search terms' : 'No orders match the selected filters'}
              </Text>
            </View>
          ) : (
            <View style={styles.ordersList}>
              {filteredOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </View>
          )}
        </View>

        {/* Bottom Spacer */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Order Details Modal */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        {selectedOrder && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Order Details</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowDetailsModal(false)}
              >
                <MaterialIcons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalContent}>
              {/* Order Header */}
              <View style={styles.modalSection}>
                <View style={styles.orderHeaderModal}>
                  <Text style={styles.modalOrderId}>{selectedOrder.id}</Text>
                  <View style={styles.statusContainer}>
                    <StatusBadge status={selectedOrder.orderStatus} type="order" />
                    <StatusBadge status={selectedOrder.paymentStatus} type="payment" />
                  </View>
                </View>
                <Text style={styles.orderDateModal}>
                  Ordered on {new Date(selectedOrder.orderDate).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
              </View>

              {/* Customer & Retailer Info */}
              <View style={styles.modalSection}>
                <View style={styles.infoGrid}>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>Customer</Text>
                    <Text style={styles.infoValue}>{selectedOrder.customer.name}</Text>
                    <Text style={styles.infoSubtitle}>{selectedOrder.customer.mobile}</Text>
                    <Text style={styles.infoSubtitle}>{selectedOrder.customer.location}</Text>
                  </View>
                  <View style={styles.infoCard}>
                    <Text style={styles.infoTitle}>Retailer</Text>
                    <Text style={styles.infoValue}>{selectedOrder.retailer.name}</Text>
                    <Text style={styles.infoSubtitle}>ID: {selectedOrder.retailer.id}</Text>
                  </View>
                </View>
              </View>

              {/* Products */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Products</Text>
                {selectedOrder.products.map((product, index) => (
                  <View key={index} style={styles.productItem}>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productQuantity}>Qty: {product.quantity}</Text>
                    </View>
                    <Text style={styles.productPrice}>₹{product.price * product.quantity}</Text>
                  </View>
                ))}
                <View style={styles.amountSummary}>
                  <View style={styles.amountRow}>
                    <Text style={styles.amountLabel}>Subtotal</Text>
                    <Text style={styles.amountValue}>₹{selectedOrder.totalAmount}</Text>
                  </View>
                  {selectedOrder.discount > 0 && (
                    <View style={styles.amountRow}>
                      <Text style={styles.amountLabel}>Discount</Text>
                      <Text style={[styles.amountValue, styles.discountValue]}>-₹{selectedOrder.discount}</Text>
                    </View>
                  )}
                  <View style={[styles.amountRow, styles.totalRow]}>
                    <Text style={styles.totalLabel}>Total Amount</Text>
                    <Text style={styles.totalValue}>₹{selectedOrder.finalAmount}</Text>
                  </View>
                </View>
              </View>

              {/* Delivery Info */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Delivery Information</Text>
                <View style={styles.deliveryInfo}>
                  <View style={styles.infoRow}>
                    <Feather name="map-pin" size={16} color="#64748B" />
                    <Text style={styles.infoText}>{selectedOrder.deliveryAddress}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Feather name="truck" size={16} color="#64748B" />
                    <Text style={styles.infoText}>{selectedOrder.deliveryType} Delivery</Text>
                  </View>
                  {selectedOrder.notes && (
                    <View style={styles.infoRow}>
                      <Feather name="file-text" size={16} color="#64748B" />
                      <Text style={styles.infoText}>Notes: {selectedOrder.notes}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Order Timeline */}
              <View style={styles.modalSection}>
                <Text style={styles.sectionTitle}>Order Timeline</Text>
                <View style={styles.timeline}>
                  {selectedOrder.timeline.map((item, index) => (
                    <TimelineItem 
                      key={index} 
                      item={item} 
                      isLast={index === selectedOrder.timeline.length - 1} 
                    />
                  ))}
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalButton, styles.primaryButton]}>
                  <Text style={styles.modalButtonText}>Update Status</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.secondaryButton]}>
                  <Text style={[styles.modalButtonText, { color: '#3B82F6' }]}>Contact Customer</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748B',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    marginBottom: 0,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  resultsCount: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    width: (width - 88) / 2,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  summaryTitle: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 2,
  },
  summarySubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  filterContainer: {
    marginBottom: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterButtonActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  filterText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
    marginRight: 6,
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  filterCount: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  filterCountActive: {
    backgroundColor: '#1D4ED8',
  },
  filterCountText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '700',
  },
  ordersList: {
    gap: 12,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 2,
  },
  orderDate: {
    fontSize: 14,
    color: '#64748B',
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  orderDetails: {
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#64748B',
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountSection: {
    flex: 1,
  },
  amountLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 2,
  },
  discountText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactButton: {
    backgroundColor: '#3B82F6',
  },
  updateButton: {
    backgroundColor: '#F59E0B',
  },
  detailsButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#64748B',
    marginTop: 12,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 20,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
  modalSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  orderHeaderModal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modalOrderId: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  orderDateModal: {
    fontSize: 16,
    color: '#64748B',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  infoValue: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  productItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    color: '#1E293B',
    marginBottom: 2,
  },
  productQuantity: {
    fontSize: 14,
    color: '#64748B',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  amountSummary: {
    marginTop: 16,
    gap: 8,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  discountValue: {
    color: '#10B981',
  },
  deliveryInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  timeline: {
    gap: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
  },
  timelineIconContainer: {
    alignItems: 'center',
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineConnector: {
    width: 2,
    height: 24,
    backgroundColor: '#E2E8F0',
    marginTop: 8,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineDescription: {
    fontSize: 16,
    color: '#1E293B',
    marginBottom: 4,
  },
  timelineTime: {
    fontSize: 14,
    color: '#64748B',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3B82F6',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
