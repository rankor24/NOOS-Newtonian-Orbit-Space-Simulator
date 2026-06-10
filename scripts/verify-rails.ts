/**
 * Regression checks for propagateKeplerianCoast (on-rails Kepler coasting):
 * - continuity at dt -> 0
 * - full-period return to start (prograde + retrograde, eccentric)
 * - agreement with fine numeric integration over a quarter period
 */
import { propagateKeplerianCoast, integrateSpacecraft } from "../src/utils/physics";
import { CelestialBody, ShipState } from "../src/types";

const G = 6.6743e-11;
const M_EARTH = 5.972e24;
const R_EARTH = 6.371e6;

const earthAsStar: CelestialBody = {
  id: "test_earth",
  name: "TestEarth",
  type: "star",
  mass: M_EARTH / 1.989e30, // star mass is in solar masses in the codebase convention
  radius: R_EARTH,
  gravitySource: true,
  color: "#fff",
  parentId: null as unknown as string,
  description: "",
  hasMarket: false,
  semiMajorAxis: 0,
  eccentricity: 0,
  orbitalPeriod: 1,
  inclination: 0,
  argumentOfPeriapsis: 0,
  meanAnomalyAtEpoch: 0,
} as CelestialBody;

const bodies = [earthAsStar];
const starMass = M_EARTH; // pass true mass via starMass param

function makeShip(r: number, vTangential: number, retrograde: boolean): ShipState {
  return {
    x: r,
    y: 0,
    vx: 0,
    vy: retrograde ? -vTangential : vTangential,
    heading: 0,
    fuelLevel: 0,
    dryMass: 30000,
    engineThrust: 0,
    engineIsp: 300,
    throttlePercent: 0,
  } as unknown as ShipState;
}

const mu = G * M_EARTH;
const r0 = R_EARTH + 400_000; // LEO-ish
const vCirc = Math.sqrt(mu / r0);

function report(label: string, ship: ShipState, dt: number) {
  const out = propagateKeplerianCoast(ship, earthAsStar, bodies, 0, dt, starMass);
  if (!out) {
    console.log(`${label}: NULL (fell back to numeric)`);
    return null;
  }
  return out;
}

let failures = 0;
function check(label: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  ${detail}`);
  if (!ok) failures++;
}

for (const retro of [false, true]) {
  const tag = retro ? "retrograde" : "prograde";

  // Eccentric orbit: 0.9 * circular speed -> e ~ 0.19
  const ship = makeShip(r0, vCirc * 0.9, retro);
  const energy = (0.81 * vCirc * vCirc) / 2 - mu / r0;
  const a = -mu / (2 * energy);
  const period = 2 * Math.PI * Math.sqrt((a * a * a) / mu);

  // 1. continuity at tiny dt
  const tiny = report(`${tag} tiny`, ship, 0.001);
  if (tiny) {
    // solveKepler tolerance is 1e-6 rad -> ~a*1e-6 m of reconstruction noise; allow 20 m.
    const drift = Math.hypot(tiny.x - ship.x, tiny.y - ship.y);
    check(`${tag} dt->0 continuity`, drift < 20, `drift=${drift.toFixed(3)} m`);
  } else failures++;

  // 2. full period returns to start
  const full = report(`${tag} full`, ship, period);
  if (full) {
    const drift = Math.hypot(full.x - ship.x, full.y - ship.y);
    const vDrift = Math.hypot(full.vx - ship.vx, full.vy - ship.vy);
    check(`${tag} full-period closure`, drift < r0 * 1e-3, `posDrift=${(drift / 1000).toFixed(3)} km, vDrift=${vDrift.toFixed(3)} m/s`);
  } else failures++;

  // 3. quarter period vs fine numeric integration (1 s substeps via small dt calls)
  const quarter = period / 4;
  let numeric = { ...ship };
  const steps = 2000;
  for (let i = 0; i < steps; i++) {
    numeric = integrateSpacecraft(numeric, bodies, (i * quarter) / steps, quarter / steps, 0, starMass);
  }
  const rails = report(`${tag} quarter`, ship, quarter);
  if (rails) {
    const diff = Math.hypot(rails.x - numeric.x, rails.y - numeric.y);
    check(`${tag} quarter-period vs numeric`, diff < r0 * 0.02, `diff=${(diff / 1000).toFixed(2)} km (orbit r~${(r0 / 1000).toFixed(0)} km)`);
  } else failures++;

  // 4. near-circular special branch
  const circShip = makeShip(r0, vCirc, retro);
  const circ = report(`${tag} circular`, circShip, period / 3);
  if (circ) {
    const rOut = Math.hypot(circ.x, circ.y);
    check(`${tag} circular radius hold`, Math.abs(rOut - r0) < r0 * 1e-3, `r=${(rOut / 1000).toFixed(1)} km vs ${(r0 / 1000).toFixed(1)} km`);
    // direction of motion: angular momentum sign must be preserved
    const hOut = circ.x * circ.vy - circ.y * circ.vx;
    const hIn = circShip.x * circShip.vy - circShip.y * circShip.vx;
    check(`${tag} circular h-sign preserved`, Math.sign(hOut) === Math.sign(hIn), `hIn=${hIn.toExponential(2)} hOut=${hOut.toExponential(2)}`);
  } else failures++;
}

process.exit(failures > 0 ? 1 : 0);
