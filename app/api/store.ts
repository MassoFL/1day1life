export function failure(error: unknown) {
  console.error("Daily tracker storage error", error);
  return Response.json(
    { error: "Unable to save or load your day. Please try again." },
    { status: 503 },
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
