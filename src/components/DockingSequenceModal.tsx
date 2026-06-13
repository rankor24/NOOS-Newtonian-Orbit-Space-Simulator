import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Dock, LogOut, Play, RotateCcw } from "lucide-react";
import { CelestialBody, ShipState } from "../types";
import shipSpriteUrl from "../assets/ship.svg";
import { PortRecord, generateDockingGrantedSequence, getAmbientTrafficLine } from "../utils/worldText";

type DockingPhase = "link" | "gate" | "pad" | "complete";

interface DockingSequenceModalProps {
  ship: ShipState;
  body: CelestialBody;
  port: PortRecord;
  onComplete: () => void;
  onAbort: () => void;
}

const SHIP_SPRITE_WIDTH = 120;
const REAR_VIEW_WIDTH = SHIP_SPRITE_WIDTH;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export const DockingSequenceModal: React.FC<DockingSequenceModalProps> = ({
  ship,
  body,
  port,
  onComplete,
  onAbort,
}) => {
  const [phase, setPhase] = useState<DockingPhase>("link");
  const [alignment, setAlignment] = useState({ x: 34, y: -22, progress: 0 });
  const [parking, setParking] = useState({ x: 30, y: -18, heading: 16, progress: 0 });
  const sequenceLines = useMemo(() => generateDockingGrantedSequence(body).slice(0, 4), [body]);
  const ambientLine = useMemo(() => getAmbientTrafficLine(body), [body]);

  const isGateStable = Math.abs(alignment.x) <= 14 && Math.abs(alignment.y) <= 10;
  const isPadStable = Math.abs(parking.x) <= 12 && Math.abs(parking.y) <= 9 && Math.abs(parking.heading) <= 7;
  const isUnstable = phase === "gate" ? !isGateStable : phase === "pad" ? !isPadStable : false;

  useEffect(() => {
    if (phase !== "gate") return;
    const id = window.setInterval(() => {
      setAlignment((prev) => {
        const stable = Math.abs(prev.x) <= 14 && Math.abs(prev.y) <= 10;
        const nextProgress = clamp(prev.progress + (stable ? 5 : -3), 0, 100);
        return { ...prev, progress: nextProgress };
      });
    }, 160);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "pad") return;
    const id = window.setInterval(() => {
      setParking((prev) => {
        const stable = Math.abs(prev.x) <= 12 && Math.abs(prev.y) <= 9 && Math.abs(prev.heading) <= 7;
        const nextProgress = clamp(prev.progress + (stable ? 5 : -3), 0, 100);
        return { ...prev, progress: nextProgress };
      });
    }, 160);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === "gate" && alignment.progress >= 100) {
      setPhase("pad");
    }
  }, [alignment.progress, phase]);

  useEffect(() => {
    if (phase === "pad" && parking.progress >= 100) {
      setPhase("complete");
    }
  }, [parking.progress, phase]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const handledKeys = ["escape", "enter", " ", "w", "a", "s", "d", "q", "e", "arrowup", "arrowleft", "arrowdown", "arrowright"];
      if (!handledKeys.includes(key)) return;

      event.preventDefault();
      if (key === "escape") {
        onAbort();
        return;
      }

      if ((key === "enter" || key === " ") && phase === "link") {
        setPhase("gate");
        return;
      }

      if ((key === "enter" || key === " ") && phase === "complete") {
        onComplete();
        return;
      }

      const dx = key === "a" || key === "arrowleft" ? -8 : key === "d" || key === "arrowright" ? 8 : 0;
      const dy = key === "w" || key === "arrowup" ? -8 : key === "s" || key === "arrowdown" ? 8 : 0;

      if (phase === "gate" && (dx !== 0 || dy !== 0)) {
        setAlignment((prev) => ({
          ...prev,
          x: clamp(prev.x + dx, -58, 58),
          y: clamp(prev.y + dy, -38, 38),
        }));
      }

      if (phase === "pad") {
        const dHeading = key === "q" ? -6 : key === "e" ? 6 : 0;
        if (dx !== 0 || dy !== 0 || dHeading !== 0) {
          setParking((prev) => ({
            ...prev,
            x: clamp(prev.x + dx, -42, 42),
            y: clamp(prev.y + dy, -30, 30),
            heading: clamp(prev.heading + dHeading, -28, 28),
          }));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [onAbort, onComplete, phase]);

  const nudgeGate = (dx: number, dy: number) => {
    setAlignment((prev) => ({
      ...prev,
      x: clamp(prev.x + dx, -58, 58),
      y: clamp(prev.y + dy, -38, 38),
    }));
  };

  const nudgePad = (dx: number, dy: number, dHeading = 0) => {
    setParking((prev) => ({
      ...prev,
      x: clamp(prev.x + dx, -42, 42),
      y: clamp(prev.y + dy, -30, 30),
      heading: clamp(prev.heading + dHeading, -28, 28),
    }));
  };

  const rearViewTransform = `translate(${alignment.x}px, ${alignment.y}px)`;

  return (
    <div className="elite-modal-backdrop elite-docking-backdrop" role="dialog" aria-modal="true" aria-label="Docking sequence">
      <section className="elite-fullscreen-modal elite-docking-modal">
        <div className="elite-modal-header elite-docking-header">
          <span>
            <Dock size={14} />
            Docking
          </span>
          <button type="button" onClick={onAbort} title="Abort docking sequence">
            <LogOut size={13} />
            Abort
          </button>
        </div>

        <div className="elite-docking-body">
          <div className="elite-docking-title-row">
            <div>
              <div className="elite-docking-kicker">{phase === "link" ? "Traffic Control" : phase === "gate" ? "Gate Align" : phase === "pad" ? "Pad Parking" : "Clamp Status"}</div>
              <h2>{port.name}</h2>
            </div>
            <strong>{port.kind === "station" ? "Gate 03 / Pad C-12" : "Pad A-04"}</strong>
          </div>

          <div className={`elite-docking-alert${isUnstable ? " is-hot" : ""}`}>
            {isUnstable ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
            <span>{isUnstable ? "Correct vector" : phase === "complete" ? "Clamps engaged" : "Link stable"}</span>
          </div>

          {phase === "link" ? (
            <div className="elite-docking-link">
              <div className="elite-docking-ship-card">
                <img src={shipSpriteUrl} alt={ship.name} />
                <div>
                  <span>Hull</span>
                  <strong>{ship.name}</strong>
                </div>
              </div>
              <div className="elite-docking-log">
                {sequenceLines.map((line) => <p key={line}>{line}</p>)}
                {ambientLine ? <p>{ambientLine}</p> : null}
              </div>
              <button type="button" className="elite-docking-primary" onClick={() => setPhase("gate")}>
                <Play size={14} />
                Start Approach
              </button>
            </div>
          ) : null}

          {phase === "gate" ? (
            <div className="elite-docking-stage">
              <div className="elite-docking-gate-frame">
                <div className="elite-docking-gate-target" />
                <svg
                  viewBox="0 0 120 84"
                  aria-label={`${ship.name} rear view`}
                  className="elite-docking-ship-rear"
                  style={{ width: `${REAR_VIEW_WIDTH}px`, transform: rearViewTransform }}
                >
                  <path d="M60 16 L86 25 L102 39 L92 50 L72 58 L48 58 L28 50 L18 39 L34 25 Z" className="rear-hull" />
                  <path d="M60 22 L72 29 L66 41 L54 41 L48 29 Z" className="rear-canopy" />
                  <path d="M60 41 L68 51 L60 58 L52 51 Z" className="rear-spine" />
                  <path d="M18 39 L33 35 L28 50 L12 54 Z" className="rear-wing" />
                  <path d="M102 39 L87 35 L92 50 L108 54 Z" className="rear-wing" />
                  <path d="M38 24 L60 32 L82 24" className="rear-ridge" />
                  <line x1="60" y1="16" x2="60" y2="58" className="rear-base" />
                  <line x1="34" y1="25" x2="18" y2="39" className="rear-frame" />
                  <line x1="86" y1="25" x2="102" y2="39" className="rear-frame" />
                  <line x1="48" y1="29" x2="33" y2="35" className="rear-frame subtle" />
                  <line x1="72" y1="29" x2="87" y2="35" className="rear-frame subtle" />
                  <line x1="54" y1="41" x2="28" y2="50" className="rear-frame subtle" />
                  <line x1="66" y1="41" x2="92" y2="50" className="rear-frame subtle" />
                  <line x1="28" y1="50" x2="12" y2="54" className="rear-frame" />
                  <line x1="92" y1="50" x2="108" y2="54" className="rear-frame" />
                  <line x1="48" y1="58" x2="28" y2="50" className="rear-frame subtle" />
                  <line x1="72" y1="58" x2="92" y2="50" className="rear-frame subtle" />
                </svg>
              </div>
              <div className="elite-docking-progress">
                <span>Capture</span>
                <div><i style={{ width: `${alignment.progress}%` }} /></div>
                <strong>{alignment.progress}%</strong>
              </div>
              <div className="elite-docking-keypad">
                <button type="button" onClick={() => nudgeGate(0, -8)}>W</button>
                <button type="button" onClick={() => nudgeGate(-8, 0)}>A</button>
                <button type="button" onClick={() => nudgeGate(0, 8)}>S</button>
                <button type="button" onClick={() => nudgeGate(8, 0)}>D</button>
              </div>
            </div>
          ) : null}

          {phase === "pad" ? (
            <div className="elite-docking-stage">
              <div className="elite-docking-pad">
                <div className="elite-docking-pad-target" />
                <img
                  src={shipSpriteUrl}
                  alt={ship.name}
                  className="elite-docking-ship-sprite elite-docking-pad-sprite"
                  style={{ width: `${SHIP_SPRITE_WIDTH}px`, transform: `translate(${parking.x}px, ${parking.y}px) rotate(${parking.heading}deg)` }}
                />
              </div>
              <div className="elite-docking-progress">
                <span>Clamp</span>
                <div><i style={{ width: `${parking.progress}%` }} /></div>
                <strong>{parking.progress}%</strong>
              </div>
              <div className="elite-docking-keypad">
                <button type="button" onClick={() => nudgePad(0, -8)}>W</button>
                <button type="button" onClick={() => nudgePad(-8, 0)}>A</button>
                <button type="button" onClick={() => nudgePad(0, 8)}>S</button>
                <button type="button" onClick={() => nudgePad(8, 0)}>D</button>
                <button type="button" onClick={() => nudgePad(0, 0, -6)}><RotateCcw size={12} /> Q</button>
                <button type="button" onClick={() => nudgePad(0, 0, 6)}>E</button>
              </div>
            </div>
          ) : null}

          {phase === "complete" ? (
            <div className="elite-docking-link">
              <div className="elite-docking-ship-card is-complete">
                <img src={shipSpriteUrl} alt={ship.name} />
                <div>
                  <span>Docked</span>
                  <strong>{port.name}</strong>
                </div>
              </div>
              <button type="button" className="elite-docking-primary" onClick={onComplete}>
                Open Dock Terminal
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
};
