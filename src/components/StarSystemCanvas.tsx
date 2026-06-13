/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Move } from "lucide-react";
import { CelestialBody, GameState, SystemFeature } from "../types";
import shipSpriteUrl from "../assets/ship.svg";
import { getAbsoluteBodyPosition, getDominantGravitySource, getSphereOfInfluence, predictShipRoute, buildBodyPositionCache, BodyPosCache, isOrbitReferenceBody, resolveOrbitReferenceBody } from "../utils/physics";
import { observeFrame, observeMetric } from "../utils/observability";

interface CanvasProps {
  bodies: CelestialBody[];
  getFrameState: () => GameState;
  selectedBodyId: string | null;
  onSelectBody: (id: string | null) => void;
  isDocked: boolean;
  isThrusting: boolean;
  miningActive: boolean;
  miningTargetId: string | null;
  starColor: string;
  systemFeatures?: SystemFeature[];
  uiTheme?: "amber" | "blue" | "green" | "red";
  cameraModeOverride?: "ship" | "target" | "star" | "fit";
  hideCameraControls?: boolean;
  autopilotMode?: AutopilotMode;
  /** Screen-space margins (px) hidden behind the HUD, so the camera focuses the
   *  visible band instead of the geometric centre of the full canvas. */
  viewportInsets?: { top?: number; bottom?: number; left?: number; right?: number };
}
type AutopilotMode = "none" | "match-speed" | "circularize" | "align-target" | "approach-target" | "goto-target" | "hold-prograde" | "hold-retrograde" | "hold-radial-out" | "hold-radial-in" | "hold-anti-target";

type CameraMode = "ship" | "target" | "star" | "fit";
type Point = { x: number; y: number };
type RoutePoint = Point & { t: number };
type RoutePrognosis = {
  points: RoutePoint[];
  duration: number;
  referenceBodyId: string | null;
  referenceClosestIndex: number;
  referenceClosestAltitude: number;
  referenceFarthestIndex: number;
  referenceFarthestAltitude: number | null;
  selectedClosestIndex: number | null;
  selectedClosestDistance: number | null;
  soiEntryIndex: number | null;
  soiEntryBodyId: string | null;
  impactIndex: number | null;
};
type TimingWindow = { startedAt: number; count: number; total: number; max: number };

const AU = 1.496e11;
const MIN_ZOOM_EXPONENT = -14;
const MAX_ZOOM_EXPONENT = -2.5;
const DEFAULT_ZOOM_EXPONENT = -9;
const SUN_RADIUS_METERS = 6.96e8;

const GRID_STEPS_AU = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100, 250, 500, 1000, 2500];
const METRIC_WINDOW_MS = 5000;

// Player ship sprite, loaded once per module. Nose points up in the artwork,
// canvas heading 0 points +x, hence the +PI/2 rotation offset when drawing.
const shipSprite = new Image();
shipSprite.src = shipSpriteUrl;
const SHIP_SPRITE_ASPECT = 450 / 520; // viewBox height/width of the trimmed artwork

function getParentMassForSoi(body: CelestialBody, bodies: CelestialBody[]): number {
  if (!body.parentId) return 1.989e30;
  const parent = bodies.find((entry) => entry.id === body.parentId);
  if (!parent) return 1.989e30;
  return parent.type === "star" ? 1.989e30 : parent.mass ?? 1.989e30;
}

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

const TERMINAL_APPROACH_MODES = new Set<AutopilotMode>(["goto-target", "approach-target", "match-speed"]);
const isTerminalApproachMode = (mode: string): mode is AutopilotMode =>
  TERMINAL_APPROACH_MODES.has(mode as AutopilotMode);

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

function createEmptyRoutePrognosis(): RoutePrognosis {
  return {
    points: [],
    duration: 0,
    referenceBodyId: null,
    referenceClosestIndex: 0,
    referenceClosestAltitude: Infinity,
    referenceFarthestIndex: 0,
    referenceFarthestAltitude: null,
    selectedClosestIndex: null,
    selectedClosestDistance: null,
    soiEntryIndex: null,
    soiEntryBodyId: null,
    impactIndex: null,
  };
}

function createTimingWindow(): TimingWindow {
  return { startedAt: performance.now(), count: 0, total: 0, max: 0 };
}

function observeTimingWindow(
  window: TimingWindow,
  name: string,
  durationMs: number,
  attrs?: Record<string, unknown>
) {
  window.count += 1;
  window.total += durationMs;
  window.max = Math.max(window.max, durationMs);

  const now = performance.now();
  if (now - window.startedAt < METRIC_WINDOW_MS || window.count === 0) return;

  observeMetric(`${name}.avg`, Number((window.total / window.count).toFixed(2)), "ms", attrs);
  observeMetric(`${name}.max`, Number(window.max.toFixed(2)), "ms", attrs);

  window.startedAt = now;
  window.count = 0;
  window.total = 0;
  window.max = 0;
}

function formatDistanceMeters(value: number) {
  const abs = Math.abs(value);
  if (abs >= AU * 0.1) return `${(value / AU).toFixed(2)} AU`;
  if (abs >= 1e6) return `${Math.round(value / 1e6).toLocaleString()} Mm`;
  return `${Math.round(value / 1000).toLocaleString()} km`;
}

function formatDuration(seconds: number) {
  const abs = Math.max(0, seconds);
  if (abs >= 86400) return `${(abs / 86400).toFixed(1)} d`;
  if (abs >= 3600) return `${(abs / 3600).toFixed(1)} h`;
  if (abs >= 60) return `${Math.round(abs / 60)} m`;
  return `${Math.round(abs)} s`;
}

