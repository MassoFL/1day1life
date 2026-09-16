import { store, validDate } from "@/lib/store.mjs";
import { sameOrigin, failure } from "../store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  if (!validDate(date))
    return Response.json({ error: "Invalid date" }, { status: 400 });
  try {
    return Response.json(store().getDay(date), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const { date, id, done, prayerMode } = body ?? {};
  if (!validDate(date) || typeof id !== "string" || typeof done !== "boolean")
    return new Response(null, { status: 400 });
  try {
    return Response.json(store().setComplete(date, id, done, prayerMode));
  } catch (error) {
    if (
      error instanceof Error &&
      ["Invalid prayer mode", "Choose a prayer mode"].includes(error.message)
    )
      return Response.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && error.message === "Task not found")
      return new Response(null, { status: 404 });
    return failure(error);
  }
}
