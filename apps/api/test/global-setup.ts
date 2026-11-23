import { execSync } from 'node:child_process';

export default function globalSetup() {
  require('./env');
  // Non destructif : applique les migrations et le seed (idempotent) sur la base de test.
  execSync('npx prisma migrate deploy && npx prisma db seed', {
    stdio: 'inherit',
    env: process.env,
  });
}
