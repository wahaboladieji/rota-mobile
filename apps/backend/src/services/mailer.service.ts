import dotenv from 'dotenv';
dotenv.config();

import nodemailer, { Transporter } from 'nodemailer';
import { serverConfig, providerConfig } from '../config';
import { logger } from '../observability/logger';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface MailerConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
}

/** Active transport mode for the current process. */
type TransportMode = 'brevo' | 'json';

let nodemailerFallback: Transporter | null = null;
let currentTransportMode: TransportMode | null = null;

export const recordedSentEmails: Array<{
  to: string;
  subject: string;
  html: string;
  text?: string;
  messageId?: string;
}> = [];

/**
 * Initialises the email transport.
 *
 * Production / development with `BREVO_API_KEY` → uses Brevo HTTP API
 * (bypasses SMTP entirely — works with any recipient, no domain verification needed).
 *
 * Test environment or missing key → in-memory Nodemailer JSON transport
import { providerConfig, serverConfig } from '../config';

/**
 * Ensures the correct mail transport is initialised.
 * Uses Brevo HTTP API when BREVO_API_KEY is configured.
 * Defaults to Nodemailer JSON transport in test mode or when no API key is set,
 * so tests can inspect payloads without real delivery.
 */
function ensureTransport(): TransportMode {
  if (currentTransportMode) return currentTransportMode;

  const apiKey = providerConfig.brevoApiKey;
  const isTest =
    serverConfig.nodeEnv === 'test' && process.env.TEST_LIVE_EMAIL !== 'true';

  if (!isTest && apiKey && apiKey.trim().length > 0) {
    currentTransportMode = 'brevo';
    logger.info('Email transport: Brevo HTTP API initialised');
  } else {
    // In-memory JSON transport for tests and local dev without credentials
    nodemailerFallback = nodemailer.createTransport({ jsonTransport: true });
    currentTransportMode = 'json';
    logger.info('Email transport: Nodemailer JSON (test/fallback) mode');
  }

  return currentTransportMode;
}

/**
 * Resets the transport (useful in tests to switch configs or clear mocks).
 */
export function resetMailerTransport(): void {
  nodemailerFallback = null;
  currentTransportMode = null;
}

/** @deprecated Use resetMailerTransport(). Kept for backward compatibility. */
export function setMailerTransporter(transporter: Transporter | null): void {
  nodemailerFallback = transporter;
  if (transporter) {
    currentTransportMode = 'json';
  } else {
    resetMailerTransport();
  }
}

/** @deprecated Use ensureTransport(). Returns the Nodemailer instance (json fallback only). */
export function getMailerTransporter(): Transporter {
  ensureTransport();
  if (nodemailerFallback) return nodemailerFallback;
  if (!nodemailerFallback) {
    nodemailerFallback = nodemailer.createTransport({ jsonTransport: true });
  }
  return nodemailerFallback;
}

/**
 * Sends a transactional email via the Brevo v3 HTTP API.
 */
async function sendViaBrevo(
  to: string,
  subject: string,
  html: string,
  text: string,
  senderEmail: string,
  senderName: string,
): Promise<string> {
  const apiKey = providerConfig.brevoApiKey;

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  const body = await response.json() as { messageId?: string; message?: string; code?: string };

  if (!response.ok) {
    throw new Error(
      `Brevo API error (${response.status}): ${body.message || JSON.stringify(body)}`,
    );
  }

  return body.messageId || 'brevo-ok';
}

/**
 * Sends an email via the active transport (Brevo HTTP API or Nodemailer JSON fallback).
 */
