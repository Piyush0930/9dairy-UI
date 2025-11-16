// C:\Users\Krishna\OneDrive\Desktop\frontend-dairy9\9dairy-UI\components\LocationPicker.jsx

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from "react-native";
import { LocationService } from "@/services/locationService";

const { width } = Dimensions.get("window");

export default function LocationPicker({
  onLocationSelect,
  placeholder = "Enter your address",
  showCurrentLocation = true,
  style,
}) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [currentCoords, setCurrentCoords] = useState(null);
  const debounceRef = useRef(null);

  /* ---------------------------------------------------------
      ✔ GET CURRENT COORDS FOR BIAS
  ----------------------------------------------------------*/
  useEffect(() => {
    (async () => {
      try {
        const gps = await LocationService.getCurrentLocation();
        setCurrentCoords({
          latitude: gps.latitude,
          longitude: gps.longitude,
        });
      } catch (e) {
        console.log("⚠ Initial GPS not available:", e);
      }
    })();
  }, []);

  /* ---------------------------------------------------------
      ✔ DEBOUNCE SEARCH INPUT
  ----------------------------------------------------------*/
  const handleInputChange = (text) => {
    setInput(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      searchPlaces(text);
    }, 400);
  };

  /* ---------------------------------------------------------
      ✔ CALL GOOGLE PLACES AUTOCOMPLETE
  ----------------------------------------------------------*/
  const searchPlaces = async (text) => {
    if (!text || text.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);

    try {
      const res = await LocationService.getPlaceSuggestions(
        text,
        currentCoords
      );
      setSuggestions(res || []);
      setShowSuggestions(true);
    } catch (err) {
      console.log("Search error:", err);
    } finally {
      setLoading(false);
    }
  };

  /* ---------------------------------------------------------
      ✔ USER SELECTS A SUGGESTION
  ----------------------------------------------------------*/
  const handleSuggestionSelect = async (item) => {
    setInput(item.description);
    setShowSuggestions(false);
    setLoading(true);

    try {
      const place = await LocationService.getPlaceDetails(item.placeId);

      if (!place.coordinates?.latitude) throw new Error("No coordinates");

      const finalData = {
        coordinates: place.coordinates,
        formattedAddress: place.formattedAddress || item.description,
        placeId: item.placeId,
      };

      console.log("📍 Selected:", finalData);
      onLocationSelect(finalData);
    } catch (err) {
      console.log("Details error:", err);

      // fallback → Current GPS
      try {
        const gps = await LocationService.getCurrentLocation();
        const fallback = {
          formattedAddress: item.description,
          coordinates: gps,
          isFallback: true,
        };
        onLocationSelect(fallback);
      } catch (e) {
        // Last fallback → Mumbai default
        const last = {
          formattedAddress: item.description,
          coordinates: { latitude: 19.076, longitude: 72.8777 },
          isDefault: true,
        };
        onLocationSelect(last);
      }
    }

    setLoading(false);
  };

  /* ---------------------------------------------------------
      ✔ USE CURRENT GPS LOCATION
  ----------------------------------------------------------*/
  const handleGetCurrentLocation = async () => {
    setGettingLocation(true);

    try {
      const loc = await LocationService.getLocationWithFallback();

      setInput(loc.formattedAddress);
      onLocationSelect(loc);
      setShowSuggestions(false);
    } catch (err) {
      console.log("Current location error:", err);

      const fallback = {
        formattedAddress: "Your current location",
        coordinates: { latitude: 19.076, longitude: 72.8777 },
        isDefault: true,
      };

      setInput("Your current location");
      onLocationSelect(fallback);
    }

    setGettingLocation(false);
  };

  /* ---------------------------------------------------------
      ✔ CLEAR INPUT
  ----------------------------------------------------------*/
  const clearInput = () => {
    setInput("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  /* ---------------------------------------------------------
      ✔ UI
  ----------------------------------------------------------*/
  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <TextInput
          placeholder={placeholder}
          value={input}
          onChangeText={handleInputChange}
          style={styles.input}
          placeholderTextColor="#94a3b8"
        />

        {input.length > 0 && (
          <TouchableOpacity onPress={clearInput}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}

        {loading && <ActivityIndicator size="small" color="#2563eb" />}
      </View>

      {/* CURRENT LOCATION */}
      {showCurrentLocation && (
        <TouchableOpacity
          style={[
            styles.currentBtn,
            gettingLocation && { opacity: 0.6 },
          ]}
          onPress={handleGetCurrentLocation}
          disabled={gettingLocation}
        >
          {gettingLocation ? (
            <>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.currentBtnText}>Getting location...</Text>
            </>
          ) : (
            <>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.currentBtnText}>Use Current Location</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* AUTOCOMPLETE DROPDOWN */}
      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          <ScrollView
            style={styles.dropdownScroll}
            keyboardShouldPersistTaps="always"
          >
            {suggestions.map((s) => (
              <TouchableOpacity
                key={s.placeId}
                onPress={() => handleSuggestionSelect(s)}
                style={styles.suggestionItem}
              >
                <Text style={styles.suggestionMain}>{s.mainText}</Text>
                {s.secondaryText && (
                  <Text style={styles.suggestionSecondary}>
                    {s.secondaryText}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

/* ---------------------------------------------------------
      ✔ STYLES
----------------------------------------------------------*/

const styles = StyleSheet.create({
  container: { width: "100%", zIndex: 1000 },
  inputContainer: {
    flexDirection: "row",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: "center",
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1e293b",
    fontWeight: "600",
  },
  clearText: {
    color: "#64748b",
    fontSize: 18,
    marginRight: 8,
  },
  dropdown: {
    marginTop: 6,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    maxHeight: 220,
    width: "100%",
    position: "absolute",
    top: 60,
    zIndex: 9999,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  dropdownScroll: { maxHeight: 220 },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  suggestionMain: {
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "600",
  },
  suggestionSecondary: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  currentBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  currentBtnText: {
    color: "#2563eb",
    fontWeight: "600",
    fontSize: 14,
  },
  locationIcon: { fontSize: 16 },
});
