import { NextRequest, NextResponse } from "next/server";

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
  if (!checkBasicAuth(request)) {
    return unauthorizedResponse();
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"]
};
