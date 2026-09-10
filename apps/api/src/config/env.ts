import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { z } from 'zod'

const envFile = fileURLToPath(new URL('../../.env', import.meta.url))
dotenv.config({ path: envFile })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_ORIGIN: z.string().url().default('http://localhost:5181'),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_NAME: z.string().default('morya_studio'),
  DB_USER: z.string().default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_SSL: z.preprocess(value => value === true || value === 'true', z.boolean().default(false)),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(5),
})

export type AppConfig = z.infer<typeof envSchema>

export function getConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  return envSchema.parse(env)
}
