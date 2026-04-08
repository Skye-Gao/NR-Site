uniform float uSize;
uniform vec2 uResolution;
uniform sampler2D uParticlesTexture;

attribute vec2 aParticlesUv;
attribute float aSize;
attribute vec3 aColor;

varying vec3 vColor;

void main()
{
    // Read particle position from the GPGPU texture
    vec4 particle = texture(uParticlesTexture, aParticlesUv);

    // Final position
    vec4 modelPosition = modelMatrix * vec4(particle.xyz, 1.0);
    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;

    // Size with perspective
    float sizeIn = smoothstep(0.0, 0.1, particle.a);
    float sizeOut = 1.0 - smoothstep(0.7, 1.0, particle.a);
    float size = min(sizeIn, sizeOut);

    gl_PointSize = uSize * aSize * size * uResolution.y;
    gl_PointSize *= (1.0 / -viewPosition.z);

    // Pass color to fragment
    vColor = aColor;
}
