import { NextRequest, NextResponse } from "next/server";
import {
  BETA_ACCESS_TOKEN_COOKIE_NAME,
  isAdminApiPath,
  isBetaAccessApiPath,
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

async function proxy(request: NextRequest, path: string[]) {
  const isPublicBetaAccessRequest = isBetaAccessApiPath(path);
  const isAdminRequest = isAdminApiPath(path);
  const betaAccessToken = getRequestBetaAccessToken(request);

  if (!isPublicBetaAccessRequest && !isAdminRequest) {
    if (!betaAccessToken || !(await validateBetaAccessToken(betaAccessToken))) {
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
  if (!isPublicBetaAccessRequest && !isAdminRequest && betaAccessToken) {
    headers.set("authorization", `Bearer ${betaAccessToken}`);
  }
  if (isPublicBetaAccessRequest && path[1] === "session" && betaAccessToken) {
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

  const upstream = await fetch(targetUrl, init);

  if (isPublicBetaAccessRequest && ["verify-code", "session"].includes(path[1] || "")) {
    const payload = await upstream.json();
    const response = NextResponse.json(payload, {
      status: upstream.status,
    });
    if (
      upstream.ok
      && typeof payload?.expires_at === "string"
      && path[1] === "session"
      && betaAccessToken
    ) {
      setBetaAccessCookie(response, betaAccessToken, payload.expires_at);
    }
    if (
      upstream.ok
      && typeof payload?.credential?.token === "string"
      && typeof payload?.credential?.expires_at === "string"
      && path[1] === "verify-code"
    ) {
      setBetaAccessCookie(response, payload.credential.token, payload.credential.expires_at);
    }
    if (!upstream.ok && path[1] === "session") {
      response.cookies.delete(BETA_ACCESS_TOKEN_COOKIE_NAME);
    }
    return response;
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
