require('dotenv').config();
const mongoose = require('mongoose');
const Itinerary = require('./src/models/Itinerary');
const Route = require('./src/models/Route');
const routeController = require('./src/controllers/route.controller');

async function testDirectCalculate() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wanderlanka-itinerary');
    console.log('✅ Connected to MongoDB\n');

    // Test with an existing itinerary
    const itineraryId = '68f364264900ec848b1beb3d'; // Panadura to Kandy
    
    console.log('📋 Fetching itinerary:', itineraryId);
    const itinerary = await Itinerary.findById(itineraryId).populate('dayPlans');
    
    if (!itinerary) {
      console.log('❌ Itinerary not found!');
      process.exit(1);
    }
    
    console.log('✅ Itinerary found:', itinerary.tripName);
    console.log('📍 Start:', itinerary.startLocation.name);
    console.log('📍 End:', itinerary.endLocation.name);
    console.log('📅 Start Date:', itinerary.startDate);
    console.log('📅 End Date:', itinerary.endDate);
    console.log('🏛️  Day Plans:', itinerary.dayPlans.length);
    
    // Check if Google API key is configured
    console.log('\n🔑 Google API Key configured:', process.env.GOOGLE_MAPS_DIRECTIONS_API_KEY ? 'Yes' : 'No');
    
    // Mock request and response objects
    const mockReq = {
      params: { itineraryId },
      user: { userId: '67fe78f173658e4cdd770ffc' }, // Mock user
      headers: {}
    };
    
    const mockRes = {
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      json: function(data) {
        console.log('\n📦 Response Status:', this.statusCode || 200);
        console.log('📦 Response Data:', JSON.stringify(data, null, 2));
      }
    };
    
    console.log('\n🚀 Calling calculateRoutes...\n');
    console.log('='.repeat(80));
    
    await routeController.calculateRoutes(mockReq, mockRes);
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Test completed!\n');
    
    // Check routes in database
    console.log('🔍 Checking routes in database...');
    const routes = await Route.find({ itineraryId });
    console.log(`📍 Found ${routes.length} routes for this itinerary:`);
    routes.forEach(route => {
      console.log(`  - ${route.routeType}: ${route.totalDistance}km, ${route.totalDuration}min, Score: ${route.score}`);
    });
    
  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

testDirectCalculate();
