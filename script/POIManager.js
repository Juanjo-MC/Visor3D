export class POIManager{

	static poiType = Object.freeze({
		CUMBRE: 'C:',
		POBLACION: 'P:',
		MASA_DE_AGUA: 'A:',
	});

	static getPOIType(poiId){
		if (poiId && poiId.startsWith(POIManager.poiType.CUMBRE)){
			return POIManager.poiType.CUMBRE;
		}
		else if (poiId && poiId.startsWith(POIManager.poiType.POBLACION)){
			return POIManager.poiType.POBLACION;
		}
		else if (poiId && poiId.startsWith(POIManager.poiType.MASA_DE_AGUA)){
			return POIManager.poiType.MASA_DE_AGUA;
		}

		return null;
	}

	static #poiLabelColor = Object.freeze({
		CUMBRE: Cesium.Color.fromBytes(218, 218, 255, 190),
		POBLACION: Cesium.Color.fromBytes(253, 246, 228, 190),
		MASA_DE_AGUA: Cesium.Color.fromBytes(69, 127, 176, 190),
	});

	static #getPOIEntity(viewer, poiId){
		return viewer.entities.getById(poiId);
	}

	static poiIsLoaded(viewer, poiId){
		const poiEntity = POIManager.#getPOIEntity(viewer, poiId);
		return poiEntity ? true : false;
	}

	static poiIsVisible(viewer, poiId) {
		const poiEntity = POIManager.#getPOIEntity(viewer, poiId);
		return poiEntity ? poiEntity.show : false;
	}

	static showPOI(viewer, poiId){
		const poiEntity = POIManager.#getPOIEntity(viewer, poiId);
		poiEntity.show = true;
	}

	static hidePOI(viewer, poiId){
		const poiEntity = POIManager.#getPOIEntity(viewer, poiId);
		poiEntity.show = false;
	}

	static setPoiLabelProperties(viewer, poiId, labelText, removeScaleByDistance, visibilityDistance = null){
		const poiEntity = POIManager.#getPOIEntity(viewer, poiId);
		poiEntity.label.text = labelText;

		if (removeScaleByDistance){
			poiEntity.label.scaleByDistance = null;
		}
		else{
			poiEntity.label.scaleByDistance = new Cesium.NearFarScalar(100, 1.5, 20000, 0.4)
		}

		if (visibilityDistance === null){
			poiEntity.label.distanceDisplayCondition = null;
		}
		else{
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

	static addPOIsToViewer(viewer, poisList, renderingOptions){
		viewer.entities.suspendEvents();

		for (const poi of poisList){
			const poiType = POIManager.getPOIType(poi.id)
			let labelColor;
			let poiVisible;

			if (poiType === POIManager.poiType.CUMBRE){
				labelColor = POIManager.#poiLabelColor.CUMBRE;
				poiVisible = renderingOptions.cumbresVisible;
			}
			else if (poiType === POIManager.poiType.POBLACION){
				labelColor = POIManager.#poiLabelColor.POBLACION;
				poiVisible = renderingOptions.poblacionesVisible;
			}
			else if (poiType === POIManager.poiType.MASA_DE_AGUA){
				labelColor = POIManager.#poiLabelColor.MASA_DE_AGUA;
				poiVisible = renderingOptions.masasDeAguaVisible;
			}

			POIManager.addPOIToViewer(viewer, poi.id, poi.name, poi.lat, poi.lon, renderingOptions.minVisibilityDistance, renderingOptions.maxVisibilityDistance, labelColor, poiVisible);
		}

		viewer.entities.resumeEvents();
	}

	static addPOIToViewer(viewer, poiId, poiName, poiLat, poiLon, minVisibilityDistance, maxVisibilityDistance, labelColor, visible){
		try{
			const entity = viewer.entities.add({
				id: poiId,
				name: poiName,
				description: POIManager.#getPOIDescription(poiLat, poiLon),
				position: Cesium.Cartesian3.fromDegrees(poiLon, poiLat),
				show: visible,

				label: {
					disableDepthTestDistance: 0,
					distanceDisplayCondition: new Cesium.DistanceDisplayCondition(minVisibilityDistance, maxVisibilityDistance),
					scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 20000, 0.4),
					pixelOffset: new Cesium.Cartesian2(0, -15),
					verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
					heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
					text: poiName,
					font: '14px "Roboto", sans-serif',
					fillColor: Cesium.Color.BLACK,
					showBackground: true,
					backgroundColor: labelColor,
					backgroundPadding: new Cesium.Cartesian2(3, 3),
				},
			});

			// Increase label size to improve readability on high DPI displays
			if (window.devicePixelRatio > 2){
				entity.label.scale = 1.2;
			}
		}
		catch (err){}
	}

	static removePOIsFromViewer(viewer, poisList){
		viewer.entities.suspendEvents();
		poisList.forEach(poi => viewer.entities.removeById(poi.id));
		viewer.entities.resumeEvents();
	}

	static setPOIsVisibility(viewer, poiType, visible){
		for (const poi of viewer.entities.values){
			if (poi.id.startsWith(poiType)){
				poi.show = visible;
			}
		}
	}

	static setPOIsVisibilityRange(viewer, visibilityRangeMin, visibilityRangeMax){
		const distanceDisplayCondition = new Cesium.DistanceDisplayCondition(visibilityRangeMin, visibilityRangeMax);
		viewer.entities.values.forEach((entity) => {entity.label.distanceDisplayCondition = distanceDisplayCondition;});
	}

	static #getPOIDescription(lat, lon){
		let html = '<a href="geo:' + lat.toFixed(6) + ',' + lon.toFixed(6) + '">' + '<strong>Latitud</strong>: ' + lat.toFixed(6) + '</a><br><br>';
		html += '<a href="geo:' + lat.toFixed(6) + ',' + lon.toFixed(6) + '">' + '<strong>Longitud</strong>: ' + lon.toFixed(6) + '</a>';
		return html;
	}
}