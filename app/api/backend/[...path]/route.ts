import { NextRequest, NextResponse } from "next/server";
import {
  BETA_ACCESS_TOKEN_COOKIE_NAME,
  isAdminApiPath,
  isBetaAccessApiPath,
  isLocalBetaAccessBypassed,
} from "@/lib/beta-access";

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || "http://127.0.0.1:8000";

function unauthorizedResponse() {
  const response = NextResponse.json(
    { detail: "未通过内测准入验证" },
    { status: 401 },
  );
  response.cookies.delete(BETA_ACCESS_TOKEN_COOKIE_NAME);
  return response;
}

function setBetaAccessCookie(response: NextResponse, token: string, expiresAt: string) {
  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) {
    return;
  }
  response.cookies.set(BETA_ACCESS_TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

function getRequestBetaAccessToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const tokenFromHeader = authorization.slice("Bearer ".length).trim();
    if (tokenFromHeader) {
      return tokenFromHeader;
    }
  }
  return request.cookies.get(BETA_ACCESS_TOKEN_COOKIE_NAME)?.value || null;
}

function getGeoCountry(request: NextRequest) {
  return (
    request.headers.get("cf-ipcountry")
    || request.headers.get("x-vercel-ip-country")
    || request.headers.get("x-geo-country")
    || null
  );
}

