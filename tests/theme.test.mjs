import test from "node:test";
import assert from "node:assert/strict";
import { resolvedTheme } from "../lib/theme.js";

test("explicit themes win and system follows the device", () => {
  assert.equal(resolvedTheme("light", true), "light");
  assert.equal(resolvedTheme("dark", false), "dark");
  assert.equal(resolvedTheme("system", true), "dark");
  assert.equal(resolvedTheme("system", false), "light");
});
