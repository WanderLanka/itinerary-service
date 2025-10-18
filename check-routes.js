// Quick script to check routes in database
const mongoose = require('mongoose');
require('dotenv').config();

const Route = require('./src/models/Route');
const Itinerary = require('./src/models/Itinerary');

async function checkRoutes() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/wanderlanka-itinerary');
    console.log('✅ Connected to MongoDB');

    // Get all itineraries
    const itineraries = await Itinerary.find().select('_id tripName startLocation endLocation').limit(5);
    console.log(`\n📋 Found ${itineraries.length} itineraries:`);
    itineraries.forEach((it, idx) => {
      console.log(`${idx + 1}. ${it.tripName} (ID: ${it._id})`);
      console.log(`   ${it.startLocation?.name || 'N/A'} → ${it.endLocation?.name || 'N/A'}`);
    });

    // Get all routes
    const routes = await Route.find().populate('itineraryId', 'tripName');
    console.log(`\n🗺️  Found ${routes.length} routes in database:`);
    
    if (routes.length === 0) {
      console.log('\n⚠️  No routes found! Routes collection is empty.');
      console.log('\n💡 To fix: Navigate to Route Display screen in the app to trigger route calculation.');
    } else {
      // Group by itinerary
      const grouped = {};
      routes.forEach(route => {
        const itinId = route.itineraryId?._id?.toString() || 'unknown';
        if (!grouped[itinId]) {
          grouped[itinId] = {
            tripName: route.itineraryId?.tripName || 'Unknown',
            routes: []
          };
        }
        grouped[itinId].routes.push(route);
      });

      Object.entries(grouped).forEach(([itinId, data]) => {
        console.log(`\n  📍 ${data.tripName} (${itinId}):`);
        data.routes.forEach(route => {
          console.log(`     ${route.routeType}: ${(route.totalDistance / 1000).toFixed(1)}km, ${(route.totalDuration / 60).toFixed(0)}min, LKR ${route.estimatedCosts?.total || 'N/A'}`);
        });
      });
    }

    // Close connection
    await mongoose.connection.close();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRoutes();
