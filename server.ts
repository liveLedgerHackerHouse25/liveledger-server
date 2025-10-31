import app, { prisma } from './src/app';
import { WebSocketService } from './src/services/websocket.service';

const PORT = process.env.PORT || 3000;

// Initialize WebSocket service
const websocketService = WebSocketService.getInstance();

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`);

  try {
    // Stop WebSocket periodic updates
    websocketService.stopPeriodicUpdates();

    await prisma.$disconnect();
    console.log('Database connection closed.');

    server.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Start the server
const server = app.listen(PORT, () => {
  console.log(`=� Server running on port ${PORT}`);
  console.log(`=� Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=' Health check: http://localhost:${PORT}/health`);

  // Initialize WebSocket server
  websocketService.initialize(server);
  console.log(`=� WebSocket server initialized`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});