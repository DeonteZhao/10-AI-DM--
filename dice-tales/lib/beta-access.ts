export const BETA_ACCESS_TOKEN_COOKIE_NAME = "dice_tales_beta_access_token";
export const BETA_ACCESS_STATE_HEADER = "x-dice-tales-beta-verified";
export const BETA_ACCESS_STORAGE_KEY = "dice-tales-beta-access";

export type BetaAccessCache = {
  verified: true;
  email: string | null;
  expiresAt: string;
  token: string | null;
  cachedAt: string;
};

export type BetaAccessSession = {
  authenticated: true;
  email: string;
  expires_at: string;
};

export type BetaAccessVerifyResult = {
  email: string;
  verified: true;
  credential: {
    token: string;
    expires_at: string;
  };
};

export type BetaAccessSendCodeResult = {
  status: "otp_sent" | "waitlist_required";
  email: string;
  historical_user: boolean;
  waitlist_open: boolean;
  expires_in_seconds: number | null;
  resend_available_in_seconds: number | null;
};

export type BetaAccessSendCodeError = {
  detail?: string;
  status?: "rate_limited";
  email?: string;
  resend_available_in_seconds?: number | null;
  expires_in_seconds?: number | null;
  active_code_available?: boolean;
};

export type BetaAccessWaitlistResult = {
  email: string;
  status: "active";
  created: boolean;
};

export function isProtectedPlayerPath(pathname: string) {
  return !pathname.startsWith("/admin");
}

export function isBetaAccessApiPath(path: string[]) {
  return path[0] === "beta-access";
}

export function isAdminApiPath(path: string[]) {
  return path[0] === "admin";
}

export function isBetaAccessCacheValid(expiresAt: string | null | undefined) {
  if (!expiresAt) {
    return false;
  }
  const expiresAtTime = Date.parse(expiresAt);
  if (Number.isNaN(expiresAtTime)) {
    return false;
  }
  return expiresAtTime > Date.now();
}
