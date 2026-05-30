/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { GameState, SpaceContract, CelestialBody } from "../types";
import { ListTodo, CheckCircle2, CircleDollarSign, Compass, AlertCircle, ArrowUpRight } from "lucide-react";

interface ContractsPanelProps {
  gameState: GameState;
  bodies: CelestialBody[];
  onAcceptContract: (contractId: string) => void;
  onCompleteContract: (contractId: string) => void;
}

export const ContractsPanel: React.FC<ContractsPanelProps> = ({
  gameState,
  bodies,
  onAcceptContract,
  onCompleteContract,
}) => {
  const { contracts, isDocked, dockedBodyId, dockedPortId, ship, gameTime } = gameState;

  return (
    <div className="space-y-6 font-sans">
      
      {/* Panel Header */}
      <div className="border-b border-stone-800 pb-3">
        <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest flex items-center gap-2">
          <ListTodo className="text-sky-500 w-5 h-5" /> EXPEDITIONS & SYSTEM OPERATIONS
        </h3>
        <p className="text-xs text-stone-500 mt-0.5">Underwrite supply-chain logistics or scientific probe releases for local space factions.</p>
      </div>

      {/* Contracts Stack */}
      <div className="space-y-4">
        {contracts.map((contract) => {
          const originBody = bodies.find((b) => b.id === contract.originId);
          const destBody = bodies.find((b) => b.id === contract.destinationId);
          const originLabel = contract.issuerName || originBody?.stationName || originBody?.name || "Origin";
          const destinationLabel = contract.destinationName || destBody?.stationName || destBody?.name || "Destination";

          // Fulfill validation triggers
          let isFulfillable = false;
          let fulfillReason = "";

          if (contract.completed) {
            isFulfillable = false;
          } else if (!contract.accepted) {
            isFulfillable = false;
          } else {
            // Check delivery requirements (Docked at target with cargo)
            if (contract.type === "delivery") {
              const currentCargoAmt = ship.cargo[contract.cargoType || ""] || 0;
              const dockedAtTarget = isDocked
                && dockedBodyId === contract.destinationId
                && (!contract.destinationPortId || dockedPortId === contract.destinationPortId);

              if (dockedAtTarget && currentCargoAmt >= (contract.amount || 0)) {
                isFulfillable = true;
                fulfillReason = `Deliver ${contract.amount}t of ${contract.cargoType} directly.`;
              } else if (!dockedAtTarget) {
                fulfillReason = `Requires docking your ship at ${destBody?.name || "Target"}.`;
              } else {
                fulfillReason = `Hold carries insufficient ${contract.cargoType} (${currentCargoAmt}/${contract.amount}t).`;
              }
            } else if (contract.type === "passenger") {
              const dockedAtTarget = isDocked
                && dockedBodyId === contract.destinationId
                && (!contract.destinationPortId || dockedPortId === contract.destinationPortId);
              if (dockedAtTarget) {
                isFulfillable = true;
                fulfillReason = `Passenger manifest ready for station transfer.`;
              } else {
                fulfillReason = `Passengers must be delivered to ${destBody?.name || "target port"}.`;
              }
            }
            
            // Orbit matching: within 1,200 km of target AND velocity matches (relative speed < 2,000 m/s)
            else if (contract.type === "orbit") {
              // Fetch absolute positions
              const shipPos = { x: ship.x, y: ship.y };
              const targetBody = bodies.find((b) => b.id === contract.destinationId);
              
              if (targetBody) {
                // local check
                const relX = targetBody.semiMajorAxis * Math.cos(targetBody.meanAnomalyAtEpoch + (2 * Math.PI / targetBody.orbitalPeriod) * gameTime);
                const relY = targetBody.semiMajorAxis * Math.sin(targetBody.meanAnomalyAtEpoch + (2 * Math.PI / targetBody.orbitalPeriod) * gameTime);
                
                // standard 0,0 for parent Sol
                const dx = ship.x - relX;
                const dy = ship.y - relY;
                const dist = Math.hypot(dx, dy);

                // Target velocity approach check
                const dt = 1.0;
                const nextX = targetBody.semiMajorAxis * Math.cos(targetBody.meanAnomalyAtEpoch + (2 * Math.PI / targetBody.orbitalPeriod) * (gameTime + dt));
                const nextY = targetBody.semiMajorAxis * Math.sin(targetBody.meanAnomalyAtEpoch + (2 * Math.PI / targetBody.orbitalPeriod) * (gameTime + dt));
                
                const targetVx = nextX - relX;
                const targetVy = nextY - relY;
                const relSpeed = Math.hypot(ship.vx - targetVx, ship.vy - targetVy);

                const isClose = dist < ((targetBody.radius ?? 0) + 1.5e6); // 1,500 km
                const matchedVelocity = relSpeed < 2000; // under 2000 m/s

                if (isClose && matchedVelocity) {
                  isFulfillable = true;
                  fulfillReason = "Orbital probe parameters achieved.";
                } else if (!isClose) {
                  fulfillReason = `Must fly within 1,500 km of ${targetBody.name}.`;
                } else {
                  fulfillReason = `Relative velocity too high (${Math.round(relSpeed)} / 2,000 m/s max).`;
                }
              }
            }
          }

          return (
            <div
              id={`contract-card-${contract.id}`}
              key={contract.id}
              className={`border rounded-xl p-4.5 flex flex-col md:flex-row justify-between gap-4 font-sans transition-all ${
                contract.completed
                  ? "bg-stone-950/40 border-stone-900 opacity-60"
                  : contract.accepted
                  ? "bg-sky-950/5 border-sky-900/60"
                  : "bg-stone-900 border-stone-800"
              }`}
            >
              {/* Info Body */}
              <div className="space-y-2 flex-grow max-w-2xl">
                <div className="flex flex-wrap gap-2 items-center">
                  <h4 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                    {contract.title}
                  </h4>
                  <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-mono tracking-wider font-semibold border ${
                    contract.completed
                      ? "bg-slate-950 text-stone-500 border-stone-900"
                      : contract.accepted
                      ? "bg-sky-950 text-sky-400 border-sky-900"
                      : "bg-stone-950 text-stone-400 border-stone-800"
                  }`}>
                    {contract.completed ? "COMPLETED" : contract.accepted ? "ACTIVE LOG" : "AVAILABLE CONTRACT"}
                  </span>
                </div>

                <p className="text-xs text-stone-400 leading-relaxed">
                  {contract.description}
                </p>

                {(contract.issuerFaction || contract.routeTag) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-stone-500 uppercase tracking-wider">
                    {contract.issuerFaction && <span>Issuer: <span className="text-stone-300">{contract.issuerFaction}</span></span>}
                    {contract.routeTag && <span>Route: <span className="text-sky-400">{contract.routeTag}</span></span>}
                  </div>
                )}

                {/* Requirements / Route mapping */}
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 text-[11px] font-mono text-stone-500">
                  {contract.type === "delivery" && (
                    <>
                      <span>ROUTE:</span>
                      <span className="text-stone-300 font-semibold">{originLabel}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-stone-600 self-center" />
                      <span className="text-sky-400 font-semibold">{destinationLabel}</span>
                    </>
                  )}
                  {contract.type === "passenger" && (
                    <>
                      <span>PASSENGERS:</span>
                      <span className="text-emerald-400 font-bold">{contract.passengerCount || 0} berths</span>
                    </>
                  )}
                  {contract.type === "orbit" && (
                    <>
                      <span>ORBIT TARGET:</span>
                      <span className="text-amber-500 font-bold">{destinationLabel}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Action columns */}
              <div className="flex flex-row md:flex-col justify-between md:justify-center items-center md:items-end border-t md:border-t-0 border-stone-800/60 pt-3.5 md:pt-0 min-w-[140px] shrink-0">
                <div className="md:text-right font-mono space-y-0.5 mb-2">
                  <span className="text-[9px] text-stone-500 uppercase tracking-widest block">Expedition Bounty</span>
                  <span className="text-sm font-bold text-amber-400 flex items-center md:justify-end gap-1">
                    <CircleDollarSign className="w-4 h-4 text-amber-500" />
                    {contract.reward.toLocaleString()}¢
                  </span>
                </div>

                {contract.completed ? (
                  <span className="text-xs text-emerald-500 font-mono font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> REWARD CLAIMED
                  </span>
                ) : contract.accepted ? (
                  isFulfillable ? (
                    <button
                      id={`complete-contract-btn-${contract.id}`}
                      onClick={() => onCompleteContract(contract.id)}
                      className="bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-bold px-3 py-2 rounded-lg transition active:scale-95 cursor-pointer shadow-md shadow-emerald-500/10"
                    >
                      SUBMIT PAYLOAD
                    </button>
                  ) : (
                    <div className="text-right max-w-[200px]">
                      <span className="text-[10px] text-stone-500 leading-normal block flex items-center gap-1 md:justify-end">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-amber-500" /> Wait Conditions
                      </span>
                      <p className="text-[10px] text-stone-400 mt-0.5 max-w-[180px] break-words">
                        {fulfillReason}
                      </p>
                    </div>
                  )
                ) : (
                  <button
                    id={`accept-contract-btn-${contract.id}`}
                    disabled={contract.type === "passenger" && ship.passengerCount + (contract.passengerCount || 0) > ship.passengerCapacity}
                    onClick={() => onAcceptContract(contract.id)}
                    className="bg-sky-500 hover:bg-sky-400 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 text-xs font-bold px-4.5 py-2.5 rounded-lg transition active:scale-95 cursor-pointer"
                  >
                    ACCEPT CONTRACT
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
