const Route = require('../models/Route');
const Itinerary = require('../models/Itinerary');
const googleDirectionsService = require('../services/googleDirections.service');
const googlePlacesService = require('../services/googlePlaces.service');

/**
 * Calculate routes for an itinerary (all 3 types: recommended, shortest, scenic)
 */
exports.calculateRoutes = async (req, res) => {
  try {
    const { itineraryId } = req.params;

    // Get itinerary
    const itinerary = await Itinerary.findById(itineraryId);
    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Itinerary not found'
      });
    }

    // Build waypoints from itinerary
    const waypoints = [
      itinerary.startLocation,
      ...itinerary.destinations,
      itinerary.endLocation
    ].map(location => ({
      latitude: location.latitude,
      longitude: location.longitude,
      name: location.name
    }));

    console.log(`📍 Calculating routes for ${waypoints.length} waypoints`);

    // Calculate all route types
    const routeData = await googleDirectionsService.calculateAllRouteTypes(waypoints);

    // Delete existing routes for this itinerary
    await Route.deleteMany({ itineraryId });

    // Save all route types to database
    const savedRoutes = {};
    
    for (const [type, data] of Object.entries(routeData)) {
      // Find nearby attractions for scenic route
      let attractions = [];
      if (type === 'scenic') {
        attractions = await this.findAttractionsAlongRoute(data.segments, waypoints);
      }

      const route = new Route({
        itineraryId,
        routeType: type,
        totalDistance: data.totalDistance,
        totalDuration: data.totalDuration,
        waypoints: waypoints.map((wp, idx) => ({
          location: { latitude: wp.latitude, longitude: wp.longitude },
          name: wp.name,
          order: idx
        })),
        segments: data.segments,
        overview: data.overview,
        attractionsAlongRoute: attractions,
        estimatedCosts: this.estimateRouteCosts(data.totalDistance, itinerary.preferences)
      });

      // Calculate and set score
      route.calculateScore();
      await route.save();
      
      savedRoutes[type] = route;
      console.log(`✅ Saved ${type} route: ${(data.totalDistance / 1000).toFixed(1)}km, ${(data.totalDuration / 60).toFixed(0)}min`);
    }

    res.json({
      success: true,
      message: 'Routes calculated successfully',
      data: {
        recommended: savedRoutes.recommended,
        shortest: savedRoutes.shortest,
        scenic: savedRoutes.scenic
      }
    });
  } catch (error) {
    console.error('❌ Calculate Routes Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate routes',
      error: error.message
    });
  }
};

/**
 * Get specific route by ID
 */
exports.getRoute = async (req, res) => {
  try {
    const { routeId } = req.params;

    const route = await Route.findById(routeId).populate('itineraryId');
    
    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }

    res.json({
      success: true,
      data: route
    });
  } catch (error) {
    console.error('❌ Get Route Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get route',
      error: error.message
    });
  }
};

/**
 * Get all routes for an itinerary
 */
exports.getItineraryRoutes = async (req, res) => {
  try {
    const { itineraryId } = req.params;

    const routes = await Route.find({ itineraryId }).sort({ score: -1 });

    res.json({
      success: true,
      count: routes.length,
      data: {
        recommended: routes.find(r => r.routeType === 'recommended'),
        shortest: routes.find(r => r.routeType === 'shortest'),
        scenic: routes.find(r => r.routeType === 'scenic')
      }
    });
  } catch (error) {
    console.error('❌ Get Itinerary Routes Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get routes',
      error: error.message
    });
  }
};

/**
 * Compare all route types side-by-side
 */
exports.compareRoutes = async (req, res) => {
  try {
    const { itineraryId } = req.params;

    const routes = await Route.find({ itineraryId });

    if (routes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No routes found for this itinerary. Please calculate routes first.'
      });
    }

    const comparison = routes.map(route => ({
      type: route.routeType,
      distance: {
        meters: route.totalDistance,
        kilometers: (route.totalDistance / 1000).toFixed(2),
        miles: (route.totalDistance / 1609.34).toFixed(2)
      },
      duration: {
        seconds: route.totalDuration,
        minutes: Math.round(route.totalDuration / 60),
        hours: (route.totalDuration / 3600).toFixed(1)
      },
      estimatedCosts: route.estimatedCosts,
      attractionsCount: route.attractionsAlongRoute?.length || 0,
      score: route.score
    }));

    res.json({
      success: true,
      data: comparison.sort((a, b) => b.score - a.score)
    });
  } catch (error) {
    console.error('❌ Compare Routes Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to compare routes',
      error: error.message
    });
  }
};

/**
 * Helper: Find attractions along the route
 */
exports.findAttractionsAlongRoute = async (segments, waypoints) => {
  const attractions = [];
  const searchRadius = 5000; // 5km from route

  try {
    // Search around each waypoint
    for (const waypoint of waypoints) {
      const nearby = await googlePlacesService.searchNearby(
        { latitude: waypoint.latitude, longitude: waypoint.longitude },
        searchRadius,
        ['tourist_attraction', 'museum', 'park', 'natural_feature']
      );

      nearby.slice(0, 5).forEach(place => {
        attractions.push({
          placeId: place.id,
          name: place.displayName?.text || place.name,
          location: {
            latitude: place.location?.latitude,
            longitude: place.location?.longitude
          },
          types: place.types,
          rating: place.rating,
          distanceFromRoute: 0, // Could calculate actual distance
          detourTime: 1800 // Estimated 30 minutes
        });
      });
    }

    // Remove duplicates by placeId
    const uniqueAttractions = Array.from(
      new Map(attractions.map(a => [a.placeId, a])).values()
    );

    return uniqueAttractions;
  } catch (error) {
    console.error('⚠️ Error finding attractions:', error.message);
    return [];
  }
};

/**
 * Helper: Estimate route costs
 */
exports.estimateRouteCosts = (distanceMeters, preferences) => {
  const distanceKm = distanceMeters / 1000;
  
  // Cost per km based on transportation type
  const costPerKm = {
    public: 10,
    private: 50,
    rental: 30,
    mixed: 25
  };

  const transportationType = preferences?.transportation || 'mixed';
  const fuelCost = distanceKm * costPerKm[transportationType];

  // Estimate tolls (roughly 500 LKR per 100km)
  const tolls = Math.floor(distanceKm / 100) * 500;

  // Parking costs (estimate 200 LKR per stop)
  const parking = 200;

  return {
    fuel: Math.round(fuelCost),
    tolls: tolls,
    parking: parking,
    total: Math.round(fuelCost + tolls + parking)
  };
};
