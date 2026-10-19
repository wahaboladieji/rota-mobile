import {
  calculatePlanChangeProration,
  calculateSeatChangeProration,
  PlanChangeQuoteInput,
  SeatChangeQuoteInput,
  PlanChangeQuoteResult,
  SeatChangeQuoteResult,
} from '../src/domain/proration.service';

/**
 * Test adapter bridging the prompt's required test signature to the real server domain service.
 * Does not implement independent arithmetic or return hardcoded results.
 */
export async function quotePlanChange(input: PlanChangeQuoteInput): Promise<PlanChangeQuoteResult> {
  return calculatePlanChangeProration(input);
}

export async function quoteSeatChange(input: SeatChangeQuoteInput): Promise<SeatChangeQuoteResult> {
  return calculateSeatChangeProration(input);
}
