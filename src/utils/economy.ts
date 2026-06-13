import { MarketState, ResourceMarket } from "../types";

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function ensureMarketBaseline(resource: ResourceMarket): ResourceMarket {
  const baselineBuyPrice = resource.baselineBuyPrice ?? resource.buyPrice;
  const baselineSellPrice = resource.baselineSellPrice ?? resource.sellPrice;
  return {
    ...resource,
    baselineBuyPrice,
    baselineSellPrice,
    buyPrice: Math.max(10, resource.buyPrice || baselineBuyPrice),
    sellPrice: Math.max(5, resource.sellPrice || baselineSellPrice),
  };
}

export function repriceMarketResource(resource: ResourceMarket): ResourceMarket {
  const normalized = ensureMarketBaseline(resource);
  const stockRatio = normalized.maxCapacity > 0 ? normalized.available / normalized.maxCapacity : 0;
  const scarcityPressure = 1 + (0.5 - clamp(stockRatio, 0, 1.25)) * 0.38;
  const nextBuy = Math.max(10, Math.round(normalized.baselineBuyPrice * scarcityPressure));
  const nextSell = Math.max(5, Math.min(nextBuy - 1, Math.round(normalized.baselineSellPrice * scarcityPressure * 0.985)));
  return {
    ...normalized,
    buyPrice: nextBuy,
    sellPrice: nextSell,
  };
}

export function adjustMarketResource(resource: ResourceMarket, deltaAvailable: number): ResourceMarket {
  return repriceMarketResource({
    ...ensureMarketBaseline(resource),
    available: clamp(resource.available + deltaAvailable, 0, resource.maxCapacity),
  });
}

function getTargetFillRatio(portId: string, resourceId: string): number {
  const seed = portId.length * 19 + resourceId.length * 7;
  return 0.45 + ((seed % 25) / 100);
}

export function refreshMarkets(markets: MarketState, daysElapsed: number): MarketState {
  if (daysElapsed <= 0) return markets;
  const steps = Math.min(14, Math.floor(daysElapsed));
  if (steps <= 0) return markets;

  let nextMarkets: MarketState = markets;
  for (let day = 0; day < steps; day += 1) {
    const refreshed: MarketState = {};
    for (const [portId, portMarket] of Object.entries(nextMarkets)) {
      const nextPort: MarketState[string] = {};
      for (const [resourceId, resource] of Object.entries(portMarket)) {
        const normalized = ensureMarketBaseline(resource);
        const targetAvailable = Math.round(normalized.maxCapacity * getTargetFillRatio(portId, resourceId));
        const drift = targetAvailable - normalized.available;
        const restockStep = Math.sign(drift) * Math.max(1, Math.round(Math.abs(drift) * (drift >= 0 ? 0.24 : 0.12)));
        nextPort[resourceId] = repriceMarketResource({
          ...normalized,
          available: clamp(normalized.available + restockStep, 0, normalized.maxCapacity),
        });
      }
      refreshed[portId] = nextPort;
    }
    nextMarkets = refreshed;
  }

  return nextMarkets;
}

export function getReputationAdjustedPrice(basePrice: number, reputation: number, direction: "buy" | "sell"): number {
  const rep = clamp(reputation, -25, 25);
  const modifier = direction === "buy"
    ? 1 - rep * 0.006
    : 1 + rep * 0.004;
  return Math.max(1, Math.round(basePrice * clamp(modifier, 0.82, 1.12)));
}
