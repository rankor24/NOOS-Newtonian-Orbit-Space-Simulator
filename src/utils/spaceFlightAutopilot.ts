export type ApproachPhase = "accelerate" | "capture" | "coast" | "brake" | "match" | "arrived";

export interface ApproachGuidanceInput {
  /** Ship position minus target position, meters. */
  dx: number;
  /** Ship position minus target position, meters. */
  dy: number;
  /** Ship velocity minus target velocity, m/s. */
  relVx: number;
  /** Ship velocity minus target velocity, m/s. */
  relVy: number;
  /** Available forward acceleration, m/s^2. */
  maxAcceleration: number;
  arrivalDistance?: number;
  arrivalSpeed?: number;
  safetyDistance?: number;
  maxCruiseClosingSpeed?: number;
  stationApproach?: boolean;
  currentHeading?: number;
  stationAlignmentTolerance?: number;
  targetMass?: number;
  bodyRadius?: number;
  captureOrbitDistance?: number;
}

export interface ApproachGuidance {
  phase: ApproachPhase;
  targetHeading: number;
  throttlePercent: number;
  distance: number;
  closingSpeed: number;
  desiredClosingSpeed: number;
  brakingDistance: number;
  etaSeconds: number | null;
}

const G = 6.6743e-11;
const EPS = 1e-9;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const magnitude = (x: number, y: number) => Math.hypot(x, y);
const headingOf = (x: number, y: number, fallback = 0) => (magnitude(x, y) > EPS ? Math.atan2(y, x) : fallback);

function throttleForSpeedError(speedError: number, minThrottle: number, maxThrottle: number, scale: number): number {
  if (speedError <= 0) return 0;
  return clamp(minThrottle + (speedError / scale) * (maxThrottle - minThrottle), minThrottle, maxThrottle);
}

function safeClosingSpeed(rangeMeters: number, maxAcceleration: number, terminalSpeed: number, speedCap: number): number {
  const controlledDecel = Math.max(0.0001, maxAcceleration * 0.32);
  const raw = Math.sqrt(Math.max(0, terminalSpeed * terminalSpeed + 2 * controlledDecel * Math.max(0, rangeMeters)));
  return Math.min(speedCap, raw);
}

