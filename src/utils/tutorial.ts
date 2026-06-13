import { CelestialBody, GameState, SpaceContract, TutorialStepId } from "../types";
import { getAbsoluteBodyPosition } from "./physics";
import { getDisplayPortName, getPortsForBody, pickDockingPortForBody, pickPortForBody } from "./worldText";

export const TUTORIAL_PROMPT_PREFERENCE_KEY = "newtonian_tutorial_prompt_preference";
export const TUTORIAL_CONTRACT_ID = "tutorial_first_paid_run";
export const TUTORIAL_STEP_ORDER: TutorialStepId[] = [
  "bay-clearance",
  "hold-vector",
  "match-speed",
  "docking-practice",
  "first-paid-run",
];

export const TUTORIAL_STEP_TITLES: Record<TutorialStepId, string> = {
  "bay-clearance": "Bay Clearance",
  "hold-vector": "Hold a Vector",
  "match-speed": "Match Speed",
  "docking-practice": "Docking Practice",
  "first-paid-run": "First Paid Run",
};

export interface TutorialReward {
  credits: number;
  fuelKg?: number;
}

export interface TutorialObjectiveView {
  id: TutorialStepId;
  title: string;
  summary: string;
  instruction: string;
  details: string[];
  reward: TutorialReward;
  rewardLabel: string;
  targetBodyId: string | null;
  actionLabel: string;
}

export interface TutorialStepCompletion {
  state: GameState;
  completed: boolean;
  nextStep: TutorialStepId | null;
  reward: TutorialReward;
}

export function formatTutorialRewardLabel(reward: TutorialReward) {
  const parts: string[] = [];
  if (reward.credits > 0) parts.push(`+${reward.credits.toLocaleString()}¢`);
  if ((reward.fuelKg || 0) > 0) parts.push(`+${Math.round(reward.fuelKg || 0).toLocaleString()} kg fuel`);
  return parts.join(" • ");
}

function distanceBetweenBodies(a: CelestialBody, b: CelestialBody, bodies: CelestialBody[]) {
  const aPos = getAbsoluteBodyPosition(a.id, bodies, 0);
  const bPos = getAbsoluteBodyPosition(b.id, bodies, 0);
  return Math.hypot(aPos.x - bPos.x, aPos.y - bPos.y);
}

export function getNextTutorialStep(stepId: TutorialStepId): TutorialStepId | null {
  const currentIndex = TUTORIAL_STEP_ORDER.indexOf(stepId);
  if (currentIndex < 0 || currentIndex >= TUTORIAL_STEP_ORDER.length - 1) return null;
  return TUTORIAL_STEP_ORDER[currentIndex + 1];
}

export function getFirstIncompleteTutorialStep(completedSteps: TutorialStepId[]): TutorialStepId | null {
  return TUTORIAL_STEP_ORDER.find((stepId) => !completedSteps.includes(stepId)) || null;
}

export function isTutorialStepActive(state: GameState, stepId: TutorialStepId): boolean {
  return !state.tutorialSkipped
    && !state.tutorialCompleted
    && state.activeTutorialStep === stepId
    && !state.completedTrainingMissionIds.includes(stepId);
}

export function completeTutorialStep(state: GameState, stepId: TutorialStepId): TutorialStepCompletion {
  const reward = getTutorialReward(stepId);
  if (!isTutorialStepActive(state, stepId)) {
    return { state, completed: false, nextStep: state.activeTutorialStep, reward };
  }

  const nextStep = getNextTutorialStep(stepId);
  const completedTrainingMissionIds = [...state.completedTrainingMissionIds, stepId];
  const ship = reward.fuelKg
    ? { ...state.ship, fuelLevel: Math.min(state.ship.maxFuel, state.ship.fuelLevel + reward.fuelKg) }
    : state.ship;

  return {
    state: {
      ...state,
      playerCredits: state.playerCredits + reward.credits,
      ship,
      tutorialSkipped: false,
      tutorialCompleted: nextStep === null,
      activeTutorialStep: nextStep,
      completedTrainingMissionIds,
    },
    completed: true,
    nextStep,
    reward,
  };
}

