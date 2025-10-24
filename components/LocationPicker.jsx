import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions
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
  const [currentLocation, setCurrentLocation] = useState(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const debounceRef = useRef(null);

  // Debounced search function
  const searchPlaces = async (searchText) => {
    if (searchText.length < 3) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoading(true);
    try {
      const results = await LocationService.getPlaceSuggestions(searchText, currentLocation);
      setSuggestions(results);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Error', 'Failed to search places. Please try again.');
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

    // Set new timeout
    debounceRef.current = setTimeout(() => {
      searchPlaces(text);
    }, 500);
  };

  // Handle suggestion selection
  const handleSuggestionSelect = async (suggestion) => {
    setInput(suggestion.description);
    setShowSuggestions(false);
    setLoading(true);

    try {
      const details = await LocationService.getPlaceDetails(suggestion.placeId);
      
      const locationData = {
        coordinates: {
          latitude: details.latitude,
          longitude: details.longitude
        },
        formattedAddress: details.formattedAddress,
        placeId: details.placeId
      };

      onLocationSelect(locationData);
    } catch (error) {
      console.error('Error getting place details:', error);
      Alert.alert('Error', 'Failed to get place details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get current location
  const handleGetCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const location = await LocationService.getLocationWithFallback();
      setCurrentLocation(location.coordinates);
      setInput(location.formattedAddress);
      onLocationSelect(location);
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert(
        'Location Error', 
        'Unable to get your current location. Please enable location services or enter your address manually.'
      );
    } finally {
      setGettingLocation(false);
    }
  };

  // Render suggestion item
  const renderSuggestion = ({ item }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSuggestionSelect(item)}
    >
      <Text style={styles.suggestionMainText}>{item.mainText}</Text>
      {item.secondaryText && (
        <Text style={styles.suggestionSecondaryText}>{item.secondaryText}</Text>
      )}
    </TouchableOpacity>
  );

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
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            // Delay hiding suggestions to allow selection
            setTimeout(() => setShowSuggestions(false), 200);
          }}
        />
        
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
          style={styles.currentLocationButton}
          onPress={handleGetCurrentLocation}
          disabled={gettingLocation}
        >
          {gettingLocation ? (
            <ActivityIndicator size="small" color="#3b82f6" />
          ) : (
            <Text style={styles.currentLocationText}>📍 Use Current Location</Text>
          )}
        </TouchableOpacity>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <FlatList
            data={suggestions}
            renderItem={renderSuggestion}
            keyExtractor={(item) => item.placeId}
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
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
  loadingIndicator: {
    marginLeft: 8,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  currentLocationText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
    marginLeft: 4,
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
