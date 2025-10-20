import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons, FontAwesome, Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";

export default function InvoiceSummary() {
  const insets = useSafeAreaInsets();

  const invoiceStats = {
    totalInvoices: 245,
    totalRevenue: 125430,
    pendingPayments: 15420,
    paidInvoices: 231,
  };

  const recentInvoices = [
    {
      id: "INV-2024-001",
      customer: "Rajesh Kumar",
      amount: 1250,
      status: "paid",
      date: "2024-01-15",
    },
    {
      id: "INV-2024-002",
      customer: "Priya Sharma",
      amount: 890,
      status: "pending",
      date: "2024-01-14",
    },
    {
      id: "INV-2024-003",
      customer: "Amit Singh",
      amount: 2100,
      status: "paid",
      date: "2024-01-13",
    },
    {
      id: "INV-2024-004",
      customer: "Sunita Patel",
      amount: 675,
      status: "overdue",
      date: "2024-01-12",
    },
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case "paid":
        return "#4CAF50";
      case "pending":
        return "#FF9800";
      case "overdue":
        return "#F44336";
      default:
        return "#9E9E9E";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "paid":
        return <FontAwesome name="check-circle" size={16} color="#4CAF50" />;
      case "pending":
        return <Ionicons name="time-outline" size={16} color="#FF9800" />;
      case "overdue":
        return <MaterialIcons name="error" size={16} color="#F44336" />;
      default:
        return <Ionicons name="help-circle" size={16} color="#9E9E9E" />;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <MaterialIcons name="receipt" size={32} color="#2196F3" />
            <Text style={styles.statValue}>{invoiceStats.totalInvoices}</Text>
            <Text style={styles.statLabel}>Total Invoices</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="attach-money" size={32} color="#4CAF50" />
            <Text style={styles.statValue}>₹{invoiceStats.totalRevenue.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Total Revenue</Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Ionicons name="time-outline" size={32} color="#FF9800" />
            <Text style={styles.statValue}>₹{invoiceStats.pendingPayments.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Pending Payments</Text>
          </View>
          <View style={styles.statCard}>
            <FontAwesome name="check-circle" size={28} color="#4CAF50" />
            <Text style={styles.statValue}>{invoiceStats.paidInvoices}</Text>
            <Text style={styles.statLabel}>Paid Invoices</Text>
          </View>
        </View>

        <View style={styles.recentInvoicesContainer}>
          <Text style={styles.sectionTitle}>Recent Invoices</Text>
          {recentInvoices.map((invoice) => (
            <TouchableOpacity key={invoice.id} style={styles.invoiceCard}>
              <View style={styles.invoiceHeader}>
                <View style={styles.invoiceIdSection}>
                  <MaterialIcons name="receipt" size={18} color={Colors.light.text} />
                  <Text style={styles.invoiceId}>{invoice.id}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) + "20" }]}>
                  {getStatusIcon(invoice.status)}
                  <Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>
                    {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                  </Text>
                </View>
              </View>

              <View style={styles.invoiceDetails}>
                <Text style={styles.customerName}>{invoice.customer}</Text>
                <Text style={styles.invoiceDate}>
                  {new Date(invoice.date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
              </View>

              <View style={styles.invoiceFooter}>
                <Text style={styles.invoiceAmount}>₹{invoice.amount}</Text>
              </View>
            </TouchableOpacity>
          ))}
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
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  statValue: {
    fontSize: 18,
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
  recentInvoicesContainer: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 16,
  },
  invoiceCard: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  invoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  invoiceIdSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  invoiceId: {
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
  invoiceDetails: {
    marginBottom: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  invoiceDate: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  invoiceFooter: {
    alignItems: "flex-end",
  },
  invoiceAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
  },
});
