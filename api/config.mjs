import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().optional(),
  CAPITAL_API_PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(["true", "false"]).default("false"),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  CAPITAL_ADMIN_API_TOKEN: z.string().min(32).optional(),
  CORS_ORIGIN: z.string().default("http://localhost:5173,http://127.0.0.1:5173"),
  PARTNER_TOKEN_REQUIRED: z.enum(["true", "false"]).default("true"),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV !== "production") return;
  if (!env.CAPITAL_ADMIN_API_TOKEN) {
    ctx.addIssue({
      code: "custom",
      path: ["CAPITAL_ADMIN_API_TOKEN"],
      message: "CAPITAL_ADMIN_API_TOKEN is required in production.",
    });
  }
  if (env.CORS_ORIGIN.split(",").some((origin) => origin.trim() === "*")) {
    ctx.addIssue({
      code: "custom",
      path: ["CORS_ORIGIN"],
      message: "Production CORS_ORIGIN must list exact frontend origins, not '*'.",
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const summary = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
  throw new Error(`Invalid Capital Gateway API environment: ${summary}`);
}

export const apiConfig = {
  ...parsed.data,
  port: parsed.data.PORT ?? parsed.data.CAPITAL_API_PORT,
  corsOrigins: parsed.data.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
  partnerTokenRequired: parsed.data.PARTNER_TOKEN_REQUIRED === "true",
  isProduction: parsed.data.NODE_ENV === "production",
};
