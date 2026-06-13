import React from "react";
import { AlertTriangle, Briefcase, CheckCircle2, Clock3, GraduationCap } from "lucide-react";
import { CelestialBody, GameState, SpaceContract } from "../types";
import { getContractCompletionStatus } from "../utils/contracts";
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
  if (contract.completed) return { label: "Completed", tone: "ok" as const };
  if (contract.failed || (contract.accepted && contract.deadline && contract.deadline <= gameTime)) {
    return { label: "Expired", tone: "warn" as const };
  }
  if (contract.accepted) return { label: "Active Log", tone: "active" as const };
  return { label: "Available", tone: "idle" as const };
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
  const activeContracts = normalContracts.filter((contract) => contract.accepted && !contract.completed && !contract.failed);
  const localOfferContracts = normalContracts.filter((contract) => (
    !contract.accepted
    && !contract.completed
    && !contract.failed
    && (!contract.issuerPortId || contract.issuerPortId === dockedPortId)
  ));
  const localArchiveContracts = normalContracts.filter((contract) => (
    (contract.completed || contract.failed)
    && !!dockedPortId
    && (contract.issuerPortId === dockedPortId || contract.destinationPortId === dockedPortId)
  ));
  const activeStepIndex = gameState.activeTutorialStep ? TUTORIAL_STEP_ORDER.indexOf(gameState.activeTutorialStep) : -1;
  const activeStepLabel = gameState.activeTutorialStep ? TUTORIAL_STEP_TITLES[gameState.activeTutorialStep] : "Paused";
  const showTutorialContract = !!tutorialContract
    && (tutorialContract.accepted || tutorialContract.completed || (!gameState.tutorialSkipped && gameState.activeTutorialStep === "first-paid-run"));

  const renderContractRow = (contract: SpaceContract) => {
    const originBody = bodies.find((body) => body.id === contract.originId);
    const destinationBody = bodies.find((body) => body.id === contract.destinationId);
    const originLabel = contract.issuerName || originBody?.name || "Unknown origin";
    const destinationLabel = contract.destinationName || destinationBody?.name || "Unknown destination";
    const status = getContractStatus(contract, gameTime);
    const completion = getContractCompletionStatus(contract, gameState, bodies);
    const deadlineExpired = !!contract.deadline && contract.deadline <= gameTime;
    const canAcceptHere = !contract.accepted
      && !contract.completed
      && !contract.failed
      && (!contract.issuerPortId || dockedPortId === contract.issuerPortId)
      && !deadlineExpired;

    let actionCell: React.ReactNode = null;
    if (contract.completed) {
      actionCell = <span className="elite-terminal-state is-ok"><CheckCircle2 size={14} /> Claimed</span>;
    } else if (contract.failed || deadlineExpired) {
      actionCell = <span className="elite-terminal-state is-warn"><AlertTriangle size={14} /> Lost</span>;
    } else if (contract.accepted && completion.ok) {
      actionCell = (
        <button type="button" className="elite-terminal-button is-primary" onClick={() => onCompleteContract(contract.id)}>
          Submit Payload
        </button>
      );
    } else if (contract.accepted) {
      actionCell = <span className="elite-terminal-note-inline">{completion.reason}</span>;
    } else {
      actionCell = (
        <button
          type="button"
          className="elite-terminal-button"
          disabled={!canAcceptHere}
          onClick={() => onAcceptContract(contract.id)}
          title={canAcceptHere ? "Accept contract" : "Dock at issuing port to sign"}
        >
          Accept Contract
        </button>
      );
    }

    return (
      <tr key={contract.id}>
        <td className="is-strong">
          <div className="elite-contract-title-cell">
            <span>{contract.title}</span>
            {contract.isTutorial ? <span className="elite-terminal-tag">Training</span> : null}
          </div>
        </td>
        <td>{originLabel}</td>
        <td className="elite-value-cyan">{destinationLabel}</td>
        <td>{contract.routeTag || contract.type.toUpperCase()}</td>
        <td className="is-number elite-value-amber">{contract.reward.toLocaleString()} cr</td>
        <td className="is-number">
          {contract.deadline ? (
            <span className={deadlineExpired ? "elite-value-red" : ""}>
              <Clock3 size={12} style={{ display: "inline", marginRight: 6 }} />
              {formatRemaining(contract.deadline, gameTime)}
            </span>
          ) : "Open"}
        </td>
        <td className="is-number">
          <span className={`elite-terminal-state ${status.tone === "ok" ? "is-ok" : status.tone === "warn" ? "is-warn" : status.tone === "active" ? "is-active" : ""}`}>
            {status.label}
          </span>
        </td>
        <td className="is-actions">{actionCell}</td>
      </tr>
    );
  };

  let trainingStatusText = "Certification complete. Training contracts stay archived here.";
  if (gameState.tutorialSkipped && !gameState.tutorialCompleted) {
    trainingStatusText = "Training is paused. Resume it from the board when you want guided objectives back.";
  } else if (!gameState.tutorialCompleted) {
    trainingStatusText = `Step ${activeStepIndex + 1}/5: ${activeStepLabel}. The HUD carries the live instruction and target.`;
  }

  return (
    <section className="elite-terminal-screen">
      <header className="elite-terminal-header">
        <div>
          <span className="elite-terminal-kicker">Mission Board</span>
          <h3 className="elite-terminal-title">Contract Ledger</h3>
          <p className="elite-terminal-copy">Dispatch traffic, courier manifests, orbital jobs, and training contracts.</p>
        </div>
      </header>

      <div className="elite-terminal-section elite-terminal-training">
        <div className="elite-terminal-section-bar">
          <span><GraduationCap size={14} /> Flight Training</span>
          {!gameState.tutorialCompleted && gameState.tutorialSkipped ? (
            <button type="button" className="elite-terminal-button is-primary" onClick={onResumeTutorial}>
              Resume Training
            </button>
          ) : (
            <strong>{gameState.tutorialCompleted ? "Complete" : activeStepLabel}</strong>
          )}
        </div>
        <div className="elite-terminal-note">{trainingStatusText}</div>
        {showTutorialContract && tutorialContract ? (
          <div className="elite-terminal-table-wrap">
            <table className="elite-terminal-table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Issuer</th>
                  <th>Destination</th>
                  <th>Route</th>
                  <th className="is-number">Reward</th>
                  <th className="is-number">Time</th>
                  <th className="is-number">Status</th>
                  <th className="is-actions">Action</th>
                </tr>
              </thead>
              <tbody>{renderContractRow(tutorialContract)}</tbody>
            </table>
          </div>
        ) : !gameState.tutorialSkipped && !gameState.tutorialCompleted ? (
          <div className="elite-terminal-note">The paid training run becomes available after docking practice.</div>
        ) : null}
      </div>

      <div className="elite-terminal-section">
        <div className="elite-terminal-section-bar">
          <span><Briefcase size={14} /> Active Runs</span>
          <strong>{activeContracts.length} In Flight</strong>
        </div>
        {activeContracts.length > 0 ? (
          <div className="elite-terminal-table-wrap">
            <table className="elite-terminal-table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Issuer</th>
                  <th>Destination</th>
                  <th>Route</th>
                  <th className="is-number">Reward</th>
                  <th className="is-number">Time</th>
                  <th className="is-number">Status</th>
                  <th className="is-actions">Action</th>
                </tr>
              </thead>
              <tbody>{activeContracts.map(renderContractRow)}</tbody>
            </table>
          </div>
        ) : (
          <div className="elite-terminal-note">No active runs. Accepted jobs appear here regardless of which station you are docked at.</div>
        )}
      </div>

      <div className="elite-terminal-section">
        <div className="elite-terminal-section-bar">
          <span><Briefcase size={14} /> Local Offers</span>
          <strong>{localOfferContracts.length} Posted Here</strong>
        </div>
        {localOfferContracts.length > 0 ? (
          <div className="elite-terminal-table-wrap">
            <table className="elite-terminal-table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Issuer</th>
                  <th>Destination</th>
                  <th>Route</th>
                  <th className="is-number">Reward</th>
                  <th className="is-number">Time</th>
                  <th className="is-number">Status</th>
                  <th className="is-actions">Action</th>
                </tr>
              </thead>
              <tbody>{localOfferContracts.map(renderContractRow)}</tbody>
            </table>
          </div>
        ) : (
          <div className="elite-terminal-note">No open contracts issued by this station right now.</div>
        )}
      </div>

      {localArchiveContracts.length > 0 ? (
        <div className="elite-terminal-section">
          <div className="elite-terminal-section-bar">
            <span><Briefcase size={14} /> Local Archive</span>
            <strong>{localArchiveContracts.length} Closed</strong>
          </div>
          <div className="elite-terminal-table-wrap">
            <table className="elite-terminal-table">
              <thead>
                <tr>
                  <th>Contract</th>
                  <th>Issuer</th>
                  <th>Destination</th>
                  <th>Route</th>
                  <th className="is-number">Reward</th>
                  <th className="is-number">Time</th>
                  <th className="is-number">Status</th>
                  <th className="is-actions">Action</th>
                </tr>
              </thead>
              <tbody>{localArchiveContracts.map(renderContractRow)}</tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
};
