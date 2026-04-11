uniform float uTime;
uniform float uPointScale;
uniform float uSpikePointMul;
/** Raging-sea style layers (see Three.js Journey — “Raging sea”) */
uniform float uBigWavesElevation;
uniform float uBigWavesFrequency;
uniform float uBigWavesSpeed;
uniform float uSmallWavesElevation;
uniform float uSmallWavesFrequency;
uniform float uSmallWavesSpeed;
/** How much static procedural bed height is mixed in (0 = pure waves). */
uniform float uTerrainRelief;

attribute float aKind;
attribute float aAlong;
/** Spike column base Y; bed uses same as position.y (unused in bed branch). */
attribute float aBaseY;

varying float vHeight;
varying float vLift;
varying float vKind;
varying float vAlong;

float seaElevation(float x, float z, float t) {
  // Big rolling waves: product of sines → moving crests (Journey pattern).
  float bx = x * uBigWavesFrequency + t * uBigWavesSpeed;
  float bz = z * uBigWavesFrequency + t * uBigWavesSpeed * 0.85;
  float big = sin(bx) * sin(bz) * uBigWavesElevation;

  // Smaller chop, different phase speeds.
  float sx = x * uSmallWavesFrequency - t * uSmallWavesSpeed;
  float sz = z * uSmallWavesFrequency * 1.12 + t * uSmallWavesSpeed * 0.73;
  float small =
    (sin(sx) * 0.55 + sin(sz) * 0.45 + sin((x + z) * uSmallWavesFrequency * 1.9 + t * uSmallWavesSpeed * 1.15) * 0.35) *
    uSmallWavesElevation;

  return big + small;
}

void main() {
  float x = position.x;
  float z = position.z;
  float W = seaElevation(x, z, uTime);

  float y;
  if (aKind > 0.5) {
    // Spikes: ride the wave at this XZ, keep vertical extent above column base.
    y = W + (position.y - aBaseY);
  } else {
    // Bed: animated sea + scaled static dunes for grain.
    y = W + position.y * uTerrainRelief;
  }

  vKind = aKind;
  vAlong = aAlong;
  float waveDenom = max(uBigWavesElevation + uSmallWavesElevation, 0.35);
  vLift = clamp(W / waveDenom, -1.35, 1.35);
  vHeight = clamp(y / max(waveDenom + uTerrainRelief * 1.05 + 0.2, 0.55), 0.0, 1.0);

  vec4 mvPosition = modelViewMatrix * vec4(x, y, z, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float dist = max(-mvPosition.z, 1.0);
  float ps = uPointScale * (400.0 / dist);
  if (aKind > 0.5) {
    ps *= uSpikePointMul;
  }
  gl_PointSize = clamp(ps, 0.8, 16.0);
}
