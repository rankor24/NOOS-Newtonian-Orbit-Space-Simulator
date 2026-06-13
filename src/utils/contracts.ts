import { CelestialBody, GameState, SpaceContract } from "../types";
import { getAbsoluteBodyPosition, getBodyVelocity } from "./physics";
import { PortRecord, getPortContractTemplates, makePortContract } from "./worldText";

const DAY_SECONDS = 86400;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function isContractExpired(contract: SpaceContract, gameTime: number): boolean {
  return !!contract.deadline && gameTime > contract.deadline;
}

export function getContractTimeRemaining(contract: SpaceContract, gameTime: number): number | null {
  if (!contract.deadline) return null;
  return Math.max(0, contract.deadline - gameTime);
}

export function formatContractTimeRemaining(seconds: number | null): string {
  if (seconds === null) return "Open-ended";
  if (seconds <= 0) return "Expired";
  const days = Math.floor(seconds / DAY_SECONDS);
  const hours = Math.floor((seconds % DAY_SECONDS) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

function buildContractId(issuer: PortRecord, destination: PortRecord, gameTime: number, slot: number): string {
  return `contract_${issuer.id}_${destination.id}_${Math.floor(gameTime)}_${slot}`;
}

function buildDeadline(gameTime: number, templateReward: number, slot: number): number {
  const rewardBandHours = clamp(Math.round(templateReward / 1800), 4, 24);
  return gameTime + (16 + rewardBandHours + slot * 3) * 3600;
}

function pruneExpiredOfferings(contracts: SpaceContract[], gameTime: number): SpaceContract[] {
  return contracts.filter((contract) => contract.accepted || contract.completed || contract.failed || !isContractExpired(contract, gameTime));
}

function createProceduralOffer(
  issuer: PortRecord,
  destination: PortRecord,
  template: ReturnType<typeof getPortContractTemplates>[number],
  gameTime: number,
  slot: number,
  reputation: number,
): SpaceContract {
  const rewardModifier = 1 + clamp(reputation, -15, 20) * 0.015;
  return makePortContract({
    id: buildContractId(issuer, destination, gameTime, slot),
    title: template.title,
    description: template.description,
    type: template.type,
    originId: issuer.bodyId,
    destinationId: destination.bodyId,
    reward: Math.max(1000, Math.round(template.reward * rewardModifier)),
    cargoType: template.cargoType,
    amount: template.amount,
    completed: false,
    accepted: false,
    failed: false,
    deadline: buildDeadline(gameTime, template.reward, slot),
  }, issuer, destination, `${issuer.name} → ${destination.name}`);
}

export function refreshContractsForPorts(
  contracts: SpaceContract[],
  ports: PortRecord[],
  gameTime: number,
  reputation: Record<string, number>,
): SpaceContract[] {
  const retained = pruneExpiredOfferings(contracts, gameTime);
  let nextContracts = [...retained];

  for (const issuer of ports) {
    const issuerRep = reputation[issuer.faction] || 0;
    const existingOffers = nextContracts.filter((contract) =>
      contract.issuerPortId === issuer.id && !contract.accepted && !contract.completed && !contract.failed,
    );
    const targetOfferCount = issuerRep >= 8 ? 3 : 2;
    if (existingOffers.length >= targetOfferCount) continue;

    const destinations = ports.filter((port) => port.id !== issuer.id);
    if (destinations.length === 0) continue;

    const offerSeed = Math.floor(gameTime / DAY_SECONDS) + issuer.id.length;
    for (let slot = existingOffers.length; slot < targetOfferCount; slot += 1) {
      const destination = destinations[(offerSeed + slot) % destinations.length];
      const templates = getPortContractTemplates(issuer, destination);
      const template = templates[(offerSeed + slot) % templates.length];
      nextContracts.push(createProceduralOffer(issuer, destination, template, gameTime, slot, issuerRep));
    }
  }

  return nextContracts;
}

export function expireAcceptedContracts(contracts: SpaceContract[], gameTime: number): { contracts: SpaceContract[]; failed: SpaceContract[] } {
  const failed: SpaceContract[] = [];
  const nextContracts = contracts.map((contract) => {
    if (!contract.accepted || contract.completed || contract.failed || !isContractExpired(contract, gameTime)) return contract;
    const failedContract = { ...contract, accepted: false, failed: true };
    failed.push(failedContract);
    return failedContract;
  });
  return { contracts: nextContracts, failed };
}

export function getContractCompletionStatus(contract: SpaceContract, gameState: GameState, bodies: CelestialBody[]) {
  const { ship, isDocked, dockedBodyId, dockedPortId, gameTime } = gameState;
  if (!contract.accepted || contract.completed || contract.failed) return { ok: false, reason: "Contract not active." };
  if (contract.deadline && contract.deadline <= gameTime) return { ok: false, reason: "Contract expired." };

  if (contract.type === "delivery") {
    const cargoAmount = ship.cargo[contract.cargoType || ""] || 0;
    const atDestination = isDocked
      && dockedBodyId === contract.destinationId
      && (!contract.destinationPortId || dockedPortId === contract.destinationPortId);
    if (!atDestination) return { ok: false, reason: "Dock at the destination port to deliver." };
    if (cargoAmount < (contract.amount || 0)) return { ok: false, reason: `Need ${(contract.amount || 0)}t ${contract.cargoType}.` };
    return { ok: true, reason: "Ready to deliver." };
  }

  if (contract.type === "passenger") {
    const atDestination = isDocked
      && dockedBodyId === contract.destinationId
      && (!contract.destinationPortId || dockedPortId === contract.destinationPortId);
    return atDestination
      ? { ok: true, reason: "Passengers ready to disembark." }
      : { ok: false, reason: "Dock at the destination port to disembark passengers." };
  }

  if (contract.type === "orbit") {
    const targetBody = bodies.find((body) => body.id === contract.destinationId);
    if (!targetBody) return { ok: false, reason: "Target body unavailable." };
    const targetPos = getAbsoluteBodyPosition(targetBody.id, bodies, gameState.gameTime);
    const targetVel = getBodyVelocity(targetBody.id, bodies, gameState.gameTime);
    const dist = Math.hypot(ship.x - targetPos.x, ship.y - targetPos.y);
    const relSpeed = Math.hypot(ship.vx - targetVel.vx, ship.vy - targetVel.vy);
    if (dist > (targetBody.radius || 0) + 1_200_000) return { ok: false, reason: "Move into the target orbital envelope." };
    if (relSpeed > 2_000) return { ok: false, reason: "Relative speed too high for orbital match." };
    return { ok: true, reason: "Telemetry match achieved." };
  }

  if (contract.type === "mining") {
    const minedAmount = ship.cargo[contract.cargoType || "ore"] || 0;
    const atOrigin = isDocked
      && dockedBodyId === contract.originId
      && (!contract.issuerPortId || dockedPortId === contract.issuerPortId);
    if (!atOrigin) return { ok: false, reason: "Return to the issuing port with the payload." };
    if (minedAmount < (contract.amount || 0)) return { ok: false, reason: `Need ${(contract.amount || 0)}t ${contract.cargoType || "ore"}.` };
    return { ok: true, reason: "Payload ready for handover." };
  }

  return { ok: false, reason: "Unknown contract type." };
}
