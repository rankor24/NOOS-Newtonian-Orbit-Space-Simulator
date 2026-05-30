import React, { useState } from "react";
import {
  Activity,
  Anchor,
  BatteryCharging,
  CircleDot,
  Compass,
  Crosshair,
  Gauge,
  Globe,
  Hammer,
  ListTodo,
  MessageSquare,
  Navigation,
  Power,
  Radio,
  Satellite,
  Settings,
  Shield,
  Ship,
  Zap,
} from "lucide-react";
import { CelestialBody, GameState, MissionLog, StarData } from "../types";
import { OrbitMetrics } from "../utils/physics";
import { formatGameTime } from "../utils/gameData";
import { DEFAULT_POWER_DISTRIBUTION, SIDEWINDER_STARTER_PROFILE } from "../data/ships";
import { AU } from "../data/stars";
import { getDisplayPortDescription, getDisplayPortFaction, getDisplayPortName } from "../utils/worldText";

type CockpitTab = "nav" | "market" | "upgrades" | "contracts";
type MapMode = "galaxy" | "star" | "ship" | "target";
type UiTheme = "amber" | "blue" | "green" | "red";
type AutopilotMode = "none" | "match-speed" | "circularize" | "align-target" | "approach-target";

interface EliteCockpitHudProps {
  gameState: GameState;
  activeStar: StarData;
  selectedBody: CelestialBody | null;
  canDock: boolean;
  dockingDistance: number;
  dockingRelativeSpeed: number;
  targetBearing: number | null;
  domGravityName: string;
  relativeOrbit: OrbitMetrics | null;
  mapView: React.ReactNode;
  mapMode: MapMode;
  setMapMode: (mode: MapMode) => void;
  activePanel: React.ReactNode;
  activeTab: CockpitTab;
  setActiveTab: (tab: CockpitTab) => void;
  uiTheme: UiTheme;
  setUiTheme: (theme: UiTheme) => void;
  autopilotMode: AutopilotMode;
  setAutopilotMode: (mode: AutopilotMode) => void;
  setThrottlePercent: (value: number) => void;
  setPowerDistribution: (channel: "shields" | "engines" | "weapons", value: number) => void;
  setTimeScale: (value: number) => void;
  onSetShipHeading: (heading: number) => void;
  onClearTarget: () => void;
  onDock: () => void;
  onUndock: () => void;
  onToggleMining: () => void;
}

const mapTabs: Array<{ id: MapMode; label: string; icon: React.ElementType }> = [
  { id: "galaxy", label: "GALAXY", icon: Globe },
  { id: "star", label: "STAR", icon: Compass },
  { id: "ship", label: "SHIP", icon: Ship },
  { id: "target", label: "TARGET", icon: Crosshair },
];

const managementTabs: Array<{ id: CockpitTab; label: string; icon: React.ElementType }> = [
  { id: "market", label: "TRADE", icon: Anchor },
  { id: "upgrades", label: "SHIP", icon: Settings },
  { id: "contracts", label: "TASKS", icon: ListTodo },
];

const themeTabs: Array<{ id: UiTheme; label: string }> = [
  { id: "amber", label: "AMB" },
  { id: "blue", label: "CYN" },
  { id: "green", label: "GRN" },
  { id: "red", label: "RED" },
];

