import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculateEconomics,
  type EconomicsModel,
} from "../scripts/product-economics";

const model = JSON.parse(
  readFileSync("product-economics/managed-beta.json", "utf8")
) as EconomicsModel;

test("managed beta economics are reproducible and preserve the approval boundary", () => {
  const result = calculateEconomics(model);

  assert.equal(result.currency, "CAD");
  assert.deepEqual(result.perAccount, {
    revenue: 13.5,
    paymentFees: 0.55,
    variableInfrastructure: 0.25,
    supportReserve: 1.5,
    contribution: 11.2,
    contributionMarginPercent: 82.93,
  });
  assert.equal(result.target.passes, true);
  assert.equal(result.breakEvenAccounts, 4);
  assert.match(result.exclusions.join(" "), /not approved or customer-visible/i);
  assert.match(result.exclusions.join(" "), /founder salary/i);
});

test("invalid commercial assumptions fail closed", () => {
  assert.throws(
    () => calculateEconomics({ ...model, annualShare: 1.1 }),
    /annualShare/
  );
  assert.throws(
    () => calculateEconomics({ ...model, monthlyPrice: 0 }),
    /prices/
  );
  assert.throws(
    () => calculateEconomics({ ...model, accountScenarios: [0] }),
    /account scenarios/
  );
});
