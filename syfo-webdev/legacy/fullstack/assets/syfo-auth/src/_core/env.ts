import 'server-only';

export interface SyfoRuntimeEnv {
  databaseUrl?: string;
  forgeApiUrl?: string;
  forgeApiKey?: string;
  frontendForgeApiKey?: string;
  jwtSecret?: string;
}

export function readSyfoRuntimeEnv(): SyfoRuntimeEnv {
  return {
    databaseUrl: process.env.DATABASE_URL,
    forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL,
    forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY,
    frontendForgeApiKey: process.env.VITE_FRONTEND_FORGE_API_KEY,
    jwtSecret: process.env.JWT_SECRET,
  };
}

export function requireSyfoRuntimeEnv(...keys: Array<keyof SyfoRuntimeEnv>): SyfoRuntimeEnv {
  const env = readSyfoRuntimeEnv();
  for (const key of keys) {
    if (!env[key]) throw new Error(`Missing required Syfo runtime environment: ${key}`);
  }
  return env;
}
