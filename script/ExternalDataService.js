export class ExternalDataService{
	static async addGpxDataSource(viewer, dataSourceInfo, markerFilePath){
		const dataSource = await viewer.dataSources.add(Cesium.GpxDataSource.load(dataSourceInfo.data, {clampToGround: true}));

		for (const entity of dataSource.entities.values){
			entity.availability = undefined;

			if (Cesium.defined(entity.billboard)){
				ExternalDataService.#setBillboardProperties(entity.billboard, markerFilePath);
			}

			if (Cesium.defined(entity.label)){
				ExternalDataService.#setLabelProperties(entity.label);
			}

			if (Cesium.defined(entity.polyline)){
				entity.polyline.width = 3;
				entity.polyline.material = Cesium.Color.BLUE;
			}
		}

		const dataSourceName = dataSource.name ? dataSource.name : dataSourceInfo.fileName
		const dataSourceReturnInfo = {name: dataSourceName, entitiesCollectionId: dataSource.entities.id };
		return dataSourceReturnInfo;
	}

	static async addKmlDataSource(viewer, dataSourceInfo, markerFilePath){
		const dataSource = await viewer.dataSources.add(Cesium.KmlDataSource.load(dataSourceInfo.data, {clampToGround: true}));

		for (const entity of dataSource.entities.values){
			entity.availability = undefined;

			if (Cesium.defined(entity.billboard)){
				ExternalDataService.#setBillboardProperties(entity.billboard, markerFilePath);
			}

			if (Cesium.defined(entity.label)){
				ExternalDataService.#setLabelProperties(entity.label);
			}

			if (Cesium.defined(entity.polyline)){
				entity.polyline.width = 3;
			}
		}

		const dataSourceName = dataSource.name ? dataSource.name : dataSourceInfo.fileName
		const dataSourceReturnInfo = {name: dataSourceName, entitiesCollectionId: dataSource.entities.id };
		return dataSourceReturnInfo;
	}

	static async addGeoJsonDataSource(viewer, dataSourceInfo, markerFilePath){
		const dataSource = await viewer.dataSources.add(Cesium.GeoJsonDataSource.load(dataSourceInfo.data, {
			clampToGround: true,
			stroke: Cesium.Color.BLUE,
			strokeWidth: 3,
			fill: Cesium.Color.BLUE.withAlpha(0.25),
		}));

		for (const entity of dataSource.entities.values){
			entity.availability = undefined;

			if (Cesium.defined(entity.billboard)){
				ExternalDataService.#setBillboardProperties(entity.billboard, markerFilePath);
			}

			if (Cesium.defined(entity.label)){
				ExternalDataService.#setLabelProperties(entity.label);
			}
		}

		const dataSourceName = dataSource.name ? dataSource.name : dataSourceInfo.fileName
		const dataSourceReturnInfo = {name: dataSourceName, entitiesCollectionId: dataSource.entities.id };
		return dataSourceReturnInfo;
	}

	static #setBillboardProperties(billboard, markerFilePath){
		billboard.disableDepthTestDistance = 0;
		billboard.scaleByDistance = new Cesium.NearFarScalar(100, 1.5, 20000, 0.4);
		billboard.pixelOffset = new Cesium.Cartesian2(0, -5);
		billboard.verticalOrigin =  Cesium.VerticalOrigin.BOTTOM;
		billboard.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
		billboard.image = markerFilePath;
	}

	static #setLabelProperties(label){
		label.disableDepthTestDistance = 0;
		label.scaleByDistance = new Cesium.NearFarScalar(100, 1.5, 20000, 0.4);
		label.pixelOffset = new Cesium.Cartesian2(18, -15);
		label.verticalOrigin = Cesium.VerticalOrigin.BOTTOM;
		label.heightReference = Cesium.HeightReference.CLAMP_TO_GROUND;
		label.font = '14px "Roboto", sans-serif';
		label.fillColor = Cesium.Color.BLACK;
		label.showBackground = true;
		label.backgroundColor = Cesium.Color.fromBytes(248, 248, 248, 190);
		label.backgroundPadding = new Cesium.Cartesian2(3, 3);

		// Increase label size to improve readability on high DPI displays
		if (window.devicePixelRatio > 2){
			label.scale = 1.2;
		}
	}

	static updateDataSourceVisibility(viewer, entitiesId, visible){
		const dataSource = ExternalDataService.getDataSource(viewer, entitiesId);
		dataSource.entities.show = visible;
	}

	static removeDataSource(viewer, entitiesId){
		const dataSource = ExternalDataService.getDataSource(viewer, entitiesId);
		dataSource.entities.removeAll();
		viewer.dataSources.remove(dataSource, true);
	}

	static getDataSource(viewer, entitiesCollectionId){
		for (let i = 0; i < viewer.dataSources.length; i++){
			const dataSource = viewer.dataSources.get(i);
			const entityCollection = dataSource.entities;

			if (entityCollection.id === entitiesCollectionId){
				return dataSource;
			}
		}
	}

	static getEntitiesTree(viewer, entitiesCollectionId){
		const dataSource = ExternalDataService.getDataSource(entitiesCollectionId);
		const entities = [];

		for (const entity of dataSource.entities.values){
			if (entity.id.length <= 36){
				entities.push({'key': entity.id, 'title': entity.name ? entity.name : '<i>Sin nombre</i>', 'selected': entity.show, 'parent': entity.parent?.id});
			}
		}

		for (const entity of entities){
			entity.children = entities.filter(e => e.parent === entity.key);

			if (entity.children.length > 0){
				entity.title = '<strong><i>' + entity.title + '</i></strong>';
				entity.folder = true;
				entity.expanded = !entity.parent;
			}
		}

		return entities.filter(entity => entity.parent === undefined);
	}
}