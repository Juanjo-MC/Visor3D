export class Shaders {

    // Slope
    static slope(alpha = 0.2) {
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

    // Hillshade
    static hillshade(alpha = 0.4) {

        return new Cesium.Material({
            fabric: {
                type: 'Hillshade',

                uniforms: {
                    u_shadowOpacity: alpha,
                    u_sharpness: 3.0,
                },

                source: `
						czm_material czm_getMaterial(czm_materialInput materialInput) {
							czm_material material = czm_getDefaultMaterial(materialInput);
	
							// Get the normal from the terrain
							vec3 n = materialInput.normalEC;
	
							// Sunlight direction (NW)
							vec3 L = normalize(vec3(-1.0, 1.0, 1.2));
	
							// Slope intensity math
							float dotProduct = dot(n, L);
							float intensity = clamp(dotProduct, 0.0, 1.0);
	
							// Higher power means shadows stay "tighter" to the steep areas
							intensity = pow(intensity, u_sharpness);
	
							// Color and Transparency
							// We keep the shadow pure black but make it much more transparent
							material.diffuse = vec3(0.0);
							material.alpha = (1.0 - intensity) * u_shadowOpacity;
	
							return material;
						}
					`
            }
        });
    }

    // Line Art
    static lineArt(alpha = 0.5) {
        return new Cesium.Material({
            fabric: {
                type: 'LineArt',
                uniforms: {
                    u_lineColor: new Cesium.Color(0.0, 0.0, 0.0, 0.0),
                    u_bgColor: new Cesium.Color(0.95, 0.97, 1.0, 0.0),
                    u_sensitivity: 0.2 // Lower = fewer lines, Higher = more detail
                },
                source: `
                    czm_material czm_getMaterial(czm_materialInput materialInput) {
                        czm_material material = czm_getDefaultMaterial(materialInput);

                        // Get the normal from the terrain
                        vec3 n = materialInput.normalEC;

                        // Calculate the "Sharpness" of the terrain
                        // We use the derivatives of the normal to find where the terrain 'bends'
                        float delta = length(dFdx(n)) + length(dFdy(n));
                
                        // Create the Line Art effect
                        // If delta is high, it's a ridge (lineColor). If low, it's flat (bgColor).
                        float lineFactor = smoothstep(0.01, u_sensitivity, delta);
                
                        // Fake a gentle 'top-down' shadow so it's not purely flat white
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