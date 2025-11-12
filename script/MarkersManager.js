export class MarkersManager{
	static createMarker(viewer, lat, lon, name, description, markerFilePath){
		const entity = viewer.entities.add({
			position: Cesium.Cartesian3.fromDegrees(lon, lat),
			name: name,
			description: description,
			show: true,
		});

		MarkersManager.#setBillboardProperties(viewer, entity.id, markerFilePath);
		return entity.id;
	}

	static updateMarker(viewer, entityId, lat, lon, name, description ){
		const entity = viewer.entities.getById(entityId);
		entity.position = Cesium.Cartesian3.fromDegrees(lon, lat);
		entity.name = name;
		entity.description = description;
	}

	static removeMarker(viewer, entityId){
		viewer.entities.removeById(entityId);
	}

	static addCircleToMarker(viewer, entityId, radius, material, fill){
		const entity = viewer.entities.getById(entityId);
		entity.ellipse = new Cesium.EllipseGraphics({
			semiMajorAxis: radius,
			semiMinorAxis: radius,
			material: material,
			fill: fill
		});
	}

	static updateMarkerCircle(viewer, entityId, radius, material, fill){
		const entity = viewer.entities.getById(entityId);
		entity.ellipse.semiMajorAxis = radius;
		entity.ellipse.semiMinorAxis = radius;
		entity.ellipse.material = material;
		entity.ellipse.fill = fill;
	}

	static #setBillboardProperties(viewer, entityId, markerFilePath){
		const entity = viewer.entities.getById(entityId);
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