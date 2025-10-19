const axios = require('axios');

class GoogleDirectionsService {
  constructor() {
    this.apiKey = process.env.GOOGLE_DIRECTIONS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/directions/json';
  }

  /**
   * Calculate route between waypoints
   * @param {Array<object>} waypoints - Array of {latitude, longitude} objects
   * @param {string} mode - Travel mode (driving, walking, bicycling, transit)
   * @param {boolean} optimize - Whether to optimize waypoint order
   * @returns {Promise<object>} Route data
   */
  async calculateRoute(waypoints, mode = 'driving', optimize = false) {
    try {
      if (waypoints.length < 2) {
        throw new Error('At least 2 waypoints required (origin and destination)');
      }

      const origin = `${waypoints[0].latitude},${waypoints[0].longitude}`;
      const destination = `${waypoints[waypoints.length - 1].latitude},${waypoints[waypoints.length - 1].longitude}`;

      const params = {
        origin,
        destination,
        key: this.apiKey,
        mode,
        alternatives: true, // Get alternative routes
        departure_time: 'now',
        traffic_model: 'best_guess'
      };

      // Add intermediate waypoints if any
      if (waypoints.length > 2) {
        const intermediateWaypoints = waypoints.slice(1, -1)
          .map(wp => `${wp.latitude},${wp.longitude}`)
          .join('|');
        params.waypoints = optimize ? `optimize:true|${intermediateWaypoints}` : intermediateWaypoints;
        console.log(`🗺️  Including ${waypoints.length - 2} intermediate waypoints in request`);
        console.log(`   Waypoints param: ${params.waypoints.substring(0, 100)}...`);
      } else {
        console.log('⚠️  No intermediate waypoints (direct route from start to end)');
      }

      console.log('📡 Calling Google Directions API...');
      console.log(`   Origin: ${origin}`);
      console.log(`   Destination: ${destination}`);
      const response = await axios.get(this.baseUrl, { params });

      if (response.data.status !== 'OK') {
        throw new Error(`Directions API error: ${response.data.status} - ${response.data.error_message || ''}`);
      }

      return this.parseDirectionsResponse(response.data);
    } catch (error) {
      console.error('❌ Google Directions Error:', error.response?.data || error.message);
      throw new Error(`Failed to calculate route: ${error.message}`);
    }
  }

  /**
   * Calculate multiple route alternatives with different optimization strategies
   * @param {Array<object>} waypoints - Array of waypoints
   * @returns {Promise<object>} Object containing recommended, shortest, and scenic routes
   */
  async calculateAllRouteTypes(waypoints) {
    try {
      const results = {};

      // 1. Shortest route (optimized for distance)
      const shortestRoute = await this.calculateRoute(waypoints, 'driving', true);
      results.shortest = {
        type: 'shortest',
        ...shortestRoute,
        score: this.calculateShortestScore(shortestRoute)
      };

      // 2. Recommended route (balanced)
      const recommendedRoute = await this.calculateRoute(waypoints, 'driving', false);
      results.recommended = {
        type: 'recommended',
        ...recommendedRoute,
        score: this.calculateRecommendedScore(recommendedRoute)
      };

      // 3. Scenic route (we'll get alternatives and pick the one with most potential attractions)
      // For now, we'll use the recommended route as scenic and enhance it with nearby attractions
      results.scenic = {
        type: 'scenic',
        ...recommendedRoute,
        score: this.calculateScenicScore(recommendedRoute)
      };

      return results;
    } catch (error) {
      console.error('❌ Calculate All Routes Error:', error);
      throw error;
    }
  }

  /**
   * Parse Google Directions API response
   */
  parseDirectionsResponse(data) {
    const route = data.routes[0]; // Use first route
    
    console.log(`📊 Parsing route with ${route.legs.length} legs`);
    route.legs.forEach((leg, idx) => {
      console.log(`   Leg ${idx + 1}: ${leg.start_address} → ${leg.end_address}`);
      console.log(`     Distance: ${(leg.distance.value / 1000).toFixed(1)}km, Duration: ${(leg.duration.value / 60).toFixed(0)}min`);
    });

    const segments = route.legs.map(leg => ({
      startPoint: {
        latitude: leg.start_location.lat,
        longitude: leg.start_location.lng,
        name: leg.start_address
      },
      endPoint: {
        latitude: leg.end_location.lat,
        longitude: leg.end_location.lng,
        name: leg.end_address
      },
      distance: leg.distance.value, // meters
      duration: leg.duration.value, // seconds
      polyline: leg.steps.map(step => step.polyline.points).join(''),
      steps: leg.steps.map(step => ({
        instruction: step.html_instructions.replace(/<[^>]*>/g, ''), // Remove HTML tags
        distance: step.distance.value,
        duration: step.duration.value,
        startLocation: {
          latitude: step.start_location.lat,
          longitude: step.start_location.lng
        },
        endLocation: {
          latitude: step.end_location.lat,
          longitude: step.end_location.lng
        }
      }))
    }));

    const result = {
      totalDistance: route.legs.reduce((sum, leg) => sum + leg.distance.value, 0),
      totalDuration: route.legs.reduce((sum, leg) => sum + leg.duration.value, 0),
      segments,
      overview: {
        bounds: route.bounds,
        polyline: route.overview_polyline.points,
        summary: route.summary
      }
    };
    
    console.log(`✅ Route parsed: ${(result.totalDistance / 1000).toFixed(1)}km, ${(result.totalDuration / 60).toFixed(0)}min`);
    console.log(`   Overview polyline length: ${route.overview_polyline.points.length} chars`);
    
    return result;
  }

  /**
   * Calculate score for shortest route (minimize distance)
   */
  calculateShortestScore(route) {
    return 1000000 / (route.totalDistance + 1);
  }

  /**
   * Calculate score for recommended route (balanced)
   */
  calculateRecommendedScore(route) {
    const distanceScore = 500000 / (route.totalDistance + 1);
    const durationScore = 500000 / (route.totalDuration + 1);
    return distanceScore * 0.5 + durationScore * 0.5;
  }

  /**
   * Calculate score for scenic route (maximize attractions potential)
   */
  calculateScenicScore(route) {
    // Base score - lower is better for scenic routes as we want longer, more interesting routes
    const lengthBonus = Math.min(route.totalDistance / 10000, 100); // Bonus for longer routes
    return lengthBonus;
  }

  /**
   * Calculate distance matrix between multiple points
   * @param {Array<object>} origins - Array of origin points
   * @param {Array<object>} destinations - Array of destination points
   * @returns {Promise<object>} Distance matrix data
   */
  async calculateDistanceMatrix(origins, destinations) {
    try {
      const originsStr = origins.map(o => `${o.latitude},${o.longitude}`).join('|');
      const destinationsStr = destinations.map(d => `${d.latitude},${d.longitude}`).join('|');

      const response = await axios.get(
        'https://maps.googleapis.com/maps/api/distancematrix/json',
        {
          params: {
            origins: originsStr,
            destinations: destinationsStr,
            key: this.apiKey,
            mode: 'driving'
          }
        }
      );

      if (response.data.status !== 'OK') {
        throw new Error(`Distance Matrix API error: ${response.data.status}`);
      }

      return response.data;
    } catch (error) {
      console.error('❌ Distance Matrix Error:', error.response?.data || error.message);
      throw new Error(`Failed to calculate distance matrix: ${error.message}`);
    }
  }
}

module.exports = new GoogleDirectionsService();
