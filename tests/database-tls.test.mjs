import test from "node:test";
import assert from "node:assert/strict";
import { rootCertificates } from "node:tls";
import { databaseTls } from "../lib/database-tls.mjs";

test("TLS always verifies certificates, with default roots or an explicit CA", () => {
  assert.equal(databaseTls(""), "verify-full");
  const ca = rootCertificates[0].trim();
  assert.deepEqual(databaseTls(ca), { ca, rejectUnauthorized: true });
  assert.deepEqual(databaseTls(ca.replace(/\n/g, "\\n")), {
    ca,
    rejectUnauthorized: true,
  });
  assert.throws(() => databaseTls("not a certificate"), {
    code: "DATABASE_CA_CONFIG",
  });
  assert.throws(
    () =>
      databaseTls(
        "-----BEGIN CERTIFICATE-----\ninvalid\n-----END CERTIFICATE-----",
      ),
    { code: "DATABASE_CA_CONFIG" },
  );
});
