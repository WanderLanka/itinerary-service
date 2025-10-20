const itineraryGeneratorService = require('../services/itineraryGenerator.service');
const googlePlacesService = require('../services/googlePlaces.service');
const Itinerary = require('../models/Itinerary');
const axios = require('axios');

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

/**
 * Create individual bookings by sending booking details to booking service
 */
const createIndividualBookings = async (planningBookings, userId, itineraryId, authToken) => {
  const bookingResults = [];
  
  console.log('\n🔧 [BOOKING] createIndividualBookings Function Called:');
  console.log('👤 User ID:', userId);
  console.log('🆔 Itinerary ID:', itineraryId);
  console.log('🔐 Auth Token Present:', !!authToken);
  console.log('📦 Planning Bookings:', JSON.stringify(planningBookings, null, 2));
  
  try {
    // Process accommodations
    if (planningBookings.accommodations && planningBookings.accommodations.length > 0) {
      console.log(`🏨 [BOOKING] Processing ${planningBookings.accommodations.length} accommodations`);
      for (const accommodation of planningBookings.accommodations) {
        console.log('🏨 [BOOKING] Processing accommodation:', accommodation.name);
        try {
          // Calculate nights for accommodation
          const checkInDate = new Date(accommodation.checkIn);
          const checkOutDate = new Date(accommodation.checkOut);
          const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));

          const bookingData = {
            userId: userId,
            serviceType: 'accommodation',
            serviceId: accommodation.serviceId,
            serviceName: accommodation.name,
            serviceProvider: accommodation.provider || 'Property Owner',
            totalAmount: parseFloat(accommodation.totalPrice) || 0,
            bookingDetails: {
              checkInDate: checkInDate,
              checkOutDate: checkOutDate,
              adults: parseInt(accommodation.adults) || 1,
              children: parseInt(accommodation.children) || 0,
              rooms: parseInt(accommodation.rooms) || 1,
              nights: nights || 1,
              name: accommodation.name,
              location: accommodation.location,
              description: accommodation.description || '',
              amenities: accommodation.amenities || [],
              rating: accommodation.rating || 0,
              reviews: accommodation.reviews || [],
              policies: accommodation.policies || {},
              availability: accommodation.availability || {}
            },
            paymentDetails: {
              cardNumber: '****-****-****-****',
              expiryDate: '12/25',
              cvv: '***',
              cardholderName: 'Trip Planning User'
            },
            contactInfo: {
              email: 'user@example.com',
              phone: '+1234567890'
            }
          };

          console.log('🏨 [BOOKING] Sending accommodation booking data:', JSON.stringify(bookingData, null, 2));
          
          const response = await axios.post('http://localhost:3009/enhanced', bookingData, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            timeout: 10000
          });
          
          console.log('🏨 [BOOKING] Accommodation booking response:', response.data);

          if (response.data.success) {
            bookingResults.push({
              type: 'accommodation',
              bookingId: response.data.data.bookingId,
              serviceId: accommodation.serviceId,
              name: accommodation.name
            });
            console.log(`✅ [ITINERARY] Created accommodation booking: ${accommodation.name}`);
          }
        } catch (error) {
          console.error(`❌ [ITINERARY] Failed to create accommodation booking for ${accommodation.name}:`, error.message);
        }
      }
    }

    // Process transportation
    if (planningBookings.transportation && planningBookings.transportation.length > 0) {
      console.log(`🚗 [BOOKING] Processing ${planningBookings.transportation.length} transportation bookings`);
      for (const transport of planningBookings.transportation) {
        console.log('🚗 [BOOKING] Processing transportation:', transport.name);
        try {
          const bookingData = {
            userId: userId,
            serviceType: 'transportation',
            serviceId: transport.serviceId,
            serviceName: transport.name,
            serviceProvider: transport.provider || 'Vehicle Owner',
            totalAmount: parseFloat(transport.totalPrice) || 0,
            bookingDetails: {
              startDate: new Date(transport.startDate),
              days: parseInt(transport.days) || 1,
              passengers: parseInt(transport.passengers) || 1,
              pickupLocation: transport.pickupLocation,
              dropoffLocation: transport.dropoffLocation,
              estimatedDistance: parseFloat(transport.estimatedDistance) || 0,
              name: transport.name,
              location: transport.location,
              description: transport.description || '',
              features: transport.features || [],
              rating: transport.rating || 0,
              reviews: transport.reviews || [],
              policies: transport.policies || {},
              availability: transport.availability || {},
              vehicleType: transport.vehicleType || '',
              fuelType: transport.fuelType || '',
              transmission: transport.transmission || '',
              seatingCapacity: parseInt(transport.seatingCapacity) || 0
            },
            paymentDetails: {
              cardNumber: '****-****-****-****',
              expiryDate: '12/25',
              cvv: '***',
              cardholderName: 'Trip Planning User'
            },
            contactInfo: {
              email: 'user@example.com',
              phone: '+1234567890'
            }
          };

          const response = await axios.post('http://localhost:3009/enhanced', bookingData, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            timeout: 10000
          });

          if (response.data.success) {
            bookingResults.push({
              type: 'transportation',
              bookingId: response.data.data.bookingId,
              serviceId: transport.serviceId,
              name: transport.name
            });
            console.log(`✅ [ITINERARY] Created transportation booking: ${transport.name}`);
          }
        } catch (error) {
          console.error(`❌ [ITINERARY] Failed to create transportation booking for ${transport.name}:`, error.message);
        }
      }
    }

    // Process guides
    if (planningBookings.guides && planningBookings.guides.length > 0) {
      console.log(`👨‍🏫 [BOOKING] Processing ${planningBookings.guides.length} guide bookings`);
      for (const guide of planningBookings.guides) {
        console.log('👨‍🏫 [BOOKING] Processing guide:', guide.name);
        try {
          const bookingData = {
            userId: userId,
            serviceType: 'guide',
            serviceId: guide.serviceId,
            serviceName: guide.name,
            serviceProvider: guide.provider || 'Tour Guide',
            totalAmount: parseFloat(guide.totalPrice) || 0,
            bookingDetails: {
              tourDate: new Date(guide.tourDate),
              duration: guide.duration || '1 day', // Duration should be string according to model
              groupSize: parseInt(guide.groupSize) || 1,
              name: guide.name,
              location: guide.location,
              description: guide.description || '',
              experience: parseInt(guide.experience) || 0,
              rating: guide.rating || 0,
              reviews: guide.reviews || [],
              policies: guide.policies || {},
              availability: guide.availability || {},
              specialties: guide.specialties || [],
              languages: guide.languages || [],
              certifications: guide.certifications || []
            },
            paymentDetails: {
              cardNumber: '****-****-****-****',
              expiryDate: '12/25',
              cvv: '***',
              cardholderName: 'Trip Planning User'
            },
            contactInfo: {
              email: 'user@example.com',
              phone: '+1234567890'
            }
          };

          const response = await axios.post('http://localhost:3009/enhanced', bookingData, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            timeout: 10000
          });

          if (response.data.success) {
            bookingResults.push({
              type: 'guide',
              bookingId: response.data.data.bookingId,
              serviceId: guide.serviceId,
              name: guide.name
            });
            console.log(`✅ [ITINERARY] Created guide booking: ${guide.name}`);
          }
        } catch (error) {
          console.error(`❌ [ITINERARY] Failed to create guide booking for ${guide.name}:`, error.message);
        }
      }
    }

    return bookingResults;
  } catch (error) {
    console.error('❌ [ITINERARY] Error in createIndividualBookings:', error);
    throw error;
  }
};

