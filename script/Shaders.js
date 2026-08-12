export class Shaders {

	// Slope
	static slope(alpha = 0.2) {
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
	static lineArt(sensitivity = 0.2,) {
		sensitivity = Math.max(0.2, Math.min(0.5, sensitivity));

		return new Cesium.Material({
			fabric: {
				type: 'LineArt',

				uniforms: {
					u_lineColor: new Cesium.Cartesian3(0.15, 0.15, 0.2),
					u_bgColor: new Cesium.Cartesian3(1.0, 1.0, 1.0),
					u_sensitivity: sensitivity, // Lower = more detail (sensitive), Higher = fewer lines (selective)
					u_alpha: 0.5
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

	// Hipsometric tint
	static hipsometricTint(minHeight = 0, maxHeight = 5000, alpha = 0.5) {
		alpha = Math.max(0.1, Math.min(1, alpha));

		return new Cesium.Material({
			fabric: {
				type: 'hHipsometricTint',

				uniforms: {
					u_minHeight: parseFloat(minHeight),
					u_maxHeight: parseFloat(maxHeight),
					u_alpha: alpha
				},
				
				source: `
					czm_material czm_getMaterial(czm_materialInput materialInput) {
						czm_material material = czm_getDefaultMaterial(materialInput);
						
						// 1. Safeguard height range calculation
						float heightRange = u_maxHeight - u_minHeight;
						if (heightRange <= 0.0) { heightRange = 1.0; }
						
						// 2. Safely normalize height
						float h = clamp((materialInput.height - u_minHeight) / heightRange, 0.0, 1.0);
						
						// 3. Define the traditional ramp color nodes mathematically
						// Heights mapped relative to standard range thresholds
						vec3 c0  = vec3(0.176, 0.416, 0.310); // #2D6A4F (minHeight)
						vec3 c1  = vec3(0.322, 0.718, 0.533); // #52B788 (0.0m)
						vec3 c2  = vec3(0.455, 0.776, 0.616); // #74C69D (200.0m)
						vec3 c3  = vec3(0.847, 0.953, 0.863); // #D8F3DC (500.0m)
						vec3 c4  = vec3(0.957, 0.886, 0.522); // #F4E285 (1000.0m)
						vec3 c5  = vec3(0.878, 0.624, 0.404); // #E09F67 (1500.0m)
						vec3 c6  = vec3(0.655, 0.427, 0.376); // #A76D60 (2000.0m)
						vec3 c7  = vec3(0.498, 0.310, 0.141); // #7F4F24 (3000.0m)
						vec3 c8  = vec3(0.827, 0.827, 0.827); // #D3D3D3 (4000.0m)
						vec3 c9  = vec3(1.000, 1.000, 1.000); // #FFFFFF (maxHeight)

						// Helper to map values dynamically to a 0.0 - 1.0 linear step range
						// Mapped to match your original 'd()' canvas stop distribution
						float r0 = clamp((0.0 - u_minHeight) / heightRange, 0.0, 1.0);
						float r1 = clamp((200.0 - u_minHeight) / heightRange, 0.0, 1.0);
						float r2 = clamp((500.0 - u_minHeight) / heightRange, 0.0, 1.0);
						float r3 = clamp((1000.0 - u_minHeight) / heightRange, 0.0, 1.0);
						float r4 = clamp((1500.0 - u_minHeight) / heightRange, 0.0, 1.0);
						float r5 = clamp((2000.0 - u_minHeight) / heightRange, 0.0, 1.0);
						float r6 = clamp((3000.0 - u_minHeight) / heightRange, 0.0, 1.0);
						float r7 = clamp((4000.0 - u_minHeight) / heightRange, 0.0, 1.0);

						// 4. Interpolate seamlessly across the intervals
						vec3 color = c0;
						color = mix(color, c1, smoothstep(0.0, r0, h));
						color = mix(color, c2, smoothstep(r0, r1, h));
						color = mix(color, c3, smoothstep(r1, r2, h));
						color = mix(color, c4, smoothstep(r2, r3, h));
						color = mix(color, c5, smoothstep(r3, r4, h));
						color = mix(color, c6, smoothstep(r4, r5, h));
						color = mix(color, c7, smoothstep(r5, r6, h));
						color = mix(color, c8, smoothstep(r6, r7, h));
						color = mix(color, c9, smoothstep(r7, 1.0, h));

						material.diffuse = color;
						material.alpha = u_alpha;
						
						return material;
					}
				`
			}
		});
	}
}