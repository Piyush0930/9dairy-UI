import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";

export default function WalletScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dairy Nine Wallet</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.balanceCard}>
          <View style={styles.walletIconContainer}>
            <Ionicons name="wallet-outline" size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceAmount}>₹300</Text>
          <View style={styles.balanceActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Text style={styles.actionButtonText}>Add Money</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]}>
              <Text style={styles.actionButtonTextSecondary}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.comingSoonCard}>
          <View style={styles.comingSoonIconContainer}>
            <MaterialIcons name="trending-up" size={48} color="#4FC3F7" />
          </View>
          <Text style={styles.comingSoonTitle}>Coming Soon</Text>
          <Text style={styles.comingSoonMessage}>
            Complete wallet functionality with transactions, offers, and rewards will be available soon.
          </Text>
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Upcoming Features</Text>
          
          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <MaterialIcons name="history" size={24} color={Colors.light.tint} />
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Transaction History</Text>
              <Text style={styles.featureDescription}>
                Track all your wallet transactions
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#BDBDBD" />
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <Text style={styles.featureEmoji}>🎁</Text>
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Cashback & Offers</Text>
              <Text style={styles.featureDescription}>
                Earn rewards on every purchase
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#BDBDBD" />
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <Text style={styles.featureEmoji}>🔒</Text>
            </View>
            <View style={styles.featureContent}>
              <Text style={styles.featureTitle}>Secure Payments</Text>
              <Text style={styles.featureDescription}>
                Bank-grade security for your money
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#BDBDBD" />
          </View>
        </View>

        <View style={styles.bottomPadding} />
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
    backgroundColor: Colors.light.white,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.text,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  balanceCard: {
    backgroundColor: Colors.light.tint,
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  walletIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 8,
    fontWeight: "500",
  },
  balanceAmount: {
    fontSize: 48,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 24,
  },
  balanceActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  actionButtonSecondary: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  actionButtonText: {
    color: Colors.light.tint,
    fontSize: 15,
    fontWeight: "700",
  },
  actionButtonTextSecondary: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  comingSoonCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 2,
    borderColor: "#E3F2FD",
    borderStyle: "dashed",
  },
  comingSoonIconContainer: {
    marginBottom: 16,
  },
  comingSoonTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 12,
  },
  comingSoonMessage: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  featuresContainer: {
    marginBottom: 24,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 16,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.light.border,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.light.backgroundLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.light.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: Colors.light.textSecondary,
  },
  bottomPadding: {
    height: 60,
  },
});