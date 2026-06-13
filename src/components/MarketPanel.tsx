/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { GameState, CelestialBody } from "../types";
import { RESOURCE_TYPES } from "../utils/gameData";
import { getDisplayPortDescription, getDisplayPortFaction, getDisplayPortName, getDisplayPortServices, getPortsForBody } from "../utils/worldText";
import { getAbsoluteBodyPosition, getBodyVelocity, getDockingSpecs } from "../utils/physics";
import { ShoppingCart, Coins, ShieldAlert, Inbox, HardDrive, Flame, Anchor } from "lucide-react";

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

  // Selected object metrics
  const selectedBody = bodies.find((b) => b.id === selectedBodyId) || null;
  const dockedBody = bodies.find((b) => b.id === dockedBodyId) || null;
  const activeBody = isDocked ? dockedBody || selectedBody : selectedBody;
  const selectablePorts = activeBody ? getPortsForBody(activeBody) : [];
  const activePortId = isDocked ? dockedPortId : selectablePorts[0]?.id;
  const activePort = selectablePorts.find((port) => port.id === activePortId) || selectablePorts[0] || null;
  const isSelectedAsteroid = selectedBody?.type === "asteroid";

  // Calculate cargo statistics
  let currentCargoWeight = 0;
  Object.keys(ship.cargo).forEach((key) => {
    currentCargoWeight += ship.cargo[key] || 0;
  });

  const cargoLeft = (ship.cargoCapacityTons ?? ship.cargoCapacity) - currentCargoWeight;

  // Compute current relative distance to selected body
  let distanceToBodyValue = Infinity;
  let relativeSpeedValue = Infinity;

  if (selectedBody) {
    // Distance
    const bodyPosRef = getAbsoluteBodyPosition(selectedBody.id, bodies, gameTime);
    const dx = ship.x - bodyPosRef.x;
    const dy = ship.y - bodyPosRef.y;
    distanceToBodyValue = Math.hypot(dx, dy);

    // Speed Relative to selected orbit
    const targetVelocity = getBodyVelocity(selectedBody.id, bodies, gameTime);
    relativeSpeedValue = Math.hypot(ship.vx - targetVelocity.vx, ship.vy - targetVelocity.vy);
  }

  const dockingSpecs = getDockingSpecs(selectedBody);
  const dockingAltitudeKm = selectedBody ? Math.round(Math.max(0, distanceToBodyValue - (selectedBody.radius ?? 0)) / 1000) : Infinity;
  const dockingMaxAltitudeKm = selectedBody ? Math.round(Math.max(0, dockingSpecs.maxDistance - (selectedBody.radius ?? 0)) / 1000) : 0;

  // Check docking requirements against the same approach envelope used by App.tsx.
  const canDock = selectedBody &&
                  selectedBody.hasMarket &&
                  distanceToBodyValue < dockingSpecs.maxDistance &&
                  relativeSpeedValue < dockingSpecs.maxSpeed;

  // Mines can activate if within 500 km of asteroids or unpopulated moons
  const canMine = selectedBody &&
                  (isSelectedAsteroid || selectedBody.type === "moon") &&
                  !selectedBody.hasMarket &&
                  distanceToBodyValue < 5e5; // 500km

  const localMarket = activePort ? markets[activePort.id] : null;
  const fuelMarket = localMarket?.fuel;
  const missingFuelKg = Math.max(0, ship.maxFuel - ship.fuelLevel);
  const refuelNeedTons = Math.ceil(missingFuelKg / 1000);
  const refuelPricePerTon = fuelMarket?.buyPrice ?? 0;
  const refuelStockTons = fuelMarket?.available ?? 0;
  const canRefuel = missingFuelKg > 0 && refuelStockTons >= refuelNeedTons;
  const surveyDataValue = Object.values(gameState.surveyDataByBody).reduce<number>((sum, value) => sum + Number(value || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
      
      {/* 1. Transaction Console (Dynamic based on Docking state) */}
      <div className="lg:col-span-2 bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-md flex flex-col justify-between">
        
        {/* If Docked, render complete trade menu */}
        {isDocked && localMarket && activeBody ? (
          <div>
            <div className="flex justify-between items-center border-b border-stone-800 pb-3.5 mb-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="text-purple-400 w-5 h-5 animate-pulse" />
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
                    {activePort?.name || getDisplayPortName(activeBody)}
                  </h3>
                  <p className="text-[10px] text-stone-500 font-mono">{(activePort?.faction || getDisplayPortFaction(activeBody)).toUpperCase()} • {(activePort?.services || getDisplayPortServices(activeBody)).join(" / ").toUpperCase()}</p>
                </div>
              </div>
              <button
                id="station-undock-btn"
                onClick={onUndock}
                className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-900 px-3 py-1 text-xs rounded transition flex items-center gap-1.5 font-bold cursor-pointer"
              >
                <Anchor className="w-3.5 h-3.5 rotate-180" /> UNDOCK SHIP
              </button>
            </div>

            <p className="text-xs text-stone-400 mb-4 italic">{activePort?.description || getDisplayPortDescription(activeBody)}</p>

            <div className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-[11px] font-mono">
              <div className="bg-stone-950 border border-stone-800 rounded-lg p-2.5 text-stone-400">Cargo Free<br /><span className="text-slate-200 font-bold">{cargoLeft} t</span></div>
              <div className="bg-stone-950 border border-stone-800 rounded-lg p-2.5 text-stone-400">Passenger Berths<br /><span className="text-slate-200 font-bold">{ship.passengerCount}/{ship.passengerCapacity}</span></div>
              <div className="bg-stone-950 border border-stone-800 rounded-lg p-2.5 text-stone-400">Fuel Tank<br /><span className="text-slate-200 font-bold">{Math.round(ship.fuelLevel).toLocaleString()} / {Math.round(ship.maxFuel).toLocaleString()} kg</span></div>
              <button
                onClick={onRefuel}
                disabled={!canRefuel}
                className={`rounded-lg p-2.5 text-xs font-bold ${canRefuel ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-stone-800 text-stone-500 cursor-not-allowed"}`}
                title={fuelMarket ? `${refuelPricePerTon}¢/t • ${refuelStockTons}t stock` : "Fuel market offline"}
              >
                REFUEL SHIP
                <br />
                <span className="text-[10px] font-mono opacity-80">{fuelMarket ? `${refuelPricePerTon}¢/t • ${refuelStockTons}t stock` : "MARKET OFFLINE"}</span>
              </button>
              <button
                onClick={onSellSurveyData}
                disabled={surveyDataValue <= 0}
                className={`rounded-lg p-2.5 text-xs font-bold ${surveyDataValue > 0 ? "bg-sky-600 hover:bg-sky-500 text-white" : "bg-stone-800 text-stone-500 cursor-not-allowed"}`}
                title={surveyDataValue > 0 ? `Sell ${surveyDataValue.toLocaleString()}¢ worth of survey telemetry` : "No survey telemetry ready for sale"}
              >
                SELL SURVEY DATA
                <br />
                <span className="text-[10px] font-mono opacity-80">{surveyDataValue.toLocaleString()}¢ queued</span>
              </button>
            </div>

            {selectablePorts.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {selectablePorts.map((port) => {
                  const selected = port.id === activePort?.id;
                  return (
                    <button
                      key={port.id}
                      onClick={() => onSelectPort(port.id)}
                      className={`px-2.5 py-1 rounded border text-[10px] font-mono uppercase tracking-wider transition ${selected ? "bg-sky-500/20 border-sky-500 text-sky-300" : "bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-600 hover:text-stone-200"}`}
                    >
                      {port.name}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Commodities Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs font-mono">
                <thead>
                  <tr className="border-b border-stone-800 text-stone-500">
                    <th className="py-2.5">Commodity</th>
                    <th className="py-2.5 text-right">Price (Buy / Sell)</th>
                    <th className="py-2.5 text-right">Market Supply</th>
                    <th className="py-2.5 text-right">Cargo Hold</th>
                    <th className="py-2.5 text-center">Trade Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/40">
                  {RESOURCE_TYPES.map((res) => {
                    const marketRes = localMarket[res.id] || { buyPrice: 0, sellPrice: 0, available: 0 };
                    const shipCount = ship.cargo[res.id] || 0;

                    const meetsPrice = playerCredits >= marketRes.buyPrice;
                    const canBuyRes = meetsPrice && cargoLeft >= 1 && marketRes.available > 0;
                    const canSellRes = shipCount >= 1;

                    return (
                      <tr id={`commodity-row-${res.id}`} key={res.id} className="hover:bg-stone-950/20 transition-colors">
                        <td className="py-3">
                          <p className="font-semibold text-slate-200 text-sm font-sans">{res.name}</p>
                          <p className="text-[10px] text-stone-500 font-sans mt-0.5">{res.desc}</p>
                        </td>
                        <td className="py-3 text-right">
                          <span className="text-amber-400 font-semibold">{marketRes.buyPrice}¢</span>
                          <span className="text-stone-500 mx-1">/</span>
                          <span className="text-emerald-500">{marketRes.sellPrice}¢</span>
                        </td>
                        <td className="py-3 text-right text-stone-400">
                          {marketRes.available} t
                        </td>
                        <td className="py-3 text-right text-sky-400 font-bold">
                          {shipCount} t
                        </td>
                        <td className="py-3 text-center">
                          <div className="flex justify-center gap-1.5">
                            <button
                              id={`buy-1t-${res.id}`}
                              disabled={!canBuyRes}
                              onClick={() => onBuy(res.id, 1)}
                              className={`px-2 py-1 rounded font-bold text-[10px] transition ${
                                canBuyRes
                                  ? "bg-amber-500 text-stone-950 hover:bg-amber-400"
                                  : "bg-stone-800 text-stone-600 cursor-not-allowed"
                              }`}
                            >
                              BUY 1t
                            </button>
                            <button
                              id={`sell-1t-${res.id}`}
                              disabled={!canSellRes}
                              onClick={() => onSell(res.id, 1)}
                              className={`px-2 py-1 rounded font-bold text-[10px] transition ${
                                canSellRes
                                  ? "bg-emerald-600 text-white hover:bg-emerald-500"
                                  : "bg-stone-800 text-stone-600 cursor-not-allowed"
                              }`}
                            >
                              SELL 1t
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
        ) : (
          /* General Proximity Docking / Mining controls when NOT Docked */
          <div className="flex flex-col justify-center items-center h-full py-8 text-center">
            
            {selectedBody ? (
              <div className="space-y-6 max-w-md">
                <div className="w-16 h-16 rounded-full bg-stone-950 border-2 border-dashed border-stone-800 flex items-center justify-center mx-auto text-stone-500">
                  <Anchor className="w-8 h-8 animate-pulse text-sky-400" />
                </div>
                
                <div>
                  <h4 className="text-lg font-bold text-slate-100 uppercase tracking-wide">
                    {selectedBody.name} Proximity Link
                  </h4>
                  <p className="text-xs text-stone-400 mt-1 italic">
                    {selectedBody.description}
                  </p>
                </div>

                {/* Relative distance HUD */}
                <div className="grid grid-cols-2 gap-3 bg-stone-950 border border-stone-800/80 p-3.5 rounded-xl font-mono text-xs">
                  <div className="text-left border-r border-stone-800/50 pr-2">
                    <span className="text-stone-500 block text-[10px] uppercase">R-Distance</span>
                    <span className="text-slate-300 text-sm font-bold">
                      {(distanceToBodyValue / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} km
                    </span>
                  </div>
                  <div className="text-left pl-2">
                    <span className="text-stone-500 block text-[10px] uppercase">R-Velocity</span>
                    <span className={`text-sm font-bold ${relativeSpeedValue < dockingSpecs.maxSpeed ? "text-emerald-400" : "text-amber-500"}`}>
                      {Math.round(relativeSpeedValue).toLocaleString()} m/s
                    </span>
                  </div>
                </div>

                {/* Docking button conditions */}
                {selectedBody.hasMarket ? (
                  <div className="space-y-4">
                    {canDock ? (
                      <button
                        id="ship-dock-btn"
                        onClick={onDock}
                        className="w-full bg-sky-500 hover:bg-sky-400 text-stone-950 py-3 rounded-lg font-bold text-xs flex justify-center items-center gap-2 transition active:scale-95 shadow-md shadow-sky-500/10 cursor-pointer"
                      >
                        <Anchor className="w-4 h-4" /> SECURE SPACEPORT DOCKING
                      </button>
                    ) : (
                      <div className="bg-amber-950/20 border border-amber-900/50 text-amber-300 p-3.5 rounded-lg text-xs space-y-1.5 text-left">
                        <div className="font-bold flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-amber-400" /> Docking Criteria Not Met
                        </div>
                        <ul className="list-disc list-inside text-stone-400 text-[11px] space-y-1">
                          <li>Must be inside docking bubble (under {dockingMaxAltitudeKm.toLocaleString()} km altitude)</li>
                          <li>Must slow relative speed below {dockingSpecs.maxSpeed.toLocaleString()} m/s</li>
                        </ul>
                        <p className="text-[10px] text-stone-500 pt-1 font-sans italic">Current: {Number.isFinite(dockingAltitudeKm) ? dockingAltitudeKm.toLocaleString() : "---"} km, {Number.isFinite(relativeSpeedValue) ? Math.round(relativeSpeedValue).toLocaleString() : "---"} m/s.</p>
                      </div>
                    )}
                  </div>
                ) : isSelectedAsteroid || selectedBody.type === "moon" ? (
                  /* Mining buttons */
                  <div className="space-y-4">
                    {canMine ? (
                      <button
                        id="asteroid-mine-toggle-btn"
                        onClick={onToggleMining}
                        className={`w-full py-3 rounded-lg font-bold text-xs flex justify-center items-center gap-2 transition active:scale-95 cursor-pointer ${
                          gameState.miningTargetId === selectedBody.id
                            ? "bg-purple-600 hover:bg-purple-500 text-white animate-pulse"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white"
                        }`}
                      >
                        <Flame className="w-4 h-4 animate-bounce" />
                        {gameState.miningTargetId === selectedBody.id
                          ? "DISENGAGE MINING DRILLS"
                          : "ENGAGE MINING LASER CORE"}
                      </button>
                    ) : (
                      <div className="bg-amber-950/20 border border-amber-900/50 text-amber-300 p-3.5 rounded-lg text-xs space-y-1.5 text-left">
                        <div className="font-bold flex items-center gap-1.5 animate-pulse">
                          <Flame className="w-4 h-4 text-purple-400" /> Asteroid Mining Bounds
                        </div>
                        <p className="text-stone-400 text-[11px]">
                          Match speed vectors and fly closer to the celestial body (within 500 km) to focus and activate mining thermal drills.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-stone-950 border border-stone-800 p-3 rounded-lg text-xs text-stone-500">
                    This Keplerian body has no trading ports or constructible resource nodes. Select a colony planet with station arrays to trade.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 max-w-xs">
                <Inbox className="w-12 h-12 text-stone-700 mx-auto" />
                <div>
                  <h4 className="font-bold text-slate-300 uppercase text-sm tracking-wider">No Target Selected</h4>
                  <p className="text-stone-500 text-xs mt-1">
                    Select any star system body on your interactive canvas cockpit to compute orbit parameters, docks, or coordinate mining drills.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Ship Inventory Deck and Load Stats */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-md flex flex-col justify-between">
        <div className="space-y-4">
          <div className="border-b border-stone-800 pb-2.5">
            <h4 className="text-xs text-stone-500 font-mono font-bold uppercase tracking-wider mb-0.5">Ship Logistical Status</h4>
            <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-1.5">
              <HardDrive className="text-sky-400 w-4 h-4" /> Cargo Inventory
            </h3>
          </div>

          {/* Credits */}
          <div className="flex justify-between items-center bg-stone-950 border border-stone-800/80 rounded-lg p-3">
            <span className="text-xs text-stone-400 uppercase tracking-wider">AVAILABLE CRYPTO UNITS :</span>
            <span className="text-base font-bold font-mono text-amber-400 flex items-center gap-1">
              <Coins className="w-4 h-4" /> {playerCredits.toLocaleString()}¢
            </span>
          </div>

          {/* Cargo Mass capacity visual block */}
          <div className="space-y-1 bg-stone-950 border border-stone-800/80 p-3 rounded-lg">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-stone-500">CARGO WEIGHT LIMIT</span>
              <span className="text-slate-200 font-bold">{currentCargoWeight} / {ship.cargoCapacity} Tons</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-stone-800 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  currentCargoWeight >= ship.cargoCapacity
                    ? "bg-rose-500"
                    : currentCargoWeight > ship.cargoCapacity * 0.8
                    ? "bg-amber-500"
                    : "bg-sky-400"
                }`}
                style={{ width: `${Math.min(100, (currentCargoWeight / ship.cargoCapacity) * 100)}%` }}
              />
            </div>
          </div>

          {/* Inventory Breakdown list */}
          <div className="space-y-2 font-mono text-xs">
            {RESOURCE_TYPES.map((res) => {
              const count = ship.cargo[res.id] || 0;
              return (
                <div key={res.id} className="flex justify-between items-center bg-stone-950/40 p-2.5 rounded border border-stone-800/40">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#cbd5e1" }} />
                    <span className="text-stone-300 text-[11px] font-sans font-semibold">{res.name}</span>
                  </div>
                  <span className={`font-bold ${count > 0 ? "text-sky-400" : "text-stone-600"}`}>
                    {count} t
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-stone-800/60 text-[10px] text-stone-500 italic text-center">
          Trade fuels and ore to expand your engineering portfolio.
        </div>
      </div>

    </div>
  );
};

