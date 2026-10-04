import { z } from "~/lib/zod"

export function createAuthFormSchemas(t: (key: string) => string) {
  const emailSchema = z
    .string()
    .trim()
    .min(1, t("email.required"))
    .pipe(z.email(t("email.invalid")))

  return {
    sendOtp: z.object({
      email: emailSchema,
      otp: z.string(),
    }),
    signIn: z.object({
      email: emailSchema,
      otp: z.string().trim().min(6, t("otp.invalid")),
    }),
  }
}
