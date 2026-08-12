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

	static async initialize(viewerContainer, isMobileDevice) {
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
		if (isMobileDevice) {
			viewer.scene.screenSpaceCameraController.maximumMovementRatio = 0.0075;
		}

		viewer.scene.screenSpaceCameraController.minimumCollisionTerrainHeight = 5000;
		viewer.scene.screenSpaceCameraController.inertiaSpin = 0;
		viewer.scene.screenSpaceCameraController.inertiaTranslate = 0;
		viewer.scene.screenSpaceCameraController.inertiaZoom = 0;
		viewer.scene.globe.depthTestAgainstTerrain = true;
		viewer.scene.globe.maximumScreenSpaceError = 1.5;
		viewer.scene.globe.loadingDescendantLimit = 50;
		viewer.scene.globe.tileCacheSize = 500;
		viewer.scene.postProcessStages.fxaa.enabled = false;
		ViewerService.#viewer = viewer;

		if ('connection' in navigator && navigator.connection.effectiveType === '4g') {
			Cesium.RequestScheduler.maximumRequestsPerServer = 32;
			Cesium.RequestScheduler.maximumRequests = 64;
		}

		// wmts-mapa-lidar.idee.es uses HTTP/1.1 and browsers strictly enforce a maximum of 6 concurrent connections per domain for HTTP/1.1
		Cesium.RequestScheduler.requestsByServer['wmts-mapa-lidar.idee.es:443'] = 6;

		// EXPERIMENTAL

		//try {
			// Point cloud
			//const tileset = await Cesium.Cesium3DTileset.fromUrl("https://localhost:11443/3dtiles/tileset.json");			
			//viewer.scene.primitives.add(tileset);

			// 3D Tileset
			//const dataSource = await Cesium.CzmlDataSource.load("https://betaserver.icgc.cat/cesium/data/Girona18_42.czml");
			//viewer.dataSources.add(dataSource);

			// MapBox Vector Tiles
			// const west = Cesium.Math.toRadians(-4.8185);
			// const south = Cesium.Math.toRadians(43.3005);
			// const east = Cesium.Math.toRadians(-4.8155);
			// const north = Cesium.Math.toRadians(43.3025);
			// const rectangle = new Cesium.Rectangle(west, south, east, north);

			// const mvt = await Cesium.MVTDataProvider.fromUrl('https://vt-btn.idee.es/1.0.0/btn/tile/{z}/{y}/{x}.pbf', {
			// 	extent: rectangle,
			// 	minZoom: 0,
			// 	maxZoom: 14,
			// });

			// mvt.style = new Cesium.Cesium3DTileStyle({
			// 	color: "color('red', 1.0)",
			// 	strokeColor: "color('white', 1.0)",
			// 	strokeWidth: 2
			// });

			//viewer.scene.primitives.add(mvt);

		//} catch (error) {
		//	console.error(`Error loading tileset: ${error}`);
		//}

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
			easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
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

	// Variables to avoid unnecessary allocations in getCartographicScreenPosition, as this method is called very frequently during mouse movement
	static #scratchRay = new Cesium.Ray();
	static #scratchCartesian = new Cesium.Cartesian3();
	static #scratchCartographic = new Cesium.Cartographic();

	static getCartographicScreenPosition(windowPosition, result = { lat: null, lon: null }) {
		const scene = ViewerService.#viewer.scene;
		const ray = scene.camera.getPickRay(windowPosition, ViewerService.#scratchRay);
		if (!ray) { return; }
		const cartesian = scene.globe.pick(ray, scene, ViewerService.#scratchCartesian);
		if (!cartesian) { return; }
		const cartographicPosition = Cesium.Cartographic.fromCartesian(cartesian, scene.globe.ellipsoid, ViewerService.#scratchCartographic);
		result.lat = Cesium.Math.toDegrees(cartographicPosition.latitude);
		result.lon = Cesium.Math.toDegrees(cartographicPosition.longitude);
		return result;
	}

	// Variables to avoid unnecessary allocations in getSlopeDetails, as this method is called very frequently during mouse movement
	static #scratchPositions = [
		new Cesium.Cartographic(),
		new Cesium.Cartographic(),
		new Cesium.Cartographic()
	];

	static #scratchP0 = new Cesium.Cartesian3();
	static #scratchP1 = new Cesium.Cartesian3();
	static #scratchP2 = new Cesium.Cartesian3();
	static #scratchV0 = new Cesium.Cartesian3();
	static #scratchV1 = new Cesium.Cartesian3();
	static #scratchNormal = new Cesium.Cartesian3();
	static #scratchUp = new Cesium.Cartesian3();
	static #scratchNorthPole = new Cesium.Cartesian3(0.0, 0.0, 6378137.0);
	static #scratchNorthDir = new Cesium.Cartesian3();
	static #scratchProjNorth = new Cesium.Cartesian3();
	static #scratchEastDir = new Cesium.Cartesian3();
	static #scratchHorizontalNormal = new Cesium.Cartesian3();
	static #scratchResult = { height: null, slope: null, aspect: null };

	static async getSlopeDetails(lat, lon, signal = null) {
		if (signal?.aborted) {
			throw new DOMException('Aborted', 'AbortError');
		}

		const viewer = ViewerService.#viewer;
		const terrainProvider = viewer.terrainProvider;
		const offset = 0.00001;
		const pTemp0 = Cesium.Cartographic.fromDegrees(lon, lat, 0, ViewerService.#scratchPositions[0]);
		const pTemp1 = Cesium.Cartographic.fromDegrees(lon + offset, lat, 0, ViewerService.#scratchPositions[1]);
		const pTemp2 = Cesium.Cartographic.fromDegrees(lon, lat + offset, 0, ViewerService.#scratchPositions[2]);

		await Cesium.sampleTerrainMostDetailed(terrainProvider, ViewerService.#scratchPositions);

		if (signal?.aborted) {
			throw new DOMException('Aborted', 'AbortError');
		}

		const p0 = Cesium.Cartographic.toCartesian(pTemp0, viewer.scene.globe.ellipsoid, ViewerService.#scratchP0);
		const p1 = Cesium.Cartographic.toCartesian(pTemp1, viewer.scene.globe.ellipsoid, ViewerService.#scratchP1);
		const p2 = Cesium.Cartographic.toCartesian(pTemp2, viewer.scene.globe.ellipsoid, ViewerService.#scratchP2);
		const v0 = Cesium.Cartesian3.subtract(p1, p0, ViewerService.#scratchV0);
		const v1 = Cesium.Cartesian3.subtract(p2, p0, ViewerService.#scratchV1);
		const surfaceNormal = Cesium.Cartesian3.cross(v0, v1, ViewerService.#scratchNormal);

		Cesium.Cartesian3.normalize(surfaceNormal, surfaceNormal);

		const upVector = viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(p0, ViewerService.#scratchUp);
		const slope = Cesium.Math.toDegrees(Cesium.Cartesian3.angleBetween(surfaceNormal, upVector));

		ViewerService.#scratchResult.height = pTemp0.height;
		ViewerService.#scratchResult.slope = slope;
		ViewerService.#scratchResult.aspect = ViewerService.#calculateAspect(surfaceNormal, upVector, p0);
		return ViewerService.#scratchResult;
	}

	static #calculateAspect(surfaceNormal, upVector, p0) {
		const northDir = Cesium.Cartesian3.subtract(ViewerService.#scratchNorthPole, p0, ViewerService.#scratchNorthDir);
		const dot = Cesium.Cartesian3.dot(northDir, upVector);

		const projNorth = Cesium.Cartesian3.add(
			northDir,
			Cesium.Cartesian3.multiplyByScalar(upVector, -dot, ViewerService.#scratchProjNorth),
			ViewerService.#scratchProjNorth
		);

		Cesium.Cartesian3.normalize(projNorth, projNorth);

		const eastDir = Cesium.Cartesian3.cross(upVector, projNorth, ViewerService.#scratchEastDir);
		const normalDotUp = Cesium.Cartesian3.dot(surfaceNormal, upVector);

		const horizontalNormal = Cesium.Cartesian3.add(
			surfaceNormal,
			Cesium.Cartesian3.multiplyByScalar(upVector, -normalDotUp, ViewerService.#scratchHorizontalNormal),
			ViewerService.#scratchHorizontalNormal
		);

		Cesium.Cartesian3.normalize(horizontalNormal, horizontalNormal);

		const x = Cesium.Cartesian3.dot(horizontalNormal, projNorth);
		const y = Cesium.Cartesian3.dot(horizontalNormal, eastDir);
		const aspectDegrees = Cesium.Math.toDegrees(Math.atan2(-y, x));

		return (aspectDegrees + 360.0) % 360.0;
	}

	static getCameraPosition(result = { lat: null, lon: null, altitude: null, heading: null, pitch: null }) {
		const camera = ViewerService.#viewer.camera;

		result.lat = Cesium.Math.toDegrees(camera.positionCartographic.latitude);
		result.lon = Cesium.Math.toDegrees(camera.positionCartographic.longitude);
		result.altitude = camera.positionCartographic.height;
		result.heading = Cesium.Math.toDegrees(camera.heading);
		result.pitch = Cesium.Math.toDegrees(camera.pitch);
		return result;
	}

	static setCameraHeading(heading) {
		const currentCameraPitch = ViewerService.#viewer.camera.pitch;

		ViewerService.#viewer.camera.setView({
			orientation: {
				heading: Cesium.Math.toRadians(heading),
				pitch: currentCameraPitch,
			}
		});
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
				orientation: {
					heading: newHeading,
					pitch: newPitch,
				},
			});

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

	static showLineArt(sensitivity = 0.2) {
		ViewerService.#viewer.scene.globe.material = Shaders.lineArt(sensitivity);
	}

	static showHipsometricTint(minHeight = 0, maxHeight = 5000, alpha = 0.5) {
		ViewerService.#viewer.scene.globe.material = Shaders.hipsometricTint(minHeight, maxHeight, alpha);
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

	static onCanvasDoubleClick(callbackFunction) {
		ViewerService.#getCanvasEventHandler().setInputAction((click) => callbackFunction(click), Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
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