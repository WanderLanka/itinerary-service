const Itinerary = require('../models/Itinerary');
const googlePlacesService = require('./googlePlaces.service');

class ItineraryGeneratorService {
  /**
   * Generate a complete itinerary with day-by-day plans
   * @param {object} data - Itinerary generation data
   * @returns {Promise<object>} Generated itinerary
   */
  async generateItinerary(data) {
    const {
      userId,
      tripName,
      startDate,
      endDate,
      startLocation,
      endLocation,
      destinations,
      preferences
    } = data;

    // Calculate trip duration
    const start = new Date(startDate);
    const end = new Date(endDate);
    const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Generate day plans
    const dayPlans = await this.generateDayPlans(
      start,
      durationDays,
      startLocation,
      endLocation,
      destinations,
      preferences
    );

    // Calculate total estimated costs
    const totalEstimatedCost = this.calculateTotalCosts(dayPlans, preferences);

    // Create itinerary
    const itinerary = new Itinerary({
      userId,
      tripName,
      startDate: start,
      endDate: end,
      startLocation,
      endLocation,
      destinations,
      preferences,
      dayPlans,
      totalEstimatedCost,
      status: 'draft'
    });

    await itinerary.save();
    console.log(`✅ Generated itinerary ${itinerary._id} for user ${userId}`);

    return itinerary;
  }

  /**
   * Generate day-by-day plans
   */
  async generateDayPlans(startDate, durationDays, startLocation, endLocation, destinations, preferences) {
    const dayPlans = [];
    const allLocations = [startLocation, ...destinations, endLocation];

    for (let day = 0; day < durationDays; day++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + day);

      // Determine which location(s) to visit on this day
      const locationsForDay = this.distributeLocationsAcrossDays(
        allLocations,
        durationDays,
        day
      );

      // Find attractions and activities for these locations
      const activities = await this.generateActivitiesForDay(
        locationsForDay,
        preferences,
        currentDate
      );

      // Generate accommodation suggestion
      const accommodation = this.generateAccommodationSuggestion(
        locationsForDay[locationsForDay.length - 1],
        preferences
      );

      // Generate meal suggestions
      const meals = this.generateMealSuggestions(preferences);

      dayPlans.push({
        dayNumber: day + 1,
        date: currentDate,
        places: locationsForDay,
        activities,
        accommodation,
        meals,
        notes: `Day ${day + 1} of your trip`
      });
    }

