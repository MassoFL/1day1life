import { store } from "@/lib/runtime-store.mjs";
import { validDate } from "@/lib/task-model.mjs";
import { sameOrigin, failure } from "../store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date");
  if (!validDate(date))
    return Response.json({ error: "Date invalide" }, { status: 400 });
  try {
    return Response.json(
      { text: await (await store()).getJournal(date) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  if (
    !validDate(body?.date) ||
    typeof body?.text !== "string" ||
    body.text.length > 20000
  )
    return Response.json(
      { error: "Texte invalide (20 000 caractères maximum)." },
      { status: 400 },
    );
  try {
    return Response.json({
      text: await (await store()).setJournal(body.date, body.text),
    });
  } catch (error) {
    return failure(error);
  }
}
