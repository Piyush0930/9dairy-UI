import Colors from "@/constants/colors";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function CategoryTile({
  name,
  icon,
  color,
  onPress,
}) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.card, { backgroundColor: color }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>
        {name}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "30%",
    marginBottom: 16,
    alignItems: "center",
  },
  card: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  icon: {
    fontSize: 40,
  },
  name: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.light.text,
    textAlign: "center",
    lineHeight: 16,
    paddingHorizontal: 2,
  },
});