export function getTutorialReward(stepId: TutorialStepId): TutorialReward {
  switch (stepId) {
    case "bay-clearance":
      return { credits: 150 };
    case "hold-vector":
      return { credits: 200 };
    case "match-speed":
      return { credits: 250 };
    case "docking-practice":
      return { credits: 350, fuelKg: 600 };
    case "first-paid-run":
      return { credits: 900 };
    default:
      return { credits: 0 };
  }
}

export function pickTutorialDockTargetBodyId(startBodyId: string | null, bodies: CelestialBody[]): string | null {
  const startBody = startBodyId ? bodies.find((body) => body.id === startBodyId) : null;
  if (!startBody) return null;

  const candidates = bodies
    .filter((body) => body.id !== startBody.id && getPortsForBody(body).length > 0)
    .sort((a, b) => {
      const aSameParent = a.parentId === startBody.parentId ? -1 : 0;
      const bSameParent = b.parentId === startBody.parentId ? -1 : 0;
      if (aSameParent !== bSameParent) return aSameParent - bSameParent;
      return distanceBetweenBodies(a, startBody, bodies) - distanceBetweenBodies(b, startBody, bodies);
    });

  return candidates[0]?.id || null;
}

export function pickTutorialRunDestination(startBodyId: string | null, bodies: CelestialBody[]): { bodyId: string; portId: string | null } | null {
  const startBody = startBodyId ? bodies.find((body) => body.id === startBodyId) : null;
  if (!startBody) return null;

  const candidates = bodies
    .filter((body) => body.id !== startBody.id)
    .map((body) => ({
      body,
      port: pickDockingPortForBody(body),
    }))
    .filter((entry): entry is { body: CelestialBody; port: NonNullable<ReturnType<typeof pickPortForBody>> } => !!entry.port)
    .sort((a, b) => {
      const aStationBias = a.body.type === "station" ? -1 : 0;
      const bStationBias = b.body.type === "station" ? -1 : 0;
      if (aStationBias !== bStationBias) return aStationBias - bStationBias;

      const aSameParent = a.body.parentId === startBody.parentId ? -1 : 0;
      const bSameParent = b.body.parentId === startBody.parentId ? -1 : 0;
      if (aSameParent !== bSameParent) return aSameParent - bSameParent;

      return distanceBetweenBodies(a.body, startBody, bodies) - distanceBetweenBodies(b.body, startBody, bodies);
    });

  if (!candidates[0]) return null;
  return { bodyId: candidates[0].body.id, portId: candidates[0].port.id };
}

export function buildTutorialContract(issuerBodyId: string | null, bodies: CelestialBody[]): SpaceContract | null {
  const issuerBody = issuerBodyId ? bodies.find((body) => body.id === issuerBodyId) : null;
  const issuerPort = pickPortForBody(issuerBody, "contracts") || pickDockingPortForBody(issuerBody);
  const destination = pickTutorialRunDestination(issuerBodyId, bodies);
  const destinationBody = destination ? bodies.find((body) => body.id === destination.bodyId) : null;
  const destinationPort = destinationBody
    ? (destination?.portId ? getPortsForBody(destinationBody).find((port) => port.id === destination.portId) : null) || pickDockingPortForBody(destinationBody)
    : null;

  if (!issuerBody || !issuerPort || !destinationBody || !destinationPort) return null;

  return {
    id: TUTORIAL_CONTRACT_ID,
    title: "First Paid Run",
    description: `Carry a sealed training avionics box from ${issuerPort.name} to ${destinationPort.name}. This is a real paid courier manifest, but it stays inside flight training until you complete it.`,
    type: "delivery",
    originId: issuerBody.id,
    destinationId: destinationBody.id,
    reward: 1200,
    issuerPortId: issuerPort.id,
    issuerName: `${issuerPort.name} Training Desk`,
    issuerFaction: issuerPort.faction,
    destinationPortId: destinationPort.id,
    destinationName: destinationPort.name,
    routeTag: `${issuerPort.name} → ${destinationPort.name}`,
    cargoType: "machinery",
    amount: 1,
    completed: false,
    accepted: false,
    failed: false,
    isTutorial: true,
    trainingMissionId: "first-paid-run",
  };
}

