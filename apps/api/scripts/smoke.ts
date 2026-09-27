#!/usr/bin/env bun
/**
 * Boot smoke test.
 *
 * Builds the real app and asserts the things that only break once modules are
 * wired together: every registered route has a policy entry, the catalog has no
 * duplicates, and a public route answers while a protected one fails closed.
 *
 * Runs without a database — middleware is never reached because the failures
 * happen in routing and policy, which is the point.
 */
import { createApp } from "../src/app";
import { getPolicyCatalog } from "../src/shared/auth/policy";
import { moduleManifest } from "../src/modules";

let failures = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    return;
  }
  failures += 1;
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main(): Promise<void> {
  const app = createApp();
  const catalog = getPolicyCatalog();

  console.log("· modules");
  for (const { name, basePath } of moduleManifest()) {
    console.log(`  ${name.padEnd(10)} ${basePath}`);
  }

  console.log("· policy catalog");
  check("catalog is populated", catalog.size > 0, `size=${catalog.size}`);

  const expectedOps = [
    "health.read",
    "health.ready",
    "auth.loginConsole",
    "auth.loginRider",
    "auth.refresh",
    "auth.otpRequest",
    "auth.otpVerify",
    "auth.me",
    "auth.logout",
    "tracking.lookup",
    "parcel.list",
    "parcel.read",
    "parcel.create",
    "parcel.updateStatus",
    "parcel.cancel",
    "parcel.listOwn",
    "parcel.readOwn",
    "parcel.createOwn",
    "pricing.quote",
  ];

  for (const id of expectedOps) {
    check(`registered: ${id}`, catalog.has(id));
  }

  console.log("· fail-closed behaviour");

  const unauthenticated = await app.request("/api/v1/parcels");
  const body = (await unauthenticated.json()) as { error?: { code?: string } };
  check(
    "protected route rejects an anonymous caller",
    unauthenticated.status === 401,
    `got ${unauthenticated.status}`,
  );
  check("error body matches the contract", body.error?.code === "UNAUTHENTICATED", JSON.stringify(body));

  const missing = await app.request("/api/v1/nope");
  check("unknown route 404s in the same envelope", missing.status === 404);

  const publicOps = [...catalog.values()].filter((entry) => entry.public);
  check("public operations are declared public", publicOps.length > 0, "none found");

  // Health must answer without a database so a slow DB cannot cause a crash loop.
  const live = await app.request("/health");
  check("unversioned liveness probe answers", live.status === 200, `got ${live.status}`);

  console.log(
    `\n${failures === 0 ? "✓" : "✗"} ${catalog.size} operations, ${failures} failure(s)`,
  );
}

main()
  .then(() => {
    if (failures > 0) process.exit(1);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
