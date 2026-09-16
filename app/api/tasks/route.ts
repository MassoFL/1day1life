import { store } from "@/lib/runtime-store.mjs";
import { validDate, validTasks } from "@/lib/task-model.mjs";
import { sameOrigin, failure } from "../store";
export const runtime = "nodejs";
export async function PUT(request: Request) {
  if (
    !sameOrigin(request) ||
    /Android|iPhone|iPad|Mobile/i.test(
      request.headers.get("user-agent") || "",
    ) ||
    request.headers.get("sec-ch-ua-mobile") === "?1"
  )
    return new Response(null, { status: 403 });
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const { tasks, date } = body ?? {};
  if (!validDate(date) || !validTasks(tasks))
    return Response.json(
      { error: "Invalid task configuration" },
      { status: 400 },
    );
  try {
    await (await store()).configure(date, tasks);
    return Response.json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}
