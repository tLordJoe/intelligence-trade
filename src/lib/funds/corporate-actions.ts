/**
 * Corporate-action validation hooks.
 *
 * The governing rule: **a price series cannot tell you what happened to it.**
 * A 50% overnight fall is a 2:1 split, or a spin-off, or a special dividend, or
 * a genuine collapse, or a bad tick. All five look identical in a column of
 * closes. Code that sees a large move and "adjusts for the split" has guessed,
 * and a wrong guess is invisible afterwards because the series it produces is
 * perfectly well-formed.
 *
 * So nothing here adjusts anything. Detectors raise review alerts; a split or a
 * distribution becomes part of the record only when it is confirmed against an
 * authoritative filing or two independent sources, and until then the series is
 * left exactly as the source supplied it.
 */

import type { PriceSeries } from "./types.ts";

export type CorporateActionKind =
  | "split"
  | "reverse_split"
  | "cash_distribution"
  | "special_distribution"
  | "spin_off"
  | "merger"
  | "other";

/**
 * How an action was established.
 *
 * `authoritative` is a filing by the issuer or its registrar — an SEC filing, a
 * fund's own notice. `independent` sources are two or more unrelated parties;
 * two feeds redistributing the same wire are one source, not two.
 */
export type ConfirmationMethod = "authoritative_filing" | "independent_sources" | "unconfirmed";

export interface ActionConfirmation {
  method: ConfirmationMethod;
  /** Citations. Required to be non-empty for either confirmed method. */
  sources: string[];
  confirmedAt: string | null;
  confirmedBy: string | null;
}

export interface CorporateAction {
  symbol: string;
  kind: CorporateActionKind;
  /** The date the action takes effect. May be in the future for an announcement. */
  effectiveDate: string;
  /** For splits: new shares per old share. 10 for a 10:1. */
  ratio?: number;
  /** For distributions: amount per share, in the fund's currency. */
  amountPerShare?: number;
  confirmation: ActionConfirmation;
  /** True while the effective date is ahead of the data we hold. */
  announced: boolean;
  note?: string;
}

/**
 * Whether an action may be relied on.
 *
 * Two independent sources or one authoritative filing, and in both cases the
 * citations must actually be there. An empty `sources` array with a confident
 * `method` is exactly the shape a careless import produces, so it is refused.
 */
export function isConfirmed(action: CorporateAction): boolean {
  const { method, sources } = action.confirmation;
  if (method === "unconfirmed") return false;
  if (method === "authoritative_filing") return sources.length >= 1;
  return sources.length >= 2;
}

// --- review alerts -----------------------------------------------------------

export type AlertKind =
  | "large_daily_move"
  | "possible_missing_distribution"
  | "unconfirmed_action_in_window"
  | "announced_action_ahead";

export interface ReviewAlert {
  symbol: string;
  kind: AlertKind;
  date: string;
  /** Written for a person who has to go and check something. */
  detail: string;
  /** Always true. An alert is a request for review, never an instruction to act. */
  requiresHumanReview: true;
}

/** Default threshold for flagging a one-day move. Not a split rule. */
export const LARGE_MOVE_THRESHOLD_PERCENT = 15;

/**
 * Flag one-day moves large enough to be worth a look.
 *
 * Returns alerts and nothing else. It does not infer a split, does not compute
 * a ratio, and does not touch the series — a 33% fall is flagged as a 33% fall,
 * and whether that was a 3:2 split or a bad day is a question for a filing.
 */
export function detectLargeDailyMoves(
  series: PriceSeries,
  thresholdPercent: number = LARGE_MOVE_THRESHOLD_PERCENT
): ReviewAlert[] {
  const alerts: ReviewAlert[] = [];

  for (let i = 1; i < series.values.length; i += 1) {
    const previous = series.values[i - 1];
    const current = series.values[i];
    if (!(previous > 0)) continue;

    const changePercent = ((current - previous) / previous) * 100;
    if (Math.abs(changePercent) < thresholdPercent) continue;

    alerts.push({
      symbol: series.symbol,
      kind: "large_daily_move",
      date: series.dates[i],
      detail:
        `${changePercent >= 0 ? "+" : ""}${changePercent.toFixed(1)}% from ` +
        `${series.dates[i - 1]} (${previous}) to ${series.dates[i]} (${current}). ` +
        "Could be a corporate action, a data error, or a real move. Confirm against " +
        "a filing before treating it as any of them.",
      requiresHumanReview: true,
    });
  }

  return alerts;
}

