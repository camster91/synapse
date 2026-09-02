import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const product = readFileSync("PRODUCT.md", "utf8");

test("owner decisions remain separate and non-authorizing", () => {
  assert.match(product, /## Owner decision queue — each approval is separate/);
  assert.match(product, /does not grant permission/);
  assert.match(product, /Approval for one row[\s\S]*does not authorize any other row/);

  for (const decision of [
    "Repository governance",
    "Production rehearsal",
    "Legal and data policy",
    "Support and incidents",
    "Managed pilot",
    "Pricing research",
    "Merge and release",
  ]) {
    assert.match(product, new RegExp(`\\| ${decision} \\|`));
  }

  assert.match(product, /Recruiting, contacting, enrolling, or collecting payment/);
  assert.match(product, /Publishing a price, enabling billing, discounts, or charges/);
  assert.match(product, /Merging, tagging, publishing an image, or deploying/);
});
