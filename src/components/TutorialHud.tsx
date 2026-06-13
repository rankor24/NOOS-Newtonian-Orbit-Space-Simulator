import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronDown, ChevronUp, Crosshair, GraduationCap, PanelTopClose } from "lucide-react";
import { CelestialBody, GameState } from "../types";
import { getAbsoluteBodyPosition, getDockingSpecs } from "../utils/physics";
import { getTutorialObjective, TUTORIAL_CONTRACT_ID, TUTORIAL_STEP_ORDER } from "../utils/tutorial";

interface TutorialHudProps {
  gameState: GameState;
  bodies: CelestialBody[];
  onSelectBody: (bodyId: string) => void;
  onOpenContracts: () => void;
  onSkipTutorial: () => void;
}

export const TutorialHud: React.FC<TutorialHudProps> = ({
  gameState,
  bodies,
  onSelectBody,
  onOpenContracts,
  onSkipTutorial,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [showActions, setShowActions] = useState(false);

  const tutorialContract = useMemo(
    () => gameState.contracts.find((contract) => contract.id === TUTORIAL_CONTRACT_ID) || null,
    [gameState.contracts],
  );

  const objective = useMemo(() => {
    if (!gameState.activeTutorialStep || gameState.tutorialSkipped || gameState.tutorialCompleted) return null;
    return getTutorialObjective(
      gameState.activeTutorialStep,
      bodies,
      gameState.tutorialStartBodyId,
      gameState.tutorialTargetBodyId,
      tutorialContract,
    );
  }, [
    gameState.activeTutorialStep,
    gameState.tutorialSkipped,
    gameState.tutorialCompleted,
    gameState.tutorialStartBodyId,
    gameState.tutorialTargetBodyId,
    bodies,
    tutorialContract,
  ]);

  useEffect(() => {
    if (objective) {
      setExpanded(true);
    }
  }, [objective?.id]);

  const bayClearanceStatus = useMemo(() => {
    if (objective?.id !== "bay-clearance" || !gameState.tutorialStartBodyId) return null;
    const startBody = bodies.find((body) => body.id === gameState.tutorialStartBodyId) || null;
    if (!startBody) return null;
    const startPos = getAbsoluteBodyPosition(startBody.id, bodies, gameState.gameTime);
    const distance = Math.hypot(gameState.ship.x - startPos.x, gameState.ship.y - startPos.y);
    const releaseDistance = getDockingSpecs(startBody).maxDistance * 1.05;
    const currentRangeKm = Math.max(0, Math.round((distance - (startBody.radius ?? 0)) / 1000));
    const requiredRangeKm = Math.max(1, Math.round((releaseDistance - (startBody.radius ?? 0)) / 1000));
    return {
      currentRangeKm,
      requiredRangeKm,
      progress: Math.max(0, Math.min(1, currentRangeKm / requiredRangeKm)),
      complete: distance >= releaseDistance,
    };
  }, [bodies, gameState.gameTime, gameState.ship.x, gameState.ship.y, gameState.tutorialStartBodyId, objective?.id]);
  const objectiveTarget = useMemo(
    () => (objective?.targetBodyId ? bodies.find((body) => body.id === objective.targetBodyId) || null : null),
    [bodies, objective?.targetBodyId],
  );
  const tutorialDeliveryReady = !!tutorialContract
    && tutorialContract.accepted
    && gameState.isDocked
    && gameState.dockedBodyId === tutorialContract.destinationId
    && (!tutorialContract.destinationPortId || gameState.dockedPortId === tutorialContract.destinationPortId);

  if (!objective) return null;

  const stepNumber = TUTORIAL_STEP_ORDER.indexOf(objective.id) + 1;
  const isContractStage = objective.id === "first-paid-run";
  const primaryAction = isContractStage && (!tutorialContract?.accepted || tutorialDeliveryReady)
    ? { label: "Open Contract Board", onClick: onOpenContracts }
    : objective.targetBodyId
      ? { label: objective.actionLabel, onClick: () => onSelectBody(objective.targetBodyId as string) }
      : null;

  return (
    <>
      {!expanded ? (
        <div className="elite-tutorial-hud-anchor pointer-events-none">
          <div className="pointer-events-auto rounded-xl border border-amber-500/35 bg-stone-950/88 px-4 py-2 shadow-xl backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-400">
                  <GraduationCap className="h-4 w-4" />
                  Flight Training {stepNumber}/5
                </div>
                <div className="mt-1 truncate text-sm font-semibold text-slate-100">{objective.title}</div>
                <div className="truncate text-[11px] text-stone-400">Next: {objective.instruction}</div>
              </div>
              <div className="flex items-center gap-2">
                {primaryAction ? (
                  <button
                    type="button"
                    onClick={primaryAction.onClick}
                    className="rounded-lg border border-stone-700 bg-stone-900 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-100 transition hover:border-amber-500 hover:text-amber-300"
                  >
                    {primaryAction.label}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="rounded-lg border border-stone-700 bg-stone-900 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-stone-300 transition hover:border-stone-500"
                >
                  Open
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {expanded ? (
        <div className="elite-tutorial-hud-anchor pointer-events-none">
          <section className="pointer-events-auto rounded-2xl border border-amber-500/30 bg-stone-950/92 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-3 border-b border-stone-800 pb-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-400">Training Mission {stepNumber}/5</div>
                <h3 className="mt-1 text-lg font-semibold text-slate-100">{objective.title}</h3>
                <p className="mt-1 text-sm text-stone-400">{objective.summary}</p>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="rounded-lg border border-stone-800 bg-stone-900 p-2 text-stone-400 transition hover:border-stone-600 hover:text-slate-200"
                title="Minimize tutorial guidance"
              >
                <PanelTopClose className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 pt-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">Current Objective</div>
                <p className="mt-1 text-sm leading-relaxed text-slate-200">{objective.instruction}</p>
              </div>

              {objectiveTarget ? (
                <div className="rounded-xl border border-stone-800 bg-stone-900/70 px-3 py-2 text-xs">
                  <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">Assigned Target</div>
                  <div className="mt-1 font-semibold text-sky-300">{objectiveTarget.stationName || objectiveTarget.name}</div>
                  {objectiveTarget.stationName && objectiveTarget.stationName !== objectiveTarget.name ? (
                    <div className="mt-1 text-stone-400">Body: {objectiveTarget.name}</div>
                  ) : null}
                </div>
              ) : null}

              {bayClearanceStatus ? (
                <div className="rounded-xl border border-sky-900/40 bg-sky-950/15 px-3 py-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-sky-400">Clearance Progress</div>
                    <div className={`font-semibold ${bayClearanceStatus.complete ? "text-emerald-400" : "text-sky-300"}`}>
                      {bayClearanceStatus.currentRangeKm.toLocaleString()} / {bayClearanceStatus.requiredRangeKm.toLocaleString()} km
                    </div>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-900">
                    <div
                      className={`h-full rounded-full ${bayClearanceStatus.complete ? "bg-emerald-400" : "bg-sky-400"}`}
                      style={{ width: `${Math.round(bayClearanceStatus.progress * 100)}%` }}
                    />
                  </div>
                  <div className="mt-2 text-stone-400">
                    Goal: leave the station approach zone once, then the same port can accept a new docking request.
                  </div>
                </div>
              ) : null}

              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">Why This Step Exists</div>
                <ul className="mt-2 space-y-2 text-xs leading-relaxed text-stone-300">
                  {objective.details.map((detail) => (
                    <li key={detail} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-stone-800 bg-stone-900/70 px-3 py-2 text-xs">
                <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-stone-500">Completion Reward</div>
                <div className="mt-1 font-semibold text-emerald-400">{objective.rewardLabel}</div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {primaryAction ? (
                  <button
                    type="button"
                    onClick={primaryAction.onClick}
                    className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold uppercase tracking-wide text-stone-950 transition hover:bg-amber-400"
                  >
                    {isContractStage && !tutorialContract?.accepted ? <ArrowRight className="h-4 w-4" /> : <Crosshair className="h-4 w-4" />}
                    {primaryAction.label}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setShowActions((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-xs font-bold uppercase tracking-wide text-stone-300 transition hover:border-stone-500"
                >
                  More
                  {showActions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>

              {showActions ? (
                <div className="rounded-xl border border-stone-800 bg-stone-900/70 px-3 py-3 text-xs text-stone-300">
                  <div className="font-bold uppercase tracking-[0.18em] text-stone-500">Training Controls</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={onOpenContracts}
                      className="rounded-lg border border-stone-700 px-3 py-2 font-bold uppercase tracking-wide text-stone-200 transition hover:border-sky-500 hover:text-sky-300"
                    >
                      Open Contract Board
                    </button>
                    <button
                      type="button"
                      onClick={onSkipTutorial}
                      className="rounded-lg border border-rose-900/60 px-3 py-2 font-bold uppercase tracking-wide text-rose-300 transition hover:bg-rose-950/30"
                    >
                      Skip Tutorial
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
};
