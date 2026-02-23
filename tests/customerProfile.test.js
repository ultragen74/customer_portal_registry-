'use strict';

// Prevent mongoose from trying to open a real DB connection
jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    connect:    jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
});

// Auto-mock the CustomerProfile model
jest.mock('../src/models/customerProfile');

const request         = require('supertest');
const app             = require('../src/app');
const CustomerProfile = require('../src/models/customerProfile');

// ─── In-memory store ──────────────────────────────────────────────────────────
let store = {};

const DEFAULT_OP_RESP = {
  osPatching:    'Customer',
  modelUpgrade:  'DX',
  iamManagement: 'Customer',
  antivirus:     'Customer',
  telephonySla:  'Shared',
};

// Build a normalised plain-object "document" from a create payload
function buildDoc(payload) {
  const security = {
    piiMaskingEnabled:          true,
    audioRecordingEnabled:      false,
    transcriptStorageRetention: 90,
    encryptionMode:             'AES-256',
    externalApiAllowed:         false,
    clientVpnRequired:          false,
    auditLoggingEnabled:        true,   // always locked on
    complianceTags:             [],
    dataClassificationLevel:    '',
    ...(payload.security || {}),
    auditLoggingEnabled: true,          // cannot be overridden
  };

  return {
    tenantId:   payload.tenantId,
    basicOrg:   { ...(payload.basicOrg || {}) },
    deployment: { ...(payload.deployment || {}) },
    telephony: {
      telephonyProvider:    'Twilio',
      callTransferMode:     'Blind',
      maxChannelsAllocated: 1,
      channelOccupancyRules: [],
      ...(payload.telephony || {}),
    },
    aiConfig: {
      defaultLanguage:      'EN',
      speechSpeed:          1.0,
      speechPitch:          1.0,
      numericRecognitionMode: 'Standard',
      knowledgeBaseAssigned:  [],
      ...(payload.aiConfig || {}),
    },
    security,
    accessControl: {
      customerAdminUsers:    [],
      dxSupportAccessLevel:  'Restricted',
      mfaRequired:           true,
      ipRestrictions:        [],
      ...(payload.accessControl || {}),
    },
    knowledge: {
      knowledgeStorageSizeGb:   0,
      vectorIndexAssigned:      false,
      maxUploadSizeMb:          50,
      autoTrainingEnabled:      false,
      ...(payload.knowledge || {}),
    },
    monitoring: {
      slaTier:                    'Standard',
      maxResponseLatencyTargetMs: 2000,
      monitoringIntegration:      'None',
      logRetentionDays:           90,
      ...(payload.monitoring || {}),
    },
    accessibility: {
      dtmfFallbackEnabled:       true,
      ttsAdjustableSpeedEnabled: true,
      liveTranscriptAvailable:   false,
      realTimeCaptionApi:        false,
      hearingAidCompatibleMode:  false,
      ...(payload.accessibility || {}),
    },
    operationalResponsibility: DEFAULT_OP_RESP,
  };
}

// ─── Shared mock setup function (called once + re-called after clearAllMocks) ─
function setupMocks() {
  CustomerProfile.mockImplementation(function (data) {
    const doc = buildDoc(data);
    Object.assign(this, doc);
    // toJSON so Express's res.json() serialises the current instance state correctly
    this.toJSON = function () {
      const copy = {};
      for (const k of Object.keys(this)) {
        if (typeof this[k] !== 'function') copy[k] = this[k];
      }
      return copy;
    };
    this.save = jest.fn().mockImplementation(async () => {
      if (store[this.tenantId]) {
        const err = new Error('duplicate key');
        err.code  = 11000;
        throw err;
      }
      store[this.tenantId] = buildDoc(data);
      return this;
    });
  });

  CustomerProfile.find = jest.fn().mockImplementation((filter = {}) => ({
    skip:  jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean:  jest.fn().mockImplementation(async () => {
      let docs = Object.values(store);
      if (filter.tenantId) docs = docs.filter(d => d.tenantId === filter.tenantId);
      return docs;
    }),
  }));

  CustomerProfile.countDocuments = jest.fn().mockImplementation(async (filter = {}) => {
    let docs = Object.values(store);
    if (filter.tenantId) docs = docs.filter(d => d.tenantId === filter.tenantId);
    return docs.length;
  });

  CustomerProfile.findOne = jest.fn().mockImplementation((filter = {}) => ({
    lean: jest.fn().mockImplementation(async () =>
      filter.tenantId ? (store[filter.tenantId] || null) : null
    ),
  }));

  CustomerProfile.findOneAndUpdate = jest.fn().mockImplementation(
    async (filter, update, _opts) => {
      const doc = store[filter.tenantId];
      if (!doc) return null;
      const $set = update.$set || {};
      for (const [path, value] of Object.entries($set)) {
        const dotIdx = path.indexOf('.');
        if (dotIdx === -1) {
          // Top-level section replacement (PUT): e.g. { basicOrg: { ... } }
          if (Object.prototype.hasOwnProperty.call(doc, path)) {
            doc[path] = value;
          }
        } else {
          // Nested field update (PATCH): e.g. { "basicOrg.displayName": "..." }
          // Only two levels deep; guard existing section objects.
          const section = path.slice(0, dotIdx);
          const field   = path.slice(dotIdx + 1);
          if (
            Object.prototype.hasOwnProperty.call(doc, section) &&
            typeof doc[section] === 'object' &&
            doc[section] !== null
          ) {
            doc[section][field] = value;
          }
        }
      }
      doc.security.auditLoggingEnabled = true; // invariant: always locked
      store[filter.tenantId] = doc;
      return doc;
    }
  );

  CustomerProfile.findOneAndDelete = jest.fn().mockImplementation(async (filter = {}) => {
    const doc = store[filter.tenantId] || null;
    if (doc) delete store[filter.tenantId];
    return doc;
  });
}

