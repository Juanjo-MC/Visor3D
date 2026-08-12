import { Device } from './Device.js';
import { Utils } from './Utils.js';
import { ViewerService } from './ViewerService.js';
import { POIFinder } from './POIFinder.js';
import { POIManager } from './POIManager.js';
import { CompassService } from './CompassService.js';
import { ExternalDataManager } from './ExternalDataManager.js';
import { GeocodingService } from './GeocodingService.js';
import { GeolocationService } from './GeolocationService.js';
import { MarkersManager } from './MarkersManager.js';
import { DeviceHeadingTracker } from './DeviceHeadingTracker.js';

export class Application {
	static #POIS_FILE_PATH = './resources/pois.json.gz';
	static #DEFAULT_POIS_LOAD_RADIUS = 30; // Radius of a circle, around the camera position, where POIs will be loaded (km)

	// Default camera settings
	static #DEFAULT_CAMERA_ALTITUDE = 4000;
	static #DEFAULT_CAMERA_HEADING = 0;
	static #DEFAULT_CAMERA_PITCH = -90;

	// Fallback camera position
	static #FALLBACK_MAP_CENTER_LAT = 43.274149;
	static #FALLBACK_MAP_CENTER_LON = -4.832612;
	static #FALLBACK_CAMERA_ALTITUDE = 2000;
	static #FALLBACK_CAMERA_HEADING = 180;
	static #FALLBACK_CAMERA_PITCH = 0;

