const Itinerary = require('../models/Itinerary');
const Route = require('../models/Route');
const mongoose = require('mongoose');

/**
 * Get My Trips - Categorized by status
 * Returns: saved plans, unfinished trips, and upcoming trips
 */
exports.getMyTrips = async (req, res) => {
  try {
    console.log('\n📋 ===== GET MY TRIPS =====');
    console.log('User ID:', req.user?.userId);

    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = req.user.userId;
    const now = new Date();

    // Fetch all user's itineraries
    const allItineraries = await Itinerary.find({ userId }).sort({ createdAt: -1 });
    console.log(`📊 Found ${allItineraries.length} total itineraries for user`);

    // Categorize itineraries
    const savedPlans = []; // Status: 'planned' (ready to use)
    const unfinishedTrips = []; // Status: 'draft' (incomplete)
    const upcomingTrips = []; // Future trips (startDate > now, status: planned/active)

    for (const itinerary of allItineraries) {
      const completionPercentage = itinerary.calculateCompletionPercentage();
      const startDate = new Date(itinerary.startDate);
      const endDate = new Date(itinerary.endDate);
      const isUpcoming = startDate > now;
      const isActive = startDate <= now && endDate >= now;
      const isCompleted = endDate < now;

      // Check if route exists for this itinerary
      const routeCount = await Route.countDocuments({ itineraryId: itinerary._id });
      const hasRoute = routeCount > 0;

      const tripData = {
        _id: itinerary._id,
        tripName: itinerary.tripName,
        startLocation: itinerary.startLocation.name,
        endLocation: itinerary.endLocation.name,
        startDate: itinerary.startDate,
        endDate: itinerary.endDate,
        status: itinerary.status,
        completionPercentage,
        hasRoute,
        selectedRoute: itinerary.selectedRoute,
        dayPlansCount: itinerary.dayPlans?.length || 0,
        placesCount: itinerary.dayPlans?.reduce((sum, day) => sum + (day.places?.length || 0), 0) || 0,
        tripDuration: itinerary.tripDuration,
        daysUntilStart: itinerary.daysUntilStart,
        isUpcoming,
        isActive,
        isCompleted,
        createdAt: itinerary.createdAt,
        updatedAt: itinerary.updatedAt
      };

      // Categorize based on status and dates
      if (itinerary.status === 'draft' && completionPercentage < 100) {
        // Unfinished trips (incomplete planning)
        unfinishedTrips.push(tripData);
      } else if (itinerary.status === 'planned' || (itinerary.status === 'draft' && completionPercentage === 100)) {
        // Saved plans (ready to use, not yet started)
        if (isUpcoming || (!isUpcoming && !isActive && !isCompleted)) {
          savedPlans.push(tripData);
        }
      }

      // Upcoming trips (future trips that are planned/active)
      if (isUpcoming && (itinerary.status === 'planned' || itinerary.status === 'active')) {
        upcomingTrips.push(tripData);
      } else if (isActive && itinerary.status === 'active') {
        // Currently active trips also count as upcoming
        upcomingTrips.push({
          ...tripData,
          isCurrentlyActive: true,
          daysRemaining: Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))
        });
      }
    }

    // Sort each category
    savedPlans.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    unfinishedTrips.sort((a, b) => b.completionPercentage - a.completionPercentage);
    upcomingTrips.sort((a, b) => a.daysUntilStart - b.daysUntilStart);

    console.log(`✅ Categorized: ${savedPlans.length} saved, ${unfinishedTrips.length} unfinished, ${upcomingTrips.length} upcoming`);

    res.json({
      success: true,
      message: 'My trips retrieved successfully',
      data: {
        savedPlans: {
          count: savedPlans.length,
          trips: savedPlans
        },
        unfinished: {
          count: unfinishedTrips.length,
          trips: unfinishedTrips
        },
        upcoming: {
          count: upcomingTrips.length,
          trips: upcomingTrips
        },
        summary: {
          total: allItineraries.length,
          saved: savedPlans.length,
          unfinished: unfinishedTrips.length,
          upcoming: upcomingTrips.length
        }
      }
    });

  } catch (error) {
    console.error('❌ Get My Trips Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve trips',
      error: error.message
    });
  }
};

/**
 * Get trips by category
 * Category: 'saved', 'unfinished', or 'upcoming'
 */
