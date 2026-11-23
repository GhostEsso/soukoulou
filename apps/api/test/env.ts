// Valeurs de test uniquement : base dédiée, secrets factices.
process.env.DATABASE_URL =
  'postgresql://soukoulou:soukoulou@localhost:5433/soukoulou_test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.UPLOAD_DIR = require('node:path').join(
  require('node:os').tmpdir(),
  'soukoulou-test-uploads',
);
process.env.WEB_URL = 'http://localhost:3000';
process.env.SEED_ADMIN_EMAIL = 'admin@test.local';
process.env.SEED_ADMIN_PASSWORD = 'Admin-Test-123';
