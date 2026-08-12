export class POIManager {
	static #poiDataSource = null;

	static poiType = Object.freeze({
		CUMBRE: 'C:',
		POBLACION: 'P:',
		MASA_DE_AGUA: 'A:',
	});

	static #poiLabelColor = Object.freeze({
		CUMBRE: Cesium.Color.fromBytes(218, 218, 255, 190),
		POBLACION: Cesium.Color.fromBytes(253, 246, 228, 190),
		MASA_DE_AGUA: Cesium.Color.fromBytes(69, 127, 176, 190),
	});

	static async initialize(viewer) {
		POIManager.#poiDataSource = await viewer.dataSources.add(new Cesium.CustomDataSource('poiDataSource'));
	}

	static getPOIType(poiId) {
		if (poiId && poiId.startsWith(POIManager.poiType.CUMBRE)) {
			return POIManager.poiType.CUMBRE;
		}
		else if (poiId && poiId.startsWith(POIManager.poiType.POBLACION)) {
			return POIManager.poiType.POBLACION;
		}
		else if (poiId && poiId.startsWith(POIManager.poiType.MASA_DE_AGUA)) {
			return POIManager.poiType.MASA_DE_AGUA;
		}

		return null;
	}

	static #getPOIEntity(poiId) {
		return POIManager.#poiDataSource.entities.getById(poiId);
	}

	static poiIsLoaded(poiId) {
		const poiEntity = POIManager.#getPOIEntity(poiId);
		return poiEntity ? true : false;
	}

	static poiIsVisible(poiId) {
		const poiEntity = POIManager.#getPOIEntity(poiId);
		return poiEntity ? poiEntity.show : false;
	}

	static showPOI(poiId) {
		const poiEntity = POIManager.#getPOIEntity(poiId);
		poiEntity.show = true;
	}

	static hidePOI(poiId) {
		const poiEntity = POIManager.#getPOIEntity(poiId);
		poiEntity.show = false;
	}

	// POI label constant properties
	static #labelScale = window.devicePixelRatio > 2 ? 1.2 : 1; // On high DPI displays, increase label size to improve readability
	static #labelScaleByDistance = new Cesium.NearFarScalar(100, 1.5, 20000, 0.4);	
	static #labelPixelOffset = new Cesium.Cartesian2(0, -15);
	static #labelBackgroundPadding = new Cesium.Cartesian2(3, 3);

	static setPoiLabelProperties(poiId, labelText, removeScaleByDistance, visibilityDistance = null) {
		const poiEntity = POIManager.#getPOIEntity(poiId);
		poiEntity.label.text = labelText;

		if (removeScaleByDistance) {
			poiEntity.label.scaleByDistance = null;
		}
		else {
			poiEntity.label.scaleByDistance = POIManager.#labelScaleByDistance;
		}

		if (visibilityDistance === null) {
			poiEntity.label.distanceDisplayCondition = null;
		}
		else {
			poiEntity.label.distanceDisplayCondition = new Cesium.DistanceDisplayCondition(visibilityDistance.min, visibilityDistance.max);
		}
	}

	/* Rendering options
	renderingOptions = {
		cumbresVisible: (boolean),
		poblacionesVisible: (boolean),
		masasDeAguaVisible: (boolean),
		minVisibilityDistance: (number),
		maxVisibilityDistance: (number),
	}
	*/

	static addPOIsToViewer(poisList, renderingOptions) {
		POIManager.#poiDataSource.entities.suspendEvents();
		const distanceDisplayCondition = new Cesium.DistanceDisplayCondition(renderingOptions.minVisibilityDistance, renderingOptions.maxVisibilityDistance);

		const poiTypeConfig = {
			[POIManager.poiType.CUMBRE]: {
				color: POIManager.#poiLabelColor.CUMBRE,
				visible: renderingOptions.cumbresVisible
			},
			[POIManager.poiType.POBLACION]: {
				color: POIManager.#poiLabelColor.POBLACION,
				visible: renderingOptions.poblacionesVisible
			},
			[POIManager.poiType.MASA_DE_AGUA]: {
				color: POIManager.#poiLabelColor.MASA_DE_AGUA,
				visible: renderingOptions.masasDeAguaVisible
			}
		};

		for (const poi of poisList) {
			const poiType = POIManager.getPOIType(poi.id)
			const labelColor = poiTypeConfig[poiType].color;
			const poiVisible = poiTypeConfig[poiType].visible;
			POIManager.addPOIToViewer(poi.id, poi.name, poi.lat, poi.lon, distanceDisplayCondition, labelColor, poiVisible);
		}

		POIManager.#poiDataSource.entities.resumeEvents();
	}

	static addPOIToViewer(poiId, poiName, poiLat, poiLon, distanceDisplayCondition, labelColor, visible) {
		try {
			const entity = POIManager.#poiDataSource.entities.add({
				id: poiId,
				name: poiName,
				description: POIManager.#getPOIDescription(poiLat, poiLon),
				position: Cesium.Cartesian3.fromDegrees(poiLon, poiLat, 0.0),
				show: visible,

				label: {
					disableDepthTestDistance: 0,
					distanceDisplayCondition: distanceDisplayCondition,
					scaleByDistance: POIManager.#labelScaleByDistance,
					pixelOffset: POIManager.#labelPixelOffset,
					verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
					heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
					text: poiName,
					font: '14px "Roboto", sans-serif',
					fillColor: Cesium.Color.BLACK,
					showBackground: true,
					backgroundColor: labelColor,
					backgroundPadding: POIManager.#labelBackgroundPadding,
					scale: POIManager.#labelScale,
				},

			});
		}
		catch (err) {
			console.warn(`Error adding POI ${poiId}: ${err}`);
		}
	}

	static removePOIsFromViewer(poisList) {
		POIManager.#poiDataSource.entities.suspendEvents();
		poisList.forEach(poi => POIManager.#poiDataSource.entities.removeById(poi.id));
		POIManager.#poiDataSource.entities.resumeEvents();
	}

	static setPOIsVisibility(poiType, visible) {
		POIManager.#poiDataSource.entities.suspendEvents();

		for (const poi of POIManager.#poiDataSource.entities.values) {
			if (poi.id.startsWith(poiType)) {
				poi.show = visible;
			}
		}

		POIManager.#poiDataSource.entities.resumeEvents();
	}

	static setPOIsVisibilityRange(visibilityRangeMin, visibilityRangeMax) {
		const distanceDisplayCondition = new Cesium.DistanceDisplayCondition(visibilityRangeMin, visibilityRangeMax);
		POIManager.#poiDataSource.entities.values.forEach(entity => entity.label.distanceDisplayCondition = distanceDisplayCondition);
	}

	static #getPOIDescription(lat, lon) {
		let html = `<a href="geo:${lat.toFixed(6)},${lon.toFixed(6)}"><strong>Latitud</strong>: ${lat.toFixed(6)}</a><br><br>`;
		html += `<a href="geo:${lat.toFixed(6)},${lon.toFixed(6)}"><strong>Longitud</strong>: ${lon.toFixed(6)}</a>`;
		return html;
	}
}