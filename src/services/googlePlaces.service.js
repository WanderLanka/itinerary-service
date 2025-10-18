const axios = require('axios');

class GooglePlacesService {
  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY;
    this.baseUrl = 'https://places.googleapis.com/v1';
  }

  /**
   * Search for places by text query
   * @param {string} query - Search query
   * @param {object} location - Optional location bias { latitude, longitude }
   * @returns {Promise<Array>} Array of places
   */
  async searchPlaces(query, location = null) {
    try {
      const requestBody = {
        textQuery: query,
        languageCode: 'en'
      };

      // Add location bias if provided
      if (location) {
        requestBody.locationBias = {
          circle: {
            center: {
              latitude: location.latitude,
              longitude: location.longitude
            },
            radius: 50000.0 // 50km radius
          }
        };
      }

      const response = await axios.post(
        `${this.baseUrl}/places:searchText`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.types,places.photos'
          }
        }
      );

      return response.data.places || [];
    } catch (error) {
      console.error('❌ Google Places Search Error:', error.response?.data || error.message);
      throw new Error(`Failed to search places: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get place details by place ID
   * @param {string} placeId - Google Place ID
   * @returns {Promise<object>} Place details
   */
  async getPlaceDetails(placeId) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/places/${placeId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,rating,types,photos,editorialSummary,currentOpeningHours,priceLevel,userRatingCount'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('❌ Google Place Details Error:', error.response?.data || error.message);
      throw new Error(`Failed to get place details: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Search for nearby places
   * @param {object} location - { latitude, longitude }
   * @param {number} radius - Search radius in meters
   * @param {Array<string>} types - Place types to search for
   * @returns {Promise<Array>} Array of nearby places
   */
  async searchNearby(location, radius = 5000, types = []) {
    try {
      const requestBody = {
        locationRestriction: {
          circle: {
            center: {
              latitude: location.latitude,
              longitude: location.longitude
            },
            radius: radius
          }
        },
        languageCode: 'en',
        maxResultCount: 20
      };

      // Add included types if specified
      if (types.length > 0) {
        requestBody.includedTypes = types;
      }

      const response = await axios.post(
        `${this.baseUrl}/places:searchNearby`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.types,places.photos'
          }
        }
      );

      return response.data.places || [];
    } catch (error) {
      console.error('❌ Google Nearby Search Error:', error.response?.data || error.message);
      throw new Error(`Failed to search nearby places: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get autocomplete suggestions for place search
   * @param {string} input - User input text
   * @param {object} location - Optional location bias
   * @returns {Promise<Array>} Array of autocomplete predictions
   */
  async getAutocompleteSuggestions(input, location = null) {
    try {
      const requestBody = {
        input: input,
        languageCode: 'en'
      };

      if (location) {
        requestBody.locationBias = {
          circle: {
            center: {
              latitude: location.latitude,
              longitude: location.longitude
            },
            radius: 50000.0
          }
        };
      }

      const response = await axios.post(
        `${this.baseUrl}/places:autocomplete`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': this.apiKey
          }
        }
      );

      return response.data.suggestions || [];
    } catch (error) {
      console.error('❌ Google Autocomplete Error:', error.response?.data || error.message);
      throw new Error(`Failed to get autocomplete suggestions: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Geocode an address to get coordinates
   * @param {string} address - Address to geocode
   * @returns {Promise<object>} Geocoding result with coordinates
   */
  async geocodeAddress(address) {
    try {
      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/geocode/json',
        {
          params: {
            address: address,
            key: this.apiKey
          }
        }
      );

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        return {
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          formattedAddress: result.formatted_address,
          placeId: result.place_id
        };
      } else {
        throw new Error(`Geocoding failed: ${response.data.status}`);
      }
    } catch (error) {
      console.error('❌ Geocoding Error:', error.response?.data || error.message);
      throw new Error(`Failed to geocode address: ${error.message}`);
    }
  }
}

module.exports = new GooglePlacesService();
