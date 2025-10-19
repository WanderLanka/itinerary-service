require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./utils/database');

const app = express();
const PORT = process.env.PORT || 3008;

// Connect to MongoDB
connectDB();

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Custom logging with service name for easier debugging
app.use((req, res, next) => {
  console.log(`[ITINERARY-SERVICE] ${req.method} ${req.path}`);
  next();
});

app.use(morgan('dev')); // Logging

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Itinerary Service is running',
    timestamp: new Date().toISOString()
  });
});

// Import routes
const itineraryRoutes = require('./routes/itinerary.routes');
const routeRoutes = require('./routes/route.routes');
const myTripsRoutes = require('./routes/myTrips.routes');

// API Routes (without /api prefix since API Gateway handles that)
// Gateway forwards: /api/itinerary/create → /create
// So we mount routes at root for itinerary endpoints
app.use('/', itineraryRoutes);
app.use('/routes', routeRoutes);
app.use('/my-trips', myTripsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Itinerary Service running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
