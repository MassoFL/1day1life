import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse(
      "Set APP_PASSWORD before starting the app in production.",
      { status: 503 },
    );
  }
  const authorization = request.headers.get("authorization") || "";
  const expected = Buffer.from(
    "Basic " + Buffer.from("1day1life:" + password).toString("base64"),
  );
  const received = Buffer.from(authorization);
  if (
    expected.length === received.length &&
    timingSafeEqual(expected, received)
  )
    return NextResponse.next();
  return new NextResponse("Sign in to your daily tracker.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="1day1life", charset="UTF-8"',
      "Cache-Control": "no-store",
    },
  });
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.svg).*)"],
};
