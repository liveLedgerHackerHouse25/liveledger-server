import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

// Load environment variables
dotenv.config();

// Initialize Prisma Client
export const prisma = new PrismaClient();

// Import routes
import authRoutes from "./routes/auth.routes";
// import streamRoutes from './routes/stream.routes';
// import userRoutes from './routes/user.routes';

// Import middleware
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { setupSwagger } from "./docs/swagger";

const app: Application = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ],
    credentials: true,
  })
);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: "10mb" }));
setupSwagger(app);

app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
app.use(morgan("combined"));

// Health check endpoint
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// API routes
app.use("/api/auth", authRoutes);
// app.use('/api/streams', streamRoutes);
// app.use('/api/users', userRoutes);

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
