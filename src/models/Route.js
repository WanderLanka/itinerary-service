const mongoose = require('mongoose');

const waypointSchema = new mongoose.Schema({
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  placeId: String,
  name: String,
  order: { type: Number, required: true },
  arrivalTime: String,
  departureTime: String,
  duration: Number // minutes spent at this waypoint
});

const routeSegmentSchema = new mongoose.Schema({
  startPoint: {
    latitude: Number,
    longitude: Number,
    name: String
  },
  endPoint: {
    latitude: Number,
    longitude: Number,
    name: String
  },
  distance: Number, // in meters
  duration: Number, // in seconds
  polyline: String, // encoded polyline for map display
  steps: [{
    instruction: String,
    distance: Number,
    duration: Number,
    startLocation: {
      latitude: Number,
      longitude: Number
    },
    endLocation: {
      latitude: Number,
      longitude: Number
    }
  }]
});

const routeSchema = new mongoose.Schema({
  itineraryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Itinerary',
    required: true,
    index: true
  },
  routeType: {
    type: String,
    enum: ['recommended', 'shortest', 'scenic'],
    required: true
  },
  totalDistance: {
    type: Number,
    required: true // in meters
  },
  totalDuration: {
    type: Number,
    required: true // in seconds
  },
  waypoints: [waypointSchema],
  segments: [routeSegmentSchema],
  overview: {
    bounds: {
      northeast: { latitude: Number, longitude: Number },
      southwest: { latitude: Number, longitude: Number }
    },
    polyline: String, // encoded polyline for entire route
    summary: String
  },
  attractionsAlongRoute: [{
    placeId: String,
    name: String,
    location: {
      latitude: Number,
      longitude: Number
    },
    types: [String],
    rating: Number,
    distanceFromRoute: Number, // in meters
    detourTime: Number // additional time in seconds if visiting this place
  }],
  estimatedCosts: {
    fuel: Number,
    tolls: Number,
    parking: Number,
    total: Number
  },
  score: {
    type: Number,
    default: 0 // Used for route ranking (higher is better)
  },
  metadata: {
    calculatedAt: { type: Date, default: Date.now },
    googleMapsUrl: String
  }
}, {
  timestamps: true
});

// Indexes
routeSchema.index({ itineraryId: 1, routeType: 1 });
routeSchema.index({ score: -1 });

// Method to calculate route score based on type
routeSchema.methods.calculateScore = function() {
  switch(this.routeType) {
    case 'shortest':
      // Score based on minimizing distance
      this.score = 1000000 / (this.totalDistance + 1);
      break;
    case 'recommended':
      // Balanced score: consider distance, duration, and attractions
      const distanceScore = 500000 / (this.totalDistance + 1);
      const durationScore = 500000 / (this.totalDuration + 1);
      const attractionScore = this.attractionsAlongRoute.length * 100;
      this.score = distanceScore * 0.3 + durationScore * 0.3 + attractionScore * 0.4;
      break;
    case 'scenic':
      // Score based on maximizing attractions and scenic points
      const attractionCount = this.attractionsAlongRoute.length;
      const avgRating = this.attractionsAlongRoute.reduce((sum, a) => sum + (a.rating || 0), 0) / (attractionCount || 1);
      this.score = attractionCount * 200 + avgRating * 100;
      break;
    default:
      this.score = 0;
  }
  return this.score;
};

const Route = mongoose.model('Route', routeSchema);

module.exports = Route;
