/**
 * Shared world-space Y for the floor and tree roots. Slightly below the
 * livestream caption (~y -0.33) so the label is not clipped; keep as close
 * to 0 as possible to avoid a large gap under the text.
 */
export const WORLD_GROUND_LEVEL_Y = -0.55

/**
 * Mutable walk camera: eye height above the floor plane (world Y = floor + this value).
 * Tweaked in debug (Camera folder) and used via getWalkEyeWorldY().
 */
export const walkCamera = {
  eyeHeightAboveGround: 1.75
}

export function getWalkEyeWorldY() {
  return walkCamera.eyeHeightAboveGround + WORLD_GROUND_LEVEL_Y
}
