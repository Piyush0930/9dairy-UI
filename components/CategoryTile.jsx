import Colors from "@/constants/colors";
import { StyleSheet, Text, TouchableOpacity, View, Image } from "react-native";

const getImageSource = (imageName) => {
  const imageMap = {
    "MilkCategory.png": require("../assets/images/MilkCategory.png"),
    "ButterCategoryCategory.png": require("../assets/images/ButterCategoryCategory.png"),
    "CheeseCategory.jpg": require("../assets/images/CheeseCategory.jpg"),
    "Paneer.png": require("../assets/images/Paneer.png"),
    "DahiCategory.png": require("../assets/images/DahiCategory.png"),
    "IcecreamCategory.jpg": require("../assets/images/IcecreamCategory.jpg"),
    "GheeCategory.png": require("../assets/images/GheeCategory.png"),
    "CreamCategory.png": require("../assets/images/CreamCategory.png"),
    "buttermilk.png": require("../assets/images/butter.png"),
    "LassiCategory.png": require("../assets/images/LassiCategory.png"),
    "flavored-milk.png": require("../assets/images/milk.png"),
    "Dairy-SweetCategory.png": require("../assets/images/Dairy-SweetCategory.png"),
  };
  return imageMap[imageName] || require("../assets/images/MilkCategory.png"); // fallback
};

export default function CategoryTile({
  name,
  image,
  color,
  onPress,
}) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.card, { backgroundColor: color }]}>
        <Image
          source={getImageSource(image)}
          style={styles.image}
          resizeMode="cover"
        />
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
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
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
