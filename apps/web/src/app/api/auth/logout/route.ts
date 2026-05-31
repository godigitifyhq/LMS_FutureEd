import { type NextRequest, NextResponse } from "next/server";

const API = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("refreshToken")?.value;

  if (refreshToken) {
    // Best-effort: tell the API to invalidate the token
    await fetch(`${API}/api/v1/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `refreshToken=${refreshToken}`,
      },
      body: JSON.stringify({}),
    }).catch(() => undefined);
  }

  const res = NextResponse.json({ success: true });
  res.cookies.delete("refreshToken");
  return res;
}
