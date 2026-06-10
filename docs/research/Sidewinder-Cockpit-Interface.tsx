import React, { useState, useEffect } from 'react';

// --- STYLES & ANIMATIONS ---
const hudStyles = `
  @keyframes scanline {
    0% { transform: translateY(-100%); opacity: 0.1; }
    50% { opacity: 0.3; }
    100% { transform: translateY(100%); opacity: 0.1; }
  }
  @keyframes spin-3d {
    0% { transform: rotateY(0deg); }
    100% { transform: rotateY(360deg); }
  }
  @keyframes radar-pulse {
    0% { transform: scale(0.2); opacity: 0.8; }
    100% { transform: scale(1.1); opacity: 0; }
  }
  @keyframes glitch {
    0% { opacity: 0.98; transform: skew(0deg); }
    2% { opacity: 0.5; transform: skew(3deg); }
    3% { opacity: 0.98; transform: skew(0deg); }
    30% { opacity: 0.99; }
    31% { opacity: 0.7; transform: skew(-2deg); }
    32% { opacity: 0.99; }
    100% { opacity: 0.98; }
  }
  @keyframes active-glow {
    0% { filter: drop-shadow(0 0 2px #ff6c00) opacity(0.8); }
    50% { filter: drop-shadow(0 0 8px #ff6c00) opacity(1); }
    100% { filter: drop-shadow(0 0 2px #ff6c00) opacity(0.8); }
  }

  .hud-container {
    background-color: #060301;
    color: #ff6c00;
    font-family: 'Courier New', Courier, monospace;
    user-select: none;
    overflow: hidden;
  }
  .holo-text {
    text-shadow: 0 0 5px rgba(255, 108, 0, 0.7);
  }
  .holo-glow {
    filter: drop-shadow(0 0 4px rgba(255, 108, 0, 0.6));
  }
  .blue-glow {
    filter: drop-shadow(0 0 6px rgba(0, 190, 255, 0.8));
  }
  .wireframe-target {
    transform-style: preserve-3d;
    animation: spin-3d 12s linear infinite;
    transform-origin: center;
  }
  .wireframe-ship {
    transform-style: preserve-3d;
    animation: spin-3d 16s linear infinite;
    transform-origin: center;
  }
  .glitch-anim {
    animation: glitch 8s infinite;
  }
  .radar-sweep {
    animation: radar-pulse 3s infinite linear;
    transform-origin: center;
  }
  .indicator-active {
    color: #ffaa00;
    text-shadow: 0 0 8px #ffaa00;
    animation: active-glow 2s infinite;
  }
`;

