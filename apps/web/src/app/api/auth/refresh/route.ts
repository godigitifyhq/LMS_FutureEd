import { type NextRequest, NextResponse } from "next/server";

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
const IS_PROD = process.env.NODE_ENV === "production";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("refreshToken")?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_TOKEN", message: "No refresh token" } },
      { status: 401 },
    );
  }

  const upstream = await fetch(`${API}/api/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `refreshToken=${refreshToken}`,
    },
    body: JSON.stringify({}),
  });

  const data = await upstream.json() as unknown;
  const res = NextResponse.json(data, { status: upstream.status });

  if (upstream.ok) {
    const setCookie = upstream.headers.get("set-cookie") ?? "";
    const match = setCookie.match(/refreshToken=([^;]+)/);
    if (match?.[1]) {
      res.cookies.set("refreshToken", match[1], {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
    }
  } else {
    res.cookies.delete("refreshToken");
  }

  return res;
}
