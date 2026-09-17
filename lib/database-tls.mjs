import { X509Certificate } from "node:crypto";

export function databaseTls(certificate = process.env.DATABASE_CA_CERT) {
  if (!certificate?.trim()) return "verify-full";
  const ca = certificate.trim().replace(/\\n/g, "\n");
  try {
    if (!ca.startsWith("-----BEGIN CERTIFICATE-----"))
      throw new Error("Expected PEM");
    new X509Certificate(ca);
  } catch {
    throw Object.assign(
      new Error("DATABASE_CA_CERT must contain a PEM certificate."),
      { code: "DATABASE_CA_CONFIG" },
    );
  }
  return { ca, rejectUnauthorized: true };
}