export function upsertTutorialContract(contracts: SpaceContract[], issuerBodyId: string | null, bodies: CelestialBody[]): SpaceContract[] {
  const tutorialContract = buildTutorialContract(issuerBodyId, bodies);
  const existingTutorial = contracts.find((contract) => contract.id === TUTORIAL_CONTRACT_ID);
  const withoutTutorial = contracts.filter((contract) => contract.id !== TUTORIAL_CONTRACT_ID);
  if (!tutorialContract) return withoutTutorial;
  const restoredTutorial = existingTutorial
    ? {
        ...tutorialContract,
        ...existingTutorial,
        id: TUTORIAL_CONTRACT_ID,
        isTutorial: true,
        trainingMissionId: "first-paid-run" as const,
      }
    : tutorialContract;
  return [...withoutTutorial, restoredTutorial];
}

function getCargoUsedTons(ship: GameState["ship"]) {
  return Object.values(ship.cargo).reduce((total, amount) => total + (amount || 0), 0);
}

export function reconcileFirstPaidRunTutorialContract(state: GameState): {
  state: GameState;
  changed: boolean;
  blocked: boolean;
  accepted: boolean;
  loadedCargoTons: number;
} {
  if (
    state.tutorialSkipped
    || state.tutorialCompleted
    || state.activeTutorialStep !== "first-paid-run"
  ) {
    return { state, changed: false, blocked: false, accepted: false, loadedCargoTons: 0 };
  }

  const tutorialContract = state.contracts.find((contract) => contract.id === TUTORIAL_CONTRACT_ID);
  if (!tutorialContract || tutorialContract.completed || tutorialContract.failed) {
    return { state, changed: false, blocked: false, accepted: false, loadedCargoTons: 0 };
  }

  let nextShip = state.ship;
  let loadedCargoTons = 0;

  if (tutorialContract.type === "delivery" && tutorialContract.cargoType) {
    const requiredAmount = tutorialContract.amount || 0;
    const currentAmount = nextShip.cargo[tutorialContract.cargoType] || 0;
    const missingAmount = Math.max(0, requiredAmount - currentAmount);
    if (missingAmount > 0) {
      const cargoLimit = nextShip.cargoCapacityTons ?? nextShip.cargoCapacity;
      if (getCargoUsedTons(nextShip) + missingAmount > cargoLimit) {
        return { state, changed: false, blocked: true, accepted: false, loadedCargoTons: 0 };
      }

      loadedCargoTons = missingAmount;
      nextShip = {
        ...nextShip,
        cargo: {
          ...nextShip.cargo,
          [tutorialContract.cargoType]: currentAmount + missingAmount,
        },
      };
    }
  }

  const shouldAccept = !tutorialContract.accepted;
  if (!shouldAccept && loadedCargoTons <= 0) {
    return { state, changed: false, blocked: false, accepted: false, loadedCargoTons: 0 };
  }

  return {
    state: {
      ...state,
      ship: nextShip,
      contracts: state.contracts.map((contract) => (
        contract.id === TUTORIAL_CONTRACT_ID
          ? { ...contract, accepted: true, failed: false }
          : contract
      )),
    },
    changed: true,
    blocked: false,
    accepted: shouldAccept,
    loadedCargoTons,
  };
}

