import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL = process.env.BACKEND_BASE_URL || 'http://127.0.0.1:8000';

async function proxy(request: NextRequest, path: string[]) {
  const search = request.nextUrl.search || '';
  const targetUrl = `${BACKEND_BASE_URL}/${path.join('/')}${search}`;
  const headers = new Headers(request.headers);
  headers.delete('host');
  const init: RequestInit = {
    method: request.method,
    headers
  };
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = await request.text();
  }
  const upstream = await fetch(targetUrl, init);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    headers: responseHeaders
  });
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
