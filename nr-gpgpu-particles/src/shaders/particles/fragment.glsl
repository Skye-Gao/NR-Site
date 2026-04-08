varying vec3 vColor;

void main()
{
    // Disc shape
    float distanceToCenter = length(gl_PointCoord - vec2(0.5));
    if(distanceToCenter > 0.5)
        discard;

    float alpha = smoothstep(0.5, 0.0, distanceToCenter);
    gl_FragColor = vec4(vColor, alpha);

    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}
