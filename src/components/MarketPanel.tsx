/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Anchor, Flame, HardDrive, ShoppingCart } from "lucide-react";
import { GameState, CelestialBody } from "../types";
import { RESOURCE_TYPES } from "../utils/gameData";
import { getDisplayPortDescription, getDisplayPortFaction, getDisplayPortName, getDisplayPortServices, getPortsForBody } from "../utils/worldText";
import { getAbsoluteBodyPosition, getBodyVelocity, getDockingSpecs } from "../utils/physics";

interface MarketPanelProps {
  gameState: GameState;
  onBuy: (resourceId: string, amount: number) => void;
  onSell: (resourceId: string, amount: number) => void;
  onDock: () => void;
  onUndock: () => void;
  onRefuel: () => void;
  onSellSurveyData: () => void;
  onToggleMining: () => void;
  onSelectPort: (portId: string) => void;
  bodies: CelestialBody[];
}

const formatDistanceKm = (meters: number) =>
  `${(meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })} km`;

export const MarketPanel: React.FC<MarketPanelProps> = ({
  gameState,
  onBuy,
  onSell,
  onDock,
  onUndock,
  onRefuel,
  onSellSurveyData,
  onToggleMining,
  onSelectPort,
  bodies,
}) => {
  const { ship, markets, isDocked, selectedBodyId, dockedBodyId, dockedPortId, playerCredits, gameTime } = gameState;

  const selectedBody = bodies.find((b) => b.id === selectedBodyId) || null;
  const dockedBody = bodies.find((b) => b.id === dockedBodyId) || null;
  const activeBody = isDocked ? dockedBody || selectedBody : selectedBody;
  const selectablePorts = activeBody ? getPortsForBody(activeBody) : [];
  const activePortId = isDocked ? dockedPortId : selectablePorts[0]?.id;
  const activePort = selectablePorts.find((port) => port.id === activePortId) || selectablePorts[0] || null;
  const isSelectedAsteroid = selectedBody?.type === "asteroid";

  const cargoUsed = Object.keys(ship.cargo).reduce((total, key) => total + (ship.cargo[key] || 0), 0);
  const cargoCapacity = ship.cargoCapacityTons ?? ship.cargoCapacity;
  const cargoLeft = cargoCapacity - cargoUsed;

  let distanceToBodyValue = Infinity;
  let relativeSpeedValue = Infinity;

  if (selectedBody) {
    const bodyPosRef = getAbsoluteBodyPosition(selectedBody.id, bodies, gameTime);
    const dx = ship.x - bodyPosRef.x;
    const dy = ship.y - bodyPosRef.y;
    distanceToBodyValue = Math.hypot(dx, dy);

    const targetVelocity = getBodyVelocity(selectedBody.id, bodies, gameTime);
    relativeSpeedValue = Math.hypot(ship.vx - targetVelocity.vx, ship.vy - targetVelocity.vy);
  }

  const dockingSpecs = getDockingSpecs(selectedBody);
  const dockingAltitudeKm = selectedBody ? Math.round(Math.max(0, distanceToBodyValue - (selectedBody.radius ?? 0)) / 1000) : Infinity;
  const dockingMaxAltitudeKm = selectedBody ? Math.round(Math.max(0, dockingSpecs.maxDistance - (selectedBody.radius ?? 0)) / 1000) : 0;
  const canDock = !!(
    selectedBody
    && selectedBody.hasMarket
    && distanceToBodyValue < dockingSpecs.maxDistance
    && relativeSpeedValue < dockingSpecs.maxSpeed
  );
  const canMine = !!(
    selectedBody
    && (isSelectedAsteroid || selectedBody.type === "moon")
    && !selectedBody.hasMarket
    && distanceToBodyValue < 5e5
  );

  const localMarket = activePort ? markets[activePort.id] : null;
  const fuelMarket = localMarket?.fuel;
  const missingFuelKg = Math.max(0, ship.maxFuel - ship.fuelLevel);
  const refuelNeedTons = Math.ceil(missingFuelKg / 1000);
  const refuelPricePerTon = fuelMarket?.buyPrice ?? 0;
  const refuelStockTons = fuelMarket?.available ?? 0;
  const canRefuel = missingFuelKg > 0 && refuelStockTons >= refuelNeedTons;
  const surveyDataValue = Object.values(gameState.surveyDataByBody).reduce<number>((sum, value) => sum + Number(value || 0), 0);

  if (!isDocked || !localMarket || !activeBody) {
    return (
      <section className="elite-terminal-screen">
        <header className="elite-terminal-header">
          <div>
            <span className="elite-terminal-kicker">Dock / Field Link</span>
            <h3 className="elite-terminal-title">Approach Services</h3>
          </div>
          <div className="elite-terminal-actions">
            {selectedBody?.hasMarket && canDock ? (
              <button type="button" className="elite-terminal-button is-primary" onClick={onDock}>
                <Anchor size={14} />
                Request Dock
              </button>
            ) : null}
            {canMine ? (
              <button type="button" className="elite-terminal-button is-primary" onClick={onToggleMining}>
                <Flame size={14} />
                {gameState.miningTargetId === selectedBody?.id ? "Disengage Mining" : "Engage Mining"}
              </button>
            ) : null}
          </div>
        </header>

        <div className="elite-terminal-section">
          <div className="elite-terminal-section-bar">
            <span>Selected Body</span>
            <strong>{selectedBody?.stationName || selectedBody?.name || "No target lock"}</strong>
          </div>
          <div className="elite-terminal-grid elite-terminal-grid-4">
            <div className="elite-terminal-stat">
              <span>Range</span>
              <strong>{Number.isFinite(distanceToBodyValue) ? formatDistanceKm(distanceToBodyValue) : "--"}</strong>
            </div>
            <div className="elite-terminal-stat">
              <span>Relative Speed</span>
              <strong>{Number.isFinite(relativeSpeedValue) ? `${Math.round(relativeSpeedValue).toLocaleString()} m/s` : "--"}</strong>
            </div>
            <div className="elite-terminal-stat">
              <span>Dock Altitude</span>
              <strong>{Number.isFinite(dockingAltitudeKm) ? `${dockingAltitudeKm.toLocaleString()} km` : "--"}</strong>
            </div>
            <div className="elite-terminal-stat">
              <span>Dock Limit</span>
              <strong>{selectedBody?.hasMarket ? `${dockingMaxAltitudeKm.toLocaleString()} km / ${dockingSpecs.maxSpeed.toLocaleString()} m/s` : "No dock"}</strong>
            </div>
          </div>
          <div className="elite-terminal-note">
            {selectedBody?.hasMarket
              ? canDock
                ? "Clearance envelope satisfied. Docking request is available."
                : `Reduce approach to below ${dockingSpecs.maxSpeed.toLocaleString()} m/s and enter the ${dockingMaxAltitudeKm.toLocaleString()} km control shell.`
              : canMine
                ? "Extraction envelope locked. Mining tools are available."
                : "No commercial services at current range."}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="elite-terminal-screen">
      <header className="elite-terminal-header">
        <div>
          <span className="elite-terminal-kicker">Market Exchange</span>
          <h3 className="elite-terminal-title">{activePort?.name || getDisplayPortName(activeBody)}</h3>
          <p className="elite-terminal-copy">
            {(activePort?.faction || getDisplayPortFaction(activeBody)).toUpperCase()} / {(activePort?.services || getDisplayPortServices(activeBody)).join(" / ").toUpperCase()}
          </p>
        </div>
        <div className="elite-terminal-actions">
          <button type="button" className="elite-terminal-button" onClick={onSellSurveyData} disabled={surveyDataValue <= 0}>
            <HardDrive size={14} />
            Sell Survey Data
          </button>
          <button type="button" className="elite-terminal-button is-primary" onClick={onRefuel} disabled={!canRefuel}>
            <Flame size={14} />
            Refuel
          </button>
          <button type="button" className="elite-terminal-button is-danger" onClick={onUndock}>
            <Anchor size={14} />
            Release Clamps
          </button>
        </div>
      </header>

      <div className="elite-terminal-grid elite-terminal-grid-5">
        <div className="elite-terminal-stat">
          <span>Credits</span>
          <strong>{playerCredits.toLocaleString()} cr</strong>
        </div>
        <div className="elite-terminal-stat">
          <span>Cargo Free</span>
          <strong>{cargoLeft.toFixed(1)} t</strong>
        </div>
        <div className="elite-terminal-stat">
          <span>Fuel Reserve</span>
          <strong>{Math.round(ship.fuelLevel).toLocaleString()} / {Math.round(ship.maxFuel).toLocaleString()} kg</strong>
        </div>
        <div className="elite-terminal-stat">
          <span>Passenger Berths</span>
          <strong>{ship.passengerCount} / {ship.passengerCapacity}</strong>
        </div>
        <div className="elite-terminal-stat">
          <span>Telemetry Queue</span>
          <strong>{surveyDataValue.toLocaleString()} cr</strong>
        </div>
      </div>

      {selectablePorts.length > 1 ? (
        <div className="elite-terminal-tabs" role="tablist" aria-label="Port terminals">
          {selectablePorts.map((port) => {
            const selected = port.id === activePort?.id;
            return (
              <button
                key={port.id}
                type="button"
                onClick={() => onSelectPort(port.id)}
                className={`elite-terminal-tab${selected ? " is-active" : ""}`}
              >
                {port.name}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="elite-terminal-section">
        <div className="elite-terminal-section-bar">
          <span>Port Brief</span>
          <strong>{activeBody.stationName || activeBody.name}</strong>
        </div>
        <div className="elite-terminal-note">
          {activePort?.description || getDisplayPortDescription(activeBody)}
          {fuelMarket ? ` Fuel ${refuelPricePerTon} cr/t. Stock ${refuelStockTons} t.` : " Fuel market offline."}
        </div>
      </div>

      <div className="elite-terminal-section">
        <div className="elite-terminal-section-bar">
          <span>Commodity Ledger</span>
          <strong>{RESOURCE_TYPES.length} Listed Lines</strong>
        </div>
        <div className="elite-terminal-table-wrap">
          <table className="elite-terminal-table">
            <thead>
              <tr>
                <th>Commodity</th>
                <th>Description</th>
                <th className="is-number">Buy</th>
                <th className="is-number">Sell</th>
                <th className="is-number">Supply</th>
                <th className="is-number">Hold</th>
                <th className="is-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {RESOURCE_TYPES.map((res) => {
                const marketRes = localMarket[res.id] || { buyPrice: 0, sellPrice: 0, available: 0 };
                const shipCount = ship.cargo[res.id] || 0;
                const canBuyRes = playerCredits >= marketRes.buyPrice && cargoLeft >= 1 && marketRes.available > 0;
                const canSellRes = shipCount >= 1;

                return (
                  <tr key={res.id}>
                    <td className="is-strong">{res.name}</td>
                    <td>{res.desc}</td>
                    <td className="is-number elite-value-amber">{marketRes.buyPrice} cr</td>
                    <td className="is-number elite-value-cyan">{marketRes.sellPrice} cr</td>
                    <td className="is-number">{marketRes.available} t</td>
                    <td className="is-number">{shipCount} t</td>
                    <td className="is-actions">
                      <div className="elite-terminal-action-row">
                        <button type="button" className="elite-terminal-button" disabled={!canBuyRes} onClick={() => onBuy(res.id, 1)}>
                          Buy 1t
                        </button>
                        <button type="button" className="elite-terminal-button" disabled={!canSellRes} onClick={() => onSell(res.id, 1)}>
                          Sell 1t
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
