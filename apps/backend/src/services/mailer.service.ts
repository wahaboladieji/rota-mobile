import dotenv from 'dotenv';
dotenv.config();

import nodemailer, { Transporter } from 'nodemailer';
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

let transporterInstance: Transporter | null = null;
let currentTransporterType: 'smtp' | 'json' | null = null;
export const recordedSentEmails: Array<{
  to: string;
  subject: string;
  html: string;
  text?: string;
  messageId?: string;
}> = [];

/**
 * Creates or retrieves the singleton Nodemailer transporter.
 * Supports SMTP configuration via environment variables.
 * Falls back to in-memory JSON/stream transport in test/development environments
 * when no SMTP host is configured, preventing network timeouts and connection errors.
 */
export function getMailerTransporter(): Transporter {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const isTest = process.env.NODE_ENV === 'test' && process.env.TEST_LIVE_SMTP !== 'true';
  const hasSmtpConfig = !isTest && !!(host && host.trim().length > 0 && host !== 'localhost');

  if (transporterInstance) {
    // If real SMTP is configured and we were using fallback json, refresh to real SMTP
    if (hasSmtpConfig && currentTransporterType === 'json') {
      transporterInstance = null;
    } else {
      return transporterInstance;
    }
  }

  if (hasSmtpConfig) {
    transporterInstance = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    currentTransporterType = 'smtp';
    logger.info('Nodemailer SMTP transporter initialized', { host, port, secure });
  } else {
    // In-memory JSON transport for tests and local dev without live SMTP credentials
    transporterInstance = nodemailer.createTransport({
      jsonTransport: true,
    });
    currentTransporterType = 'json';
    logger.info('Nodemailer initialized in test/fallback JSON transport mode');
  }

  return transporterInstance;
}

/**
 * Resets the transporter instance (useful in testing to switch configs or clear mocks).
 */
export function setMailerTransporter(transporter: Transporter | null): void {
  transporterInstance = transporter;
}

/**
 * Sends a generic email using Nodemailer.
 */
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string }> {
  const transporter = getMailerTransporter();
  const defaultFrom = process.env.SMTP_FROM || 'Rota <noreply@rota.app>';

  try {
    const info = await transporter.sendMail({
      from: options.from || defaultFrom,
      to: options.to,
      subject: options.subject,
      text: options.text || options.html.replace(/<[^>]+>/g, ''),
      html: options.html,
    });

    recordedSentEmails.push({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      messageId: info.messageId,
    });

    logger.info('Email sent successfully via Nodemailer', {
      to: options.to,
      subject: options.subject,
      messageId: info.messageId,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Failed to send email via Nodemailer', error, {
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

