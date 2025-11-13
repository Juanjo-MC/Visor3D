export class MarkersManager{
	static #markersDataSource = null;

	static async initialize(viewer){
		MarkersManager.#markersDataSource = await viewer.dataSources.add(new Cesium.CustomDataSource('markersDataSource'));
	}

	static createMarker(lat, lon, name, description, markerFilePath){
		const entity = MarkersManager.#markersDataSource.entities.add({
			position: Cesium.Cartesian3.fromDegrees(lon, lat),
			name: name,
			description: description,
			show: true,
		});

		MarkersManager.#setBillboardProperties(entity, markerFilePath);
		return entity.id;
	}

	static updateMarker(entityId, lat, lon, name, description){
		const entity = MarkersManager.#markersDataSource.entities.getById(entityId);
		entity.position = Cesium.Cartesian3.fromDegrees(lon, lat);
		entity.name = name;
		entity.description = description;
	}

	static removeMarker(entityId){
		MarkersManager.#markersDataSource.entities.removeById(entityId);
	}

	static addCircleToMarker(entityId, radius, material, fill){
		const entity = MarkersManager.#markersDataSource.entities.getById(entityId);
		entity.ellipse = new Cesium.EllipseGraphics({
			semiMajorAxis: radius,
			semiMinorAxis: radius,
			material: material,
			fill: fill
		});
	}

	static updateMarkerCircle(entityId, radius, material, fill){
		const entity = MarkersManager.#markersDataSource.entities.getById(entityId);
		entity.ellipse.semiMajorAxis = radius;
		entity.ellipse.semiMinorAxis = radius;
		entity.ellipse.material = material;
		entity.ellipse.fill = fill;
	}

	static #setBillboardProperties(entity, markerFilePath){
		entity.billboard = new Cesium.BillboardGraphics({
			disableDepthTestDistance: 0,
			scaleByDistance: new Cesium.NearFarScalar(100, 1.5, 20000, 0.4),
			pixelOffset: new Cesium.Cartesian2(0, -5),
			verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
			heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
			image: markerFilePath,
		});
	}
}