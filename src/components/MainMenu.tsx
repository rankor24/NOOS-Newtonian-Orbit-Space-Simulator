import React, { useState, useEffect, useRef } from "react";
import {
  Play,
  Trash2,
  PlusCircle,
  Coins,
  ShieldAlert,
  Sparkles,
  Compass,
  ArrowRight,
  ArrowLeft,
  Anchor,
  Settings,
  ListTodo,
  Info,
  Calendar,
  Clock,
  User,
  Power
} from "lucide-react";
import { CommanderProfileSummary } from "../utils/saveSystem";
import { TUTORIAL_PROMPT_PREFERENCE_KEY } from "../utils/tutorial";

interface MainMenuProps {
  profiles: CommanderProfileSummary[];
  onSelectProfile: (id: string) => void;
  onDeleteProfile: (id: string, name: string) => void;
  onCreateProfile: (config: {
    name: string;
    starId: string;
    profession: "miner" | "merchant" | "explorer";
    tutorialMode: "start" | "skip";
  }) => void;
  uiTheme: "amber" | "blue" | "green" | "red";
  setUiTheme: (theme: "amber" | "blue" | "green" | "red") => void;
}

const STARTING_SYSTEMS = [
  {
    id: "star_sol",
    name: "Sol System",
    description: "The birthplace and heart of human civilization. Governed by the Coalition of United Colonies. Extremely safe lanes, dense celestial services, and balanced starting trade markets.",
    bonus: "Starting Capital: +1,500 cr bounty (+3,500 cr starting capital total)",
    difficulty: "Beginner"
  },
  {
    id: "star_alphacent",
    name: "Alpha Centauri",
    description: "Sol's closest neighbor and first sector colony. Featuring rapid heavy metal refining orbits, active asteroid belts, and a booming industrial sector hungry for cargo hauling.",
    bonus: "Raw Cargo: Starts with 3 tons of heavy metals & premium consumer assets",
    difficulty: "Intermediate"
  },
  {
    id: "star_sirius",
    name: "Sirius A System",
    description: "An ultra-luminous binary star system. Core base of Sirius Heavy Industries. Features intense orbital speeds, massive gravity wells, and extreme tech development centers.",
    bonus: "Propulsion Assist: Pre-installed composite fuel tanks & warp calibration specs",
    difficulty: "Advanced"
  }
];

const CAREERS = [
  {
    id: "merchant",
    title: "Merchant Courier",
    quote: "A credit earned is a system conquered.",
    perks: "License bonus +1 Trade Level, +1,500 additional starting credits, early luxury trading cargo load.",
    perkBullets: ["Trade Rank 2 (+500 XP)", "Enhanced Capital", "Loaded cargo bay (luxuries)"]
  },
  {
    id: "miner",
    title: "Asteroid Miner",
    quote: "Splitting boulders builds fleets.",
    perks: "Federation Mining License. Pre-equipped with Heavy-Pulse Mining Laser (4x speed boost) and raw water ice reserves.",
    perkBullets: ["Mining Rank 2 (+500 XP)", "Elite Mining Laser (+300% efficiency)", "Mined materials in hold"]
  },
  {
    id: "explorer",
    title: "Stellar Cartographer",
    quote: "The black holds all answers.",
    perks: "Survey License. Starts equipped with high-gain Deep Field Scanner Array (+100% sensor radius) and starting warp fuel.",
    perkBullets: ["Exploration Rank 2 (+500 XP)", "Deep Field Scanner Array", "1 unit of Helium-3 Fuel"]
  }
];

