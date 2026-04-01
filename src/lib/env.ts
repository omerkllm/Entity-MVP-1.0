/**
 * env.ts — Environment variable validation.
 * Imported by db/client.ts so this runs before the pool is created.
 * Missing required variables cause a descriptive startup error.
 */

const REQUIRED_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

type RequiredVar = (typeof REQUIRED_VARS)[number];

function validateEnv(): Record<RequiredVar, string> {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `[env] Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join('\n')}\n` +
        `Copy .env.local.example to .env.local and fill in the values.`,
    );
  }

  return Object.fromEntries(
    REQUIRED_VARS.map((key) => [key, process.env[key] as string]),
  ) as Record<RequiredVar, string>;
}

export const env = validateEnv();
