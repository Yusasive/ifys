import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),

  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),

  S3_ENDPOINT: Joi.string().uri().required(),
  S3_REGION: Joi.string().required(),
  S3_BUCKET: Joi.string().required(),

  S3_ACCESS_KEY_ID: Joi.string().optional(),
  S3_SECRET_ACCESS_KEY: Joi.string().optional(),
  S3_FORCE_PATH_STYLE: Joi.string().valid('true', 'false').default('false'),

  CORS_ORIGIN: Joi.string().uri().required(),
  FRONTEND_ORIGIN: Joi.string().uri().required(),

  PAYSTACK_SECRET_KEY: Joi.string().required(),
  PAYSTACK_PUBLIC_KEY: Joi.string().optional(),

  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().required(),
  SMTP_FROM: Joi.string().required(),
  SUPPORT_EMAIL: Joi.string().required(),
  // Optional: local dev (Mailpit) accepts unauthenticated SMTP.
  SMTP_USER: Joi.string().optional(),
  SMTP_PASSWORD: Joi.string().optional(),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.number().required(),

  EVENT_SLUG: Joi.string().optional(),
}).unknown(true);
