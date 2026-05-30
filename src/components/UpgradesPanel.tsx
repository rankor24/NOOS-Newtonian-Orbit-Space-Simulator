/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ShipState, ShipUpgrade } from "../types";
import { UPGRADES } from "../utils/gameData";
import { Wrench, CircleCheck, Coins, Sparkles, Gauge, Weight } from "lucide-react";

interface UpgradesPanelProps {
  ship: ShipState;
  playerCredits: number;
  unlockedUpgradeIds: string[];
  onUnlockUpgrade: (upgradeId: string) => void;
}

export const UpgradesPanel: React.FC<UpgradesPanelProps> = ({
  ship,
  playerCredits,
  unlockedUpgradeIds,
  onUnlockUpgrade,
}) => {
  return (
    <div className="space-y-6 font-sans">
      
      {/* Page Header */}
      <div className="flex justify-between items-center border-b border-stone-800 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <Wrench className="text-amber-500 w-5 h-5" /> ENGINEERING SHIPYARD
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">Optimize engine dry-mass, specific impulses, and jump capacities.</p>
        </div>
        <div className="flex bg-stone-900 border border-stone-800 px-4 py-2 rounded-lg items-center gap-2">
          <span className="text-[10px] text-stone-500 uppercase tracking-wider">Credits Buffer:</span>
          <span className="text-sm font-mono font-bold text-amber-400 flex items-center gap-1">
            <Coins className="w-4 h-4" /> {playerCredits.toLocaleString()}¢
          </span>
        </div>
      </div>

      {/* Ship Active Specs Display */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-stone-900 border border-stone-800/85 p-4 rounded-xl">
        <div className="space-y-1 font-mono text-xs">
          <span className="text-stone-500 block uppercase text-[10px]">Continuous Thrust</span>
          <span className="text-slate-200 text-sm font-bold flex items-center gap-1">
            <Gauge className="w-4 h-4 text-sky-400" />
            {(ship.engineThrust / 1000).toFixed(0)} kN
          </span>
        </div>
        <div className="space-y-1 font-mono text-xs">
          <span className="text-stone-500 block uppercase text-[10px]">Specific Impulse (Isp)</span>
          <span className="text-slate-200 text-sm font-bold">
            {ship.engineIsp.toLocaleString()} seconds
          </span>
        </div>
        <div className="space-y-1 font-mono text-xs">
          <span className="text-stone-500 block uppercase text-[10px]">Dry Chassis Mass</span>
          <span className="text-slate-200 text-sm font-bold flex items-center gap-1">
            <Weight className="w-4 h-4 text-orange-400" />
            {ship.dryMass.toLocaleString()} kg
          </span>
        </div>
        <div className="space-y-1 font-mono text-xs">
          <span className="text-stone-500 block uppercase text-[10px]">Interstellar Drive</span>
          <span className={`text-sm font-bold uppercase ${ship.warpCapacity ? "text-purple-400 font-semibold" : "text-stone-500"}`}>
            {ship.warpCapacity ? `Warp Active (${ship.maxWarpRange} LY)` : "Disabled"}
          </span>
        </div>
      </div>

      {/* Upgrades List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {UPGRADES.map((upgrade) => {
          const isUnlocked = unlockedUpgradeIds.includes(upgrade.id);
          const needsCredits = playerCredits < upgrade.cost;

          // Category labels
          const catLabels: { [key: string]: string } = {
            engine: "Thruster Propulsion",
            fuelTank: "Fuel Storage Core",
            cargo: "Logitech Cargo Box",
            sensor: "Scanner & Survey Suite",
            drill: "Deep Field Drill",
            warp: "Interstellar FTL Drive",
          };

          return (
            <div
              id={`upgrade-card-${upgrade.id}`}
              key={upgrade.id}
              className={`border rounded-xl p-4.5 flex flex-col justify-between transition-all duration-300 relative overflow-hidden ${
                isUnlocked
                  ? "bg-emerald-950/10 border-emerald-900/60 shadow-inner"
                  : "bg-stone-900 border-stone-800 hover:border-stone-700 shadow-md"
              }`}
            >
              {/* Category tag */}
              <div className="flex justify-between items-start mb-3">
                <span className="text-[9px] bg-stone-950 border border-stone-800 text-stone-400 px-2 py-0.5 rounded uppercase font-mono tracking-wider">
                  {catLabels[upgrade.category]}
                </span>
                {isUnlocked && (
                  <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/50">
                    <CircleCheck className="w-3.5 h-3.5" /> INSTALLED
                  </span>
                )}
              </div>

              {/* Specs detail */}
              <div className="space-y-1.5 flex-grow">
                <h4 className="text-sm font-bold text-slate-100 leading-tight">
                  {upgrade.name}
                </h4>
                <p className="text-xs text-stone-400 leading-relaxed font-sans">
                  {upgrade.description}
                </p>
              </div>

              {/* Install and purchase footer */}
              <div className="mt-5 pt-3.5 border-t border-stone-800 flex justify-between items-center">
                {!isUnlocked && (
                  <>
                    <div className="flex flex-col">
                      <span className="text-[9px] text-stone-500 uppercase font-mono tracking-widest">Install Fee</span>
                      <span className="text-sm font-bold font-mono text-amber-400">{upgrade.cost.toLocaleString()}¢</span>
                    </div>

                    <button
                      id={`purchase-btn-${upgrade.id}`}
                      disabled={needsCredits}
                      onClick={() => onUnlockUpgrade(upgrade.id)}
                      className={`px-4 py-2 text-xs rounded-lg font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer ${
                        needsCredits
                          ? "bg-stone-850 text-stone-500 border border-stone-800 cursor-not-allowed"
                          : "bg-amber-500 hover:bg-amber-400 text-stone-950"
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" /> UPGRADE CORE
                    </button>
                  </>
                )}
                {isUnlocked && (
                  <div className="text-[10px] text-slate-500 font-mono italic">
                    All components integrated. Flight controller updated smoothly.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