	// Markers pins
	static #markerPins = Object.freeze({
		GEO_LOCATION_POSITION: './images/pin_orange.svg',
		GEOCODING_RESULT: './images/pin_blue.svg',
		QUERY_STRING_POSITION: './images/pin_green.svg',
		EXTERNAL_DATA_WAYPOINTS: './images/pin_red.svg',
	});

	// Toast
	static #toastType = Object.freeze({
		INFO: 'info',
		WARNING: 'warning',
		ERROR: 'error',
	});

	static #currentCameraPosition = {};					// Current camera position {lat, lon, altitude, heading, pitch}
	static #latestLoadedPOIsCameraCoordinates = {};		// Latest coordinates where POIs were loaded {lat, lon}
	static #geocoderMarkerId = null;					// Entity Id of geocoder pin
	static #geolocationMarkerId = null;					// Entity Id of geolocation position pin

	// DOM elements
	static #domElement = Object.freeze({
		viewerContainer: document.getElementById('viewerContainer'),
		toastContainer: document.getElementById('toastContainer'),
		compass: document.querySelector('.compass-circle'),
		toggleCumbres: document.getElementById('toggleCumbres'),
		togglePoblaciones: document.getElementById('togglePoblaciones'),
		toggleMasasDeAgua: document.getElementById('toggleMasasDeAgua'),
		minVisibilityDistanceControl: document.getElementById('distanceFrom'),
		minVisibilityDistanceLabel: document.getElementById('distanceFromValue'),
		maxVisibilityDistanceControl: document.getElementById('distanceTo'),
		maxVisibilityDistanceLabel: document.getElementById('distanceToValue'),
		fileInput: document.getElementById('fileInput'),
		ddlDataSources: document.getElementById('ddlDataSources'),
		btnShow: document.getElementById('btnShow'),
		btnHide: document.getElementById('btnHide'),
		btnDelete: document.getElementById('btnDelete'),
		searchBox: document.getElementById('searchBox'),
		searchResultsList: document.getElementById('searchResultsList'),
		btnSearch: document.getElementById('btnSearch'),
		btnClearSearch: document.getElementById('btnClearSearch'),
		btnUserPosition: document.getElementById('btnUserPosition'),
		btnPanorama: document.getElementById('btnPanorama'),
		btnSlope: document.getElementById('btnSlope'),
		btnLineArt: document.getElementById('btnLineArt'),
		statsDock: document.getElementById('statsDock'),
		valLat: document.getElementById('valLat'),
		valLon: document.getElementById('valLon'),
		valHeight: document.getElementById('valHeight'),
		valSlope: document.getElementById('valSlope'),
		valAspect: document.getElementById('valAspect'),
		valCameraHeight: document.getElementById('valCameraHeight'),
		iconCameraPitch: document.getElementById('iconCameraPitch'),
		valCameraPitch: document.getElementById('valCameraPitch'),
		valDistance: document.getElementById('valDistance'),
	});
	
	static async initialize() {
		try {
			POIFinder.initialize(await Utils.getCompressedJSONData(Application.#POIS_FILE_PATH));
			await ViewerService.initialize(Application.#domElement.viewerContainer.id, Device.isMobile());
			await POIManager.initialize(ViewerService.viewer);
			await MarkersManager.initialize(ViewerService.viewer);
			Application.#prepareUI();
			Application.#bindEventListeners();
			Application.#prepareScene();
		}
		catch (err) {
			console.error(err);
			Application.#showToast(`Se ha producido un error al inicializar la aplicación: ${err.message}`, Application.#toastType.ERROR);
		}
	}

	static #prepareUI() {
		if (!Device.isMobile() && Device.hasMouse()) { // Coordinates box only visible on PCs
			Application.#domElement.statsDock.style.display = 'flex';
		}
		else { // Panorama button only visible on mobile devices
			Application.#domElement.btnPanorama.style.display = 'flex';
		}
	}

	static #bindEventListeners() {
		ViewerService.onCameraChange(Application.#onCameraChange);
		ViewerService.onCameraStopMove(Application.#onCameraStopMove);
		ViewerService.onCanvasClick(Application.#onCanvasClick);
		ViewerService.onCanvasMouseDown(Application.#onCanvasMouseDown);
		ViewerService.onCanvasMouseUp(Application.#onCanvasMouseUp);

		if (!Device.isMobile() && Device.hasMouse()) {
			ViewerService.onCanvasMouseMove(Application.#onMouseMove);
		}

		ViewerService.onSelectedImageryChange(Application.#onSelectedImageryChange);
		document.addEventListener('visibilitychange', Application.#onDocumentVisibilityChange);
		Application.#domElement.compass.addEventListener('dblclick', Application.#onCompassDoubleClick);
		Application.#onPOIsVisibilityToggleChange(Application.#domElement.toggleCumbres, POIManager.poiType.CUMBRE);
		Application.#onPOIsVisibilityToggleChange(Application.#domElement.togglePoblaciones, POIManager.poiType.POBLACION);
		Application.#onPOIsVisibilityToggleChange(Application.#domElement.toggleMasasDeAgua, POIManager.poiType.MASA_DE_AGUA);
		Application.#domElement.minVisibilityDistanceControl.addEventListener('input', Application.#onMinVisibilityDistanceInput);
		Application.#domElement.minVisibilityDistanceControl.addEventListener('change', Application.#setPOIsVisibilityRange);
		Application.#domElement.maxVisibilityDistanceControl.addEventListener('input', Application.#onMaxVisibilityDistanceInput);
		Application.#domElement.maxVisibilityDistanceControl.addEventListener('change', Application.#setPOIsVisibilityRange);
		Application.#domElement.fileInput.addEventListener('change', Application.#onFileInputChange);
		Application.#domElement.btnShow.addEventListener('click', Application.#onBtnShowClick);
		Application.#domElement.btnHide.addEventListener('click', Application.#onBtnHideClick);
		Application.#domElement.btnDelete.addEventListener('click', Application.#onBtnDeleteClick);
		Application.#domElement.searchBox.addEventListener('input', Application.#onSearchBoxInput);
		Application.#domElement.btnSearch.addEventListener('click', Application.#onBtnSearchClick);
		Application.#domElement.searchResultsList.addEventListener('change', Application.#onSeachResultsListChange);
		Application.#domElement.btnClearSearch.addEventListener('click', Application.#onBtnClearSearchClick);
		Application.#domElement.btnUserPosition.addEventListener('click', Application.#onBtnUserPositionClick);
		Application.#domElement.btnPanorama.addEventListener('click', Application.#onBtnPanoramaClick);
		Application.#domElement.btnSlope.addEventListener('click', Application.#onBtnSlopeClick);
		Application.#domElement.btnLineArt.addEventListener('click', Application.#onBtnLineArtClick);
	}

	static #prepareScene() {
		// Restore last used cartography
		const lastUsedCartography = Application.#getLastUsedCartography();

		if (lastUsedCartography) {
			ViewerService.setImagery(lastUsedCartography);
		}

		// Set initial camera position based on the following priority: query string parameters, saved position in local storage, default fallback position
		const cameraInitialPosition = Application.#getCameraInitialPosition();

		if (Application.#markerNeeded()) {
			const name = decodeURIComponent(new URL(document.URL).searchParams.get('name')).trim();

			if (name === 'null' || name.length === 0) { // If there is no name parameter in the query string, show a marker
				let description = `<a href="geo:${cameraInitialPosition.lat.toFixed(6)},${cameraInitialPosition.lon.toFixed(6)}"><strong>Latitud</strong>: ${cameraInitialPosition.lat.toFixed(6)}</a><br><br>`;
				description += `<a href="geo:${cameraInitialPosition.lat.toFixed(6)},${cameraInitialPosition.lon.toFixed(6)}"><strong>Longitud</strong>: ${cameraInitialPosition.lon.toFixed(6)}</a>`;
				MarkersManager.createMarker(cameraInitialPosition.lat, cameraInitialPosition.lon, null, description, Application.#markerPins.QUERY_STRING_POSITION);
			}
			else { // Else add a POI that will show a label				
				POIManager.addPOIToViewer(null, name, cameraInitialPosition.lat, cameraInitialPosition.lon, new Cesium.DistanceDisplayCondition(10, 50000), Cesium.Color.fromBytes(226, 255, 226, 190), true);
			}
		}

		Application.#latestLoadedPOIsCameraCoordinates.lat = cameraInitialPosition.lat;
		Application.#latestLoadedPOIsCameraCoordinates.lon = cameraInitialPosition.lon;

		// Load POIs around the initial camera position
		const pois = POIFinder.findPOIsAround(cameraInitialPosition.lat, cameraInitialPosition.lon, Application.#DEFAULT_POIS_LOAD_RADIUS);

		const renderingOptions = {
			cumbresVisible: false,
			poblacionesVisible: false,
			masasDeAguaVisible: false,
			minVisibilityDistance: 10,
			maxVisibilityDistance: 20000,
		}

		POIManager.addPOIsToViewer(pois, renderingOptions);
		ViewerService.flyToPosition(cameraInitialPosition.lat, cameraInitialPosition.lon, cameraInitialPosition.altitude, cameraInitialPosition.heading, cameraInitialPosition.pitch);
	}

	static #getLastUsedCartography() {
		let lastCartography;

		try {
			lastCartography = window.localStorage.getItem('lastCartography');
		}
		catch (err) {
			console.error(err);
		}

		return lastCartography;
	}

	static #getCameraInitialPosition() {
		const searchParams = new URLSearchParams(window.location.search);
		const latParam = searchParams.get('lat');
		const lonParam = searchParams.get('lon');
		let lat = parseFloat(decodeURIComponent(latParam).replace(/ /g, ''));
		let lon = parseFloat(decodeURIComponent(lonParam).replace(/ /g, ''));
		let altitude;
		let heading;
		let pitch;

		// If valid coordinates are provided through the query string, use them as the initial camera position
		if (Utils.isValidLatitude(lat) && Utils.isValidLongitude(lon)) {
			altitude = Application.#DEFAULT_CAMERA_ALTITUDE;
			heading = Application.#DEFAULT_CAMERA_HEADING;
			pitch = Application.#DEFAULT_CAMERA_PITCH;
			return { lat, lon, altitude, heading, pitch };
		}

		// Check if there is a saved camera position in the local storage and use it as the initial camera position
		let jsonSavedCameraPosition;

		try {
			jsonSavedCameraPosition = window.localStorage.getItem('lastCameraPosition');
		}
		catch (err) {
			console.error(err);
		}

		if (jsonSavedCameraPosition) {
			const savedCameraPosition = JSON.parse(jsonSavedCameraPosition);
			lat = savedCameraPosition.lat;
			lon = savedCameraPosition.lon;
			altitude = savedCameraPosition.altitude;
			heading = savedCameraPosition.heading;
			pitch = savedCameraPosition.pitch;
			return { lat, lon, altitude, heading, pitch };
		}

		// No coordinates have been received or they are invalid and there is no previous position saved in the local storage, return the default position
		lat = Application.#FALLBACK_MAP_CENTER_LAT;
		lon = Application.#FALLBACK_MAP_CENTER_LON;
		altitude = Application.#FALLBACK_CAMERA_ALTITUDE;
		heading = Application.#FALLBACK_CAMERA_HEADING;
		pitch = Application.#FALLBACK_CAMERA_PITCH;
		return { lat, lon, altitude, heading, pitch };
	}

	static #markerNeeded() {
		const searchParams = new URLSearchParams(window.location.search);
		const latParam = searchParams.get('lat');
		const lonParam = searchParams.get('lon');

		if (!latParam || !lonParam) {
			return false;
		}

		const lat = parseFloat(decodeURIComponent(latParam).replace(/ /g, ''));
		const lon = parseFloat(decodeURIComponent(lonParam).replace(/ /g, ''));
		return Utils.isValidLatitude(lat) && Utils.isValidLongitude(lon);
	}

	static #showToast(message, type = Application.#toastType.INFO, duration = 5000) {
		const container = Application.#domElement.toastContainer;
		let iconClass;

		switch (type) {
			case Application.#toastType.WARNING:
				iconClass = 'fa-solid fa-triangle-exclamation';
				break;
			case Application.#toastType.ERROR:
				iconClass = 'fa-solid fa-xmark';
				break;
			case Application.#toastType.INFO:
			default:
				iconClass = 'fa-solid fa-circle-info';
		}

		const toast = document.createElement('div');
		toast.classList.add('toast', type);
		toast.innerHTML = `<i class="toast-icon ${iconClass}"></i>${message}`;
		container.appendChild(toast);
		requestAnimationFrame(() => toast.classList.add('show'));

		setTimeout(() => {
			toast.classList.remove('show');
			toast.classList.add('hide');
			toast.addEventListener('transitionend', () => container.removeChild(toast), { once: true });
		}, duration);
	}

	// Event listeners

	static #onDocumentVisibilityChange() { // Save view state
		if (document.hidden) {
			try {
				window.localStorage.setItem('lastCameraPosition', JSON.stringify(Application.#currentCameraPosition));
				window.localStorage.setItem('lastCartography', ViewerService.currentImageryName);
			}
			catch (err) {
				console.error(err);
			}
		}
	}	

	static #onCameraChange() { // Update compass and camera display
		const previousCameraHeading =  Application.#currentCameraPosition.heading;
		ViewerService.getCameraPosition(Application.#currentCameraPosition);

		if (!Device.isMobile() && Device.hasMouse()) { // Do not update camera display on mobile devices, as it is not visible			
			Application.#domElement.valCameraHeight.innerHTML = Application.#currentCameraPosition.altitude.toFixed(0) + ' m';
			Application.#domElement.iconCameraPitch.style.transform = `rotate(${-Application.#currentCameraPosition.pitch}deg)`;
			Application.#domElement.valCameraPitch.innerHTML = Application.#currentCameraPosition.pitch.toFixed(1) + '°';
		}

		// Only rotation movements do change the camera heading. Other movements like, for example, translation, don't
		// This check avoid unnecessary compass updates
		if (Math.abs(Application.#currentCameraPosition.heading - previousCameraHeading) >= 0.005) {
			const compassHeading = CompassService.getHeading(Application.#currentCameraPosition.heading);
			Application.#domElement.compass.style.transform = `translate(-50%,-50%) rotate(${-compassHeading}deg)`;
		}
	}

	static #onCameraStopMove() { // Load POIs
		ViewerService.getCameraPosition(Application.#currentCameraPosition);
		const oldCameraCoordinates = { lat: Application.#latestLoadedPOIsCameraCoordinates.lat, lon: Application.#latestLoadedPOIsCameraCoordinates.lon };
		Application.#latestLoadedPOIsCameraCoordinates.lat = Application.#currentCameraPosition.lat;;
		Application.#latestLoadedPOIsCameraCoordinates.lon = Application.#currentCameraPosition.lon;

		if (oldCameraCoordinates.lat.toFixed(6) !== Application.#currentCameraPosition.lat.toFixed(6) || oldCameraCoordinates.lon.toFixed(6) !== Application.#currentCameraPosition.lon.toFixed(6)) {
			const poisInOldBbox = POIFinder.findPOIsAround(oldCameraCoordinates.lat, oldCameraCoordinates.lon, Application.#DEFAULT_POIS_LOAD_RADIUS);
			const poisInNewBbox = POIFinder.findPOIsAround(Application.#currentCameraPosition.lat, Application.#currentCameraPosition.lon, Application.#DEFAULT_POIS_LOAD_RADIUS);
			const poisToRemove = Utils.arrayDifference(poisInOldBbox, poisInNewBbox);
			const poisToAdd = Utils.arrayDifference(poisInNewBbox, poisInOldBbox);
			const visibilityRange = Application.#getPOIsVisibilityRange();

			const renderingOptions = {
				cumbresVisible: Application.#domElement.toggleCumbres.checked,
				poblacionesVisible: Application.#domElement.togglePoblaciones.checked,
				masasDeAguaVisible: Application.#domElement.toggleMasasDeAgua.checked,
				minVisibilityDistance: visibilityRange.min,
				maxVisibilityDistance: visibilityRange.max,
			}

			POIManager.removePOIsFromViewer(poisToRemove);
			POIManager.addPOIsToViewer(poisToAdd, renderingOptions);
			requestAnimationFrame(() => ViewerService.refreshScene());
		}
	}

	static async #onCanvasClick(click) { // Show closest POI 
		// On touch devices, users may tap slightly above terrain features, over the sky area
		// To handle this, we search for coordinates up to 'yPixelsTolerance' pixels below the touch position
		const yPixelsTolerance = 20;
		const delay = 5000; // Show the POI for this duration (ms)
		let y = click.position.y;
		let clickCartographicPosition;

		for (let i = 0; i < yPixelsTolerance; i++) {
			clickCartographicPosition = ViewerService.getCartographicScreenPosition({ x: click.position.x, y: y });
			y += 1;

			if (clickCartographicPosition) {
				break;
			}
		}

		if (clickCartographicPosition) {
			const poi = POIFinder.findNearestPOI(clickCartographicPosition.lat, clickCartographicPosition.lon, 0.3);

			if (poi) {
				const poiIsLoaded = POIManager.poiIsLoaded(poi.id);
				const poiIsVisible = POIManager.poiIsVisible(poi.id);

				if (poiIsLoaded && !poiIsVisible) {
					const poiElevation = await ViewerService.getElevation(poi.lat, poi.lon);
					const labelText = `${poi.name}\n${poiElevation.toFixed(0)} m`;
					POIManager.setPoiLabelProperties(poi.id, labelText, true);
					POIManager.showPOI(poi.id);
					ViewerService.refreshScene();

					setTimeout(() => {
						const poiType = POIManager.getPOIType(poi.id);
						const toggleCumbres = Application.#domElement.toggleCumbres;
						const togglePoblaciones = Application.#domElement.togglePoblaciones;
						const toggleMasasDeAgua = Application.#domElement.toggleMasasDeAgua;
						let showPOI;

						if (poiType === POIManager.poiType.CUMBRE) {
							showPOI = toggleCumbres.checked;
						}
						else if (poiType === POIManager.poiType.POBLACION) {
							showPOI = togglePoblaciones.checked;
						}
						else if (poiType === POIManager.poiType.MASA_DE_AGUA) {
							showPOI = toggleMasasDeAgua.checked;
						}

						const visibilityRange = Application.#getPOIsVisibilityRange();
						POIManager.setPoiLabelProperties(poi.id, poi.name, false, visibilityRange);

						if (!showPOI) {
							POIManager.hidePOI(poi.id);
						}

						ViewerService.refreshScene();
					}, delay);
				}
			}
		}
	}

	static #onCanvasMouseDown(click) { // Rotate view
		const delay = 500;				// Time (ms) to wait before starting rotation, if conditions remain valid
		const movementThreshold = 5		// Maximum distance the pointer can move during the delay before the interaction is no longer considered a long press or static click (px)
		const leftRightMargin = 50;
		const topBottomMargin = 70;
		const x = click.position.x;
		const y = click.position.y;
		let mouseStillDown = true;
		let positionUnchanged = true;

		if (x < leftRightMargin || x > window.innerWidth - leftRightMargin || y < topBottomMargin || y > window.innerHeight - topBottomMargin) {

			const onPointerUp = () => { // Cancel rotation if the pointer is released before the delay expires
				mouseStillDown = false;
				removeEventListeners();
			};

			const onPointerMove = (e) => { // Cancel rotation if the pointer moves more than 'movementThreshold' pixels from the initial click position before the delay expires
				if (Math.abs(e.clientX - x) > movementThreshold || Math.abs(e.clientY - y) > movementThreshold) {
					positionUnchanged = false;
					removeEventListeners();
				}
			};

			const removeEventListeners = () => {
				document.removeEventListener("pointerup", onPointerUp, { capture: true });
				document.removeEventListener("pointermove", onPointerMove, { capture: true });
			};

			document.addEventListener("pointerup", onPointerUp, { capture: true });
			document.addEventListener("pointermove", onPointerMove, { capture: true });

			setTimeout(() => {
				removeEventListeners();

				if (mouseStillDown && positionUnchanged) {
					ViewerService.toggleCameraGestures(false);

					if (x <= leftRightMargin) {
						ViewerService.startRotation(ViewerService.rotationAxis.HEADING, ViewerService.rotationDirection.NEGATIVE);
					}
					else if (x >= window.innerWidth - leftRightMargin) {
						ViewerService.startRotation(ViewerService.rotationAxis.HEADING, ViewerService.rotationDirection.POSITIVE);
					}
					else if (y <= topBottomMargin) {
						ViewerService.startRotation(ViewerService.rotationAxis.PITCH, ViewerService.rotationDirection.POSITIVE);
					}
					else if (y >= window.innerHeight - topBottomMargin) {
						ViewerService.startRotation(ViewerService.rotationAxis.PITCH, ViewerService.rotationDirection.NEGATIVE);
					}
				}
			}, delay);
		}
	}

	static #onCanvasMouseUp(click) { // Stop rotating view
		ViewerService.stopRotation();
		ViewerService.toggleCameraGestures(true);
	}

	// Variables to avoid unnecessary allocations and calls to getSlopeDetails when the mouse is moved fast over the screen
	static #slopeAbortController = null;
	static #mousePositionScratch = { lat: null, lon: null };
	static #SLOPE_UPDATE_INTERVAL = 50; // ms
	static #lastExecutionTime = 0;
	static #onMouseMoveThrottleTimeoutId = null;

	static #onMouseMove(movement) { // Update coordinates and slope details
		ViewerService.getCartographicScreenPosition(movement.endPosition, Application.#mousePositionScratch);

		if (!Application.#mousePositionScratch.lat) {
			if (Application.#slopeAbortController) {
				Application.#slopeAbortController.abort();
			}

			clearTimeout(Application.#onMouseMoveThrottleTimeoutId);
			Application.#clearCoordinatesAndTerrainDOM();
		}
		else {
			Application.#domElement.valLat.innerHTML = Application.#mousePositionScratch.lat.toFixed(6);
			Application.#domElement.valLon.innerHTML = Application.#mousePositionScratch.lon.toFixed(6);

			const now = performance.now();
			const timeSinceLastCall = now - Application.#lastExecutionTime;

			clearTimeout(Application.#onMouseMoveThrottleTimeoutId);

			if (timeSinceLastCall >= Application.#SLOPE_UPDATE_INTERVAL) {
				Application.#fetchTerrainData(Application.#mousePositionScratch.lat, Application.#mousePositionScratch.lon);
			}
			else {
				const remainingTime = Application.#SLOPE_UPDATE_INTERVAL - timeSinceLastCall;
				const latTarget = Application.#mousePositionScratch.lat;
				const lonTarget = Application.#mousePositionScratch.lon;
				
				Application.#mousePositionScratch.lat = null;
				Application.#mousePositionScratch.lon = null;
				Application.#onMouseMoveThrottleTimeoutId = setTimeout(() => { Application.#fetchTerrainData(latTarget, lonTarget); }, remainingTime);
			}
		}
	}

	static async #fetchTerrainData(lat, lon) {
		Application.#lastExecutionTime = performance.now();

		if (Application.#slopeAbortController) {
			Application.#slopeAbortController.abort();
		}

		Application.#slopeAbortController = new AbortController();
		const { signal } = Application.#slopeAbortController;

		try {
			const slopeDetails = await ViewerService.getSlopeDetails(lat, lon, signal);

			if (slopeDetails) {
				ViewerService.getCameraPosition(Application.#currentCameraPosition);

				const distanceToCamera = Utils.distanceBetweenPoints(lat, lon, slopeDetails.height, Application.#currentCameraPosition.lat, Application.#currentCameraPosition.lon, Application.#currentCameraPosition.altitude);

				Application.#domElement.valHeight.innerHTML = Math.round(slopeDetails.height) + ' m';
				Application.#domElement.valSlope.innerHTML = Math.round(slopeDetails.slope) + '°';
				Application.#domElement.valAspect.innerHTML = slopeDetails.slope > 1 ? Utils.degreesToCardinalDirection(slopeDetails.aspect) : '----';
				Application.#domElement.valCameraHeight.innerHTML = (Application.#currentCameraPosition.altitude).toFixed(0) + ' m';
				Application.#domElement.iconCameraPitch.style.transform = `rotate(${-Application.#currentCameraPosition.pitch}deg)`;
				Application.#domElement.valCameraPitch.innerHTML = Application.#currentCameraPosition.pitch.toFixed(1) + '°';
				Application.#domElement.valDistance.innerHTML = distanceToCamera.toFixed(0) + ' m';
			}
		}
		catch (err) {
			if (err.name !== 'AbortError') {
				console.error(err);
				Application.#clearTerrainDOM();
			}
		}
	}

	static #clearCoordinatesAndTerrainDOM() {
		Application.#domElement.valLat.innerHTML = '----';
		Application.#domElement.valLon.innerHTML = '----';
		Application.#clearTerrainDOM();
	}

	static #clearTerrainDOM() {
		Application.#domElement.valHeight.innerHTML = '----';
		Application.#domElement.valSlope.innerHTML = '----';
		Application.#domElement.valAspect.innerHTML = '----';
		Application.#domElement.valDistance.innerHTML = '----';
	}

	static #onSelectedImageryChange(imagery) { // Show toast
		Application.#showToast(`Mostrando ${imagery.name}`);
	}

	static #onCompassDoubleClick(event) { // Rotate view
		ViewerService.getCameraPosition(Application.#currentCameraPosition);

		const compassRect = event.currentTarget.getBoundingClientRect();
		const x = event.clientX - compassRect.left;
		const isRightHalf = x > compassRect.width / 2;
		let currentHeading;
		let newHeading;	

		if (isRightHalf) {
			currentHeading = Math.ceil(Application.#currentCameraPosition.heading);
			newHeading = (currentHeading - (currentHeading % 90) + 90) % 360;
		}
		else {
			currentHeading = Math.floor(Application.#currentCameraPosition.heading);
			const offset = (currentHeading % 90) === 0 ? 0 : 90 - (currentHeading % 90); // Offset to next cardinal clockwise
			newHeading = (currentHeading + offset - 90 + 360) % 360;
		}
		
		const cardinalDirections = ['Norte', 'Este', 'Sur', 'Oeste'];
		const headingText = cardinalDirections[newHeading / 90];
		const headingDelta = Math.abs(((newHeading - currentHeading + 540) % 360) - 180);
		
		ViewerService.flyToPosition(Application.#currentCameraPosition.lat, Application.#currentCameraPosition.lon, Application.#currentCameraPosition.altitude, newHeading, Application.#currentCameraPosition.pitch, 5 * headingDelta / 90);
		Application.#showToast(`Orientando el visor hacia el ${headingText}`, Application.#toastType.INFO, 5000 * headingDelta / 90);
	}

	// POIs
	static #onPOIsVisibilityToggleChange(domElement, poiType) {
		domElement.addEventListener("change", async e => Application.#setPOIsVisibility(poiType, e.target.checked));
	}

	static #setPOIsVisibility(poiType, visible) {
		POIManager.setPOIsVisibility(poiType, visible);
		ViewerService.refreshScene();
	}

	static #onMinVisibilityDistanceInput() {
		Application.#domElement.minVisibilityDistanceLabel.innerHTML = `${this.value}&nbsp;km`;
	}

	static #onMaxVisibilityDistanceInput() {
		Application.#domElement.maxVisibilityDistanceLabel.innerHTML = `${this.value}&nbsp;km`;
	}

	static #setPOIsVisibilityRange() {
		const visibilityRange = Application.#getPOIsVisibilityRange();
		POIManager.setPOIsVisibilityRange(visibilityRange.min, visibilityRange.max);
		ViewerService.refreshScene();
	}

	static #getPOIsVisibilityRange() {
		const a = +Application.#domElement.minVisibilityDistanceControl.value;
		const b = +Application.#domElement.maxVisibilityDistanceControl.value;

		return {
			min: Math.max(Math.min(a, b) * 1000, 10),
			max: Math.max(a, b) * 1000,
		};
	}

	// External data
	static async #onFileInputChange() {
		const file = Application.#domElement.fileInput.files[0];

		if (file) {
			try {
				const arr = file.name.split('.');
				const fileExtension = arr[arr.length - 1].toLowerCase();
				let dataSourceInfo;

				switch (fileExtension) {
					case 'gpx':
						dataSourceInfo = await ExternalDataManager.addGpxDataSource(ViewerService.viewer, { data: file, fileName: file.name }, Application.#markerPins.EXTERNAL_DATA_WAYPOINTS);
						break;
					case 'kml':
					case 'kmz':
						dataSourceInfo = await ExternalDataManager.addKmlDataSource(ViewerService.viewer, { data: file, fileName: file.name }, Application.#markerPins.EXTERNAL_DATA_WAYPOINTS);
						break;
					case 'json':
					case 'geojson':
						const jsonData = JSON.parse(await file.text());
						dataSourceInfo = await ExternalDataManager.addGeoJsonDataSource(ViewerService.viewer, { data: jsonData, fileName: file.name }, Application.#markerPins.EXTERNAL_DATA_WAYPOINTS);
						break;
					default:
						Application.#showToast(`Tipo de fichero no soportado: ${fileExtension}`, Application.#toastType.WARNING);
						return;
				}

				const option = new Option(dataSourceInfo.name, dataSourceInfo.entitiesCollectionId);
				Application.#domElement.ddlDataSources.add(option);
				const dataSource = ExternalDataManager.getDataSource(ViewerService.viewer, dataSourceInfo.entitiesCollectionId);
				ViewerService.flyToDataSource(dataSource);
			}
			catch (err) {
				console.error(err);
				Application.#showToast(`Se ha producido un error al procesar el fichero ${file.name}: ${err.message}`, Application.#toastType.ERROR);
			}
			finally {
				Application.#domElement.fileInput.value = null;
			}
		}
	}

	static #onBtnShowClick() {
		const entitiesId = Application.#domElement.ddlDataSources.value;

		if (entitiesId !== '') {
			ExternalDataManager.updateDataSourceVisibility(ViewerService.viewer, entitiesId, true);
			ViewerService.flyToDataSource(ExternalDataManager.getDataSource(ViewerService.viewer, entitiesId));
		}
	}

	static #onBtnHideClick() {
		const entitiesId = Application.#domElement.ddlDataSources.value;

		if (entitiesId !== '') {
			ExternalDataManager.updateDataSourceVisibility(ViewerService.viewer, entitiesId, false);
			ViewerService.refreshScene();
		}
	}

	static #onBtnDeleteClick() {
		const entitiesId = Application.#domElement.ddlDataSources.value;

		if (entitiesId !== '') {
			Application.#domElement.ddlDataSources.remove(Application.#domElement.ddlDataSources.selectedIndex);
			ExternalDataManager.removeDataSource(ViewerService.viewer, entitiesId);
			ViewerService.refreshScene();
		}
	}

	// Geocoding
	static #onSearchBoxInput() {
		const searchResultsList = Application.#domElement.searchResultsList;

		if (searchResultsList.length > 0) {
			searchResultsList.selectedIndex = -1;
			searchResultsList.options.length = 0;
			searchResultsList.style.display = 'none';
			MarkersManager.removeMarker(Application.#geocoderMarkerId);
			Application.#geocoderMarkerId = null;
			ViewerService.refreshScene();
		}
	}

	static async #onBtnSearchClick() {
		try {
			const searchBox = Application.#domElement.searchBox;
			const searchResultsList = Application.#domElement.searchResultsList;

			if (searchBox.value.trim()) {
				searchResultsList.selectedIndex = -1;
				searchResultsList.options.length = 0;
				const searchResults = await GeocodingService.getCandidates(searchBox.value.trim());

				if (searchResults.length === 0) {
					Application.#showToast('No se han encontrado resultados');
					searchBox.value = '';
				}
				else {
					for (const result of searchResults) {
						const option = new Option(result.address, result.id);
						option.setAttribute('data-type', result.type);
						searchResultsList.add(option);
					}

					searchResultsList.style.display = 'block';
				}
			}
		}
		catch (err) {
			console.error(err);
			Application.#showToast(`Se ha producido un error en el geocodificador: ${err.message}`, Application.#toastType.ERROR);
		}
	}

	static async #onSeachResultsListChange() {
		try {
			MarkersManager.removeMarker(Application.#geocoderMarkerId);
			Application.#geocoderMarkerId = null;
			const resultId = Application.#domElement.searchResultsList.value;
			const resultType = Application.#domElement.searchResultsList.selectedOptions[0].dataset.type;
			const geocoderResult = await GeocodingService.find(resultId, resultType);
			const resultAltitude = await ViewerService.getElevation(geocoderResult.lat, geocoderResult.lng);
			const description = GeocodingService.getHtml(geocoderResult, resultAltitude);
			Application.#geocoderMarkerId = MarkersManager.createMarker(geocoderResult.lat, geocoderResult.lng, geocoderResult.fullAddress, description, Application.#markerPins.GEOCODING_RESULT);
			ViewerService.flyToPosition(geocoderResult.lat, geocoderResult.lng, Application.#DEFAULT_CAMERA_ALTITUDE, Application.#DEFAULT_CAMERA_HEADING, Application.#DEFAULT_CAMERA_PITCH);
		}
		catch (err) {
			console.error(err);
			Application.#showToast(`Se ha producido un error en el geocodificador: ${err.message}`, Application.#toastType.ERROR);
		}
	}

	static #onBtnClearSearchClick() {
		const searchResultsList = Application.#domElement.searchResultsList;
		const searchBox = Application.#domElement.searchBox;
		searchResultsList.selectedIndex = -1;
		searchResultsList.options.length = 0;
		searchResultsList.style.display = 'none';
		searchBox.value = '';
		MarkersManager.removeMarker(Application.#geocoderMarkerId);
		Application.#geocoderMarkerId = null;
		ViewerService.refreshScene();
	}

	// Layers

	// Slope
	static #onBtnSlopeClick() {
		const slopeLayerActive = Application.#domElement.btnSlope.dataset.active;

		if (slopeLayerActive === 'false') {
			ViewerService.clearGlobeMaterial();
			Application.#disableLayersButtons(Application.#domElement.btnSlope);
			ViewerService.showSlope();
			ViewerService.refreshScene();
			Application.#domElement.btnSlope.dataset.active = 'true';
			Application.#domElement.btnSlope.style.color = 'rgb(255, 165, 0)';
			Application.#showToast('Capa de pendientes activada');
		}
		else {
			ViewerService.clearGlobeMaterial();
			ViewerService.refreshScene();
			Application.#domElement.btnSlope.dataset.active = 'false';
			Application.#domElement.btnSlope.style.color = 'rgb(237, 255, 255)';
			Application.#showToast('Capa de pendientes desactivada');
		}
	}

	// Line art
	static #onBtnLineArtClick() {
		const lineArtLayerActive = Application.#domElement.btnLineArt.dataset.active;

		if (lineArtLayerActive === 'false') {
			ViewerService.clearGlobeMaterial();
			Application.#disableLayersButtons(Application.#domElement.btnLineArt);
			const sensitivity = Device.isMobile() ? 0.2 : 0.3;
			ViewerService.showLineArt(sensitivity);
			ViewerService.refreshScene();
			Application.#domElement.btnLineArt.dataset.active = 'true';
			Application.#domElement.btnLineArt.style.color = 'rgb(255, 165, 0)';
			Application.#showToast('Capa \'boceto\' activada');
		}
		else {
			ViewerService.clearGlobeMaterial();
			ViewerService.refreshScene();
			Application.#domElement.btnLineArt.dataset.active = 'false';
			Application.#domElement.btnLineArt.style.color = 'rgb(237, 255, 255)';
			Application.#showToast('Capa \'boceto\' desactivada');
		}
	}

	static #disableLayersButtons(activeLayerButton) {
		const layersButtons = [Application.#domElement.btnSlope, Application.#domElement.btnLineArt];

		for (const button of layersButtons) {
			if (button !== activeLayerButton) {
				button.dataset.active = 'false';
				button.style.color = 'rgb(237, 255, 255)';
			}
		}
	}

	// Geolocation
	static #onBtnUserPositionClick() {
		const geolocationActive = Application.#domElement.btnUserPosition.dataset.active;
		Device.vibrate();

		if (geolocationActive === 'false') {
			GeolocationService.trackPosition(Application.#processGeolocationPosition, Application.#processGeolocationError, { enableHighAccuracy: true, maximumAge: 0, timeout: 25000 }, 30000);
			Application.#domElement.btnUserPosition.dataset.active = 'true';
			Application.#domElement.btnUserPosition.style.color = 'rgb(255, 165, 0)';
			Application.#showToast('Geolocalización activada');
		}
		else {
			Application.#stopGeolocation();
			Application.#showToast('Geolocalización desactivada');
		}
	}

	static async #processGeolocationPosition(position) {
		const description = await Application.#getUserPositionDescription(position);
		const geolocationActive = Application.#domElement.btnUserPosition.dataset.active;

		if (geolocationActive === 'true') {

			if (!Application.#geolocationMarkerId) {
				const entityId = MarkersManager.createMarker(position.coords.latitude, position.coords.longitude, 'Posición actual', description, Application.#markerPins.GEO_LOCATION_POSITION);
				MarkersManager.addCircleToMarker(entityId, position.coords.accuracy, Cesium.Color.ORANGE.withAlpha(0.5), true);
				Application.#geolocationMarkerId = entityId;
				ViewerService.flyToPosition(position.coords.latitude, position.coords.longitude, Application.#DEFAULT_CAMERA_ALTITUDE, Application.#DEFAULT_CAMERA_HEADING, Application.#DEFAULT_CAMERA_PITCH);

			}
			else {
				MarkersManager.updateMarker(Application.#geolocationMarkerId, position.coords.latitude, position.coords.longitude, 'Posición actual', description);
				MarkersManager.updateMarkerCircle(Application.#geolocationMarkerId, position.coords.accuracy, Cesium.Color.ORANGE.withAlpha(0.5), true);
				ViewerService.refreshScene();
			}
		}
	}

	static async #getUserPositionDescription(position) {
		const altitudeMDT05 = await ViewerService.getElevation(position.coords.latitude, position.coords.longitude);
		let html = `<a href="geo:${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}"><strong>Latitud</strong>: ${position.coords.latitude.toFixed(6)}</a><br><br>`;
		html += `<a href="geo:${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}"><strong>Longitud</strong>: ${position.coords.longitude.toFixed(6)}</a><br><br>`;
		html += `<strong>Precisión (m)</strong>: ${position.coords.accuracy.toFixed(0)}<br><br>`;

		if (altitudeMDT05) {
			html += `<strong>Altitud MDT05 (m)</strong>: ${altitudeMDT05.toFixed(0)}<br><br>`;
		}
		else if (position.coords.altitude) {
			html += `<strong>Altitud WGS84 (m)</strong>: ${position.coords.altitude.toFixed(0)}<br><br>`;
		}

		html += `<strong>Fecha</strong>: ${new Date(position.timestamp).toLocaleDateString('es-ES')}<br><br>`;
		html += `<strong>Hora</strong>: ${new Date(position.timestamp).toLocaleTimeString('es-ES')}<br><br>`;
		return html;
	}

	static #processGeolocationError(error) {
		const isTimeoutError = error.code === GeolocationPositionError.TIMEOUT;
		console.error(error);

		if (!isTimeoutError) {
			Application.#showToast(`Se ha producido un error en la geolocalización: ${error.message}`, Application.#toastType.ERROR);
			Application.#stopGeolocation();
		}
	}

	static #stopGeolocation() {
		GeolocationService.stopTrackingPosition();
		Application.#domElement.btnUserPosition.dataset.active = 'false';
		Application.#domElement.btnUserPosition.style.color = 'rgb(237, 255, 255)';

		if (Application.#geolocationMarkerId) {
			MarkersManager.removeMarker(Application.#geolocationMarkerId);
			Application.#geolocationMarkerId = null;
		}

		ViewerService.refreshScene();
	}

	// Panorama
	static async #onBtnPanoramaClick() {
		try {
			Device.vibrate();
			const headingTrackingActive = Application.#domElement.btnPanorama.dataset.active;

			if (headingTrackingActive === 'false') {
				await DeviceHeadingTracker.start(Application.#processDeviceHeadingChange, Application.#currentCameraPosition.heading);
				Application.#domElement.btnPanorama.dataset.active = 'true';
				Application.#domElement.btnPanorama.style.color = 'rgb(255, 165, 0)';
				Application.#domElement.compass.removeEventListener('dblclick', Application.#onCompassDoubleClick);
				Application.#showToast('Sensor de orientación activado');
			}
			else {
				DeviceHeadingTracker.stop();
				Application.#domElement.btnPanorama.dataset.active = 'false';
				Application.#domElement.btnPanorama.style.color = 'rgb(237, 255, 255)';
				Application.#domElement.compass.addEventListener('dblclick', Application.#onCompassDoubleClick);
				Application.#showToast('Sensor de orientación desactivado');
			}
		}
		catch (err) {
			console.error(err);
			Application.#showToast(`Se ha producido un error en el sensor de orientación: ${err.message}`, Application.#toastType.ERROR);
		}
	}

	static #latestSensorHeading = null;
	static #isFrameRequested = false;

	static #processDeviceHeadingChange(newHeading) {
		Application.#latestSensorHeading = newHeading;

		if (!Application.#isFrameRequested) {
			Application.#isFrameRequested = true;
			requestAnimationFrame(Application.#renderDeviceFrame);
		}
	}

	static #renderDeviceFrame() {
		Application.#isFrameRequested = false;

		if (Application.#latestSensorHeading !== null) {
			ViewerService.setCameraHeading(Application.#latestSensorHeading);
		}
	}
}