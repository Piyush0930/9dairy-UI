// Location service for frontend

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

export class LocationService {
  // Get current location using device GPS
  static async getCurrentLocation() {
    try {
      const { requestForegroundPermissionsAsync, getCurrentPositionAsync, Accuracy } = await import('expo-location');
      
      // Request permission
      const { status } = await requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      // Get current position
      const location = await getCurrentPositionAsync({
        accuracy: Accuracy.High,
        timeout: 15000,
        maximumAge: 10000
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      throw error;
    }
  }

  // Get place suggestions from Google Maps API
  static async getPlaceSuggestions(input, location = null) {
    try {
      let url = `${API_BASE_URL}/api/location/suggestions?input=${encodeURIComponent(input)}`;
      
      if (location) {
        url += `&location=${location.latitude},${location.longitude}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to get place suggestions');
      }
    } catch (error) {
      console.error('Error getting place suggestions:', error);
      throw error;
    }
  }

  // Get place details by place ID
  static async getPlaceDetails(placeId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/location/place-details?placeId=${placeId}`);
      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to get place details');
      }
    } catch (error) {
      console.error('Error getting place details:', error);
      throw error;
    }
  }

  // Geocode address to coordinates
  static async geocodeAddress(address) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/location/geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });

      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to geocode address');
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
      throw error;
    }
  }

  // Reverse geocode coordinates to address
  static async reverseGeocode(latitude, longitude) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/location/reverse-geocode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ latitude, longitude }),
      });

      const data = await response.json();

      if (data.success) {
        return data.data;
      } else {
        throw new Error(data.message || 'Failed to reverse geocode');
      }
    } catch (error) {
      console.error('Error reverse geocoding:', error);
      throw error;
    }
  }

  // Get location with fallback options
  static async getLocationWithFallback() {
    try {
      // Try to get current location first
      const currentLocation = await this.getCurrentLocation();
      const reverseGeocodeResult = await this.reverseGeocode(
        currentLocation.latitude,
        currentLocation.longitude
      );

      return {
        coordinates: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude
        },
        formattedAddress: reverseGeocodeResult.formattedAddress,
        accuracy: currentLocation.accuracy
      };
    } catch (error) {
      console.error('Error getting location with fallback:', error);
      throw error;
    }
  }
}
