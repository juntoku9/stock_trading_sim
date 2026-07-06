/**
 * Pure trading math shared by the client (order engine in App.tsx),
 * the server (server/paperTradingApi.ts, pages/api/history.ts) and unit tests.
 *
 * Keep this module dependency-free and side-effect-free so it stays trivially testable.
 */

/**
 * Yahoo Finance uses dashes where exchanges use dots (BRK.B -> BRK-B).
 * Every server-side Yahoo call must go through this mapping — previously
 * /api/history skipped it, which 502'd charts for any dotted symbol.
 */
export const toYahooSymbol = (symbol: string): string =>
  symbol.trim().toUpperCase().replace(/\./g, '-');

/**
 * Weighted average cost after adding `addedShares` bought at `tradePrice`
 * to an existing position. Returns `tradePrice` for a brand-new position.
 */
export const weightedAverageCost = (
  existingShares: number,
  existingAverageCost: number,
  addedShares: number,
  tradePrice: number
): number => {
  const totalShares = existingShares + addedShares;
  if (totalShares <= 0) return tradePrice;
  if (existingShares <= 0) return tradePrice;
  return ((existingShares * existingAverageCost) + (addedShares * tradePrice)) / totalShares;
};

/**
 * Limit-order fill predicate.
 * BUY fills when the market drops to or below the limit;
 * SELL fills when the market rises to or above it.
 */
export const orderLimitFills = (
  side: 'BUY' | 'SELL',
  limitPrice: number,
  marketPrice: number
): boolean => (side === 'BUY' ? marketPrice <= limitPrice : marketPrice >= limitPrice);

/**
 * Stop trigger predicate.
 * A BUY stop triggers when price breaks above the stop (breakout entry);
 * a SELL stop triggers when price falls to or below it (stop-loss).
 */
export const orderStopTriggers = (
  side: 'BUY' | 'SELL',
  stopPrice: number,
  marketPrice: number
): boolean => (side === 'BUY' ? marketPrice >= stopPrice : marketPrice <= stopPrice);

/**
 * Server-side guard so a limit order never executes through its limit:
 * returns true when executing at `marketPrice` would violate `limitPrice`.
 */
export const violatesLimit = (
  side: 'BUY' | 'SELL',
  limitPrice: number,
  marketPrice: number
): boolean => (side === 'BUY' ? marketPrice > limitPrice : marketPrice < limitPrice);
