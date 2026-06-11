import assert from "node:assert/strict";
import { computeApproachGuidance } from "./autopilot";
import { computeTransferGuidance } from "./transferPlanner";

const EPS = 1e-6;
const assertAngleNear = (actual: number, expected: number) => {
  const delta = Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected));
  assert.ok(Math.abs(delta) < EPS, `expected angle ${actual} near ${expected}, delta ${delta}`);
};

{
  const guidance = computeApproachGuidance({
    dx: 1_000_000_000,
    dy: 0,
    relVx: 0,
    relVy: 0,
    maxAcceleration: 10,
  });

  assert.equal(guidance.phase, "accelerate");
  assertAngleNear(guidance.targetHeading, Math.PI);
  assert.ok(guidance.throttlePercent > 0);
}

{
  const guidance = computeApproachGuidance({
    dx: 1_000_000,
    dy: 0,
    relVx: -5_000,
    relVy: 0,
    maxAcceleration: 10,
  });

  assert.equal(guidance.phase, "match");
  assertAngleNear(guidance.targetHeading, 0); // burn against incoming relative velocity
  assert.ok(guidance.throttlePercent > 0);
}

{
  const guidance = computeApproachGuidance({
    dx: 500_000,
    dy: 0,
    relVx: -10,
    relVy: 0,
    maxAcceleration: 10,
  });

  assert.equal(guidance.phase, "arrived");
  assert.equal(guidance.throttlePercent, 0);
}

{
  const guidance = computeTransferGuidance({
    dx: 100_000_000,
    dy: 0,
    relVx: 0,
    relVy: 0,
    maxAcceleration: 20,
    targetMass: 5.972e24,
    bodyRadius: 6.371e6,
    terminalDistance: 20_000_000,
    terminalSpeed: 500,
  });

  assert.equal(guidance.phase, "accelerate");
  assertAngleNear(guidance.targetHeading, Math.PI);
  assert.ok(guidance.throttlePercent > 0);
}

{
  const guidance = computeTransferGuidance({
    dx: 100_000_000,
    dy: 0,
    relVx: -80_000,
    relVy: 0,
    maxAcceleration: 20,
    targetMass: 5.972e24,
    bodyRadius: 6.371e6,
    terminalDistance: 20_000_000,
    terminalSpeed: 500,
  });

  assert.equal(guidance.phase, "brake");
  assertAngleNear(guidance.targetHeading, 0);
  assert.ok(guidance.throttlePercent > 0);
}
