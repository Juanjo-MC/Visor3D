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

	static #latestLoadedPOIsCameraPosition = {};	// Latest position where POIs were loaded {lat, lon}
	static #cameraHeading = null;					// Current camera heading
	static #geocoderMarkerId = null;				// Entity Id of geocoder pin
	static #geolocationMarkerId = null;				// Entity Id of geolocation position pin

	//DOM elements
	static #domElement = Object.freeze({
		viewerContainer: document.getElementById('viewerContainer'),
		coordinatesContainer: document.getElementById('coordinatesContainer'),
		compass: document.querySelector(".compass-circle"),
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
		POIFinder.initialize(await Utils.getCompressedJSONData(Application.#POIS_FILE_PATH));
		await ViewerService.initialize(Application.#domElement.viewerContainer.id);
		Application.#prepareUI();
		Application.#bindEventListeners();
		Application.#prepareScene();
	}

	static #prepareUI(){
		if (!Device.isMobile() && Device.hasMouse()){ // coordinates box only visible on PCs
			Application.#domElement.coordinatesContainer.style.display = 'flex';
			Application.#domElement.coordinatesContainer.innerHTML = '<strong>Lat</strong>:&nbsp;----&nbsp;&nbsp;<strong>Lon</strong>:&nbsp;----&nbsp;&nbsp;<strong>Altitud (m)</strong>:&nbsp;----<span>';
		}
		else {
			Application.#domElement.btnPanorama.style.display = 'flex';
		}
	}

	static #bindEventListeners(){
		ViewerService.onCameraChange(Application.#onCameraChange);
		ViewerService.onCameraStopMove(Application.#onCameraStopMove);
		ViewerService.onCanvasClick(Application.#onCanvasClick);

		if(!Device.isMobile() && Device.hasMouse()){
			ViewerService.onCanvasMouseMove(Application.#onMouseMove);
		}

		document.addEventListener("visibilitychange", Application.#onDocumentVisibilityChange);
		Application.#domElement.toggleCumbres.addEventListener('change', Application.#onCumbresToggleChange);
		Application.#domElement.togglePoblaciones.addEventListener('change', Application.#onPoblacionesToggleChange);
		Application.#domElement.toggleMasasDeAgua.addEventListener('change', Application.#onMasasDeAguaToggleChange);
		Application.#domElement.minVisibilityDistanceControl.addEventListener('input', Application.#onMinVisibilityDistanceInput);
		Application.#domElement.minVisibilityDistanceControl.addEventListener('change', Application.#onMinVisibilityDistanceChange);
		Application.#domElement.maxVisibilityDistanceControl.addEventListener('input', Application.#onMaxVisibilityDistanceInput);
		Application.#domElement.maxVisibilityDistanceControl.addEventListener('change', Application.#onMaxVisibilityDistanceChange);
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

	static #prepareScene(){
		// Restore last used cartography
		const lastCartography = localStorage.getItem('lastCartography');

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
				MarkersManager.createMarker(ViewerService.viewer, lat, lon, null, description, Application.#markerPins.QUERY_STRING_POSITION);
			}
			else{
				POIManager.addPOIToViewer(ViewerService.viewer, null, name, lat, lon, 10, 50000, Cesium.Color.fromBytes(226, 255, 226, 190), true);
			}
		}
		else{
			// check for saved camera position
			const jsonSavedCameraPosition = localStorage.getItem('lastCameraPosition');

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

		POIManager.addPOIsToViewer(ViewerService.viewer, pois, renderingOptions);
		ViewerService.flyToPosition(lat, lon, cameraAltitude, cameraHeading, cameraPitch);
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
			const visibilityDistance = Application.#getPOIsVisibilityRange();

			const renderingOptions = {
				cumbresVisible: Application.#domElement.toggleCumbres.checked,
				poblacionesVisible: Application.#domElement.togglePoblaciones.checked,
				masasDeAguaVisible: Application.#domElement.toggleMasasDeAgua.checked,
				minVisibilityDistance: visibilityDistance.min,
				maxVisibilityDistance: visibilityDistance.max,
			}

			POIManager.removePOIsFromViewer(ViewerService.viewer, poisToRemove);
			POIManager.addPOIsToViewer(ViewerService.viewer, poisToAdd, renderingOptions);
			ViewerService.refreshScene();
		}
	}

	static async #onCanvasClick(click){
		let clickCartographicPosition;

		// On touch devices, users may tap slightly above terrain features, over the sky area
		// To handle this, we search for coordinates up to 20 pixels below the touch position
		for (let i = 0; i < 20; i++  ){
			clickCartographicPosition = ViewerService.getCartographicScreenPosition(click.position);
			click.position.y += 1;

			if (clickCartographicPosition){
				break;
			}
		}

		if (clickCartographicPosition){
			const poi = POIFinder.findNearestPOI(clickCartographicPosition.lat, clickCartographicPosition.lon, 0.3);

			if (poi){
				const poiIsLoaded = POIManager.poiIsLoaded(ViewerService.viewer, poi.id);
				const poiIsVisible = POIManager.poiIsVisible(ViewerService.viewer, poi.id);

				if (poiIsLoaded && !poiIsVisible){
					const poiElevation = await ViewerService.getElevation(poi.lat, poi.lon);
					const labelText = poi.name + '\n' + poiElevation.toFixed(0) + ' m';
					POIManager.setPoiLabelProperties(ViewerService.viewer, poi.id, labelText, true);
					POIManager.showPOI(ViewerService.viewer, poi.id);
					ViewerService.refreshScene();

					setTimeout(function(){
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

						const visibilityDistance = Application.#getPOIsVisibilityRange();
						POIManager.setPoiLabelProperties(ViewerService.viewer, poi.id, poi.name, false, visibilityDistance);

						if (!showPOI){
							POIManager.hidePOI(ViewerService.viewer, poi.id);
						}

						ViewerService.refreshScene();
					}, 5000);
				}
			}
		}
	}

	static async #onMouseMove(movement){
		const mousePosition = movement.endPosition;
		const position = ViewerService.getCartographicScreenPosition(mousePosition);
		const isObject = ViewerService.isCursorOverObject(mousePosition);
		let lat = '----';
		let lon = '----';
		let altitude;

			if (position && !isObject){
				lat = position.lat.toFixed(6);
				lon = position.lon.toFixed(6);
				altitude = await ViewerService.getElevation(lat, lon);

				if (altitude){
					altitude = altitude.toFixed(0);
				}
				else{
					altitude = '----';
				}
			}
			else{
				altitude = '----';
			}

		Application.#domElement.coordinatesContainer.innerHTML = '<strong>Lat</strong>:&nbsp;' + lat + '&nbsp;&nbsp;<strong>Lon</strong>:&nbsp;' + lon + '&nbsp;&nbsp;<strong>Altitud (m)</strong>:&nbsp;' + altitude + '<span>';
	}

	static #onDocumentVisibilityChange(){
		if (document.hidden){
			localStorage.setItem('lastCameraPosition', JSON.stringify(ViewerService.getCameraPosition()));
			localStorage.setItem('lastCartography', ViewerService.currentImageryName);
		}
	}

	// POIs
	static async #onCumbresToggleChange(){
		await Application.#setPOIsVisibility(ViewerService.viewer, POIManager.poiType.CUMBRE, this.checked);
	}

	static async #onPoblacionesToggleChange(){
		await Application.#setPOIsVisibility(ViewerService.viewer, POIManager.poiType.POBLACION, this.checked);
	}

	static async #onMasasDeAguaToggleChange(){
		await Application.#setPOIsVisibility(ViewerService.viewer, POIManager.poiType.MASA_DE_AGUA, this.checked);
	}

	static async #setPOIsVisibility(viewer, poiType, visible){
		await Application.#showSpinner();
		POIManager.setPOIsVisibility(viewer, poiType, visible);
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
		Application.#domElement.minVisibilityDistanceLabel.innerHTML = this.value + "&nbsp;km";
	}

	static #onMinVisibilityDistanceChange(){
		Application.#setPOIsVisibilityRange();
	}

	static #onMaxVisibilityDistanceInput(){
		Application.#domElement.maxVisibilityDistanceLabel.innerHTML = this.value + "&nbsp;km";
	}

	static #onMaxVisibilityDistanceChange(){
		Application.#setPOIsVisibilityRange();
	}

	static #getPOIsVisibilityRange(){
		let minVisibilityDistance = Math.min(Application.#domElement.minVisibilityDistanceControl.value, Application.#domElement.maxVisibilityDistanceControl.value) * 1000;
		const maxVisibilityDistance = Math.max(Application.#domElement.minVisibilityDistanceControl.value, Application.#domElement.maxVisibilityDistanceControl.value) * 1000;
		minVisibilityDistance < 10 ? minVisibilityDistance = 10 : minVisibilityDistance;
		return {min: minVisibilityDistance, max: maxVisibilityDistance};
	}

	static #setPOIsVisibilityRange(){
		const visibilityDistance = Application.#getPOIsVisibilityRange();
		POIManager.setPOIsVisibilityRange(ViewerService.viewer, visibilityDistance.min, visibilityDistance.max);
		ViewerService.refreshScene();
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
						window.alert('Tipo de fichero no soportado: ' + fileExtension);
						return;
				}

				const option = new Option(dataSourceInfo.name, dataSourceInfo.entitiesCollectionId);
				Application.#domElement.ddlDataSources.add(option);
				ViewerService.flyToDataSource(ExternalDataService.getDataSource(ViewerService.viewer, dataSourceInfo.entitiesCollectionId));
			}
			catch (err){
				window.alert('Error al procesar el fichero ' + file.name + ': ' + err.message);
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

		if (searchResultsList.length > 0) {
			searchResultsList.selectedIndex = -1;
			searchResultsList.options.length = 0;
			searchResultsList.style.display = 'none';
			MarkersManager.removeMarker(ViewerService.viewer, Application.#geocoderMarkerId);
			Application.#geocoderMarkerId = null;
			ViewerService.refreshScene();
		}
	}

	static async #onBtnSearchClick(){
		const searchBox = Application.#domElement.searchBox;
		const searchResultsList = Application.#domElement.searchResultsList;

		if (searchBox.value.trim()){
			searchResultsList.selectedIndex = -1;
			searchResultsList.options.length = 0;
			const searchResults = await GeocodingService.getCandidates(searchBox.value.trim());

			if (searchResults.length === 0){
				window.alert('No se han encontrado resultados');
				searchBox.value = '';
			}
			else {
				for (const result of searchResults){
					const option = new Option(result.address, result.id);
					option.setAttribute('type', result.type);
					searchResultsList.add(option);
				}

			searchResultsList.style.display = 'block';

			}
		}
	}

	static async #onSeachResultsListChange(){
		MarkersManager.removeMarker(ViewerService.viewer, Application.#geocoderMarkerId);
		Application.#geocoderMarkerId = null;
		const resultId = Application.#domElement.searchResultsList.value;
		const resultType = Application.#domElement.searchResultsList.selectedOptions[0].attributes.type.nodeValue;
		const geocoderResult = await GeocodingService.find(resultId, resultType);
		const resultAltitude = await ViewerService.getElevation(geocoderResult.lat, geocoderResult.lng);
		const description = GeocodingService.getHtml(geocoderResult, resultAltitude);
		Application.#geocoderMarkerId = MarkersManager.createMarker(ViewerService.viewer, geocoderResult.lat, geocoderResult.lng, geocoderResult.fullAddress, description, Application.#markerPins.GEOCODING_RESULT);
		ViewerService.flyToPosition(geocoderResult.lat, geocoderResult.lng, Application.#DEFAULT_CAMERA_ALTITUDE, Application.#DEFAULT_CAMERA_HEADING, Application.#DEFAULT_CAMERA_PITCH);
	}

	static #onBtnClearSearchClick(){
		const searchResultsList = Application.#domElement.searchResultsList;
		const searchBox = Application.#domElement.searchBox;
		searchResultsList.selectedIndex = -1;
		searchResultsList.options.length = 0;
		searchResultsList.style.display = 'none';
		searchBox.value = '';
		MarkersManager.removeMarker(ViewerService.viewer, Application.#geocoderMarkerId);
		Application.#geocoderMarkerId = null;
		ViewerService.refreshScene();
	}

	// Geolocation
	static #onBtnUserPositionClick(){
		const geolocationActive = Application.#domElement.btnUserPosition.getAttribute("active");

		if (geolocationActive === "false"){
			GeolocationService.trackPosition(Application.#processGeolocationPosition, Application.#processGeolocationError, {enableHighAccuracy: true, timeout: 25000}, 30000);
			Application.#domElement.btnUserPosition.setAttribute('active', 'true');
			Application.#domElement.btnUserPosition.style.color = 'rgb(255, 165, 0)';
		}
		else{
			Application.#stopGeolocation();
		}
	}

	static async #processGeolocationPosition(position){
		const description = await Application.#getUserPositionDescription(position);

		if (!Application.#geolocationMarkerId){
			const entityId = MarkersManager.createMarker(ViewerService.viewer, position.coords.latitude, position.coords.longitude, 'Posición actual', description, Application.#markerPins.GEO_LOCATION_POSITION);
			MarkersManager.addCircleToMarker(ViewerService.viewer, entityId, position.coords.accuracy, Cesium.Color.ORANGE.withAlpha(0.5), true);
			Application.#geolocationMarkerId = entityId;
			ViewerService.flyToPosition(position.coords.latitude, position.coords.longitude, Application.#DEFAULT_CAMERA_ALTITUDE, Application.#DEFAULT_CAMERA_HEADING, Application.#DEFAULT_CAMERA_PITCH);
		}
		else{
			MarkersManager.updateMarker(ViewerService.viewer, Application.#geolocationMarkerId, position.coords.latitude, position.coords.longitude, 'Posición actual', description);
			MarkersManager.updateMarkerCircle(ViewerService.viewer, Application.#geolocationMarkerId, position.coords.accuracy, Cesium.Color.ORANGE.withAlpha(0.5), true);
			ViewerService.refreshScene();
		}
	}

	static async #getUserPositionDescription(position){
		const altitudeMDT05 = await ViewerService.getElevation(position.coords.latitude, position.coords.longitude);
		let html = '<a href="geo:' + position.coords.latitude.toFixed(6) + ',' + position.coords.latitude.toFixed(6) + '">' + '<strong>Latitud</strong>: ' + position.coords.latitude.toFixed(6) + '</a><br><br>';
		html += '<a href="geo:' + position.coords.latitude.toFixed(6) + ',' + position.coords.longitude.toFixed(6) + '">' + '<strong>Longitud</strong>: ' + position.coords.longitude.toFixed(6) + '</a><br><br>';
		html += '<strong>Precisión (m)</strong>: ' + position.coords.accuracy.toFixed(0) + '<br><br>';

		if (altitudeMDT05){
			html += '<strong>Altitud MDT05 (m)</strong>: ' + altitudeMDT05.toFixed(0) + '<br><br>';
		}
		else if(position.coords.altitude){
			html += '<strong>Altitud WGS84 (m)</strong>: ' + position.coords.altitude.toFixed(0) + '<br><br>';
		}

		html += '<strong>Fecha</strong>: ' + new Date(position.timestamp).toLocaleDateString("es-ES") + '<br><br>';
		html += '<strong>Hora</strong>: ' + new Date(position.timestamp).toLocaleTimeString("es-ES") + '<br><br>';
		return html;
	}

	static #processGeolocationError(error){
		console.log('Geolocation error: ' + error.message);
		window.alert('Se ha producido un error en la geolocalización: ' + error.message);
		Application.#stopGeolocation();
	}

	static #stopGeolocation(){
		GeolocationService.stopTrackingPosition();
		MarkersManager.removeMarker(ViewerService.viewer, Application.#geolocationMarkerId);
		Application.#domElement.btnUserPosition.setAttribute('active', 'false');
		Application.#domElement.btnUserPosition.style.color = 'rgb(237, 255, 255)';
		ViewerService.refreshScene();
		Application.#geolocationMarkerId = null;
	}

	// Panorama
	static async #onBtnPanoramaClick(){
		const headingTrackingActive = Application.#domElement.btnPanorama.getAttribute("active");

		if (headingTrackingActive === "false"){
			const headingTrackerStarted = await DeviceHeadingTracker.start(ViewerService.setCameraHeading, Application.#cameraHeading);

			if(headingTrackerStarted){
				Application.#domElement.btnPanorama.setAttribute('active', 'true');
				Application.#domElement.btnPanorama.style.color = 'rgb(255, 165, 0)';
			}
		}
		else{
			DeviceHeadingTracker.stop();
			Application.#domElement.btnPanorama.setAttribute('active', 'false');
			Application.#domElement.btnPanorama.style.color = 'rgb(237, 255, 255)';
		}
	}
}