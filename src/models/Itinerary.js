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
  },
  // Store booking IDs for services booked through this itinerary
  bookingIds: {
    accommodations: [String], // Array of accommodation booking IDs
    transportation: [String],  // Array of transportation booking IDs
    guides: [String]          // Array of guide booking IDs
  }
}, {
  timestamps: true
});

// Method to calculate completion percentage
itinerarySchema.methods.calculateCompletionPercentage = function() {
  let totalSteps = 0;
  let completedSteps = 0;

  // Step 1: Basic trip information (always completed if itinerary exists)
  totalSteps += 4;
  if (this.tripName) completedSteps++;
  if (this.startDate) completedSteps++;
  if (this.endDate) completedSteps++;
  if (this.startLocation && this.endLocation) completedSteps++;

  // Step 2: Day plans created
  totalSteps += 1;
  if (this.dayPlans && this.dayPlans.length > 0) completedSteps++;

  // Step 3: Places added to day plans
  totalSteps += 1;
  const hasPlaces = this.dayPlans?.some(day => day.places && day.places.length > 0);
  if (hasPlaces) completedSteps++;

  // Step 4: Route selected
  totalSteps += 1;
  if (this.selectedRoute) completedSteps++;

  // Calculate percentage
  const percentage = Math.round((completedSteps / totalSteps) * 100);
  return percentage;
};

// Virtual field to get trip duration in days
itinerarySchema.virtual('tripDuration').get(function() {
  if (!this.startDate || !this.endDate) return 0;
  const diffTime = Math.abs(new Date(this.endDate) - new Date(this.startDate));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days
  return diffDays;
});

// Virtual field to get days until trip starts
itinerarySchema.virtual('daysUntilStart').get(function() {
  if (!this.startDate) return null;
  const now = new Date();
  const start = new Date(this.startDate);
  const diffTime = start - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// Ensure virtuals are included in JSON
itinerarySchema.set('toJSON', { virtuals: true });
itinerarySchema.set('toObject', { virtuals: true });

// Indexes for performance
itinerarySchema.index({ userId: 1, createdAt: -1 });
itinerarySchema.index({ status: 1 });
itinerarySchema.index({ startDate: 1 });

const Itinerary = mongoose.model('Itinerary', itinerarySchema);

module.exports = Itinerary;
