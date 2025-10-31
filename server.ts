import app, { prisma } from './src/app';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { RealTimeWorkerService } from './src/services/real-time-worker.service';

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ 
  server,
  path: '/ws'
});

// Initialize real-time worker service
const realTimeWorker = new RealTimeWorkerService();

// WebSocket connection handling
wss.on('connection', (ws, request) => {
  console.log('New WebSocket connection attempt');
  
  // Extract token from query string or headers
  const url = new URL(request.url!, `http://${request.headers.host}`);
  const token = url.searchParams.get('token') || request.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    console.log('WebSocket connection rejected: No token provided');
    ws.close(1008, 'No authentication token provided');
    return;
  }

  try {
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
    console.log(`WebSocket connection authenticated for user: ${decoded.userId}`);
    
    // Register the connection with the real-time worker
    realTimeWorker.registerWebSocketConnection(decoded.userId, ws);
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'connection',
      status: 'connected',
      userId: decoded.userId,
      timestamp: new Date().toISOString()
    }));
    
  } catch (error) {
    console.log('WebSocket connection rejected: Invalid token', error);
    ws.close(1008, 'Invalid authentication token');
  }
});

// Start the real-time worker service and server
async function startServer() {
  try {
    await realTimeWorker.startWorker();
    
    // Start the server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`❤️ Health check: http://localhost:${PORT}/health`);
      console.log(`🔗 WebSocket endpoint: ws://localhost:${PORT}/ws`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
const gracefulShutdown = async (signal: string) => {
  console.log(`Received ${signal}, shutting down gracefully...`);

  try {
    // Stop the real-time worker
    await realTimeWorker.stopWorker();
    
    // Close WebSocket server
    wss.close();
    
    await prisma.$disconnect();
    console.log("Database connection closed.");

    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  } catch (error) {
    console.error("Error during shutdown:", error);
    process.exit(1);
  }
};

startServer();

// Handle graceful shutdown
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  gracefulShutdown("unhandledRejection");
});
