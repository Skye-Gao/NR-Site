uniform float uTime;
uniform float uDeltaTime;
uniform sampler2D uBase;
uniform float uDecaySpeed;

void main()
{
    vec2 uv = gl_FragCoord.xy / resolution.xy;

    vec4 particle = texture(uParticles, uv);
    vec4 base = texture(uBase, uv);

    float life = particle.a + uDeltaTime * uDecaySpeed;
    particle.xyz = base.xyz;

    if(life > 1.0)
    {
        particle.xyz = base.xyz;
        life = fract(sin(dot(uv + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    }

    particle.a = life;

    gl_FragColor = particle;
}
