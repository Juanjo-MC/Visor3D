export class Shaders {

	// Slope
	static slope(alpha = 0.2) {
		//cap alpha to 0.1/1 range
		alpha = Math.max(0.1, Math.min(1, alpha));

		return new Cesium.Material({
			fabric: {
				type: 'Slope',
				source: `
					czm_material czm_getMaterial(czm_materialInput materialInput) {
						czm_material material = czm_getDefaultMaterial(materialInput);
						float s = materialInput.slope;
						float degrees = s * (180.0 / 3.14159265);
						vec4 color = vec4(0.0);

						if(degrees >= 20.0 && degrees < 27.0) {
							color = vec4(0.0, 1.0, 0.0, ${alpha.toFixed(1)}); // Green
						}else if(degrees >= 27.0 && degrees < 30.0) {
							color = vec4(0.93, 0.96, 0.19, ${alpha.toFixed(1)}); // Yellow
						} else if(degrees >= 30.0 && degrees < 32.0){
							color = vec4(0.93, 0.74, 0.2, ${alpha.toFixed(1)}); // Light Orange
						} else if(degrees >= 32.0 && degrees < 35.0) {
							color = vec4(1.0, 0.47, 0.0, ${alpha.toFixed(1)}); // Orange
						} else if(degrees >= 35.0 && degrees < 46.0) {
							color = vec4(0.97, 0.1, 0.1, ${alpha.toFixed(1)}); // Red
						} else if(degrees >= 46.0 && degrees < 50.0) {
							color = vec4(0.53, 0.0, 0.88, ${alpha.toFixed(1)}); // Purple
						} else if(degrees >= 50.0 && degrees < 60.0) {
							color = vec4(0.0, 0.0, 1.0, ${alpha.toFixed(1)}); // Blue
						} else if (degrees >= 60.0){
							color = vec4(0.1, 0.1, 0.1, ${alpha.toFixed(1)}); // Black
						}

						material.diffuse = color.rgb;
						material.alpha = color.a;
						return material;
					}
				`
			}
		});
	}

	// Line Art
	static lineArt(sensitivity = 0.2, alpha = 0.5) {
		// cap alpha to 0.5/1 range		
		alpha = Math.max(0.5, Math.min(1, alpha));
		// cap sensitivity to 0.2/0.5 range
		sensitivity = Math.max(0.2, Math.min(0.5, sensitivity));

		return new Cesium.Material({
			fabric: {
				type: 'LineArt',
				uniforms: {
					u_lineColor: new Cesium.Color(0.15, 0.15, 0.2, 0.0),
					u_bgColor: new Cesium.Color(0.95, 0.97, 1.0, 0.0),
					u_sensitivity: sensitivity // Lower = more detail (sensitive), Higher = fewer lines (selective)
				},
				source: `
                    czm_material czm_getMaterial(czm_materialInput materialInput) {
                        czm_material material = czm_getDefaultMaterial(materialInput);
                        vec3 n = materialInput.normalEC;
                        float delta = length(dFdx(n)) + length(dFdy(n));
                        float lineFactor = smoothstep(0.01, u_sensitivity, delta);
                        float ambient = clamp(n.z, 0.8, 1.0); 
                        vec3 finalColor = mix(u_bgColor.rgb * ambient, u_lineColor.rgb, lineFactor);
                        material.diffuse = finalColor;
                        material.alpha = ${alpha.toFixed(1)};                
                        return material;
                    }
                `
			}
		});
	}
}