export class ViewerService{
	static #viewer;

	static get viewer(){
		return ViewerService.#viewer;
	}

	static async initialize(viewerContainer){
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
		if (window.devicePixelRatio > 2){
			viewer.resolutionScale = 2;
		}

		viewer.scene.globe.maximumScreenSpaceError = 1.5;
		viewer.scene.globe.depthTestAgainstTerrain = true;
		viewer.scene.globe.loadingDescendantLimit = 50;
		viewer.scene.screenSpaceCameraController.minimumCollisionTerrainHeight = 5000;
		viewer.scene.screenSpaceCameraController.inertiaSpin = 0;
		viewer.scene.screenSpaceCameraController.inertiaTranslate = 0;
		viewer.scene.screenSpaceCameraController.inertiaZoom = 0;
		viewer.camera.percentageChanged = 0.1;
		ViewerService.#viewer = viewer;
	}

	static #getImageryProviders(){
		const imageryViewModels = [];

		// PNOA
		imageryViewModels.push(new Cesium.ProviderViewModel({
			name: 'PNOA',
			tooltip: 'Plan Nacional de Ortofotografía Aérea (máxima actualidad)',
			iconUrl: 'https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/15/15945/20765.jpeg',

			creationFunction: function(){
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

			creationFunction: function(){
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

			creationFunction: function(){
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

			creationFunction: function(){
				return new Cesium.UrlTemplateImageryProvider({
					url: 'https://wmts-mapa-lidar.idee.es/lidar?Layer=EL.GridCoverageDSM&Style=default&TileMatrixSet=EPSG:3857&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix={z}&TileCol={x}&TileRow={y}',
					minimumLevel: 5,
					maximumLevel: 17,
					hasAlphaChannel: false,
				});
			}
		}));

		// OpenStreetMap
/* 		imageryViewModels.push(new Cesium.ProviderViewModel({
			name: 'OSM',
			tooltip: 'OpenStreetMap',
			iconUrl: 'https://tile.openstreetmap.org/15/15945/12002.png',

			creationFunction: function(){
				return new Cesium.UrlTemplateImageryProvider({
					url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
					minimumLevel: 0,
					maximumLevel: 19,
					hasAlphaChannel: false,
				});
			}
		})); */

		return imageryViewModels;
	}

	static async #getTerrainProvider(){
		return await Cesium.CesiumTerrainProvider.fromUrl("https://qm-mdt.idee.es/1.0.0/terrain", {
			credit: new Cesium.Credit("<a href='https://www.ign.es/web/ign/portal/qsm-cnig' target='_blank'>Instituto Geográfico Nacional (IGN)</a>"),
		})
	}

	static get currentImageryName(){
		return ViewerService.#viewer.baseLayerPicker.viewModel.selectedImagery.name;
	}

	static setImagery(imageryName){
		const models = ViewerService.#viewer.baseLayerPicker.viewModel.imageryProviderViewModels;
		const match = models.find(model => model.name === imageryName);

			if (match){
				ViewerService.#viewer.baseLayerPicker.viewModel.selectedImagery = match;
			}
	}

	static flyToPosition(lat, lon, cameraAltitude, cameraHeading, cameraPitch){
		ViewerService.#viewer.camera.flyTo({
			destination: Cesium.Cartesian3.fromDegrees(lon, lat, cameraAltitude),
			duration: 5,
			easingFunction: Cesium.EasingFunction.QUINTIC_IN_OUT,
			complete: () => ViewerService.#viewer.scene.requestRender(),

			orientation: {
				heading: Cesium.Math.toRadians(cameraHeading),
				pitch: Cesium.Math.toRadians(cameraPitch),
			}
		});
	}

	static flyToDataSource(dataSource){
		ViewerService.#viewer.flyTo(dataSource);
		ViewerService.#viewer.scene.requestRender();
	}

	static async getElevation(lat, lon){
		const position = [Cesium.Cartographic.fromDegrees(lon, lat)];
		await Cesium.sampleTerrainMostDetailed(ViewerService.#viewer.terrainProvider, position);
		return position[0].height;
	}

	static getCameraPosition(){ // {lat, lon, altitude, heading, pitch}
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

	static setCameraHeading(heading){
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

	static getCartographicScreenPosition(position){ // {lat, lon}
		const cartesianPosition = ViewerService.#viewer.scene.pickPosition(position);

		if (cartesianPosition){
			const cartographicPosition = Cesium.Cartographic.fromCartesian(cartesianPosition);
			const lat = Cesium.Math.toDegrees(cartographicPosition.latitude);
			const lon = Cesium.Math.toDegrees(cartographicPosition.longitude);
			return {lat: lat, lon: lon};
		}
	}

	static isCursorOverObject(position){
		const pickedObject = ViewerService.#viewer.scene.pick(position);

		if (!pickedObject){
			return false;
		}
		else{
			return true;
		}
	}

	static refreshScene(){
		ViewerService.viewer.scene.requestRender();
	}

	// Event handlers

	static onCameraChange(callbackFunction){
		ViewerService.#viewer.camera.changed.addEventListener(callbackFunction);
	}

	static onCameraStopMove(callbackFunction){
		ViewerService.#viewer.camera.moveEnd.addEventListener(callbackFunction);
	}

	static onCanvasClick(callbackFunction){
		const canvasEventHandler = new Cesium.ScreenSpaceEventHandler(ViewerService.#viewer.scene.canvas);
		canvasEventHandler.setInputAction((click) => callbackFunction(click), Cesium.ScreenSpaceEventType.LEFT_CLICK);
	}

	static onCanvasMouseMove(callbackFunction){
		const canvasEventHandler = new Cesium.ScreenSpaceEventHandler(ViewerService.#viewer.scene.canvas);
		canvasEventHandler.setInputAction((movement) => callbackFunction(movement), Cesium.ScreenSpaceEventType.MOUSE_MOVE);
	}
}