export function failure(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "UNKNOWN";
  // Never log connection strings or full driver errors containing credentials.
  console.error("Daily tracker storage error", {
    code: /^[A-Z0-9_]{1,50}$/.test(code) ? code : "UNKNOWN",
  });
  return Response.json(
    {
      error:
        code === "DATABASE_CONFIG"
          ? "La base de données n’est pas configurée. Ajoute DATABASE_URL dans Vercel puis redéploie."
          : "Impossible de charger ou sauvegarder ta journée. Réessaie dans un instant.",
    },
    { status: 503 },
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