export async function sendEmail(
  options: SendEmailOptions,
): Promise<{ success: boolean; messageId?: string }> {
  const mode = ensureTransport();

  // Parse "Name <email>" or just use a plain email address
  const rawFrom = options.from || providerConfig.brevoFrom;

  const fromMatch = rawFrom.match(/^(.+?)\s*<(.+?)>$/);
  const senderName = fromMatch ? fromMatch[1].trim() : 'Rota';
  const senderEmail = fromMatch ? fromMatch[2].trim() : rawFrom.trim();

  try {
    let messageId: string | undefined;

    if (mode === 'brevo') {
      const plainText = options.text || options.html.replace(/<[^>]+>/g, '');
      messageId = await sendViaBrevo(
        options.to,
        options.subject,
        options.html,
        plainText,
        senderEmail,
        senderName,
      );
    } else {
      // JSON fallback (test mode)
      const info = await nodemailerFallback!.sendMail({
        from: rawFrom,
        to: options.to,
        subject: options.subject,
        text: options.text || options.html.replace(/<[^>]+>/g, ''),
        html: options.html,
      });
      messageId = info.messageId;
    }

    recordedSentEmails.push({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      messageId,
    });

    logger.info('Email sent successfully', {
      transport: mode,
      to: options.to,
      subject: options.subject,
      messageId,
    });

    return { success: true, messageId };
  } catch (error) {
    logger.error('Failed to send email', error, {
      transport: mode,
      to: options.to,
      subject: options.subject,
    });
    throw error;
  }
}

/**
 * Sends an email containing a high-entropy cryptographic verification code.
 */