// Initial setup
setupMocks();

beforeEach(() => {
  store = {};
  jest.clearAllMocks();
  setupMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const minimalPayload = () => ({
  tenantId: 'tenant-001',
  basicOrg: {
    organizationLegalName: 'Acme Corp Ltd',
    displayName: 'Acme',
    country: 'Japan',
    dataResidencyRequirement: 'Japan',
    contractStartDate: '2025-01-01',
  },
  deployment: {
    deploymentMode:         'On-Prem',
    serverEnvironment:      'Prod',
    maximumConcurrentCalls: 50,
    autoScaling:            false,
  },
  telephony:     { telephonyProvider: 'Twilio' },
  aiConfig:      {},
  security:      {},
  accessControl: {},
  knowledge:     {},
  monitoring:    {},
  accessibility: {},
});

// ─── POST /api/customers ──────────────────────────────────────────────────────
describe('POST /api/customers', () => {
  test('creates a customer profile with all required fields', async () => {
    const res = await request(app).post('/api/customers').send(minimalPayload());
    expect(res.status).toBe(201);
    expect(res.body.tenantId).toBe('tenant-001');
    expect(res.body.basicOrg.organizationLegalName).toBe('Acme Corp Ltd');
    expect(res.body.security.auditLoggingEnabled).toBe(true);
    expect(res.body.security.piiMaskingEnabled).toBe(true);
    expect(res.body.accessControl.mfaRequired).toBe(true);
  });

  test('returns 409 if tenantId already exists', async () => {
    await request(app).post('/api/customers').send(minimalPayload());
    const res = await request(app).post('/api/customers').send(minimalPayload());
    expect(res.status).toBe(409);
  });

  test('returns 400 when required basicOrg fields are missing', async () => {
    const payload = minimalPayload();
    delete payload.basicOrg.organizationLegalName;
    const res = await request(app).post('/api/customers').send(payload);
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeDefined();
  });

  test('returns 400 when contractEndDate is before contractStartDate', async () => {
    const payload = minimalPayload();
    payload.basicOrg.contractEndDate = '2024-01-01';
    const res = await request(app).post('/api/customers').send(payload);
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid deploymentMode', async () => {
    const payload = minimalPayload();
    payload.deployment.deploymentMode = 'Azure';
    const res = await request(app).post('/api/customers').send(payload);
    expect(res.status).toBe(400);
  });

  test('returns 400 when tenantId is missing', async () => {
    const payload = minimalPayload();
    delete payload.tenantId;
    const res = await request(app).post('/api/customers').send(payload);
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid telephonyProvider', async () => {
    const payload = minimalPayload();
    payload.telephony.telephonyProvider = 'AVAYA';
    const res = await request(app).post('/api/customers').send(payload);
    expect(res.status).toBe(400);
  });

  test('returns 400 for invalid complianceTags', async () => {
    const payload = minimalPayload();
    payload.security = { complianceTags: ['GDPR'] };
    const res = await request(app).post('/api/customers').send(payload);
    expect(res.status).toBe(400);
  });

  test('stores channelOccupancyRules in telephony section', async () => {
    const payload = minimalPayload();
    payload.telephony.channelOccupancyRules = [
      { description: '3-way call consumes 2 channels', channelsConsumed: 2 },
    ];
    const res = await request(app).post('/api/customers').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.telephony.channelOccupancyRules).toHaveLength(1);
    expect(res.body.telephony.channelOccupancyRules[0].channelsConsumed).toBe(2);
  });
});

// ─── GET /api/customers ───────────────────────────────────────────────────────
describe('GET /api/customers', () => {
  test('returns empty list initially', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.data).toEqual([]);
  });

  test('returns created profiles', async () => {
    await request(app).post('/api/customers').send(minimalPayload());
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
  });

  test('supports tenantId filter', async () => {
    await request(app).post('/api/customers').send(minimalPayload());
    const payload2   = minimalPayload();
    payload2.tenantId = 'tenant-002';
    await request(app).post('/api/customers').send(payload2);

    const res = await request(app).get('/api/customers?tenantId=tenant-001');
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].tenantId).toBe('tenant-001');
  });
});

