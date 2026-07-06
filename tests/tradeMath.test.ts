import { describe, expect, it } from 'vitest';
import {
  orderLimitFills,
  orderStopTriggers,
  toYahooSymbol,
  violatesLimit,
  weightedAverageCost,
} from '../services/tradeMath';

describe('toYahooSymbol', () => {
  it('maps dotted class shares to dashes (BRK.B -> BRK-B)', () => {
    expect(toYahooSymbol('BRK.B')).toBe('BRK-B');
  });

  it('uppercases and trims', () => {
    expect(toYahooSymbol('  aapl ')).toBe('AAPL');
  });

  it('leaves plain symbols untouched', () => {
    expect(toYahooSymbol('MSFT')).toBe('MSFT');
  });
});

describe('weightedAverageCost', () => {
  it('averages an added lot into an existing position', () => {
    // 10 @ $100 + 10 @ $200 => 20 @ $150
    expect(weightedAverageCost(10, 100, 10, 200)).toBe(150);
  });

  it('uses the trade price for a brand-new position', () => {
    expect(weightedAverageCost(0, 0, 5, 42.5)).toBe(42.5);
  });

  it('weights unequal lots correctly', () => {
    // 30 @ $10 + 10 @ $30 => 40 @ $15
    expect(weightedAverageCost(30, 10, 10, 30)).toBe(15);
  });
});

describe('orderLimitFills', () => {
  it('BUY fills at or below the limit, not above', () => {
    expect(orderLimitFills('BUY', 200, 199.99)).toBe(true);
    expect(orderLimitFills('BUY', 200, 200)).toBe(true);
    expect(orderLimitFills('BUY', 200, 200.01)).toBe(false);
  });

  it('SELL fills at or above the limit, not below', () => {
    expect(orderLimitFills('SELL', 230, 230)).toBe(true);
    expect(orderLimitFills('SELL', 230, 231)).toBe(true);
    expect(orderLimitFills('SELL', 230, 229.99)).toBe(false);
  });
});

describe('orderStopTriggers', () => {
  it('SELL stop (stop-loss) triggers when price falls to the stop', () => {
    expect(orderStopTriggers('SELL', 185, 185)).toBe(true);
    expect(orderStopTriggers('SELL', 185, 184)).toBe(true);
    expect(orderStopTriggers('SELL', 185, 186)).toBe(false);
  });

  it('BUY stop (breakout) triggers when price rises to the stop', () => {
    expect(orderStopTriggers('BUY', 220, 220)).toBe(true);
    expect(orderStopTriggers('BUY', 220, 221)).toBe(true);
    expect(orderStopTriggers('BUY', 220, 219)).toBe(false);
  });
});

describe('violatesLimit (server-side fill guard)', () => {
  it('rejects a BUY fill above the limit', () => {
    expect(violatesLimit('BUY', 200, 201)).toBe(true);
    expect(violatesLimit('BUY', 200, 200)).toBe(false);
    expect(violatesLimit('BUY', 200, 195)).toBe(false);
  });

  it('rejects a SELL fill below the limit', () => {
    expect(violatesLimit('SELL', 230, 229)).toBe(true);
    expect(violatesLimit('SELL', 230, 230)).toBe(false);
    expect(violatesLimit('SELL', 230, 240)).toBe(false);
  });
});
