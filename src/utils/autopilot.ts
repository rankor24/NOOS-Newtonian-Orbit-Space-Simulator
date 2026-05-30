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
  const maxCruiseClosingSpeed = input.maxCruiseClosingSpeed ?? 4500;

  const ux = distance > 0 ? -input.dx / distance : 1;
  const uy = distance > 0 ? -input.dy / distance : 0;
  const closingSpeed = input.relVx * ux + input.relVy * uy;

  // Crucial: effectiveStopDistance is the distance from the ship to the arrival boundary.
  const effectiveStopDistance = Math.max(0, distance - arrivalDistance);

  // We target a safe deceleration rate (e.g. 40% of maximum capability)
  // to avoid overshooting under time-warp or low framerates.
  const targetDecel = 0.4 * maxAcceleration;

  // From physics: v^2 = u^2 + 2ad => v = sqrt(2ad + v_arrival^2)
  const maxSafeClosingSpeed = Math.sqrt(
    Math.max(0, 2 * targetDecel * effectiveStopDistance + arrivalSpeed * arrivalSpeed)
  );

  // Limit desired speed to the client's comfortable cruise limit
  const desiredClosingSpeed = Math.min(maxCruiseClosingSpeed, maxSafeClosingSpeed);

  const brakingDistance = closingSpeed > 0
    ? (closingSpeed * closingSpeed) / (2 * targetDecel)
    : 0;

  // 1. Arrived Check
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

  // 2. Determine Phase
  // We must brake if our relative speed towards target exceeds the desired speed limit,
  // or if we are already inside the glide slope zone and closing too fast.
  const isInsideGlideSlope = desiredClosingSpeed < maxCruiseClosingSpeed;
  const mustBrake = closingSpeed > desiredClosingSpeed + 5 || (isInsideGlideSlope && closingSpeed > desiredClosingSpeed);

  if (mustBrake && relSpeed > arrivalSpeed) {
    // Braking phase: Face the relative velocity vector (prograde relative velocity)
    // and fire with a negative throttle (reverse thrusters) to decelerate opposite to motion.
    const targetHeading = Math.atan2(input.relVy, input.relVx);
    // Control throttle based on overspeed magnitude
    const speedOvershoot = closingSpeed - desiredClosingSpeed;
    const throttlePercent = -clamp(
      (speedOvershoot / 150) * 80 + 20,
      25,
      100
    );

    return {
      phase: "brake",
      targetHeading,
      throttlePercent,
      distance,
      closingSpeed,
      desiredClosingSpeed,
      brakingDistance,
    };
  }

  // 3. Stably coast or gently steer prograde if inside the glide slope zone but under-speed.
  if (isInsideGlideSlope) {
    return {
      phase: "coast",
      targetHeading: Math.atan2(input.relVy, input.relVx), // stay facing prograde velocity!
      throttlePercent: 0,
      distance,
      closingSpeed,
      desiredClosingSpeed,
      brakingDistance,
    };
  }

  // 4. Accelerate to Cruise Speed (if far away and below cruise speed)
  if (closingSpeed < desiredClosingSpeed - 20) {
    const speedDeficit = desiredClosingSpeed - closingSpeed;
    const throttlePercent = clamp(
      (speedDeficit / 400) * 80 + 20,
      20,
      95
    );

    return {
      phase: "accelerate",
      targetHeading: Math.atan2(uy, ux), // face target directly (prograde)
      throttlePercent,
      distance,
      closingSpeed,
      desiredClosingSpeed,
      brakingDistance,
    };
  }

  // Default coast (e.g. cruising at top speed)
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