/**
 * Store completed trip data from payment process
 */
exports.storeCompletedTrip = async (req, res) => {
  try {
    console.log('\n🎯 [ITINERARY] Store Completed Trip Request');
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
    console.log('🔐 Auth User:', req.user);
    console.log('📋 Request Headers:', req.headers);
    console.log('🌐 Request Method:', req.method);
    console.log('🔗 Request URL:', req.url);
    
    const userId = req.user?.id || req.user?.userId;
    
    if (!userId) {
      console.log('❌ [ITINERARY] No user ID found');
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }

    const {
      tripData,
      planningBookings,
      dayPlaces,
      dayNotes,
      dayChecklists,
      totalAmount,
      paymentData
    } = req.body;
    
    console.log('\n📊 [ITINERARY] Extracted Data Analysis:');
    console.log('🏖️ Trip Data:', JSON.stringify(tripData, null, 2));
    console.log('📋 Planning Bookings:', JSON.stringify(planningBookings, null, 2));
    console.log('📍 Day Places:', JSON.stringify(dayPlaces, null, 2));
    console.log('📝 Day Notes:', JSON.stringify(dayNotes, null, 2));
    console.log('✅ Day Checklists:', JSON.stringify(dayChecklists, null, 2));
    console.log('💰 Total Amount:', totalAmount);
    console.log('💳 Payment Data:', JSON.stringify(paymentData, null, 2));

    // Validation
    if (!tripData || !tripData.startDate || !tripData.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required trip data'
      });
    }

    console.log('✅ [ITINERARY] User ID:', userId);
    console.log('📅 Trip Dates:', tripData.startDate, 'to', tripData.endDate);
    console.log('💰 Total Amount:', totalAmount);

    // Calculate trip duration
    const start = new Date(tripData.startDate);
    const end = new Date(tripData.endDate);
    const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Create day plans from the trip data
    const dayPlans = [];
    for (let day = 0; day < durationDays; day++) {
      const currentDate = new Date(start);
      currentDate.setDate(currentDate.getDate() + day);
      const dayNum = day + 1;
      
      // Get bookings for this day
      const dayBookings = {
        accommodations: [],
        transportation: [],
        guides: [],
        destinations: []
      };

      // Process planning bookings
      if (planningBookings) {
        Object.entries(planningBookings).forEach(([type, bookings]) => {
          if (Array.isArray(bookings)) {
            bookings.forEach(booking => {
              if (booking.selectedDate) {
                try {
                  const bookingDate = new Date(booking.selectedDate).toISOString().split('T')[0];
                  const currentDateStr = currentDate.toISOString().split('T')[0];
                  if (bookingDate === currentDateStr) {
                    dayBookings[type] = dayBookings[type] || [];
                    dayBookings[type].push(booking);
                  }
                } catch (error) {
                  console.warn('Error parsing booking date:', booking.selectedDate, error);
                }
              }
            });
          }
        });
      }

      // Create day plan
      const dayPlan = {
        dayNumber: dayNum,
        date: currentDate,
        places: dayPlaces && dayPlaces[dayNum] ? dayPlaces[dayNum].map(place => ({
          placeId: place.placeId || place.id || `place_${Date.now()}_${Math.random()}`,
          name: place.name,
          location: {
            latitude: place.latitude || place.location?.latitude || 0,
            longitude: place.longitude || place.location?.longitude || 0
          },
          address: place.address,
          types: place.types || ['tourist_attraction'],
          rating: place.rating,
          photos: place.photos || [],
          description: place.description
        })) : [],
        activities: [],
        accommodation: dayBookings.accommodations && dayBookings.accommodations.length > 0 ? {
          name: dayBookings.accommodations[0].name,
          address: dayBookings.accommodations[0].location,
          checkIn: dayBookings.accommodations[0].checkIn,
          checkOut: dayBookings.accommodations[0].checkOut,
          estimatedCost: dayBookings.accommodations[0].totalPrice || dayBookings.accommodations[0].price
        } : null,
        meals: [],
        checklists: dayChecklists && dayChecklists[dayNum] ? dayChecklists[dayNum].map(checklist => ({
          id: checklist.id || `checklist_${Date.now()}_${Math.random()}`,
          title: checklist.title,
          items: checklist.items.map(item => ({
            id: item.id || `item_${Date.now()}_${Math.random()}`,
            title: item.title,
            completed: item.completed || false
          }))
        })) : [],
        notes: dayNotes && dayNotes[dayNum] && dayNotes[dayNum].length > 0 
          ? dayNotes[dayNum].map(note => note.content).join('\n')
          : ''
      };

      dayPlans.push(dayPlan);
    }

    // Calculate total estimated costs
    let totalAccommodation = 0;
    let totalTransportation = 0;
    let totalActivities = 0;

    if (planningBookings) {
      Object.entries(planningBookings).forEach(([type, bookings]) => {
        if (Array.isArray(bookings)) {
          bookings.forEach(booking => {
            const cost = booking.totalPrice || booking.price || booking.cost || 0;
            switch (type) {
              case 'accommodations':
                totalAccommodation += cost;
                break;
              case 'transportation':
                totalTransportation += cost;
                break;
              case 'guides':
              case 'destinations':
                totalActivities += cost;
                break;
            }
          });
        }
      });
    }

    // Create itinerary with completed trip data
    console.log('\n🏗️ [ITINERARY] Creating Itinerary Object:');
    console.log('👤 User ID:', userId);
    console.log('🏖️ Trip Name:', tripData.tripName || `${tripData.destination || 'Trip'} - ${new Date().toLocaleDateString()}`);
    console.log('🌍 Destination:', tripData.destination || 'Starting Point');
    console.log('📅 Start Date:', start);
    console.log('📅 End Date:', end);
    console.log('📋 Day Plans Count:', dayPlans.length);
    console.log('💵 Total Costs:', {
      accommodation: totalAccommodation,
      transportation: totalTransportation,
      activities: totalActivities,
      total: totalAmount || (totalAccommodation + totalTransportation + totalActivities)
    });
    
    const itinerary = new Itinerary({
      userId,
      tripName: tripData.tripName || `${tripData.destination || 'Trip'} - ${new Date().toLocaleDateString()}`,
      startDate: start,
      endDate: end,
      startLocation: {
        name: tripData.destination || 'Starting Point',
        placeId: 'start_location',
        latitude: 7.8731, // Default to Sri Lanka coordinates
        longitude: 80.7718
      },
      endLocation: {
        name: tripData.destination || 'Ending Point',
        placeId: 'end_location',
        latitude: 7.8731,
        longitude: 80.7718
      },
      destinations: [],
      preferences: {
        travelStyle: 'moderate',
        interests: ['tourist_attraction', 'culture', 'nature'],
        budget: 'moderate',
        accommodation: 'hotel',
        transportation: 'mixed'
      },
      dayPlans,
      totalEstimatedCost: {
        accommodation: totalAccommodation,
        food: 0,
        activities: totalActivities,
        transportation: totalTransportation,
        total: totalAmount || (totalAccommodation + totalTransportation + totalActivities)
      },
      status: 'completed',
      isPublic: false
    });

    console.log('\n💾 [ITINERARY] Saving to Database:');
    console.log('📦 Itinerary Object:', JSON.stringify(itinerary, null, 2));
    
    await itinerary.save();
    
    console.log(`✅ [ITINERARY] Successfully saved to database!`);
    console.log(`🆔 Itinerary ID: ${itinerary._id}`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`📊 Day plans: ${dayPlans.length}`);
    console.log(`💰 Total cost: $${itinerary.totalEstimatedCost.total}`);
    console.log(`📅 Trip dates: ${start.toDateString()} to ${end.toDateString()}`);

    // After successful itinerary save, create individual bookings
    console.log('\n📋 [ITINERARY] Starting Individual Booking Creation:');
    console.log('📦 Planning Bookings Data:', JSON.stringify(planningBookings, null, 2));
    console.log('🆔 Itinerary ID:', itinerary._id);
    console.log('👤 User ID:', userId);
    
    let bookingResults = [];
    try {
      const authToken = req.headers.authorization?.split(' ')[1] || '';
      console.log('🔐 Auth Token Present:', !!authToken);
      
      bookingResults = await createIndividualBookings(planningBookings, userId, itinerary._id, authToken);
      console.log(`✅ [ITINERARY] Successfully created ${bookingResults.length} individual bookings`);
      console.log('📋 Booking Results:', JSON.stringify(bookingResults, null, 2));
      
      // Update itinerary with booking IDs
      if (bookingResults.length > 0) {
        console.log('\n🔄 [ITINERARY] Updating itinerary with booking IDs...');
        
        const bookingIds = {
          accommodations: [],
          transportation: [],
          guides: []
        };
        
        // Categorize booking IDs by type
        bookingResults.forEach(result => {
          if (result.type === 'accommodation') {
            bookingIds.accommodations.push(result.bookingId);
          } else if (result.type === 'transportation') {
            bookingIds.transportation.push(result.bookingId);
          } else if (result.type === 'guide') {
            bookingIds.guides.push(result.bookingId);
          }
        });
        
        console.log('📋 [ITINERARY] Booking IDs to update:', JSON.stringify(bookingIds, null, 2));
        
        // Update the itinerary with booking IDs
        itinerary.bookingIds = bookingIds;
        await itinerary.save();
        
        console.log('✅ [ITINERARY] Successfully updated itinerary with booking IDs');
        console.log('🏨 Accommodation bookings:', bookingIds.accommodations.length);
        console.log('🚗 Transportation bookings:', bookingIds.transportation.length);
        console.log('👨‍🏫 Guide bookings:', bookingIds.guides.length);
      }
    } catch (bookingError) {
      console.error('⚠️ [ITINERARY] Failed to create individual bookings:', bookingError.message);
      console.error('📋 Booking Error Stack:', bookingError.stack);
      // Don't fail the main request if booking creation fails
    }

    res.status(201).json({
      success: true,
      message: 'Trip data stored successfully in itinerary database',
      data: {
        itineraryId: itinerary._id,
        tripName: itinerary.tripName,
        totalCost: itinerary.totalEstimatedCost.total,
        dayPlans: itinerary.dayPlans.length,
        status: itinerary.status,
        bookingIds: itinerary.bookingIds || {
          accommodations: [],
          transportation: [],
          guides: []
        },
        bookingsCreated: bookingResults.length
      }
    });
  } catch (error) {
    console.error('❌ [ITINERARY] Store Completed Trip Error:', error);
    console.error('Error Stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to store trip data in itinerary database',
      error: error.message
    });
  }
};