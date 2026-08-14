import dotenv from 'dotenv'
import path from 'node:path'
import { z } from 'zod'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  PORT: z.string().default('3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  QWEN_API_KEY: z.string().optional(),
  QWEN_API_ENDPOINT: z.string().optional(),
})

const env = envSchema.parse(process.env)

export const config = {
  databaseUrl: env.DATABASE_URL,
  port: parseInt(env.PORT, 10),
  frontendUrl: env.FRONTEND_URL,
  nodeEnv: env.NODE_ENV,
  hasDatabase: !!env.DATABASE_URL,
  qwenApiKey: env.QWEN_API_KEY,
  qwenApiEndpoint: env.QWEN_API_ENDPOINT,
} as const
