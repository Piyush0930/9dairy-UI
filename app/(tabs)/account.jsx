import Colors from "@/constants/colors";
import { Feather, Ionicons, MaterialIcons } from "@expo/vector-icons";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function MenuItem({ icon, title, onPress, badge, showDivider = true, comingSoon = false }) {
  return (
    <>
      <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.6}>
        <View style={styles.menuItemLeft}>
          <View>{icon}</View>
          <Text style={styles.menuItemText}>{title}</Text>
        </View>
        <View style={styles.menuItemRight}>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
          {comingSoon && (
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Soon</Text>
            </View>
          )}
          <Feather name="chevron-right" size={20} color="#BDBDBD" />
        </View>
      </TouchableOpacity>
      {showDivider && <View style={styles.menuDivider} />}
    </>
  );
}

export default function Account() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Image
            source={{ uri: "https://img.icons8.com/color/96/user.png" }}
            style={styles.avatar}
          />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Guest Outlet</Text>
          <Text style={styles.headerSubtitle}>Guest Account</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.menuSection}>
          <MenuItem
            icon={<Ionicons name="person-outline" size={24} color={Colors.light.tint} />}
            title="Edit Profile"
            onPress={() => {
              console.log('Edit Profile clicked');
            }}
            comingSoon
          />
          <MenuItem
            icon={<Ionicons name="location-outline" size={24} color={Colors.light.tint} />}
            title="My Addresses"
            onPress={() => console.log('My Addresses clicked')}
            comingSoon
          />
          <MenuItem
            icon={<Ionicons name="notifications-outline" size={24} color={Colors.light.tint} />}
            title="Notifications"
            onPress={() => console.log('Notifications clicked')}
            comingSoon
          />
          <MenuItem
            icon={<Ionicons name="help-circle-outline" size={24} color={Colors.light.tint} />}
            title="Help & Support"
            onPress={() => console.log('Help & Support clicked')}
            comingSoon
          />
          <MenuItem
            icon={<MaterialIcons name="logout" size={24} color={Colors.light.tint} />}
            title="Logout"
            onPress={() => console.log('Logout clicked')}
            showDivider={false}
            comingSoon
          />
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>Version 1.0.0</Text>
          <Text style={styles.madeWithText}>Made with ❤️ by Dairy Nine</Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundLight,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: Colors.light.white,
    gap: 16,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#E3F2FD",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatar: {
    width: 48,
    height: 48,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.light.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: Colors.light.textSecondary,
    fontWeight: "400",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
    marginTop: 8,
  },
  sectionDividerLeft: {
    height: 1,
    backgroundColor: "#E0E0E0",
    width: 20,
  },
  sectionDividerRight: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#BDBDBD",
    letterSpacing: 0.5,
    marginHorizontal: 12,
  },
  menuSection: {
    backgroundColor: Colors.light.white,
    marginHorizontal: 16,
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  menuItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: "500",
    color: Colors.light.text,
  },
  badge: {
    backgroundColor: "#06B6D4",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  comingSoonBadge: {
    backgroundColor: "#FFF4E6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  comingSoonText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "700",
  },
  versionContainer: {
    marginTop: 32,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  versionText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  madeWithText: {
    fontSize: 13,
    color: Colors.light.textSecondary,
    fontWeight: "500",
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#F5F5F5",
    marginLeft: 60,
  },
  bottomPadding: {
    height: 20,
  },
});