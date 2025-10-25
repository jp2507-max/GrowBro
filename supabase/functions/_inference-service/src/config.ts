import { z } from 'zod';

const configSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  MODEL_PATH: z.string().nonempty().optional(),
  MODEL_VERSION: z.string().nonempty().optional(),
});

export const config = configSchema.parse({
  PORT: process.env.PORT,
  MODEL_PATH: process.env.MODEL_PATH,
  MODEL_VERSION: process.env.MODEL_VERSION,
});

export type AppConfig = typeof config;
