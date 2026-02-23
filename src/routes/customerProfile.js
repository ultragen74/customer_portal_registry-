'use strict';

const express = require('express');
const router  = express.Router();
const CustomerProfile = require('../models/customerProfile');
const {
  validateTenantId,
  validateCustomerProfileBody,
} = require('../middleware/validate');

// ─── POST /api/customers ─── Create a new customer profile ───────────────────
router.post(
  '/',
  validateCustomerProfileBody,
  async (req, res) => {
    try {
      const { tenantId, basicOrg, deployment, telephony, aiConfig,
              security, accessControl, knowledge, monitoring, accessibility } = req.body;

      if (!tenantId) {
        return res.status(400).json({ error: 'tenantId is required' });
      }

      const profile = new CustomerProfile({
        tenantId,
        basicOrg,
        deployment,
        telephony,
        aiConfig:      aiConfig      || {},
        security:      security      || {},
        accessControl: accessControl || {},
        knowledge:     knowledge     || {},
        monitoring:    monitoring    || {},
        accessibility: accessibility || {},
      });

      await profile.save();
      return res.status(201).json(profile);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).json({ error: 'A customer profile with this tenantId already exists.' });
      }
      return res.status(500).json({ error: err.message });
    }
  }
);

// ─── GET /api/customers ─── List all customer profiles ───────────────────────
router.get('/', async (req, res) => {
  try {
    // Support optional filtering by tenantId query param for strict isolation
    const filter = {};
    if (req.query.tenantId) {
      filter.tenantId = req.query.tenantId;
    }

    const page     = Math.max(1, parseInt(req.query.page  || '1',  10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize || '20', 10)));
    const skip     = (page - 1) * pageSize;

    const [profiles, total] = await Promise.all([
      CustomerProfile.find(filter).skip(skip).limit(pageSize).lean(),
      CustomerProfile.countDocuments(filter),
    ]);

    return res.json({
      total,
      page,
      pageSize,
      data: profiles,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/customers/:tenantId ─── Get a single customer profile ───────────
router.get(
  '/:tenantId',
  validateTenantId,
  async (req, res) => {
    try {
      const profile = await CustomerProfile.findOne({ tenantId: req.params.tenantId }).lean();
      if (!profile) {
        return res.status(404).json({ error: 'Customer profile not found.' });
      }
      return res.json(profile);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// ─── PUT /api/customers/:tenantId ─── Full replace (all sections) ─────────────
router.put(
  '/:tenantId',
  validateTenantId,
  validateCustomerProfileBody,
  async (req, res) => {
    try {
      const { basicOrg, deployment, telephony, aiConfig,
              security, accessControl, knowledge, monitoring, accessibility } = req.body;

      const updated = await CustomerProfile.findOneAndUpdate(
        { tenantId: req.params.tenantId },
        { $set: { basicOrg, deployment, telephony, aiConfig, security,
                  accessControl, knowledge, monitoring, accessibility } },
        { new: true, runValidators: true }
      );

      if (!updated) {
        return res.status(404).json({ error: 'Customer profile not found.' });
      }
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// ─── PATCH /api/customers/:tenantId ─── Partial update (one section at a time) ─
router.patch(
  '/:tenantId',
  validateTenantId,
  async (req, res) => {
    try {
      const ALLOWED_SECTIONS = [
        'basicOrg', 'deployment', 'telephony', 'aiConfig',
        'security', 'accessControl', 'knowledge', 'monitoring', 'accessibility',
      ];

      const $set = {};
      for (const section of ALLOWED_SECTIONS) {
        if (req.body[section] !== undefined) {
          // Flatten section fields into dot-notation for partial update
          const sectionData = req.body[section];
          for (const [key, value] of Object.entries(sectionData)) {
            $set[`${section}.${key}`] = value;
          }
        }
      }

      if (Object.keys($set).length === 0) {
        return res.status(400).json({ error: 'No updatable fields provided.' });
      }

      // Audit logging must always remain enabled
      delete $set['security.auditLoggingEnabled'];

      const updated = await CustomerProfile.findOneAndUpdate(
        { tenantId: req.params.tenantId },
        { $set },
        { new: true, runValidators: true }
      );

      if (!updated) {
        return res.status(404).json({ error: 'Customer profile not found.' });
      }
      return res.json(updated);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// ─── DELETE /api/customers/:tenantId ──────────────────────────────────────────
router.delete(
  '/:tenantId',
  validateTenantId,
  async (req, res) => {
    try {
      const deleted = await CustomerProfile.findOneAndDelete({ tenantId: req.params.tenantId });
      if (!deleted) {
        return res.status(404).json({ error: 'Customer profile not found.' });
      }
      return res.status(204).send();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
