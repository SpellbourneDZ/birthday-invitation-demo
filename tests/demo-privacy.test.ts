import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

test("guest invitation has no response API, database packages, persistence or form submission", () => {
  assert.equal(existsSync("app/api/rsvp"), false);
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(pkg.dependencies.pg, undefined);
  for (const root of ["app", "lib"]) {
    for (const name of readdirSync(root, { recursive: true })) {
      if (!/\.(tsx?|m?js)$/.test(String(name))) continue;
      if (/^(admin|api)[/\\]/.test(String(name)) || /^(admin-auth|github-content)\.ts$/.test(String(name))) continue;
      const source = readFileSync(join(root, String(name)), "utf8");
      assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|sendBeacon|sessionStorage|localStorage|indexedDB|document\.cookie|<form[^>]+action=/, String(name));
      assert.doesNotMatch(source, /@spellbourne|Аэропорт 88|кв\. 534|go\.2gis\.com|День рождения Олега/, String(name));
    }
  }
});