export async function sendVerificationCodeEmail(
  email: string,
  verificationCode: string,
  purpose: string = 'Verification'
): Promise<{ success: boolean; messageId?: string }> {
  const subject = `Your Rota ${purpose} Code`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .logo { font-size: 20px; font-weight: 700; color: #2563eb; letter-spacing: 1px; margin-bottom: 24px; }
    .title { font-size: 22px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .code-box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; letter-spacing: 3px; text-align: center; color: #1e293b; margin: 24px 0; word-break: break-all; }
    .instructions { font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
    .footer { font-size: 13px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">ROTA</div>
    <div class="title">${purpose} Code</div>
    <p class="instructions">Use the following single-use verification code to complete your request. This code is valid for 15 minutes.</p>
    <div class="code-box">${verificationCode}</div>
    <p class="instructions">If you did not make this request, you can safely disregard this email. Your account remains secure.</p>
    <div class="footer">© ${new Date().getFullYear()} Rota. Safe shift scheduling for teams.</div>
  </div>
</body>
</html>
  `.trim();

  const text = `ROTA - ${purpose} Code\n\nYour single-use verification code is:\n${verificationCode}\n\nThis code expires in 15 minutes. If you did not request this, please ignore this email.`;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}

/**
 * Sends a single-use Magic Link email.
 */
export async function sendMagicLinkEmail(
  email: string,
  linkUrl: string
): Promise<{ success: boolean; messageId?: string }> {
  const subject = 'Sign in to Rota';
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .logo { font-size: 20px; font-weight: 700; color: #2563eb; letter-spacing: 1px; margin-bottom: 24px; }
    .title { font-size: 22px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; font-weight: 600; text-decoration: none; margin: 20px 0; }
    .instructions { font-size: 15px; line-height: 1.6; color: #475569; }
    .footer { font-size: 13px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">ROTA</div>
    <div class="title">Sign in to your account</div>
    <p class="instructions">Click the button below to sign in to Rota without entering a password. This link is single-use and will expire in 15 minutes.</p>
    <a href="${linkUrl}" class="btn">Sign In to Rota</a>
    <p class="instructions">If the button doesn't work, copy and paste this URL into your browser:</p>
    <div class="footer">${linkUrl}</div>
  </div>
</body>
</html>
  `.trim();

  const text = `ROTA - Sign In\n\nClick the link below to sign in to Rota:\n${linkUrl}\n\nThis single-use link expires in 15 minutes.`;

  return sendEmail({ to: email, subject, html, text });
}

/**
 * Sends a Password Reset email.
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
  token?: string
): Promise<{ success: boolean; messageId?: string }> {
  const subject = token ? 'Your Rota Password Reset Verification Code' : 'Reset your Rota password';
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .logo { font-size: 20px; font-weight: 700; color: #2563eb; letter-spacing: 1px; margin-bottom: 24px; }
    .title { font-size: 22px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 24px; border-radius: 8px; font-weight: 600; text-decoration: none; margin: 20px 0; }
    .code-box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; font-family: monospace; font-size: 18px; font-weight: 700; letter-spacing: 2px; text-align: center; color: #1e293b; margin: 20px 0; word-break: break-all; }
    .instructions { font-size: 15px; line-height: 1.6; color: #475569; }
    .footer { font-size: 13px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">ROTA</div>
    <div class="title">Password Reset Verification Code</div>
    <p class="instructions">We received a request to reset your password. Use the verification code below in the Rota app to set your new password:</p>
    ${token ? `<div class="code-box">${token}</div>` : ''}
    <p class="instructions">This single-use verification code is valid for 1 hour. Alternatively, click the button below:</p>
    <div style="text-align: center;">
      <a href="${resetUrl}" class="btn">Reset Password in App</a>
    </div>
    <p class="instructions" style="margin-top: 20px;">If you did not request a password reset, you can safely ignore this email.</p>
    <div class="footer">${resetUrl}</div>
  </div>
</body>
</html>
  `.trim();

  const text = `ROTA - Password Reset Verification Code\n\nYour single-use password reset verification code is:\n${token || ''}\n\nEnter this code in the app to set a new password. This code expires in 1 hour.\n\nReset Link: ${resetUrl}\n\nIf you did not request this, please ignore this email.`;

  return sendEmail({ to: email, subject, html, text });
}

/**
 * Sends a team invitation email.
 */
export async function sendInvitationEmail(
  email: string,
  teamName: string,
  role: string,
  inviteUrl: string,
  token?: string
): Promise<{ success: boolean; messageId?: string }> {
  const subject = `You've been invited to join ${teamName} on Rota`;
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .logo { font-size: 20px; font-weight: 700; color: #2563eb; letter-spacing: 1px; margin-bottom: 24px; }
    .title { font-size: 22px; font-weight: 700; color: #0f172a; margin-bottom: 8px; }
    .subtitle { font-size: 15px; color: #64748b; margin-bottom: 20px; }
    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 14px 28px; border-radius: 9999px; font-weight: 700; text-decoration: none; margin: 16px 0; font-size: 15px; }
    .code-box { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 10px; padding: 16px; font-family: monospace; font-size: 16px; font-weight: 700; letter-spacing: 1.5px; text-align: center; color: #1e293b; margin: 16px 0; word-break: break-all; }
    .instructions { font-size: 14px; line-height: 1.6; color: #475569; }
    .footer { font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px; margin-top: 24px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">ROTA</div>
    <div class="title">Join ${teamName}</div>
    <div class="subtitle">You have been invited to join the team as <strong>${role}</strong>.</div>
    <p class="instructions">Click below to open Rota and accept your single-use invitation. This invitation is valid for 7 days.</p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="${inviteUrl}" class="btn">Accept Invitation</a>
    </div>
    ${token ? `
    <p class="instructions">Or if you already have the Rota app installed, use your invitation code:</p>
    <div class="code-box">${token}</div>
    ` : ''}
    <p class="instructions">If you weren't expecting this invitation, you can safely ignore this email.</p>
    <div class="footer">${inviteUrl}</div>
  </div>
</body>
</html>
  `.trim();

  const text = `ROTA - Team Invitation\n\nYou have been invited to join ${teamName} on Rota as ${role}.\n\nAccept your invitation by visiting:\n${inviteUrl}\n\n${token ? `Invitation token: ${token}\n\n` : ''}This invitation is valid for 7 days.`;

  return sendEmail({ to: email, subject, html, text });
}

