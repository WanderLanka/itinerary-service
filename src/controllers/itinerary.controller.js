const itineraryGeneratorService = require('../services/itineraryGenerator.service');
const googlePlacesService = require('../services/googlePlaces.service');
const Itinerary = require('../models/Itinerary');

/**
 * Create a new simple itinerary (without auto-generating day plans)
 * User will manually add places to each day
 */
exports.createItinerary = async (req, res) => {
  try {
    console.log('\n🎯 [ITINERARY] Create Itinerary Request');
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
    console.log('🔐 Auth User:', req.user);
    
    const userId = req.user?.id || req.user?.userId;
    
    if (!userId) {
      console.log('❌ [ITINERARY] No user ID found');
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    console.log('✅ [ITINERARY] User ID:', userId);

    const {
      tripName,
      startDate,
      endDate,
      startLocation,
      endLocation,
      destinations = [],
      preferences = {}
    } = req.body;

    // Validation
    if (!tripName || !startDate || !endDate || !startLocation || !endLocation) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tripName, startDate, endDate, startLocation, endLocation'
      });
    }

    // Calculate trip duration
    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Create empty day plans (user will fill them in)
    const dayPlans = [];
    for (let day = 0; day < durationDays; day++) {
      const currentDate = new Date(start);
      currentDate.setDate(currentDate.getDate() + day);
      
      dayPlans.push({
        dayNumber: day + 1,
        date: currentDate,
        places: [],
        activities: [],
        meals: [],
        notes: ''
      });
    }

    // Set default preferences
    const defaultPreferences = {
      travelStyle: preferences.travelStyle || 'moderate',
      interests: preferences.interests || ['tourist_attraction', 'museum', 'park'],
      budget: preferences.budget || 'moderate',
      accommodation: preferences.accommodation || 'hotel',
      transportation: preferences.transportation || 'mixed'
    };

    // Create itinerary with empty day plans
    const itinerary = new Itinerary({
      userId,
      tripName,
      startDate: start,
      endDate: end,
      startLocation,
      endLocation,
      destinations,
      preferences: defaultPreferences,
      dayPlans,
      totalEstimatedCost: {
        accommodation: 0,
        food: 0,
        activities: 0,
        transportation: 0,
        total: 0
      },
      status: 'draft'
    });

    await itinerary.save();
    console.log(`✅ [ITINERARY] Created itinerary ${itinerary._id} for user ${userId} with ${durationDays} days`);
    console.log(`📍 [ITINERARY] From: ${startLocation.name} → To: ${endLocation.name}`);

    res.status(201).json({
      success: true,
      message: 'Itinerary created successfully',
      data: itinerary
    });
  } catch (error) {
    console.error('❌ [ITINERARY] Create Itinerary Error:', error);
    console.error('Error Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to create itinerary',
      error: error.message
    });
  }
};

/**
 * Generate a new itinerary with AI-powered day plans
 */
exports.generateItinerary = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const {
      tripName,
      startDate,
      endDate,
      startLocation,
      endLocation,
      destinations = [],
      preferences = {}
    } = req.body;

    // Validation
    if (!tripName || !startDate || !endDate || !startLocation || !endLocation) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: tripName, startDate, endDate, startLocation, endLocation'
      });
    }

    // Set default preferences
    const defaultPreferences = {
      travelStyle: preferences.travelStyle || 'moderate',
      interests: preferences.interests || ['tourist_attraction', 'museum', 'park'],
      budget: preferences.budget || 'moderate',
      accommodation: preferences.accommodation || 'hotel',
      transportation: preferences.transportation || 'mixed'
    };

    const itineraryData = {
      userId,
      tripName,
      startDate,
      endDate,
      startLocation,
      endLocation,
      destinations,
      preferences: defaultPreferences
    };

    const itinerary = await itineraryGeneratorService.generateItinerary(itineraryData);

    res.status(201).json({
      success: true,
      message: 'Itinerary generated successfully',
      data: itinerary
    });
  } catch (error) {
    console.error('❌ Generate Itinerary Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate itinerary',
      error: error.message
    });
  }
};

