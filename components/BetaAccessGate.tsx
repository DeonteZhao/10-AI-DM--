"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { CircleNotch, EnvelopeSimple, LockSimple, PaperPlaneTilt } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  BETA_ACCESS_STORAGE_KEY,
  type BetaAccessCache,
  type BetaAccessSendCodeError,
  type BetaAccessSendCodeResult,
  type BetaAccessSession,
  type BetaAccessVerifyResult,
  type BetaAccessWaitlistResult,
  isBetaAccessCacheValid,
  isProtectedPlayerPath,
} from "@/lib/beta-access";

type BetaAccessContextValue = {
  isProtectedRoute: boolean;
  isAuthenticated: boolean;
  isChecking: boolean;
  isReady: boolean;
};

type BetaAccessGateProps = {
  children: React.ReactNode;
  initialAccessGranted: boolean;
};

type GateStatus = "checking" | "locked" | "authenticated";
type GateStep = "email" | "code" | "waitlist";

const BetaAccessContext = createContext<BetaAccessContextValue>({
  isProtectedRoute: false,
  isAuthenticated: true,
  isChecking: false,
  isReady: true,
});

function readCachedAccess() {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(BETA_ACCESS_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as BetaAccessCache;
  } catch {
    return null;
  }
}

function writeCachedAccess(cache: BetaAccessCache) {
  window.localStorage.setItem(BETA_ACCESS_STORAGE_KEY, JSON.stringify(cache));
}

function clearCachedAccess() {
  window.localStorage.removeItem(BETA_ACCESS_STORAGE_KEY);
}

