import { NextRequest, NextResponse } from "next/server";
import {
  BETA_ACCESS_STATE_HEADER,
  BETA_ACCESS_TOKEN_COOKIE_NAME,
  isProtectedPlayerPath,
} from "@/lib/beta-access";

function unauthorizedResponse() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="DiceTales Admin"'
    }
  });
}

function checkBasicAuth(request: NextRequest): boolean {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) {
    return true;
  }
  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Basic ")) {
    return false;
  }
  const base64Credentials = auth.replace("Basic ", "");
  const decoded = atob(base64Credentials);
  const [inputUser, inputPass] = decoded.split(":");
  return inputUser === username && inputPass === password;
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/admin") && !checkBasicAuth(request)) {
    return unauthorizedResponse();
  }
  const requestHeaders = new Headers(request.headers);
  if (isProtectedPlayerPath(request.nextUrl.pathname)) {
    const hasBetaAccessCookie = Boolean(request.cookies.get(BETA_ACCESS_TOKEN_COOKIE_NAME)?.value);
    requestHeaders.set(BETA_ACCESS_STATE_HEADER, hasBetaAccessCookie ? "verified" : "unverified");
  }
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"]
};
