import { z } from 'zod';

export const SignUpInputSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter'),
  fullName: z.string().trim().optional(),
  firstName: z.string().trim().optional(),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  additionalNames: z.array(z.string().trim()).optional(),
});
export type SignUpInput = z.infer<typeof SignUpInputSchema>;

export const LoginInputSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof LoginInputSchema>;

export const MagicLinkRequestSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
});
export type MagicLinkRequest = z.infer<typeof MagicLinkRequestSchema>;

export const MagicLinkVerifySchema = z.object({
  token: z.string().min(1, 'Magic link token is required'),
});
export type MagicLinkVerify = z.infer<typeof MagicLinkVerifySchema>;

export const PasswordResetRequestSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
});
export type PasswordResetRequest = z.infer<typeof PasswordResetRequestSchema>;

export const PasswordResetConfirmSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase().optional(),
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter'),
});
export type PasswordResetConfirm = z.infer<typeof PasswordResetConfirmSchema>;

export const RefreshTokenInputSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
export type RefreshTokenInput = z.infer<typeof RefreshTokenInputSchema>;

export const VerificationCodeRequestSchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  purpose: z.enum(['EMAIL_VERIFICATION', 'MAGIC_LINK', 'PASSWORD_RESET', 'TWO_FACTOR']).optional().default('EMAIL_VERIFICATION'),
});
export type VerificationCodeRequest = z.infer<typeof VerificationCodeRequestSchema>;

export const VerificationCodeVerifySchema = z.object({
  email: z.string().trim().email('Invalid email address').toLowerCase(),
  code: z.string().min(1, 'Verification code is required'),
  purpose: z.enum(['EMAIL_VERIFICATION', 'MAGIC_LINK', 'PASSWORD_RESET', 'TWO_FACTOR']).optional().default('EMAIL_VERIFICATION'),
});
export type VerificationCodeVerify = z.infer<typeof VerificationCodeVerifySchema>;

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthSessionResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}
