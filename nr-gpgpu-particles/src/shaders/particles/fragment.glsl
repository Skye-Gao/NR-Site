varying vec3 vColor;
varying float vRigidity;

void main()
{
    // Disc shape
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    if(distanceToCenter > 0.5)
        discard;

    float softness = mix(0.16, 0.06, vRigidity);
    float disc = 1.0 - smoothstep(0.5 - softness, 0.5, distanceToCenter);
    float alpha = disc * mix(0.55, 1.0, vRigidity);
    gl_FragColor = vec4(vColor, alpha);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
