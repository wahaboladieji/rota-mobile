import dotenv from 'dotenv';
dotenv.config();

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || 'postgresql://admin@localhost:5432/rota_test?schema=public';
process.env.DATABASE_REPLICA_URL = process.env.DATABASE_URL;
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_ACCESS_SECRET = 'test-jwt-access-secret-min-32-chars-length';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-min-32-chars-length';
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
