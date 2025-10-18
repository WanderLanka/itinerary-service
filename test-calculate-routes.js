const axios = require('axios');

// Test calculate routes endpoint
async function testCalculateRoutes() {
  const itineraryId = '68f364264900ec848b1beb3d'; // Panadura to Kandy
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2N2ZlNzhmMTczNjU4ZTRjZGQ3NzBmZmMiLCJlbWFpbCI6InJhdmlkdXBlcmVpcmE2NkBnbWFpbC5jb20iLCJpYXQiOjE3MzY2MDMxMDB9.bFT1EDuS7GIvQGp7tQnKBzfnMBDhQiSIlbgOEH82AYU'; // Use a valid token

  console.log('\n🧪 Testing Calculate Routes Endpoint');
  console.log('📍 Itinerary ID:', itineraryId);
  console.log('🔑 Using token:', token.substring(0, 20) + '...');

  try {
    const response = await axios.post(
      `http://localhost:3008/routes/calculate/${itineraryId}`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('\n✅ SUCCESS!');
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('\n❌ ERROR!');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  }
}

testCalculateRoutes();
