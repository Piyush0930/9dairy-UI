// C:\Users\Krishna\OneDrive\Desktop\frontend-dairy9\9dairy-UI\services\locationService.js

import * as Location from 'expo-location';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export class LocationService {
  // Get current location using device GPS
  static async getCurrentLocation() {
    try {
      console.log('📍 Requesting location permission...');
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      console.log('📍 Getting current position...');
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000,
      });

      console.log('📍 Location obtained successfully');
      
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy
      };
    } catch (error) {
      console.error('❌ Error getting current location:', error);
      throw error;
    }
  }

  // Get place suggestions from Google Places Autocomplete API
  static async getPlaceSuggestions(input, location = null) {
    if (!input || input.trim().length < 2) {
      return [];
    }

    const searchText = input.trim();
    console.log('🔍 Fetching suggestions for:', searchText);

    try {
      let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(searchText)}&key=${GOOGLE_MAPS_API_KEY}&components=country:in`;
      
      // Add location bias if available
      if (location) {
        url += `&location=${location.latitude},${location.longitude}&radius=50000`;
      }

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.status === 'OK' && data.predictions) {
        const suggestions = data.predictions.map(prediction => ({
          placeId: prediction.place_id,
          description: prediction.description,
          mainText: prediction.structured_formatting?.main_text || prediction.description,
          secondaryText: prediction.structured_formatting?.secondary_text || ''
        }));
        
        console.log('✅ Google Places suggestions:', suggestions.length);
        return suggestions;
      } else if (data.status === 'ZERO_RESULTS') {
        console.log('🔍 No results found for:', searchText);
        return [];
      } else {
        throw new Error(data.error_message || `API error: ${data.status}`);
      }
    } catch (error) {
      console.error('❌ Google Places API error:', error);
      throw new Error('Failed to search locations. Please check your connection.');
    }
  }

  // Get place details from Google Places API
  static async getPlaceDetails(placeId) {
    if (!placeId) {
      throw new Error('Place ID is required');
    }

    console.log('📋 Fetching details for place:', placeId);

    try {
      const fields = 'formatted_address,geometry,name,address_components';
      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.status === 'OK' && data.result) {
        const result = data.result;
        const locationData = {
          placeId: placeId,
          name: result.name,
          formattedAddress: result.formatted_address,
          latitude: result.geometry?.location?.lat,
          longitude: result.geometry?.location?.lng,
          addressComponents: result.address_components || []
        };
        
        console.log('✅ Place details obtained');
        return locationData;
      } else {
        throw new Error(data.error_message || `API error: ${data.status}`);
      }
    } catch (error) {
      console.error('❌ Google Places Details API error:', error);
      throw new Error('Failed to get location details.');
    }
  }

  // Get location with address using device's reverse geocoding
  static async getLocationWithFallback() {
    try {
      console.log('📍 Getting current location...');
      
      const currentLocation = await this.getCurrentLocation();
      
      // Get address using device's reverse geocoding
      try {
        const address = await this.getAddressFromCoordinates(
          currentLocation.latitude, 
          currentLocation.longitude
        );
        
        return {
          coordinates: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude
          },
          formattedAddress: address,
          accuracy: currentLocation.accuracy
        };
      } catch (addressError) {
        console.warn('⚠️ Address lookup failed:', addressError);
        // Fallback to coordinates display
        return {
          coordinates: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude
          },
          formattedAddress: `Near ${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`,
          accuracy: currentLocation.accuracy
        };
      }
    } catch (error) {
      console.error('❌ Error getting location:', error);
      throw error;
    }
  }

  // Use device's reverse geocoding
  static async getAddressFromCoordinates(latitude, longitude) {
    try {
      const addresses = await Location.reverseGeocodeAsync({
        latitude,
        longitude
      });

      if (addresses && addresses.length > 0) {
        const address = addresses[0];
        const parts = [];
        
        if (address.name) parts.push(address.name);
        if (address.street) parts.push(address.street);
        if (address.city) parts.push(address.city);
        if (address.region) parts.push(address.region);
        if (address.country) parts.push(address.country);
        
        const formattedAddress = parts.join(', ');
        console.log('📍 Reverse geocode result:', formattedAddress);
        return formattedAddress || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      }
      
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    } catch (error) {
      console.error('❌ Device reverse geocode failed:', error);
      return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    }
  }

  // Geocode address using Google Geocoding API
  static async geocodeAddress(address) {
    if (!address || address.trim().length < 3) {
      throw new Error('Please enter a valid address');
    }

    const searchText = address.trim();
    console.log('🗺️ Geocoding address:', searchText);

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchText)}&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        const locationData = {
          placeId: result.place_id,
          name: result.formatted_address,
          formattedAddress: result.formatted_address,
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          addressComponents: result.address_components || []
        };
        
        console.log('✅ Address geocoded successfully');
        return locationData;
      } else {
        throw new Error(data.error_message || 'Address not found');
      }
    } catch (error) {
      console.error('❌ Geocoding API error:', error);
      throw new Error('Failed to find this address.');
    }
  }

  // Reverse geocode using Google Geocoding API
  static async reverseGeocode(latitude, longitude) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const result = data.results[0];
        return {
          formattedAddress: result.formatted_address,
          addressComponents: result.address_components || []
        };
      } else {
        throw new Error(data.error_message || 'Address not found');
      }
    } catch (error) {
      console.error('❌ Reverse geocoding API error:', error);
      throw new Error('Failed to get address for this location.');
    }
  }
}