function DataRow({ label, value, tone = "" }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="elite-data-row">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function StatusLamp({ label, active }: { label: string; active: boolean }) {
  return (
    <span className={`elite-lamp ${active ? "is-active" : ""}`}>
      <CircleDot size={10} />
      {label}
    </span>
  );
}

function PowerSlider({
  label,
  value,
  icon: Icon,
  onChange,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  onChange: (value: number) => void;
}) {
  return (
    <label className="elite-power-slider">
      <span>
        <Icon size={14} />
        {label}
      </span>
      <input type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <strong>{value}%</strong>
    </label>
  );
}

function latestLogs(logs: MissionLog[]) {
  return logs.slice(0, 6);
}

function HudPanel({
  id,
  title,
  icon: Icon,
  className,
  collapsed,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: React.ElementType;
  className: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className={`elite-panel ${className} ${collapsed ? "is-collapsed" : ""}`} aria-label={title}>
      <button className="elite-panel-title" type="button" onClick={onToggle} aria-expanded={!collapsed} aria-controls={id}>
        <span>
          <Icon size={15} />
          {title}
        </span>
        <strong>{collapsed ? "+" : "-"}</strong>
      </button>
      <div id={id} className="elite-panel-body">
        {children}
      </div>
    </section>
  );
}

export function EliteCockpitHud({
  gameState,
  activeStar,
  selectedBody,
  canDock,
  dockingDistance,
  dockingRelativeSpeed,
  targetBearing,
  domGravityName,
  relativeOrbit,
  mapView,
  mapMode,
  setMapMode,
  activePanel,
  activeTab,
  setActiveTab,
  uiTheme,
  setUiTheme,
  autopilotMode,
  setAutopilotMode,
  setThrottlePercent,
  setPowerDistribution,
  setTimeScale,
  onSetShipHeading,
  onClearTarget,
  onDock,
  onUndock,
  onToggleMining,
}: EliteCockpitHudProps) {
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({});
  const [modalTab, setModalTab] = useState<CockpitTab | null>(null);
  const powerDistribution = gameState.ship.powerDistribution ?? DEFAULT_POWER_DISTRIBUTION;
  const speed = Math.hypot(gameState.ship.vx, gameState.ship.vy);
  const velocityAngle = speed > 1 ? Math.atan2(gameState.ship.vy, gameState.ship.vx) : null;
  const cargoUsed = Object.values(gameState.ship.cargo).reduce((sum, value) => sum + (value || 0), 0);
  const throttle = gameState.ship.throttlePercent;
  const throttleTone = throttle > 0 ? "tone-hot" : throttle < 0 ? "tone-cyan" : "";
  const headingDeg = Math.round((((gameState.ship.heading * 180) / Math.PI) % 360 + 360) % 360);
  const shieldPercent = Math.round((gameState.ship.baseShieldStrength * (0.55 + powerDistribution.shields / 100)) / SIDEWINDER_STARTER_PROFILE.baseShieldStrength * 100);
  const togglePanel = (panel: string) => {
    setCollapsedPanels((prev) => ({ ...prev, [panel]: !prev[panel] }));
  };
  const openManagement = (tab: CockpitTab) => {
    if (!gameState.isDocked) return;
    setActiveTab(tab);
    setModalTab(tab);
  };

  return (
    <div className={`elite-root elite-theme-${uiTheme}`}>
      <div className="elite-map-layer">{mapView}</div>
      <div className="elite-vignette" />

      <HudPanel
        id="elite-comms-panel"
        title="COMMS"
        icon={MessageSquare}
        className="elite-top-left"
        collapsed={!!collapsedPanels.comms}
        onToggle={() => togglePanel("comms")}
      >
        <div className="elite-log-list">
          {latestLogs(gameState.logs).map((log, index) => (
            <div key={`${log.timestamp}-${index}`} className={`elite-log-row log-${log.type}`}>
              <span>{log.timestamp.replace("Yr ", "")}</span>
              <p>{log.text}</p>
            </div>
          ))}
        </div>
      </HudPanel>

      <HudPanel
        id="elite-info-panel"
        title="INFO"
        icon={Radio}
        className="elite-top-right"
        collapsed={!!collapsedPanels.info}
        onToggle={() => togglePanel("info")}
      >
        <DataRow label="System" value={activeStar.name} />
        <DataRow label="Frame" value={domGravityName} />
        <DataRow label="Clock" value={formatGameTime(gameState.gameTime).replace("Yr ", "")} />
        <DataRow label="Credits" value={`${gameState.playerCredits.toLocaleString()} cr`} tone="tone-cyan" />
        <div className="elite-button-strip">
          {[1, 60, 600, 3600, 21600, 86400].map((value) => (
            <button key={value} className={gameState.timeScale === value ? "is-active" : ""} onClick={() => setTimeScale(value)}>
              {value}x
            </button>
          ))}
        </div>
        <div className="elite-button-strip">
          {themeTabs.map((theme) => (
            <button key={theme.id} className={uiTheme === theme.id ? "is-active" : ""} onClick={() => setUiTheme(theme.id)}>
              {theme.label}
            </button>
          ))}
        </div>
      </HudPanel>

      <nav className="elite-top-nav" aria-label="Navigation and modes">
        <div className="elite-mode-title">
          <Compass size={16} />
          NAVI
        </div>
        {mapTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} className={mapMode === tab.id ? "is-active" : ""} onClick={() => setMapMode(tab.id)}>
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <HudPanel
        id="elite-target-panel"
        title="TARGET"
        icon={Crosshair}
        className="elite-bottom-left"
        collapsed={!!collapsedPanels.target}
        onToggle={() => togglePanel("target")}
      >
        {selectedBody ? (
          <>
            <DataRow label="Name" value={selectedBody.name} tone="tone-cyan" />
            <DataRow label="Class" value={selectedBody.type.toUpperCase()} />
            <DataRow label="Market" value={selectedBody.hasMarket ? getDisplayPortName(selectedBody) : "NONE"} />
            {selectedBody.hasMarket && <DataRow label="Faction" value={getDisplayPortFaction(selectedBody)} />}
            {relativeOrbit && (
              <>
                <DataRow label="Altitude" value={`${Math.round(relativeOrbit.altitude / 1000).toLocaleString()} km`} />
                <DataRow label="Rel Speed" value={`${Math.round(relativeOrbit.relSpeed).toLocaleString()} m/s`} />
              </>
            )}
            {selectedBody.hasMarket && !gameState.isDocked && (
              <>
                <DataRow label="Dock Range" value={`${Math.round(dockingDistance / 1000).toLocaleString()} km`} tone={canDock ? "tone-cyan" : ""} />
                <DataRow label="Dock Speed" value={`${Math.round(dockingRelativeSpeed).toLocaleString()} m/s`} tone={canDock ? "tone-cyan" : ""} />
              </>
            )}
            <div className="elite-button-grid">
              <button disabled={!canDock || gameState.isDocked} onClick={onDock}>
                DOCK
              </button>
              <button disabled={!gameState.isDocked} onClick={onUndock}>
                UNDOCK
              </button>
              <button onClick={onToggleMining}>
                <Hammer size={13} />
                {gameState.miningTargetId === selectedBody.id ? "STOP" : "MINE"}
              </button>
            </div>
            {selectedBody.hasMarket && <p className="elite-muted">{getDisplayPortDescription(selectedBody)}</p>}
          </>
        ) : (
          <p className="elite-muted">No target selected on the system map.</p>
        )}
      </HudPanel>

      <HudPanel
        id="elite-player-panel"
        title="PLAYER SHIP"
        icon={Ship}
        className="elite-bottom-right"
        collapsed={!!collapsedPanels.player}
        onToggle={() => togglePanel("player")}
      >
        <DataRow label="Frame" value={gameState.ship.name} tone="tone-cyan" />
        <DataRow label="Make" value={gameState.ship.manufacturer || SIDEWINDER_STARTER_PROFILE.manufacturer} />
        <DataRow label="Speed" value={`${Math.round(speed).toLocaleString()} m/s`} />
        <DataRow label="Cruise / Boost" value={`${gameState.ship.maxCruiseSpeed}/${gameState.ship.maxBoostSpeed} m/s`} />
        <DataRow label="Hull" value={`${gameState.ship.baseArmour} armour`} />
        <DataRow label="Shield" value={`${shieldPercent}%`} />
        <DataRow label="Cargo" value={`${cargoUsed.toFixed(1)} / ${gameState.ship.cargoCapacity} t`} />
        <DataRow label="Fuel" value={`${Math.round(gameState.ship.fuelLevel).toLocaleString()} / ${gameState.ship.maxFuel.toLocaleString()} kg`} />
      </HudPanel>

      <section className="elite-flight-console" aria-label="Flight controls">
        <div className="elite-status-strip">
          <StatusLamp label="FRAMESHIFT ONLINE" active={gameState.ship.warpCapacity} />
          <StatusLamp label="AUTOPILOT" active={autopilotMode !== "none"} />
          <StatusLamp label="MINING" active={gameState.miningTargetId !== null} />
          <StatusLamp label="DOCKED" active={gameState.isDocked} />
        </div>

        <div className="elite-flight-grid">
          <div className="elite-gimbal-panel">
            <div className="elite-gimbal-dial" aria-label="Ship direction gimbal">
              {[0, 90, 180, 270].map((mark) => (
                <span key={mark} className={`mark mark-${mark}`}>{mark === 0 ? "E" : mark === 90 ? "S" : mark === 180 ? "W" : "N"}</span>
              ))}
              {targetBearing !== null && (
                <i className="target-vector" style={{ transform: `rotate(${targetBearing}rad)` }} />
              )}
              {velocityAngle !== null && (
                <i className="velocity-vector" style={{ transform: `rotate(${velocityAngle}rad)` }} />
              )}
              <i className="heading-vector" style={{ transform: `rotate(${gameState.ship.heading}rad)` }} />
              <b />
            </div>
            <div className="elite-gimbal-readout">
              <span>HDG {headingDeg}°</span>
              {targetBearing !== null ? (
                <span className="gimbal-tgt-val">TGT {Math.round((((targetBearing * 180) / Math.PI) % 360 + 360) % 360)}°</span>
              ) : (
                <span className="elite-muted">TGT ---°</span>
              )}
            </div>
          </div>

          <div className="elite-power-stack">
            <div className="elite-power-grid">
              <PowerSlider label="SYS" icon={Shield} value={powerDistribution.shields} onChange={(value) => setPowerDistribution("shields", value)} />
              <PowerSlider label="ENG" icon={Zap} value={powerDistribution.engines} onChange={(value) => setPowerDistribution("engines", value)} />
              <PowerSlider label="WEP" icon={Satellite} value={powerDistribution.weapons} onChange={(value) => setPowerDistribution("weapons", value)} />
            </div>
            <span className="elite-vector-key">
              <i className="key-heading" /> heading
              <i className="key-velocity" /> velocity
              <i className="key-target" /> target
            </span>
          </div>

          <div className="elite-control-stack">
            <div className="elite-throttle-block">
              <div className="elite-throttle-readout">
                <span>
                  <Gauge size={16} />
                  THRUST
                </span>
                <strong className={throttleTone}>{throttle > 0 ? `+${throttle}` : throttle}%</strong>
              </div>
              <div className="elite-throttle-row">
                <button type="button" onClick={() => setThrottlePercent(throttle - 10)}>-10</button>
                <input
                  aria-label="Throttle percent"
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={throttle}
                  onChange={(event) => setThrottlePercent(Number(event.target.value))}
                />
                <button type="button" onClick={() => setThrottlePercent(throttle + 10)}>+10</button>
                <button type="button" className="btn-zero" onClick={() => setThrottlePercent(0)}>
                  <Power size={14} />
                  ZERO
                </button>
              </div>
            </div>

            <div className="elite-heading-slider-block">
              <div className="elite-heading-readout">
                <span>
                  <Navigation size={15} />
                  ROTATION
                </span>
                <strong className="tone-hot">{headingDeg}°</strong>
              </div>
              <div className="elite-heading-row">
                <button type="button" onClick={() => onSetShipHeading(((headingDeg - 5 + 360) % 360) * Math.PI / 180)}>-5°</button>
                <input
                  aria-label="Ship heading degrees"
                  type="range"
                  min="0"
                  max="359"
                  step="1"
                  value={headingDeg}
                  onChange={(event) => onSetShipHeading((Number(event.target.value) * Math.PI) / 180)}
                />
                <button type="button" onClick={() => onSetShipHeading(((headingDeg + 5) % 360) * Math.PI / 180)}>+5°</button>
                <button
                  type="button"
                  className="btn-align"
                  onClick={() => {
                    if (targetBearing !== null) {
                      onSetShipHeading(targetBearing);
                    } else if (velocityAngle !== null) {
                      onSetShipHeading(velocityAngle);
                    } else {
                      onSetShipHeading(0);
                    }
                  }}
                >
                  ALIGN
                </button>
              </div>
            </div>

            <div className="elite-flight-buttons">
              <div className="elite-autopilot-grid">
                <button
                  type="button"
                  disabled={!selectedBody}
                  className={autopilotMode === "align-target" ? "is-active" : ""}
                  onClick={() => setAutopilotMode(autopilotMode === "align-target" ? "none" : "align-target")}
                  title="Lock heading to target bearing"
                >
                  ALIGN
                </button>
                <button
                  type="button"
                  disabled={!selectedBody}
                  className={autopilotMode === "approach-target" ? "is-active" : ""}
                  onClick={() => setAutopilotMode(autopilotMode === "approach-target" ? "none" : "approach-target")}
                  title="Approach target safely with retro-braking assist"
                >
                  APPR
                </button>
                <button
                  type="button"
                  disabled={!selectedBody}
                  className={autopilotMode === "match-speed" ? "is-active" : ""}
                  onClick={() => setAutopilotMode(autopilotMode === "match-speed" ? "none" : "match-speed")}
                  title="Match velocity with target body"
                >
                  MATCH
                </button>
                <button
                  type="button"
                  disabled={!selectedBody}
                  className={autopilotMode === "circularize" ? "is-active" : ""}
                  onClick={() => setAutopilotMode(autopilotMode === "circularize" ? "none" : "circularize")}
                  title="Circularize orbit around current body"
                >
                  CIRC
                </button>
              </div>
              <div className="elite-battery-row">
                <BatteryCharging size={14} />
                <span className="battery-label">CAPACITOR</span>
                <div className="elite-battery-bar">
                  <div className="elite-battery-fill" style={{ width: `${(gameState.ship.battery / gameState.ship.maxBattery) * 100}%` }} />
                </div>
                <strong className="battery-value">{gameState.ship.battery.toFixed(1)} / {gameState.ship.maxBattery.toFixed(1)} MJ</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <nav className="elite-management-dock" aria-label="Management screens">
        <button
          type="button"
          className={selectedBody ? "is-target-locked" : ""}
          disabled={!selectedBody}
          title={selectedBody ? `Clear target lock: ${selectedBody.name}` : "No target locked"}
          onClick={onClearTarget}
        >
          <Crosshair size={15} />
          {selectedBody ? "CLEAR" : "NO TGT"}
        </button>
        {managementTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              disabled={!gameState.isDocked}
              title={gameState.isDocked ? `${tab.label} services` : "Dock at a station to access services"}
              onClick={() => openManagement(tab.id)}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {modalTab && (
        <div className="elite-modal-backdrop" role="dialog" aria-modal="true" aria-label={`${managementTabs.find((tab) => tab.id === modalTab)?.label} screen`}>
          <section className="elite-fullscreen-modal">
            <div className="elite-modal-header">
              <span>
                <Activity size={15} />
                {managementTabs.find((tab) => tab.id === modalTab)?.label} PANEL
              </span>
              <button type="button" onClick={() => setModalTab(null)}>
                CLOSE
              </button>
            </div>
            <div className="elite-modal-body">{activePanel}</div>
          </section>
        </div>
      )}

      <div className="elite-scale-readout">
        1 AU = {AU.toExponential(3)} m | Coriolis starter frame: {SIDEWINDER_STARTER_PROFILE.sourceShip}
      </div>
    </div>
  );
}
