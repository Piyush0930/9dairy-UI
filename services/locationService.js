import * as Location from "expo-location";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export class LocationService {

  // ======================================================
  // ✅ 1) GOOGLE PLACE AUTOCOMPLETE SUGGESTIONS
  // ======================================================
  static async getPlaceSuggestions(query, coords = null) {
    try {
      if (!query || query.trim().length < 2) return [];

      let url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?` +
        `input=${encodeURIComponent(query)}` +
        `&key=${GOOGLE_MAPS_API_KEY}` +
        `&components=country:in`;

      // Add location bias if available
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

  // ======================================================
  // ✅ 2) GET PLACE DETAILS (COORDINATES REQUIRED)
  // ======================================================
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

  // ======================================================
  // ✅ 3) SYNC CURRENT LOCATION TO BACKEND
  // ======================================================
  static async syncLocationToBackend(token, gps) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/customer/location/current`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: gps.coordinates.latitude,
          longitude: gps.coordinates.longitude,
          formattedAddress: gps.formattedAddress,
        }),
      });

      const data = await res.json();
      console.log("📍 Backend Sync Result:", data);
      return data;
    } catch (err) {
      console.log("❌ Sync Error:", err);
      return null;
    }
  }

  // ======================================================
  // ✅ 4) GPS ONLY (ACCURATE LAT/LNG)
  // ======================================================
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

  // ======================================================
  // ✅ 5) GPS + ADDRESS WITH FALLBACK
  // ======================================================
  static async getLocationWithFallback() {
    const gps = await this.getCurrentLocation();

    try {
      const addr = await this.reverseGeocode(gps.latitude, gps.longitude);

      return {
        coordinates: {
          latitude: gps.latitude,
          longitude: gps.longitude,
        },
        formattedAddress: addr,
        accuracy: gps.accuracy,
      };
    } catch {
      return {
        coordinates: {
          latitude: gps.latitude,
          longitude: gps.longitude,
        },
        formattedAddress: `Near ${gps.latitude}, ${gps.longitude}`,
      };
    }
  }

  // ======================================================
  // ✅ 6) REVERSE GEOCODE (LAT → ADDRESS)
  // ======================================================
  static async reverseGeocode(lat, lon) {
    try {
      const res = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lon,
      });

      const a = res[0];

      return `${a.name || ""}, ${a.street || ""}, ${a.city || ""}, ${
        a.region || ""
      }, ${a.country || ""}`;
    } catch (err) {
      console.log("❌ reverseGeocode Error:", err);
      return "Unknown Location";
    }
  }
}
