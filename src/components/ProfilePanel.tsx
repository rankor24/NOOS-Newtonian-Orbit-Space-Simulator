/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { CommanderProfileSummary } from "../utils/saveSystem";
import { Save, FolderOpen, Trash2, PlusCircle } from "lucide-react";

interface ProfilePanelProps {
  currentProfileId: string;
  profiles: CommanderProfileSummary[];
  onSelectProfile: (profileId: string) => void;
  onSaveProfile: () => void;
  onCreateProfile: () => void;
  onDeleteProfile: () => void;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ currentProfileId, profiles, onSelectProfile, onSaveProfile, onCreateProfile, onDeleteProfile }) => {
  return (
    <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-100 uppercase tracking-widest">Commander Saves</h3>
          <p className="text-xs text-stone-500 mt-1">Profile-aware save/load lifecycle.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onSaveProfile} className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"><Save className="w-3.5 h-3.5" /> Save</button>
          <button onClick={onCreateProfile} className="px-3 py-2 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5"><PlusCircle className="w-3.5 h-3.5" /> New</button>
          <button onClick={onDeleteProfile} className="px-3 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
        </div>
      </div>
      <div className="flex gap-2 items-center">
        <FolderOpen className="w-4 h-4 text-amber-400" />
        <select value={currentProfileId} onChange={(e) => onSelectProfile(e.target.value)} className="flex-1 bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-sm text-slate-200">
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>{profile.commanderName} • L{profile.commanderLevel} • {profile.credits.toLocaleString()}¢</option>
          ))}
        </select>
      </div>
    </div>
  );
}
