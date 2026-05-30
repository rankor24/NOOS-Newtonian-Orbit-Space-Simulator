/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameState } from "../types";

export const SAVE_VERSION = 2;
const LEGACY_SAVE_KEY = "newtonian_orbit_save";
const PROFILE_INDEX_KEY = "newtonian_orbit_profiles";
const CURRENT_PROFILE_KEY = "newtonian_orbit_current_profile";
const PROFILE_KEY_PREFIX = "newtonian_orbit_profile:";

export interface CommanderProfileSummary {
  id: string;
  commanderName: string;
  createdAt: string;
  updatedAt: string;
  credits: number;
  activeStarId: string;
  activeShipName: string;
  commanderLevel: number;
  totalPlayTimeSec: number;
}

const makeProfileKey = (id: string) => `${PROFILE_KEY_PREFIX}${id}`;

const safeJsonParse = <T,>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export function listCommanderProfiles(): CommanderProfileSummary[] {
  return safeJsonParse<CommanderProfileSummary[]>(localStorage.getItem(PROFILE_INDEX_KEY)) || [];
}

function writeCommanderProfiles(index: CommanderProfileSummary[]) {
  localStorage.setItem(PROFILE_INDEX_KEY, JSON.stringify(index));
}

export function getCurrentCommanderProfileId(): string | null {
  return localStorage.getItem(CURRENT_PROFILE_KEY);
}

export function setCurrentCommanderProfileId(profileId: string | null) {
  if (!profileId) {
    localStorage.removeItem(CURRENT_PROFILE_KEY);
    return;
  }
  localStorage.setItem(CURRENT_PROFILE_KEY, profileId);
}

export function saveCommanderProfile(gameState: GameState, profileId?: string): string {
  const now = new Date().toISOString();
  const id = profileId || gameState.profileId || `cmdr_${Date.now()}`;
  const stateToSave: GameState = {
    ...gameState,
    profileId: id,
    saveVersion: SAVE_VERSION,
    updatedAt: now,
    createdAt: gameState.createdAt || now,
  };

  localStorage.setItem(makeProfileKey(id), JSON.stringify(stateToSave));

  const summaries = listCommanderProfiles();
  const summary: CommanderProfileSummary = {
    id,
    commanderName: stateToSave.commanderName,
    createdAt: stateToSave.createdAt,
    updatedAt: now,
    credits: stateToSave.playerCredits,
    activeStarId: stateToSave.activeStarId,
    activeShipName: stateToSave.ship.name,
    commanderLevel: stateToSave.playerProfile.overallLevel,
    totalPlayTimeSec: stateToSave.playerProfile.totalPlayTimeSec,
  };

  const next = summaries.filter((entry) => entry.id !== id);
  next.unshift(summary);
  writeCommanderProfiles(next);
  setCurrentCommanderProfileId(id);
  return id;
}

export function loadCommanderProfile(profileId: string): GameState | null {
  return safeJsonParse<GameState>(localStorage.getItem(makeProfileKey(profileId)));
}

export function deleteCommanderProfile(profileId: string) {
  localStorage.removeItem(makeProfileKey(profileId));
  const next = listCommanderProfiles().filter((entry) => entry.id !== profileId);
  writeCommanderProfiles(next);
  if (getCurrentCommanderProfileId() === profileId) {
    setCurrentCommanderProfileId(next[0]?.id || null);
  }
}

export function loadBestAvailableProfile(): GameState | null {
  const currentId = getCurrentCommanderProfileId();
  if (currentId) {
    const current = loadCommanderProfile(currentId);
    if (current) return current;
  }

  const summaries = listCommanderProfiles();
  if (summaries[0]) {
    const state = loadCommanderProfile(summaries[0].id);
    if (state) {
      setCurrentCommanderProfileId(summaries[0].id);
      return state;
    }
  }

  return null;
}

export function loadLegacySingleSave(): unknown | null {
  return safeJsonParse(localStorage.getItem(LEGACY_SAVE_KEY));
}

export function clearLegacySingleSave() {
  localStorage.removeItem(LEGACY_SAVE_KEY);
}