function colorWithAlpha(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  if (Number.isNaN(value) || normalized.length !== 6) return `rgba(56,189,248,${alpha})`;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function drawVectorLine(
  ctx: CanvasRenderingContext2D,
  origin: Point,
  directionX: number,
  directionY: number,
  length: number,
  color: string,
  label: string,
  dashed = false
) {
  const directionLength = Math.hypot(directionX, directionY);
  if (directionLength < 1e-6) return;

  const ux = directionX / directionLength;
  const uy = directionY / directionLength;
  const endX = origin.x + ux * length;
  const endY = origin.y + uy * length;
  const headSize = 7;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash(dashed ? [5, 5] : []);
  ctx.beginPath();
  ctx.moveTo(origin.x, origin.y);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.setLineDash([]);

  const angle = Math.atan2(uy, ux);
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - Math.cos(angle - 0.45) * headSize, endY - Math.sin(angle - 0.45) * headSize);
  ctx.lineTo(endX - Math.cos(angle + 0.45) * headSize, endY - Math.sin(angle + 0.45) * headSize);
  ctx.closePath();
  ctx.fill();

  ctx.font = "bold 10px ui-monospace, SFMono-Regular, Consolas, monospace";
  ctx.fillText(label, endX + 8, endY + 4);
  ctx.restore();
}

function drawStationMapGlyph(
  ctx: CanvasRenderingContext2D,
  origin: Point,
  radius: number,
  selected: boolean,
  hovered: boolean,
  accentColor: string
) {
  const size = clamp(radius * (selected ? 4.8 : hovered ? 4.4 : 3.8), 18, 52);
  const cyan = "#00f3ff";
  const cyanSoft = "rgba(0,243,255,0.42)";
  const cyanDim = "rgba(0,174,255,0.22)";
  const orange = "#ff7b00";
  const stroke = selected ? accentColor : hovered ? "#e2e8f0" : cyan;

  const glow = ctx.createRadialGradient(origin.x, origin.y, 0, origin.x, origin.y, size * 1.05);
  glow.addColorStop(0, "rgba(0,243,255,0.34)");
  glow.addColorStop(0.45, "rgba(0,174,255,0.13)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, size * 1.05, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(origin.x, origin.y);
  ctx.rotate(Math.PI / 8);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Distilled from docs/svg/Station.svg: ring station + hub + docking spokes,
  // simplified for canvas map readability instead of importing the full scene.
  ctx.strokeStyle = cyanDim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.58, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = selected ? accentColor : cyanSoft;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = stroke;
  ctx.lineWidth = selected ? 2 : 1.35;
  ctx.strokeRect(-size * 0.22, -size * 0.22, size * 0.44, size * 0.44);
  ctx.strokeRect(-size * 0.12, -size * 0.08, size * 0.24, size * 0.16);

  for (let i = 0; i < 4; i += 1) {
    ctx.save();
    ctx.rotate((Math.PI / 2) * i);
    ctx.strokeStyle = cyanSoft;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.22);
    ctx.lineTo(0, -size * 0.84);
    ctx.stroke();

    ctx.strokeStyle = selected ? accentColor : cyan;
    ctx.lineWidth = selected ? 1.8 : 1.25;
    ctx.beginPath();
    ctx.moveTo(-size * 0.1, -size * 0.52);
    ctx.lineTo(size * 0.1, -size * 0.6);
    ctx.lineTo(-size * 0.1, -size * 0.68);
    ctx.stroke();

    ctx.fillStyle = orange;
    ctx.fillRect(-size * 0.025, -size * 0.77, size * 0.05, size * 0.1);
    ctx.restore();
  }

  ctx.strokeStyle = "rgba(255,123,0,0.72)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-size * 0.28, -size * 0.36);
  ctx.lineTo(-size * 0.18, -size * 0.3);
  ctx.moveTo(size * 0.28, size * 0.36);
  ctx.lineTo(size * 0.18, size * 0.3);
  ctx.stroke();

  ctx.restore();
}

/** LOD body sizing: always proportional to real radius × zoom.
 *  Floor based on log(radius) so bigger bodies get slightly bigger
 *  minimum dots — hierarchy visible at any zoom. Real proportions
 *  emerge naturally as you zoom in and realPx overtakes the floor. */
function getBodyDisplayRadius(body: CelestialBody, scale: number): number {
  const realR = Math.max(0, body.radius ?? 0);
  const realPx = realR * scale;
  if (body.type === "station") return clamp(Math.max(realPx, 4.2), 4.2, 12);

  // Log-scale floor: 100 m → 0.8 px, 100,000 km → 2.8 px
  const logR = Math.log10(Math.max(realR, 100));
  const t = clamp((logR - 2) / 6, 0, 1);
  const floor = 0.8 + t * 2.0;

  return clamp(Math.max(realPx, floor), 0.8, 400);
}

function shouldAlwaysRevealBody(body: CelestialBody) {
  if (!body.parentId) return true;
  if (body.type === "station") return true;
  if (body.parentId === "star_sol" && body.type !== "asteroid" && body.type !== "comet") return true;
  return PRIORITY_SMALL_BODIES.has(body.name) || !!body.stationName;
}

