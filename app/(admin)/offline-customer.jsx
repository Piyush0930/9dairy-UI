// app/(admin)/offline-customer.jsx
import Colors from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

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
    orderType: order.orderType || 'offline'
  };
};

export default function CustomerManagementScreen() {
  const insets = useSafeAreaInsets();
  const { authToken } = useAuth();
  const router = useRouter();
  
  // States for contact list
  const [regularCustomers, setRegularCustomers] = useState([]);
  const [walkinCustomers, setWalkinCustomers] = useState([]);
  const [filteredRegularCustomers, setFilteredRegularCustomers] = useState([]);
  const [filteredWalkinCustomers, setFilteredWalkinCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all"); // all, pending, paid
  const [activeTab, setActiveTab] = useState("regular"); // regular, walkin

  // States for contact details
  const [selectedContact, setSelectedContact] = useState(null);
  const [contactOrders, setContactOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersPaymentFilter, setOrdersPaymentFilter] = useState("all");
  const [showContactDetails, setShowContactDetails] = useState(false);
  const [contactStats, setContactStats] = useState({
    totalOrders: 0,
    pendingAmount: 0,
    totalSpent: 0,
    pendingOrders: 0
  });

  // API Helper Functions
  const handleApiError = (error, msg) => {
    console.error("API Error:", error);
    Alert.alert("Error", msg || "Something went wrong.");
  };

  const validateAuthBeforeCall = async () => {
    if (!authToken) {
      Alert.alert("Authentication Error", "Please login again");
      return false;
    }
    return true;
  };

  // Fetch contacts and their orders from offline orders
  const fetchContacts = async () => {
    if (!(await validateAuthBeforeCall())) return;
    
    setLoading(true);
    setRefreshing(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/retailer/order-history`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📦 Raw orders data:', data.orders?.length || 0);
        
        const orders = data.orders || data.data || [];
        
        // Filter offline orders only and process them
        const offlineOrders = orders
          .filter(order => order.orderType === 'offline')
          .map(processOrderData);
        
        console.log('📦 Processed offline orders:', offlineOrders.length);

        // Separate Regular Customers and Walk-in Customers
        const regularCustomerMap = new Map();
        const walkinCustomersList = [];
        
        offlineOrders.forEach(order => {
          const phone = order.customerPhone || order.customer?.phone || order.customer?.personalInfo?.phone;
          const name = order.customerName || order.customer?.personalInfo?.fullName || order.customer?.fullName || 'Customer';
          
          // FIXED: Group by phone number only - if phone exists, it's a regular customer
          if (phone && phone !== 'unknown') {
            if (!regularCustomerMap.has(phone)) {
              regularCustomerMap.set(phone, {
                id: phone, // Use phone as unique ID
                name: name,
                phone: phone,
                totalOrders: 0,
                pendingAmount: 0,
                totalSpent: 0,
                lastOrderDate: order.createdAt,
                orders: [],
                allNames: new Set([name]) // Track all names used with this phone
              });
            }
            
            const customer = regularCustomerMap.get(phone);
            customer.totalOrders++;
            customer.orders.push(order);
            
            // Add to all names set if different name
            if (name && name !== customer.name) {
              customer.allNames.add(name);
              // Update primary name to the most recent one
              customer.name = name;
            }
            
            const orderAmount = order.finalAmount || 0;
            
            if (order.paymentStatus === 'pending') {
              customer.pendingAmount += orderAmount;
            } else {
              customer.totalSpent += orderAmount;
            }
            
            // Update last order date
            if (new Date(order.createdAt) > new Date(customer.lastOrderDate)) {
              customer.lastOrderDate = order.createdAt;
            }
          } else {
            // This is a walk-in customer - treat each order individually
            walkinCustomersList.push({
              id: order._id, // Use order ID as unique identifier
              name: name,
              phone: phone || 'No Contact',
              orderId: order.orderId,
              totalOrders: 1,
              pendingAmount: order.paymentStatus === 'pending' ? (order.finalAmount || 0) : 0,
              totalSpent: order.paymentStatus === 'paid' ? (order.finalAmount || 0) : 0,
              lastOrderDate: order.createdAt,
              order: order, // Store the single order
              isWalkin: true,
              paymentStatus: order.paymentStatus
            });
          }
        });

        // Convert map to array and sort by last order date
        const regularCustomerList = Array.from(regularCustomerMap.values())
          .sort((a, b) => new Date(b.lastOrderDate) - new Date(a.lastOrderDate));

        // Sort walk-in customers by last order date
        const sortedWalkinCustomers = walkinCustomersList
          .sort((a, b) => new Date(b.lastOrderDate) - new Date(a.lastOrderDate));

        console.log('📦 Final regular customers:', regularCustomerList.length);
        console.log('📦 Walk-in customers count:', sortedWalkinCustomers.length);
        
        setRegularCustomers(regularCustomerList);
        setWalkinCustomers(sortedWalkinCustomers);
        setFilteredRegularCustomers(regularCustomerList);
        setFilteredWalkinCustomers(sortedWalkinCustomers);
      } else {
        throw new Error('Failed to fetch orders');
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      handleApiError(error, "Failed to load contacts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch contact orders for details view
  const fetchContactOrders = async (contact, isWalkin = false) => {
    if (!(await validateAuthBeforeCall())) return;
    
    setOrdersLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/retailer/order-history`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const allOrders = data.orders || data.data || [];
        
        let orders = [];
        
        if (isWalkin) {
          // For walk-in, just show the single order
          orders = [contact.order];
        } else {
          // FIXED: For regular customers, fetch all orders with same phone number
          orders = allOrders
            .filter(order => {
              const orderPhone = order.customerPhone || order.customer?.phone || order.customer?.personalInfo?.phone;
              return order.orderType === 'offline' && orderPhone === contact.phone;
            })
            .map(processOrderData);
        }
        
        console.log('📦 Contact orders for', contact.phone, ':', orders.length);
        
        // Sort by date (newest first)
        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        setContactOrders(orders);
        setFilteredOrders(orders);
        
        // Calculate stats
        const stats = {
          totalOrders: orders.length,
          pendingAmount: 0,
          totalSpent: 0,
          pendingOrders: 0
        };
        
        orders.forEach(order => {
          const orderAmount = order.finalAmount || 0;
          if (order.paymentStatus === 'pending') {
            stats.pendingAmount += orderAmount;
            stats.pendingOrders++;
          } else {
            stats.totalSpent += orderAmount;
          }
        });
        
        setContactStats(stats);
      } else {
        throw new Error('Failed to fetch contact orders');
      }
    } catch (error) {
      console.error('Error fetching contact orders:', error);
      handleApiError(error, "Failed to load contact orders");
    } finally {
      setOrdersLoading(false);
    }
  };

  // Filter contacts based on search and payment filter
  useEffect(() => {
    const filterData = (data) => {
      let filtered = data;
      
      // Apply search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(contact => 
          contact.name.toLowerCase().includes(query) ||
          contact.phone.includes(searchQuery) ||
          (contact.orderId && contact.orderId.toLowerCase().includes(query)) ||
          Array.from(contact.allNames || []).some(name => name.toLowerCase().includes(query))
        );
      }
      
      // Apply payment status filter
      if (paymentFilter === 'pending') {
        filtered = filtered.filter(contact => contact.pendingAmount > 0);
      } else if (paymentFilter === 'paid') {
        filtered = filtered.filter(contact => contact.pendingAmount === 0 && contact.totalSpent > 0);
      }
      
      return filtered;
    };

    setFilteredRegularCustomers(filterData(regularCustomers));
    setFilteredWalkinCustomers(filterData(walkinCustomers));
  }, [searchQuery, paymentFilter, regularCustomers, walkinCustomers]);

  // Filter orders based on payment status
  useEffect(() => {
    if (ordersPaymentFilter === 'all') {
      setFilteredOrders(contactOrders);
    } else if (ordersPaymentFilter === 'pending') {
      setFilteredOrders(contactOrders.filter(order => order.paymentStatus === 'pending'));
    } else if (ordersPaymentFilter === 'paid') {
      setFilteredOrders(contactOrders.filter(order => order.paymentStatus === 'paid'));
    }
  }, [ordersPaymentFilter, contactOrders]);

  useEffect(() => {
    fetchContacts();
  }, [authToken]);

  const handleContactSelect = (contact, isWalkin = false) => {
    setSelectedContact({...contact, isWalkin});
    fetchContactOrders(contact, isWalkin);
    setShowContactDetails(true);
  };

  // ✅ FIXED: Enhanced markOrderAsPaid function with better error handling
  const markOrderAsPaid = async (orderId) => {
    if (!(await validateAuthBeforeCall())) return;
    
    try {
      console.log('🔄 Marking order as paid:', orderId);
      
      // ✅ FIXED: Use the correct endpoint format
      const url = `${API_BASE_URL}/api/orders/${orderId}/mark-paid`;
      console.log('📡 Making request to:', url);
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      console.log('📨 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server response error:', errorText);
        
        let errorMessage = 'Failed to update payment status';
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch (e) {
          errorMessage = errorText || errorMessage;
        }
        
        // ✅ FIXED: Check for specific route not found error
        if (errorMessage.includes('Route not found') || errorMessage.includes('404')) {
          errorMessage = 'Payment endpoint not available. Please contact support.';
        }
        
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      console.log('✅ Order marked as paid successfully:', responseData);
      
      Alert.alert('Success', 'Payment marked as paid successfully!');
      
      // Refresh contact orders
      if (selectedContact) {
        await fetchContactOrders(selectedContact, selectedContact.isWalkin);
      }
      // Refresh contacts list to update pending amounts
      await fetchContacts();
      
    } catch (error) {
      console.error('❌ Error marking order as paid:', error);
      
      // Show specific error messages based on error type
      let alertMessage = 'Failed to mark order as paid. Please try again.';
      
      if (error.message.includes('Network request failed')) {
        alertMessage = 'Network error. Please check your internet connection.';
      } else if (error.message.includes('401')) {
        alertMessage = 'Authentication failed. Please login again.';
      } else if (error.message.includes('403')) {
        alertMessage = 'Access denied. You do not have permission to mark this order as paid.';
      } else if (error.message.includes('404') || error.message.includes('Route not found')) {
        alertMessage = 'Payment endpoint not available. Please contact support.';
      } else if (error.message) {
        alertMessage = error.message;
      }
      
      Alert.alert('Error', alertMessage);
    }
  };

  const closeContactDetails = () => {
    setShowContactDetails(false);
    setSelectedContact(null);
    setContactOrders([]);
    setFilteredOrders([]);
    setOrdersPaymentFilter('all');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchContacts();
  };

  // Render Regular Customer Item
  const renderRegularCustomerItem = ({ item }) => (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={() => handleContactSelect(item, false)}
    >
      <View style={styles.customerHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>{item.name}</Text>
          <Text style={styles.customerPhone}>{item.phone}</Text>
          {item.allNames && item.allNames.size > 1 && (
            <Text style={styles.otherNamesText}>
              Also known as: {Array.from(item.allNames).filter(name => name !== item.name).join(', ')}
            </Text>
          )}
        </View>
        <View style={styles.orderCount}>
          <Text style={styles.orderCountText}>{item.totalOrders}</Text>
          <Text style={styles.orderCountLabel}>orders</Text>
        </View>
      </View>

      <View style={styles.customerStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Total Spent</Text>
          <Text style={styles.statValue}>₹{item.totalSpent.toFixed(2)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={[styles.statValue, item.pendingAmount > 0 ? styles.pendingAmount : styles.noPending]}>
            ₹{item.pendingAmount.toFixed(2)}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Last Order</Text>
          <Text style={styles.statValue}>
            {new Date(item.lastOrderDate).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short'
            })}
          </Text>
        </View>
      </View>

      <View style={styles.viewDetails}>
        <Text style={styles.viewDetailsText}>View all {item.totalOrders} orders</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.light.accent} />
      </View>
    </TouchableOpacity>
  );

  // Render Walk-in Customer Item
  const renderWalkinCustomerItem = ({ item }) => (
    <TouchableOpacity
      style={styles.customerCard}
      onPress={() => handleContactSelect(item, true)}
    >
      <View style={styles.customerHeader}>
        <View style={[styles.avatar, styles.walkinAvatar]}>
          <Ionicons name="person-outline" size={20} color={Colors.light.white} />
        </View>
        <View style={styles.customerInfo}>
          <View style={styles.walkinHeader}>
            <Text style={styles.customerName}>{item.name}</Text>
            <View style={styles.walkinBadge}>
              <Text style={styles.walkinBadgeText}>Walk-in</Text>
            </View>
          </View>
          <Text style={styles.orderIdText}>Order #{item.orderId}</Text>
        </View>
      </View>

      <View style={styles.customerStats}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Amount</Text>
          <Text style={styles.statValue}>₹{(item.pendingAmount + item.totalSpent).toFixed(2)}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Status</Text>
          <Text style={[
            styles.statusText,
            item.paymentStatus === 'paid' ? styles.paidStatus : styles.pendingStatus
          ]}>
            {item.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Date</Text>
          <Text style={styles.statValue}>
            {new Date(item.lastOrderDate).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short'
            })}
          </Text>
        </View>
      </View>

      <View style={styles.viewDetails}>
        <Text style={styles.viewDetailsText}>View order details</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.light.accent} />
      </View>
    </TouchableOpacity>
  );

  // Enhanced Order Item Render with TRADITIONAL TABULAR BILL FORMAT
  const renderOrderItem = ({ item }) => {
    const orderAmount = item.finalAmount || 0;
    const itemsCount = item.items?.reduce((sum, orderItem) => sum + (orderItem.quantity || 0), 0) || 0;
    
    return (
      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <View style={styles.orderBasicInfo}>
            <Text style={styles.orderId}>Order #{item.orderId}</Text>
            <Text style={styles.orderDate}>
              {new Date(item.createdAt).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
          <View style={[
            styles.statusBadge,
            item.paymentStatus === 'paid' ? styles.paidBadge : styles.pendingBadge
          ]}>
            <Text style={[
              styles.statusText,
              item.paymentStatus === 'paid' ? styles.paidText : styles.pendingText
            ]}>
              {item.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
            </Text>
          </View>
        </View>

        {/* TRADITIONAL TABULAR BILL FORMAT */}
        <View style={styles.billContainer}>
          {/* Bill Header */}
          <View style={styles.billHeader}>
            <Text style={styles.billTitle}>BILL</Text>
            <View style={styles.billCustomerInfo}>
              <Text style={styles.billCustomerName}>{item.customerName || 'Walk-in Customer'}</Text>
              {item.customerPhone && (
                <Text style={styles.billCustomerPhone}>{item.customerPhone}</Text>
              )}
            </View>
          </View>

          {/* Bill Table Header */}
          <View style={styles.billTableHeader}>
            <Text style={[styles.billTableHeaderText, styles.productCol]}>Product</Text>
            <Text style={[styles.billTableHeaderText, styles.qtyCol]}>Qty</Text>
            <Text style={[styles.billTableHeaderText, styles.priceCol]}>Price</Text>
            <Text style={[styles.billTableHeaderText, styles.discountCol]}>Disc.</Text>
            <Text style={[styles.billTableHeaderText, styles.totalCol]}>Total</Text>
          </View>

          {/* Bill Items */}
          <View style={styles.billItems}>
            {item.items?.map((orderItem, index) => {
              const productName = orderItem.product?.name || orderItem.productName || 'Product';
              const quantity = orderItem.quantity || 0;
              const originalPrice = orderItem.originalPrice || orderItem.product?.price || 0;
              const finalPrice = orderItem.finalPrice || orderItem.price || 0;
              const discountPerItem = originalPrice - finalPrice;
              const itemTotal = finalPrice * quantity;
              
              return (
                <View key={index} style={styles.billItemRow}>
                  <Text style={[styles.billItemText, styles.productCol]} numberOfLines={2}>
                    {productName}
                  </Text>
                  <Text style={[styles.billItemText, styles.qtyCol]}>
                    {quantity}
                  </Text>
                  <Text style={[styles.billItemText, styles.priceCol]}>
                    ₹{originalPrice.toFixed(2)}
                  </Text>
                  <Text style={[styles.billItemText, styles.discountCol]}>
                    {discountPerItem > 0 ? `-₹${discountPerItem.toFixed(2)}` : '-'}
                  </Text>
                  <Text style={[styles.billItemText, styles.totalCol]}>
                    ₹{itemTotal.toFixed(2)}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Bill Summary */}
          <View style={styles.billSummary}>
            <View style={styles.billSummaryRow}>
              <Text style={styles.billSummaryLabel}>Subtotal:</Text>
              <Text style={styles.billSummaryValue}>
                ₹{item.totalBeforeDiscount?.toFixed(2) || item.orderSubtotal?.toFixed(2) || '0.00'}
              </Text>
            </View>
            
            {item.discount > 0 && (
              <View style={styles.billSummaryRow}>
                <Text style={styles.billSummaryLabel}>Discount:</Text>
                <Text style={[styles.billSummaryValue, styles.discountValue]}>
                  -₹{item.discount.toFixed(2)}
                </Text>
              </View>
            )}
            
            <View style={[styles.billSummaryRow, styles.billTotalRow]}>
              <Text style={styles.billTotalLabel}>Total Amount:</Text>
              <Text style={styles.billTotalValue}>
                ₹{orderAmount.toFixed(2)}
              </Text>
            </View>

            {item.discount > 0 && (
              <View style={styles.savingsRow}>
                <Text style={styles.savingsText}>
                  You saved ₹{item.discount.toFixed(2)} ({item.savingsPercentage}%)
                </Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Payment Action */}
        {item.paymentStatus === 'pending' && (
          <TouchableOpacity
            style={styles.payButton}
            onPress={() => {
              Alert.alert(
                "Confirm Payment",
                `Mark order #${item.orderId} as paid?\nAmount: ₹${orderAmount.toFixed(2)}`,
                [
                  {
                    text: "Cancel",
                    style: "cancel"
                  },
                  {
                    text: "Mark as Paid",
                    onPress: () => markOrderAsPaid(item._id)
                  }
                ]
              );
            }}
          >
            <Ionicons name="checkmark-circle" size={16} color={Colors.light.white} />
            <Text style={styles.payButtonText}>Mark as Paid</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Consistent Header Component
  const Header = ({ title, subtitle, onBack }) => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.headerContent}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={onBack}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.light.text} />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
        </View>
        
        <View style={styles.headerSpacer} />
      </View>
    </View>
  );

  // Customer Type Tabs
  const CustomerTypeTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'regular' && styles.tabActive]}
        onPress={() => setActiveTab('regular')}
      >
        <Text style={[styles.tabText, activeTab === 'regular' && styles.tabTextActive]}>
          Customers ({filteredRegularCustomers.length})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'walkin' && styles.tabActive]}
        onPress={() => setActiveTab('walkin')}
      >
        <Text style={[styles.tabText, activeTab === 'walkin' && styles.tabTextActive]}>
          Walk-in ({filteredWalkinCustomers.length})
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Main Contact List View
  const renderContactListView = () => (
    <View style={styles.container}>
      {/* Consistent Header */}
      <Header 
        title="Customer Management" 
        onBack={() => router.back()}
      />

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={Colors.light.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, phone or order ID..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.light.textSecondary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={20} color={Colors.light.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Customer Type Tabs */}
      <CustomerTypeTabs />

      {/* Payment Status Filter */}
      <View style={styles.filterSection}>
        <View style={styles.filterButtons}>
          <TouchableOpacity
            style={[
              styles.filterButton,
              paymentFilter === 'all' && styles.filterButtonActive
            ]}
            onPress={() => setPaymentFilter('all')}
          >
            <Text style={[
              styles.filterButtonText,
              paymentFilter === 'all' && styles.filterButtonTextActive
            ]}>
              All
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              paymentFilter === 'pending' && styles.filterButtonActive
            ]}
            onPress={() => setPaymentFilter('pending')}
          >
            <Text style={[
              styles.filterButtonText,
              paymentFilter === 'pending' && styles.filterButtonTextActive
            ]}>
              Pending
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.filterButton,
              paymentFilter === 'paid' && styles.filterButtonActive
            ]}
            onPress={() => setPaymentFilter('paid')}
          >
            <Text style={[
              styles.filterButtonText,
              paymentFilter === 'paid' && styles.filterButtonTextActive
            ]}>
              Paid
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contacts List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.accent} />
          <Text style={styles.loadingText}>Loading customers...</Text>
        </View>
      ) : activeTab === 'regular' ? (
        filteredRegularCustomers.length > 0 ? (
          <FlatList
            data={filteredRegularCustomers}
            renderItem={renderRegularCustomerItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.light.accent]}
              />
            }
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={80} color={Colors.light.textSecondary} />
            <Text style={styles.emptyTitle}>No Customers Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || paymentFilter !== 'all' 
                ? 'Try changing your search or filter' 
                : 'Customers will appear here when they place orders with contact information'
              }
            </Text>
          </View>
        )
      ) : (
        filteredWalkinCustomers.length > 0 ? (
          <FlatList
            data={filteredWalkinCustomers}
            renderItem={renderWalkinCustomerItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[Colors.light.accent]}
              />
            }
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={80} color={Colors.light.textSecondary} />
            <Text style={styles.emptyTitle}>No Walk-in Orders</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery || paymentFilter !== 'all' 
                ? 'Try changing your search or filter' 
                : 'Walk-in orders will appear here when customers place orders without contact information'
              }
            </Text>
          </View>
        )
      )}
    </View>
  );

  // Contact Details Modal
  const renderContactDetailsModal = () => (
    <Modal
      visible={showContactDetails}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={closeContactDetails}
    >
      <View style={styles.container}>
        {/* Consistent Header */}
        <Header 
          title={selectedContact?.name}
          subtitle={selectedContact?.isWalkin ? `Order #${selectedContact?.orderId}` : selectedContact?.phone}
          onBack={closeContactDetails}
        />

        {!selectedContact?.isWalkin && (
          <View style={styles.statsSection}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>{contactStats.totalOrders}</Text>
                <Text style={styles.statLabel}>Total Orders</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNumber}>₹{contactStats.totalSpent.toFixed(2)}</Text>
                <Text style={styles.statLabel}>Total Spent</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statNumber, styles.pendingStat]}>
                  ₹{contactStats.pendingAmount.toFixed(2)}
                </Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
          </View>
        )}

        {/* Payment Status Filter */}
        {contactOrders.length > 1 && (
          <View style={styles.filterSection}>
            <View style={styles.filterButtons}>
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  ordersPaymentFilter === 'all' && styles.filterButtonActive
                ]}
                onPress={() => setOrdersPaymentFilter('all')}
              >
                <Text style={[
                  styles.filterButtonText,
                  ordersPaymentFilter === 'all' && styles.filterButtonTextActive
                ]}>
                  All ({contactOrders.length})
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  ordersPaymentFilter === 'pending' && styles.filterButtonActive
                ]}
                onPress={() => setOrdersPaymentFilter('pending')}
              >
                <Text style={[
                  styles.filterButtonText,
                  ordersPaymentFilter === 'pending' && styles.filterButtonTextActive
                ]}>
                  Pending ({contactStats.pendingOrders})
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.filterButton,
                  ordersPaymentFilter === 'paid' && styles.filterButtonActive
                ]}
                onPress={() => setOrdersPaymentFilter('paid')}
              >
                <Text style={[
                  styles.filterButtonText,
                  ordersPaymentFilter === 'paid' && styles.filterButtonTextActive
                ]}>
                  Paid ({contactOrders.length - contactStats.pendingOrders})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Orders List Header */}
        {filteredOrders.length > 0 && (
          <View style={styles.ordersHeader}>
            <Text style={styles.ordersHeaderText}>
              {selectedContact?.isWalkin ? 'Order Details' : 'Order History'}
            </Text>
            <Text style={styles.ordersCount}>{filteredOrders.length} orders</Text>
          </View>
        )}

        {/* Orders List */}
        {ordersLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.light.accent} />
            <Text style={styles.loadingText}>Loading orders...</Text>
          </View>
        ) : filteredOrders.length > 0 ? (
          <FlatList
            data={filteredOrders}
            renderItem={renderOrderItem}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.ordersListContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={ordersLoading}
                onRefresh={() => selectedContact && fetchContactOrders(selectedContact, selectedContact.isWalkin)}
                colors={[Colors.light.accent]}
              />
            }
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={80} color={Colors.light.textSecondary} />
            <Text style={styles.emptyTitle}>No Orders Found</Text>
            <Text style={styles.emptySubtitle}>
              {ordersPaymentFilter !== 'all' 
                ? `No ${ordersPaymentFilter} orders found` 
                : 'No orders found'
              }
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );

  return (
    <>
      {renderContactListView()}
      {renderContactDetailsModal()}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  // Consistent Header Styles
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#F8F9FA',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 36,
  },
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: Colors.light.white,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Colors.light.accent,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  tabTextActive: {
    color: Colors.light.white,
  },
  searchSection: {
    padding: 16,
    paddingTop: 12,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.light.text,
    padding: 0,
  },
  filterSection: {
    padding: 16,
    paddingTop: 12,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: Colors.light.accent,
    borderColor: Colors.light.accent,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.textSecondary,
  },
  filterButtonTextActive: {
    color: Colors.light.white,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  // Stats Section
  statsSection: {
    backgroundColor: Colors.light.white,
    padding: 20,
    margin: 16,
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  pendingStat: {
    color: '#FF9800',
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  // Customer Card Styles
  customerCard: {
    backgroundColor: Colors.light.white,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.light.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  walkinAvatar: {
    backgroundColor: '#6B7280',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.white,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  otherNamesText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    fontStyle: 'italic',
  },
  orderIdText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  walkinHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  walkinBadge: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  walkinBadgeText: {
    fontSize: 10,
    color: Colors.light.white,
    fontWeight: '600',
  },
  orderCount: {
    alignItems: 'center',
  },
  orderCountText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  orderCountLabel: {
    fontSize: 11,
    color: Colors.light.textSecondary,
  },
  customerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  pendingAmount: {
    color: '#FF9800',
  },
  noPending: {
    color: '#4CAF50',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  paidStatus: {
    color: '#4CAF50',
  },
  pendingStatus: {
    color: '#FF9800',
  },
  viewDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
  },
  viewDetailsText: {
    fontSize: 14,
    color: Colors.light.accent,
    fontWeight: '600',
    marginRight: 4,
  },
  // Order Card Styles with TRADITIONAL BILL FORMAT
  orderCard: {
    backgroundColor: Colors.light.white,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  orderBasicInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.text,
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  paidBadge: {
    backgroundColor: '#E8F5E9',
  },
  pendingBadge: {
    backgroundColor: '#FFF3E0',
  },
  paidText: {
    color: '#4CAF50',
  },
  pendingText: {
    color: '#FF9800',
  },
  // Traditional Bill Format Styles
  billContainer: {
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 8,
    backgroundColor: Colors.light.white,
    marginBottom: 16,
  },
  billHeader: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    backgroundColor: '#F8F9FA',
  },
  billTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.light.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  billCustomerInfo: {
    alignItems: 'center',
  },
  billCustomerName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 2,
  },
  billCustomerPhone: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  billTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F1F3F4',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  billTableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.light.text,
  },
  productCol: {
    flex: 3,
    textAlign: 'left',
  },
  qtyCol: {
    flex: 1,
    textAlign: 'center',
  },
  priceCol: {
    flex: 1.2,
    textAlign: 'right',
  },
  discountCol: {
    flex: 1.2,
    textAlign: 'right',
  },
  totalCol: {
    flex: 1.2,
    textAlign: 'right',
  },
  billItems: {
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  billItemRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
    alignItems: 'center',
  },
  billItemText: {
    fontSize: 11,
    color: Colors.light.text,
  },
  billSummary: {
    padding: 12,
  },
  billSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  billSummaryLabel: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: '500',
  },
  billSummaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.light.text,
  },
  discountValue: {
    color: '#4CAF50',
  },
  billTotalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    paddingTop: 8,
    marginTop: 4,
  },
  billTotalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.light.text,
  },
  billTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.light.accent,
  },
  savingsRow: {
    marginTop: 8,
    padding: 6,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
  },
  savingsText: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
    textAlign: 'center',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
    alignSelf: 'flex-start',
  },
  payButtonText: {
    color: Colors.light.white,
    fontSize: 12,
    fontWeight: '600',
  },
  ordersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: Colors.light.white,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  ordersHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
  },
  ordersCount: {
    fontSize: 14,
    color: Colors.light.textSecondary,
  },
  ordersListContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});