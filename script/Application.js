import {Device} from './Device.js';
import {Utils} from './Utils.js';
import {ViewerService} from './ViewerService.js';
import {POIFinder} from './POIFinder.js';
import {POIManager} from './POIManager.js';
import {CompassService} from './CompassService.js';
import {ExternalDataService} from './ExternalDataService.js';
import {GeocodingService} from './GeocodingService.js';
import {GeolocationService} from './GeolocationService.js';
import {MarkersManager} from './MarkersManager.js';
import {DeviceHeadingTracker} from './DeviceHeadingTracker.js';

export class Application{
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

	static #toastType = Object.freeze({
		INFO: 'info',
		WARNING: 'warning',
		ERROR: 'error',
	});

	static #latestLoadedPOIsCameraPosition = {};	// Latest position where POIs were loaded {lat, lon}
	static #cameraHeading = null;					// Current camera heading
	static #geocoderMarkerId = null;				// Entity Id of geocoder pin
	static #geolocationMarkerId = null;				// Entity Id of geolocation position pin
	static #isGeolocationStopping = false;			// Prevents a race condition when stopping geolocation before the first position update

	//DOM elements
	static #domElement = Object.freeze({
		viewerContainer: document.getElementById('viewerContainer'),
		toastContainer: document.getElementById('toastContainer'),
		coordinatesContainer: document.getElementById('coordinatesContainer'),
		compass: document.querySelector('.compass-circle'),
		toggleCumbres: document.getElementById('toggleCumbres'),
		togglePoblaciones: document.getElementById('togglePoblaciones'),
		toggleMasasDeAgua: document.getElementById('toggleMasasDeAgua'),
		spinner: document.getElementById('spinner'),
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
	});

	static async initialize(){
		try{
			POIFinder.initialize(await Utils.getCompressedJSONData(Application.#POIS_FILE_PATH));
			await ViewerService.initialize(Application.#domElement.viewerContainer.id);
			await POIManager.initialize(ViewerService.viewer);
			await MarkersManager.initialize(ViewerService.viewer);
			Application.#prepareUI();
			Application.#bindEventListeners();
			await Application.#prepareScene();
		}
		catch(err){
			console.error(err);
			Application.#showToast('Se ha producido un error al inicializar la aplicación: ' + err.message, Application.#toastType.ERROR);
		}
	}

	static #prepareUI(){
		if (!Device.isMobile() && Device.hasMouse()){ // Coordinates box only visible on PCs
			Application.#domElement.coordinatesContainer.style.display = 'flex';
			Application.#domElement.coordinatesContainer.innerHTML = '<strong>Lat</strong>:&nbsp;----&nbsp;&nbsp;<strong>Lon</strong>:&nbsp;----&nbsp;&nbsp;<strong>Altitud&nbsp;(m)</strong>:&nbsp;----<span>';
		}
		else{ // Panorama button only visible on mobile devices
			Application.#domElement.btnPanorama.style.display = 'flex';
		}
	}

	static #bindEventListeners(){
		ViewerService.onCameraChange(Application.#onCameraChange);
		ViewerService.onCameraStopMove(Application.#onCameraStopMove);
		ViewerService.onCanvasClick(Application.#onCanvasClick);
		ViewerService.onCanvasMouseDown(Application.#onCanvasMouseDown);
		ViewerService.onCanvasMouseUp(Application.#onCanvasMouseUp);

		if (!Device.isMobile() && Device.hasMouse()){
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
	}

	static async #prepareScene(){ // TO DO: refactor. This function is dificult to follow, it should probably be splitted on smaller logical chunks
		// Restore last used cartography
		let lastCartography;

		try{
			lastCartography = window.localStorage.getItem('lastCartography');
		}
		catch (err){
			console.error(err);
		}

		if (lastCartography){
			ViewerService.setImagery(lastCartography);
		}

		let lat = parseFloat(decodeURIComponent(Utils.getQueryStringValue('lat')).replace(/ /g, ''));
		let lon = parseFloat(decodeURIComponent(Utils.getQueryStringValue('lon')).replace(/ /g, ''));
		let name = decodeURIComponent(Utils.getQueryStringValue('name')).trim();
		let cameraAltitude = Application.#DEFAULT_CAMERA_ALTITUDE;
		let cameraHeading = Application.#DEFAULT_CAMERA_HEADING;
		let cameraPitch = Application.#DEFAULT_CAMERA_PITCH;

		if (Utils.isValidLatitude(lat) && Utils.isValidLongitude(lon)){

			if (name === 'null' || name.length === 0){
				let description = '<a href="geo:' + lat.toFixed(6) + ',' + lon.toFixed(6) + '">' + '<strong>Latitud</strong>: ' + lat.toFixed(6) + '</a><br><br>';
				description += '<a href="geo:' + lat.toFixed(6) + ',' + lon.toFixed(6) + '">' + '<strong>Longitud</strong>: ' + lon.toFixed(6) + '</a>';
				MarkersManager.createMarker(lat, lon, null, description, Application.#markerPins.QUERY_STRING_POSITION);
			}
			else{
				POIManager.addPOIToViewer(null, name, lat, lon, 10, 50000, Cesium.Color.fromBytes(226, 255, 226, 190), true);
			}
		}
		else{
			// check for saved camera position
			let jsonSavedCameraPosition;

			try{
				jsonSavedCameraPosition = window.localStorage.getItem('lastCameraPosition');
			}
			catch (err){
				console.error(err);
			}

			if (jsonSavedCameraPosition){
				const savedCameraPosition = JSON.parse(jsonSavedCameraPosition);
				lat = savedCameraPosition.lat;
				lon = savedCameraPosition.lon;
				cameraAltitude = savedCameraPosition.altitude;
				cameraHeading = savedCameraPosition.heading;
				cameraPitch = savedCameraPosition.pitch;
			}
			else{
				// no coordinates have been received or they are invalid and there is no previous position saved in the local storage, display the map in the default position
				lat = Application.#FALLBACK_MAP_CENTER_LAT;
				lon = Application.#FALLBACK_MAP_CENTER_LON;
				cameraAltitude = Application.#FALLBACK_CAMERA_ALTITUDE;
				cameraHeading = Application.#FALLBACK_CAMERA_HEADING;
				cameraPitch = Application.#FALLBACK_CAMERA_PITCH;
			}
		}

		Application.#latestLoadedPOIsCameraPosition.lat = lat;
		Application.#latestLoadedPOIsCameraPosition.lon = lon;
		const pois = POIFinder.findPOIsAround(lat, lon, Application.#DEFAULT_POIS_LOAD_RADIUS);

		const renderingOptions = {
			cumbresVisible: false,
			poblacionesVisible: false,
			masasDeAguaVisible: false,
			minVisibilityDistance: 10,
			maxVisibilityDistance: 20000,
		}

		POIManager.addPOIsToViewer(pois, renderingOptions);
		ViewerService.flyToPosition(lat, lon, cameraAltitude, cameraHeading, cameraPitch);
	}

	static #showToast(message, type = Application.#toastType.INFO, duration = 5000){
		const container = Application.#domElement.toastContainer;
		let iconClass;

		switch (type){
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
		toast.innerHTML = '<i class="toast-icon ' + iconClass + '"></i>' + message;
		container.appendChild(toast);
		requestAnimationFrame(() => toast.classList.add('show'));

		setTimeout(() => {
			toast.classList.remove('show');
			toast.classList.add('hide');
			toast.addEventListener('transitionend', () => container.removeChild(toast), {once: true});
		}, duration);
	}

	// Event listeners
	static #onCameraChange(){
		const cameraHeading = ViewerService.getCameraPosition().heading.toFixed(2);

		// Only rotation movements do change the camera heading. Other movements like, for example, translation, don't
		// This check avoid unnecessary compass updates
		if (cameraHeading !== Application.#cameraHeading){
			Application.#cameraHeading = cameraHeading;
			const compassHeading = CompassService.getHeading(Math.round(cameraHeading));
			Application.#domElement.compass.style.transform = 'translate(-50%, -50%) rotate(' + (compassHeading * -1) + 'deg)';
		}
	}

	static #onCameraStopMove(){
		const cameraPosition = ViewerService.getCameraPosition();
		const lat = cameraPosition.lat;
		const lon = cameraPosition.lon;
		const oldCameraPosition = {lat: Application.#latestLoadedPOIsCameraPosition.lat, lon: Application.#latestLoadedPOIsCameraPosition.lon};
		Application.#latestLoadedPOIsCameraPosition.lat = lat;
		Application.#latestLoadedPOIsCameraPosition.lon = lon;

		if (oldCameraPosition.lat.toFixed(6) !== Application.#latestLoadedPOIsCameraPosition.lat.toFixed(6) || oldCameraPosition.lon.toFixed(6) !== Application.#latestLoadedPOIsCameraPosition.lon.toFixed(6)){
			const poisInOldBbox = POIFinder.findPOIsAround(oldCameraPosition.lat, oldCameraPosition.lon, Application.#DEFAULT_POIS_LOAD_RADIUS);
			const poisInNewBbox = POIFinder.findPOIsAround(Application.#latestLoadedPOIsCameraPosition.lat, Application.#latestLoadedPOIsCameraPosition.lon, Application.#DEFAULT_POIS_LOAD_RADIUS);
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
			ViewerService.refreshScene();
		}
	}

	static async #onCanvasClick(click){
		// On touch devices, users may tap slightly above terrain features, over the sky area
		// To handle this, we search for coordinates up to 'yPixelsTolerance' pixels below the touch position
		const yPixelsTolerance = 20;
		const delay = 5000; // Show the POI for this time (ms)
		let y = click.position.y;
		let clickCartographicPosition;

		for (let i = 0; i < yPixelsTolerance; i++){
			clickCartographicPosition = ViewerService.getCartographicScreenPosition({x: click.position.x, y: y});
			y += 1;

			if (clickCartographicPosition){
				break;
			}
		}

		if (clickCartographicPosition){
			const poi = POIFinder.findNearestPOI(clickCartographicPosition.lat, clickCartographicPosition.lon, 0.3);

			if (poi){
				const poiIsLoaded = POIManager.poiIsLoaded(poi.id);
				const poiIsVisible = POIManager.poiIsVisible(poi.id);

				if (poiIsLoaded && !poiIsVisible){
					const poiElevation = await ViewerService.getElevation(poi.lat, poi.lon);
					const labelText = poi.name + '\n' + poiElevation.toFixed(0) + ' m';
					POIManager.setPoiLabelProperties(poi.id, labelText, true);
					POIManager.showPOI(poi.id);
					ViewerService.refreshScene();

					setTimeout(() => {
						const poiType = POIManager.getPOIType(poi.id);
						const toggleCumbres = Application.#domElement.toggleCumbres;
						const togglePoblaciones = Application.#domElement.togglePoblaciones;
						const toggleMasasDeAgua = Application.#domElement.toggleMasasDeAgua;
						let showPOI;

						if (poiType === POIManager.poiType.CUMBRE){
							showPOI = toggleCumbres.checked;
						}
						else if (poiType === POIManager.poiType.POBLACION){
							showPOI = togglePoblaciones.checked;
						}
						else if (poiType === POIManager.poiType.MASA_DE_AGUA){
							showPOI = toggleMasasDeAgua.checked;
						}

						const visibilityRange = Application.#getPOIsVisibilityRange();
						POIManager.setPoiLabelProperties(poi.id, poi.name, false, visibilityRange);

						if (!showPOI){
							POIManager.hidePOI(poi.id);
						}

						ViewerService.refreshScene();
					}, delay);
				}
			}
		}
	}

	static #onCanvasMouseDown(click){
		const delay = 750;			// Time (ms) to wait before starting rotation, if conditions remain valid
		const margin = 50;			// Maximum distance from any screen edge where the click is considered for rotation
		const bottomMargin = 70;	// Higher bottom margin to account for UI widgets occupying space at the bottom of the screen
		const x = click.position.x;
		const y = click.position.y;
		let mouseStillDown = true;
		let positionUnchanged = true;

		if(x > margin && x < window.innerWidth - margin && y > margin && y < window.innerHeight - bottomMargin){
			return;
		}

		const onPointerUp = () => { // Cancel rotation if the pointer is released before the delay expires
			mouseStillDown = false;
			removeEventListeners();
		};

		const onPointerMove = (e) => { // Cancel rotation if the pointer moves more than 5px from the initial click position before the delay expires
			if (Math.abs(e.clientX - x) > 5 || Math.abs(e.clientY - y) > 5) {
				positionUnchanged = false;
				removeEventListeners();
			}
		};

		const removeEventListeners = () => {
			document.removeEventListener("pointerup", onPointerUp, {capture: true});
			document.removeEventListener("pointermove", onPointerMove, { capture: true });
		};

		document.addEventListener("pointerup", onPointerUp, {capture: true});
		document.addEventListener("pointermove", onPointerMove, {capture: true});

		setTimeout(() => {
			removeEventListeners();

			if (mouseStillDown && positionUnchanged){
				if (x <= margin){
					ViewerService.toggleCameraGestures(false);
					ViewerService.startRotation(ViewerService.rotationAxis.HEADING, ViewerService.rotationDirection.NEGATIVE);
				}
				else if (x >= window.innerWidth - margin){
					ViewerService.toggleCameraGestures(false);
					ViewerService.startRotation(ViewerService.rotationAxis.HEADING, ViewerService.rotationDirection.POSITIVE);
				}
				else if (y <= margin){
					ViewerService.toggleCameraGestures(false);
					ViewerService.startRotation(ViewerService.rotationAxis.PITCH, ViewerService.rotationDirection.POSITIVE);
				}
				else if (y >= window.innerHeight - bottomMargin - 20){
					ViewerService.toggleCameraGestures(false);
					ViewerService.startRotation(ViewerService.rotationAxis.PITCH, ViewerService.rotationDirection.NEGATIVE);
				}
			}
		}, delay);
	}

	static #onCanvasMouseUp(click){
		ViewerService.stopRotation();
		ViewerService.toggleCameraGestures(true);
	}

	static async #onMouseMove(movement){
		const position = ViewerService.getCartographicScreenPosition(movement.endPosition);
		let lat = '----';
		let lon = '----';
		let altitude = '----';

		if (position){
			lat = position.lat.toFixed(6);
			lon = position.lon.toFixed(6);
			altitude = await ViewerService.getElevation(lat, lon);

			if (altitude){
				altitude = altitude.toFixed(0);
			}
		}

		Application.#domElement.coordinatesContainer.innerHTML = '<strong>Lat</strong>:&nbsp;' + lat + '&nbsp;&nbsp;<strong>Lon</strong>:&nbsp;' + lon + '&nbsp;&nbsp;<strong>Altitud&nbsp;(m)</strong>:&nbsp;' + altitude + '<span>';
	}

	static #onSelectedImageryChange(imagery){
		Application.#showToast('Mostrando ' + imagery.name);
	}

	static #onDocumentVisibilityChange(){
		if (document.hidden){
			try{
				window.localStorage.setItem('lastCameraPosition', JSON.stringify(ViewerService.getCameraPosition()));
				window.localStorage.setItem('lastCartography', ViewerService.currentImageryName);
			}
			catch (err){
				console.error(err);
			}
		}
	}

	static #onCompassDoubleClick(){
		const compassRect = event.currentTarget.getBoundingClientRect();
		const x = event.clientX - compassRect.left;
		const isRightHalf = x > compassRect.width / 2;
		const currentCameraPosition = ViewerService.getCameraPosition();
		let currentHeading;
		let newHeading;

		if (isRightHalf){
			currentHeading = Math.ceil(currentCameraPosition.heading);
			newHeading = (currentHeading - (currentHeading % 90) + 90) % 360;
		} else{
			currentHeading = Math.floor(currentCameraPosition.heading);
			const offset = (currentHeading % 90) === 0 ? 0 :  90 - (currentHeading % 90); // offset to next cardinal clockwise
			newHeading = (currentHeading + offset - 90 + 360) % 360;
		}

		let headingText;

		switch (newHeading){
			case 0:
				headingText = 'Norte';
				break;
			case 90:
				headingText = 'Este';
				break;
			case 180:
				headingText = 'Sur';
				break;
			case 270:
				headingText = 'Oeste';
				break;
		}

		ViewerService.flyToPosition(currentCameraPosition.lat, currentCameraPosition.lon, currentCameraPosition.altitude, newHeading, currentCameraPosition.pitch);
		Application.#showToast('Orientando el visor hacia el ' + headingText);
	}

	// POIs
	static async #onPOIsVisibilityToggleChange(domElement, poiType){
		domElement.addEventListener("change", async e => Application.#setPOIsVisibility(poiType, e.target.checked));
	}

	static async #setPOIsVisibility(poiType, visible){
		await Application.#showSpinner();
		POIManager.setPOIsVisibility(poiType, visible);
		await Application.#hideSpinner();
		ViewerService.refreshScene();
	}

	static async #showSpinner(){
		await new Promise(resolve => setTimeout(resolve, 20));
		Application.#domElement.spinner.style.display = 'block';
	}

	static async #hideSpinner(){
		await new Promise(resolve => setTimeout(resolve, 20));
		Application.#domElement.spinner.style.display = 'none';
	}

	static #onMinVisibilityDistanceInput(){
		Application.#domElement.minVisibilityDistanceLabel.innerHTML = this.value + '&nbsp;km';
	}

	static #onMaxVisibilityDistanceInput(){
		Application.#domElement.maxVisibilityDistanceLabel.innerHTML = this.value + '&nbsp;km';
	}

	static #setPOIsVisibilityRange(){
		const visibilityRange = Application.#getPOIsVisibilityRange();
		POIManager.setPOIsVisibilityRange(visibilityRange.min, visibilityRange.max);
		ViewerService.refreshScene();
	}

	static #getPOIsVisibilityRange(){
		const a = +Application.#domElement.minVisibilityDistanceControl.value;
		const b = +Application.#domElement.maxVisibilityDistanceControl.value;

		return {
			min: Math.max(Math.min(a, b) * 1000, 10),
			max: Math.max(a, b) * 1000,
		};
	}

	// External data
	static async #onFileInputChange(){
		const file = this.files[0];

		if (file){
			try{
				const arr = file.name.split('.');
				const fileExtension = arr[arr.length - 1].toLowerCase();
				let dataSourceInfo;

				switch (fileExtension){
					case 'gpx':
						dataSourceInfo = await ExternalDataService.addGpxDataSource(ViewerService.viewer, {data: file, fileName: file.name}, Application.#markerPins.EXTERNAL_DATA_WAYPOINTS);
						break;
					case 'kml':
					case 'kmz':
						dataSourceInfo = await ExternalDataService.addKmlDataSource(ViewerService.viewer, {data: file, fileName: file.name}, Application.#markerPins.EXTERNAL_DATA_WAYPOINTS);
						break;
					case 'json':
					case 'geojson':
						const jsonData = JSON.parse(await file.text());
						dataSourceInfo = await ExternalDataService.addGeoJsonDataSource(ViewerService.viewer, {data: jsonData, fileName: file.name}, Application.#markerPins.EXTERNAL_DATA_WAYPOINTS);
						break;
					default:
						Application.#showToast('Tipo de fichero no soportado: ' + fileExtension, Application.#toastType.WARNING);
						return;
				}

				const option = new Option(dataSourceInfo.name, dataSourceInfo.entitiesCollectionId);
				Application.#domElement.ddlDataSources.add(option);
				ViewerService.flyToDataSource(ExternalDataService.getDataSource(ViewerService.viewer, dataSourceInfo.entitiesCollectionId));
			}
			catch (err){
				console.error(err);
				Application.#showToast('Se ha producido un error al procesar el fichero ' + file.name + ': ' + err.message, Application.#toastType.ERROR);
			}
			finally{
				this.value = null;
			}
		}
	}

	static #onBtnShowClick(){
		const entitiesId = Application.#domElement.ddlDataSources.value;

		if (entitiesId !== ''){
			ExternalDataService.updateDataSourceVisibility(ViewerService.viewer, entitiesId, true);
			ViewerService.flyToDataSource(ExternalDataService.getDataSource(ViewerService.viewer, entitiesId));
		}
	}

	static #onBtnHideClick(){
		const entitiesId = Application.#domElement.ddlDataSources.value;

		if (entitiesId !== ''){
			ExternalDataService.updateDataSourceVisibility(ViewerService.viewer, entitiesId, false);
			ViewerService.refreshScene();
		}
	}

	static #onBtnDeleteClick(){
		const entitiesId = Application.#domElement.ddlDataSources.value;

		if (entitiesId !== ''){
			Application.#domElement.ddlDataSources.remove(Application.#domElement.ddlDataSources.selectedIndex);
			ExternalDataService.removeDataSource(ViewerService.viewer, entitiesId);
			ViewerService.refreshScene();
		}
	}

	// Geocoding
	static #onSearchBoxInput(){
		const searchResultsList = Application.#domElement.searchResultsList;

		if (searchResultsList.length > 0){
			searchResultsList.selectedIndex = -1;
			searchResultsList.options.length = 0;
			searchResultsList.style.display = 'none';
			MarkersManager.removeMarker(Application.#geocoderMarkerId);
			Application.#geocoderMarkerId = null;
			ViewerService.refreshScene();
		}
	}

	static async #onBtnSearchClick(){
		try{
			const searchBox = Application.#domElement.searchBox;
			const searchResultsList = Application.#domElement.searchResultsList;

			if (searchBox.value.trim()){
				searchResultsList.selectedIndex = -1;
				searchResultsList.options.length = 0;
				const searchResults = await GeocodingService.getCandidates(searchBox.value.trim());

				if (searchResults.length === 0){
					Application.#showToast('No se han encontrado resultados');
					searchBox.value = '';
				}
				else{
					for (const result of searchResults){
						const option = new Option(result.address, result.id);
						option.setAttribute('type', result.type);
						searchResultsList.add(option);
					}

				searchResultsList.style.display = 'block';

				}
			}
		}
		catch(err){
			console.error(err);
			Application.#showToast('Se ha producido un error en el geocodificador: ' + err.message, Application.#toastType.ERROR);
		}
	}

	static async #onSeachResultsListChange(){
		MarkersManager.removeMarker(Application.#geocoderMarkerId);
		Application.#geocoderMarkerId = null;
		const resultId = Application.#domElement.searchResultsList.value;
		const resultType = Application.#domElement.searchResultsList.selectedOptions[0].attributes.type.nodeValue;
		const geocoderResult = await GeocodingService.find(resultId, resultType);
		const resultAltitude = await ViewerService.getElevation(geocoderResult.lat, geocoderResult.lng);
		const description = GeocodingService.getHtml(geocoderResult, resultAltitude);
		Application.#geocoderMarkerId = MarkersManager.createMarker(geocoderResult.lat, geocoderResult.lng, geocoderResult.fullAddress, description, Application.#markerPins.GEOCODING_RESULT);
		ViewerService.flyToPosition(geocoderResult.lat, geocoderResult.lng, Application.#DEFAULT_CAMERA_ALTITUDE, Application.#DEFAULT_CAMERA_HEADING, Application.#DEFAULT_CAMERA_PITCH);
	}

	static #onBtnClearSearchClick(){
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

	// Geolocation
	static #onBtnUserPositionClick(){
		try{
			if ('vibrate' in navigator){
				navigator.vibrate(100);
			}

			const geolocationActive = Application.#domElement.btnUserPosition.getAttribute('active');

			if (geolocationActive === 'false'){
				GeolocationService.trackPosition(Application.#processGeolocationPosition, Application.#processGeolocationError, {enableHighAccuracy: true, timeout: 25000}, 30000);
				Application.#domElement.btnUserPosition.setAttribute('active', 'true');
				Application.#domElement.btnUserPosition.style.color = 'rgb(255, 165, 0)';
				Application.#showToast('Geolocalización activada');
			}
			else{
				Application.#stopGeolocation();
				Application.#showToast('Geolocalización desactivada');
			}
		}
		catch (err){
			Application.#processGeolocationError(err);
		}
	}

	static async #processGeolocationPosition(position){
		const description = await Application.#getUserPositionDescription(position);

		if (!Application.#geolocationMarkerId){
			const entityId = MarkersManager.createMarker(position.coords.latitude, position.coords.longitude, 'Posición actual', description, Application.#markerPins.GEO_LOCATION_POSITION);
			MarkersManager.addCircleToMarker(entityId, position.coords.accuracy, Cesium.Color.ORANGE.withAlpha(0.5), true);
			Application.#geolocationMarkerId = entityId;

			if (!Application.#isGeolocationStopping){
				ViewerService.flyToPosition(position.coords.latitude, position.coords.longitude, Application.#DEFAULT_CAMERA_ALTITUDE, Application.#DEFAULT_CAMERA_HEADING, Application.#DEFAULT_CAMERA_PITCH);
			}
		}
		else{
			MarkersManager.updateMarker(Application.#geolocationMarkerId, position.coords.latitude, position.coords.longitude, 'Posición actual', description);
			MarkersManager.updateMarkerCircle(Application.#geolocationMarkerId, position.coords.accuracy, Cesium.Color.ORANGE.withAlpha(0.5), true);
			ViewerService.refreshScene();
		}

		if (Application.#isGeolocationStopping){
			MarkersManager.removeMarker(Application.#geolocationMarkerId);
			Application.#geolocationMarkerId = null;
			Application.#isGeolocationStopping = false;
			ViewerService.refreshScene();
		}
	}

	static async #getUserPositionDescription(position){
		const altitudeMDT05 = await ViewerService.getElevation(position.coords.latitude, position.coords.longitude);
		let html = '<a href="geo:' + position.coords.latitude.toFixed(6) + ',' + position.coords.longitude.toFixed(6) + '">' + '<strong>Latitud</strong>: ' + position.coords.latitude.toFixed(6) + '</a><br><br>';
		html += '<a href="geo:' + position.coords.latitude.toFixed(6) + ',' + position.coords.longitude.toFixed(6) + '">' + '<strong>Longitud</strong>: ' + position.coords.longitude.toFixed(6) + '</a><br><br>';
		html += '<strong>Precisión (m)</strong>: ' + position.coords.accuracy.toFixed(0) + '<br><br>';

		if (altitudeMDT05){
			html += '<strong>Altitud MDT05 (m)</strong>: ' + altitudeMDT05.toFixed(0) + '<br><br>';
		}
		else if (position.coords.altitude){
			html += '<strong>Altitud WGS84 (m)</strong>: ' + position.coords.altitude.toFixed(0) + '<br><br>';
		}

		html += '<strong>Fecha</strong>: ' + new Date(position.timestamp).toLocaleDateString('es-ES') + '<br><br>';
		html += '<strong>Hora</strong>: ' + new Date(position.timestamp).toLocaleTimeString('es-ES') + '<br><br>';
		return html;
	}

	static #processGeolocationError(error){
		console.error(error);
		Application.#showToast('Se ha producido un error en la geolocalización: ' + error.message, Application.#toastType.ERROR);
		Application.#stopGeolocation();
	}

	static #stopGeolocation(){
		Application.#isGeolocationStopping = true;
		GeolocationService.stopTrackingPosition();
		Application.#domElement.btnUserPosition.setAttribute('active', 'false');
		Application.#domElement.btnUserPosition.style.color = 'rgb(237, 255, 255)';

		if(Application.#geolocationMarkerId){
			MarkersManager.removeMarker(Application.#geolocationMarkerId);
			Application.#geolocationMarkerId = null;
			Application.#isGeolocationStopping = false;
		}

		ViewerService.refreshScene();
	}

	// Panorama
	static async #onBtnPanoramaClick(){
		try{
			if ('vibrate' in navigator){
				navigator.vibrate(100);
			}

			const headingTrackingActive = Application.#domElement.btnPanorama.getAttribute('active');

			if (headingTrackingActive === 'false'){
				await DeviceHeadingTracker.start(ViewerService.setCameraHeading, Application.#cameraHeading);
				Application.#domElement.btnPanorama.setAttribute('active', 'true');
				Application.#domElement.btnPanorama.style.color = 'rgb(255, 165, 0)';
				Application.#domElement.compass.removeEventListener('dblclick', Application.#onCompassDoubleClick);
				Application.#showToast('Sensor de orientación activado');
			}
			else{
				DeviceHeadingTracker.stop();
				Application.#domElement.btnPanorama.setAttribute('active', 'false');
				Application.#domElement.btnPanorama.style.color = 'rgb(237, 255, 255)';
				Application.#domElement.compass.addEventListener('dblclick', Application.#onCompassDoubleClick);
				Application.#showToast('Sensor de orientación desactivado');
			}
		}
		catch (err){
			console.error(err);
			Application.#showToast('Se ha producido un error en el sensor de orientación: ' + err.message, Application.#toastType.ERROR);
		}
	}
}