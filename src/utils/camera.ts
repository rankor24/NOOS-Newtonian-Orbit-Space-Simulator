export interface Pan2D {
  x: number;
  y: number;
}

export interface PointerAnchoredPanInput {
  pointerX: number;
  pointerY: number;
  viewportWidth: number;
  viewportHeight: number;
  pan: Pan2D;
  oldScale: number;
  newScale: number;
}

/**
 * Returns pan offset that keeps the same world point under the mouse after zoom.
 */
export function getPointerAnchoredPan({
  pointerX,
  pointerY,
  viewportWidth,
  viewportHeight,
  pan,
  oldScale,
  newScale,
}: PointerAnchoredPanInput): Pan2D {
  const safeOldScale = oldScale || 1;
  const safeNewScale = newScale || safeOldScale;
  const worldOffsetX = (pointerX - viewportWidth / 2 - pan.x) / safeOldScale;
  const worldOffsetY = (pointerY - viewportHeight / 2 - pan.y) / safeOldScale;

  return {
    x: pointerX - viewportWidth / 2 - worldOffsetX * safeNewScale,
    y: pointerY - viewportHeight / 2 - worldOffsetY * safeNewScale,
  };
}
