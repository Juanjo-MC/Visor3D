export class ViewerService {
	static #viewer;
	static #canvasEventHandler;

	static rotationAxis = Object.freeze({
		HEADING: 'heading',
		PITCH: 'pitch',
	});

	static rotationDirection = Object.freeze({
		POSITIVE: 1,
		NEGATIVE: -1,
	});

	static #isRotating = false;
	static #rotationSpeed = 0	// Radians per second
	static #lastFrameTime = null;

	static get viewer() {
		return ViewerService.#viewer;
	}

	static async initialize(viewerContainer) {
		const viewer = new Cesium.Viewer(viewerContainer, {
			imageryProvider: false, // This is necessary to prevent the viewer from downloading tiles from Bing
			imageryProviderViewModels: ViewerService.#getImageryProviders(),
			terrainProvider: await ViewerService.#getTerrainProvider(),
			navigationInstructionsInitiallyVisible: true,
			animation: false,
			homeButton: false,
			geocoder: false,
			timeline: false,
			scene3DOnly: true,
			selectionIndicator: false,
			requestRenderMode: true,
		});

		viewer.baseLayerPicker.viewModel.terrainProviderViewModels.removeAll();
		viewer.camera.percentageChanged = 0.05;
		viewer.resolutionScale = Math.min(window.devicePixelRatio, 2.0);

		// On mobile devices, cap camera movement to 0.75% of the window size per frame
		// This prevents gestures, like fast swipes or drags, from moving the camera too far, providing a more controlled feel
		if (navigator.userAgent.includes('Mobile')) {
			viewer.scene.screenSpaceCameraController.maximumMovementRatio = 0.0075;
		}

		viewer.scene.screenSpaceCameraController.minimumCollisionTerrainHeight = 5000;
		viewer.scene.screenSpaceCameraController.inertiaSpin = 0;
		viewer.scene.screenSpaceCameraController.inertiaTranslate = 0;
		viewer.scene.screenSpaceCameraController.inertiaZoom = 0;
		viewer.scene.globe.depthTestAgainstTerrain = true;
		viewer.scene.globe.maximumScreenSpaceError = 1.5;
		viewer.scene.globe.loadingDescendantLimit = 50;
		viewer.scene.postProcessStages.fxaa.enabled = false;
		ViewerService.#viewer = viewer;
	}

	static #getImageryProviders() {
		const imageryViewModels = [];

		// PNOA
		imageryViewModels.push(new Cesium.ProviderViewModel({
			name: 'PNOA',
			tooltip: 'Plan Nacional de Ortofotografía Aérea (máxima actualidad)',
			iconUrl: 'https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/15/15945/20765.jpeg',

			creationFunction: () => {
				return new Cesium.UrlTemplateImageryProvider({
					url: 'https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{reverseY}.jpeg',
					minimumLevel: 1,
					maximumLevel: 19,
					hasAlphaChannel: false,
				});
			}
		}));

		// Mapa topográfico IGN
		imageryViewModels.push(new Cesium.ProviderViewModel({
			name: 'MTN',
			tooltip: 'Mapa Topográfico Nacional',
			iconUrl: 'https://tms-mapa-raster.ign.es/1.0.0/mapa-raster/15/15945/20765.jpeg',

			creationFunction: () => {
				return new Cesium.UrlTemplateImageryProvider({
					url: 'https://tms-mapa-raster.ign.es/1.0.0/mapa-raster/{z}/{x}/{reverseY}.jpeg',
					minimumLevel: 5,
					maximumLevel: 17,
					hasAlphaChannel: false,
				});
			}
		}));

		// Mapa base IGN
		imageryViewModels.push(new Cesium.ProviderViewModel({
			name: 'Mapa base',
			tooltip: 'Mapa base',
			iconUrl: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/15/15945/20765.jpeg',

			creationFunction: () => {
				return new Cesium.UrlTemplateImageryProvider({
					url: 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{reverseY}.jpeg',
					minimumLevel: 5,
					maximumLevel: 17,
					hasAlphaChannel: false,
				});
			}
		}));

		// Mapa LIDAR IGN
		imageryViewModels.push(new Cesium.ProviderViewModel({
			name: 'Mapa LIDAR',
			tooltip: 'Mapa LIDAR',
			iconUrl: 'https://wmts-mapa-lidar.idee.es/lidar?Layer=EL.GridCoverageDSM&Style=default&TileMatrixSet=EPSG:3857&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix=15&TileCol=15945&TileRow=12002',

			creationFunction: () => {
				return new Cesium.UrlTemplateImageryProvider({
					url: 'https://wmts-mapa-lidar.idee.es/lidar?Layer=EL.GridCoverageDSM&Style=default&TileMatrixSet=EPSG:3857&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={z}&TileCol={x}&TileRow={y}',
					minimumLevel: 5,
					maximumLevel: 17,
					hasAlphaChannel: false,
				});
			}
		}));

		return imageryViewModels;
	}

	static async #getTerrainProvider() {
		return await Cesium.CesiumTerrainProvider.fromUrl("https://qm-mdt.idee.es/1.0.0/terrain", {
			requestVertexNormals: true,
			credit: new Cesium.Credit("<a href='https://www.ign.es/web/ign/portal/qsm-cnig' target='_blank'>Instituto Geográfico Nacional (IGN)</a>"),
		})
	}

	static get currentImageryName() {
		return ViewerService.#viewer.baseLayerPicker.viewModel.selectedImagery.name;
	}

	static setImagery(imageryName) {
		const models = ViewerService.#viewer.baseLayerPicker.viewModel.imageryProviderViewModels;
		const match = models.find(model => model.name === imageryName);

		if (match) {
			ViewerService.#viewer.baseLayerPicker.viewModel.selectedImagery = match;
		}
	}

	static flyToPosition(lat, lon, cameraAltitude, cameraHeading, cameraPitch, duration = 5) {
		ViewerService.#viewer.camera.flyTo({
			destination: Cesium.Cartesian3.fromDegrees(lon, lat, cameraAltitude),
			duration: duration,
			easingFunction: Cesium.EasingFunction.SINUSOIDAL_OUT,
			complete: () => ViewerService.#viewer.scene.requestRender(),

			orientation: {
				heading: Cesium.Math.toRadians(cameraHeading),
				pitch: Cesium.Math.toRadians(cameraPitch),
			}
		});
	}

	static flyToDataSource(dataSource) {
		ViewerService.#viewer.flyTo(dataSource);
		ViewerService.#viewer.scene.requestRender();
	}

	static async getElevation(lat, lon) {
		const position = [Cesium.Cartographic.fromDegrees(lon, lat)];
		await Cesium.sampleTerrainMostDetailed(ViewerService.#viewer.terrainProvider, position);
		return position[0].height;
	}

	static async getSlopeDetails(lat, lon) {
		const viewer = ViewerService.#viewer;
		const terrainProvider = viewer.terrainProvider;

		const offset = 0.00001;
		const positions = [
			Cesium.Cartographic.fromDegrees(lon, lat),
			Cesium.Cartographic.fromDegrees(lon + offset, lat),
			Cesium.Cartographic.fromDegrees(lon, lat + offset)
		];

		await Cesium.sampleTerrainMostDetailed(terrainProvider, positions);
		const p0 = Cesium.Cartographic.toCartesian(positions[0]);
		const p1 = Cesium.Cartographic.toCartesian(positions[1]);
		const p2 = Cesium.Cartographic.toCartesian(positions[2]);

		// Calculate the Surface Normal using the cross product
		// Vector A = p1 - p0, Vector B = p2 - p0
		const v0 = Cesium.Cartesian3.subtract(p1, p0, new Cesium.Cartesian3());
		const v1 = Cesium.Cartesian3.subtract(p2, p0, new Cesium.Cartesian3());

		// The cross product gives us the vector perpendicular to the triangle
		const surfaceNormal = Cesium.Cartesian3.cross(v0, v1, new Cesium.Cartesian3());
		Cesium.Cartesian3.normalize(surfaceNormal, surfaceNormal);

		// Get the local "Up" vector (Ellipsoid Normal)
		const upVector = viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(p0);

		// Calculate the slope angle
		const angleInRadians = Cesium.Cartesian3.angleBetween(surfaceNormal, upVector);
		const slopeDegrees = Cesium.Math.toDegrees(angleInRadians);

		return {
			height: positions[0].height,
			slope: slopeDegrees,
			aspect: this.#calculateAspect(surfaceNormal, v0, v1, upVector, p0),
		};
	}

	static #calculateAspect(surfaceNormal, v0, v1, upVector, p0) {
		// Define Local North (Vector from point towards North Pole)
		const northPole = new Cesium.Cartesian3(0.0, 0.0, 6378137.0);
		let northDir = Cesium.Cartesian3.subtract(northPole, p0, new Cesium.Cartesian3());

		// Project North onto the horizontal tangent plane
		let dotNorth = Cesium.Cartesian3.dot(northDir, upVector);

		let projNorth = Cesium.Cartesian3.add(
			northDir,
			Cesium.Cartesian3.multiplyByScalar(upVector, -dotNorth, new Cesium.Cartesian3()),
			new Cesium.Cartesian3()
		);

		Cesium.Cartesian3.normalize(projNorth, projNorth);

		// Define Local East (Perpendicular to North and Up)
		let eastDir = Cesium.Cartesian3.cross(upVector, projNorth, new Cesium.Cartesian3());
		Cesium.Cartesian3.normalize(eastDir, eastDir);

		// Project the Terrain Surface Normal onto the horizontal plane
		let dotNormal = Cesium.Cartesian3.dot(surfaceNormal, upVector);

		let horizontalNormal = Cesium.Cartesian3.add(
			surfaceNormal,
			Cesium.Cartesian3.multiplyByScalar(upVector, -dotNormal, new Cesium.Cartesian3()),
			new Cesium.Cartesian3()
		);

		Cesium.Cartesian3.normalize(horizontalNormal, horizontalNormal);

		// 5. Compass Bearing Calculation
		let x = Cesium.Cartesian3.dot(horizontalNormal, projNorth); // North component
		let y = Cesium.Cartesian3.dot(horizontalNormal, eastDir);  // East component
		let aspectDegrees = Cesium.Math.toDegrees(Math.atan2(-y, x));
		return (aspectDegrees + 360.0) % 360.0;
	}

	static getCameraPosition() { // {lat, lon, altitude, heading, pitch}
		const camera = ViewerService.#viewer.camera;

		const cameraPosition = {
			lat: Cesium.Math.toDegrees(camera.positionCartographic.latitude),
			lon: Cesium.Math.toDegrees(camera.positionCartographic.longitude),
			altitude: camera.positionCartographic.height,
			heading: Cesium.Math.toDegrees(camera.heading),
			pitch: Cesium.Math.toDegrees(camera.pitch),
		};

		return cameraPosition;
	}

	static setCameraHeading(heading) {
		const currentCameraPosition = ViewerService.#viewer.camera.positionWC;
		const currentCameraPitch = ViewerService.#viewer.camera.pitch;

		ViewerService.#viewer.camera.setView({
			destination: currentCameraPosition,
			orientation:{
				heading: Cesium.Math.toRadians(heading),
				pitch: currentCameraPitch,
				roll: 0,
			}
		});
	}

	static getCartographicScreenPosition(windowPosition) { // {lat, lon}
		const scene = ViewerService.#viewer.scene;
		const globe = scene.globe;
		const ray = scene.camera.getPickRay(windowPosition);

		if (ray) {
			const cartesian = globe.pick(ray, scene);

			if (cartesian) {
				const cartographicPosition = Cesium.Cartographic.fromCartesian(cartesian);
				return {
					lat: Cesium.Math.toDegrees(cartographicPosition.latitude),
					lon: Cesium.Math.toDegrees(cartographicPosition.longitude)
				};
			}
		}
	}

	static refreshScene() {
		ViewerService.viewer.scene.requestRender();
	}

	static startRotation(axis, direction, speed = 10) {
		if (ViewerService.#isRotating) {
			return;
		}

		ViewerService.#isRotating = true;
		ViewerService.#rotationSpeed = Cesium.Math.toRadians(speed);
		ViewerService.#lastFrameTime = performance.now();

		const step = (time) => {
			if (!ViewerService.#isRotating) {
				return;
			}

			const delta = (time - ViewerService.#lastFrameTime) / 1000;
			ViewerService.#lastFrameTime = time;
			const camera = ViewerService.#viewer.camera;
			let newHeading = camera.heading;
			let newPitch = camera.pitch;

			if (axis === ViewerService.rotationAxis.HEADING) {
				newHeading += direction * ViewerService.#rotationSpeed * delta;
			}
			else if (axis === ViewerService.rotationAxis.PITCH) {
				newPitch += direction * ViewerService.#rotationSpeed * delta;

				if (newPitch < -Math.PI / 2.0 || newPitch > Math.PI / 2.0) {
					ViewerService.stopRotation();
					return;
				}
			}

			camera.setView({
				destination: camera.positionWC,
				orientation: {
					heading: newHeading,
					pitch: newPitch,
					roll: camera.roll,
				},
			});

			ViewerService.#viewer.scene.requestRender();
			requestAnimationFrame(step);
		};

		requestAnimationFrame(step);
	}

	static stopRotation() {
		ViewerService.#isRotating = false;
		ViewerService.#rotationSpeed = 0;
		ViewerService.#lastFrameTime = null;
	}

	static toggleCameraGestures(enabled) {
		const controller = ViewerService.#viewer.scene.screenSpaceCameraController;
		controller.enableRotate = enabled;
		controller.enableTranslate = enabled;
		controller.enableZoom = enabled;
		controller.enableTilt = enabled;
		controller.enableLook = enabled;
	}

	// Globe materials
	static clearGlobeMaterial() {
		ViewerService.#viewer.scene.globe.material = undefined;
	}

	static showSlope(alpha = 0.2) {
		ViewerService.#viewer.scene.globe.material = ViewerService.#slopeMaterial(alpha);
	}

	// Slope
	static #slopeMaterial(alpha = 0.2) {
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
							color = vec4(0.0, 1.0, 0.0, ${alpha}); // Green
						}else if(degrees >= 27.0 && degrees < 30.0) {
							color = vec4(0.93, 0.96, 0.19, ${alpha}); // Yellow
						} else if(degrees >= 30.0 && degrees < 32.0){
							color = vec4(0.93, 0.74, 0.2, ${alpha}); // Light Orange
						} else if(degrees >= 32.0 && degrees < 35.0) {
							color = vec4(1.0, 0.47, 0.0, ${alpha}); // Orange
						} else if(degrees >= 35.0 && degrees < 46.0) {
							color = vec4(0.97, 0.1, 0.1, ${alpha}); // Red
						} else if(degrees >= 46.0 && degrees < 50.0) {
							color = vec4(0.53, 0.0, 0.88, ${alpha}); // Purple
						} else if(degrees >= 50.0 && degrees < 60.0) {
							color = vec4(0.0, 0.0, 1.0, ${alpha}); // Blue
						} else if (degrees >= 60.0){
							color = vec4(0.1, 0.1, 0.1, ${alpha}); // Black
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
	static hillshadeMaterial() {

		return new Cesium.Material({
			fabric: {
				type: 'Hillshade',

				uniforms: {
					u_shadowOpacity: 0.4,
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

	// Event handlers
	static #getCanvasEventHandler() {
		if (!ViewerService.#canvasEventHandler) {
			ViewerService.#canvasEventHandler = new Cesium.ScreenSpaceEventHandler(ViewerService.#viewer.scene.canvas);
		}

		return ViewerService.#canvasEventHandler;
	}

	static onCameraChange(callbackFunction) {
		ViewerService.#viewer.camera.changed.addEventListener(callbackFunction);
	}

	static onCameraStopMove(callbackFunction) {
		ViewerService.#viewer.camera.moveEnd.addEventListener(callbackFunction);
	}

	static onCanvasClick(callbackFunction) {
		ViewerService.#getCanvasEventHandler().setInputAction((click) => callbackFunction(click), Cesium.ScreenSpaceEventType.LEFT_CLICK);
	}

	static onCanvasMouseDown(callbackFunction) {
		ViewerService.#getCanvasEventHandler().setInputAction((click) => callbackFunction(click), Cesium.ScreenSpaceEventType.LEFT_DOWN);
	}

	static onCanvasMouseUp(callbackFunction) {
		ViewerService.#getCanvasEventHandler().setInputAction((click) => callbackFunction(click), Cesium.ScreenSpaceEventType.LEFT_UP);
	}

	static onCanvasMouseMove(callbackFunction) {
		ViewerService.#getCanvasEventHandler().setInputAction((movement) => callbackFunction(movement), Cesium.ScreenSpaceEventType.MOUSE_MOVE);
	}

	static onSelectedImageryChange(callbackFunction) {
		Cesium.knockout.getObservable(ViewerService.#viewer.baseLayerPicker.viewModel, 'selectedImagery').subscribe(callbackFunction);
	}
}