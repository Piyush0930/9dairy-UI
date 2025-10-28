// C:\Users\Krishna\OneDrive\Desktop\frontend-dairy9\9dairy-UI\components\LocationPicker.jsx

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView
} from 'react-native';
import { LocationService } from '../services/locationService';

const { width } = Dimensions.get('window');

export default function LocationPicker({ 
  onLocationSelect, 
  placeholder = "Enter your address",
  showCurrentLocation = true,
  style 
}) {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [currentCoords, setCurrentCoords] = useState(null);
  const debounceRef = useRef(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Get current location on component mount for location bias
  useEffect(() => {
    const getInitialLocation = async () => {
      try {
        const location = await LocationService.getCurrentLocation();
        setCurrentCoords({
          latitude: location.latitude,
          longitude: location.longitude
        });
      } catch (error) {
        console.log('⚠ Could not get initial location for bias:', error.message);
      }
    };

    getInitialLocation();
  }, []);

  // Dynamic search with debouncing
  const searchPlaces = async (searchText) => {
    if (!searchText || searchText.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      const results = await LocationService.getPlaceSuggestions(searchText, currentCoords);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', error.message);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle input change with debouncing
  const handleInputChange = (text) => {
    setInput(text);
    
    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce search to avoid too many API calls
    debounceRef.current = setTimeout(() => {
      searchPlaces(text);
    }, 400);
  };

  // Handle suggestion selection
  // Handle suggestion selection - ISKO UPDATE KARO
const handleSuggestionSelect = async (suggestion) => {
  setInput(suggestion.description);
  setShowSuggestions(false);
  setLoading(true);

  try {
    const details = await LocationService.getPlaceDetails(suggestion.placeId);
    
    // ✅ PAKKA COORDINATES KE LIYE CHECK KARO
    if (!details.latitude || !details.longitude) {
      throw new Error('Coordinates not available for this location');
    }

    const locationData = {
      coordinates: {
        latitude: details.latitude,
        longitude: details.longitude
      },
      formattedAddress: details.formattedAddress || suggestion.description,
      placeId: details.placeId,
      addressComponents: details.addressComponents
    };

    console.log('📍 Location selected with coordinates:', locationData);
    onLocationSelect(locationData);
    
  } catch (error) {
    console.error('Error getting place details:', error);
    
    // ✅ AGAR COORDINATES NAHI MILLE TO CURRENT LOCATION USE KARO
    try {
      console.log('🔄 Falling back to current location...');
      const currentLocation = await LocationService.getCurrentLocation();
      
      const fallbackData = {
        coordinates: {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude
        },
        formattedAddress: suggestion.description,
        placeId: suggestion.placeId,
        isFallback: true
      };
      
      console.log('📍 Using fallback coordinates:', fallbackData);
      onLocationSelect(fallbackData);
      
    } catch (fallbackError) {
      console.error('Fallback also failed:', fallbackError);
      
      // ✅ LAST RESORT - DEFAULT COORDINATES
      const defaultData = {
        coordinates: {
          latitude: 19.0760, // Mumbai default
          longitude: 72.8777
        },
        formattedAddress: suggestion.description,
        placeId: suggestion.placeId,
        isDefault: true
      };
      
      console.log('📍 Using default coordinates:', defaultData);
      onLocationSelect(defaultData);
    }
  } finally {
    setLoading(false);
  }
};

// Current location function ko bhi improve karo
const handleGetCurrentLocation = async () => {
  setGettingLocation(true);
  try {
    const location = await LocationService.getLocationWithFallback();
    
    // ✅ CURRENT LOCATION MEIN BHI COORDINATES CHECK KARO
    if (!location.coordinates || !location.coordinates.latitude || !location.coordinates.longitude) {
      throw new Error('Current location coordinates not available');
    }
    
    setInput(location.formattedAddress);
    setCurrentCoords(location.coordinates);
    
    console.log('📍 Current location with coordinates:', location);
    onLocationSelect(location);
    setShowSuggestions(false);
    
  } catch (error) {
    console.error('Error getting current location:', error);
    
    // ✅ FALLBACK FOR CURRENT LOCATION
    const fallbackLocation = {
      coordinates: {
        latitude: 19.0760,
        longitude: 72.8777
      },
      formattedAddress: "Your current location",
      isFallback: true
    };
    
    setInput("Your current location");
    console.log('📍 Using fallback for current location:', fallbackLocation);
    onLocationSelect(fallbackLocation);
    setShowSuggestions(false);
  } finally {
    setGettingLocation(false);
  }
};

  // Clear input
  const handleClearInput = () => {
    setInput('');
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          value={input}
          onChangeText={handleInputChange}
          onFocus={() => {
            if (input.length >= 2 && suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 300);
          }}
          editable={!gettingLocation}
        />
        
        {input.length > 0 && (
          <TouchableOpacity onPress={handleClearInput} style={styles.clearButton}>
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
        
        {loading && (
          <ActivityIndicator 
            size="small" 
            color="#3b82f6" 
            style={styles.loadingIndicator}
          />
        )}
      </View>

      {showCurrentLocation && (
        <TouchableOpacity
          style={[styles.currentLocationButton, gettingLocation && styles.buttonDisabled]}
          onPress={handleGetCurrentLocation}
          disabled={gettingLocation}
        >
          {gettingLocation ? (
            <>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={styles.currentLocationText}>Getting Location...</Text>
            </>
          ) : (
            <>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.currentLocationText}>Use Current Location</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <ScrollView 
            style={styles.suggestionsList}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
          >
            {suggestions.map((suggestion) => (
              <TouchableOpacity
                key={suggestion.placeId}
                style={styles.suggestionItem}
                onPress={() => handleSuggestionSelect(suggestion)}
              >
                <Text style={styles.suggestionMainText}>{suggestion.mainText}</Text>
                {suggestion.secondaryText && (
                  <Text style={styles.suggestionSecondaryText}>{suggestion.secondaryText}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#f8fafc',
    minHeight: 56,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
    paddingVertical: 8,
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  clearText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: 'bold',
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0f2fe',
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  locationIcon: {
    fontSize: 16,
  },
  currentLocationText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    maxHeight: 200,
    zIndex: 1001,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  suggestionMainText: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '500',
  },
  suggestionSecondaryText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
});