'use strict';

const { body, param, validationResult } = require('express-validator');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ─── UUID-style tenantId path param ───────────────────────────────────────────
const validateTenantId = [
  param('tenantId')
    .notEmpty()
    .withMessage('tenantId is required')
    .isLength({ min: 1, max: 64 })
    .withMessage('tenantId must be between 1 and 64 characters'),
  handleValidationErrors,
];

// ─── Create / full-replace body validation ────────────────────────────────────
const validateCustomerProfileBody = [
  // A. Basic Org
  body('basicOrg.organizationLegalName')
    .notEmpty()
    .withMessage('organizationLegalName is required')
    .isLength({ max: 255 })
    .trim(),

  body('basicOrg.displayName')
    .notEmpty()
    .withMessage('displayName is required')
    .isLength({ max: 255 })
    .trim(),

  body('basicOrg.country')
    .notEmpty()
    .withMessage('country is required')
    .isLength({ max: 100 })
    .trim(),

  body('basicOrg.industry')
    .optional()
    .isIn(['BFSI', 'Healthcare', 'Government', 'Retail', 'Manufacturing', 'Other', ''])
    .withMessage('industry must be one of: BFSI, Healthcare, Government, Retail, Manufacturing, Other'),

  body('basicOrg.dataResidencyRequirement')
    .notEmpty()
    .withMessage('dataResidencyRequirement is required')
    .isIn(['On-Prem', 'Japan', 'US', 'EU'])
    .withMessage('dataResidencyRequirement must be one of: On-Prem, Japan, US, EU'),

  body('basicOrg.contractStartDate')
    .notEmpty()
    .withMessage('contractStartDate is required')
    .isISO8601()
    .withMessage('contractStartDate must be a valid ISO 8601 date'),

  body('basicOrg.contractEndDate')
    .optional({ nullable: true })
    .isISO8601()
    .withMessage('contractEndDate must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (value && req.body.basicOrg && req.body.basicOrg.contractStartDate) {
        if (new Date(value) <= new Date(req.body.basicOrg.contractStartDate)) {
          throw new Error('contractEndDate must be after contractStartDate');
        }
      }
      return true;
    }),

  // B. Deployment
  body('deployment.deploymentMode')
    .notEmpty()
    .withMessage('deploymentMode is required')
    .isIn(['On-Prem', 'AWS-Private'])
    .withMessage('deploymentMode must be On-Prem or AWS-Private'),

  body('deployment.serverEnvironment')
    .notEmpty()
    .withMessage('serverEnvironment is required')
    .isIn(['Dev', 'UAT', 'Prod'])
    .withMessage('serverEnvironment must be Dev, UAT, or Prod'),

  body('deployment.gpuType')
    .optional()
    .isIn(['A100', 'L40S', 'H100', ''])
    .withMessage('gpuType must be A100, L40S, or H100'),

  body('deployment.maximumConcurrentCalls')
    .notEmpty()
    .withMessage('maximumConcurrentCalls is required')
    .isInt({ min: 1 })
    .withMessage('maximumConcurrentCalls must be a positive integer'),

  body('deployment.autoScaling')
    .notEmpty()
    .withMessage('autoScaling is required')
    .isBoolean()
    .withMessage('autoScaling must be a boolean'),

  // C. Telephony
  body('telephony.telephonyProvider')
    .notEmpty()
    .withMessage('telephonyProvider is required')
    .isIn(['Twilio', 'Genesys', 'SIP'])
    .withMessage('telephonyProvider must be Twilio, Genesys, or SIP'),

  body('telephony.webSocketEndpoint')
    .optional({ nullable: true })
    .isURL({ require_tld: false })
    .withMessage('webSocketEndpoint must be a valid URL'),

  body('telephony.callTransferMode')
    .optional()
    .isIn(['Blind', 'Warm'])
    .withMessage('callTransferMode must be Blind or Warm'),

  body('telephony.maxChannelsAllocated')
    .optional()
    .isInt({ min: 1 })
    .withMessage('maxChannelsAllocated must be a positive integer'),

  // D. AI Config
  body('aiConfig.defaultLanguage')
    .optional()
    .isIn(['JA', 'EN'])
    .withMessage('defaultLanguage must be JA or EN'),

  body('aiConfig.speechSpeed')
    .optional()
    .isFloat({ min: 0.5, max: 2.0 })
    .withMessage('speechSpeed must be between 0.5 and 2.0'),

  body('aiConfig.speechPitch')
    .optional()
    .isFloat({ min: 0.5, max: 2.0 })
    .withMessage('speechPitch must be between 0.5 and 2.0'),

  body('aiConfig.numericRecognitionMode')
    .optional()
    .isIn(['Strict', 'Standard'])
    .withMessage('numericRecognitionMode must be Strict or Standard'),

  // E. Security
  body('security.piiMaskingEnabled')
    .optional()
    .isBoolean()
    .withMessage('piiMaskingEnabled must be a boolean'),

  body('security.encryptionMode')
    .optional()
    .isIn(['AES-256', 'Client-Managed'])
    .withMessage('encryptionMode must be AES-256 or Client-Managed'),

  body('security.transcriptStorageRetention')
    .optional()
    .isInt({ min: 0 })
    .withMessage('transcriptStorageRetention must be a non-negative integer (days)'),

  body('security.complianceTags')
    .optional()
    .isArray()
    .withMessage('complianceTags must be an array'),

  body('security.complianceTags.*')
    .optional()
    .isIn(['PCI', 'HIPAA', 'APPI', 'SOC2', 'ISO27001'])
    .withMessage('each complianceTag must be one of: PCI, HIPAA, APPI, SOC2, ISO27001'),

  // F. Access Control
  body('accessControl.dxSupportAccessLevel')
    .optional()
    .isIn(['Full', 'Restricted'])
    .withMessage('dxSupportAccessLevel must be Full or Restricted'),

  body('accessControl.mfaRequired')
    .optional()
    .isBoolean()
    .withMessage('mfaRequired must be a boolean'),

  body('accessControl.ipRestrictions')
    .optional()
    .isArray()
    .withMessage('ipRestrictions must be an array of CIDR strings'),

  body('accessControl.customerAdminUsers.*.email')
    .optional()
    .isEmail()
    .withMessage('each customer admin user must have a valid email'),

  body('accessControl.customerAdminUsers.*.roleProfile')
    .optional()
    .isIn(['Admin', 'Viewer', 'Ops'])
    .withMessage('roleProfile must be Admin, Viewer, or Ops'),

  // G. Knowledge
  body('knowledge.knowledgeStorageSizeGb')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('knowledgeStorageSizeGb must be a non-negative number'),

  body('knowledge.maxUploadSizeMb')
    .optional()
    .isInt({ min: 1 })
    .withMessage('maxUploadSizeMb must be a positive integer'),

  // H. Monitoring
  body('monitoring.slaTier')
    .optional()
    .isIn(['Standard', 'Premium'])
    .withMessage('slaTier must be Standard or Premium'),

  body('monitoring.maxResponseLatencyTargetMs')
    .optional()
    .isInt({ min: 0 })
    .withMessage('maxResponseLatencyTargetMs must be a non-negative integer'),

  body('monitoring.alertEmail')
    .optional({ nullable: true })
    .isEmail()
    .withMessage('alertEmail must be a valid email address'),

  body('monitoring.alertWebhook')
    .optional({ nullable: true })
    .isURL({ require_tld: false })
    .withMessage('alertWebhook must be a valid URL'),

  body('monitoring.logRetentionDays')
    .optional()
    .isInt({ min: 1 })
    .withMessage('logRetentionDays must be a positive integer'),

  body('monitoring.drStrategy')
    .optional()
    .isIn(['Cold', 'Warm', 'Hot', ''])
    .withMessage('drStrategy must be Cold, Warm, or Hot'),

  // Final handler
  handleValidationErrors,
];

module.exports = {
  validateTenantId,
  validateCustomerProfileBody,
  handleValidationErrors,
};
