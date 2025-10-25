import Colors from "@/constants/colors";
import { FontAwesome, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();

  const menuItems = [
    {
      id: 1,
      title: "Categories Management",
      subtitle: "Create and manage product categories",
      icon: "category",
      route: "/(admin)/categories",
      color: "#4CAF50",
    },
    {
      id: 2,
      title: "Products Management",
      subtitle: "Add and manage products",
      icon: "inventory",
      route: "/(admin)/products",
      color: "#2196F3",
    },
    {
      id: 3,
      title: "Orders Management",
      subtitle: "Manage customer orders",
      icon: "list-alt",
      route: "/(admin)/orders",
      color: "#FF9800",
    },
    {
      id: 4,
      title: "Invoice Summary",
      subtitle: "View and manage invoices",
      icon: "receipt",
      route: "/(admin)/invoice-summary",
      color: "#9C27B0",
    },
    {
      id: 5,
      title: "Analytics",
      subtitle: "View sales analytics",
      icon: "bar-chart",
      route: null,
      color: "#607D8B",
    },
    {
      id: 6,
      title: "Settings",
      subtitle: "Admin settings",
      icon: "settings",
      route: null,
      color: "#E91E63",
    },
  ];

  const handleMenuPress = (route) => {
    if (route) {
      router.push(route);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <Text style={styles.headerSubtitle}>Manage your dairy business</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <MaterialIcons name="attach-money" size={32} color="#4CAF50" />
            <Text style={styles.statValue}>₹45,230</Text>
            <Text style={styles.statLabel}>Today's Revenue</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="cart" size={32} color="#2196F3" />
            <Text style={styles.statValue}>127</Text>
            <Text style={styles.statLabel}>Orders Today</Text>
          </View>
          <View style={styles.statCard}>
            <FontAwesome name="users" size={28} color="#FF9800" />
            <Text style={styles.statValue}>1,234</Text>
            <Text style={styles.statLabel}>Total Customers</Text>
          </View>
        </View>

        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>Quick Actions</Text>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuItem}
              onPress={() => handleMenuPress(item.route)}
              disabled={!item.route}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + "20" }]}>
                <MaterialIcons name={item.icon} size={24} color={item.color} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuItemTitle}>{item.title}</Text>
                <Text style={styles.menuItemSubtitle}>{item.subtitle}</Text>
              </View>
              {item.route && (
                <Ionicons name="chevron-forward" size={20} color="#9E9E9E" />
              )}
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
  header: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.text,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.light.textSecondary,
    marginTop: 4,
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
    marginBottom: 24,
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
  menuContainer: {
    marginTop: 8,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  menuContent: {
    flex: 1,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.light.text,
  },
  menuItemSubtitle: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
});
