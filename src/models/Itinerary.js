const mongoose = require('mongoose');

const placeSchema = new mongoose.Schema({
  placeId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  address: String,
  types: [String],
  rating: Number,
  photos: [String],
  description: String
});

const dayPlanSchema = new mongoose.Schema({
  dayNumber: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  places: [placeSchema],
  activities: [{
    placeId: String,
    placeName: String,
    activity: String,
    duration: Number, // in minutes
    estimatedCost: Number,
    startTime: String,
    endTime: String
  }],
  accommodation: {
    name: String,
    address: String,
    checkIn: String,
    checkOut: String,
    estimatedCost: Number
  },
  meals: [{
    type: { type: String, enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
    restaurant: String,
    estimatedCost: Number,
    time: String
  }],
  checklists: [{
    id: String,
    title: String,
    items: [{
      id: String,
      title: String,
      completed: { type: Boolean, default: false }
    }]
  }],
  notes: String
});

const itinerarySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  tripName: {
    type: String,
    required: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  startLocation: {
    name: { type: String, required: true },
    placeId: String,
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  endLocation: {
    name: { type: String, required: true },
    placeId: String,
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  destinations: [{
    placeId: String,
    name: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    arrivalDate: Date,
    departureDate: Date,
    duration: Number // days
  }],
  preferences: {
    travelStyle: {
      type: String,
      enum: ['relaxed', 'moderate', 'packed'],
      default: 'moderate'
    },
    interests: [String], // e.g., ['culture', 'nature', 'food', 'adventure']
    budget: {
      type: String,
      enum: ['budget', 'moderate', 'luxury'],
      default: 'moderate'
    },
    accommodation: {
      type: String,
      enum: ['hostel', 'hotel', 'resort', 'guesthouse'],
      default: 'hotel'
    },
    transportation: {
      type: String,
      enum: ['public', 'private', 'rental', 'mixed'],
      default: 'mixed'
    }
  },
  dayPlans: [dayPlanSchema],
  selectedRoute: {
    type: String,
    enum: ['recommended', 'shortest', 'scenic'],
    required: false // Make it optional instead of default: null
  },
  totalEstimatedCost: {
    accommodation: { type: Number, default: 0 },
    food: { type: Number, default: 0 },
    activities: { type: Number, default: 0 },
    transportation: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['draft', 'planned', 'active', 'completed', 'cancelled'],
    default: 'draft'
  },
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for performance
itinerarySchema.index({ userId: 1, createdAt: -1 });
itinerarySchema.index({ status: 1 });
itinerarySchema.index({ startDate: 1 });

const Itinerary = mongoose.model('Itinerary', itinerarySchema);

module.exports = Itinerary;
