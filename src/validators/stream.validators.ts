import { body, param, query } from "express-validator";
// import { isAddress } from "ethers";

export const StreamValidators = {
  // validateStreamCreate: [
  //   body("recipientAddress")
  //     .custom((value) => {
  //       if (!value || !isAddress(value)) {
  //         throw new Error("Valid Ethereum address required for recipient");
  //       }
  //       return true;
  //     })
  //     .withMessage("Valid Ethereum address required for recipient"),
  //   body("tokenAddress")
  //     .custom((value) => {
  //       if (!value || !isAddress(value)) {
  //         throw new Error("Valid Ethereum address required for token");
  //       }
  //       return true;
  //     })
  //     .withMessage("Valid Ethereum address required for token"),
  //   body("flowRate")
  //     .isFloat({ min: 0.000001 })
  //     .withMessage("Flow rate must be a positive number (minimum 0.000001)")
  //     .custom((value) => {
  //       const flowRate = parseFloat(value);
  //       if (isNaN(flowRate) || flowRate <= 0) {
  //         throw new Error("Flow rate must be positive");
  //       }
  //       return true;
  //     }),
  //   body("totalAmount")
  //     .isFloat({ min: 0.01 })
  //     .withMessage("Total amount must be at least 0.01")
  //     .custom((value) => {
  //       const totalAmount = parseFloat(value);
  //       if (isNaN(totalAmount) || totalAmount <= 0) {
  //         throw new Error("Total amount must be positive");
  //       }
  //       return true;
  //     })
  // ],
  // validateStreamId: [
  //   param("streamId")
  //     .isUUID()
  //     .withMessage("Stream ID must be a valid UUID")
  // ],
  // validateStreamUpdate: [
  //   param("streamId")
  //     .isUUID()
  //     .withMessage("Stream ID must be a valid UUID"),
  //   body("status")
  //     .optional()
  //     .isIn(["ACTIVE", "PAUSED", "STOPPED"])
  //     .withMessage("Status must be one of: ACTIVE, PAUSED, STOPPED")
  // ],
  // validateWithdrawalRequest: [
  //   body("streamId")
  //     .isUUID()
  //     .withMessage("Stream ID must be a valid UUID"),
  //   body("amount")
  //     .isFloat({ min: 0.000001 })
  //     .withMessage("Withdrawal amount must be positive")
  //     .custom((value) => {
  //       const amount = parseFloat(value);
  //       if (isNaN(amount) || amount <= 0) {
  //         throw new Error("Withdrawal amount must be positive");
  //       }
  //       return true;
  //     })
  // ],
  // validateStreamQuery: [
  //   query("status")
  //     .optional()
  //     .isIn(["PENDING", "ACTIVE", "PAUSED", "STOPPED", "COMPLETED"])
  //     .withMessage("Invalid stream status"),
  //   query("payerId")
  //     .optional()
  //     .isUUID()
  //     .withMessage("Payer ID must be a valid UUID"),
  //   query("recipientId")
  //     .optional()
  //     .isUUID()
  //     .withMessage("Recipient ID must be a valid UUID"),
  //   query("page")
  //     .optional()
  //     .isInt({ min: 1 })
  //     .withMessage("Page must be a positive integer"),
  //   query("limit")
  //     .optional()
  //     .isInt({ min: 1, max: 100 })
  //     .withMessage("Limit must be between 1 and 100")
  // ]
};