export const StarSystemCanvas: React.FC<CanvasProps> = ({
  bodies,
  getFrameState,
  selectedBodyId,
  onSelectBody,
  isDocked,
  isThrusting,
  miningActive,
  miningTargetId,
  starColor,
  systemFeatures = [],
  uiTheme = "blue",
  cameraModeOverride,
  hideCameraControls = false,
  autopilotMode = "none",
  viewportInsets,
}) => {
  const insetTop = viewportInsets?.top ?? 0;
  const insetBottom = viewportInsets?.bottom ?? 0;
  const insetLeft = viewportInsets?.left ?? 0;
  const insetRight = viewportInsets?.right ?? 0;
  // Projection centre of the unobstructed band. toScreen/toWorld and every centring
  // calc route through these so panning, zoom-to-cursor and FIT all stay consistent.
  const viewCenterX = (width: number) => insetLeft + (width - insetLeft - insetRight) / 2;
  const viewCenterY = (height: number) => insetTop + (height - insetTop - insetBottom) / 2;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [baseZoomExponent, setZoomExponent] = useState(DEFAULT_ZOOM_EXPONENT);
  const [cameraMode, setCameraMode] = useState<CameraMode>("star");
  const cameraModeRef = useRef<CameraMode>("star");
  cameraModeRef.current = cameraMode;
  const [cameraCenter, setCameraCenter] = useState<Point>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [hoveredBodyId, setHoveredBodyId] = useState<string | null>(null);
  const dragMovedRef = useRef(false);
  const drawCacheRef = useRef<BodyPosCache>(new Map());
  const lastRouteComputeAtRef = useRef(0);
  const frameStatsRef = useRef({ lastAt: 0, deltas: [] as number[], avg: 0, max: 0, windowStartedAt: 0 });
  const canvasTimingRef = useRef<TimingWindow>(createTimingWindow());
  const routeTimingRef = useRef<TimingWindow>(createTimingWindow());
  const lastRouteRef = useRef<RoutePrognosis>(createEmptyRoutePrognosis());

  const lastRenderedCenterRef = useRef<Point>({ x: 0, y: 0 });
  const lastRenderedScaleRef = useRef<number>(Math.pow(10, DEFAULT_ZOOM_EXPONENT));
  const frameState = getFrameState();
  let ship = frameState.ship;
  let gameTime = frameState.gameTime;

  const getBodyPos = (bodyId: string): Point => {
    const cached = drawCacheRef.current.get(bodyId);
    if (cached) return cached;
    return getAbsoluteBodyPosition(bodyId, bodies, gameTime);
  };

  const getCanvasViewport = () => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    return {
      width: rect?.width || canvas?.clientWidth || 800,
      height: rect?.height || canvas?.clientHeight || 500,
    };
  };

  const palette = THEME[uiTheme];
  const baseScale = Math.pow(10, baseZoomExponent);
  const selectedBody = selectedBodyId ? bodies.find((body) => body.id === selectedBodyId) ?? null : null;

  // Dynamically resolve target center and scale
  const resolved = useMemo(() => {
    let modeCenter = cameraCenter;
    let modeScale = baseScale;
    let modeExponent = baseZoomExponent;

    if (cameraMode === "ship") {
      modeCenter = { x: ship.x, y: ship.y };
    } else if (cameraMode === "target" && selectedBodyId) {
      modeCenter = getBodyPos(selectedBodyId);
    } else if (cameraMode === "fit") {
      // Frame the ship together with its point of interest: the selected target if
      // there is one, otherwise the nearest non-star body. Fit to a bounding box so
      // both always sit inside the unobstructed band, not behind the HUD.
      let fitTarget = selectedBody;
      if (!fitTarget && bodies.length > 0) {
        const candidateBodies = bodies.filter(b => b.type !== 'star');
        const searchList = candidateBodies.length > 0 ? candidateBodies : bodies;
        fitTarget = searchList.reduce((prev, curr) => {
          const posP = getBodyPos(prev.id);
          const posC = getBodyPos(curr.id);
          const dP = Math.hypot(ship.x - posP.x, ship.y - posP.y);
          const dC = Math.hypot(ship.x - posC.x, ship.y - posC.y);
          return dC < dP ? curr : prev;
        }, searchList[0]);
      }

      if (fitTarget) {
        const targetPos = getBodyPos(fitTarget.id);
        const boundingRadius = fitTarget.radius ?? 1000;
        // Bounding box around ship + target (+ the target's body radius so a large
        // planet is not clipped), centred on the box midpoint.
        const minX = Math.min(ship.x, targetPos.x - boundingRadius);
        const maxX = Math.max(ship.x, targetPos.x + boundingRadius);
        const minY = Math.min(ship.y, targetPos.y - boundingRadius);
        const maxY = Math.max(ship.y, targetPos.y + boundingRadius);
        modeCenter = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };

        const { width, height } = getCanvasViewport();
        const safeWidth = Math.max(120, width - insetLeft - insetRight);
        const safeHeight = Math.max(120, height - insetTop - insetBottom);
        // 18% padding on each side so the pair never hugs the band edges.
        const spanX = Math.max(1, maxX - minX) / 0.82;
        const spanY = Math.max(1, maxY - minY) / 0.82;
        const targetScale = Math.min(safeWidth / spanX, safeHeight / spanY);

        modeExponent = clampZoomExponent(Math.log10(targetScale));
        modeScale = Math.pow(10, modeExponent);
      } else {
        modeCenter = { x: ship.x, y: ship.y };
      }
    }

    lastRenderedCenterRef.current = modeCenter;
    lastRenderedScaleRef.current = modeScale;

    return { center: modeCenter, scale: modeScale, exponent: modeExponent };
  }, [cameraMode, cameraCenter, baseScale, baseZoomExponent, ship.x, ship.y, selectedBodyId, selectedBody, bodies, gameTime, insetTop, insetBottom, insetLeft, insetRight]);

  const scale = resolved.scale;
  const zoomExponent = resolved.exponent;
  const resolvedCenterRef = useRef<Point>(resolved.center);
  resolvedCenterRef.current = resolved.center;

  const getFocusCenter = (mode: CameraMode): Point => {
    if (mode === "ship") return { x: ship.x, y: ship.y };
    if (mode === "target" && selectedBodyId) {
      return getBodyPos(selectedBodyId);
    }
    if (mode === "fit") {
      return resolved.center;
    }
    return { x: 0, y: 0 };
  };

  useEffect(() => {
    if (!cameraModeOverride) return;
    setCameraMode(cameraModeOverride);
    setCameraCenter(getFocusCenter(cameraModeOverride));
  }, [cameraModeOverride]);

  // Scanner reveal changes slowly; recomputing the whole set 60x/s was pure waste.
  // The epoch bumps at most twice a second, selection changes refresh immediately.
  const revealEpoch = Math.floor(performance.now() / 500);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ship position/gameTime sampled via revealEpoch
  }, [bodies, miningTargetId, selectedBodyId, ship.systemScannerRange, revealEpoch]);
  const revealedBodies = useMemo(
    () => bodies.filter((body) => revealedBodyIds.has(body.id)),
    [bodies, revealedBodyIds]
  );

  const toScreen = (world: Point, center: Point, width: number, height: number, currentScale = scale): Point => ({
    x: viewCenterX(width) + (world.x - center.x) * currentScale,
    y: viewCenterY(height) + (world.y - center.y) * currentScale,
  });

  const toWorld = (screen: Point, center: Point, width: number, height: number, currentScale = scale): Point => ({
    x: center.x + (screen.x - viewCenterX(width)) / currentScale,
    y: center.y + (screen.y - viewCenterY(height)) / currentScale,
  });

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

    // Frame pacing readout: avg/max ms between draws over the last second.
    const stats = frameStatsRef.current;
    const nowMs = performance.now();
    if (stats.lastAt > 0) stats.deltas.push(nowMs - stats.lastAt);
    stats.lastAt = nowMs;
    if (nowMs - stats.windowStartedAt >= 1000 && stats.deltas.length > 0) {
      stats.avg = stats.deltas.reduce((sum, value) => sum + value, 0) / stats.deltas.length;
      stats.max = Math.max(...stats.deltas);
      stats.deltas.length = 0;
      stats.windowStartedAt = nowMs;
    }
    if (stats.avg > 0) {
      ctx.fillStyle = stats.max > 80 ? "rgba(248,113,113,0.85)" : "rgba(226,232,240,0.48)";
      ctx.fillText(`FRAME ${stats.avg.toFixed(1)} ms avg / ${stats.max.toFixed(0)} ms max`, 14, height - 28);
    }
  };

  const drawFeature = (ctx: CanvasRenderingContext2D, feature: SystemFeature, center: Point, width: number, height: number) => {
    const parentPos = feature.parentId
      ? getBodyPos(feature.parentId)
      : { x: 0, y: 0 };
    const pt = toScreen(parentPos, center, width, height);
    const inner = feature.innerRadius * scale;
    const outer = feature.outerRadius * scale;
    const viewportRadius = Math.hypot(width, height) / 2;
    const featureCenterDist = Math.hypot(pt.x - viewCenterX(width), pt.y - viewCenterY(height));
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

    // Math-based O(1) Viewport culling to skip drawing orbits that are completely offscreen
    const dx = parentPos.x - center.x;
    const dy = parentPos.y - center.y;
    const parentDistWorld = Math.hypot(dx, dy);
    const screenRadiusWorld = Math.hypot(width, height) / (2 * scale);
    const orbitMaxWorld = body.semiMajorAxis * (1 + body.eccentricity);
    const orbitMinWorld = body.semiMajorAxis * (1 - body.eccentricity);

    if (parentDistWorld - screenRadiusWorld > orbitMaxWorld) return;
    if (parentDistWorld + screenRadiusWorld < orbitMinWorld) return;

    const orbitRadiusPx = body.semiMajorAxis * scale;
    const selected = body.id === selectedBodyId;
    const moonTooSmall = body.type === "moon" && orbitRadiusPx < 8 && !selected;
    const designationOrbitTooSmall = body.type === "moon" && isDesignationMoonName(body.name) && orbitRadiusPx < 32 && !selected;
    const asteroidTooSmall = body.type === "asteroid" && orbitRadiusPx < 5 && !selected;
    const stationTooSmall = body.type === "station" && orbitRadiusPx < 36 && !selected;
    if (moonTooSmall || designationOrbitTooSmall || asteroidTooSmall || stationTooSmall) return;

    const isStation = body.type === "station";
    ctx.strokeStyle = selected ? palette.accent : isStation ? "rgba(167,139,250,0.32)" : "rgba(148,163,184,0.20)";
    ctx.lineWidth = selected ? 1.5 : 1;
    ctx.setLineDash(selected ? [] : isStation ? [2, 6] : [4, 8]);
    ctx.beginPath();

    // Hot loop (runs for every visible body every frame): scalar math only,
    // no per-segment object allocations, segment count scaled to on-screen size.
    const steps = orbitRadiusPx > 600 ? 96 : orbitRadiusPx > 120 ? 64 : 32;
    const cos = Math.cos(body.argumentOfPeriapsis);
    const sin = Math.sin(body.argumentOfPeriapsis);
    const minorAxisFactor = Math.sqrt(1 - body.eccentricity * body.eccentricity);
    for (let i = 0; i <= steps; i += 1) {
      const angle = (i / steps) * Math.PI * 2;
      const ellipseX = body.semiMajorAxis * (Math.cos(angle) - body.eccentricity);
      const ellipseY = body.semiMajorAxis * minorAxisFactor * Math.sin(angle);
      const worldX = parentPos.x + ellipseX * cos - ellipseY * sin;
      const worldY = parentPos.y + ellipseX * sin + ellipseY * cos;
      const px = viewCenterX(width) + (worldX - center.x) * scale;
      const py = viewCenterY(height) + (worldY - center.y) * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
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

    if (body.type === "station") {
      // Stations sit a few hundred km from their parent: at system zoom they all
      // collapse onto the parent body, so cull them harder than any moon.
      if (!selected && !hovered && body.parentId) {
        const parentPt = toScreen(getBodyPos(body.parentId), center, width, height);
        const parentSeparation = Math.hypot(pt.x - parentPt.x, pt.y - parentPt.y);
        if (parentSeparation < 36) return;
      }
      drawStationMapGlyph(ctx, pt, radius, selected, hovered, palette.accent);

      if (selected || hovered || scale > 8e-10) {
        ctx.fillStyle = selected ? palette.accent : "#e9d5ff";
        ctx.font = selected ? "bold 11px system-ui, sans-serif" : "11px system-ui, sans-serif";
        ctx.fillText(body.name, pt.x + radius + 10, pt.y + 4);
        ctx.fillStyle = "#a78bfa";
        ctx.font = "9px ui-monospace, SFMono-Regular, Consolas, monospace";
        ctx.fillText("ORBITAL STATION", pt.x + radius + 10, pt.y + 16);
      }
      return;
    }

    // Radial-gradient glow is expensive to construct; skip it for sub-3px dots
    // where it is invisible anyway.
    if (radius >= 3 || selected || hovered) {
      const glow = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, radius * 3.2);
      glow.addColorStop(0, body.color);
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.globalAlpha = selected || hovered ? 0.5 : 0.22;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius * 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

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

    if ((body.type === "planet" || body.type === "moon") && selected) {
      const soi = getSphereOfInfluence(body, getParentMassForSoi(body, bodies)) * scale;
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

    // LOD: detailed wireframe sprite once zoomed past system scale, growing with
    // zoom (32..120 px); simple triangle marker at wide zoom or until the sprite loads.
    const spriteSize = clamp(scale * 5e7, 32, 120);
    const useSprite = scale >= 6.4e-7 && shipSprite.complete && shipSprite.naturalWidth > 0;

    ctx.save();
    ctx.translate(pt.x, pt.y);

    if (useSprite) {
      const spriteW = spriteSize;
      const spriteH = spriteSize * SHIP_SPRITE_ASPECT;
      // Artwork nose points up (-y); rotate so it tracks the +x heading convention.
      ctx.rotate(ship.heading + Math.PI / 2);
      if (isThrusting && ship.fuelLevel > 0) {
        const flame = ctx.createLinearGradient(0, spriteH * 0.4, 0, spriteH * 0.4 + spriteH * 0.7);
        flame.addColorStop(0, "rgba(255,170,0,0.85)");
        flame.addColorStop(1, "rgba(255,0,0,0)");
        ctx.fillStyle = flame;
        ctx.beginPath();
        ctx.moveTo(-spriteW * 0.18, spriteH * 0.4);
        ctx.lineTo(0, spriteH * 0.4 + spriteH * 0.7);
        ctx.lineTo(spriteW * 0.18, spriteH * 0.4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.drawImage(shipSprite, -spriteW / 2, -spriteH / 2, spriteW, spriteH);
    } else {
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
    }
    ctx.restore();

    ctx.fillStyle = palette.ship;
    ctx.font = "bold 10px ui-monospace, SFMono-Regular, Consolas, monospace";
    const labelOffset = useSprite ? spriteSize / 2 + 4 : 12;
    ctx.fillText("SHIP", pt.x + labelOffset, pt.y - 10);
  };

  const drawFlightVectors = (ctx: CanvasRenderingContext2D, center: Point, width: number, height: number) => {
    const shipPt = toScreen({ x: ship.x, y: ship.y }, center, width, height);
    const vectorLength = 78;
    drawVectorLine(ctx, shipPt, ship.vx, ship.vy, vectorLength, "rgba(56,189,248,0.92)", "VEL", false);

    if (selectedBody) {
      const targetPos = getBodyPos(selectedBody.id);
      drawVectorLine(
        ctx,
        shipPt,
        targetPos.x - ship.x,
        targetPos.y - ship.y,
        vectorLength * 0.9,
        "rgba(250,204,21,0.95)",
        "LOS",
        true
      );
      return;
    }

    const prognosis = lastRouteRef.current;
    const leadIndex = Math.min(Math.max(4, Math.floor(prognosis.points.length * 0.08)), prognosis.points.length - 1);
    const leadPoint = prognosis.points[leadIndex];
    if (leadPoint) {
      drawVectorLine(
        ctx,
        shipPt,
        leadPoint.x - ship.x,
        leadPoint.y - ship.y,
        vectorLength * 0.9,
        "rgba(250,204,21,0.95)",
        "LOS",
        true
      );
    }
  };

  const pickRouteReferenceBody = (): CelestialBody | null => {
    const selectedReferenceBody = resolveOrbitReferenceBody(selectedBody, null, bodies);
    if (selectedReferenceBody) return selectedReferenceBody;
    const candidates = bodies.filter(isOrbitReferenceBody);
    if (candidates.length === 0) return null;
    return candidates.reduce((best, body) => {
      const bestPos = getBodyPos(best.id);
      const bodyPos = getBodyPos(body.id);
      const bestAltitude = Math.hypot(ship.x - bestPos.x, ship.y - bestPos.y) - (best.radius ?? 0);
      const bodyAltitude = Math.hypot(ship.x - bodyPos.x, ship.y - bodyPos.y) - (body.radius ?? 0);
      return bodyAltitude < bestAltitude ? body : best;
    }, candidates[0]);
  };

  const analyzeRoute = (points: Point[], duration: number, referenceBody: CelestialBody | null): RoutePrognosis => {
    const timedPoints = points.map((point, index) => ({
      ...point,
      t: points.length > 1 ? (duration * index) / (points.length - 1) : 0,
    }));
    let referenceClosestIndex = 0;
    let referenceClosestAltitude = Infinity;
    let referenceFarthestIndex = 0;
    let referenceFarthestAltitude: number | null = null;
    let selectedClosestIndex: number | null = null;
    let selectedClosestDistance: number | null = null;
    let soiEntryIndex: number | null = null;
    let soiEntryBodyId: string | null = null;
    let impactIndex: number | null = null;
    let previousDominantBodyId: string | null = null;

    timedPoints.forEach((point, index) => {
      const t = gameTime + point.t;
      const dominant = getDominantGravitySource(point.x, point.y, bodies, t, 1.989e30).body;
      if (index === 0) {
        previousDominantBodyId = dominant?.id ?? null;
      } else if (soiEntryIndex === null && (dominant?.id ?? null) !== previousDominantBodyId) {
        soiEntryIndex = index;
        soiEntryBodyId = dominant?.id ?? null;
      }
      previousDominantBodyId = dominant?.id ?? null;

      const referencePos = referenceBody
        ? getAbsoluteBodyPosition(referenceBody.id, bodies, t)
        : null;
      if (referenceBody) {
        const altitude = Math.hypot(point.x - referencePos!.x, point.y - referencePos!.y) - (referenceBody.radius ?? 0);
        if (altitude < referenceClosestAltitude) {
          referenceClosestAltitude = altitude;
          referenceClosestIndex = index;
        }
        if (referenceFarthestAltitude === null || altitude > referenceFarthestAltitude) {
          referenceFarthestAltitude = altitude;
          referenceFarthestIndex = index;
        }
        if (impactIndex === null && altitude <= 0) {
          impactIndex = index;
        }
      }

      if (selectedBody) {
        const targetPos = selectedBody.id === referenceBody?.id && referencePos
          ? referencePos
          : getAbsoluteBodyPosition(selectedBody.id, bodies, t);
        const targetDistance = Math.hypot(point.x - targetPos.x, point.y - targetPos.y);
        if (selectedClosestDistance === null || targetDistance < selectedClosestDistance) {
          selectedClosestDistance = targetDistance;
          selectedClosestIndex = index;
        }
      }
    });

    return {
      points: timedPoints,
      duration,
      referenceBodyId: referenceBody?.id ?? null,
      referenceClosestIndex,
      referenceClosestAltitude,
      referenceFarthestIndex,
      referenceFarthestAltitude,
      selectedClosestIndex,
      selectedClosestDistance,
      soiEntryIndex,
      soiEntryBodyId,
      impactIndex,
    };
  };

  const drawRouteMarker = (
    ctx: CanvasRenderingContext2D,
    point: RoutePoint,
    center: Point,
    width: number,
    height: number,
    label: string,
    color: string
  ) => {
    const pt = toScreen(point, center, width, height);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pt.x - 8, pt.y);
    ctx.lineTo(pt.x + 8, pt.y);
    ctx.moveTo(pt.x, pt.y - 8);
    ctx.lineTo(pt.x, pt.y + 8);
    ctx.stroke();
    ctx.font = "bold 10px ui-monospace, SFMono-Regular, Consolas, monospace";
    ctx.fillText(label, pt.x + 9, pt.y - 9);
  };

  const drawRoute = (ctx: CanvasRenderingContext2D, center: Point, width: number, height: number) => {
    if (isDocked) {
      if (lastRouteRef.current.points.length > 0) {
        lastRouteRef.current = createEmptyRoutePrognosis();
      }
      return;
    }

    const selectedTarget = selectedBodyId ? bodies.find((body) => body.id === selectedBodyId) : null;
    const selectedTargetPos = selectedTarget ? getBodyPos(selectedTarget.id) : null;
    const targetDistance = selectedTargetPos
      ? Math.hypot(ship.x - selectedTargetPos.x, ship.y - selectedTargetPos.y)
      : null;
    const shipSpeed = Math.max(1, Math.hypot(ship.vx, ship.vy));
    const isTerminalStationApproach = Boolean(
      selectedTarget?.type === "station"
      && selectedTargetPos
      && targetDistance !== null
      && targetDistance < 80_000_000
      && isTerminalApproachMode(autopilotMode)
    );

    if (isTerminalStationApproach && selectedTargetPos && targetDistance !== null) {
      if (lastRouteRef.current.points.length > 0) {
        lastRouteRef.current = createEmptyRoutePrognosis();
      }

      const shipPt = toScreen(ship, center, width, height);
      const targetPt = toScreen(selectedTargetPos, center, width, height);
      ctx.save();
      ctx.strokeStyle = colorWithAlpha(palette.accent, 0.86);
      ctx.fillStyle = colorWithAlpha(palette.accent, 0.95);
      ctx.lineWidth = 1.8;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(shipPt.x, shipPt.y);
      ctx.lineTo(targetPt.x, targetPt.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(targetPt.x, targetPt.y, 7, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = "bold 10px ui-monospace, SFMono-Regular, Consolas, monospace";
      ctx.fillText("APPROACH", targetPt.x + 10, targetPt.y - 10);

      const readoutX = 14;
      const readoutY = Math.round(height * 0.42) + 60;
      ctx.fillStyle = "rgba(2,6,23,0.74)";
      ctx.strokeStyle = "rgba(148,163,184,0.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.rect(readoutX - 6, readoutY - 13, 318, 56);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(226,232,240,0.78)";
      ctx.font = "10px ui-monospace, SFMono-Regular, Consolas, monospace";
      ctx.fillText("APPROACH CORRIDOR", readoutX, readoutY);
      ctx.fillText(`TARGET ${selectedTarget?.name ?? "STATION"}`, readoutX, readoutY + 14);
      ctx.fillStyle = "rgba(250,204,21,0.9)";
      ctx.fillText(`RANGE ${formatDistanceMeters(targetDistance)}`, readoutX, readoutY + 28);
      ctx.fillStyle = "rgba(226,232,240,0.68)";
      ctx.fillText(`SPEED ${Math.round(shipSpeed).toLocaleString()} m/s`, readoutX, readoutY + 42);
      ctx.restore();
      return;
    }

    // Route prediction is the most expensive draw step; refresh on a wall-clock
    // budget so high frame rates and high warp don't multiply the cost.
    const nowMs = performance.now();
    if (nowMs - lastRouteComputeAtRef.current >= 600 || lastRouteRef.current.points.length === 0) {
      lastRouteComputeAtRef.current = nowMs;
      const routeDuration = targetDistance
        ? Math.max(7200, Math.min(86400 * 5, (targetDistance / shipSpeed) * 2.2))
        : 86400 * 3;
      const routeStartedAt = performance.now();
      const routeSteps = Math.max(96, Math.min(240, Math.ceil(routeDuration / 120)));
      const rawRoute = predictShipRoute(
        ship,
        bodies,
        gameTime,
        routeDuration,
        routeSteps,
        0
      );

      lastRouteRef.current = analyzeRoute(rawRoute, routeDuration, pickRouteReferenceBody());
      observeTimingWindow(routeTimingRef.current, "render.route_predict_ms", performance.now() - routeStartedAt, {
        bodies: bodies.length,
        points: rawRoute.length,
        selectedTarget: Boolean(selectedBodyId),
      });
    }

    const prognosis = lastRouteRef.current;
    const route = prognosis.points;
    if (route.length < 2) return;

    const screenRoute = route.map((point) => toScreen(point, center, width, height));
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = colorWithAlpha(palette.accent, 0.8);
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(screenRoute[0].x, screenRoute[0].y);
    for (let index = 1; index < screenRoute.length - 1; index++) {
      const current = screenRoute[index];
      const next = screenRoute[index + 1];
      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;
      ctx.quadraticCurveTo(current.x, current.y, midX, midY);
    }
    const lastPoint = screenRoute[screenRoute.length - 1];
    ctx.lineTo(lastPoint.x, lastPoint.y);
    ctx.stroke();
    ctx.restore();

    const tickEvery = Math.max(8, Math.floor(route.length / 8));
    route.forEach((point, index) => {
      if (index === 0 || index % tickEvery !== 0) return;
      const pt = toScreen(point, center, width, height);
      ctx.fillStyle = "rgba(226,232,240,0.55)";
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    const referenceBody = prognosis.referenceBodyId ? bodies.find((body) => body.id === prognosis.referenceBodyId) : null;
    const periPoint = route[prognosis.referenceClosestIndex];
    if (referenceBody && periPoint) {
      const label = `Pe ${formatDistanceMeters(prognosis.referenceClosestAltitude)} T-${formatDuration(periPoint.t)}`;
      drawRouteMarker(ctx, periPoint, center, width, height, label, prognosis.referenceClosestAltitude <= 0 ? "#ef4444" : "#facc15");
    }

    if (referenceBody && prognosis.referenceFarthestAltitude !== null && prognosis.referenceFarthestIndex !== prognosis.referenceClosestIndex) {
      const apoPoint = route[prognosis.referenceFarthestIndex];
      if (apoPoint) {
        const label = `Ap ${formatDistanceMeters(prognosis.referenceFarthestAltitude)} T-${formatDuration(apoPoint.t)}`;
        drawRouteMarker(ctx, apoPoint, center, width, height, label, "#a78bfa");
      }
    }

    if (selectedBody && prognosis.selectedClosestIndex !== null && prognosis.selectedClosestDistance !== null) {
      const closestPoint = route[prognosis.selectedClosestIndex];
      if (closestPoint) {
        const label = `CA ${formatDistanceMeters(prognosis.selectedClosestDistance)} T-${formatDuration(closestPoint.t)}`;
        drawRouteMarker(ctx, closestPoint, center, width, height, label, "#38bdf8");
      }
    }

    if (prognosis.soiEntryIndex !== null) {
      const soiPoint = route[prognosis.soiEntryIndex];
      const soiBody = prognosis.soiEntryBodyId ? bodies.find((body) => body.id === prognosis.soiEntryBodyId) : null;
      if (soiPoint && soiBody) {
        drawRouteMarker(ctx, soiPoint, center, width, height, `SOI ${soiBody.name} T-${formatDuration(soiPoint.t)}`, "#22c55e");
      }
    }

    if (prognosis.impactIndex !== null) {
      const impactPoint = route[prognosis.impactIndex];
      if (impactPoint) {
        drawRouteMarker(ctx, impactPoint, center, width, height, `IMPACT T-${formatDuration(impactPoint.t)}`, "#ef4444");
      }
    }

    // Left-edge middle band: clear of the COMMS panel (top) and TARGET panel (bottom).
    const readoutX = 14;
    const readoutY = Math.round(height * 0.42) + 60;
    const refName = referenceBody?.name ?? "NONE";
    ctx.fillStyle = "rgba(2,6,23,0.74)";
    ctx.strokeStyle = "rgba(148,163,184,0.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.rect(readoutX - 6, readoutY - 13, 318, 56);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(226,232,240,0.78)";
    ctx.font = "10px ui-monospace, SFMono-Regular, Consolas, monospace";
    let prognosisMode = "COAST";
    if (autopilotMode === "goto-target") {
      prognosisMode = "GO TO";
    } else if (isTerminalApproachMode(autopilotMode)) {
      prognosisMode = "APPR";
    }
    ctx.fillText(`PROGNOSIS ${formatDuration(prognosis.duration)} ${prognosisMode}`, readoutX, readoutY);
    ctx.fillText(`REF ${refName}`, readoutX, readoutY + 14);
    ctx.fillStyle = prognosis.referenceClosestAltitude <= 0 ? "#f87171" : "rgba(250,204,21,0.9)";
    ctx.fillText(referenceBody ? `Pe ${formatDistanceMeters(prognosis.referenceClosestAltitude)}` : "Pe --", readoutX, readoutY + 28);
    ctx.fillStyle = "rgba(226,232,240,0.68)";
    const shipMass = ship.dryMass + ship.fuelLevel;
    const shipAcceleration = ship.engineThrust / Math.max(1, shipMass);
    ctx.fillText(`MASS ${Math.round(shipMass).toLocaleString()} kg  ACC ${shipAcceleration.toFixed(2)} m/s2`, readoutX, readoutY + 42);
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
    let frameId = 0;

    const drawFrame = () => {
      const frameStartedAt = performance.now();
      const liveFrameState = getFrameState();
      ship = liveFrameState.ship;
      gameTime = liveFrameState.gameTime;

      const rect = canvas.getBoundingClientRect();
      const width = rect.width || 800;
      const height = rect.height || 500;
      const dpr = window.devicePixelRatio || 1;
      const targetWidth = Math.round(width * dpr);
      const targetHeight = Math.round(height * dpr);

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else {
        ctx.clearRect(0, 0, width, height);
      }

      drawCacheRef.current = buildBodyPositionCache(bodies, gameTime);

      let center = resolvedCenterRef.current;
      if (cameraMode === "ship") {
        center = { x: ship.x, y: ship.y };
      } else if (cameraMode === "target" && selectedBodyId) {
        center = getBodyPos(selectedBodyId);
      } else if (cameraMode === "fit") {
        let fitTarget = selectedBody;
        if (!fitTarget && bodies.length > 0) {
          const candidateBodies = bodies.filter((body) => body.type !== "star");
          const searchList = candidateBodies.length > 0 ? candidateBodies : bodies;
          fitTarget = searchList.reduce((prev, curr) => {
            const posP = getBodyPos(prev.id);
            const posC = getBodyPos(curr.id);
            const dP = Math.hypot(ship.x - posP.x, ship.y - posP.y);
            const dC = Math.hypot(ship.x - posC.x, ship.y - posC.y);
            return dC < dP ? curr : prev;
          }, searchList[0]);
        }

        if (fitTarget) {
          const targetPos = getBodyPos(fitTarget.id);
          const boundingRadius = fitTarget.radius ?? 1000;
          const minX = Math.min(ship.x, targetPos.x - boundingRadius);
          const maxX = Math.max(ship.x, targetPos.x + boundingRadius);
          const minY = Math.min(ship.y, targetPos.y - boundingRadius);
          const maxY = Math.max(ship.y, targetPos.y + boundingRadius);
          center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        } else {
          center = { x: ship.x, y: ship.y };
        }
      }
      lastRenderedCenterRef.current = center;
      lastRenderedScaleRef.current = scale;
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

      revealedBodies.forEach((body) => drawOrbit(ctx, body, center, width, height));
      revealedBodies.forEach((body) => drawBody(ctx, body, center, width, height));

      systemFeatures
        .filter((feature) => feature.type === "ring")
        .forEach((feature) => drawFeature(ctx, feature, center, width, height));

      if (!isDocked) {
        drawRoute(ctx, center, width, height);
      } else if (lastRouteRef.current.points.length > 0) {
        lastRouteRef.current = createEmptyRoutePrognosis();
      }
      drawMiningBeam(ctx, center, width, height);
      if (!isDocked) {
        drawFlightVectors(ctx, center, width, height);
      }
      drawShip(ctx, center, width, height);

      const statusTextY = Math.round(height * 0.42);
      ctx.fillStyle = "rgba(226,232,240,0.72)";
      ctx.font = "10px ui-monospace, SFMono-Regular, Consolas, monospace";
      ctx.fillText(`ZOOM 10^${zoomExponent.toFixed(2)} px/m`, 14, statusTextY);
      ctx.fillText(`CENTER ${cameraMode.toUpperCase()}`, 14, statusTextY + 14);
      if (selectedBody) {
        const pos = getBodyPos(selectedBody.id);
        ctx.fillText(`TARGET ${selectedBody.name} ${formatDistanceMeters(Math.hypot(ship.x - pos.x, ship.y - pos.y))}`, 14, statusTextY + 28);
      }

      observeTimingWindow(canvasTimingRef.current, "render.canvas_frame_ms", performance.now() - frameStartedAt, {
        bodies: bodies.length,
        docked: isDocked,
        revealed: revealedBodies.length,
      });
      observeFrame();
      frameId = requestAnimationFrame(drawFrame);
    };

    frameId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(frameId);
  }, [
    bodies,
    cameraMode,
    getFrameState,
    hoveredBodyId,
    isDocked,
    isThrusting,
    miningActive,
    miningTargetId,
    palette,
    revealedBodies,
    scale,
    selectedBody,
    selectedBodyId,
    starColor,
    systemFeatures,
    zoomExponent,
  ]);

  const findBodyAtScreenPoint = (screen: Point) => {
    const { width, height } = getCanvasViewport();
    const center = resolved.center;
    let found: string | null = null;
    let bestDistance = 28;

    for (const body of revealedBodies) {
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
      if (Math.hypot(dx, dy) > 3) {
        dragMovedRef.current = true;
        if (cameraMode !== "star") {
          setCameraMode("star");
          const initCenter = lastRenderedCenterRef.current;
          setCameraCenter({
            x: initCenter.x - dx / lastRenderedScaleRef.current,
            y: initCenter.y - dy / lastRenderedScaleRef.current,
          });
          setDragStart({ x: event.clientX, y: event.clientY });
          return;
        }
      }
      setCameraCenter((current) => ({
        x: current.x - dx / lastRenderedScaleRef.current,
        y: current.y - dy / lastRenderedScaleRef.current,
      }));
      setDragStart({ x: event.clientX, y: event.clientY });
      return;
    }

    const nextHoveredBodyId = findBodyAtScreenPoint(getEventPoint(event));
    setHoveredBodyId((current) => current === nextHoveredBodyId ? current : nextHoveredBodyId);
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

      const currentRenderedCenter = lastRenderedCenterRef.current;
      const currentRenderedScale = lastRenderedScaleRef.current;
      const currentMode = cameraModeRef.current;

      if (currentMode !== "star") {
        setZoomExponent((currentExponent) => {
          const oldScale = currentRenderedScale;
          const nextExponent = clampZoomExponent(Math.log10(oldScale * zoomRatio));
          setCameraCenter(currentRenderedCenter);
          return nextExponent;
        });
      } else {
        setZoomExponent((currentExponent) => {
          const oldScale = currentRenderedScale;
          const nextExponent = clampZoomExponent(Math.log10(oldScale * zoomRatio));
          const newScale = Math.pow(10, nextExponent);
          setCameraCenter({
            x: currentRenderedCenter.x + (pointer.x - viewCenterX(width)) * (1 / oldScale - 1 / newScale),
            y: currentRenderedCenter.y + (pointer.y - viewCenterY(height)) * (1 / oldScale - 1 / newScale),
          });
          return nextExponent;
        });
      }
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div className="star-system-canvas-shell relative w-full h-[22rem] sm:h-[26rem] lg:h-[28rem] xl:h-[32rem] bg-stone-950 rounded-xl overflow-hidden border border-stone-800 flex flex-col font-sans select-none shadow-2xl">
      {!hideCameraControls && (
        <div className="absolute top-3 left-3 right-3 z-10 flex justify-center pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-stone-800 bg-stone-950/88 px-2 py-1.5 text-xs shadow-lg backdrop-blur">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Zoom</span>
            <input
              type="range"
              min={MIN_ZOOM_EXPONENT}
              max={MAX_ZOOM_EXPONENT}
              step="0.05"
              value={zoomExponent}
              title="Adjust map zoom level"
              onChange={(event) => {
                setZoomExponent(clampZoomExponent(Number(event.target.value)));
              }}
              className="w-28 accent-sky-500"
            />
            <button
              type="button"
              onClick={() => setMode("fit")}
              className={`rounded p-1 transition ${cameraMode === "fit" ? "bg-emerald-500 text-stone-950" : "text-stone-400 hover:bg-stone-800 hover:text-white"}`}
              title="Auto-zoom to fit ship and nearest body or target in view"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
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
