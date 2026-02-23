'use strict';

require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');

const customerProfileRouter = require('./routes/customerProfile');

const app = express();

app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/customers', customerProfileRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Error handler ────────────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Start (skipped when required by tests) ───────────────────────────────────
if (require.main === module) {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/customer_portal';
  const PORT        = process.env.PORT        || 3000;

  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      app.listen(PORT, () =>
        console.log(`Server running on port ${PORT}, connected to ${MONGODB_URI}`)
      );
    })
    .catch((err) => {
      console.error('Failed to connect to MongoDB:', err);
      process.exit(1);
    });
}

module.exports = app;