function futureTimeFromSeconds(seconds: number | null | undefined) {
  if (!seconds || seconds <= 0) {
    return null;
  }
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function getRemainingSeconds(targetTime: string | null, clockMs: number) {
  if (!targetTime) {
    return 0;
  }
  const targetMs = Date.parse(targetTime);
  if (Number.isNaN(targetMs)) {
    return 0;
  }
  return Math.max(0, Math.ceil((targetMs - clockMs) / 1000));
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainSeconds).padStart(2, "0")}`;
}

async function parseJsonResponse<T>(response: Response) {
  const text = await response.text();
  if (!text.trim()) {
    return null as T | null;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return null as T | null;
  }
}

export function useBetaAccess() {
  return useContext(BetaAccessContext);
}

export function BetaAccessGate({ children, initialAccessGranted }: BetaAccessGateProps) {
  const pathname = usePathname();
  const isProtectedRoute = isProtectedPlayerPath(pathname);
  const [gateStatus, setGateStatus] = useState<GateStatus>(isProtectedRoute ? "checking" : "authenticated");
  const [step, setStep] = useState<GateStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [joiningWaitlist, setJoiningWaitlist] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitlistJoined, setWaitlistJoined] = useState(false);
  const [resendAvailableAt, setResendAvailableAt] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  const [clockMs, setClockMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isProtectedRoute) {
      setGateStatus("authenticated");
      return;
    }

    if (initialAccessGranted) {
      setGateStatus("authenticated");
      setError(null);
      setMessage(null);
      return;
    }

    let disposed = false;
    const cachedAccess = readCachedAccess();
    if (cachedAccess?.email) {
      setEmail(cachedAccess.email);
    }
    setGateStatus("checking");
    setError(null);

    const syncAccess = async () => {
      const headers = new Headers();
      if (cachedAccess?.token && isBetaAccessCacheValid(cachedAccess.expiresAt)) {
        headers.set("Authorization", `Bearer ${cachedAccess.token}`);
      }
      try {
        const response = await fetch("/api/backend/beta-access/session", {
          method: "GET",
          headers,
          cache: "no-store",
        });
        if (disposed) {
          return;
        }
        if (!response.ok) {
          clearCachedAccess();
          setGateStatus("locked");
          setStep("email");
          return;
        }
        const session = await parseJsonResponse<BetaAccessSession>(response);
        if (!session) {
          throw new Error("准入状态返回为空，请确认本地后端是否已启动");
        }
        writeCachedAccess({
          verified: true,
          email: session.email,
          expiresAt: session.expires_at,
          token: cachedAccess?.token || null,
          cachedAt: new Date().toISOString(),
        });
        setEmail(session.email);
        setMessage(null);
        setError(null);
        setWaitlistJoined(false);
        setResendAvailableAt(null);
        setCodeExpiresAt(null);
        setCode("");
        setStep("email");
        setGateStatus("authenticated");
      } catch {
        if (disposed) {
          return;
        }
        if (
          initialAccessGranted
          || (cachedAccess?.token && isBetaAccessCacheValid(cachedAccess.expiresAt))
        ) {
          setGateStatus("authenticated");
          return;
        }
        clearCachedAccess();
        setGateStatus("locked");
        setStep("email");
      }
    };

    void syncAccess();
    return () => {
      disposed = true;
    };
  }, [initialAccessGranted, isProtectedRoute, pathname]);

  useEffect(() => {
    if (step !== "code" || (!resendAvailableAt && !codeExpiresAt)) {
      return;
    }
    setClockMs(Date.now());
    const timer = window.setInterval(() => {
      setClockMs(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [codeExpiresAt, resendAvailableAt, step]);

  const contextValue = useMemo<BetaAccessContextValue>(
    () => ({
      isProtectedRoute,
      isAuthenticated: !isProtectedRoute || gateStatus === "authenticated",
      isChecking: isProtectedRoute && gateStatus === "checking",
      isReady: !isProtectedRoute || gateStatus === "authenticated",
    }),
    [gateStatus, isProtectedRoute],
  );

  const resendRemainingSeconds = getRemainingSeconds(resendAvailableAt, clockMs);
  const codeExpiresRemainingSeconds = getRemainingSeconds(codeExpiresAt, clockMs);

  const applySendTiming = (payload: { resend_available_in_seconds?: number | null; expires_in_seconds?: number | null }) => {
    setClockMs(Date.now());
    setResendAvailableAt(futureTimeFromSeconds(payload.resend_available_in_seconds));
    setCodeExpiresAt(futureTimeFromSeconds(payload.expires_in_seconds));
  };

  const handleSendCode = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("请输入邮箱地址");
      return;
    }
    setSending(true);
    setError(null);
    setMessage(null);
    setWaitlistJoined(false);
    try {
      const response = await fetch("/api/backend/beta-access/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const payload = await parseJsonResponse<BetaAccessSendCodeResult | BetaAccessSendCodeError>(response);
      if (!payload) {
        throw new Error("发送验证码接口没有返回有效数据，请确认本地后端是否已启动");
      }
      if (!response.ok) {
        const sendError = payload as BetaAccessSendCodeError;
        if (sendError.status === "rate_limited") {
          applySendTiming(sendError);
          if (sendError.active_code_available) {
            setStep("code");
            setMessage("验证码仍然有效，可以直接输入；如需重发，请等待冷却结束。");
          }
        }
        throw new Error(sendError.detail || "验证码发送失败，请稍后重试");
      }
      const sendResult = payload as BetaAccessSendCodeResult;
      if (sendResult.status === "waitlist_required") {
        setResendAvailableAt(null);
        setCodeExpiresAt(null);
        setStep("waitlist");
        setMessage("当前内测名额已满，可以登记 waitlist，我们会在开放后通知你。");
        return;
      }
      applySendTiming(sendResult);
      setStep("code");
      setCode("");
      setMessage(
        sendResult.historical_user
          ? "验证码已发送，欢迎回来。"
          : "验证码已发送到你的邮箱，请输入 6 位数字验证码。",
      );
    } catch (nextError) {
      setError((nextError as Error).message || "验证码发送失败，请稍后重试");
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.trim().length !== 6) {
      setError("请输入 6 位验证码");
      return;
    }
    setVerifying(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/backend/beta-access/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      const payload = await parseJsonResponse<BetaAccessVerifyResult | { detail?: string }>(response);
      if (!payload) {
        throw new Error("验证码校验接口没有返回有效数据，请确认本地后端是否已启动");
      }
      if (!response.ok) {
        throw new Error("detail" in payload ? payload.detail || "验证码校验失败" : "验证码校验失败");
      }
      const verifyResult = payload as BetaAccessVerifyResult;
      writeCachedAccess({
        verified: true,
        email: verifyResult.email,
        expiresAt: verifyResult.credential.expires_at,
        token: verifyResult.credential.token,
        cachedAt: new Date().toISOString(),
      });
      setGateStatus("authenticated");
      setCode("");
      setError(null);
      setMessage(null);
      setWaitlistJoined(false);
      setResendAvailableAt(null);
      setCodeExpiresAt(null);
      setStep("email");
    } catch (nextError) {
      setError((nextError as Error).message || "验证码校验失败");
    } finally {
      setVerifying(false);
    }
  };

  const handleJoinWaitlist = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("请输入邮箱地址");
      return;
    }
    setJoiningWaitlist(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/backend/beta-access/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          source_status: "beta_capacity_full",
        }),
      });
      const payload = await parseJsonResponse<BetaAccessWaitlistResult | { detail?: string }>(response);
      if (!payload) {
        throw new Error("waitlist 接口没有返回有效数据，请确认本地后端是否已启动");
      }
      if (!response.ok) {
        throw new Error("detail" in payload ? payload.detail || "waitlist 登记失败，请稍后重试" : "waitlist 登记失败，请稍后重试");
      }
      const waitlistResult = payload as BetaAccessWaitlistResult;
      setWaitlistJoined(true);
      setMessage(waitlistResult.created ? "已加入 waitlist，开放新名额后会优先通知你。" : "你已在 waitlist 中，我们已更新最近登记时间。");
    } catch (nextError) {
      setError((nextError as Error).message || "waitlist 登记失败，请稍后重试");
    } finally {
      setJoiningWaitlist(false);
    }
  };

  const shouldRenderOverlay = isProtectedRoute && gateStatus !== "authenticated";

  return (
    <BetaAccessContext.Provider value={contextValue}>
      <div className={shouldRenderOverlay ? "pointer-events-none select-none blur-[3px] opacity-60 transition-all" : ""}>
        {children}
      </div>
      {shouldRenderOverlay && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[var(--bg-color)]/88 px-6 py-10 backdrop-blur-sm">
          {gateStatus === "checking" ? (
            <div className="w-full max-w-xl bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[8px_8px_0_var(--ink-color)] p-10 text-[var(--ink-color)] font-huiwen">
              <div className="flex items-center gap-4 text-3xl font-black tracking-widest uppercase">
                <CircleNotch className="h-8 w-8 animate-spin" weight="bold" />
                正在校验内测资格
              </div>
              <p className="mt-4 text-lg font-bold tracking-wide opacity-80">
                正在同步邮箱准入状态，请稍候。
              </p>
            </div>
          ) : (
            <div className="w-full max-w-2xl bg-theme-bg border-[3px] border-[var(--ink-color)] shadow-[10px_10px_0_var(--ink-color)] text-[var(--ink-color)] font-huiwen overflow-hidden">
              <div className="border-b-[3px] border-[var(--ink-color)] bg-[var(--paper-light)] px-8 py-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center border-[3px] border-[var(--ink-color)] bg-[var(--ink-color)] text-[var(--bg-color)] shadow-[4px_4px_0_var(--accent-color)]">
                    {step === "code" ? <EnvelopeSimple className="h-7 w-7" weight="fill" /> : <LockSimple className="h-7 w-7" weight="fill" />}
                  </div>
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.35em] opacity-60">BETA ACCESS</div>
                    <h2 className="mt-2 text-4xl font-black uppercase tracking-widest riso-title">
                      先完成邮箱验证
                    </h2>
                  </div>
                </div>
                <p className="mt-4 text-base font-bold leading-relaxed opacity-80">
                  当前前台处于内测阶段，完成邮箱验证码验证后，才会开放页面与数据请求。
                </p>
              </div>
              <div className="space-y-6 px-8 py-8 bg-theme-bg">
                <div>
                  <label className="mb-3 block text-sm font-black uppercase tracking-[0.2em]">
                    邮箱地址
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    disabled={sending || verifying || joiningWaitlist}
                    className="h-14 rounded-none border-[3px] border-[var(--ink-color)] bg-[var(--paper-light)] px-4 text-lg font-bold shadow-[4px_4px_0_var(--ink-color)] placeholder:text-[var(--ink-color)] placeholder:opacity-35 focus-visible:ring-0"
                  />
                </div>

                {step === "code" && (
                  <div>
                    <label className="mb-3 block text-sm font-black uppercase tracking-[0.2em]">
                      邮箱验证码
                    </label>
                    <InputOTP
                      value={code}
                      onChange={setCode}
                      maxLength={6}
                      containerClassName="justify-center"
                      disabled={verifying}
                    >
                      <InputOTPGroup className="gap-2">
                        {Array.from({ length: 6 }).map((_, index) => (
                          <InputOTPSlot
                            key={index}
                            index={index}
                            className="h-14 w-12 rounded-none border-[3px] border-[var(--ink-color)] bg-[var(--paper-light)] text-xl font-black"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                    <div className="mt-3 space-y-1 text-sm font-bold tracking-wide opacity-70">
                      <p>
                        {codeExpiresRemainingSeconds > 0
                          ? `验证码将在 ${formatCountdown(codeExpiresRemainingSeconds)} 后失效。`
                          : "验证码已过期，请重新发送。"}
                      </p>
                      <p>
                        {resendRemainingSeconds > 0
                          ? `可在 ${formatCountdown(resendRemainingSeconds)} 后重新发送。`
                          : "没收到验证码时，可以重新发送。"}
                      </p>
                    </div>
                  </div>
                )}

                {message && (
                  <div className="border-[3px] border-[var(--ink-color)] bg-[var(--paper-light)] px-5 py-4 text-base font-bold tracking-wide">
                    {message}
                  </div>
                )}

                {error && (
                  <div className="border-[3px] border-[var(--accent-color)] bg-[var(--paper-light)] px-5 py-4 text-base font-bold tracking-wide text-[var(--accent-color)]">
                    {error}
                  </div>
                )}

                <div className="flex flex-wrap gap-4">
                  {step !== "code" && (
                    <button
                      type="button"
                      onClick={() => void handleSendCode()}
                      disabled={sending || verifying || joiningWaitlist}
                      className="inline-flex min-h-14 items-center justify-center gap-3 bg-[var(--ink-color)] px-6 py-4 text-lg font-black uppercase tracking-widest text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] disabled:opacity-60"
                    >
                      {sending ? <CircleNotch className="h-5 w-5 animate-spin" weight="bold" /> : <PaperPlaneTilt className="h-5 w-5" weight="fill" />}
                      发送验证码
                    </button>
                  )}
                  {step === "code" && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleVerifyCode()}
                        disabled={verifying || code.trim().length !== 6}
                        className="inline-flex min-h-14 items-center justify-center gap-3 bg-[var(--ink-color)] px-6 py-4 text-lg font-black uppercase tracking-widest text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] disabled:opacity-60"
                      >
                        {verifying ? <CircleNotch className="h-5 w-5 animate-spin" weight="bold" /> : <LockSimple className="h-5 w-5" weight="fill" />}
                        验证并进入
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSendCode()}
                        disabled={sending || verifying || resendRemainingSeconds > 0}
                        className="inline-flex min-h-14 items-center justify-center gap-3 bg-[var(--paper-light)] px-6 py-4 text-lg font-black uppercase tracking-widest text-[var(--ink-color)] border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] disabled:opacity-60"
                      >
                        {sending ? <CircleNotch className="h-5 w-5 animate-spin" weight="bold" /> : <EnvelopeSimple className="h-5 w-5" weight="fill" />}
                        {resendRemainingSeconds > 0 ? `${formatCountdown(resendRemainingSeconds)} 后重发` : "重新发送"}
                      </button>
                    </>
                  )}
                  {step === "waitlist" && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleJoinWaitlist()}
                        disabled={joiningWaitlist || waitlistJoined}
                        className="inline-flex min-h-14 items-center justify-center gap-3 bg-[var(--accent-color)] px-6 py-4 text-lg font-black uppercase tracking-widest text-[var(--bg-color)] border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] disabled:opacity-60"
                      >
                        {joiningWaitlist ? <CircleNotch className="h-5 w-5 animate-spin" weight="bold" /> : <EnvelopeSimple className="h-5 w-5" weight="fill" />}
                        加入 waitlist
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setStep("email");
                          setMessage(null);
                          setError(null);
                        }}
                        disabled={joiningWaitlist}
                        className="inline-flex min-h-14 items-center justify-center gap-3 bg-[var(--paper-light)] px-6 py-4 text-lg font-black uppercase tracking-widest text-[var(--ink-color)] border-[3px] border-[var(--ink-color)] shadow-[4px_4px_0_var(--ink-color)] transition-all hover:-translate-y-1 hover:shadow-[6px_6px_0_var(--ink-color)] disabled:opacity-60"
                      >
                        返回邮箱输入
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </BetaAccessContext.Provider>
  );
}
