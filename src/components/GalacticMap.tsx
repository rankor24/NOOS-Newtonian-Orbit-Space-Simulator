/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from "react";
import { InterstellarState, StarData, ShipState } from "../types";
import { GALAXY_STARS, SPECTRAL_DETAILS, getOrCreatePlayableStar } from "../data/stars";
import { Map, Rocket, AlertTriangle, Crosshair, Move, ShieldAlert, Compass } from "lucide-react";

type StarPoint = Pick<StarData, "id" | "name" | "className" | "color" | "temp" | "x" | "y" | "radius" | "mass" | "isPopulated" | "description">;

function distanceBetweenStars(a: Pick<StarData, "x" | "y">, b: Pick<StarData, "x" | "y">): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

interface GalacticMapProps {
  ship: ShipState;
  activeStarId: string;
  interstellar: InterstellarState | null;
  onWarpToStar: (starId: string) => void;
  logs: string[];
  credits: number;
  uiTheme?: "amber" | "blue" | "green" | "red";
  compactView?: boolean;
}

export const GalacticMap: React.FC<GalacticMapProps> = ({
  ship,
  activeStarId,
  interstellar,
  onWarpToStar,
  uiTheme = "amber",
  compactView = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Target Selection state
  const [selectedStarId, setSelectedStarId] = useState<string>(activeStarId);
  const activeStar = GALAXY_STARS.find((s) => s.id === activeStarId) || GALAXY_STARS[0];
  const shipGalaxyPosition = interstellar
    ? { x: interstellar.xLy, y: interstellar.yLy }
    : { x: activeStar.x, y: activeStar.y };
  const revealedStars = useMemo(() => {
    return GALAXY_STARS.filter((star) => star.id === activeStarId || distanceBetweenStars(shipGalaxyPosition, star) <= ship.scannerRangeLy);
  }, [activeStarId, shipGalaxyPosition.x, shipGalaxyPosition.y, ship.scannerRangeLy]);
  const targetStar = revealedStars.find((s) => s.id === selectedStarId) || activeStar;
  const targetPlayableStar = useMemo(() => getOrCreatePlayableStar(targetStar.id), [targetStar.id]);
  const detectedBodiesCount = targetPlayableStar?.planets.length ?? 0;

  // Interactive camera coordinates
  const [zoom, setZoom] = useState<number>(0.85); // Light year pixels zoom scale
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredStar, setHoveredStar] = useState<StarPoint | null>(null);

  // Focus lock helper values ("sol", "ship", "target")
  const [focusMode, setFocusMode] = useState<"sol" | "ship" | "target">("ship");

  useEffect(() => {
    if (!revealedStars.some((star) => star.id === selectedStarId)) {
      setSelectedStarId(activeStarId);
    }
  }, [revealedStars, selectedStarId, activeStarId]);

  // Stylized ambient scanner haze.
  // Important: this is NOT real Milky Way topology and should not imply Sol sits at the galactic center.
  const galacticDust = useMemo(() => {
    const pts = [];
    const fieldRadius = 2200;
    for (let i = 0; i < 2600; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * fieldRadius;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      const colRoll = Math.random();
      let color = "rgba(148, 163, 184, 0.18)";
      if (colRoll < 0.15) color = "rgba(251, 191, 36, 0.12)";
      else if (colRoll < 0.35) color = "rgba(56, 189, 248, 0.14)";
      else if (colRoll < 0.5) color = "rgba(168, 85, 247, 0.12)";
      else if (colRoll < 0.58) color = "rgba(244, 63, 94, 0.10)";
      else if (colRoll < 0.7) color = "rgba(255, 255, 255, 0.12)";

      const size = 0.6 + Math.random() * 1.8;
      pts.push({ x, y, color, size });
    }
    return pts;
  }, []);

  // Theme variable palette lookups
  const THEME_HEX = {
    amber: "#f59e0b",
    blue: "#0ea5e9",
    green: "#10b981",
    red: "#f43f5e",
  }[uiTheme];

  const THEME_ACCENT_MUTED = {
    amber: "rgba(245, 158, 11, 0.12)",
    blue: "rgba(14, 165, 233, 0.12)",
    green: "rgba(16, 185, 129, 0.12)",
    red: "rgba(244, 63, 94, 0.12)",
  }[uiTheme];

  // Coordinates solver logic
  const getCameraCenter = () => {
    switch (focusMode) {
      case "sol":
        return { x: 0, y: 0 };
      case "ship":
        return { x: shipGalaxyPosition.x, y: shipGalaxyPosition.y };
      case "target":
        return { x: targetStar.x, y: targetStar.y };
      default:
        return { x: 0, y: 0 };
    }
  };

  const toCanvas = (gx: number, gy: number, width: number, height: number, camCenter: { x: number; y: number }) => {
    const rx = gx - camCenter.x;
    const ry = gy - camCenter.y;
    return {
      x: width / 2 + rx * zoom + pan.x,
      y: height / 2 + ry * zoom + pan.y,
    };
  };

  const toGameCoord = (px: number, py: number, width: number, height: number, camCenter: { x: number; y: number }) => {
    const rx = (px - width / 2 - pan.x) / zoom;
    const ry = (py - height / 2 - pan.y) / zoom;
    return {
      x: camCenter.x + rx,
      y: camCenter.y + ry,
    };
  };

  const getFittedZoom = () => {
    const canvas = canvasRef.current;
    const rect = canvas?.parentElement?.getBoundingClientRect();
    if (!rect) return 32;

    const padding = 0.82;
    const diameterLy = Math.max(ship.scannerRangeLy * 2, ship.maxWarpRange * 2, 1);
    const fitX = (rect.width * padding) / diameterLy;
    const fitY = (rect.height * padding) / diameterLy;
    return Math.max(12, Math.min(80, Math.min(fitX, fitY)));
  };

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Rescale to fill element with high-DPI backing store for crisp rendering
    const rect = canvas.parentElement?.getBoundingClientRect();
    const cssWidth = rect?.width || 600;
    const cssHeight = rect?.height || 400;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const width = cssWidth;
    const height = cssHeight;
    const camCenter = getCameraCenter();

    // Clear background
    ctx.fillStyle = "#090504"; // Obsidian base
    ctx.fillRect(0, 0, width, height);

    // Context anti-aliasing configurations
    ctx.imageSmoothingEnabled = true;

    // 1. Render scanner scale rings based on actual local navigation range
    ctx.strokeStyle = THEME_ACCENT_MUTED;
    ctx.lineWidth = 1;
    const centerPt = toCanvas(0, 0, width, height, camCenter);

    const maxReferenceRadius = Math.max(ship.scannerRangeLy, ship.maxWarpRange, 1);
    const ringSteps = [0.25, 0.5, 0.75, 1];
    ctx.setLineDash([2, 8]);
    ringSteps.forEach((factor) => {
      const ringRadLy = maxReferenceRadius * factor;
      ctx.beginPath();
      ctx.arc(centerPt.x, centerPt.y, ringRadLy * zoom, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.setLineDash([]);

    // Very faint reference grid only at broad scale
    ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
    const sectorSpacingLy = Math.max(2, Math.ceil(maxReferenceRadius / 2));
    const startX = Math.floor(toGameCoord(0, 0, width, height, camCenter).x / sectorSpacingLy) * sectorSpacingLy;
    const endX = Math.ceil(toGameCoord(width, height, width, height, camCenter).x / sectorSpacingLy) * sectorSpacingLy;
    const startY = Math.floor(toGameCoord(0, 0, width, height, camCenter).y / sectorSpacingLy) * sectorSpacingLy;
    const endY = Math.ceil(toGameCoord(width, height, width, height, camCenter).y / sectorSpacingLy) * sectorSpacingLy;

    for (let x = startX; x <= endX; x += sectorSpacingLy) {
      const pt1 = toCanvas(x, startY, width, height, camCenter);
      const pt2 = toCanvas(x, endY, width, height, camCenter);
      ctx.beginPath();
      ctx.moveTo(pt1.x, pt1.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y += sectorSpacingLy) {
      const pt1 = toCanvas(startX, y, width, height, camCenter);
      const pt2 = toCanvas(endX, y, width, height, camCenter);
      ctx.beginPath();
      ctx.moveTo(pt1.x, pt1.y);
      ctx.lineTo(pt2.x, pt2.y);
      ctx.stroke();
    }

    // 2. Keep decorative haze extremely subdued so navigation data stays readable
    if (zoom < 20) {
      galacticDust.forEach((part) => {
        const pt = toCanvas(part.x, part.y, width, height, camCenter);
        if (pt.x >= 0 && pt.x <= width && pt.y >= 0 && pt.y <= height) {
          ctx.fillStyle = part.color;
          ctx.globalAlpha = 0.18;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, part.size * 0.45, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      });
    }

    // 3. Draw scanner reveal boundary around actual ship position
    const shipPt = toCanvas(shipGalaxyPosition.x, shipGalaxyPosition.y, width, height, camCenter);
    const scannerRangePx = ship.scannerRangeLy * zoom;
    ctx.strokeStyle = "rgba(34, 211, 238, 0.22)";
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(shipPt.x, shipPt.y, scannerRangePx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Draw Jump warp rings around actual ship position if capable
    if (ship.warpCapacity) {
      const rangePx = ship.maxWarpRange * zoom;
      ctx.strokeStyle = "rgba(14, 165, 233, 0.18)";
      ctx.fillStyle = "rgba(14, 165, 233, 0.012)";
      ctx.beginPath();
      ctx.arc(shipPt.x, shipPt.y, rangePx, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Dotted outer outline
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = "rgba(14, 165, 233, 0.35)";
      ctx.beginPath();
      ctx.arc(shipPt.x, shipPt.y, rangePx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 5. Draw stellar connections thread between active star and target
    if (activeStarId !== selectedStarId) {
      const p1 = toCanvas(shipGalaxyPosition.x, shipGalaxyPosition.y, width, height, camCenter);
      const p2 = toCanvas(targetStar.x, targetStar.y, width, height, camCenter);
      ctx.lineWidth = 1;
      const isWithinRange = Math.hypot(targetStar.x - shipGalaxyPosition.x, targetStar.y - shipGalaxyPosition.y) <= ship.maxWarpRange;
      ctx.strokeStyle = isWithinRange ? "rgba(34, 197, 94, 0.45)" : "rgba(239, 68, 68, 0.4)";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const placedLabels: Array<{ x: number; y: number; w: number; h: number }> = [];
    const canPlaceLabel = (x: number, y: number, w: number, h: number) => {
      const box = { x, y, w, h };
      const overlaps = placedLabels.some((placed) => (
        box.x < placed.x + placed.w &&
        box.x + box.w > placed.x &&
        box.y < placed.y + placed.h &&
        box.y + box.h > placed.y
      ));
      if (!overlaps) placedLabels.push(box);
      return !overlaps;
    };

    // 6. Draw actual gameplay Star Nodes
    revealedStars.forEach((star) => {
      const pt = toCanvas(star.x, star.y, width, height, camCenter);
      
      const isCurrent = star.id === activeStarId;
      const isTarget = star.id === selectedStarId;
      const isHovered = hoveredStar?.id === star.id;
      const specInfo = SPECTRAL_DETAILS[star.className];

      // Compact scanner-style point rendering
      const starRadius = isCurrent || isTarget ? 3.2 : isHovered ? 2.4 : 1.4;
      const glowRadius = isCurrent || isTarget ? 10 : isHovered ? 6 : 3.2;
      const glowAlpha = isCurrent ? 0.26 : isTarget ? 0.22 : isHovered ? 0.14 : 0.06;
      const grad = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, glowRadius);
      grad.addColorStop(0, `rgba(255,255,255,${Math.min(0.9, glowAlpha + 0.35)})`);
      grad.addColorStop(0.35, specInfo.color);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = glowAlpha;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, glowRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Core point
      ctx.fillStyle = isCurrent ? "#e0f2fe" : specInfo.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, starRadius, 0, Math.PI * 2);
      ctx.fill();

      if (isCurrent || isTarget || isHovered) {
        ctx.strokeStyle = isCurrent ? "#38bdf8" : isTarget ? THEME_HEX : "rgba(255,255,255,0.65)";
        ctx.lineWidth = isCurrent || isTarget ? 1.5 : 1;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, starRadius + 1.8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Render labels only for important stars or when zoomed in enough
      const distanceFromActive = distanceBetweenStars(activeStar, star);
      const isPriorityStar = star.isPopulated || distanceFromActive <= Math.min(ship.maxWarpRange, 2.5);
      const showPrimaryLabel = isCurrent || isTarget || isHovered || (zoom > 42 && isPriorityStar);
      const showSecondaryLabel = isHovered || (zoom > 60 && isPriorityStar);
      if (showPrimaryLabel) {
        ctx.fillStyle = isCurrent ? "#38bdf8" : isTarget ? THEME_HEX : "#cbd5e1";
        ctx.font = isCurrent || isTarget ? "bold 10px monospace" : "9px monospace";
        const labelText = star.name + (isCurrent ? " [LOCAL]" : "");
        const labelX = pt.x + starRadius + 6;
        const labelY = pt.y - 8;
        const primaryWidth = ctx.measureText(labelText).width;
        const primaryHeight = 12;
        const wantsProtectedLabel = isCurrent || isTarget || isHovered;
        if (wantsProtectedLabel || canPlaceLabel(labelX - 1, labelY - primaryHeight + 2, primaryWidth + 2, primaryHeight + (showSecondaryLabel ? 12 : 0))) {
          ctx.fillText(labelText, labelX, labelY + primaryHeight - 1);

          if (showSecondaryLabel) {
            ctx.font = "8px monospace";
            ctx.fillStyle = "rgba(156, 163, 175, 0.78)";
            ctx.fillText(`Class ${star.className} [${Math.round(star.x)}, ${Math.round(star.y)} LY]`, labelX, labelY + primaryHeight + 9);
          }
        }
      }

      // Selection bracket HUD overlay
      if (isTarget) {
        ctx.strokeStyle = THEME_HEX;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const bSize = starRadius + 5;
        // Top Left
        ctx.moveTo(pt.x - bSize, pt.y - bSize + 4);
        ctx.lineTo(pt.x - bSize, pt.y - bSize);
        ctx.lineTo(pt.x - bSize + 4, pt.y - bSize);
        // Top Right
        ctx.moveTo(pt.x + bSize, pt.y - bSize + 4);
        ctx.lineTo(pt.x + bSize, pt.y - bSize);
        ctx.lineTo(pt.x + bSize - 4, pt.y - bSize);
        // Bottom Left
        ctx.moveTo(pt.x - bSize, pt.y + bSize - 4);
        ctx.lineTo(pt.x - bSize, pt.y + bSize);
        ctx.lineTo(pt.x - bSize + 4, pt.y + bSize);
        // Bottom Right
        ctx.moveTo(pt.x + bSize, pt.y + bSize - 4);
        ctx.lineTo(pt.x + bSize, pt.y + bSize);
        ctx.lineTo(pt.x + bSize - 4, pt.y + bSize);
        ctx.stroke();
      }

      // Local frame halo. In deep space this marks origin, not ship.
      if (isCurrent) {
        ctx.strokeStyle = interstellar ? "rgba(148, 163, 184, 0.22)" : "rgba(14, 165, 233, 0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, starRadius + 8 + Math.sin(Date.now() / 150) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // 7. Draw actual ship marker after stars so deep-space position is visible
    ctx.save();
    ctx.translate(shipPt.x, shipPt.y);
    ctx.rotate(ship.heading);
    ctx.fillStyle = interstellar ? "#22d3ee" : "#38bdf8";
    ctx.strokeStyle = "rgba(255,255,255,0.75)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = interstellar ? "rgba(34, 211, 238, 0.45)" : "rgba(14, 165, 233, 0.3)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(shipPt.x, shipPt.y, 10 + Math.sin(Date.now() / 130) * 1.8, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = interstellar ? "#22d3ee" : "#38bdf8";
    ctx.font = "bold 9px monospace";
    ctx.fillText(interstellar ? "SHIP [DEEP SPACE]" : "SHIP", shipPt.x + 12, shipPt.y - 8);

    // 8. Draw clean scale bar away from the HUD block
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const barWidthPx = 100;
    const bottomY = height - 18;
    const barStartX = width - barWidthPx - 24;
    ctx.moveTo(barStartX, bottomY);
    ctx.lineTo(barStartX + barWidthPx, bottomY);
    ctx.moveTo(barStartX, bottomY - 3);
    ctx.lineTo(barStartX, bottomY + 3);
    ctx.moveTo(barStartX + barWidthPx, bottomY - 3);
    ctx.lineTo(barStartX + barWidthPx, bottomY + 3);
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "9px monospace";
    const lyVal = barWidthPx / zoom;
    ctx.textAlign = "right";
    ctx.fillText(`${lyVal.toFixed(1)} LY`, barStartX + barWidthPx, bottomY - 6);
    ctx.textAlign = "left";

  }, [galacticDust, zoom, pan, focusMode, selectedStarId, activeStarId, hoveredStar, uiTheme, revealedStars, ship.scannerRangeLy, ship.maxWarpRange, ship.warpCapacity, ship.heading, shipGalaxyPosition.x, shipGalaxyPosition.y, interstellar]);

  // Handle canvas mouse operations
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const camCenter = getCameraCenter();

    // Search nearest star within 28px
    let foundId: string | null = null;
    let mindist = 28;

    revealedStars.forEach((star) => {
      const pt = toCanvas(star.x, star.y, canvas.width, canvas.height, camCenter);
      const dist = Math.hypot(pt.x - px, pt.y - py);
      if (dist < mindist) {
        mindist = dist;
        foundId = star.id;
      }
    });

    if (foundId) {
      setSelectedStarId(foundId);
      setFocusMode("target");
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragStart({ x: e.clientX, y: e.clientY });
    } else {
      // Hover detection
      const camCenter = getCameraCenter();
      let hoverStarFound: StarPoint | null = null;
      revealedStars.forEach((star) => {
        const pt = toCanvas(star.x, star.y, canvas.width, canvas.height, camCenter);
        const dist = Math.hypot(pt.x - px, pt.y - py);
        if (dist < 22) {
          hoverStarFound = star;
        }
      });
      setHoveredStar(hoverStarFound);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const resetCamera = () => {
    setPan({ x: 0, y: 0 });
    setZoom(getFittedZoom());
  };

  useEffect(() => {
    setZoom(getFittedZoom());
    setPan({ x: 0, y: 0 });
  }, [activeStarId, ship.scannerRangeLy, ship.maxWarpRange]);

  // Attach non-passive wheel event detector to support mouse coordinate targeting
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const camCenter = getCameraCenter();
      const zoomFactor = -e.deltaY * 0.0018;
      setZoom((prev) => {
        const next = Math.max(12, Math.min(160, prev * Math.exp(zoomFactor)));

        const worldX = camCenter.x + (px - canvas.width / 2 - pan.x) / prev;
        const worldY = camCenter.y + (py - canvas.height / 2 - pan.y) / prev;

        const nextPanX = px - canvas.width / 2 - (worldX - camCenter.x) * next;
        const nextPanY = py - canvas.height / 2 - (worldY - camCenter.y) * next;
        setPan({ x: nextPanX, y: nextPanY });

        return next;
      });
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [pan, focusMode, activeStar.x, activeStar.y, targetStar.x, targetStar.y, shipGalaxyPosition.x, shipGalaxyPosition.y]);

  // metrics
  const lx = targetStar.x - shipGalaxyPosition.x;
  const ly = targetStar.y - shipGalaxyPosition.y;
  const distanceLY = Math.hypot(lx, ly);
  const revealedStarCount = revealedStars.length;

  const warpEngineEquipped = ship.warpCapacity;
  const inRange = distanceLY <= ship.maxWarpRange;
  const he3FuelCount = ship.cargo["he3"] || 0;
  const hasHe3 = he3FuelCount >= 1;
  const isSelf = targetStar.id === activeStar.id;

  const handleWarpJump = () => {
    if (isSelf || !warpEngineEquipped || !inRange || !hasHe3) return;
    onWarpToStar(targetStar.id);
  };

  return (
    <div className={`${compactView ? "galactic-map-compact" : "grid grid-cols-1 lg:grid-cols-3 gap-6"} font-mono text-slate-200`}>
      
      {/* Canvas column */}
      <div className={`${compactView ? "h-full" : "lg:col-span-2 h-[20rem] sm:h-[24rem] lg:h-[26rem] xl:h-[30rem]"} bg-stone-900 border border-stone-800 rounded-xl p-3 sm:p-4 flex flex-col relative overflow-hidden shadow-2xl`}>
        
        {/* Top HUD options toolbar */}
        <div className="flex flex-wrap gap-2 justify-between items-center mb-3 z-10">
          <div className="flex items-center gap-1.5 bg-stone-950/80 backdrop-blur border border-stone-800 p-1 rounded-lg text-xs">
            <span className="text-stone-500 px-1 font-bold text-[9px] uppercase tracking-wider">NAV TARGET FOCUS:</span>
            <button
              id="galaxy-focus-sol"
              onClick={() => { setFocusMode("sol"); resetCamera(); }}
              className={`px-2 py-1 rounded text-[10px] uppercase font-bold transition ${focusMode === "sol" ? "bg-amber-500 text-stone-950" : "text-stone-400 hover:text-white"}`}
            >
              Sol Core
            </button>
            <button
              id="galaxy-focus-ship"
              onClick={() => { setFocusMode("ship"); resetCamera(); }}
              className={`px-2 py-1 rounded text-[10px] uppercase font-bold transition ${focusMode === "ship" ? "bg-sky-500 text-stone-950" : "text-stone-400 hover:text-white"}`}
            >
              Ship
            </button>
            <button
              id="galaxy-focus-target"
              onClick={() => { setFocusMode("target"); resetCamera(); }}
              className={`px-2 py-1 rounded text-[10px] uppercase font-bold transition ${focusMode === "target" ? "bg-orange-500 text-stone-950" : "text-stone-400 hover:text-white"}`}
            >
              Target ({targetStar.name})
            </button>
          </div>

          <div className="flex items-center gap-2 bg-stone-950/80 backdrop-blur border border-stone-800 px-2 py-1.5 rounded-lg text-xs">
            <span className="text-stone-500 text-[9px] font-bold uppercase tracking-wider">ZOOM:</span>
            <span className="text-white font-bold text-[10px]">{zoom.toFixed(2)}x</span>
            <button
              id="reset-galaxy-camera-btn"
              onClick={resetCamera}
              title="Reset Zoom & Pan"
              className="p-1 rounded bg-stone-900 hover:bg-stone-800 hover:text-white text-stone-400 transition"
            >
              <Move className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Space navigation viewport */}
        <div className="flex-grow w-full border border-stone-800 rounded-lg relative overflow-hidden bg-stone-950">
          <canvas
            id="galactic-cartography-canvas"
            ref={canvasRef}
            onClick={handleCanvasClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={() => setIsDragging(false)}
            onMouseLeave={() => setIsDragging(false)}
            className="w-full h-full cursor-grab active:cursor-grabbing"
          />

          {/* Compass layout details overlay */}
          <div className="absolute bottom-2 left-3 pointer-events-none text-[9px] text-stone-500 bg-stone-950/80 border border-stone-900 p-1.5 rounded font-mono uppercase tracking-widest leading-relaxed flex flex-col gap-0.5">
            <span>● Stylized scanner haze — not real galaxy topology</span>
            <span>● Scanner reveal radius: {ship.scannerRangeLy.toFixed(1)} LY</span>
            <span>● Visible stars in range: {revealedStarCount}</span>
            <span>● SCROLL TO ZOOM UNDER CURSOR</span>
            <span>● DRAG PAN TO PLOT HYPER JUMPS</span>
          </div>
        </div>
      </div>

      {/* Star Node Summary Panel */}
      {!compactView && (
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 xl:p-5 flex flex-col justify-between shadow-2xl relative lg:max-h-[26rem] xl:max-h-[30rem] lg:overflow-y-auto">
        <div>
          {/* Header */}
          <div className="border-b border-stone-800 pb-3.5 mb-4">
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest block mb-1">
              Cartographic Node Analysis
            </span>
            <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2 font-mono">
              {targetStar.name}
              <span className="text-xs bg-stone-800 text-stone-300 px-2.5 py-0.5 rounded font-bold font-mono">
                Class {targetStar.className}
              </span>
            </h3>
          </div>

          {/* Body stats */}
          <div className="space-y-3.5 text-xs">
            <p className="italic text-stone-400 text-[11px] leading-relaxed">
              "{targetStar.description}"
            </p>

            <div className="bg-stone-950/70 border border-stone-800 rounded-lg p-2.5 text-[10px] text-stone-500 leading-relaxed">
              Background haze is a stylized scanner visualization. Star nodes and LY coordinates are gameplay data; the haze itself is not a real Milky Way map.
              Current survey radius: <span className="text-sky-400 font-semibold">{ship.scannerRangeLy.toFixed(1)} LY</span> around {activeStar.name}.
            </div>

            {/* Core statistics */}
            <div className="bg-stone-950 border border-stone-850 rounded-lg p-3 space-y-2 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-stone-500">Relative Type:</span>
                <span className="text-white font-bold">{SPECTRAL_DETAILS[targetStar.className].desc}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Star Diameter:</span>
                <span className="text-amber-400 font-bold">{targetStar.radius.toFixed(2)} R☉</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Surface Temp:</span>
                <span className="text-orange-400 font-semibold">{targetStar.temp.toLocaleString()} Kelvin</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Planetary Orbits:</span>
                <span className="text-indigo-400 font-bold">{detectedBodiesCount} bodies detected</span>
              </div>
              <div className="flex justify-between border-t border-stone-900/60 pt-2 text-[10.5px]">
                <span className="text-stone-500">S-Coord LY:</span>
                <span className="text-stone-400">
                  [{Math.round(targetStar.x)}, {Math.round(targetStar.y)}]
                </span>
              </div>
            </div>

            {/* Hyper resonance engine parameters */}
            <div className="bg-stone-950 border border-stone-850 rounded-lg p-3 space-y-2 font-mono text-[11px]">
              <div className="text-[10px] text-stone-500 uppercase font-bold tracking-wider mb-0.5">
                WARPFOLD CORE VECTORS
              </div>
              
              <div className="flex justify-between">
                <span className="text-stone-400">Jump distance:</span>
                <span className="text-slate-200">
                  {isSelf ? "0.00" : distanceLY.toFixed(2)} Light Years
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-stone-400">Armed engine range:</span>
                <span className={`font-bold ${warpEngineEquipped ? "text-emerald-400 animate-pulse" : "text-stone-500"}`}>
                  {ship.maxWarpRange.toFixed(1)} LY
                </span>
              </div>

              <div className="flex justify-between items-center border-t border-stone-900 pt-1.5">
                <span className="text-stone-400">Helium-3 heavy atom:</span>
                <span className={`font-bold ${hasHe3 ? "text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" : "text-rose-450"}`}>
                  {he3FuelCount} / 1 Refined Cell
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Warp Controls launchpad footer */}
        <div className="mt-6 border-t border-stone-800 pt-4 font-mono">
          {isSelf ? (
            <div className="bg-sky-950/20 text-sky-400 border border-sky-900/40 p-2.5 rounded text-[11px] text-center font-semibold">
              ✓ Ship is actively parked inside this coordinate sector envelope.
            </div>
          ) : !warpEngineEquipped ? (
            <div className="bg-rose-950/20 border border-rose-900/40 p-3 rounded-lg flex items-start gap-2 text-rose-300 text-[11px]">
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              <div>
                <p className="font-bold">No Interstellar Warp Drive Installed</p>
                <p className="text-stone-500 text-[10px] mt-0.5">Integrate Hyper-Resonant Warp crystals from the shipyard to trigger spacetime folding jumps.</p>
              </div>
            </div>
          ) : !inRange ? (
            <div className="bg-rose-950/20 border border-rose-900/40 p-3 rounded-lg flex items-start gap-2 text-rose-300 text-[11px]">
              <ShieldAlert className="w-5 h-5 shrink-0 text-yellow-500" />
              <div>
                <p className="font-bold text-yellow-400">Target Core Out of Range</p>
                <p className="text-stone-500 text-[10px] mt-0.5">Warp coordinate exceeds max engine envelope. Purchase better stellar drives or jump to closer intermediate stars.</p>
              </div>
            </div>
          ) : !hasHe3 ? (
            <div className="bg-rose-950/10 border border-stone-800 p-3 rounded-lg flex items-start gap-2 text-yellow-300 text-[11px]">
              <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-500" />
              <div>
                <p className="font-bold">Spacetime fold requires 1 He-3 Unit</p>
                <p className="text-stone-500 text-[10px] mt-0.5">Folding requires refined heavy Helium isotopes. Gas giants atmospheres can be mined, or buy units from trade stations.</p>
              </div>
            </div>
          ) : (
            <button
              id="initiate-warp-jump-btn"
              onClick={handleWarpJump}
              className={`w-full text-[11px] font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition duration-200 active:scale-95 shadow-lg border cursor-pointer ${
                uiTheme === "amber"
                  ? "bg-amber-500 text-stone-950 select-none hover:bg-amber-400 hover:shadow-amber-500/10 border-amber-500"
                  : uiTheme === "blue"
                  ? "bg-sky-500 text-stone-950 select-none hover:bg-sky-400 hover:shadow-sky-500/10 border-sky-500"
                  : uiTheme === "green"
                  ? "bg-emerald-500 text-stone-950 select-none hover:bg-emerald-400 hover:shadow-emerald-500/10 border-emerald-500"
                  : "bg-rose-600 text-white select-none hover:bg-rose-500 hover:shadow-rose-500/10 border-rose-600"
              }`}
            >
              <Rocket className="w-4 h-4" /> ACTIVATE HYPERSPACE CAPTURE JUMP
            </button>
          )}
        </div>
      </div>
      )}

    </div>
  );
};
