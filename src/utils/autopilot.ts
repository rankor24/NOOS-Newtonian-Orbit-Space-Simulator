export type ApproachPhase = "accelerate" | "coast" | "brake" | "arrived";

export interface ApproachGuidanceInput {
  /** Ship position minus target position, meters. */
  dx: number;
  /** Ship position minus target position, meters. */
  dy: number;
  /** Ship velocity minus target velocity, m/s. */
  relVx: number;
  /** Ship velocity minus target velocity, m/s. */
  relVy: number;
  /** Available forward acceleration, m/s². */
  maxAcceleration: number;
  arrivalDistance?: number;
  arrivalSpeed?: number;
  safetyDistance?: number;
  maxCruiseClosingSpeed?: number;
}

export interface ApproachGuidance {
  phase: ApproachPhase;
  targetHeading: number;
  throttlePercent: number;
  distance: number;
  closingSpeed: number;
  desiredClosingSpeed: number;
  brakingDistance: number;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function computeApproachGuidance(input: ApproachGuidanceInput): ApproachGuidance {
  const distance = Math.max(0, Math.hypot(input.dx, input.dy));
  const relSpeed = Math.hypot(input.relVx, input.relVy);
  const maxAcceleration = Math.max(0.0001, input.maxAcceleration);
  const arrivalDistance = input.arrivalDistance ?? 1_200_000;
  const arrivalSpeed = input.arrivalSpeed ?? 20;
  const safetyDistance = input.safetyDistance ?? 400_000;
  const maxCruiseClosingSpeed = input.maxCruiseClosingSpeed ?? 8_000;

  const ux = distance > 0 ? -input.dx / distance : 1;
  const uy = distance > 0 ? -input.dy / distance : 0;
  const closingSpeed = input.relVx * ux + input.relVy * uy;
  const effectiveStopDistance = Math.max(0, distance - arrivalDistance - safetyDistance);
  const desiredClosingSpeed = Math.min(
    maxCruiseClosingSpeed,
    Math.sqrt(Math.max(0, 2 * maxAcceleration * effectiveStopDistance)),
  );
  const brakingDistance = closingSpeed > 0
    ? (closingSpeed * closingSpeed) / (2 * maxAcceleration) + safetyDistance
    : 0;

  if (distance <= arrivalDistance && relSpeed <= arrivalSpeed) {
    return {
      phase: "arrived",
      targetHeading: Math.atan2(uy, ux),
      throttlePercent: 0,
      distance,
      closingSpeed,
      desiredClosingSpeed,
      brakingDistance,
    };
  }

  const mustBrake = closingSpeed > 0 && (
    brakingDistance >= Math.max(0, distance - arrivalDistance) ||
    closingSpeed > desiredClosingSpeed + 50
  );

  if (mustBrake && relSpeed > arrivalSpeed) {
    return {
      phase: "brake",
      targetHeading: Math.atan2(-input.relVy, -input.relVx),
      throttlePercent: clamp((relSpeed / Math.max(60, desiredClosingSpeed || arrivalSpeed)) * 70, 25, 100),
      distance,
      closingSpeed,
      desiredClosingSpeed,
      brakingDistance,
    };
  }

  if (closingSpeed < desiredClosingSpeed - 50) {
    return {
      phase: "accelerate",
      targetHeading: Math.atan2(uy, ux),
      throttlePercent: clamp(((desiredClosingSpeed - closingSpeed) / Math.max(500, desiredClosingSpeed)) * 100, 20, 100),
      distance,
      closingSpeed,
      desiredClosingSpeed,
      brakingDistance,
    };
  }

  return {
    phase: "coast",
    targetHeading: Math.atan2(uy, ux),
    throttlePercent: 0,
    distance,
    closingSpeed,
    desiredClosingSpeed,
    brakingDistance,
  };
}