export const MainMenu: React.FC<MainMenuProps> = ({
  profiles,
  onSelectProfile,
  onDeleteProfile,
  onCreateProfile,
  uiTheme,
  setUiTheme
}) => {
  const [view, setView] = useState<"main" | "new-game" | "help">("main");
  
  // New Game parameters
  const [cmdrName, setCmdrName] = useState("");
  const [selectedStarId, setSelectedStarId] = useState("star_sol");
  const [selectedProfession, setSelectedProfession] = useState<"miner" | "merchant" | "explorer">("merchant");
  const [tutorialMode, setTutorialMode] = useState<"start" | "skip">(() => localStorage.getItem(TUTORIAL_PROMPT_PREFERENCE_KEY) === "skip" ? "skip" : "start");
  const [rememberTutorialChoice, setRememberTutorialChoice] = useState(false);
  
  // Fancy Starfield Drift Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrame: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      width = canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
      height = canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const stars: { x: number; y: number; r: number; speed: number; alpha: number }[] = [];
    for (let i = 0; i < 120; i++) {
      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.5 + 0.2,
        speed: Math.random() * 0.12 + 0.03,
        alpha: Math.random() * 0.7 + 0.3
      });
    }

    const draw = () => {
      ctx.fillStyle = "#020202";
      ctx.fillRect(0, 0, width, height);

      // Simple grid pattern mapping
      ctx.strokeStyle = "rgba(255,140,26,0.015)";
      if (uiTheme === "blue") ctx.strokeStyle = "rgba(38,217,255,0.012)";
      else if (uiTheme === "green") ctx.strokeStyle = "rgba(22,242,139,0.012)";
      else if (uiTheme === "red") ctx.strokeStyle = "rgba(255,67,95,0.012)";

      ctx.lineWidth = 1;
      const step = 48;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Stars
      ctx.fillStyle = "#fff";
      stars.forEach((s) => {
        ctx.globalAlpha = s.alpha * (0.8 + Math.sin(Date.now() / 300 + s.x) * 0.2);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();

        s.x -= s.speed;
        if (s.x < 0) {
          s.x = width;
          s.y = Math.random() * height;
        }
      });
      ctx.globalAlpha = 1.0;

      animFrame = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animFrame);
    };
  }, [uiTheme]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmdrName.trim()) {
      alert("Commander Callsign is required to register local flight certificate.");
      return;
    }
    onCreateProfile({
      name: cmdrName.trim(),
      starId: selectedStarId,
      profession: selectedProfession,
      tutorialMode,
    });
    if (rememberTutorialChoice) {
      localStorage.setItem(TUTORIAL_PROMPT_PREFERENCE_KEY, tutorialMode);
    }
  };

  const getThemeAccentClass = () => {
    switch (uiTheme) {
      case "blue": return "text-[#26d9ff] border-[#26d9ff] hover:bg-[#26d9ff]/10";
      case "green": return "text-[#16f28b] border-[#16f28b] hover:bg-[#16f28b]/10";
      case "red": return "text-[#ff435f] border-[#ff435f] hover:bg-[#ff435f]/10";
      default: return "text-[#ff8c1a] border-[#ff8c1a] hover:bg-[#ff8c1a]/10";
    }
  };

  const getThemeTextClass = () => {
    switch (uiTheme) {
      case "blue": return "text-[#26d9ff]";
      case "green": return "text-[#16f28b]";
      case "red": return "text-[#ff435f]";
      default: return "text-[#ff8c1a]";
    }
  };

  const getThemeBgClass = () => {
    switch (uiTheme) {
      case "blue": return "bg-[#26d9ff]/10 border-[#26d9ff]/30 text-[#26d9ff]";
      case "green": return "bg-[#16f28b]/10 border-[#16f28b]/30 text-[#16f28b]";
      case "red": return "bg-[#ff435f]/10 border-[#ff435f]/30 text-[#ff435f]";
      default: return "bg-[#ff8c1a]/10 border-[#ff8c1a]/30 text-[#ff8c1a]";
    }
  };

  const getThemeBtnSolidClass = () => {
    switch (uiTheme) {
      case "blue": return "bg-[#26d9ff] hover:bg-[#26d9ff]/80 text-black";
      case "green": return "bg-[#16f28b] hover:bg-[#16f28b]/80 text-black";
      case "red": return "bg-[#ff435f] hover:bg-[#ff435f]/80 text-black";
      default: return "bg-[#ff8c1a] hover:bg-[#ff8c1a]/80 text-black";
    }
  };

  const activeSystem = STARTING_SYSTEMS.find(s => s.id === selectedStarId);
  const activeCareer = CAREERS.find(c => c.id === selectedProfession);

  return (
    <div className={`elite-root elite-theme-${uiTheme} w-full h-full min-h-screen relative flex flex-col justify-between overflow-hidden select-none font-mono`}>
      {/* Background stars */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />
      
      {/* Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-stone-950/20 via-transparent to-stone-950/50 pointer-events-none z-10" />

      {/* Header telemetry and clock */}
      <header className="w-full flex items-center justify-between border-b border-stone-800/40 bg-stone-950/40 p-4 z-20 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-stone-400 tracking-wider">COCKPIT INTERFACE ONLINE • PORT 3000 SECURE</span>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex gap-1 bg-stone-900 border border-stone-800 px-2 py-0.5 rounded text-[10px]">
            {(["amber", "blue", "green", "red"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setUiTheme(t)}
                className={`px-1.5 rounded transition-all uppercase font-bold text-[9px] ${uiTheme === t ? "bg-stone-800 text-stone-100" : "text-stone-500 hover:text-stone-300"}`}
              >
                {t.slice(0, 3)}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-stone-500">SYSTEM EPOCH: YEAR 2086</span>
        </div>
      </header>

      {/* Content wrapper */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 z-20 overflow-y-auto max-w-6xl w-full mx-auto">
        {view === "main" ? (
          <div className="w-full max-w-4xl flex flex-col gap-8">
            <div className="text-center space-y-2">
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest flex items-center justify-center gap-3">
                <Compass className={`w-10 h-10 ${getThemeTextClass()} animate-spin-slow`} />
                <span>NEWTONIAN ORBIT</span>
              </h1>
              <p className="text-[11px] text-stone-500 tracking-widest uppercase">
                Dynamic Orbital Mechanics & Interstellar Logistics Core
              </p>
            </div>

            {/* Profiles & Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Profile list block (takes 2 cols if exists) */}
              <div className="md:col-span-2 bg-stone-950/70 border border-stone-800/80 rounded-xl p-5 backdrop-blur flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-stone-800/60 mb-4">
                    <span className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-2">
                      <User className="w-4 h-4 text-stone-400" /> Saved Commander Profiles
                    </span>
                    <span className="text-[10px] text-stone-500 uppercase">{profiles.length} Active Licensing Entries</span>
                  </div>

                  {profiles.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center gap-4">
                      <div className="w-12 h-12 rounded-full border border-stone-800 flex items-center justify-center text-amber-500 bg-stone-900/50">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-stone-300">NO LOCAL FLIGHT CONTRACTS DETECTED</h4>
                        <p className="text-xs text-stone-600 max-w-md">
                          You need to register a pilot certificate with the Federal Space Agency to mount spacecraft telemetry.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {profiles.map((profile) => (
                        <div
                          key={profile.id}
                          className="group relative bg-stone-900/40 border border-stone-800 hover:border-stone-700/80 rounded-lg p-3.5 flex items-center justify-between transition-all"
                        >
                          <div className="space-y-1 flex-1">
                            <div className="flex items-center gap-2.5">
                              <h3 className="text-sm font-bold text-slate-100 uppercase">{profile.commanderName}</h3>
                              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${getThemeBgClass()}`}>
                                Level {profile.commanderLevel}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-stone-500">
                              <span className="flex items-center gap-1">
                                <Coins className="w-3.5 h-3.5 text-amber-500/70" /> {profile.credits.toLocaleString()}¢
                              </span>
                              <span className="flex items-center gap-1">
                                <Compass className="w-3.5 h-3.5 text-sky-500/70" /> {profile.activeStarId === "star_sol" ? "Sol" : "Deep Space"}
                              </span>
                              <span className="flex items-center gap-1 text-stone-400 font-semibold">
                                Ship: {profile.activeShipName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {Math.round(profile.totalPlayTimeSec / 60)} min played
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onSelectProfile(profile.id)}
                              className={`px-3 py-1.5 rounded text-xs font-bold uppercase flex items-center gap-1.5 cursor-pointer ${getThemeBtnSolidClass()}`}
                            >
                              <Play className="w-3.5 h-3.5 fill-current" /> LAUNCH
                            </button>
                            <button
                              onClick={() => onDeleteProfile(profile.id, profile.commanderName)}
                              className="p-1.5 rounded border border-transparent hover:border-rose-900/50 hover:bg-rose-950/20 text-stone-600 hover:text-rose-400 transition-all cursor-pointer"
                              title="Delete profile"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-stone-900 flex justify-between items-center text-[10px] text-stone-600">
                  <span>SANDBOX DIRECTORY: LOCAL STORAGE PERSISTENCE</span>
                  <span>VER 2.8.6.V</span>
                </div>
              </div>

              {/* Sidebar Quick-Action panel */}
              <div className="bg-stone-950/75 border border-stone-800/80 rounded-xl p-5 flex flex-col justify-between backdrop-blur">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase text-stone-400 tracking-wider">Interface Operations</h3>
                  
                  <button
                    onClick={() => setView("new-game")}
                    className="w-full flex items-center justify-between p-3.5 bg-stone-900/80 border border-stone-800 hover:border-stone-700/85 hover:bg-stone-900 rounded-xl transition-all text-left group cursor-pointer"
                  >
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-200 group-hover:text-amber-400 transition-colors uppercase flex items-center gap-1.5">
                        <PlusCircle className="w-4 h-4 text-amber-500" /> New Career
                      </h4>
                      <p className="text-[10px] text-stone-500 leading-normal">
                        Create a newly registered flight certificate with customized starting coordinates and bonuses.
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-stone-500 group-hover:translate-x-1 transition-transform" />
                  </button>

                  <button
                    onClick={() => setView("help")}
                    className="w-full flex items-center justify-between p-3.5 bg-stone-900/50 border border-stone-800 hover:border-stone-700 rounded-xl transition-all text-left group cursor-pointer"
                  >
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-slate-300 uppercase flex items-center gap-1.5">
                        <Info className="w-4 h-4 text-sky-400" /> Flight Manual
                      </h4>
                      <p className="text-[10px] text-stone-500 leading-normal">
                        Review Newtonian orbit physics, throttle controls, docking alignments, and mineral extraction.
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-stone-500 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                <div className="bg-stone-900/40 border border-stone-900 p-3 rounded-lg mt-4 text-[10px] text-stone-500 space-y-2 leading-relaxed">
                  <p className="font-bold uppercase text-[9px] text-stone-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> PHYSICAL SIMULATOR
                  </p>
                  No forced orbits. Real gravity wells are computed real-time using Newtonian integration. Align thrusters correctly!
                </div>
              </div>
            </div>
          </div>
        ) : view === "new-game" ? (
          <form onSubmit={handleRegister} className="w-full max-w-4xl bg-stone-950/80 border border-stone-800 rounded-xl p-6 md:p-8 backdrop-blur flex flex-col gap-6">
            
            {/* Title / Back */}
            <div className="flex items-center justify-between pb-4 border-b border-stone-800">
              <div className="space-y-1">
                <h2 className="text-xl font-bold uppercase text-slate-100 flex items-center gap-2">
                  <PlusCircle className="text-amber-500" /> Flight Certificate Registration
                </h2>
                <p className="text-[10px] text-stone-500 uppercase">Input character specifications to boot the simulator core.</p>
              </div>
              <button
                type="button"
                onClick={() => { setView("main"); setCmdrName(""); }}
                className="px-3 py-1.5 rounded border border-stone-800 hover:bg-stone-900 text-stone-400 text-xs font-bold uppercase flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            </div>

            {/* Commander name text field */}
            <div className="space-y-2 text-left">
              <label htmlFor="cmdr_name_input" className="text-xs font-bold text-stone-400 uppercase tracking-widest block">Commander Callsign (Name)</label>
              <input
                id="cmdr_name_input"
                type="text"
                required
                maxLength={20}
                value={cmdrName}
                onChange={(e) => setCmdrName(e.target.value.replace(/[^a-zA-Z0-9_\s-]/g, ""))}
                placeholder="e.g. COOPER / RIPLEY / CHEN"
                className="w-full max-w-md bg-stone-900 border border-stone-800 focus:border-amber-500 rounded px-4 py-2 text-sm text-slate-100 focus:outline-none transition-colors uppercase font-bold tracking-wider"
              />
            </div>

            {/* Big Columns: Star selection VS License loadout selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              
              {/* Star starting systems */}
              <div className="space-y-3 text-left">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-widest block">Starting Sector Location</span>
                <div className="space-y-2.5">
                  {STARTING_SYSTEMS.map((sys) => (
                    <div
                      key={sys.id}
                      onClick={() => setSelectedStarId(sys.id)}
                      className={`group border rounded-lg p-3.5 transition-all cursor-pointer ${selectedStarId === sys.id ? "bg-stone-900 border-amber-600" : "bg-stone-900/30 border-stone-800/80 hover:border-stone-800"}`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <strong className={`text-xs uppercase ${selectedStarId === sys.id ? getThemeTextClass() : "text-slate-300"}`}>{sys.name}</strong>
                        <span className="text-[9px] uppercase font-semibold text-stone-500">{sys.difficulty}</span>
                      </div>
                      <p className="text-[10px] text-stone-400 leading-relaxed mb-2 line-clamp-2 select-text">{sys.description}</p>
                      <div className="text-[9px] font-semibold text-amber-500/90 tracking-wide uppercase flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded">
                        <span>▶ {sys.bonus}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Career professions choice */}
              <div className="space-y-3 text-left flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-widest block mb-3">Professional License Loadout</span>
                  <div className="grid grid-cols-3 gap-2.5">
                    {CAREERS.map((car) => (
                      <button
                        key={car.id}
                        type="button"
                        onClick={() => setSelectedProfession(car.id as any)}
                        className={`p-3 rounded-lg border text-center transition-all cursor-pointer ${selectedProfession === car.id ? "bg-stone-900/85 border-amber-500 shadow-md transform -translate-y-0.5" : "bg-stone-900/30 border-stone-800 hover:border-stone-700"}`}
                      >
                        <h4 className="text-[10px] font-bold text-slate-200 uppercase tracking-wide leading-tight">{car.title.split(" ")[1] || car.title}</h4>
                        <span className="text-[8px] text-stone-500 font-bold uppercase">{car.id === "miner" ? "Laser" : car.id === "merchant" ? "Trading" : "Survey"}</span>
                      </button>
                    ))}
                  </div>

                  {activeCareer && (
                    <div className="bg-stone-900/40 border border-stone-800 rounded-lg p-4 mt-3 space-y-2">
                      <div className="flex items-center justify-between pb-1 border-b border-stone-800/60 mb-2">
                        <h3 className="text-xs font-bold text-amber-400 uppercase">{activeCareer.title}</h3>
                        <em className="text-[9px] text-stone-500 italic block">"{activeCareer.quote}"</em>
                      </div>
                      <p className="text-[11px] text-stone-400 leading-relaxed">{activeCareer.perks}</p>
                      
                      <div className="space-y-1">
                        <span className="text-[8px] uppercase tracking-wider text-stone-500 block font-bold">Equipment Granted:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {activeCareer.perkBullets.map((bullet, idx) => (
                            <span key={idx} className="text-[9px] bg-stone-950 border border-stone-800 text-stone-300 font-semibold px-2 py-0.5 rounded">
                              ✓ {bullet}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Technical Ship Panel preview */}
                <div className="border border-stone-800 bg-stone-950/50 rounded-lg p-3 text-[10px] text-stone-500 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="font-bold text-stone-400 block uppercase">Starter Ship Registration:</span>
                    <strong className="text-slate-200 text-xs">Falcon-DeLacy Sidewinder MK I</strong>
                    <div className="flex gap-3 text-stone-500 text-[9px] uppercase">
                      <span>Cargo: 4 tons</span>
                      <span>•</span>
                      <span>Dry Mass: 23,800 kg</span>
                      <span>•</span>
                      <span>Thrust: 170 kN</span>
                    </div>
                  </div>
                  <div className="px-2.5 py-1.5 rounded border border-stone-800 bg-stone-900/50 text-[10px] text-stone-400 text-center uppercase tracking-wide flex flex-col">
                    <span className="text-stone-500 text-[8px] font-bold">INSURED VALUE</span>
                    <span className="text-amber-500 font-bold">100% COVER</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-left border border-stone-800 rounded-lg bg-stone-950/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-stone-400 uppercase tracking-widest block">Flight Training Enrollment</span>
                  <p className="text-[10px] text-stone-500 mt-1 uppercase">New commanders can start with guided flight certification or skip straight to free operations.</p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${tutorialMode === "start" ? getThemeBgClass() : "bg-stone-950 border-stone-800 text-stone-500"}`}>
                  {tutorialMode === "start" ? "Training Enabled" : "Training Skipped"}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTutorialMode("start")}
                  className={`text-left rounded-lg border p-3 transition-colors ${tutorialMode === "start" ? "border-amber-500 bg-stone-900/80" : "border-stone-800 bg-stone-900/30 hover:border-stone-700"}`}
                >
                  <strong className="block text-xs uppercase text-slate-100">Start Training</strong>
                  <span className="block text-[10px] text-stone-400 mt-1">Begin with Bay Clearance, vector control, match-speed, docking, and a first paid run.</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTutorialMode("skip")}
                  className={`text-left rounded-lg border p-3 transition-colors ${tutorialMode === "skip" ? "border-amber-500 bg-stone-900/80" : "border-stone-800 bg-stone-900/30 hover:border-stone-700"}`}
                >
                  <strong className="block text-xs uppercase text-slate-100">Skip Training</strong>
                  <span className="block text-[10px] text-stone-400 mt-1">Start immediately with the sandbox. Flight certification can still be resumed later from the contract board.</span>
                </button>
              </div>
              <label className="flex items-center gap-2 text-[10px] text-stone-400 uppercase tracking-wide">
                <input
                  type="checkbox"
                  checked={rememberTutorialChoice}
                  onChange={(event) => setRememberTutorialChoice(event.target.checked)}
                  className="accent-amber-500"
                />
                Do Not Ask Again
              </label>
            </div>

            {/* Form actions */}
            <div className="pt-4 border-t border-stone-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setView("main"); setCmdrName(""); }}
                className="px-5 py-2.5 rounded-lg border border-stone-800 text-stone-400 hover:bg-stone-900 text-xs font-bold uppercase transition-colors"
              >
                Abort Registration
              </button>
              <button
                type="submit"
                disabled={!cmdrName.trim()}
                className={`px-6 py-2.5 rounded-lg text-xs font-bold uppercase flex items-center gap-2 tracking-widest cursor-pointer ${!cmdrName.trim() ? "opacity-40 cursor-not-allowed bg-stone-800 text-stone-500" : getThemeBtnSolidClass()}`}
              >
                LAUNCH SIMULATOR <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        ) : (
          <div className="w-full max-w-3xl bg-stone-950/80 border border-stone-800 rounded-xl p-6 md:p-8 backdrop-blur flex flex-col gap-6 text-left">
            
            {/* Help / Guide Title */}
            <div className="flex items-center justify-between pb-4 border-b border-stone-800">
              <div className="space-y-1">
                <h2 className="text-xl font-bold uppercase text-slate-100 flex items-center gap-2">
                  <Compass className="text-sky-400" /> Pilot Flight Deck Guide
                </h2>
                <p className="text-[10px] text-stone-500 uppercase">Core Newtonian flight dynamics and cockpit operation manual.</p>
              </div>
              <button
                type="button"
                onClick={() => setView("main")}
                className="px-3 py-1.5 rounded border border-stone-800 hover:bg-stone-900 text-stone-400 text-xs font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
            </div>

            {/* Quick guide text */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-stone-400 leading-relaxed overflow-y-auto max-h-[360px] pr-2">
              <div className="space-y-4">
                <section className="space-y-1.5">
                  <h3 className="text-sm font-bold text-stone-200 uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Newtonian Drift Physics
                  </h3>
                  <p>
                    There is no friction in vacuum. Your ship will drift indefinitely at your current velocity vector until you fire thrusters in the opposite direction.
                  </p>
                  <p className="text-stone-500">
                    To halt relative motion completely, you must align with your target and trigger retro thrust, or use the autopilot's <strong className="text-stone-300">MATCH</strong> velocity function.
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="text-sm font-bold text-stone-200 uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Flight Autopilot Loops
                  </h3>
                  <p>
                    Your spacecraft contains highly advanced, reactive flight assistance protocols:
                  </p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong className="text-stone-300">ALIGN:</strong> Automatically handles craft yaw/rotation to look directly.</li>
                    <li><strong className="text-stone-300">APPR (Approach):</strong> Guides alignment and adjusts throttle to approach a station.</li>
                    <li><strong className="text-stone-300">MATCH (Speed):</strong> Fires thrusters to dynamically match velocities.</li>
                    <li><strong className="text-stone-300">CIRC (Circularize):</strong> Adjusts relative orbital path into a perfect circular orbit.</li>
                  </ul>
                </section>
              </div>

              <div className="space-y-4">
                <section className="space-y-1.5">
                  <h3 className="text-sm font-bold text-stone-200 uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Mining & Trade Logics
                  </h3>
                  <p>
                    Target a rich asteroid, moon, or rings, fly within <strong className="text-stone-300 font-semibold">500km range</strong>, and activate your <strong className="text-stone-300 font-semibold">MINING LASER</strong> to collect Water Ice, Hydrogen, and Metal Ores.
                  </p>
                  <p>
                    Dock safely at any Space Station or Orbital Port. Open the <strong className="text-stone-300 font-semibold">TRADE PANEL</strong> to trade commodities, acquire heavy ship hulls, or refuel hydrogen.
                  </p>
                </section>

                <section className="space-y-1.5">
                  <h3 className="text-sm font-bold text-stone-200 uppercase flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Interstellar Warp Jumps
                  </h3>
                  <p>
                    Acquire the <strong className="text-stone-300 font-semibold">Hyper-Resonant Warp Drive</strong> upgrade at local shipyards, load up Helium-3 propellant gas, and warp to adjacent star systems in the Galactic Map view.
                  </p>
                </section>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-800 text-center">
              <button
                type="button"
                onClick={() => setView("main")}
                className="px-6 py-2 bg-stone-900 hover:bg-stone-850 rounded border border-stone-800 text-xs text-slate-200 font-bold uppercase transition-all cursor-pointer"
              >
                Return To Operations
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer credits representation */}
      <footer className="w-full text-center border-t border-stone-900/60 bg-stone-950/60 p-3 z-20 text-[10px] text-stone-500 tracking-wider flex flex-col md:flex-row justify-between items-center px-6">
        <span>© FAULCON DELACY LOGISTICS • SHIPYARD FIRMWARE V2-REV.A</span>
        <span>PRESS [ESC] OR EJECT SYSTEM TO ABANDON SHIP TELEMENTRY</span>
      </footer>
    </div>
  );
};