export function getTutorialObjective(
  activeTutorialStep: TutorialStepId,
  bodies: CelestialBody[],
  tutorialStartBodyId: string | null,
  tutorialTargetBodyId: string | null,
  tutorialContract: SpaceContract | null,
): TutorialObjectiveView {
  const reward = getTutorialReward(activeTutorialStep);
  const startBody = tutorialStartBodyId ? bodies.find((body) => body.id === tutorialStartBodyId) || null : null;
  const targetBody = tutorialTargetBodyId ? bodies.find((body) => body.id === tutorialTargetBodyId) || null : null;

  switch (activeTutorialStep) {
    case "bay-clearance":
      return {
        id: activeTutorialStep,
        title: "Bay Clearance",
        summary: `Undock from ${getDisplayPortName(startBody)} and leave its docking-control zone.`,
        instruction: "Use UNDOCK, then push your range beyond the clearance threshold shown in the training panel.",
        details: [
          "You cannot request docking at the same port again until you have cleared the departure corridor once.",
          "Stay calm: zero throttle is fine if you need to re-orient.",
          "You are only trying to leave the docking envelope, not race anywhere.",
          "If you drift, use small heading changes and short burns instead of panicking.",
        ],
        reward,
        rewardLabel: formatTutorialRewardLabel(reward),
        targetBodyId: tutorialStartBodyId,
        actionLabel: "Show start port",
      };
    case "hold-vector":
      return {
        id: activeTutorialStep,
        title: "Hold a Vector",
        summary: `Point at ${getDisplayPortName(targetBody)} and make a short, controlled burn.`,
        instruction: "Select the practice target, align your nose, and push enough throttle to feel that velocity keeps carrying you after the burn ends.",
        details: [
          "The ship keeps moving after thrust stops. That is the main Newtonian lesson here.",
          "Use ALIGN if you want help rotating toward the selected target.",
          "A short burn is enough; you do not need full throttle.",
        ],
        reward,
        rewardLabel: formatTutorialRewardLabel(reward),
        targetBodyId: tutorialTargetBodyId,
        actionLabel: "Select practice target",
      };
    case "match-speed":
      return {
        id: activeTutorialStep,
        title: "Match Speed",
        summary: `Bleed your relative velocity against ${getDisplayPortName(targetBody)} until you are under control.`,
        instruction: "Use MATCH if you want assist, or brake manually until your relative speed is low enough for a safe approach.",
        details: [
          "You are not stopping in absolute space; you are matching the target's motion.",
          "Manual braking works too if you point opposite your drift and thrust carefully.",
          "Get the relative speed low before you try to dock.",
        ],
        reward,
        rewardLabel: formatTutorialRewardLabel(reward),
        targetBodyId: tutorialTargetBodyId,
        actionLabel: "Select approach target",
      };
    case "docking-practice":
      return {
        id: activeTutorialStep,
        title: "Docking Practice",
        summary: `Approach and dock at ${getDisplayPortName(targetBody)}.`,
        instruction: "Close in gently, keep the relative speed inside the docking envelope, then request docking clearance and hold position until clamps engage.",
        details: [
          "If docking is denied, you are still too fast or too far away.",
          "APPR can help with the final approach if you want flight assist.",
          "Once you are docked, the training desk will unlock your first paid run.",
        ],
        reward,
        rewardLabel: formatTutorialRewardLabel(reward),
        targetBodyId: tutorialTargetBodyId,
        actionLabel: "Select docking target",
      };
    case "first-paid-run":
    default:
      return {
        id: "first-paid-run",
        title: tutorialContract?.title || "First Paid Run",
        summary: tutorialContract?.description || "Take a small paid run to prove you can accept, track, and finish a contract.",
        instruction: "The training manifest is loaded automatically. Fly it to the destination and submit it from the contract board like a normal job.",
        details: [
          `Issuer: ${tutorialContract?.issuerName || getDisplayPortName(startBody)}`,
          `Destination: ${tutorialContract?.destinationName || "Assigned training port"}`,
          "This mission uses the normal contract flow on purpose. Training is not a fake side mode.",
        ],
        reward,
        rewardLabel: formatTutorialRewardLabel(reward),
        targetBodyId: tutorialContract?.destinationId || null,
        actionLabel: tutorialContract?.accepted ? "Select destination" : "Open contract board",
      };
  }
}