exports.getTripsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    console.log(`\n📋 GET TRIPS BY CATEGORY: ${category}`);
    console.log('User ID:', req.user?.userId);

    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!['saved', 'unfinished', 'upcoming'].includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category. Must be: saved, unfinished, or upcoming'
      });
    }

    // Get all trips and categorize
    const myTripsData = await this.getMyTripsData(req.user.userId);
    
    let trips = [];
    switch (category) {
      case 'saved':
        trips = myTripsData.savedPlans.trips;
        break;
      case 'unfinished':
        trips = myTripsData.unfinished.trips;
        break;
      case 'upcoming':
        trips = myTripsData.upcoming.trips;
        break;
    }

    res.json({
      success: true,
      message: `${category} trips retrieved successfully`,
      data: {
        category,
        count: trips.length,
        trips
      }
    });

  } catch (error) {
    console.error(`❌ Get Trips by Category Error:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve trips',
      error: error.message
    });
  }
};

/**
 * Helper function to get trips data (reusable) with full details
 */
exports.getMyTripsData = async (userId) => {
  const now = new Date();
  const allItineraries = await Itinerary.find({ userId }).sort({ createdAt: -1 });

  const savedPlans = [];
  const unfinishedTrips = [];
  const upcomingTrips = [];

  for (const itinerary of allItineraries) {
    const completionPercentage = itinerary.calculateCompletionPercentage();
    const startDate = new Date(itinerary.startDate);
    const endDate = new Date(itinerary.endDate);
    const isUpcoming = startDate > now;
    const isActive = startDate <= now && endDate >= now;
    const isCompleted = endDate < now;

    // Get route information - validate ObjectId first
    let selectedRoute = null;
    if (itinerary.selectedRoute && mongoose.Types.ObjectId.isValid(itinerary.selectedRoute)) {
      try {
        selectedRoute = await Route.findById(itinerary.selectedRoute);
      } catch (error) {
        console.error('Error fetching route:', error);
        selectedRoute = null;
      }
    }

    // Extract all locations from dayPlans
    const allLocations = itinerary.dayPlans?.reduce((locs, day) => {
      if (day.places && day.places.length > 0) {
        const placeNames = day.places.map(p => p.placeName).filter(Boolean);
        return [...locs, ...placeNames];
      }
      return locs;
    }, []) || [];

    // Generate destination string
    const destination = allLocations.length > 0 
      ? allLocations.slice(0, 3).join(', ') + (allLocations.length > 3 ? ` +${allLocations.length - 3} more` : '')
      : `${itinerary.startLocation.name} to ${itinerary.endLocation.name}`;

    const tripData = {
      _id: itinerary._id,
      tripName: itinerary.tripName,
      title: itinerary.tripName,
      destination,
      startLocation: itinerary.startLocation.name,
      endLocation: itinerary.endLocation.name,
      startDate: itinerary.startDate,
      endDate: itinerary.endDate,
      status: itinerary.status,
      completionPercentage,
      progress: completionPercentage,
      hasRoute: !!selectedRoute,
      selectedRoute: selectedRoute ? {
        _id: selectedRoute._id,
        routeName: selectedRoute.routeName,
        totalDistance: selectedRoute.totalDistance,
        estimatedDuration: selectedRoute.estimatedDuration,
        estimatedCost: selectedRoute.estimatedCosts?.total || 0
      } : null,
      dayPlansCount: itinerary.dayPlans?.length || 0,
      placesCount: itinerary.dayPlans?.reduce((sum, day) => sum + (day.places?.length || 0), 0) || 0,
      dayPlans: itinerary.dayPlans || [],
      locations: allLocations,
      tripDuration: itinerary.tripDuration,
      duration: `${itinerary.tripDuration} ${itinerary.tripDuration === 1 ? 'Day' : 'Days'}`,
      daysUntilStart: itinerary.daysUntilStart,
      daysUntil: itinerary.daysUntilStart,
      isUpcoming,
      isActive,
      isCompleted,
      createdAt: itinerary.createdAt,
      updatedAt: itinerary.updatedAt,
      lastEdited: itinerary.updatedAt,
      created: itinerary.createdAt,
      lastModified: itinerary.updatedAt,
      // Add thumbnail placeholder (you can enhance this with actual images later)
      thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400',
      description: `A ${itinerary.tripDuration}-day journey from ${itinerary.startLocation.name} to ${itinerary.endLocation.name}`,
    };

    if (itinerary.status === 'draft' && completionPercentage < 100) {
      unfinishedTrips.push(tripData);
    } else if (itinerary.status === 'planned' || (itinerary.status === 'draft' && completionPercentage === 100)) {
      if (isUpcoming || (!isUpcoming && !isActive && !isCompleted)) {
        savedPlans.push(tripData);
      }
    }

    if (isUpcoming && (itinerary.status === 'planned' || itinerary.status === 'active')) {
      upcomingTrips.push(tripData);
    } else if (isActive && itinerary.status === 'active') {
      upcomingTrips.push({
        ...tripData,
        isCurrentlyActive: true,
        daysRemaining: Math.ceil((endDate - now) / (1000 * 60 * 60 * 24))
      });
    }
  }

  savedPlans.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  unfinishedTrips.sort((a, b) => b.completionPercentage - a.completionPercentage);
  upcomingTrips.sort((a, b) => a.daysUntilStart - b.daysUntilStart);

  return {
    savedPlans: { count: savedPlans.length, trips: savedPlans },
    unfinished: { count: unfinishedTrips.length, trips: unfinishedTrips },
    upcoming: { count: upcomingTrips.length, trips: upcomingTrips }
  };
};

/**
 * Get detailed information for a single trip
 * GET /my-trips/trip/:id
 */
exports.getTripDetails = async (req, res) => {
  try {
    const userId = req.user.userId;
    const tripId = req.params.id;

    // Find the itinerary
    const itinerary = await Itinerary.findOne({ _id: tripId, userId });

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    const now = new Date();
    const completionPercentage = itinerary.calculateCompletionPercentage();
    const startDate = new Date(itinerary.startDate);
    const endDate = new Date(itinerary.endDate);
    const isUpcoming = startDate > now;
    const isActive = startDate <= now && endDate >= now;
    const isCompleted = endDate < now;

    // Get route information - validate ObjectId first
    let selectedRoute = null;
    if (itinerary.selectedRoute && mongoose.Types.ObjectId.isValid(itinerary.selectedRoute)) {
      try {
        selectedRoute = await Route.findById(itinerary.selectedRoute);
      } catch (error) {
        console.error('Error fetching route:', error);
        selectedRoute = null;
      }
    }

    // Get all routes for this itinerary
    const allRoutes = await Route.find({ itineraryId: itinerary._id });

    // Extract all locations from dayPlans
    const allLocations = itinerary.dayPlans?.reduce((locs, day) => {
      if (day.places && day.places.length > 0) {
        const placeNames = day.places.map(p => p.placeName).filter(Boolean);
        return [...locs, ...placeNames];
      }
      return locs;
    }, []) || [];

    // Generate destination string
    const destination = allLocations.length > 0 
      ? allLocations.slice(0, 3).join(', ') + (allLocations.length > 3 ? ` +${allLocations.length - 3} more` : '')
      : `${itinerary.startLocation.name} to ${itinerary.endLocation.name}`;

    const tripDetails = {
      _id: itinerary._id,
      tripName: itinerary.tripName,
      title: itinerary.tripName,
      destination,
      startLocation: itinerary.startLocation,
      endLocation: itinerary.endLocation,
      startDate: itinerary.startDate,
      endDate: itinerary.endDate,
      status: itinerary.status,
      completionPercentage,
      progress: completionPercentage,
      hasRoute: !!selectedRoute,
      selectedRoute: selectedRoute ? {
        _id: selectedRoute._id,
        routeName: selectedRoute.routeName,
        totalDistance: selectedRoute.totalDistance,
        estimatedDuration: selectedRoute.estimatedDuration,
        estimatedCost: selectedRoute.estimatedCosts?.total || 0,
        estimatedCosts: selectedRoute.estimatedCosts,
        waypoints: selectedRoute.waypoints
      } : null,
      allRoutes: allRoutes.map(route => ({
        _id: route._id,
        routeName: route.routeName,
        totalDistance: route.totalDistance,
        estimatedDuration: route.estimatedDuration,
        estimatedCost: route.estimatedCosts?.total || 0
      })),
      dayPlansCount: itinerary.dayPlans?.length || 0,
      placesCount: itinerary.dayPlans?.reduce((sum, day) => sum + (day.places?.length || 0), 0) || 0,
      dayPlans: itinerary.dayPlans || [],
      locations: allLocations,
      tripDuration: itinerary.tripDuration,
      duration: `${itinerary.tripDuration} ${itinerary.tripDuration === 1 ? 'Day' : 'Days'}`,
      daysUntilStart: itinerary.daysUntilStart,
      daysUntil: itinerary.daysUntilStart,
      isUpcoming,
      isActive,
      isCompleted,
      createdAt: itinerary.createdAt,
      updatedAt: itinerary.updatedAt,
      lastEdited: itinerary.updatedAt,
      thumbnail: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=400',
      description: `A ${itinerary.tripDuration}-day journey from ${itinerary.startLocation.name} to ${itinerary.endLocation.name}`,
    };

    return res.status(200).json({
      success: true,
      data: tripDetails
    });
  } catch (error) {
    console.error('Error fetching trip details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch trip details',
      error: error.message
    });
  }
};
