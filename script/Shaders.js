export class Shaders {

	// Slope
	static slope(alpha = 0.2) {
		//cap alpha to 0.1/1 range
		alpha = Math.max(0.1, Math.min(1, alpha));

		return new Cesium.Material({
			fabric: {
				type: 'Slope',

				uniforms: {
					u_alpha: alpha
				},

				source: `
					czm_material czm_getMaterial(czm_materialInput materialInput) {
						czm_material material = czm_getDefaultMaterial(materialInput);
						float degrees = materialInput.slope * (180.0 / 3.14159265);

						// Calculate thresholds (1.0 if above, 0.0 if below)
						float m20 = step(20.0, degrees);
						float m27 = step(27.0, degrees);
						float m30 = step(30.0, degrees);
						float m32 = step(32.0, degrees);
						float m35 = step(35.0, degrees);
						float m46 = step(46.0, degrees);
						float m50 = step(50.0, degrees);
						float m60 = step(60.0, degrees);

						// Layer the colors
						vec3 color = vec3(0.0);
						color = mix(color, vec3(0.0, 1.0, 0.0), m20);    // Green
						color = mix(color, vec3(0.93, 0.96, 0.19), m27); // Yellow
						color = mix(color, vec3(0.93, 0.74, 0.2), m30);  // Light Orange
						color = mix(color, vec3(1.0, 0.47, 0.0), m32);   // Orange
						color = mix(color, vec3(0.97, 0.1, 0.1), m35);   // Red
						color = mix(color, vec3(0.53, 0.0, 0.88), m46);  // Purple
						color = mix(color, vec3(0.0, 0.0, 1.0), m50);    // Blue
						color = mix(color, vec3(0.1, 0.1, 0.1), m60);    // Black

						material.diffuse = color;
						// Alpha is 0.0 if below 20 degrees, u_alpha otherwise
						material.alpha = m20 * u_alpha;
						return material;
					}
				`
			}
		});
	}

	// Line Art
	static lineArt(sensitivity = 0.2, alpha = 0.5) {
		// cap sensitivity to 0.2/0.5 range
		sensitivity = Math.max(0.2, Math.min(0.5, sensitivity));
		// cap alpha to 0.5/1 range		
		alpha = Math.max(0.5, Math.min(1, alpha));

		return new Cesium.Material({
			fabric: {
				type: 'LineArt',

				uniforms: {
					u_lineColor: new Cesium.Cartesian3(0.15, 0.15, 0.2),
					u_bgColor: new Cesium.Cartesian3(0.95, 0.97, 1.0),
					u_sensitivity: sensitivity, // Lower = more detail (sensitive), Higher = fewer lines (selective)
					u_alpha: alpha
				},

				source: `
                    czm_material czm_getMaterial(czm_materialInput materialInput) {
                        czm_material material = czm_getDefaultMaterial(materialInput);
                        vec3 n = materialInput.normalEC;
                        float delta = length(dFdx(n)) + length(dFdy(n));
                        float lineFactor = smoothstep(0.01, u_sensitivity, delta);
                        float ambient = clamp(n.z, 0.8, 1.0);
                        vec3 finalColor = mix(u_bgColor * ambient, u_lineColor, lineFactor);
                        material.diffuse = finalColor;
                        material.alpha = u_alpha;
                        return material;
                    }
                `
			}
		});
	}
}