export const EliteHUD: React.FC = () => {
  // --- STATE ---
  const [speed, setSpeed] = useState<number>(65);
  const [heat, setHeat] = useState<number>(52);
  const [pips, setPips] = useState<{ sys: number; eng: number; wep: number }>({ sys: 2, eng: 2, wep: 2 });
  const [indicators, setIndicators] = useState({
    massLocked: true,
    landingGear: false,
    cargoScoop: false,
  });
  const [targetShields, setTargetShields] = useState<number>(3); // 0 to 3 rings
  const [shipShields, setShipShields] = useState<number>(3); // 0 to 3 rings

  // Simulate slight fluctuation in heat/speed for ambient realism
  useEffect(() => {
    const interval = setInterval(() => {
      setHeat((prev) => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        const next = prev + delta;
        return next >= 50 && next <= 54 ? next : prev;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const adjustPips = (system: 'sys' | 'eng' | 'wep') => {
    setPips((prev) => {
      const total = prev.sys + prev.eng + prev.wep;
      // Max pips total is 6. If we can add to this system, do it
      if (prev[system] < 4 && total < 6) {
        return { ...prev, [system]: prev[system] + 1 };
      } else if (prev[system] < 4 && total === 6) {
        // Redistribute: steal from another non-zero system
        const others = (['sys', 'eng', 'wep'] as const).filter((s) => s !== system);
        const targetToSteal = prev[others[0]] > prev[others[1]] ? others[0] : others[1];
        if (prev[targetToSteal] > 0) {
          return {
            ...prev,
            [system]: prev[system] + 1,
            [targetToSteal]: prev[targetToSteal] - 1,
          };
        }
      }
      return prev;
    });
  };

  const resetPips = () => {
    setPips({ sys: 2, eng: 2, wep: 2 });
  };

  return (
    <div className="hud-container relative w-full h-[600px] flex flex-col justify-between p-6 border border-amber-950 rounded-lg select-none">
      <style>{hudStyles}</style>

      {/* Holographic scanning overlay lines */}
      <div className="absolute inset-0 pointer-events-none opacity-10 bg-gradient-to-b from-transparent via-[#ff6c00] to-transparent bg-[length:100%_4px] animate-[scanline_8s_linear_infinite]" />

      {/* --- TOP ROW PANELS --- */}
      <div className="flex justify-between w-full h-16 pointer-events-none">
        {/* Comms Panel (Left) */}
        <div className="w-1/4 border-t-2 border-l border-[#ff6c00]/30 p-2 glitch-anim">
          <div className="text-xs uppercase text-[#ff6c00]/60">Comms</div>
          <div className="text-sm holo-text text-[#ff6c00]">▶ LOCAL SYSTEM CHANNEL</div>
        </div>

        {/* Info Panel (Right) */}
        <div className="w-1/4 border-t-2 border-r border-[#ff6c00]/30 p-2 text-right glitch-anim">
          <div className="text-xs uppercase text-[#ff6c00]/60">Info</div>
          <div className="text-sm text-red-500 animate-pulse">⚡ 2 CONTACTS LOST</div>
        </div>
      </div>

      {/* --- MAIN HUD DISPLAY (MIDDLE/BOTTOM) --- */}
      <div className="flex justify-between items-end w-full h-96 relative">
        
        {/* ================= LEFT WING: TARGET INFO & SCHEMATIC ================= */}
        <div className="flex flex-col items-start w-[30%]">
          {/* Target Info Panel */}
          <div className="mb-4 text-xs font-mono space-y-0.5 border-l-2 border-[#ff6c00]/40 pl-3">
            <div className="text-sm font-bold holo-text">COBRA MK III</div>
            <div className="text-[#ffaa00]">PETER WADLEY</div>
            <div className="text-[#ff6c00]/70">COMPETENT</div>
            <div className="text-[#ff5500] font-bold">WANTED</div>
            <div className="text-[#ff6c00]/50 text-[10px] mt-1">ERANIN PEOPLES PARTY</div>
          </div>

          {/* Target Hologram Ring */}
          <div 
            className="relative w-48 h-48 cursor-pointer group"
            onClick={() => setTargetShields((prev) => (prev > 0 ? prev - 1 : 3))}
            title="Click to cycle shield strength"
          >
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {/* Outer boundary indicator rings */}
              <circle cx="100" cy="100" r="90" fill="none" stroke="#ff6c00" strokeWidth="1" strokeDasharray="5,15" className="opacity-40" />
              
              {/* Shields rings (Holographic Blue/Cyan) */}
              {targetShields >= 1 && (
                <path d="M 30,100 A 70,70 0 0,1 170,100" fill="none" stroke="#00b4ff" strokeWidth="3" strokeDasharray="10 3" className="blue-glow transition-all duration-300" />
              )}
              {targetShields >= 2 && (
                <path d="M 22,100 A 78,78 0 0,1 178,100" fill="none" stroke="#00b4ff" strokeWidth="2" strokeDasharray="15 5" className="blue-glow transition-all duration-300 opacity-80" />
              )}
              {targetShields >= 3 && (
                <path d="M 14,100 A 86,86 0 0,1 186,100" fill="none" stroke="#00b4ff" strokeWidth="1" strokeDasharray="2 8" className="blue-glow transition-all duration-300 opacity-60" />
              )}

              {/* Cobra Wireframe (Vector Embedded Concept inside SVG) */}
              <g className="wireframe-target" style={{ transformOrigin: '100px 100px' }}>
                {/* Simulated 3D ship projection via isometric flat coordinates */}
                <polygon points="100,45 155,130 100,110 45,130" fill="none" stroke="#ff6c00" strokeWidth="1.5" className="holo-glow" />
                <line x1="100" y1="45" x2="100" y2="110" stroke="#ff5500" strokeWidth="1" />
                <line x1="72" y1="87" x2="128" y2="87" stroke="#ff6c00" strokeWidth="0.8" />
                {/* Structural engine glow line */}
                <line x1="60" y1="120" x2="140" y2="120" stroke="#ff9f3b" strokeWidth="2" strokeDasharray="4 2" />
              </g>

              {/* Hull integrity arc beneath */}
              <path d="M 45,165 A 75,75 0 0,0 155,165" fill="none" stroke="#ff4500" strokeWidth="4" strokeDasharray="120 120" className="holo-glow" />
              <text x="100" y="190" fill="#ff6c00" fontSize="13" textAnchor="middle" className="font-bold holo-text">
                HULL: {targetShields === 0 ? '42%' : '100%'}
              </text>
            </svg>
            <div className="absolute top-1 left-1 text-[10px] text-sky-400 group-hover:block hidden">Simulate Hit</div>
          </div>
        </div>

        {/* ================= CENTER COLUMN: RADAR / NAV-COMPASS ================= */}
        <div className="flex flex-col items-center justify-end w-[40%] h-full relative">
          
          {/* Nav-Compass (Left Side of central HUD) */}
          <div className="absolute left-2 bottom-36 w-12 h-12">
            <svg viewBox="0 0 50 50" className="w-full h-full holo-glow">
              <circle cx="25" cy="25" r="22" fill="none" stroke="#ff6c00" strokeWidth="1" />
              <circle cx="25" cy="25" r="3" fill="none" stroke="#ff6c00" strokeWidth="1" />
              <line x1="25" y1="2" x2="25" y2="10" stroke="#ff6c00" />
              <line x1="25" y1="40" x2="25" y2="48" stroke="#ff6c00" />
              <line x1="2" y1="25" x2="10" y2="25" stroke="#ff6c00" />
              <line x1="40" y1="25" x2="48" y2="25" stroke="#ff6c00" />
              {/* Target dot (misaligned Nav point) */}
              <circle cx="34" cy="18" r="2.5" fill="#ffaa00" className="animate-ping" />
              <circle cx="34" cy="18" r="2.5" fill="#ffaa00" />
            </svg>
          </div>

          {/* Internal Heat Meter (Right Side of compass / Left of Radar) */}
          <div className="absolute left-16 bottom-24 flex flex-col items-center">
            <span className="text-[10px] text-[#ff6c00]/60">HEAT</span>
            <span className={`text-sm font-bold ${heat > 80 ? 'text-red-500 animate-pulse' : 'text-[#ffaa00]'}`}>
              {heat}%
            </span>
            <div className="w-1.5 h-16 bg-neutral-900 border border-[#ff6c00]/30 relative rounded-sm">
              <div 
                className="absolute bottom-0 w-full bg-gradient-to-t from-[#ff5500] to-[#ffaa00] transition-all duration-300"
                style={{ height: `${heat}%` }}
              />
            </div>
          </div>

          {/* Speed Indicator Slider (Vertical layout right of radar) */}
          <div className="absolute right-6 bottom-24 flex flex-col items-center">
            <span className="text-[10px] text-[#ff6c00]/60">SPD</span>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={speed} 
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="accent-[#ff6c00] h-20 w-1 cursor-col-resize appearance-none bg-neutral-900 border border-[#ff6c00]/30 rounded-sm"
              style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
            />
            <span className="text-xs font-mono font-bold mt-1 text-[#ffaa00]">{speed}</span>
          </div>

          {/* 3D-angled Radar (Scanner) Container */}
          <div 
            className="w-80 h-48 relative overflow-visible" 
            style={{ perspective: '400px' }}
          >
            {/* The tilted radar grid plane */}
            <div 
              className="w-full h-full border border-[#ff6c00]/20 rounded-full transition-transform duration-200"
              style={{ transform: 'rotateX(60deg)', transformStyle: 'preserve-3d' }}
            >
              <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
                {/* Concentric rings */}
                <circle cx="100" cy="100" r="90" fill="none" stroke="#ff6c00" strokeWidth="1" strokeDasharray="3 6" className="opacity-20" />
                <circle cx="100" cy="100" r="65" fill="none" stroke="#ff6c00" strokeWidth="1.5" className="opacity-40" />
                <circle cx="100" cy="100" r="40" fill="none" stroke="#ff6c00" strokeWidth="1" className="opacity-65" />
                <circle cx="100" cy="100" r="15" fill="none" stroke="#ff6c00" strokeWidth="2" className="opacity-80" />

                {/* Radar sweep effect */}
                <circle cx="100" cy="100" r="85" fill="none" stroke="rgba(255,108,0,0.15)" className="radar-sweep" />

                {/* Grid cross lines */}
                <line x1="10" y1="100" x2="190" y2="100" stroke="#ff6c00" strokeWidth="1" className="opacity-30" />
                <line x1="100" y1="10" x2="100" y2="190" stroke="#ff6c00" strokeWidth="1" className="opacity-30" />
                
                {/* Dynamic Radar Contacts (with vertical stalk lines to denote 3D height) */}
                {/* Contact 1 (Hostile - Orange/Red, elevated) */}
                <g className="holo-glow">
                  <line x1="130" y1="60" x2="130" y2="100" stroke="#ff3c00" strokeWidth="1" strokeDasharray="2 2" />
                  <rect x="127" y="55" width="6" height="6" fill="#ff3c00" />
                </g>
                
                {/* Contact 2 (Neutral/Civilian - Yellow, below plane) */}
                <g className="holo-glow">
                  <line x1="70" y1="130" x2="70" y2="100" stroke="#ffaa00" strokeWidth="1" strokeDasharray="2 2" />
                  <polygon points="70,135 74,129 66,129" fill="#ffaa00" />
                </g>

                {/* Center dot (Player Ship position) */}
                <polygon points="100,92 104,105 96,105" fill="#ff8c00" stroke="#fff" strokeWidth="0.5" />
              </svg>
            </div>
            {/* Holographic scanner projection frame labels */}
            <div className="absolute bottom-1 w-full text-center text-[10px] text-[#ff6c00]/40 tracking-widest font-bold">
              10. SCANNER (LINEAR SENSOR RANGE)
            </div>
          </div>
        </div>

        {/* ================= RIGHT WING: SHIP SCHEMATIC & SYS STATUS ================= */}
        <div className="flex flex-col items-end w-[30%]">
          
          {/* Subsystems & Utilities (Mass lock, Landing Gear, etc.) */}
          <div className="mb-4 text-right space-y-1 text-xs">
            <div 
              onClick={() => setIndicators(prev => ({ ...prev, massLocked: !prev.massLocked }))}
              className={`cursor-pointer px-2 py-0.5 rounded border border-neutral-900 transition-all duration-150 ${indicators.massLocked ? 'indicator-active' : 'text-[#ff6c00]/30'}`}
            >
              MASS LOCKED
            </div>
            <div 
              onClick={() => setIndicators(prev => ({ ...prev, landingGear: !prev.landingGear }))}
              className={`cursor-pointer px-2 py-0.5 rounded border border-neutral-900 transition-all duration-150 ${indicators.landingGear ? 'indicator-active' : 'text-[#ff6c00]/30'}`}
            >
              LANDING GEAR
            </div>
            <div 
              onClick={() => setIndicators(prev => ({ ...prev, cargoScoop: !prev.cargoScoop }))}
              className={`cursor-pointer px-2 py-0.5 rounded border border-neutral-900 transition-all duration-150 ${indicators.cargoScoop ? 'indicator-active' : 'text-[#ff6c00]/30'}`}
            >
              CARGO SCOOP
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Interactive Pip Power Distributor */}
            <div className="flex flex-col items-center bg-black/40 p-2 border border-[#ff6c00]/20 rounded">
              <span className="text-[10px] text-[#ff6c00]/40 font-bold mb-1">POWER</span>
              <div className="flex space-x-2">
                {/* SYS */}
                <div onClick={() => adjustPips('sys')} className="flex flex-col items-center cursor-pointer group">
                  <div className="flex flex-col-reverse space-y-reverse space-y-0.5 w-3 h-12 bg-neutral-900">
                    {[...Array(4)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-full h-2.5 transition-all ${i < pips.sys ? 'bg-orange-500 shadow-[0_0_4px_#ff6c00]' : 'bg-transparent'}`} 
                      />
                    ))}
                  </div>
                  <span className="text-[9px] mt-1 text-[#ff6c00]/80 group-hover:text-white">SYS</span>
                </div>

                {/* ENG */}
                <div onClick={() => adjustPips('eng')} className="flex flex-col items-center cursor-pointer group">
                  <div className="flex flex-col-reverse space-y-reverse space-y-0.5 w-3 h-12 bg-neutral-900">
                    {[...Array(4)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-full h-2.5 transition-all ${i < pips.eng ? 'bg-orange-500 shadow-[0_0_4px_#ff6c00]' : 'bg-transparent'}`} 
                      />
                    ))}
                  </div>
                  <span className="text-[9px] mt-1 text-[#ff6c00]/80 group-hover:text-white">ENG</span>
                </div>

                {/* WEP */}
                <div onClick={() => adjustPips('wep')} className="flex flex-col items-center cursor-pointer group">
                  <div className="flex flex-col-reverse space-y-reverse space-y-0.5 w-3 h-12 bg-neutral-900">
                    {[...Array(4)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-full h-2.5 transition-all ${i < pips.wep ? 'bg-orange-500 shadow-[0_0_4px_#ff6c00]' : 'bg-transparent'}`} 
                      />
                    ))}
                  </div>
                  <span className="text-[9px] mt-1 text-[#ff6c00]/80 group-hover:text-white">WEP</span>
                </div>
              </div>
              <button 
                onClick={resetPips} 
                className="text-[8px] mt-2 px-1 border border-[#ff6c00]/40 rounded hover:bg-[#ff6c00]/20 text-[#ffaa00]"
              >
                RST PIP
              </button>
            </div>

            {/* Self Ship Hologram Ring */}
            <div 
              className="relative w-48 h-48 cursor-pointer group"
              onClick={() => setShipShields((prev) => (prev > 0 ? prev - 1 : 3))}
              title="Click to cycle shield strength"
            >
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {/* Shield Arc Rings */}
                {shipShields >= 1 && (
                  <path d="M 30,100 A 70,70 0 0,1 170,100" fill="none" stroke="#00b4ff" strokeWidth="3" strokeDasharray="10 3" className="blue-glow transition-all duration-300" />
                )}
                {shipShields >= 2 && (
                  <path d="M 22,100 A 78,78 0 0,1 178,100" fill="none" stroke="#00b4ff" strokeWidth="2" strokeDasharray="15 5" className="blue-glow transition-all duration-300 opacity-80" />
                )}
                {shipShields >= 3 && (
                  <path d="M 14,100 A 86,86 0 0,1 186,100" fill="none" stroke="#00b4ff" strokeWidth="1" strokeDasharray="2 8" className="blue-glow transition-all duration-300 opacity-60" />
                )}

                {/* Cobra Mk III Ship Schematic */}
                <g className="wireframe-ship" style={{ transformOrigin: '100px 100px' }}>
                  <polygon points="100,50 160,120 100,105 40,120" fill="none" stroke="#ff6c00" strokeWidth="1.5" className="holo-glow" />
                  <line x1="100" y1="50" x2="100" y2="105" stroke="#ff8c00" strokeWidth="1" />
                  <line x1="40" y1="120" x2="100" y2="105" stroke="#ff8c00" strokeWidth="1" />
                  <line x1="160" y1="120" x2="100" y2="105" stroke="#ff8c00" strokeWidth="1" />
                </g>

                {/* Own Hull Integrity (Arc beneath) */}
                <path d="M 45,165 A 75,75 0 0,0 155,165" fill="none" stroke="#ff6c00" strokeWidth="4" strokeDasharray="120 120" className="holo-glow" />
                <text x="100" y="190" fill="#ff6c00" fontSize="13" textAnchor="middle" className="font-bold holo-text">
                  HULL: {shipShields === 0 ? '78%' : '100%'}
                </text>
              </svg>
              <div className="absolute top-1 right-1 text-[10px] text-sky-400 group-hover:block hidden">Simulate Hit</div>
            </div>
          </div>

        </div>
      </div>

      {/* --- FUEL GAUGES & HUD FOOTER --- */}
      <div className="flex justify-between items-center w-full mt-4 border-t border-[#ff6c00]/20 pt-2 text-xs">
        <div>
          <span className="text-[#ff6c00]/40">COCKPIT PERSPECTIVE RADAR V4.0</span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-[#ff6c00]/50">FUEL LAYER</span>
            {/* Simulated segment line fuel indicator */}
            <div className="flex space-x-0.5">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="w-3 h-1.5 bg-[#ff6c00] opacity-80 hover:opacity-100 transition-opacity" />
              ))}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[#ff6c00]/40">SYS STATUS</div>
            <div className="text-green-500 font-bold">ONLINE</div>
          </div>
        </div>
      </div>
    </div>
  );
};