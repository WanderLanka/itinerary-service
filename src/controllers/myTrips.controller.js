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

    // OPTIMIZATION: Fetch all routes in one query to avoid N+1 problem
    const itineraryIds = allItineraries.map(i => i._id);
    const allRoutes = await Route.find({ itineraryId: { $in: itineraryIds } }).select('itineraryId');
    const routeMap = new Map();
    allRoutes.forEach(route => {
      routeMap.set(route.itineraryId.toString(), true);
    });
    console.log(`📊 Found ${allRoutes.length} total routes for ${itineraryIds.length} itineraries`);

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

      // Check if route exists for this itinerary using the pre-fetched map
      const hasRoute = routeMap.has(itinerary._id.toString());

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

  // OPTIMIZATION: Fetch all routes in one query to avoid N+1 problem
  const itineraryIds = allItineraries.map(i => i._id);
  const allRoutes = await Route.find({ itineraryId: { $in: itineraryIds } });
  const routeMap = new Map();
  allRoutes.forEach(route => {
    routeMap.set(route.itineraryId.toString(), route);
  });
  console.log(`📊 [getMyTripsData] Loaded ${allRoutes.length} routes for ${itineraryIds.length} itineraries`);

  // Also fetch routes by their ObjectId for selectedRoute lookups
  const selectedRouteIds = allItineraries
    .map(i => i.selectedRoute)
    .filter(sr => sr && mongoose.Types.ObjectId.isValid(sr));
  
  const selectedRoutes = await Route.find({ _id: { $in: selectedRouteIds } });
  const selectedRouteMap = new Map();
  selectedRoutes.forEach(route => {
    selectedRouteMap.set(route._id.toString(), route);
  });
  console.log(`📊 [getMyTripsData] Loaded ${selectedRoutes.length} selected routes`);

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

    // Get route information - use pre-fetched data
    let selectedRoute = null;
    if (itinerary.selectedRoute && mongoose.Types.ObjectId.isValid(itinerary.selectedRoute)) {
      selectedRoute = selectedRouteMap.get(itinerary.selectedRoute.toString()) || null;
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

    // Extract all locations from dayPlans with full details
    const allLocations = [];
    const locationNames = [];
    const allChecklists = [];
    const allNotes = [];
    
    if (itinerary.dayPlans && itinerary.dayPlans.length > 0) {
      itinerary.dayPlans.forEach((day) => {
        // Extract places
        if (day.places && day.places.length > 0) {
          day.places.forEach((place) => {
            allLocations.push({
              _id: place.placeId || place._id,
              name: place.name,
              address: place.address || '',
              location: place.location,
              coordinates: place.location,
              image: place.photos && place.photos.length > 0 
                ? place.photos[0] 
                : 'https://via.placeholder.com/80',
              imageUrl: place.photos && place.photos.length > 0 
                ? place.photos[0] 
                : 'https://via.placeholder.com/80',
              rating: place.rating,
              types: place.types || []
            });
            locationNames.push(place.name);
          });
        }
        
        // Extract checklists from this day
        if (day.checklists && day.checklists.length > 0) {
          day.checklists.forEach((checklist) => {
            if (checklist.items && checklist.items.length > 0) {
              checklist.items.forEach((item) => {
                allChecklists.push({
                  dayNumber: day.dayNumber,
                  dayDate: day.date,
                  checklistTitle: checklist.title,
                  item: item.title,
                  completed: item.completed,
                  id: item.id
                });
              });
            }
          });
        }
        
        // Extract notes from this day
        if (day.notes && day.notes.trim()) {
          allNotes.push({
            dayNumber: day.dayNumber,
            dayDate: day.date,
            content: day.notes,
            createdAt: day.date
          });
        }
      });
    }

    // Generate destination string
    const destination = locationNames.length > 0 
      ? locationNames.slice(0, 3).join(', ') + (locationNames.length > 3 ? ` +${locationNames.length - 3} more` : '')
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
      checklist: allChecklists,
      notes: allNotes,
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

/**
 * Toggle checklist item completion status
 * PATCH /my-trips/trip/:id/checklist/:itemId
 */
exports.toggleChecklistItem = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id: tripId, itemId } = req.params;
    const { completed } = req.body; // Optional: specify completed state, otherwise toggle

    console.log(`\n✏️ Toggle Checklist Item - Trip: ${tripId}, Item: ${itemId}, Completed: ${completed}`);

    // Find the itinerary
    const itinerary = await Itinerary.findOne({ _id: tripId, userId });

    if (!itinerary) {
      return res.status(404).json({
        success: false,
        message: 'Trip not found'
      });
    }

    // Find the checklist item in day plans
    let itemFound = false;
    let updatedItem = null;

    for (const dayPlan of itinerary.dayPlans) {
      if (dayPlan.checklists && dayPlan.checklists.length > 0) {
        for (const checklist of dayPlan.checklists) {
          if (checklist.items && checklist.items.length > 0) {
            const item = checklist.items.find(i => i.id === itemId);
            if (item) {
              // Toggle or set the completed status
              if (completed !== undefined) {
                item.completed = completed;
              } else {
                item.completed = !item.completed;
              }
              updatedItem = {
                id: item.id,
                title: item.title,
                completed: item.completed,
                dayNumber: dayPlan.dayNumber
              };
              itemFound = true;
              break;
            }
          }
        }
      }
      if (itemFound) break;
    }

    if (!itemFound) {
      return res.status(404).json({
        success: false,
        message: 'Checklist item not found'
      });
    }

    // Save the updated itinerary
    await itinerary.save();

    console.log(`✅ Checklist item updated:`, updatedItem);

    return res.status(200).json({
      success: true,
      message: 'Checklist item updated successfully',
      data: updatedItem
    });

  } catch (error) {
    console.error('❌ Error toggling checklist item:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update checklist item',
      error: error.message
    });
  }
};
