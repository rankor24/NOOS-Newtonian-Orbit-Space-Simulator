/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { PlayerProfile } from "../types";
import { Award, Pickaxe, Orbit, Briefcase, Shield, Coins } from "lucide-react";

interface CommanderPanelProps {
  commanderName: string;
  profile: PlayerProfile;
  credits: number;
}

export const CommanderPanel: React.FC<CommanderPanelProps> = ({ commanderName, profile, credits }) => {
  const rows = [
    { id: "mining", label: "Mining", level: profile.career.mining.level, xp: profile.career.mining.xp, icon: Pickaxe },
    { id: "trade", label: "Trade", level: profile.career.trade.level, xp: profile.career.trade.xp, icon: Coins },
    { id: "exploration", label: "Exploration", level: profile.career.exploration.level, xp: profile.career.exploration.xp, icon: Orbit },
    { id: "operations", label: "Operations", level: profile.career.operations.level, xp: profile.career.operations.xp, icon: Briefcase },
    { id: "security", label: "Security", level: profile.career.security.level, xp: profile.career.security.xp, icon: Shield },
  ] as const;

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" /> Commander Profile
          </h3>
          <p className="text-xs text-stone-400 mt-1">{commanderName} • Level {profile.overallLevel}</p>
        </div>
        <div className="text-right text-xs font-mono text-stone-400">
          <div>Credits</div>
          <div className="text-amber-400 font-bold">{credits.toLocaleString()}¢</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.id} className="bg-stone-950/70 border border-stone-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-200 font-semibold flex items-center gap-2"><Icon className="w-3.5 h-3.5 text-sky-400" /> {row.label}</span>
                <span className="text-amber-400 font-mono">Lv {row.level}</span>
              </div>
              <div className="text-stone-500 font-mono mt-1">XP {row.xp}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono text-stone-400">
        <div className="bg-stone-950/70 border border-stone-800 rounded-lg p-3">Contracts<br /><span className="text-slate-200 font-bold">{profile.stats.contractsCompleted}</span></div>
        <div className="bg-stone-950/70 border border-stone-800 rounded-lg p-3">Mined Tons<br /><span className="text-slate-200 font-bold">{profile.stats.tonsMined.toFixed(1)}</span></div>
        <div className="bg-stone-950/70 border border-stone-800 rounded-lg p-3">Trade Profit<br /><span className="text-slate-200 font-bold">{profile.stats.tradeProfit.toLocaleString()}¢</span></div>
        <div className="bg-stone-950/70 border border-stone-800 rounded-lg p-3">Refuels<br /><span className="text-slate-200 font-bold">{profile.stats.refuels}</span></div>
      </div>
    </div>
  );
}