export function computeApproachGuidance(input: ApproachGuidanceInput): ApproachGuidance {
  const distance = magnitude(input.dx, input.dy);
  const relSpeed = magnitude(input.relVx, input.relVy);
  const maxAcceleration = Math.max(0.0001, input.maxAcceleration);
  const bodyRadius = Math.max(0, input.bodyRadius ?? 0);
  const arrivalDistance = Math.max(input.arrivalDistance ?? 1_200_000, bodyRadius + 25_000);
  const arrivalSpeed = input.arrivalSpeed ?? 20;
  const safetyDistance = Math.max(input.safetyDistance ?? 450_000, arrivalDistance * 0.08);
  const maxCruiseClosingSpeed = input.maxCruiseClosingSpeed ?? 4_000;
  const outwardX = distance > EPS ? input.dx / distance : 1;
  const outwardY = distance > EPS ? input.dy / distance : 0;
  const inwardX = -outwardX;
  const inwardY = -outwardY;
  const tangentX = -outwardY;
  const tangentY = outwardX;
  const radialOutSpeed = input.relVx * outwardX + input.relVy * outwardY;
  const closingSpeed = -radialOutSpeed;
  const rangeToArrivalEstimate = Math.max(0, distance - arrivalDistance);
  const etaSeconds = closingSpeed > 1 ? rangeToArrivalEstimate / closingSpeed : null;
  const targetMass = Math.max(0, input.targetMass ?? 0);
  const mu = G * targetMass;
  const tangentialSpeed = input.relVx * tangentX + input.relVy * tangentY;
  const orbitSign = Math.abs(tangentialSpeed) > 40 ? Math.sign(tangentialSpeed) : 1;
  const stationAirlockHeading = headingOf(tangentX * orbitSign, tangentY * orbitSign, headingOf(inwardX, inwardY));
  const stationAlignmentTolerance = input.stationAlignmentTolerance ?? 0.18;
  const stationHeadingError = typeof input.currentHeading === "number"
    ? Math.abs(Math.atan2(Math.sin(stationAirlockHeading - input.currentHeading), Math.cos(stationAirlockHeading - input.currentHeading)))
    : 0;

  const targetOrbitDistance = Math.max(
    input.captureOrbitDistance ?? 0,
    arrivalDistance * 1.65,
    bodyRadius + safetyDistance * 3
  );
  const hardDeckDistance = Math.max(arrivalDistance * 0.92, bodyRadius + safetyDistance);
  const circularSpeedAtOrbit = mu > 0 ? Math.sqrt(mu / Math.max(targetOrbitDistance, 1)) : 0;

  const rangeToArrival = rangeToArrivalEstimate;
  const rangeToOrbit = Math.max(0, distance - targetOrbitDistance);
  const desiredArrivalClosing = safeClosingSpeed(rangeToArrival, maxAcceleration, arrivalSpeed, maxCruiseClosingSpeed);
  const desiredOrbitClosing = safeClosingSpeed(rangeToOrbit, maxAcceleration, Math.max(90, arrivalSpeed * 3), maxCruiseClosingSpeed);
  const inRendezvousZone = distance <= targetOrbitDistance * 1.15;
  const desiredClosingSpeed = inRendezvousZone
    ? Math.min(desiredArrivalClosing, 220)
    : desiredOrbitClosing;
  const brakingDistance = closingSpeed > 0
    ? (closingSpeed * closingSpeed) / (2 * Math.max(0.0001, maxAcceleration * 0.32))
    : 0;

  if (distance <= arrivalDistance && relSpeed <= arrivalSpeed) {
    if (input.stationApproach && stationHeadingError > stationAlignmentTolerance) {
      return {
        phase: "match",
        targetHeading: stationAirlockHeading,
        throttlePercent: 0,
        distance,
        closingSpeed,
        desiredClosingSpeed,
        brakingDistance,
        etaSeconds,
      };
    }

    return {
      phase: "arrived",
      targetHeading: input.stationApproach ? stationAirlockHeading : headingOf(inwardX, inwardY),
      throttlePercent: 0,
      distance,
      closingSpeed,
      desiredClosingSpeed,
      brakingDistance,
      etaSeconds,
    };
  }

  if (distance <= arrivalDistance * 1.2 || relSpeed <= arrivalSpeed * 1.5) {
    const speedError = relSpeed - arrivalSpeed;
    if (speedError > 2) {
      return {
        phase: "match",
        targetHeading: headingOf(-input.relVx, -input.relVy, headingOf(inwardX, inwardY)),
        throttlePercent: throttleForSpeedError(speedError, 10, 48, 900),
        distance,
        closingSpeed,
        desiredClosingSpeed: arrivalSpeed,
        brakingDistance,
        etaSeconds,
      };
    }

    if (input.stationApproach) {
      return {
        phase: "match",
        targetHeading: stationAirlockHeading,
        throttlePercent: 0,
        distance,
        closingSpeed,
        desiredClosingSpeed: arrivalSpeed,
        brakingDistance,
        etaSeconds,
      };
    }
  }

  const isBelowHardDeck = distance < hardDeckDistance;
  const isClosingTooFast = closingSpeed > desiredClosingSpeed + (inRendezvousZone ? 35 : 120);
  if ((isBelowHardDeck && closingSpeed > 0) || isClosingTooFast) {
    const outwardBias = isBelowHardDeck ? 0.65 : 0.35;
    const antiVelocityX = relSpeed > EPS ? -input.relVx / relSpeed : outwardX;
    const antiVelocityY = relSpeed > EPS ? -input.relVy / relSpeed : outwardY;
    const burnX = antiVelocityX * (1 - outwardBias) + outwardX * outwardBias;
    const burnY = antiVelocityY * (1 - outwardBias) + outwardY * outwardBias;

    return {
      phase: "brake",
      targetHeading: headingOf(burnX, burnY, headingOf(outwardX, outwardY)),
      throttlePercent: throttleForSpeedError(closingSpeed - desiredClosingSpeed, 16, isBelowHardDeck ? 85 : 62, 1_800),
      distance,
      closingSpeed,
      desiredClosingSpeed,
      brakingDistance,
      etaSeconds,
    };
  }

  const wantsOrbitCapture = mu > 0 && distance < targetOrbitDistance * 1.35;
  const desiredTangentialSpeed = circularSpeedAtOrbit * (wantsOrbitCapture ? 0.62 : 0.25) * orbitSign;
  const tangentError = desiredTangentialSpeed - tangentialSpeed;
  const needsTangentialBurn = wantsOrbitCapture && Math.abs(tangentError) > Math.max(120, circularSpeedAtOrbit * 0.12);

  if (needsTangentialBurn) {
    const tangentDirection = Math.sign(tangentError) || orbitSign;
    return {
      phase: "capture",
      targetHeading: headingOf(tangentX * tangentDirection, tangentY * tangentDirection),
      throttlePercent: throttleForSpeedError(Math.abs(tangentError), 12, 54, 1_500),
      distance,
      closingSpeed,
      desiredClosingSpeed,
      brakingDistance,
      etaSeconds,
    };
  }

  const desiredTangentBlend = clamp(1 - rangeToOrbit / Math.max(targetOrbitDistance, 1), 0, 1);
  const plannedTangentialSpeed = circularSpeedAtOrbit * 0.22 * desiredTangentBlend * orbitSign;
  const plannedVelX = inwardX * desiredClosingSpeed + tangentX * plannedTangentialSpeed;
  const plannedVelY = inwardY * desiredClosingSpeed + tangentY * plannedTangentialSpeed;
  const correctionX = plannedVelX - input.relVx;
  const correctionY = plannedVelY - input.relVy;
  const correctionSpeed = magnitude(correctionX, correctionY);
  const transferDeadband = inRendezvousZone ? 180 : 420;

  if (closingSpeed < desiredClosingSpeed - transferDeadband && correctionSpeed > transferDeadband) {
    return {
      phase: "accelerate",
      targetHeading: headingOf(correctionX, correctionY, headingOf(inwardX, inwardY)),
      throttlePercent: throttleForSpeedError(correctionSpeed, 10, inRendezvousZone ? 36 : 58, 2_200),
      distance,
      closingSpeed,
      desiredClosingSpeed,
      brakingDistance,
      etaSeconds,
    };
  }

  return {
    phase: "coast",
    targetHeading: headingOf(plannedVelX, plannedVelY, headingOf(inwardX, inwardY)),
    throttlePercent: 0,
    distance,
    closingSpeed,
    desiredClosingSpeed,
    brakingDistance,
    etaSeconds,
  };
}
