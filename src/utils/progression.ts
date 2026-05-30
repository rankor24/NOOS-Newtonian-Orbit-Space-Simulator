/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CareerTrackId, PlayerProfile } from "../types";

const xpToLevel = (xp: number) => Math.max(1, Math.floor(Math.sqrt(xp / 100)) + 1);

export function awardCareerXp(profile: PlayerProfile, track: CareerTrackId, xp: number): PlayerProfile {
  const currentTrack = profile.career[track];
  const nextXp = currentTrack.xp + Math.max(0, xp);
  const nextCareer = {
    ...profile.career,
    [track]: {
      xp: nextXp,
      level: xpToLevel(nextXp),
    },
  };

  const levelSum = Object.values(nextCareer).reduce((sum, entry) => sum + entry.level, 0);
  return {
    ...profile,
    career: nextCareer,
    overallLevel: Math.max(1, Math.floor(levelSum / Object.keys(nextCareer).length)),
  };
}

export function addReputation(profile: PlayerProfile, faction: string | undefined, amount: number): PlayerProfile {
  if (!faction) return profile;
  return {
    ...profile,
    reputation: {
      ...profile.reputation,
      [faction]: (profile.reputation[faction] || 0) + amount,
    },
  };
}