// ─── GET /api/customers/:tenantId ─────────────────────────────────────────────
describe('GET /api/customers/:tenantId', () => {
  test('returns 404 for non-existent tenant', async () => {
    const res = await request(app).get('/api/customers/unknown-tenant');
    expect(res.status).toBe(404);
  });

  test('returns the correct profile', async () => {
    await request(app).post('/api/customers').send(minimalPayload());
    const res = await request(app).get('/api/customers/tenant-001');
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe('tenant-001');
  });
});

// ─── PUT /api/customers/:tenantId ─────────────────────────────────────────────
describe('PUT /api/customers/:tenantId', () => {
  test('fully replaces updatable sections', async () => {
    await request(app).post('/api/customers').send(minimalPayload());
    const updated = minimalPayload();
    updated.basicOrg.displayName = 'Acme Updated';

    const res = await request(app).put('/api/customers/tenant-001').send(updated);
    expect(res.status).toBe(200);
    expect(res.body.basicOrg.displayName).toBe('Acme Updated');
  });

  test('returns 404 for non-existent tenant', async () => {
    const res = await request(app).put('/api/customers/ghost').send(minimalPayload());
    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/customers/:tenantId ───────────────────────────────────────────
describe('PATCH /api/customers/:tenantId', () => {
  test('partially updates a single section', async () => {
    await request(app).post('/api/customers').send(minimalPayload());
    const res = await request(app)
      .patch('/api/customers/tenant-001')
      .send({ basicOrg: { displayName: 'Acme Patched' } });
    expect(res.status).toBe(200);
    expect(res.body.basicOrg.displayName).toBe('Acme Patched');
  });

  test('does not allow disabling auditLoggingEnabled', async () => {
    await request(app).post('/api/customers').send(minimalPayload());
    const res = await request(app)
      .patch('/api/customers/tenant-001')
      .send({ security: { auditLoggingEnabled: false } });
    expect(res.status).toBe(200);
    expect(res.body.security.auditLoggingEnabled).toBe(true);
  });

  test('returns 400 when no fields provided', async () => {
    await request(app).post('/api/customers').send(minimalPayload());
    const res = await request(app).patch('/api/customers/tenant-001').send({});
    expect(res.status).toBe(400);
  });

  test('returns 404 for non-existent tenant', async () => {
    const res = await request(app)
      .patch('/api/customers/ghost')
      .send({ basicOrg: { displayName: 'X' } });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE /api/customers/:tenantId ──────────────────────────────────────────
describe('DELETE /api/customers/:tenantId', () => {
  test('deletes an existing profile', async () => {
    await request(app).post('/api/customers').send(minimalPayload());
    const res = await request(app).delete('/api/customers/tenant-001');
    expect(res.status).toBe(204);

    const getRes = await request(app).get('/api/customers/tenant-001');
    expect(getRes.status).toBe(404);
  });

  test('returns 404 when deleting non-existent tenant', async () => {
    const res = await request(app).delete('/api/customers/ghost');
    expect(res.status).toBe(404);
  });
});

// ─── Security invariants ──────────────────────────────────────────────────────
describe('Security invariants', () => {
  test('auditLoggingEnabled is always true even if false is passed', async () => {
    const payload = minimalPayload();
    payload.security = { auditLoggingEnabled: false };
    const res = await request(app).post('/api/customers').send(payload);
    expect(res.status).toBe(201);
    expect(res.body.security.auditLoggingEnabled).toBe(true);
  });

  test('piiMaskingEnabled defaults to true', async () => {
    const res = await request(app).post('/api/customers').send(minimalPayload());
    expect(res.body.security.piiMaskingEnabled).toBe(true);
  });

  test('mfaRequired defaults to true', async () => {
    const res = await request(app).post('/api/customers').send(minimalPayload());
    expect(res.body.accessControl.mfaRequired).toBe(true);
  });
});

// ─── Operational responsibility matrix ───────────────────────────────────────
describe('Operational responsibility', () => {
  test('is included in the response with correct defaults', async () => {
    const res = await request(app).post('/api/customers').send(minimalPayload());
    expect(res.body.operationalResponsibility).toBeDefined();
    expect(res.body.operationalResponsibility.modelUpgrade).toBe('DX');
    expect(res.body.operationalResponsibility.osPatching).toBe('Customer');
  });
});
