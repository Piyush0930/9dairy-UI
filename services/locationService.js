// C:\Users\Krishna\OneDrive\Desktop\frontend-dairy9\9dairy-UI\services\locationService.js
import * as Location from "expo-location";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") || "";

export class LocationService {
  // 1) Place Autocomplete
  static async getPlaceSuggestions(query, coords = null) {
    try {
      if (!query || query.trim().length < 2) return [];

      let url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
        `input=${encodeURIComponent(query)}` +
        `&key=${GOOGLE_MAPS_API_KEY}` +
        `&components=country:in`;

      if (coords?.latitude && coords?.longitude) {
        url += `&location=${coords.latitude},${coords.longitude}&radius=50000`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== "OK") {
        console.log("❌ Suggestion Status:", data.status);
        return [];
      }

      return data.predictions.map((p) => ({
        description: p.description,
        mainText: p.structured_formatting.main_text,
        secondaryText: p.structured_formatting.secondary_text || "",
        placeId: p.place_id,
      }));
    } catch (err) {
      console.log("❌ getPlaceSuggestions Error:", err);
      return [];
    }
  }

  // 2) Place Details
  static async getPlaceDetails(placeId) {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/details/json?` +
        `place_id=${placeId}` +
        `&fields=formatted_address,geometry,address_components,name` +
        `&key=${GOOGLE_MAPS_API_KEY}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.status !== "OK") {
        console.log("❌ Place Details Error:", data.status);
        return null;
      }

      const coords = data.result.geometry.location;

      return {
        placeId,
        formattedAddress: data.result.formatted_address,
        coordinates: {
          latitude: Number(coords.lat),
          longitude: Number(coords.lng),
        },
        addressComponents: data.result.address_components || [],
      };
    } catch (err) {
      console.log("❌ getPlaceDetails Error:", err);
      return null;
    }
  }

  // 3) Sync current location to backend (returns backend JSON)
  static async syncLocationToBackend(token, gps) {
    try {
      if (!token) {
        console.log("❌ syncLocationToBackend: No token provided");
        return { success: false, message: "No token provided" };
      }

      const res = await fetch(`${API_BASE_URL}/api/customer/location/current`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: gps.coordinates?.latitude ?? gps.latitude ?? null,
          longitude: gps.coordinates?.longitude ?? gps.longitude ?? null,
          formattedAddress: gps.formattedAddress ?? gps.address ?? "",
        }),
      });

      const data = await res.json();
      console.log("📍 Backend Sync Result:", data);
      return data;
    } catch (err) {
      console.log("❌ Sync Error:", err);
      return { success: false, message: err.message || "Sync error" };
    }
  }

  // 4) get GPS
  static async getCurrentLocation() {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Location permission denied");
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Highest,
    });

    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
    };
  }

  // 5) GPS + address fallback (reverse geocode)
  static async getLocationWithFallback() {
    const gps = await this.getCurrentLocation();

    try {
      const addr = await this.reverseGeocode(gps.latitude, gps.longitude);
      return {
        coordinates: { latitude: gps.latitude, longitude: gps.longitude },
        formattedAddress: addr,
        accuracy: gps.accuracy,
      };
    } catch {
      return {
        coordinates: { latitude: gps.latitude, longitude: gps.longitude },
        formattedAddress: `Near ${gps.latitude}, ${gps.longitude}`,
        accuracy: gps.accuracy,
      };
    }
  }

  // 6) reverse geocode (using expo-location)
  static async reverseGeocode(lat, lon) {
    try {
      const res = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lon,
      });

      const a = res[0] || {};
      return `${a.name || ""}${a.street ? ", " + a.street : ""}${a.city ? ", " + a.city : ""}${a.region ? ", " + a.region : ""}${a.country ? ", " + a.country : ""}`.replace(/^, /, "");
    } catch (err) {
      console.log("❌ reverseGeocode Error:", err);
      return "Unknown Location";
    }
  }
}
