export const RULE_SCHEMA_VERSION = 1 as const;

export type RuleKind =
  | "require_shift_daily"
  | "require_shift_for_user"
  | "forbid_shift_for_user"
  | "forbid_shift_for_role"
  | "allowed_weekdays_for_role"
  | "max_shifts_per_user_day"
  | "rest_after_shift"
  | "fair_distribution"
  | "incentive_surplus"
  | "hide_shift"
  | "unknown";

export type ParsedGeneratorRule = {
  version: 1;
  status: "supported" | "needs_review";
  kind: RuleKind;
  shiftCodes: string[];
  count: number | null;
  weekdays: number[] | null; // JavaScript weekday: Sunday=0 ... Saturday=6
  excludeHolidays: boolean;
  username: string | null;
  employmentRoles: string[];
  service: string | null;
  allowedWeekdays: number[] | null;
  maxPerUserDay: number | null;
  afterShiftCodes: string[];
  rationale: string;
  unsupportedReason: string | null;
};

export type GeneratorConstraint = {
  id: number;
  code: string;
  name: string;
  description: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
};

export function getParsedRule(rule: GeneratorConstraint): ParsedGeneratorRule | null {
  const parsed = rule.config?.parsed_rule as ParsedGeneratorRule | undefined;
  if (!parsed || parsed.version !== RULE_SCHEMA_VERSION || parsed.status !== "supported") return null;
  return parsed;
}

export function normalizeWeekdays(values: unknown): number[] | null {
  if (!Array.isArray(values)) return null;
  const result = [...new Set(values.filter((v): v is number => Number.isInteger(v) && v >= 0 && v <= 6))].sort();
  return result.length ? result : null;
}

export function validateParsedRule(value: unknown): value is ParsedGeneratorRule {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  const kinds: RuleKind[] = ["require_shift_daily","require_shift_for_user","forbid_shift_for_user","forbid_shift_for_role","allowed_weekdays_for_role","max_shifts_per_user_day","rest_after_shift","fair_distribution","incentive_surplus","hide_shift","unknown"];
  if (r.version !== 1 || !["supported","needs_review"].includes(String(r.status)) || !kinds.includes(r.kind as RuleKind)) return false;
  if (!Array.isArray(r.shiftCodes) || !r.shiftCodes.every(x => typeof x === "string")) return false;
  if (r.weekdays !== null && !normalizeWeekdays(r.weekdays)) return false;
  if (r.allowedWeekdays !== null && !normalizeWeekdays(r.allowedWeekdays)) return false;
  if (typeof r.excludeHolidays !== "boolean" || typeof r.rationale !== "string") return false;
  return true;
}

export function weekdayOf(date: string): number {
  return new Date(date + "T00:00:00").getDay();
}

export function ruleAppliesOnDate(rule: ParsedGeneratorRule, date: string, isHoliday: boolean): boolean {
  if (rule.weekdays && !rule.weekdays.includes(weekdayOf(date))) return false;
  if (rule.excludeHolidays && isHoliday) return false;
  return true;
}

export function describeRuleSupport(rule: ParsedGeneratorRule): string {
  if (rule.status === "needs_review" || rule.kind === "unknown") {
    return rule.unsupportedReason || "Il motore non dispone ancora di un'operazione verificata per questo vincolo.";
  }
  return rule.rationale;
}
