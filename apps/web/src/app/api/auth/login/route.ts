import { type NextRequest, NextResponse } from "next/server";

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const IS_PROD = process.env.NODE_ENV === "production";

export async function POST(req: NextRequest) {
  const body = await req.text();

  const upstream = await fetch(`${API}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const data = await upstream.json() as unknown;

  const res = NextResponse.json(data, { status: upstream.status });

  if (upstream.ok) {
    // Extract the refresh token value from the upstream Set-Cookie header
    const setCookie = upstream.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/refreshToken=([^;]+)/);
    if (match?.[1]) {
      res.cookies.set("refreshToken", match[1], {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: "lax", // same-origin → lax is fine; iOS Safari fully accepts this
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    }
  }

  return res;
}
