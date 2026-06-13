import React, { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CheckCircle2, Compass, Dock, RotateCcw } from "lucide-react";
import { CelestialBody, ShipState } from "../types";
import { PortRecord, generateDockingGrantedSequence, getAmbientTrafficLine } from "../utils/worldText";

type DockingPhase = "arrival" | "alignment" | "parking" | "complete";

interface DockingSequenceModalProps {
  ship: ShipState;
  body: CelestialBody;
  port: PortRecord;
  onComplete: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getShipFootprint(ship: ShipState) {
  const cargoScale = ship.cargoCapacityTons ?? ship.cargoCapacity;
  const length = clamp(38 + cargoScale * 1.2, 38, 84);
  const width = clamp(22 + cargoScale * 0.7, 22, 48);
  return { length, width };
}

export const DockingSequenceModal: React.FC<DockingSequenceModalProps> = ({
  ship,
  body,
  port,
  onComplete,
}) => {
  const [phase, setPhase] = useState<DockingPhase>("arrival");
  const [alignment, setAlignment] = useState({ x: 24, y: -18, progress: 0 });
  const [parking, setParking] = useState({ x: 28, y: -20, heading: 18, progress: 0 });
  const [warningPulse, setWarningPulse] = useState(false);
  const [ambientLine] = useState(() => getAmbientTrafficLine(body));
  const [sequenceLines] = useState(() => generateDockingGrantedSequence(body));
  const footprint = getShipFootprint(ship);

  useEffect(() => {
    if (phase !== "alignment") return;
    const id = window.setInterval(() => {
      setAlignment((prev) => {
        const nextX = clamp(prev.x + 2.4, -48, 48);
        const nextY = clamp(prev.y - 1.8, -34, 34);
        const centered = Math.abs(nextX) < 10 && Math.abs(nextY) < 8;
        const nextProgress = clamp(prev.progress + (centered ? 12 : -10), 0, 100);
        return { x: nextX, y: nextY, progress: nextProgress };
      });
    }, 220);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "parking") return;
    const id = window.setInterval(() => {
      setParking((prev) => {
        const nextHeading = clamp(prev.heading + 1.2, -35, 35);
        const padFit = Math.abs(prev.x) < 14 && Math.abs(prev.y) < 10 && Math.abs(nextHeading) < 7;
        const nextProgress = clamp(prev.progress + (padFit ? 10 : -8), 0, 100);
        return { ...prev, heading: nextHeading, progress: nextProgress };
      });
    }, 220);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "alignment" && alignment.progress >= 100) {
      setPhase("parking");
    }
  }, [alignment.progress, phase]);

  useEffect(() => {
    if (phase === "parking" && parking.progress >= 100) {
      setPhase("complete");
    }
  }, [parking.progress, phase]);

  useEffect(() => {
    if (phase !== "alignment" && phase !== "parking") return;
    const unstable = phase === "alignment"
      ? Math.abs(alignment.x) > 30 || Math.abs(alignment.y) > 20
      : Math.abs(parking.x) > 18 || Math.abs(parking.y) > 12 || Math.abs(parking.heading) > 20;
    setWarningPulse(unstable);
  }, [alignment.x, alignment.y, parking.x, parking.y, parking.heading, phase]);

  const nudgeAlignment = (dx: number, dy: number) => {
    setAlignment((prev) => ({
      ...prev,
      x: clamp(prev.x + dx, -48, 48),
      y: clamp(prev.y + dy, -34, 34),
    }));
  };

  const nudgeParking = (dx: number, dy: number, dHeading = 0) => {
    setParking((prev) => ({
      ...prev,
      x: clamp(prev.x + dx, -32, 32),
      y: clamp(prev.y + dy, -24, 24),
      heading: clamp(prev.heading + dHeading, -35, 35),
    }));
  };

  return (
    <div className="elite-modal-backdrop elite-docking-backdrop" role="dialog" aria-modal="true" aria-label="Docking sequence">
      <section className="elite-fullscreen-modal elite-docking-modal">
        <div className="elite-modal-header">
          <span>
            <Dock size={15} />
            Docking Sequence
          </span>
          <span>{port.name.toUpperCase()}</span>
        </div>

        <div className="elite-docking-layout">
          <aside className="elite-docking-sidebar">
            <div className="elite-docking-kicker">Traffic Control</div>
            <h2>{port.name}</h2>
            <p>{port.faction}</p>
            <div className="elite-docking-status">
              <span>Assigned Bay</span>
              <strong>{port.kind === "station" ? "GATE 03 / PAD C-12" : "PAD A-04"}</strong>
            </div>
            <div className={`elite-docking-alert${warningPulse ? " is-hot" : ""}`}>
              {warningPulse ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
              {warningPulse ? "Approach unstable. Correct before capture drops." : "Link stable. Continue final approach."}
            </div>
            <div className="elite-docking-log">
              {sequenceLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {ambientLine ? <p>{ambientLine}</p> : null}
            </div>
          </aside>

          <div className="elite-docking-main">
            {phase === "arrival" ? (
              <div className="elite-docking-phase">
                <div className="elite-docking-phase-copy">
                  <div className="elite-docking-kicker">Connection Handshake</div>
                  <h3>Local camera link and docking telemetry online.</h3>
                  <p>
                    External approach cameras are loading. Follow the assigned corridor, then settle the hull onto the marked pad before station services unlock.
                  </p>
                </div>
                <div className="elite-docking-arrival-card">
                  <div><span>Hull</span><strong>{ship.name}</strong></div>
                  <div><span>Destination</span><strong>{port.bodyName}</strong></div>
                  <div><span>Procedure</span><strong>{port.kind === "station" ? "Gate align -> Pad park" : "Surface settle -> Pad park"}</strong></div>
                </div>
                <button type="button" className="elite-docking-primary" onClick={() => setPhase("alignment")}>
                  Start Final Approach
                </button>
              </div>
            ) : null}

            {phase === "alignment" ? (
              <div className="elite-docking-phase">
                <div className="elite-docking-phase-copy">
                  <div className="elite-docking-kicker">Minigame 01</div>
                  <h3>Center the ship in the station gate.</h3>
                  <p>Ignore the space map. Hold the silhouette inside the gate box until capture reaches 100%.</p>
                </div>
                <div className="elite-docking-gate-view">
                  <div className="elite-docking-gate-frame">
                    <div className="elite-docking-gate-target" />
                    <div
                      className="elite-docking-gate-ship"
                      style={{ transform: `translate(${alignment.x}px, ${alignment.y}px)` }}
                    />
                  </div>
                  <div className="elite-docking-progress">
                    <span>Capture</span>
                    <div><i style={{ width: `${alignment.progress}%` }} /></div>
                    <strong>{alignment.progress}%</strong>
                  </div>
                </div>
                <div className="elite-docking-controls">
                  <button type="button" onClick={() => nudgeAlignment(0, -8)}><ArrowUp size={15} /> Up</button>
                  <button type="button" onClick={() => nudgeAlignment(-8, 0)}><ArrowLeft size={15} /> Left</button>
                  <button type="button" onClick={() => nudgeAlignment(8, 0)}><ArrowRight size={15} /> Right</button>
                  <button type="button" onClick={() => nudgeAlignment(0, 8)}><ArrowDown size={15} /> Down</button>
                </div>
              </div>
            ) : null}

            {phase === "parking" ? (
              <div className="elite-docking-phase">
                <div className="elite-docking-phase-copy">
                  <div className="elite-docking-kicker">Minigame 02</div>
                  <h3>Fit the hull inside the assigned pad.</h3>
                  <p>Keep the ship within the rectangle and reduce heading error until clamp authorization completes.</p>
                </div>
                <div className="elite-docking-pad-view">
                  <div className="elite-docking-pad">
                    <div className="elite-docking-pad-target" />
                    <div
                      className="elite-docking-pad-ship"
                      style={{
                        width: `${footprint.width}px`,
                        height: `${footprint.length}px`,
                        transform: `translate(${parking.x}px, ${parking.y}px) rotate(${parking.heading}deg)`,
                      }}
                    />
                  </div>
                  <div className="elite-docking-progress">
                    <span>Clamp Auth</span>
                    <div><i style={{ width: `${parking.progress}%` }} /></div>
                    <strong>{parking.progress}%</strong>
                  </div>
                </div>
                <div className="elite-docking-controls">
                  <button type="button" onClick={() => nudgeParking(0, -6)}><ArrowUp size={15} /> Nose Up</button>
                  <button type="button" onClick={() => nudgeParking(-6, 0)}><ArrowLeft size={15} /> Port</button>
                  <button type="button" onClick={() => nudgeParking(6, 0)}><ArrowRight size={15} /> Starboard</button>
                  <button type="button" onClick={() => nudgeParking(0, 6)}><ArrowDown size={15} /> Stern</button>
                  <button type="button" onClick={() => nudgeParking(0, 0, -6)}><RotateCcw size={15} /> Rotate Left</button>
                  <button type="button" onClick={() => nudgeParking(0, 0, 6)}><Compass size={15} /> Rotate Right</button>
                </div>
              </div>
            ) : null}

            {phase === "complete" ? (
              <div className="elite-docking-phase">
                <div className="elite-docking-phase-copy">
                  <div className="elite-docking-kicker">Dock Complete</div>
                  <h3>Clamps engaged. Station network unlocked.</h3>
                  <p>External loaders are in position. Cargo, contracts, shipyard access, and local services are ready through the dock terminal.</p>
                </div>
                <div className="elite-docking-arrival-card">
                  <div><span>Hull Footprint</span><strong>{Math.round(footprint.width)}m x {Math.round(footprint.length)}m</strong></div>
                  <div><span>Final Pad</span><strong>{port.kind === "station" ? "C-12" : "A-04"}</strong></div>
                  <div><span>Service Link</span><strong>Ready</strong></div>
                </div>
                <button type="button" className="elite-docking-primary" onClick={onComplete}>
                  Open Dock Terminal
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
};
