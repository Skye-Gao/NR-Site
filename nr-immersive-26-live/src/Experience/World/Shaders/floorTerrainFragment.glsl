uniform vec3 uColorDark;
uniform vec3 uColorBright;
uniform vec3 uColorSpike;
uniform float uOpacity;

varying float vHeight;
varying float vLift;
varying float vKind;
varying float vAlong;

void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);

  if (vKind > 0.5) {
    if (d > 0.42) discard;
    float soft = 1.0 - smoothstep(0.22, 0.42, d);
    float tip = mix(1.0, 0.88, smoothstep(0.75, 1.0, vAlong));
    vec3 col = uColorSpike * tip;
    float alpha = soft * uOpacity * 0.94;
    gl_FragColor = vec4(col, alpha);
  } else {
    if (d > 0.5) discard;
    float core = 1.0 - smoothstep(0.0, 0.4, d);
    float soft = 1.0 - smoothstep(0.26, 0.5, d);
    float a = mix(0.55, 1.0, core) * soft;

    float peak = pow(clamp(vHeight, 0.0, 1.0), 0.4);
    float ridge = clamp(vLift * 0.55 + 0.48, 0.0, 1.0);
    float tone = clamp(peak * 0.78 + ridge * 0.32, 0.0, 1.0);

    vec3 col = mix(uColorDark, uColorBright, tone);
    float alpha = a * uOpacity * mix(0.58, 1.0, peak);

    gl_FragColor = vec4(col, alpha);
  }

  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
