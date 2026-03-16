import { Shaders } from "./Shaders.js";

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
		const v0 = Cesium.Cartesian3.subtract(p1, p0, new Cesium.Cartesian3());
		const v1 = Cesium.Cartesian3.subtract(p2, p0, new Cesium.Cartesian3());
		const surfaceNormal = Cesium.Cartesian3.cross(v0, v1, new Cesium.Cartesian3());
		Cesium.Cartesian3.normalize(surfaceNormal, surfaceNormal);
		const upVector = viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(p0);
		const slope = Cesium.Math.toDegrees(Cesium.Cartesian3.angleBetween(surfaceNormal, upVector));

		return {
			height: positions[0].height,
			slope: slope,
			aspect: ViewerService.#calculateAspect(surfaceNormal, upVector, p0)
		};
	}

	static #calculateAspect(surfaceNormal, upVector, p0) {
		const northPole = new Cesium.Cartesian3(0.0, 0.0, 6378137.0);
		const northDir = Cesium.Cartesian3.subtract(northPole, p0, new Cesium.Cartesian3());
		const dot = Cesium.Cartesian3.dot(northDir, upVector);

		const projNorth = Cesium.Cartesian3.add(
			northDir,
			Cesium.Cartesian3.multiplyByScalar(upVector, -dot, new Cesium.Cartesian3()),
			new Cesium.Cartesian3()
		);

		Cesium.Cartesian3.normalize(projNorth, projNorth);
		const eastDir = Cesium.Cartesian3.cross(upVector, projNorth, new Cesium.Cartesian3());
		const normalDotUp = Cesium.Cartesian3.dot(surfaceNormal, upVector);

		const horizontalNormal = Cesium.Cartesian3.add(
			surfaceNormal,
			Cesium.Cartesian3.multiplyByScalar(upVector, -normalDotUp, new Cesium.Cartesian3()),
			new Cesium.Cartesian3()
		);

		Cesium.Cartesian3.normalize(horizontalNormal, horizontalNormal);
		const x = Cesium.Cartesian3.dot(horizontalNormal, projNorth);
		const y = Cesium.Cartesian3.dot(horizontalNormal, eastDir);
		const aspectDegrees = Cesium.Math.toDegrees(Math.atan2(-y, x));
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
			orientation: {
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

	// Globe custom materials
	static clearGlobeMaterial() {
		ViewerService.#viewer.scene.globe.material = undefined;
	}

	static showSlope(alpha = 0.2) {
		ViewerService.#viewer.scene.globe.material = Shaders.slope(alpha);
	}

	static showLineArt(sensitivity = 0.2, alpha = 0.5) {
		ViewerService.#viewer.scene.globe.material = Shaders.lineArt(sensitivity, alpha);
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