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

		// This will increase image sharpness on high DPI displays
		if (window.devicePixelRatio > 2) {
			viewer.resolutionScale = 2;
		}

		// On mobile devices, cap camera movement to 0.75% of the window size per frame
		// This prevents gestures, like fast swipes or drags, from moving the camera too far, providing a more controlled feel
		if (navigator.userAgent.includes('Mobile')) {
			viewer.scene.screenSpaceCameraController.maximumMovementRatio = 0.0075;
		}

		viewer.scene.globe.maximumScreenSpaceError = 1.5;
		viewer.scene.globe.depthTestAgainstTerrain = true;
		viewer.scene.globe.loadingDescendantLimit = 50;
		viewer.scene.screenSpaceCameraController.minimumCollisionTerrainHeight = 5000;
		viewer.scene.screenSpaceCameraController.inertiaSpin = 0;
		viewer.scene.screenSpaceCameraController.inertiaTranslate = 0;
		viewer.scene.screenSpaceCameraController.inertiaZoom = 0;
		viewer.camera.percentageChanged = 0.05;
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