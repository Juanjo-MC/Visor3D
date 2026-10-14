import { Utils } from './Utils.js';

export class TilesetManager {
	static #viewer;
	static #parentUrl = 'https://servicios3d.idee.es/pnoa-ma/json/tileset.json';
	static #children = [];
	static #ready;

	static async initialize(viewer) {
		try {
			const json = await Utils.getJSONData(TilesetManager.#parentUrl);

			TilesetManager.#children = (json.root.children ?? []).map(child => {
				const box = child.boundingVolume.box;
				const center = new Cesium.Cartesian3(box[0], box[1], box[2]);
				const halfAxes = Cesium.Matrix3.fromArray(box, 3);
				const orientedBox = new Cesium.OrientedBoundingBox(center, halfAxes);
				const sphere = Cesium.BoundingSphere.fromOrientedBoundingBox(orientedBox);

				return {
					url: new URL(child.content.uri, TilesetManager.#parentUrl).href,
					sphere,
					tileset: null,
					loading: false,
					inside: false
				};
			});

			TilesetManager.#viewer = viewer;
			TilesetManager.#ready = true;
		}
		catch (err) {
			TilesetManager.#viewer = viewer;
			TilesetManager.#ready = false;
			console.error(`Failed to initialize tileset manager: ${err.message}`, err);
		}
	}

	static updateTilesets(cameraPosition) {
		if (!TilesetManager.#ready) {
			return;
		}

		const position = Cesium.Cartesian3.fromDegrees(cameraPosition.lon, cameraPosition.lat, cameraPosition.altitude);

		for (const child of TilesetManager.#children) {
			const distance = Cesium.Cartesian3.distance(position, child.sphere.center);
			const insideBoundingSphere = distance <= child.sphere.radius;

			if (insideBoundingSphere) {
				child.inside = true;

				if (child.tileset || child.loading) {
					continue;
				}

				child.loading = true;
				TilesetManager.#loadTileset(child);
			}
			else {
				child.inside = false;

				if (child.tileset) {
					TilesetManager.#viewer.scene.primitives.remove(child.tileset);
					child.tileset = null;
				}
			}
		}
	}

	static async #loadTileset(child) {
		try {
			const tileset = await Cesium.Cesium3DTileset.fromUrl(child.url);

			if (child.inside) {
				TilesetManager.#viewer.scene.primitives.add(tileset);
				child.tileset = tileset;
			}
			else {
				tileset.destroy();
			}
		}
		catch (err) {
			console.error(`Failed to load 3D tileset: ${child.url}`, err);
		}
		finally {
			child.loading = false;
		}
	}
}