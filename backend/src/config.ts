import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.string().default('3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

const env = envSchema.parse(process.env)

export const config = {
  databaseUrl: env.DATABASE_URL,
  port: parseInt(env.PORT, 10),
  frontendUrl: env.FRONTEND_URL,
  nodeEnv: env.NODE_ENV,
} as const
