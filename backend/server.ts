require('dotenv').config({ path: '../.env.local' });
const express = require('express');
const cors = require('cors');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req: any, res: any, next: any) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Error:', err);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File too large. Maximum size is 10MB.'
    });
  }

  if (err.message === 'Only PDF files allowed') {
    return res.status(400).json({
      success: false,
      error: 'Only PDF files are allowed.'
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Health check endpoint
app.get('/api/health', (req: any, res: any) => {
  res.json({
    success: true,
    message: 'IGCSE Quiz API is running',
    timestamp: new Date().toISOString(),
    version: '2.0.0'
  });
});

// Cloudinary config check endpoint (for debugging)
app.get('/api/cloudinary-check', (req: any, res: any) => {
  const cloudinary = require('cloudinary').v2;
  
  res.json({
    success: true,
    config: {
      cloud_name: cloudinary.config().cloud_name,
      api_key: cloudinary.config().api_key,
      api_secret: cloudinary.config().api_secret ? '***configured***' : 'NOT SET',
      env_loaded: {
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'not set',
        api_key: process.env.CLOUDINARY_API_KEY || 'not set',
        api_secret: process.env.CLOUDINARY_API_SECRET ? '***configured***' : 'not set'
      }
    }
  });
});

// Routes
const papersRouter = require('./routes/papers');
const quizzesRouter = require('./routes/quizzes');
const leaderboardRouter = require('./routes/leaderboard');
const quizGeneratorRouter = require('./routes/quiz-generator');
const manualTestsRouter = require('./routes/manual-tests');
const testSystemRouter = require('./routes/testSystem');

app.use('/api/papers', papersRouter);
app.use('/api/quizzes', quizzesRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api', quizGeneratorRouter);
app.use('/api', manualTestsRouter);
app.use('/api', testSystemRouter);

// 404 handler
app.use('*', (req: any, res: any) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Initialize owner on server start
const { OwnerService } = require('./services/owner');

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 IGCSE Quiz API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Initialize owner account
  await OwnerService.initializeOwner();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export { }; // Force TypeScript to treat this as a module