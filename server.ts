import app, { prisma } from './src/app';

const PORT = process.env.PORT || 3000;

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`);

  try {
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
  console.log(`=€ Server running on port ${PORT}`);
  console.log(`=Ý Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`=' Health check: http://localhost:${PORT}/health`);
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