import { databaseTls } from "./database-tls.mjs";
let instance;

export async function store() {
  if (!instance)
    instance = connect().catch((error) => {
      instance = undefined;
      throw error;
    });
  return instance;
}
async function connect() {
  const url = process.env.DATABASE_URL;
  if (url) {
    if (!/^postgres(?:ql)?:\/\//.test(url)) {
      throw Object.assign(
        new Error("DATABASE_URL must be a PostgreSQL connection URL."),
        { code: "DATABASE_CONFIG" },
      );
    }
    const [{ default: postgres }, { createPostgresStore }] = await Promise.all([
      import("postgres"),
      import("./postgres-store.mjs"),
    ]);
    const sql = postgres(url, {
      prepare: false, // Supabase transaction pooler requires this.
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      ssl: databaseTls(),
      onnotice: () => {},
    });
    return createPostgresStore(sql);
  }
  if (process.env.VERCEL) {
    throw Object.assign(
      new Error("Configure DATABASE_URL in Vercel and redeploy."),
      { code: "DATABASE_CONFIG" },
    );
  }
  const { store: localStore } = await import("./store.mjs");
  return localStore();
}
