export type Rule = {
  markup_bps: number;
  fixed_kobo: number;
  discount_bps: number;
  minimum_profit_kobo: number;
  shipping_subsidy_kobo?: number;
  tax_bps?: number;
  other_cost_kobo?: number;
};
export const defaultRule: Rule = {
  markup_bps: 2000,
  fixed_kobo: 0,
  discount_bps: 0,
  minimum_profit_kobo: 10000,
};
export function feeEstimate(amount: number) {
  return Math.min(
    200000,
    Math.ceil((amount * 150) / 10000) + (amount < 250000 ? 0 : 10000),
  );
}
export function price(
  cost: number,
  rule: Rule = defaultRule,
  commissionBps = 0,
) {
  if (!Number.isSafeInteger(cost) || cost <= 0 || cost > 100000000)
    throw new Error("Invalid supplier cost");
  const original =
    Math.ceil((cost * (10000 + rule.markup_bps)) / 10000) + rule.fixed_kobo;
  const selling = Math.ceil((original * (10000 - rule.discount_bps)) / 10000);
  const supplierDue = cost - Math.floor((cost * commissionBps) / 10000);
  const margin =
    selling -
    supplierDue -
    feeEstimate(selling) -
    (rule.shipping_subsidy_kobo ?? 0) -
    Math.ceil((selling * (rule.tax_bps ?? 0)) / 10000) -
    (rule.other_cost_kobo ?? 0);
  return {
    selling,
    original,
    supplierDue,
    estimatedMargin: margin,
    sellable: margin >= rule.minimum_profit_kobo,
  };
}
