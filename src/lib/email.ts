import nodemailer from "nodemailer";
import { Resend } from "resend";

function env(name: string): string | null {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : null;
}

let warnedDisabled = false;

export function isEmailConfigured() {
  const from = env("MAIL_FROM");
  if (!from) return false;
  return Boolean(env("RESEND_API_KEY") || (env("SMTP_HOST") && env("SMTP_PORT") && env("SMTP_USER") && env("SMTP_PASS")));
}

function getTransport() {
  const host = env("SMTP_HOST");
  const portRaw = env("SMTP_PORT");
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");

  if (!host || !portRaw || !user || !pass) throw new Error("Email not configured");

  const port = Number(portRaw);
  const secure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
}

export async function sendEmail(args: { to: string; subject: string; text: string }) {
  if (!isEmailConfigured()) {
    if (!warnedDisabled) {
      warnedDisabled = true;
      console.warn("email:disabled (set RESEND_API_KEY+MAIL_FROM or SMTP_*+MAIL_FROM)");
    }
    return;
  }

  const from = env("MAIL_FROM");
  if (!from) return;

  try {
    const resendKey = env("RESEND_API_KEY");
    if (resendKey) {
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from,
        to: args.to,
        subject: args.subject,
        text: args.text
      });
      console.info(`email:sent(provider=resend) to=${args.to} subject=${JSON.stringify(args.subject)}`);
      return;
    }

    const transporter = getTransport();
    await transporter.sendMail({
      from,
      to: args.to,
      subject: args.subject,
      text: args.text
    });
    console.info(`email:sent(provider=smtp) to=${args.to} subject=${JSON.stringify(args.subject)}`);
  } catch (e: any) {
    console.error(`email:failed to=${args.to} err=${String(e?.message || e)}`);
  }
}


