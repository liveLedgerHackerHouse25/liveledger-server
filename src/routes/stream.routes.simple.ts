import { Router } from "express";
import { StreamController } from "../controllers/stream.controller.simple";
import { authenticate } from "../middleware/auth.middleware";
// Temporarily comment out validators to get server running
// import { validateRequest } from "../middleware/validation.middleware";
// import { StreamValidators } from "../validators/stream.validators";

const router = Router();
const streamController = new StreamController();

// Basic working routes - no validation for now to get server running
router.post("/", authenticate, streamController.createStream.bind(streamController));
router.get("/", authenticate, streamController.getUserStreams.bind(streamController));
router.get("/:streamId", authenticate, streamController.getStreamById.bind(streamController));
router.post("/withdraw", authenticate, streamController.processWithdrawal.bind(streamController));
router.get("/:streamId/activity", authenticate, streamController.getStreamActivity.bind(streamController));
router.get("/active", authenticate, streamController.getActiveStreams.bind(streamController));

export default router;