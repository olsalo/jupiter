import { fallbackLanguage, supportedLanguages } from "~/locales"

export type EmailLocale = (typeof supportedLanguages)[number]

export type OtpEmailType =
  | "sign-in"
  | "email-verification"
  | "forget-password"
  | "change-email"

export interface OtpEmailTemplate {
  html: string
  subject: string
  text: string
}

interface OtpEmailTemplateOptions {
  expiresInMinutes: number
  locale: EmailLocale
  otp: string
  type: OtpEmailType
}

export function createOtpEmailTemplate({
  expiresInMinutes,
  locale,
  otp,
  type,
}: OtpEmailTemplateOptions): OtpEmailTemplate {
  const copy = getCopy(locale, type)
  const safeOtp = escapeHtml(otp)
  const safeTitle = escapeHtml(copy.title)
  const safeIntro = escapeHtml(copy.intro)
  const safeExpiry = escapeHtml(copy.expiry(expiresInMinutes))
  const safeIgnore = escapeHtml(copy.ignore)
  const text = [
    copy.text(otp),
    copy.expiry(expiresInMinutes),
    copy.ignore,
  ].join("\n\n")

  return {
    html: `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;background:#f5f5f4;color:#1c1917;font-family:Arial,Helvetica,sans-serif">
    <div style="padding:40px 16px">
      <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e7e5e4;border-radius:16px;padding:40px 32px">
        <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3">${safeTitle}</h1>
        <p style="margin:0;color:#57534e;font-size:16px;line-height:1.6">${safeIntro} ${safeExpiry}</p>
        <div style="margin:28px 0;padding:18px;border-radius:12px;background:#f5f5f4;text-align:center">
          <span style="color:#1c1917;font-size:32px;font-weight:700;letter-spacing:.24em">${safeOtp}</span>
        </div>
        <p style="margin:0;color:#78716c;font-size:14px;line-height:1.6">${safeIgnore}</p>
      </div>
    </div>
  </body>
</html>`,
    subject: copy.subject,
    text,
  }
}

function getCopy(locale: EmailLocale, type: OtpEmailType) {
  if (locale === "fi") {
    const copy = {
      "change-email": {
        expiry: (minutes: number) => `Koodi vanhenee ${minutes} minuutin kuluttua.`,
        ignore: "Jos et pyytänyt tätä koodia, voit jättää tämän viestin huomiotta.",
        intro: "Käytä alla olevaa koodia jatkaaksesi.",
        subject: "Vahvista uusi sähköpostiosoitteesi",
        text: (otp: string) => `Vahvistuskoodisi on ${otp}.`,
        title: "Vahvista uusi sähköpostiosoitteesi",
      },
      "email-verification": {
        expiry: (minutes: number) => `Koodi vanhenee ${minutes} minuutin kuluttua.`,
        ignore: "Jos et pyytänyt tätä koodia, voit jättää tämän viestin huomiotta.",
        intro: "Käytä alla olevaa koodia jatkaaksesi.",
        subject: "Vahvista sähköpostiosoitteesi",
        text: (otp: string) => `Vahvistuskoodisi on ${otp}.`,
        title: "Vahvista sähköpostiosoitteesi",
      },
      "forget-password": {
        expiry: (minutes: number) => `Koodi vanhenee ${minutes} minuutin kuluttua.`,
        ignore: "Jos et pyytänyt tätä koodia, voit jättää tämän viestin huomiotta.",
        intro: "Käytä alla olevaa koodia jatkaaksesi.",
        subject: "Salasanan palautuskoodi",
        text: (otp: string) => `Salasanan palautuskoodisi on ${otp}.`,
        title: "Salasanan palautuskoodi",
      },
      "sign-in": {
        expiry: (minutes: number) => `Koodi vanhenee ${minutes} minuutin kuluttua.`,
        ignore: "Jos et pyytänyt tätä koodia, voit jättää tämän viestin huomiotta.",
        intro: "Käytä alla olevaa koodia kirjautuaksesi.",
        subject: "Kirjautumiskoodisi",
        text: (otp: string) => `Kirjautumiskoodisi on ${otp}.`,
        title: "Kirjautumiskoodisi",
      },
    } as const

    return copy[type]
  }

  const copy = {
    "change-email": {
      expiry: (minutes: number) => `It expires in ${minutes} minutes.`,
      ignore: "If you did not request this code, you can safely ignore this email.",
      intro: "Use the code below to continue.",
      subject: "Your email change code",
      text: (otp: string) => `Your email change code is ${otp}.`,
      title: "Your email change code",
    },
    "email-verification": {
      expiry: (minutes: number) => `It expires in ${minutes} minutes.`,
      ignore: "If you did not request this code, you can safely ignore this email.",
      intro: "Use the code below to continue.",
      subject: "Your email verification code",
      text: (otp: string) => `Your email verification code is ${otp}.`,
      title: "Your email verification code",
    },
    "forget-password": {
      expiry: (minutes: number) => `It expires in ${minutes} minutes.`,
      ignore: "If you did not request this code, you can safely ignore this email.",
      intro: "Use the code below to continue.",
      subject: "Your password reset code",
      text: (otp: string) => `Your password reset code is ${otp}.`,
      title: "Your password reset code",
    },
    "sign-in": {
      expiry: (minutes: number) => `It expires in ${minutes} minutes.`,
      ignore: "If you did not request this code, you can safely ignore this email.",
      intro: "Use the code below to sign in.",
      subject: "Your sign-in code",
      text: (otp: string) => `Your sign-in code is ${otp}.`,
      title: "Your sign-in code",
    },
  } as const

  return copy[type]
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  )
}
