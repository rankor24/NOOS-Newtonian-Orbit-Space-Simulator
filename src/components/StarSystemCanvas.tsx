/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Compass, Crosshair, Move, Zap } from "lucide-react";
import { CelestialBody, ShipState, SystemFeature } from "../types";
import { getAbsoluteBodyPosition, getSphereOfInfluence, predictShipRoute, buildBodyPositionCache, getCachedPosition, BodyPosCache } from "../utils/physics";

interface CanvasProps {
  bodies: CelestialBody[];
  ship: ShipState;
  selectedBodyId: string | null;
  onSelectBody: (id: string | null) => void;
  gameTime: number;
  isThrusting: boolean;
  miningActive: boolean;
  miningTargetId: string | null;
  starColor: string;
  systemFeatures?: SystemFeature[];
  uiTheme?: "amber" | "blue" | "green" | "red";
  cameraModeOverride?: "ship" | "target" | "star";
  hideCameraControls?: boolean;
}
type AutopilotMode = "none" | "match-speed" | "circularize" | "align-target" | "approach-target";

type CameraMode = "ship" | "target" | "star";
type Point = { x: number; y: number };

const AU = 1.496e11;
const MIN_ZOOM_EXPONENT = -14;
const MAX_ZOOM_EXPONENT = -2.5;
const DEFAULT_ZOOM_EXPONENT = -9;
const SUN_RADIUS_METERS = 6.96e8;

const GRID_STEPS_AU = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 250, 500, 1000, 2500];

const THEME = {
  amber: {
    accent: "#f59e0b",
    grid: "rgba(245, 158, 11, 0.13)",
    bg: "#070504",
    ship: "#38bdf8",
  },
  blue: {
    accent: "#38bdf8",
    grid: "rgba(56, 189, 248, 0.13)",
    bg: "#030711",
    ship: "#38bdf8",
  },
  green: {
    accent: "#10b981",
    grid: "rgba(16, 185, 129, 0.13)",
    bg: "#010603",
    ship: "#34d399",
  },
  red: {
    accent: "#f43f5e",
    grid: "rgba(244, 63, 94, 0.13)",
    bg: "#0a0103",
    ship: "#fb7185",
  },
};

const MAJOR_MOONS = new Set([
  "Moon",
  "Phobos",
  "Deimos",
  "Io",
  "Europa",
  "Ganymede",
  "Callisto",
  "Amalthea",
  "Thebe",
  "Adrastea",
  "Metis",
  "Mimas",
  "Enceladus",
  "Tethys",
  "Dione",
  "Rhea",
  "Titan",
  "Hyperion",
  "Iapetus",
  "Phoebe",
  "Miranda",
  "Ariel",
  "Umbriel",
  "Titania",
  "Oberon",
  "Puck",
  "Triton",
  "Nereid",
  "Proteus",
  "Charon",
  "Styx",
  "Nix",
  "Kerberos",
  "Hydra",
]);

const PRIORITY_SMALL_BODIES = new Set([
  "Ceres",
  "Vesta",
  "Pallas",
  "Hygiea",
  "Pluto",
  "Eris",
  "Haumea",
  "Makemake",
  "Orcus",
  "Quaoar",
  "Sedna",
  "Arrokoth",
]);

