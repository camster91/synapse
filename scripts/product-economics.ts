import { readFileSync } from "node:fs";

export type EconomicsModel = {
  name: string;
  currency: string;
  monthlyPrice: number;
  annualMonthlyEquivalent: number;
  annualShare: number;
  paymentPercent: number;
  paymentFixedPerCharge: number;
  variableInfrastructurePerAccount: number;
  supportReservePerAccount: number;
  fixedMonthlyOperatingCost: number;
  targetContributionMarginPercent: number;
  accountScenarios: number[];
  assumptions: string[];
  sources: Array<{ label: string; url: string; usedFor: string }>;
};

const money = (value: number) => Number(value.toFixed(2));

export function calculateEconomics(model: EconomicsModel) {
  if (model.annualShare < 0 || model.annualShare > 1) {
    throw new Error("annualShare must be between 0 and 1");
  }
  if (model.monthlyPrice <= 0 || model.annualMonthlyEquivalent <= 0) {
    throw new Error("prices must be positive");
  }
  if (model.accountScenarios.some((accounts) => !Number.isInteger(accounts) || accounts <= 0)) {
    throw new Error("account scenarios must contain positive integers");
  }

  const monthlyShare = 1 - model.annualShare;
  const revenuePerAccount =
    monthlyShare * model.monthlyPrice + model.annualShare * model.annualMonthlyEquivalent;
  const monthlyPlanPaymentFee =
    model.monthlyPrice * model.paymentPercent + model.paymentFixedPerCharge;
  const annualPlanMonthlyPaymentFee =
    model.annualMonthlyEquivalent * model.paymentPercent + model.paymentFixedPerCharge / 12;
  const paymentFeePerAccount =
    monthlyShare * monthlyPlanPaymentFee + model.annualShare * annualPlanMonthlyPaymentFee;
  const variableCostPerAccount =
    paymentFeePerAccount +
    model.variableInfrastructurePerAccount +
    model.supportReservePerAccount;
  const contributionPerAccount = revenuePerAccount - variableCostPerAccount;
  const contributionMarginPercent = (contributionPerAccount / revenuePerAccount) * 100;
  const breakEvenAccounts = Math.ceil(model.fixedMonthlyOperatingCost / contributionPerAccount);

  return {
    name: model.name,
    currency: model.currency,
    inputs: {
      monthlyPrice: model.monthlyPrice,
      annualMonthlyEquivalent: model.annualMonthlyEquivalent,
      annualSharePercent: model.annualShare * 100,
    },
    perAccount: {
      revenue: money(revenuePerAccount),
      paymentFees: money(paymentFeePerAccount),
      variableInfrastructure: money(model.variableInfrastructurePerAccount),
      supportReserve: money(model.supportReservePerAccount),
      contribution: money(contributionPerAccount),
      contributionMarginPercent: money(contributionMarginPercent),
    },
    target: {
      contributionMarginPercent: model.targetContributionMarginPercent,
      passes:
        money(contributionMarginPercent) >= model.targetContributionMarginPercent,
    },
    fixedMonthlyOperatingCost: model.fixedMonthlyOperatingCost,
    breakEvenAccounts,
    scenarios: model.accountScenarios.map((accounts) => ({
      accounts,
      revenue: money(revenuePerAccount * accounts),
      contributionBeforeFixedCost: money(contributionPerAccount * accounts),
      resultAfterFixedCost: money(
        contributionPerAccount * accounts - model.fixedMonthlyOperatingCost
      ),
    })),
    exclusions: model.assumptions,
    sources: model.sources,
  };
}

function main() {
  const modelPath = process.argv[2] ?? "product-economics/managed-beta.json";
  const model = JSON.parse(readFileSync(modelPath, "utf8")) as EconomicsModel;
  console.log(JSON.stringify(calculateEconomics(model), null, 2));
}

if (process.argv[1]?.endsWith("product-economics.ts")) {
  try {
    main();
  } catch (error) {
    console.error(
      `[product-economics] ${error instanceof Error ? error.message : "calculation failed"}`
    );
    process.exitCode = 1;
  }
}
