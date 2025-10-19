const Route = require('../models/Route');
const Itinerary = require('../models/Itinerary');
const googleDirectionsService = require('../services/googleDirections.service');
const googlePlacesService = require('../services/googlePlaces.service');

/**
 * Calculate routes for an itinerary (all 3 types: recommended, shortest, scenic)
 */
exports.calculateRoutes = async (req, res) => {
  console.log('\n🚀 ===== CALCULATE ROUTES STARTED =====');
  console.log('📥 Request params:', req.params);
  console.log('🔐 Auth user:', req.user);
  
  try {
    const { itineraryId } = req.params;
    console.log('🆔 Itinerary ID:', itineraryId);

    // Get itinerary
    console.log('🔍 Fetching itinerary from database...');
    const itinerary = await Itinerary.findById(itineraryId);
    
    if (!itinerary) {
      console.log('❌ Itinerary not found!');
      return res.status(404).json({
        success: false,
        message: 'Itinerary not found'
      });
    }
    console.log('✅ Itinerary found:', itinerary.tripName);
    console.log('📍 Start:', itinerary.startLocation?.name);
    console.log('📍 End:', itinerary.endLocation?.name);
    console.log('📍 Destinations field:', itinerary.destinations?.length || 0);
    console.log('📍 Day plans:', itinerary.dayPlans?.length || 0);

    // Extract waypoints from day plans (all places in chronological order)
    let waypointsFromDayPlans = [];
    if (itinerary.dayPlans && itinerary.dayPlans.length > 0) {
      console.log('🗺️  Extracting waypoints from day plans...');
      itinerary.dayPlans.forEach((day, dayIdx) => {
        if (day.places && day.places.length > 0) {
          console.log(`  Day ${day.dayNumber}: ${day.places.length} places`);
          day.places.forEach((place, placeIdx) => {
            if (place.location && place.location.latitude && place.location.longitude) {
              waypointsFromDayPlans.push({
                latitude: place.location.latitude,
                longitude: place.location.longitude,
                name: place.name || `Place ${dayIdx + 1}-${placeIdx + 1}`,
                placeId: place.placeId
              });
              console.log(`    - ${place.name}`);
            }
          });
        }
      });
    }

    // Build waypoints:
    // 1. Start with startLocation
    // 2. Add places from day plans (primary source)
    // 3. If no day plan places, fall back to destinations field
    // 4. End with endLocation
    let intermediateWaypoints = [];
    
    // Prefer waypoints from day plans (these are the actual planned locations)
    if (waypointsFromDayPlans.length > 0) {
      intermediateWaypoints.push(...waypointsFromDayPlans);
      console.log(`✅ Using ${waypointsFromDayPlans.length} waypoints from day plans`);
    } 
    // Fall back to destinations field if no day plan places
    else if (itinerary.destinations && itinerary.destinations.length > 0) {
      intermediateWaypoints.push(...itinerary.destinations);
      console.log(`✅ Using ${itinerary.destinations.length} waypoints from destinations field`);
    }

    const waypoints = [
      itinerary.startLocation,
      ...intermediateWaypoints,
      itinerary.endLocation
    ].map(location => ({
      latitude: location.latitude,
      longitude: location.longitude,
      name: location.name,
      placeId: location.placeId
    }));

    console.log(`\n📍 Building final waypoints... Total: ${waypoints.length}`);
    console.log(`   - Start: ${itinerary.startLocation?.name}`);
    if (intermediateWaypoints.length > 0) {
      console.log(`   - Intermediate waypoints: ${intermediateWaypoints.length}`);
      intermediateWaypoints.forEach((wp, idx) => {
        console.log(`     ${idx + 1}. ${wp.name}`);
      });
    } else {
      console.log(`   - No intermediate waypoints (direct route)`);
    }
    console.log(`   - End: ${itinerary.endLocation?.name}`);

    // Calculate all route types
    console.log('\n🧮 Calling Google Directions API...');
    const routeData = await googleDirectionsService.calculateAllRouteTypes(waypoints);
    console.log('✅ Google API response received');
    console.log('📊 Route types calculated:', Object.keys(routeData));

    // Delete existing routes for this itinerary
    console.log('\n🗑️  Deleting old routes...');
    const deleteResult = await Route.deleteMany({ itineraryId });
    console.log(`✅ Deleted ${deleteResult.deletedCount} old routes`);

    // Save all route types to database
    console.log('\n💾 Saving routes to database...');
    const savedRoutes = {};
    
    for (const [type, data] of Object.entries(routeData)) {
      console.log(`\n📝 Processing ${type} route:`);
      console.log(`  Distance: ${(data.totalDistance / 1000).toFixed(1)}km`);
      console.log(`  Duration: ${(data.totalDuration / 60).toFixed(0)}min`);
      
      // Find nearby attractions for scenic route
      let attractions = [];
      if (type === 'scenic') {
        console.log('  🎨 Finding attractions for scenic route...');
        attractions = await this.findAttractionsAlongRoute(data.segments, waypoints);
        console.log(`  ✅ Found ${attractions.length} attractions`);
      }

      // Calculate costs
      const costs = this.estimateRouteCosts(data.totalDistance, itinerary.preferences);
      console.log(`  💰 Estimated costs: LKR ${costs.total}`);

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
        estimatedCosts: costs
      });

      // Calculate and set score
      console.log('  🎯 Calculating route score...');
      route.calculateScore();
      console.log(`  📊 Score: ${route.score}`);
      
      console.log('  💾 Saving to database...');
      await route.save();
      console.log(`  ✅ ${type} route saved! ID: ${route._id}`);
      
      savedRoutes[type] = route;
    }

    console.log('\n✅ ===== ALL ROUTES SAVED SUCCESSFULLY =====');
    console.log(`📦 Total routes created: ${Object.keys(savedRoutes).length}`);
    Object.entries(savedRoutes).forEach(([type, route]) => {
      console.log(`  - ${type}: ${(route.totalDistance / 1000).toFixed(1)}km, ${(route.totalDuration / 60).toFixed(0)}min, LKR ${route.estimatedCosts.total}`);
    });

    // Update itinerary with selectedRoute (default to recommended)
    console.log('\n🔄 Updating itinerary with default selectedRoute...');
    await Itinerary.findByIdAndUpdate(
      itineraryId,
      { selectedRoute: 'recommended' },
      { new: true }
    );
    console.log('✅ Itinerary updated with selectedRoute: recommended');

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
    console.error('\n❌ ===== CALCULATE ROUTES ERROR =====');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate routes',
      error: error.message
    });
  }
  console.log('===== CALCULATE ROUTES ENDED =====\n');
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
    public: 300,
    private: 300,
    rental: 300,
    mixed: 300
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