/** Matches IAU provisional moon designations: S2001_J_3, S2023_S_15, S2025_U_1, etc. */
function isDesignationMoonName(name: string): boolean {
  return /^S\d{4}_[JSUN]_\d+$/.test(name);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clampZoomExponent(value: number) {
  return clamp(value, MIN_ZOOM_EXPONENT, MAX_ZOOM_EXPONENT);
}

function formatDistanceMeters(value: number) {
  const abs = Math.abs(value);
  if (abs >= AU * 0.1) return `${(value / AU).toFixed(2)} AU`;
  if (abs >= 1e6) return `${Math.round(value / 1e6).toLocaleString()} Mm`;
  return `${Math.round(value / 1000).toLocaleString()} km`;
}

/** LOD body sizing: always proportional to real radius × zoom.
 *  Floor based on log(radius) so bigger bodies get slightly bigger
 *  minimum dots — hierarchy visible at any zoom. Real proportions
 *  emerge naturally as you zoom in and realPx overtakes the floor. */
function getBodyDisplayRadius(body: CelestialBody, scale: number): number {
  const realR = Math.max(0, body.radius ?? 0);
  const realPx = realR * scale;

  // Log-scale floor: 100 m → 0.8 px, 100,000 km → 2.8 px
  const logR = Math.log10(Math.max(realR, 100));
  const t = clamp((logR - 2) / 6, 0, 1);
  const floor = 0.8 + t * 2.0;

  return clamp(Math.max(realPx, floor), 0.8, 400);
}

function shouldAlwaysRevealBody(body: CelestialBody) {
  if (!body.parentId) return true;
  if (body.parentId === "star_sol" && body.type !== "asteroid" && body.type !== "comet") return true;
  if (body.type === "moon" && !isDesignationMoonName(body.name)) return true;
  return PRIORITY_SMALL_BODIES.has(body.name) || !!body.stationName;
}

export const StarSystemCanvas: React.FC<CanvasProps> = ({
  bodies,
  ship,
  selectedBodyId,
  onSelectBody,
  gameTime,
  isThrusting,
  miningActive,
  miningTargetId,
  starColor,
  systemFeatures = [],
  uiTheme = "blue",
  cameraModeOverride,
  hideCameraControls = false,
  autopilotMode = "none",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomExponent, setZoomExponent] = useState(DEFAULT_ZOOM_EXPONENT);
  const [cameraMode, setCameraMode] = useState<CameraMode>("star");
  const [cameraCenter, setCameraCenter] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [hoveredBodyId, setHoveredBodyId] = useState<string | null>(null);
  const dragMovedRef = useRef(false);
  const drawCacheRef = useRef<BodyPosCache>(new Map());
  const routeFrameCounter = useRef(0);

  const getBodyPos = (bodyId: string): Point => {
    const cached = drawCacheRef.current.get(bodyId);
    if (cached) return cached;
    return getAbsoluteBodyPosition(bodyId, bodies, gameTime);
  };

  const palette = THEME[uiTheme];
  const scale = Math.pow(10, zoomExponent);
  const selectedBody = selectedBodyId ? bodies.find((body) => body.id === selectedBodyId) ?? null : null;

  const getFocusCenter = (mode: CameraMode): Point => {
    if (mode === "ship") return { x: ship.x, y: ship.y };
    if (mode === "target" && selectedBodyId) {
      return getBodyPos(selectedBodyId);
    }
    return { x: 0, y: 0 };
  };

  useEffect(() => {
    if (!cameraModeOverride) return;
    setCameraMode(cameraModeOverride);
    setCameraCenter(getFocusCenter(cameraModeOverride));
  }, [cameraModeOverride]);

  const revealedBodyIds = useMemo(() => {
    const visible = new Set<string>();

    for (const body of bodies) {
      if (!body.parentId) {
        visible.add(body.id);
        continue;
      }

      const isSelected = body.id === selectedBodyId;
      const isMiningTarget = body.id === miningTargetId;
      const isChildOfSelected = body.parentId === selectedBodyId;
      const isAlwaysRevealed = shouldAlwaysRevealBody(body);
      const isKnownMoon = body.type === "moon" && MAJOR_MOONS.has(body.name);
      const absPos = getBodyPos(body.id);
      const inScannerRange = Math.hypot(ship.x - absPos.x, ship.y - absPos.y) <= ship.systemScannerRange;

      if (isAlwaysRevealed || isKnownMoon || isSelected || isMiningTarget || isChildOfSelected || inScannerRange) {
        visible.add(body.id);
        visible.add(body.parentId);
      }
    }

    return visible;
  }, [bodies, gameTime, miningTargetId, selectedBodyId, ship.systemScannerRange, ship.x, ship.y]);

  const toScreen = (world: Point, center: Point, width: number, height: number, currentScale = scale): Point => ({
    x: width / 2 + (world.x - center.x) * currentScale,
    y: height / 2 + (world.y - center.y) * currentScale,
  });

  const toWorld = (screen: Point, center: Point, width: number, height: number, currentScale = scale): Point => ({
    x: center.x + (screen.x - width / 2) / currentScale,
    y: center.y + (screen.y - height / 2) / currentScale,
  });

  const getCanvasViewport = () => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    return {
      width: rect?.width || canvas?.clientWidth || 800,
      height: rect?.height || canvas?.clientHeight || 500,
    };
  };

  const resetView = () => {
    setCameraCenter(getFocusCenter(cameraMode));
  };

  const setMode = (mode: CameraMode) => {
    if (mode === "target" && !selectedBodyId) return;
    setCameraMode(mode);
    setCameraCenter(getFocusCenter(mode));
  };

  const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    for (let i = 0; i < 90; i += 1) {
      const x = (i * 97) % width;
      const y = (i * 173) % height;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.restore();
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, center: Point, width: number, height: number) => {
    const stepAu = GRID_STEPS_AU.find((candidate) => candidate * AU * scale >= 56) ?? GRID_STEPS_AU[GRID_STEPS_AU.length - 1];
    const stepMeters = stepAu * AU;
    const topLeft = toWorld({ x: 0, y: 0 }, center, width, height);
    const bottomRight = toWorld({ x: width, y: height }, center, width, height);
    const startX = Math.floor(topLeft.x / stepMeters) * stepMeters;
    const endX = Math.ceil(bottomRight.x / stepMeters) * stepMeters;
    const startY = Math.floor(topLeft.y / stepMeters) * stepMeters;
    const endY = Math.ceil(bottomRight.y / stepMeters) * stepMeters;

    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x <= endX; x += stepMeters) {
      const pt = toScreen({ x, y: 0 }, center, width, height);
      ctx.moveTo(pt.x, 0);
      ctx.lineTo(pt.x, height);
    }
    for (let y = startY; y <= endY; y += stepMeters) {
      const pt = toScreen({ x: 0, y }, center, width, height);
      ctx.moveTo(0, pt.y);
      ctx.lineTo(width, pt.y);
    }
    ctx.stroke();

    ctx.fillStyle = "rgba(226,232,240,0.48)";
    ctx.font = "10px ui-monospace, SFMono-Regular, Consolas, monospace";
    ctx.fillText(`GRID ${stepAu < 1 ? stepAu.toFixed(2) : stepAu.toFixed(0)} AU`, 14, height - 14);
  };

  const drawFeature = (ctx: CanvasRenderingContext2D, feature: SystemFeature, center: Point, width: number, height: number) => {
    const parentPos = feature.parentId
      ? getBodyPos(feature.parentId)
      : { x: 0, y: 0 };
    const pt = toScreen(parentPos, center, width, height);
    const inner = feature.innerRadius * scale;
    const outer = feature.outerRadius * scale;
    const viewportRadius = Math.hypot(width, height) / 2;
    const featureCenterDist = Math.hypot(pt.x - width / 2, pt.y - height / 2);
    const annulusCanTouchViewport = outer >= featureCenterDist - viewportRadius && inner <= featureCenterDist + viewportRadius;
    if (outer < 2 || !annulusCanTouchViewport) return;

    ctx.save();
    ctx.globalAlpha = feature.opacity ?? 0.28;
    ctx.strokeStyle = feature.labelColor || feature.color;
    ctx.fillStyle = feature.color;
    ctx.lineWidth = feature.type === "ring" ? 2 : 1;
    ctx.setLineDash(feature.type === "ring" ? [] : [8, 8]);

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, outer, 0, Math.PI * 2);
    if (inner > 1) ctx.arc(pt.x, pt.y, inner, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    const labelRadius = clamp((inner + outer) / 2, 18, Math.max(width, height) * 1.4);
    const labelAngle = feature.type === "ring" ? -0.72 : -0.42;
    const labelX = pt.x + Math.cos(labelAngle) * labelRadius;
    const labelY = pt.y + Math.sin(labelAngle) * labelRadius;
    const labelInView = labelX > -120 && labelX < width + 120 && labelY > -80 && labelY < height + 80;
    const shouldLabel = labelInView && (outer > 26 || feature.type !== "ring");
    if (shouldLabel) {
      ctx.save();
      ctx.fillStyle = feature.labelColor || "rgba(226,232,240,0.75)";
      ctx.font = feature.type === "ring"
        ? "bold 10px ui-monospace, SFMono-Regular, Consolas, monospace"
        : "10px ui-monospace, SFMono-Regular, Consolas, monospace";
      ctx.fillText(feature.name.toUpperCase(), labelX, labelY);
      ctx.restore();
    }
  };

  const drawOrbit = (ctx: CanvasRenderingContext2D, body: CelestialBody, center: Point, width: number, height: number) => {
    if (!body.parentId) return;
    const parentPos = getBodyPos(body.parentId);
    const orbitRadiusPx = body.semiMajorAxis * scale;
    const selected = body.id === selectedBodyId;
    const moonTooSmall = body.type === "moon" && orbitRadiusPx < 8 && !selected;
    const designationOrbitTooSmall = body.type === "moon" && isDesignationMoonName(body.name) && orbitRadiusPx < 32 && !selected;
    const asteroidTooSmall = body.type === "asteroid" && orbitRadiusPx < 5 && !selected;
    if (moonTooSmall || designationOrbitTooSmall || asteroidTooSmall) return;

    ctx.strokeStyle = selected ? palette.accent : "rgba(148,163,184,0.20)";
    ctx.lineWidth = selected ? 1.5 : 1;
    ctx.setLineDash(selected ? [] : [4, 8]);
    ctx.beginPath();

    const steps = 96;
    for (let i = 0; i <= steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2;
      const ellipseX = body.semiMajorAxis * (Math.cos(angle) - body.eccentricity);
      const ellipseY = body.semiMajorAxis * Math.sqrt(1 - body.eccentricity * body.eccentricity) * Math.sin(angle);
      const cos = Math.cos(body.argumentOfPeriapsis);
      const sin = Math.sin(body.argumentOfPeriapsis);
      const world = {
        x: parentPos.x + ellipseX * cos - ellipseY * sin,
        y: parentPos.y + ellipseX * sin + ellipseY * cos,
      };
      const pt = toScreen(world, center, width, height);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }

    ctx.stroke();
    ctx.setLineDash([]);
  };

  const drawBody = (ctx: CanvasRenderingContext2D, body: CelestialBody, center: Point, width: number, height: number) => {
    const world = getBodyPos(body.id);
    const pt = toScreen(world, center, width, height);
    const radius = getBodyDisplayRadius(body, scale);
    const selected = body.id === selectedBodyId;
    const hovered = body.id === hoveredBodyId;
    const prioritySmallBody = PRIORITY_SMALL_BODIES.has(body.name);
    const majorMoon = body.type === "moon" && MAJOR_MOONS.has(body.name);

    if (pt.x < -160 || pt.x > width + 160 || pt.y < -160 || pt.y > height + 160) return;

    if (body.type === "moon" && !selected && !hovered && !majorMoon && body.parentId) {
      const parentPt = toScreen(getBodyPos(body.parentId), center, width, height);
      const parentSeparation = Math.hypot(pt.x - parentPt.x, pt.y - parentPt.y);
      const isDesignation = isDesignationMoonName(body.name);
      const minSep = isDesignation ? 24 : 12;
      const minScale = isDesignation ? 3e-9 : 8e-11;
      if (parentSeparation < minSep || scale < minScale) return;
    }

    if ((body.type === "asteroid" || body.type === "comet") && !selected && !hovered && !prioritySmallBody && scale < 2e-10) {
      return;
    }

    const glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius * 3.2);
    glow.addColorStop(0, body.color);
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.globalAlpha = selected || hovered ? 0.5 : 0.22;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius * 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = body.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = selected ? palette.accent : hovered ? "#e2e8f0" : "rgba(255,255,255,0.35)";
    ctx.lineWidth = selected ? 2 : 1;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius + (selected ? 8 : 4), 0, Math.PI * 2);
    ctx.stroke();

    const isDesignation = body.type === "moon" && isDesignationMoonName(body.name);
    // LOD label rules: at wide zoom only planets/dwarf planets get names.
    // Zoom in to reveal moons then small bodies then stations.
    const shouldLabelBody =
      selected ||
      hovered ||
      body.type === "planet" ||
      body.type === "dwarfPlanet" ||
      (majorMoon && scale > 3e-9) ||
      (prioritySmallBody && scale > 1e-9) ||
      (!isDesignation && body.type !== "asteroid" && scale > 3e-9);

    if (shouldLabelBody) {
      ctx.fillStyle = selected ? palette.accent : "#e2e8f0";
      ctx.font = selected ? "bold 11px system-ui, sans-serif" : "11px system-ui, sans-serif";
      ctx.fillText(body.name, pt.x + radius + 8, pt.y + 4);
      if (body.stationName && scale > 5e-9) {
        ctx.fillStyle = "#a78bfa";
        ctx.font = "9px ui-monospace, SFMono-Regular, Consolas, monospace";
        ctx.fillText(body.stationName, pt.x + radius + 8, pt.y + 16);
      }
    }

    if (body.type === "planet" && selected) {
      const soi = getSphereOfInfluence(body) * scale;
      if (soi > 16 && soi < Math.max(width, height) * 4) {
        ctx.strokeStyle = "rgba(34,197,94,0.22)";
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, soi, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  };

  const drawShip = (ctx: CanvasRenderingContext2D, center: Point, width: number, height: number) => {
    const pt = toScreen({ x: ship.x, y: ship.y }, center, width, height);

    ctx.save();
    ctx.translate(pt.x, pt.y);
    ctx.rotate(ship.heading);
    ctx.fillStyle = palette.ship;
    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -6);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (isThrusting && ship.fuelLevel > 0) {
      ctx.fillStyle = "rgba(249,115,22,0.8)";
      ctx.beginPath();
      ctx.moveTo(-8, -3);
      ctx.lineTo(-24, 0);
      ctx.lineTo(-8, 3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    const velocityScale = 240 * scale;
    ctx.strokeStyle = "rgba(56,189,248,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.lineTo(pt.x + ship.vx * velocityScale, pt.y + ship.vy * velocityScale);
    ctx.stroke();

    ctx.fillStyle = palette.ship;
    ctx.font = "bold 10px ui-monospace, SFMono-Regular, Consolas, monospace";
    ctx.fillText("SHIP", pt.x + 12, pt.y - 10);
  };

  const drawRoute = (ctx: CanvasRenderingContext2D, center: Point, width: number, height: number) => {
    // Throttle: only recompute route every 10 frames for performance
    routeFrameCounter.current++;
    if (routeFrameCounter.current % 10 !== 0) return;

    // Compute effective throttle and heading for route prediction based on autopilot mode.
    // The route trace should reflect where the autopilot is actually steering, not just coasting.
    let routeThrottle = 0;
    let routeHeading = ship.heading;

    if (autopilotMode === "approach-target" && selectedBodyId) {
      const targetBody = bodies.find((b) => b.id === selectedBodyId);
      if (targetBody) {
        const targetPos = getBodyPos(targetBody.id);
        const dx = ship.x - targetPos.x;
        const dy = ship.y - targetPos.y;
        const dist = Math.hypot(dx, dy);
        // Approximate target velocity numerically
        const p1 = getBodyPos(targetBody.id);
        const p2 = getAbsoluteBodyPosition(targetBody.id, bodies, gameTime + 1);
        const targetVx = p2.x - p1.x;
        const targetVy = p2.y - p1.y;
        const relVx = ship.vx - targetVx;
        const relVy = ship.vy - targetVy;
        const relSpeed = Math.hypot(relVx, relVy);
        const bodyRadius = targetBody.radius ?? 0;
        const altitude = Math.max(0, dist - bodyRadius);
        // Simple braking distance estimate (surface-relative)
        const shipMass = ship.dryMass + ship.fuelLevel;
        const maxDecel = ship.engineThrust / shipMass;
        const surfaceBrakingDist = (relSpeed * relSpeed) / (2 * 0.85 * maxDecel) + 500000;

        if (altitude <= surfaceBrakingDist) {
          // Decel phase: point toward target, reverse thrust (matches autopilot).
          routeHeading = Math.atan2(-dy, -dx);
          routeThrottle = -Math.min(100, (relSpeed / 120) * 10);
        } else {
          // Accel phase: burn toward target
          routeHeading = Math.atan2(-dy, -dx);
          routeThrottle = 90;
        }
      }
    } else if (autopilotMode === "match-speed" && selectedBodyId) {
      const targetBody = bodies.find((b) => b.id === selectedBodyId);
      if (targetBody) {
        const p1 = getBodyPos(targetBody.id);
        const p2 = getAbsoluteBodyPosition(targetBody.id, bodies, gameTime + 1);
        const targetVx = p2.x - p1.x;
        const targetVy = p2.y - p1.y;
        const relVx = ship.vx - targetVx;
        const relVy = ship.vy - targetVy;
        routeHeading = Math.atan2(-relVy, -relVx);
        routeThrottle = 40;
      }
    } else if (autopilotMode === "circularize") {
      routeThrottle = 40;
    }

    const route = predictShipRoute(
      { ...ship, heading: routeHeading },
      bodies,
      gameTime,
      86400 * 4,
      24,       // reduced from 72 — enough for visual trace, much cheaper
      routeThrottle
      // No cache — prediction sub-steps need accurate per-step body positions
    );
    if (route.length < 2) return;

    ctx.strokeStyle = `${palette.accent}88`;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    route.forEach((world, index) => {
      const pt = toScreen(world, center, width, height);
      if (index === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  };

  const drawMiningBeam = (ctx: CanvasRenderingContext2D, center: Point, width: number, height: number) => {
    if (!miningActive || !miningTargetId) return;
    const target = bodies.find((body) => body.id === miningTargetId);
    if (!target) return;

    const shipPt = toScreen({ x: ship.x, y: ship.y }, center, width, height);
    const targetPt = toScreen(getBodyPos(target.id), center, width, height);
    ctx.strokeStyle = "rgba(192,132,252,0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(shipPt.x, shipPt.y);
    ctx.lineTo(targetPt.x, targetPt.y);
    ctx.stroke();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width || 800;
    const height = rect.height || 500;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Build position cache once per frame for all draw calls
    const drawCache = buildBodyPositionCache(bodies, gameTime);
    drawCacheRef.current = drawCache;

    const center = cameraCenter;
    drawBackground(ctx, width, height);
    drawGrid(ctx, center, width, height);

    systemFeatures
      .filter((feature) => feature.type !== "ring")
      .forEach((feature) => drawFeature(ctx, feature, center, width, height));

    const starPt = toScreen({ x: 0, y: 0 }, center, width, height);
    const starRadius = clamp(SUN_RADIUS_METERS * scale, 10, 120);
    const starGlow = ctx.createRadialGradient(starPt.x, starPt.y, 0, starPt.x, starPt.y, starRadius * 3.5);
    starGlow.addColorStop(0, "#ffffff");
    starGlow.addColorStop(0.22, starColor);
    starGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = starGlow;
    ctx.beginPath();
    ctx.arc(starPt.x, starPt.y, starRadius * 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = starColor;
    ctx.beginPath();
    ctx.arc(starPt.x, starPt.y, starRadius, 0, Math.PI * 2);
    ctx.fill();

    bodies.filter((body) => revealedBodyIds.has(body.id)).forEach((body) => drawOrbit(ctx, body, center, width, height));
    bodies.filter((body) => revealedBodyIds.has(body.id)).forEach((body) => drawBody(ctx, body, center, width, height));

    systemFeatures
      .filter((feature) => feature.type === "ring")
      .forEach((feature) => drawFeature(ctx, feature, center, width, height));

    drawRoute(ctx, center, width, height);
    drawMiningBeam(ctx, center, width, height);
    drawShip(ctx, center, width, height);

    ctx.fillStyle = "rgba(226,232,240,0.72)";
    ctx.font = "10px ui-monospace, SFMono-Regular, Consolas, monospace";
    ctx.fillText(`ZOOM 10^${zoomExponent.toFixed(2)} px/m`, 14, 18);
    ctx.fillText(`CENTER ${cameraMode.toUpperCase()}`, 14, 32);
    if (selectedBody) {
      const pos = getBodyPos(selectedBody.id);
      ctx.fillText(`TARGET ${selectedBody.name} ${formatDistanceMeters(Math.hypot(ship.x - pos.x, ship.y - pos.y))}`, 14, 46);
    }
  }, [
    bodies,
    cameraMode,
    gameTime,
    hoveredBodyId,
    isThrusting,
    miningActive,
    miningTargetId,
    palette,
    cameraCenter,
    revealedBodyIds,
    scale,
    selectedBody,
    selectedBodyId,
    ship,
    starColor,
    systemFeatures,
    zoomExponent,
  ]);

  const findBodyAtScreenPoint = (screen: Point) => {
    const { width, height } = getCanvasViewport();
    const center = cameraCenter;
    let found: string | null = null;
    let bestDistance = 28;

    for (const body of bodies) {
      if (!revealedBodyIds.has(body.id)) continue;
      const world = getBodyPos(body.id);
      const pt = toScreen(world, center, width, height);
      const radius = getBodyDisplayRadius(body, scale);
      const dist = Math.hypot(pt.x - screen.x, pt.y - screen.y) - radius;
      if (dist < bestDistance) {
        bestDistance = dist;
        found = body.id;
      }
    }

    return found;
  };

  const getEventPoint = (event: React.MouseEvent<HTMLCanvasElement> | WheelEvent): Point => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    return {
      x: event.clientX - (rect?.left ?? 0),
      y: event.clientY - (rect?.top ?? 0),
    };
  };

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    const bodyId = findBodyAtScreenPoint(getEventPoint(event));
    if (bodyId) onSelectBody(bodyId);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    setIsDragging(true);
    dragMovedRef.current = false;
    setDragStart({ x: event.clientX, y: event.clientY });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      const dx = event.clientX - dragStart.x;
      const dy = event.clientY - dragStart.y;
      if (Math.hypot(dx, dy) > 3) dragMovedRef.current = true;
      setCameraCenter((current) => ({
        x: current.x - dx / scale,
        y: current.y - dy / scale,
      }));
      setDragStart({ x: event.clientX, y: event.clientY });
      return;
    }

    setHoveredBodyId(findBodyAtScreenPoint(getEventPoint(event)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const pointer = getEventPoint(event);
      const { width, height } = getCanvasViewport();
      const multiplier = event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? height
          : 1;
      const zoomRatio = Math.exp(-event.deltaY * multiplier * 0.0012);

      setZoomExponent((currentExponent) => {
        const oldScale = Math.pow(10, currentExponent);
        const nextExponent = clampZoomExponent(Math.log10(oldScale * zoomRatio));
        const newScale = Math.pow(10, nextExponent);
        setCameraCenter((currentCenter) => {
          const worldBefore = toWorld(pointer, currentCenter, width, height, oldScale);
          return {
            x: worldBefore.x - (pointer.x - width / 2) / newScale,
            y: worldBefore.y - (pointer.y - height / 2) / newScale,
          };
        });
        return nextExponent;
      });
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div className="star-system-canvas-shell relative w-full h-[22rem] sm:h-[26rem] lg:h-[28rem] xl:h-[32rem] bg-stone-950 rounded-xl overflow-hidden border border-stone-800 flex flex-col font-sans select-none shadow-2xl">
      {!hideCameraControls && (
        <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-stone-800 bg-stone-950/88 p-1 text-xs shadow-lg backdrop-blur">
            <button
              type="button"
              onClick={() => setMode("star")}
              className={`flex items-center gap-1 rounded px-2 py-1 transition ${cameraMode === "star" ? "bg-amber-500 text-stone-950 font-bold" : "text-stone-400 hover:bg-stone-800 hover:text-white"}`}
            >
              <Zap className="h-3.5 w-3.5" />
              STAR
            </button>
            <button
              type="button"
              onClick={() => setMode("ship")}
              className={`flex items-center gap-1 rounded px-2 py-1 transition ${cameraMode === "ship" ? "bg-sky-500 text-stone-950 font-bold" : "text-stone-400 hover:bg-stone-800 hover:text-white"}`}
            >
              <Compass className="h-3.5 w-3.5" />
              SHIP
            </button>
            <button
              type="button"
              disabled={!selectedBodyId}
              onClick={() => setMode("target")}
              className={`flex items-center gap-1 rounded px-2 py-1 transition ${!selectedBodyId ? "cursor-not-allowed opacity-35" : cameraMode === "target" ? "bg-orange-500 text-stone-950 font-bold" : "text-stone-400 hover:bg-stone-800 hover:text-white"}`}
            >
              <Crosshair className="h-3.5 w-3.5" />
              TARGET
            </button>
          </div>

          <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-stone-800 bg-stone-950/88 px-2 py-1.5 text-xs shadow-lg backdrop-blur">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Zoom</span>
            <input
              type="range"
              min={MIN_ZOOM_EXPONENT}
              max={MAX_ZOOM_EXPONENT}
              step="0.05"
              value={zoomExponent}
              onChange={(event) => setZoomExponent(clampZoomExponent(Number(event.target.value)))}
              className="w-28 accent-sky-500"
            />
            <button
              type="button"
              onClick={resetView}
              title="Recenter view"
              className="rounded p-1 text-stone-400 transition hover:bg-stone-800 hover:text-white"
            >
              <Move className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <canvas
        id="physics-rendering-canvas"
        ref={canvasRef}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          handleMouseUp();
          setHoveredBodyId(null);
        }}
        className="min-h-0 w-full flex-grow cursor-grab active:cursor-grabbing"
      />

      <div className="flex items-center justify-between border-t border-stone-800 bg-stone-950/92 px-4 py-1.5 font-mono text-[11px] text-stone-400">
        <span className="text-sky-400">VEL {Math.round(Math.hypot(ship.vx, ship.vy)).toLocaleString()} m/s</span>
        <span>{cameraMode.toUpperCase()} CAM</span>
        <span className="text-orange-400">FUEL {Math.round(ship.fuelLevel).toLocaleString()} kg</span>
      </div>
    </div>
  );
};
