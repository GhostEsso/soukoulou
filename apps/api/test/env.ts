// Valeurs de test uniquement : base dédiée, secrets factices.
process.env.DATABASE_URL =
  'postgresql://soukoulou:soukoulou@localhost:5433/soukoulou_test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.PAYMENT_WEBHOOK_SECRET = 'test-webhook-secret';
// MinIO local (docker compose up -d minio), bucket dédié aux tests.
process.env.S3_ENDPOINT = 'http://localhost:9000';
process.env.S3_ACCESS_KEY = 'soukoulou';
process.env.S3_SECRET_KEY = 'soukoulou-dev-secret';
process.env.S3_BUCKET = 'soukoulou-test';
process.env.WEB_URL = 'http://localhost:3000';
process.env.SEED_ADMIN_EMAIL = 'admin@test.local';
process.env.SEED_ADMIN_PASSWORD = 'Admin-Test-123';
