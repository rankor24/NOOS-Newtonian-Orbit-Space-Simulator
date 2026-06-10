import { ApproachGuidance } from "./spaceFlightAutopilot";

export interface TransferGuidanceInput {
  dx: number;
  dy: number;
  relVx: number;
  relVy: number;
  maxAcceleration: number;
  targetMass: number;
  bodyRadius: number;
  terminalDistance: number;
  terminalSpeed: number;
  /** Tsiolkovsky delta-v remaining (m/s). Caps transfer speed so the ship can still brake. */
  deltaVBudget?: number;
}

const G = 6.6743e-11;
const EPS = 1e-9;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const magnitude = (x: number, y: number) => Math.hypot(x, y);
const headingOf = (x: number, y: number, fallback = 0) => (magnitude(x, y) > EPS ? Math.atan2(y, x) : fallback);

export function computeTransferGuidance(input: TransferGuidanceInput): ApproachGuidance {
  const distance = magnitude(input.dx, input.dy);
  const maxAcceleration = Math.max(0.0001, input.maxAcceleration);
  const bodyRadius = Math.max(0, input.bodyRadius);
  const terminalDistance = Math.max(input.terminalDistance, bodyRadius + 50_000);
  const terminalSpeed = Math.max(1, input.terminalSpeed);
  const outwardX = distance > EPS ? input.dx / distance : 1;
  const outwardY = distance > EPS ? input.dy / distance : 0;
  const inwardX = -outwardX;
  const inwardY = -outwardY;
  const tangentX = -outwardY;
  const tangentY = outwardX;
  const radialOutSpeed = input.relVx * outwardX + input.relVy * outwardY;
  const closingSpeed = -radialOutSpeed;
  const rangeToTerminal = Math.max(0, distance - terminalDistance);
  const controlledDecel = maxAcceleration * 0.35;
  // Brachistochrone-style profile: accelerate as long as the remaining range still
  // allows a controlled brake. The only speed cap is the propellant ledger - spend at
  // most ~1/3 of remaining delta-v on the outbound leg so braking is always covered.
  const deltaVCap = Number.isFinite(input.deltaVBudget ?? Infinity)
    ? Math.max(45_000, (input.deltaVBudget ?? 0) * 0.35)
    : Infinity;
  const desiredClosingSpeed = Math.min(
    deltaVCap,
    Math.sqrt(Math.max(0, terminalSpeed * terminalSpeed + 2 * controlledDecel * rangeToTerminal))
  );
  const brakingDistance = closingSpeed > 0 ? (closingSpeed * closingSpeed) / (2 * controlledDecel) : 0;
  const etaSeconds = closingSpeed > 1 ? rangeToTerminal / closingSpeed : null;
  const mu = G * Math.max(0, input.targetMass);
  const circularSpeed = mu > 0 ? Math.sqrt(mu / Math.max(distance, bodyRadius + 1)) : 0;
  const tangentialSpeed = input.relVx * tangentX + input.relVy * tangentY;
  const orbitSign = Math.abs(tangentialSpeed) > 40 ? Math.sign(tangentialSpeed) : 1;

  if (distance <= terminalDistance * 1.15) {
    const targetTangentialSpeed = circularSpeed * orbitSign;
    const tangentError = targetTangentialSpeed - tangentialSpeed;
    const radialError = -Math.min(closingSpeed, terminalSpeed) - radialOutSpeed;
    const correctionX = inwardX * radialError + tangentX * tangentError;
    const correctionY = inwardY * radialError + tangentY * tangentError;
    const correctionSpeed = magnitude(correctionX, correctionY);
    return {
      phase: correctionSpeed > Math.max(terminalSpeed, 25) ? "capture" : "arrived",
      targetHeading: headingOf(correctionX, correctionY, headingOf(tangentX * orbitSign, tangentY * orbitSign)),
      throttlePercent: correctionSpeed > Math.max(terminalSpeed, 25) ? clamp((correctionSpeed / 2_500) * 100, 10, 60) : 0,
      distance,
      closingSpeed,
      desiredClosingSpeed: terminalSpeed,
      brakingDistance,
      etaSeconds,
    };
  }

  if (closingSpeed > desiredClosingSpeed * 1.08 || brakingDistance > rangeToTerminal * 0.92) {
    return {
      phase: "brake",
      targetHeading: headingOf(-input.relVx, -input.relVy, headingOf(outwardX, outwardY)),
      throttlePercent: clamp(((closingSpeed - desiredClosingSpeed) / 3_000) * 100, 12, 100),
      distance,
      closingSpeed,
      desiredClosingSpeed,
      brakingDistance,
      etaSeconds,
    };
  }

  if (closingSpeed < desiredClosingSpeed * 0.82) {
    const speedError = desiredClosingSpeed - closingSpeed;
    return {
      phase: "accelerate",
      targetHeading: headingOf(inwardX, inwardY),
      throttlePercent: clamp((speedError / 4_000) * 100, 10, 100),
      distance,
      closingSpeed,
      desiredClosingSpeed,
      brakingDistance,
      etaSeconds,
    };
  }

  return {
    phase: "coast",
    targetHeading: headingOf(inwardX, inwardY),
    throttlePercent: 0,
    distance,
    closingSpeed,
    desiredClosingSpeed,
    brakingDistance,
    etaSeconds,
  };
}
