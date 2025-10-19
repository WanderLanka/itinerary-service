/**
 * Seed script to add sample checklist and notes to existing itineraries
 * Run this to test the new checklist and notes features
 */

const mongoose = require('mongoose');
const Itinerary = require('./src/models/Itinerary');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wanderlanka';

const sampleChecklists = [
  { item: 'Book accommodation', completed: true, createdAt: new Date('2024-01-15') },
  { item: 'Pack sunscreen and hat', completed: true, createdAt: new Date('2024-01-16') },
  { item: 'Confirm transportation', completed: false, createdAt: new Date('2024-01-17') },
  { item: 'Download offline maps', completed: false, createdAt: new Date('2024-01-18') },
  { item: 'Print travel documents', completed: false, createdAt: new Date('2024-01-19') },
];

const sampleNotes = [
  { 
    title: 'Travel Tips',
    content: 'Remember to bring mosquito repellent for evening activities. The weather can be humid in coastal areas.',
    createdAt: new Date('2024-01-20')
  },
  { 
    title: 'Restaurant Recommendations',
    content: 'Try the local seafood at Fisherman\'s Wharf. Great reviews for authentic Sri Lankan cuisine.',
    createdAt: new Date('2024-01-21')
  },
  { 
    content: 'Don\'t forget to exchange currency before leaving. ATMs might be limited in rural areas.',
    createdAt: new Date('2024-01-22')
  },
];

async function seedChecklistsAndNotes() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all itineraries
    const itineraries = await Itinerary.find({});
    console.log(`📋 Found ${itineraries.length} itineraries`);

    if (itineraries.length === 0) {
      console.log('⚠️  No itineraries found. Create some itineraries first!');
      process.exit(0);
    }

    // Update each itinerary with sample data
    let updatedCount = 0;
    for (const itinerary of itineraries) {
      // Only add if not already present
      if (!itinerary.checklist || itinerary.checklist.length === 0) {
        itinerary.checklist = sampleChecklists;
        console.log(`  ✓ Added checklist to itinerary: ${itinerary.tripName}`);
      }

      if (!itinerary.notes || itinerary.notes.length === 0) {
        itinerary.notes = sampleNotes;
        console.log(`  ✓ Added notes to itinerary: ${itinerary.tripName}`);
      }

      await itinerary.save();
      updatedCount++;
    }

    console.log(`\n✅ Successfully updated ${updatedCount} itineraries`);
    console.log('🎉 Seed complete! You can now test checklist and notes features.');
    
  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Database connection closed');
  }
}

// Run the seed
seedChecklistsAndNotes();
