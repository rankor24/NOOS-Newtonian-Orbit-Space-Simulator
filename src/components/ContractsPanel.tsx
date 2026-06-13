import React from "react";
import { AlertTriangle, ArrowUpRight, Briefcase, CheckCircle2, CircleDollarSign, Clock3, GraduationCap } from "lucide-react";
import { CelestialBody, GameState, SpaceContract } from "../types";
import { getAbsoluteBodyPosition, getBodyVelocity } from "../utils/physics";
import { TUTORIAL_CONTRACT_ID, TUTORIAL_STEP_ORDER, TUTORIAL_STEP_TITLES } from "../utils/tutorial";

interface ContractsPanelProps {
  gameState: GameState;
  bodies: CelestialBody[];
  onAcceptContract: (contractId: string) => void;
  onCompleteContract: (contractId: string) => void;
  onResumeTutorial: () => void;
}

function formatRemaining(seconds: number | undefined, gameTime: number) {
  if (!seconds) return "Open-ended";
  const remaining = Math.max(0, Math.floor(seconds - gameTime));
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getContractStatus(contract: SpaceContract, gameTime: number) {
  if (contract.completed) return { label: "COMPLETED", tone: "emerald" as const };
  if (contract.failed || (contract.accepted && contract.deadline && contract.deadline <= gameTime)) {
    return { label: "EXPIRED", tone: "rose" as const };
  }
  if (contract.accepted) return { label: "ACTIVE LOG", tone: "sky" as const };
  return { label: "AVAILABLE", tone: "stone" as const };
}

function getCardToneClass(tone: ReturnType<typeof getContractStatus>["tone"]) {
  switch (tone) {
    case "emerald":
      return "bg-stone-950/40 border-stone-900 opacity-70";
    case "rose":
      return "bg-rose-950/20 border-rose-900/40";
    case "sky":
      return "bg-sky-950/10 border-sky-900/40";
    default:
      return "bg-stone-900 border-stone-800";
  }
}

function getBadgeToneClass(tone: ReturnType<typeof getContractStatus>["tone"]) {
  switch (tone) {
    case "emerald":
      return "bg-emerald-950/30 text-emerald-400 border-emerald-900/50";
    case "rose":
      return "bg-rose-950/40 text-rose-400 border-rose-900/50";
    case "sky":
      return "bg-sky-950/40 text-sky-400 border-sky-900/50";
    default:
      return "bg-stone-950 text-stone-400 border-stone-800";
  }
}

function canCompleteContract(contract: SpaceContract, gameState: GameState, bodies: CelestialBody[]) {
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

function sortContracts(contracts: SpaceContract[]) {
  return [...contracts].sort((a, b) => {
    const score = (contract: SpaceContract) => {
      if (contract.completed) return 3;
      if (contract.failed) return 2;
      if (contract.accepted) return 0;
      return 1;
    };
    return score(a) - score(b);
  });
}

export const ContractsPanel: React.FC<ContractsPanelProps> = ({
  gameState,
  bodies,
  onAcceptContract,
  onCompleteContract,
  onResumeTutorial,
}) => {
  const { contracts, gameTime, dockedPortId } = gameState;
  const sortedContracts = sortContracts(contracts);
  const tutorialContract = sortedContracts.find((contract) => contract.id === TUTORIAL_CONTRACT_ID) || null;
  const normalContracts = sortedContracts.filter((contract) => !contract.isTutorial);
  const activeStepIndex = gameState.activeTutorialStep ? TUTORIAL_STEP_ORDER.indexOf(gameState.activeTutorialStep) : -1;
  const activeStepLabel = gameState.activeTutorialStep ? TUTORIAL_STEP_TITLES[gameState.activeTutorialStep] : "Paused";
  const showTutorialContract = !!tutorialContract
    && (tutorialContract.accepted || tutorialContract.completed || (!gameState.tutorialSkipped && gameState.activeTutorialStep === "first-paid-run"));

  const renderContractCard = (contract: SpaceContract) => {
    const originBody = bodies.find((body) => body.id === contract.originId);
    const destinationBody = bodies.find((body) => body.id === contract.destinationId);
    const originLabel = contract.issuerName || originBody?.name || "Unknown origin";
    const destinationLabel = contract.destinationName || destinationBody?.name || "Unknown destination";
    const originBodyLabel = originBody && originLabel !== originBody.name ? originBody.name : null;
    const destinationBodyLabel = destinationBody && destinationLabel !== destinationBody.name ? destinationBody.name : null;
    const status = getContractStatus(contract, gameTime);
    const completion = canCompleteContract(contract, gameState, bodies);
    const deadlineExpired = !!contract.deadline && contract.deadline <= gameTime;
    const canAcceptHere = !contract.accepted
      && !contract.completed
      && !contract.failed
      && (!contract.issuerPortId || dockedPortId === contract.issuerPortId)
      && !deadlineExpired;
    let contractAction: React.ReactNode;

    if (contract.completed) {
      contractAction = (
        <span className="text-xs text-emerald-500 font-mono font-bold flex items-center gap-1 md:justify-end">
          <CheckCircle2 className="w-4 h-4" /> REWARD CLAIMED
        </span>
      );
    } else if (contract.failed || deadlineExpired) {
      contractAction = (
        <span className="text-xs text-rose-400 font-mono font-bold flex items-center gap-1 md:justify-end">
          <AlertTriangle className="w-4 h-4" /> CONTRACT LOST
        </span>
      );
    } else if (contract.accepted && completion.ok) {
      contractAction = (
        <button
          onClick={() => onCompleteContract(contract.id)}
          className="bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-bold px-3 py-2 rounded-lg transition active:scale-95"
        >
          SUBMIT PAYLOAD
        </button>
      );
    } else if (contract.accepted) {
      contractAction = <div className="text-xs text-stone-500 md:text-right">{completion.reason}</div>;
    } else {
      let acceptTitle = "Contract unavailable";
      if (canAcceptHere) {
        acceptTitle = "Accept contract";
      } else if (contract.issuerPortId && dockedPortId !== contract.issuerPortId) {
        acceptTitle = "Dock at issuing port to sign";
      }
      contractAction = (
        <button
          onClick={() => onAcceptContract(contract.id)}
          disabled={!canAcceptHere}
          className={`text-xs font-bold px-3 py-2 rounded-lg transition ${canAcceptHere ? "bg-sky-600 hover:bg-sky-500 text-white" : "bg-stone-800 text-stone-500 cursor-not-allowed"}`}
          title={acceptTitle}
        >
          ACCEPT CONTRACT
        </button>
      );
    }

    return (
      <div
        key={contract.id}
        className={`border rounded-xl p-4 flex flex-col md:flex-row justify-between gap-4 ${getCardToneClass(status.tone)}`}
      >
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wide">{contract.title}</h4>
              {contract.isTutorial ? (
                <span className="text-[9px] px-2 py-0.5 rounded uppercase font-mono tracking-wider font-semibold border border-amber-700/60 bg-amber-950/30 text-amber-300">
                  Training
                </span>
              ) : null}
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-mono tracking-wider font-semibold border ${getBadgeToneClass(status.tone)}`}>
              {status.label}
            </span>
          </div>

          <p className="text-xs text-stone-400 leading-relaxed">{contract.description}</p>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] font-mono text-stone-500">
            <span>FROM:</span>
            <span className="text-stone-300 font-semibold">{originLabel}</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-stone-600 self-center" />
            <span className="text-sky-400 font-semibold">{destinationLabel}</span>
            {contract.amount ? <span className="text-amber-400">PAYLOAD {contract.amount}t</span> : null}
            {contract.passengerCount ? <span className="text-emerald-400">BERTHS {contract.passengerCount}</span> : null}
            {contract.routeTag ? <span>{contract.routeTag}</span> : null}
          </div>

          <div className="flex flex-wrap gap-4 text-[11px] font-mono">
            {originBodyLabel ? <span className="text-stone-500">Origin body: {originBodyLabel}</span> : null}
            {destinationBodyLabel ? <span className="text-stone-500">Target body: {destinationBodyLabel}</span> : null}
            <span className="inline-flex items-center gap-1 text-stone-400">
              <Clock3 className="w-3.5 h-3.5" />
              {contract.deadline ? `T-${formatRemaining(contract.deadline, gameTime)}` : "No deadline"}
            </span>
            {contract.deadline ? (
              <span className={deadlineExpired ? "text-rose-400" : "text-stone-500"}>
                Due at t={Math.floor(contract.deadline).toLocaleString()}s
              </span>
            ) : null}
            {contract.issuerFaction ? <span className="text-stone-500">Faction: {contract.issuerFaction}</span> : null}
          </div>
        </div>

        <div className="md:w-60 flex flex-col justify-between gap-3">
          <div className="font-mono space-y-0.5">
            <span className="text-[9px] text-stone-500 uppercase tracking-widest block">Reward</span>
            <span className="text-sm font-bold text-amber-400 flex items-center gap-1 md:justify-end">
              <CircleDollarSign className="w-4 h-4 text-amber-500" />
              {contract.reward.toLocaleString()}¢
            </span>
          </div>

          {contractAction}
        </div>
      </div>
    );
  };

  let trainingStatusText = "Certification complete. Training contracts stay archived here.";
  if (gameState.tutorialSkipped && !gameState.tutorialCompleted) {
    trainingStatusText = "Training is paused. Resume when you want guided flight objectives back on the HUD.";
  } else if (!gameState.tutorialCompleted) {
    trainingStatusText = `Current step ${activeStepIndex + 1}/5: ${activeStepLabel}. The HUD shows the exact target and completion condition.`;
  }

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-md space-y-4 font-sans">
      <div className="flex items-center gap-2 border-b border-stone-800 pb-3">
        <Briefcase className="w-5 h-5 text-sky-400" />
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">Contract Board</h3>
          <p className="text-xs text-stone-400">Dock at issuing ports to sign, then race the deadline.</p>
        </div>
      </div>

      <section className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <GraduationCap className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wide">Flight Training</h4>
              <p className="text-xs text-stone-400">{trainingStatusText}</p>
            </div>
          </div>
          {!gameState.tutorialCompleted && gameState.tutorialSkipped ? (
            <button
              type="button"
              onClick={onResumeTutorial}
              className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold uppercase tracking-wide text-stone-950 transition hover:bg-amber-400"
            >
              Resume Training
            </button>
          ) : null}
        </div>

        {showTutorialContract && tutorialContract ? (
          renderContractCard(tutorialContract)
        ) : !gameState.tutorialSkipped && !gameState.tutorialCompleted ? (
          <div className="rounded-lg border border-stone-800 bg-stone-950/50 px-3 py-2 text-xs text-stone-400">
            The paid training run unlocks after docking practice.
          </div>
        ) : null}
      </section>

      <div className="space-y-3">
        {normalContracts.length > 0 ? (
          normalContracts.map(renderContractCard)
        ) : (
          <div className="rounded-xl border border-stone-800 bg-stone-950/50 p-4 text-xs text-stone-500">
            No open contracts posted at this board right now.
          </div>
        )}
      </div>
    </div>
  );
};