/**
 * Flag distributions we would expect to see and do not.
 *
 * A fund that has paid quarterly for years and shows nothing this quarter has
 * either changed its policy or lost a record. This cannot distinguish the two;
 * it says the record is incomplete, which is the part it can know.
 *
 * `expectedIntervalDays` is how often this fund is known to distribute. Passing
 * a guess produces false alerts, which is the correct failure mode: a false
 * alert costs a check, a missed distribution understates total return silently.
 */
export function detectMissingDistributions(
  symbol: string,
  known: CorporateAction[],
  expectedIntervalDays: number,
  throughDate: string
): ReviewAlert[] {
  const distributions = known
    .filter((a) => a.symbol === symbol)
    .filter((a) => a.kind === "cash_distribution" || a.kind === "special_distribution")
    .filter((a) => a.effectiveDate <= throughDate)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));

  if (distributions.length === 0) {
    return [
      {
        symbol,
        kind: "possible_missing_distribution",
        date: throughDate,
        detail:
          `No distributions are recorded for ${symbol}, but one is expected about ` +
          `every ${expectedIntervalDays} days. Either the fund does not distribute ` +
          "or the record is incomplete — total return cannot be computed until that " +
          "is settled.",
        requiresHumanReview: true,
      },
    ];
  }

  const alerts: ReviewAlert[] = [];
  const dayMs = 86_400_000;
  const gapAllowance = expectedIntervalDays * 1.5;

  const boundaries = [...distributions.map((d) => d.effectiveDate), throughDate];
  for (let i = 1; i < boundaries.length; i += 1) {
    const gapDays =
      (Date.parse(`${boundaries[i]}T00:00:00Z`) - Date.parse(`${boundaries[i - 1]}T00:00:00Z`)) /
      dayMs;
    if (gapDays <= gapAllowance) continue;

    alerts.push({
      symbol,
      kind: "possible_missing_distribution",
      date: boundaries[i],
      detail:
        `${Math.round(gapDays)} days between ${boundaries[i - 1]} and ${boundaries[i]}, ` +
        `against an expected interval of about ${expectedIntervalDays} days. A ` +
        "distribution may be missing from the record.",
      requiresHumanReview: true,
    });
  }

  return alerts;
}

/** Flag unconfirmed actions falling inside a measurement window. */
export function detectUnconfirmedActions(
  actions: CorporateAction[],
  startDate: string,
  endDate: string
): ReviewAlert[] {
  return actions
    .filter((a) => a.effectiveDate >= startDate && a.effectiveDate <= endDate)
    .filter((a) => !isConfirmed(a))
    .map((a) => ({
      symbol: a.symbol,
      kind: "unconfirmed_action_in_window" as const,
      date: a.effectiveDate,
      detail:
        `A ${a.kind.replace(/_/g, " ")} for ${a.symbol} on ${a.effectiveDate} falls ` +
        "inside the measured period and is not confirmed. Figures over this period " +
        "should not be published until it is.",
      requiresHumanReview: true as const,
    }));
}

/**
 * Register an action whose effective date is still ahead.
 *
 * Announced actions are recorded before they happen so that when the data
 * crosses the date, the change is expected rather than discovered as an
 * anomaly. An announcement is not confirmation that it occurred.
 */
export function registerAnnouncedAction(
  action: Omit<CorporateAction, "announced">,
  today: string
): CorporateAction {
  return { ...action, announced: action.effectiveDate > today };
}

export function announcedAhead(actions: CorporateAction[], today: string): ReviewAlert[] {
  return actions
    .filter((a) => a.effectiveDate > today)
    .map((a) => ({
      symbol: a.symbol,
      kind: "announced_action_ahead" as const,
      date: a.effectiveDate,
      detail:
        `${a.symbol} has an announced ${a.kind.replace(/_/g, " ")} effective ` +
        `${a.effectiveDate}. Expect the series to change on that date.`,
      requiresHumanReview: true as const,
    }));
}

/**
 * Whether a period is clean enough to publish figures for.
 *
 * Any unconfirmed action inside the window blocks publication. Large-move
 * alerts do not, on their own — they are a prompt to look, and plenty of large
 * moves are just large moves.
 */
export function periodIsPublishable(alerts: ReviewAlert[]): { ok: boolean; blocking: ReviewAlert[] } {
  const blocking = alerts.filter(
    (a) => a.kind === "unconfirmed_action_in_window" || a.kind === "possible_missing_distribution"
  );
  return { ok: blocking.length === 0, blocking };
}
