import { body } from 'express-validator';

export const AuthValidators = {
  validateNonceRequest: [
    body('walletAddress')
      .isEthereumAddress()
      .withMessage('Valid Ethereum address required')
      .customSanitizer(value => value.toLowerCase())
  ],

  validateWalletAuth: [
    body('walletAddress')
      .isEthereumAddress()
      .withMessage('Valid Ethereum address required')
      .customSanitizer(value => value.toLowerCase()),
    body('signature')
      .isHexadecimal()
      .withMessage('Signature must be hexadecimal')
      .isLength({ min: 130, max: 132 })
      .withMessage('Signature must be 65-66 bytes (130-132 hex characters)'),
    body('nonce')
      .isHexadecimal()
      .withMessage('Nonce must be hexadecimal')
      .isLength({ min: 64, max: 64 })
      .withMessage('Nonce must be 32 bytes (64 hex characters)')
  ]
};