async function validateBetaAccessToken(token: string) {
  const response = await fetch(`${BACKEND_BASE_URL}/beta-access/session`, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  return response.ok;
}

async function buildProxyResponse(upstream: Response) {
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

async function parseUpstreamJson(upstream: Response) {
  const text = await upstream.text();
  if (!text.trim()) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

async function readUpstreamErrorDetail(upstream: Response) {
  const text = await upstream.text();
  if (!text.trim()) {
    return "";
  }
  try {
    const parsed = JSON.parse(text) as {
      detail?: unknown;
      message?: unknown;
      code?: unknown;
    };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail;
    }
    if (typeof parsed.message === "string" && parsed.message.trim()) {
      return parsed.message;
    }
    if (
      parsed.detail
      && typeof parsed.detail === "object"
      && "message" in parsed.detail
      && typeof parsed.detail.message === "string"
      && parsed.detail.message.trim()
    ) {
      return parsed.detail.message;
    }
  } catch {
  }
  return text;
}

function buildProxyErrorResponse(path: string[], status: number, upstreamDetail?: string) {
  const normalizedDetail = upstreamDetail?.trim();

  if (status === 401) {
    const response = NextResponse.json(
      {
        detail: "当前准入状态已失效，请重新完成验证后再继续。",
        code: "BETA_ACCESS_REQUIRED",
      },
      { status },
    );
    response.cookies.delete(BETA_ACCESS_TOKEN_COOKIE_NAME);
    return response;
  }

  if (status === 404) {
    if (path[0] === "sessions") {
      return NextResponse.json(
        {
          detail: "当前调查会话不存在或已失效，请返回案件列表重新进入。",
          code: "SESSION_NOT_FOUND",
        },
        { status },
      );
    }
    if (path[0] === "characters") {
      return NextResponse.json(
        {
          detail: "当前调查员档案不存在或无权访问，请返回名录重新选择。",
          code: "INVESTIGATOR_NOT_FOUND",
        },
        { status },
      );
    }
    if (path[0] === "modules") {
      return NextResponse.json(
        {
          detail: "当前案件档案不存在或尚未开放，请返回案件列表重新选择。",
          code: "MODULE_NOT_FOUND",
        },
        { status },
      );
    }
    return NextResponse.json(
      {
        detail: "请求的资源不存在或暂时不可用。",
        code: "RESOURCE_NOT_FOUND",
      },
      { status },
    );
  }

  return NextResponse.json(
    {
      detail: status >= 500
        ? "服务暂时异常，请稍后重试；若持续出现，请联系管理员检查后端日志。"
        : normalizedDetail || "服务请求失败，请稍后重试。",
      code: status >= 500 ? "UPSTREAM_ERROR" : "REQUEST_FAILED",
    },
    { status },
  );
}

function buildUpstreamUnavailableResponse() {
  return NextResponse.json(
    {
      detail: "后端服务暂时不可达，请稍后重试；若持续出现，请确认后端服务已启动。",
      code: "UPSTREAM_UNREACHABLE",
    },
    { status: 502 },
  );
}

async function proxy(request: NextRequest, path: string[]) {
  const isPublicBetaAccessRequest = isBetaAccessApiPath(path);
  const isAdminRequest = isAdminApiPath(path);
  const betaAccessToken = getRequestBetaAccessToken(request);
  const localBypass = isLocalBetaAccessBypassed();

  if (!localBypass && !isPublicBetaAccessRequest && !isAdminRequest) {
    let hasValidBetaAccess = false;
    try {
      hasValidBetaAccess = betaAccessToken ? await validateBetaAccessToken(betaAccessToken) : false;
    } catch {
      return buildUpstreamUnavailableResponse();
    }
    if (!hasValidBetaAccess) {
      return unauthorizedResponse();
    }
  }

  const search = request.nextUrl.search || "";
  const targetUrl = `${BACKEND_BASE_URL}/${path.join("/")}${search}`;
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const lowerKey = key.toLowerCase();
    if (["content-type", "authorization", "accept", "x-forwarded-for", "x-real-ip"].includes(lowerKey)) {
      headers.set(key, value);
    }
  }
  const geoCountry = getGeoCountry(request);
  if (geoCountry) {
    headers.set("x-geo-country", geoCountry);
  }
  if (!localBypass && !isPublicBetaAccessRequest && !isAdminRequest && betaAccessToken) {
    headers.set("authorization", `Bearer ${betaAccessToken}`);
  }
  if (!localBypass && isPublicBetaAccessRequest && path[1] === "session" && betaAccessToken) {
    headers.set("authorization", `Bearer ${betaAccessToken}`);
  }
  const init: RequestInit = {
    method: request.method,
    headers,
  };
  if (!["GET", "HEAD"].includes(request.method)) {
    const body = await request.arrayBuffer();
    init.body = Buffer.from(body);
    (init as RequestInit & { duplex?: "half" }).duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch {
    return buildUpstreamUnavailableResponse();
  }

  if (isPublicBetaAccessRequest && ["verify-code", "session"].includes(path[1] || "")) {
    const payload = await parseUpstreamJson(upstream);
    if (!payload) {
      const response = NextResponse.json(
        { detail: "准入服务暂时不可用，请确认本地后端是否已启动" },
        { status: upstream.ok ? 502 : upstream.status },
      );
      if (path[1] === "session") {
        response.cookies.delete(BETA_ACCESS_TOKEN_COOKIE_NAME);
      }
      return response;
    }
    const payloadRecord = payload as {
      expires_at?: unknown;
      credential?: {
        token?: unknown;
        expires_at?: unknown;
      };
    };
    const response = NextResponse.json(payload, {
      status: upstream.status,
    });
    if (
      upstream.ok
      && typeof payloadRecord.expires_at === "string"
      && path[1] === "session"
      && betaAccessToken
    ) {
      setBetaAccessCookie(response, betaAccessToken, payloadRecord.expires_at);
    }
    if (
      upstream.ok
      && typeof payloadRecord.credential?.token === "string"
      && typeof payloadRecord.credential?.expires_at === "string"
      && path[1] === "verify-code"
    ) {
      setBetaAccessCookie(response, payloadRecord.credential.token, payloadRecord.credential.expires_at);
    }
    if (!upstream.ok && path[1] === "session") {
      response.cookies.delete(BETA_ACCESS_TOKEN_COOKIE_NAME);
    }
    return response;
  }

  if (!upstream.ok) {
    const upstreamDetail = await readUpstreamErrorDetail(upstream);
    return buildProxyErrorResponse(path, upstream.status, upstreamDetail);
  }

  return buildProxyResponse(upstream);
}

export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}

export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}

export async function PATCH(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}

export async function DELETE(request: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(request, params.path);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