    return dayPlans;
  }

  /**
   * Distribute locations across days based on duration
   */
  distributeLocationsAcrossDays(locations, totalDays, currentDay) {
    const locationsPerDay = Math.max(1, Math.floor(locations.length / totalDays));
    const startIdx = currentDay * locationsPerDay;
    const endIdx = Math.min(startIdx + locationsPerDay, locations.length);
    
    return locations.slice(startIdx, endIdx);
  }

  /**
   * Generate activities for a day based on locations and preferences
   */
  async generateActivitiesForDay(locations, preferences, date) {
    const activities = [];
    const interests = preferences.interests || ['tourist_attraction', 'museum', 'park'];
    
    for (const location of locations) {
      try {
        // Search for attractions near this location
        const nearbyPlaces = await googlePlacesService.searchNearby(
          { latitude: location.latitude, longitude: location.longitude },
          5000, // 5km radius
          interests.slice(0, 3) // Limit to 3 types
        );

        // Take top 2-3 places based on rating
        const topPlaces = nearbyPlaces
          .filter(p => p.rating >= 4.0)
          .sort((a, b) => (b.rating || 0) - (a.rating || 0))
          .slice(0, preferences.travelStyle === 'packed' ? 3 : 2);

        topPlaces.forEach((place, idx) => {
          const startHour = 9 + (idx * 3); // Space activities 3 hours apart
          activities.push({
            placeId: place.id,
            placeName: place.displayName?.text || place.name,
            activity: `Visit ${place.displayName?.text || place.name}`,
            duration: preferences.travelStyle === 'relaxed' ? 120 : preferences.travelStyle === 'moderate' ? 90 : 60,
            estimatedCost: this.estimateActivityCost(place.types, preferences.budget),
            startTime: `${startHour}:00`,
            endTime: `${startHour + 2}:00`
          });
        });
      } catch (error) {
        console.error(`⚠️ Error finding activities for location:`, error.message);
      }
    }

    return activities;
  }

  /**
   * Generate accommodation suggestion
   */
  generateAccommodationSuggestion(location, preferences) {
    const costs = {
      budget: { hostel: 1500, guesthouse: 2500, hotel: 3500, resort: 5000 },
      moderate: { hostel: 2500, guesthouse: 4000, hotel: 6000, resort: 10000 },
      luxury: { hostel: 4000, guesthouse: 6000, hotel: 12000, resort: 25000 }
    };

    return {
      name: `${preferences.accommodation} near ${location.name}`,
      address: location.address || `Near ${location.name}`,
      checkIn: '14:00',
      checkOut: '11:00',
      estimatedCost: costs[preferences.budget][preferences.accommodation] || 5000
    };
  }

  /**
   * Generate meal suggestions
   */
  generateMealSuggestions(preferences) {
    const mealCosts = {
      budget: { breakfast: 500, lunch: 800, dinner: 1200 },
      moderate: { breakfast: 1000, lunch: 1500, dinner: 2500 },
      luxury: { breakfast: 2000, lunch: 3500, dinner: 6000 }
    };

    const costs = mealCosts[preferences.budget];

    return [
      { type: 'breakfast', restaurant: 'Local breakfast spot', estimatedCost: costs.breakfast, time: '08:00' },
      { type: 'lunch', restaurant: 'Local restaurant', estimatedCost: costs.lunch, time: '13:00' },
      { type: 'dinner', restaurant: 'Local dining', estimatedCost: costs.dinner, time: '19:00' }
    ];
  }

  /**
   * Estimate activity cost based on place type and budget
   */
  estimateActivityCost(types = [], budget) {
    const baseCosts = {
      budget: 500,
      moderate: 1500,
      luxury: 5000
    };

    let cost = baseCosts[budget] || 1500;

    // Adjust based on place type
    if (types.includes('museum')) cost += 500;
    if (types.includes('amusement_park')) cost += 2000;
    if (types.includes('zoo')) cost += 1000;
    if (types.includes('park')) cost = Math.max(200, cost - 500); // Parks are usually cheaper

    return cost;
  }

  /**
   * Calculate total estimated costs
   */
  calculateTotalCosts(dayPlans, preferences) {
    let accommodation = 0;
    let food = 0;
    let activities = 0;

    dayPlans.forEach(day => {
      if (day.accommodation) {
        accommodation += day.accommodation.estimatedCost || 0;
      }
      
      day.meals?.forEach(meal => {
        food += meal.estimatedCost || 0;
      });
      
      day.activities?.forEach(activity => {
        activities += activity.estimatedCost || 0;
      });
    });

    // Estimate transportation (rough estimate)
    const transportationCosts = {
      public: 1000,
      private: 5000,
      rental: 3000,
      mixed: 2000
    };
    const transportation = (transportationCosts[preferences.transportation] || 2000) * dayPlans.length;

    return {
      accommodation,
      food,
      activities,
      transportation,
      total: accommodation + food + activities + transportation
    };
  }

  /**
   * Update an existing itinerary
   */
  async updateItinerary(itineraryId, updates) {
    const itinerary = await Itinerary.findById(itineraryId);
    
    if (!itinerary) {
      throw new Error('Itinerary not found');
    }

    Object.assign(itinerary, updates);
    await itinerary.save();

    return itinerary;
  }

  /**
   * Get itinerary by ID
   */
  async getItinerary(itineraryId) {
    const itinerary = await Itinerary.findById(itineraryId);
    
    if (!itinerary) {
      throw new Error('Itinerary not found');
    }

    return itinerary;
  }

  /**
   * Get all itineraries for a user
   */
  async getUserItineraries(userId, status = null) {
    const query = { userId };
    if (status) {
      query.status = status;
    }

    return await Itinerary.find(query).sort({ createdAt: -1 });
  }

  /**
   * Delete itinerary
   */
  async deleteItinerary(itineraryId, userId) {
    const result = await Itinerary.findOneAndDelete({ _id: itineraryId, userId });
    
    if (!result) {
      throw new Error('Itinerary not found or unauthorized');
    }

    return { success: true, message: 'Itinerary deleted successfully' };
  }
}

module.exports = new ItineraryGeneratorService();
