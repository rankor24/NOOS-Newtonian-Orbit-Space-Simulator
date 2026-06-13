import { CelestialBody, PlayerProfile, ShipState } from "../types";
import { getAbsoluteBodyPosition } from "./physics";
import { awardCareerXp } from "./progression";

export function canScanBody(ship: ShipState, body: CelestialBody | null, bodies: CelestialBody[], gameTime: number): boolean {
  if (!body) return false;
  const bodyPos = getAbsoluteBodyPosition(body.id, bodies, gameTime);
  const distance = Math.hypot(ship.x - bodyPos.x, ship.y - bodyPos.y);
  return distance <= ship.systemScannerRange;
}

export function getSurveyValue(body: CelestialBody): number {
  const typeValue: Record<CelestialBody["type"], number> = {
    star: 900,
    planet: 320,
    dwarfPlanet: 260,
    moon: 220,
    asteroid: 140,
    comet: 260,
    station: 90,
    belt: 180,
    ring: 160,
  };
  const radiusBonus = Math.min(220, Math.round((body.radius ?? 0) / 250000));
  const marketBonus = body.hasMarket ? 40 : 0;
  return typeValue[body.type] + radiusBonus + marketBonus;
}

export function scanBody(
  playerProfile: PlayerProfile,
  scannedBodyIds: string[],
  surveyDataByBody: Record<string, number>,
  body: CelestialBody,
): {
  playerProfile: PlayerProfile;
  scannedBodyIds: string[];
  surveyDataByBody: Record<string, number>;
  surveyValue: number;
} {
  if (scannedBodyIds.includes(body.id)) {
    return {
      playerProfile,
      scannedBodyIds,
      surveyDataByBody,
      surveyValue: surveyDataByBody[body.id] || 0,
    };
  }

  const surveyValue = getSurveyValue(body);
  return {
    playerProfile: awardCareerXp({
      ...playerProfile,
      stats: {
        ...playerProfile.stats,
        bodiesScanned: playerProfile.stats.bodiesScanned + 1,
      },
    }, "exploration", Math.max(20, Math.round(surveyValue / 8))),
    scannedBodyIds: [...scannedBodyIds, body.id],
    surveyDataByBody: {
      ...surveyDataByBody,
      [body.id]: surveyValue,
    },
    surveyValue,
  };
}

export function recordStarDiscovery(
  playerProfile: PlayerProfile,
  discoveredStarIds: string[],
  starId: string,
): { playerProfile: PlayerProfile; discoveredStarIds: string[]; isNew: boolean } {
  if (discoveredStarIds.includes(starId)) {
    return { playerProfile, discoveredStarIds, isNew: false };
  }

  return {
    playerProfile: awardCareerXp({
      ...playerProfile,
      stats: {
        ...playerProfile.stats,
        starsVisited: playerProfile.stats.starsVisited + 1,
      },
    }, "exploration", 250),
    discoveredStarIds: [...discoveredStarIds, starId],
    isNew: true,
  };
}

export function getTotalSurveyDataValue(surveyDataByBody: Record<string, number>): number {
  return Object.values(surveyDataByBody).reduce((sum, value) => sum + Math.max(0, value || 0), 0);
}
