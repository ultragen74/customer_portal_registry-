'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── A. Basic Organization Information ───────────────────────────────────────
const basicOrgSchema = new Schema(
  {
    organizationLegalName: { type: String, required: true, trim: true },
    displayName:           { type: String, required: true, trim: true },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    industry: {
      type: String,
      enum: ['BFSI', 'Healthcare', 'Government', 'Retail', 'Manufacturing', 'Other', ''],
      default: '',
    },
    dataResidencyRequirement: {
      type: String,
      required: true,
      enum: ['On-Prem', 'Japan', 'US', 'EU'],
    },
    contractStartDate: { type: Date, required: true },
    contractEndDate:   { type: Date, default: null },
  },
  { _id: false }
);

// ─── B. Deployment Configuration ─────────────────────────────────────────────
const deploymentSchema = new Schema(
  {
    deploymentMode: {
      type: String,
      required: true,
      enum: ['On-Prem', 'AWS-Private'],
    },
    hostingRegion:    { type: String, trim: true, default: '' },
    serverEnvironment: {
      type: String,
      required: true,
      enum: ['Dev', 'UAT', 'Prod'],
    },
    gpuType: {
      type: String,
      enum: ['A100', 'L40S', 'H100', ''],
      default: '',
    },
    maximumConcurrentCalls: {
      type: Number,
      required: true,
      min: 1,
    },
    autoScaling: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

// ─── C. Telephony Configuration ──────────────────────────────────────────────
const inboundNumberSchema = new Schema(
  { number: { type: String, trim: true } },
  { _id: false }
);

const outboundCallerIdSchema = new Schema(
  { callerId: { type: String, trim: true } },
  { _id: false }
);

const channelOccupancyRuleSchema = new Schema(
  {
    description: { type: String, trim: true },
    channelsConsumed: { type: Number, min: 1 },
  },
  { _id: false }
);

const telephonySchema = new Schema(
  {
    telephonyProvider: {
      type: String,
      required: true,
      enum: ['Twilio', 'Genesys', 'SIP'],
    },
    accountSidOrOrgId: { type: String, trim: true, default: '' },
    webSocketEndpoint: { type: String, trim: true, default: '' },
    rtpPortRange:      { type: String, trim: true, default: '' },
    inboundNumbers:    { type: [inboundNumberSchema], default: [] },
    outboundCallerIds: { type: [outboundCallerIdSchema], default: [] },
    callTransferMode: {
      type: String,
      enum: ['Blind', 'Warm'],
      default: 'Blind',
    },
    maxChannelsAllocated: { type: Number, min: 1, default: 1 },
    channelOccupancyRules: { type: [channelOccupancyRuleSchema], default: [] },
  },
  { _id: false }
);

// ─── D. AI Configuration Profile ─────────────────────────────────────────────
const aiConfigSchema = new Schema(
  {
    defaultLanguage: {
      type: String,
      required: true,
      enum: ['JA', 'EN'],
      default: 'EN',
    },
    sttModelVersion:  { type: String, trim: true, default: '' },
    llmModelVersion:  { type: String, trim: true, default: '' },
    ttsVoice:         { type: String, trim: true, default: '' },
    speechSpeed:      { type: Number, min: 0.5, max: 2.0, default: 1.0 },
    speechPitch:      { type: Number, min: 0.5, max: 2.0, default: 1.0 },
    numericRecognitionMode: {
      type: String,
      enum: ['Strict', 'Standard'],
      default: 'Standard',
    },
    guardrailProfile:     { type: String, trim: true, default: '' },
    knowledgeBaseAssigned: { type: [String], default: [] },
  },
  { _id: false }
);

// ─── E. Security & Compliance Controls ───────────────────────────────────────
const securitySchema = new Schema(
  {
    piiMaskingEnabled:          { type: Boolean, required: true, default: true },
    audioRecordingEnabled:      { type: Boolean, required: true, default: false },
    transcriptStorageRetention: { type: Number, min: 0, default: 90 },
    encryptionMode: {
      type: String,
      required: true,
      enum: ['AES-256', 'Client-Managed'],
      default: 'AES-256',
    },
    externalApiAllowed: { type: Boolean, required: true, default: false },
    clientVpnRequired:  { type: Boolean, required: true, default: false },
    iamRoleMapping:     { type: String, trim: true, default: '' },
    auditLoggingEnabled: { type: Boolean, required: true, default: true, immutable: true },
    complianceTags: {
      type: [String],
      enum: ['PCI', 'HIPAA', 'APPI', 'SOC2', 'ISO27001'],
      default: [],
    },
    dataClassificationLevel: {
      type: String,
      enum: ['Public', 'Internal', 'Confidential', 'Restricted', ''],
      default: '',
    },
  },
  { _id: false }
);

// ─── F. User Access & RBAC ────────────────────────────────────────────────────
const customerAdminUserSchema = new Schema(
  {
    email:    { type: String, trim: true, lowercase: true },
    roleProfile: {
      type: String,
      enum: ['Admin', 'Viewer', 'Ops'],
      default: 'Viewer',
    },
  },
  { _id: false }
);

const accessControlSchema = new Schema(
  {
    customerAdminUsers: { type: [customerAdminUserSchema], default: [] },
    dxSupportAccessLevel: {
      type: String,
      enum: ['Full', 'Restricted'],
      default: 'Restricted',
    },
    mfaRequired:    { type: Boolean, required: true, default: true },
    ipRestrictions: { type: [String], default: [] },
  },
  { _id: false }
);

// ─── G. Knowledge & Scenario Management ──────────────────────────────────────
const knowledgeSchema = new Schema(
  {
    knowledgeStorageSizeGb:    { type: Number, min: 0, default: 0 },
    vectorIndexAssigned:       { type: Boolean, default: false },
    maxUploadSizeMb:           { type: Number, min: 1, default: 50 },
    autoTrainingEnabled:       { type: Boolean, default: false },
    approvedLearningWorkflow:  { type: String, trim: true, default: '' },
  },
  { _id: false }
);

// ─── H. Monitoring & SLA Settings ────────────────────────────────────────────
const monitoringSchema = new Schema(
  {
    slaTier: {
      type: String,
      required: true,
      enum: ['Standard', 'Premium'],
      default: 'Standard',
    },
    maxResponseLatencyTargetMs: { type: Number, min: 0, default: 2000 },
    monitoringIntegration: {
      type: String,
      enum: ['CloudWatch', 'Prometheus', 'None'],
      default: 'None',
    },
    alertEmail:    { type: String, trim: true, lowercase: true, default: '' },
    alertWebhook:  { type: String, trim: true, default: '' },
    logRetentionDays: { type: Number, min: 1, default: 90 },
    incidentContactEscalationMatrix: { type: String, trim: true, default: '' },
    drStrategy: {
      type: String,
      enum: ['Cold', 'Warm', 'Hot', ''],
      default: '',
    },
  },
  { _id: false }
);

// ─── I. Accessibility & Voice Controls ───────────────────────────────────────
const accessibilitySchema = new Schema(
  {
    dtmfFallbackEnabled:       { type: Boolean, default: true },
    ttsAdjustableSpeedEnabled: { type: Boolean, default: true },
    liveTranscriptAvailable:   { type: Boolean, default: false },
    realTimeCaptionApi:        { type: Boolean, default: false },
    hearingAidCompatibleMode:  { type: Boolean, default: false },
  },
  { _id: false }
);

// ─── Root Customer Profile Schema ─────────────────────────────────────────────
const customerProfileSchema = new Schema(
  {
    // Tenant isolation key – indexed, immutable
    tenantId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      immutable: true,
    },

    basicOrg:      { type: basicOrgSchema,      required: true },
    deployment:    { type: deploymentSchema,    required: true },
    telephony:     { type: telephonySchema,     required: true },
    aiConfig:      { type: aiConfigSchema,      required: true },
    security:      { type: securitySchema,      required: true },
    accessControl: { type: accessControlSchema, required: true },
    knowledge:     { type: knowledgeSchema,     required: true },
    monitoring:    { type: monitoringSchema,    required: true },
    accessibility: { type: accessibilitySchema, required: true },

    // Operational responsibility matrix (read-only from API)
    operationalResponsibility: {
      type: Map,
      of: String,
      default: () => ({
        osPatching:    'Customer',
        modelUpgrade:  'DX',
        iamManagement: 'Customer',
        antivirus:     'Customer',
        telephonySla:  'Shared',
      }),
    },
  },
  {
    timestamps: true,
    // Enforce strict data isolation: never return cross-tenant data by default
    strict: true,
  }
);

// Compound index for tenant-scoped queries
customerProfileSchema.index({ tenantId: 1, 'basicOrg.organizationLegalName': 1 });

// Prevent auditLoggingEnabled from ever being set to false
customerProfileSchema.pre('save', function (next) {
  if (this.security) {
    this.security.auditLoggingEnabled = true;
  }
  next();
});

customerProfileSchema.pre(['updateOne', 'findOneAndUpdate'], function (next) {
  const update = this.getUpdate();
  if (update && update.$set && update.$set['security.auditLoggingEnabled'] === false) {
    delete update.$set['security.auditLoggingEnabled'];
  }
  next();
});

module.exports = mongoose.model('CustomerProfile', customerProfileSchema);