/**
 * Get itinerary by ID
 */
exports.getItinerary = async (req, res) => {
  try {
    const { id } = req.params;

    const itinerary = await itineraryGeneratorService.getItinerary(id);

    res.json({
      success: true,
      data: itinerary
    });
  } catch (error) {
    console.error('❌ Get Itinerary Error:', error);
    res.status(404).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get all itineraries for authenticated user
 */
exports.getUserItineraries = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { status } = req.query;

    const itineraries = await itineraryGeneratorService.getUserItineraries(userId, status);

    res.json({
      success: true,
      count: itineraries.length,
      data: itineraries
    });
  } catch (error) {
    console.error('❌ Get User Itineraries Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch itineraries',
      error: error.message
    });
  }
};

/**
 * Update itinerary
 */
exports.updateItinerary = async (req, res) => {
  try {
    console.log('\n📝 [ITINERARY] Update Itinerary Request');
    console.log('🆔 Itinerary ID:', req.params.id);
    console.log('📦 Updates:', JSON.stringify(req.body, null, 2).substring(0, 500));
    
    const { id } = req.params;
    const updates = req.body;

    const itinerary = await itineraryGeneratorService.updateItinerary(id, updates);

    console.log('✅ [ITINERARY] Itinerary updated successfully');
    console.log('📊 Day plans updated:', itinerary.dayPlans?.length || 0);

    res.json({
      success: true,
      message: 'Itinerary updated successfully',
      data: itinerary
    });
  } catch (error) {
    console.error('❌ [ITINERARY] Update Itinerary Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update itinerary',
      error: error.message
    });
  }
};

/**
 * Delete itinerary
 */
exports.deleteItinerary = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || req.user?.userId;

    await itineraryGeneratorService.deleteItinerary(id, userId);

    res.json({
      success: true,
      message: 'Itinerary deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete Itinerary Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Search places (autocomplete for destination input)
 */
exports.searchPlaces = async (req, res) => {
  try {
    const { query, latitude, longitude } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const location = latitude && longitude 
      ? { latitude: parseFloat(latitude), longitude: parseFloat(longitude) }
      : null;

    const places = await googlePlacesService.searchPlaces(query, location);

    res.json({
      success: true,
      count: places.length,
      data: places.map(place => ({
        placeId: place.id,
        name: place.displayName?.text || place.name,
        address: place.formattedAddress,
        latitude: place.location?.latitude,
        longitude: place.location?.longitude,
        types: place.types,
        rating: place.rating
      }))
    });
  } catch (error) {
    console.error('❌ Search Places Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search places',
      error: error.message
    });
  }
};

/**
 * Get place details
 */
exports.getPlaceDetails = async (req, res) => {
  try {
    const { placeId } = req.params;

    const place = await googlePlacesService.getPlaceDetails(placeId);

    res.json({
      success: true,
      data: place
    });
  } catch (error) {
    console.error('❌ Get Place Details Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get place details',
      error: error.message
    });
  }
};

/**
 * Get autocomplete suggestions
 */
exports.getAutocompleteSuggestions = async (req, res) => {
  try {
    const { input, latitude, longitude } = req.query;

    if (!input) {
      return res.status(400).json({
        success: false,
        message: 'Input text is required'
      });
    }

    const location = latitude && longitude 
      ? { latitude: parseFloat(latitude), longitude: parseFloat(longitude) }
      : null;

    const suggestions = await googlePlacesService.getAutocompleteSuggestions(input, location);

    res.json({
      success: true,
      count: suggestions.length,
      data: suggestions
    });
  } catch (error) {
    console.error('❌ Autocomplete Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get suggestions',
      error: error.message
    });
  }
};
