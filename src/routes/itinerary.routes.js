const express = require('express');
const router = express.Router();
const itineraryController = require('../controllers/itinerary.controller');
const { authenticateToken } = require('../middleware/auth');

// Public routes (no auth required)
router.get('/places/search', itineraryController.searchPlaces);
router.get('/places/autocomplete', itineraryController.getAutocompleteSuggestions);
router.get('/places/:placeId', itineraryController.getPlaceDetails);

// Protected routes (auth required)
router.post('/create', authenticateToken, itineraryController.createItinerary);
router.post('/generate', authenticateToken, itineraryController.generateItinerary);
router.get('/user', authenticateToken, itineraryController.getUserItineraries);
router.get('/:id', authenticateToken, itineraryController.getItinerary);
router.put('/:id', authenticateToken, itineraryController.updateItinerary);
router.delete('/:id', authenticateToken, itineraryController.deleteItinerary);

module.exports = router;
