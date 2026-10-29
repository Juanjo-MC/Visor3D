import { Utils } from './Utils.js';

export class TilesetManager {
	static #viewer;
	static #tilesets = [];
	static #nextTilesetId = 0;

	static initialize(viewer) {
		TilesetManager.#viewer = viewer;
	}

	static async addTileset(url, { persistant = false, childrenAsSeparateTilesets = false } = {}) {
		if (persistant) {
			return [await TilesetManager.#addPersistantTileset(url)];
		}

		return TilesetManager.#addNonPersistantTileset(url, childrenAsSeparateTilesets);
	}

	static async #addNonPersistantTileset(url, childrenAsSeparateTilesets) {
		const tilesetIds = [];

		try {
			const json = await Utils.getJSONData(url);

			if (childrenAsSeparateTilesets) {
				const children = json.root.children ?? [];

				if (children.length === 0) {
					throw new Error(`Tileset ${url} has no root children to add separately.`);
				}

				for (const child of children) {
					try {
						const contentUrl = child.content?.uri ?? child.content?.url;

						if (!contentUrl) {
							throw new Error(`Child tileset in ${url} has no content URI.`);
						}

						tilesetIds.push(TilesetManager.#registerNonPersistantTileset(new URL(contentUrl, url).href, child.boundingVolume));
					}
					catch (err) {
						console.error(`Failed to add child tileset from ${url}`, err);
					}
				}
			}
			else {
				tilesetIds.push(TilesetManager.#registerNonPersistantTileset(url, json.root.boundingVolume));
			}
		}
		catch (err) {
			console.error(`Failed to add 3D tileset ${url}`, err);
		}

		return tilesetIds;
	}

	static #registerNonPersistantTileset(url, boundingVolume) {
		const id = TilesetManager.#nextTilesetId++;

		TilesetManager.#tilesets.push({
			id: id,
			url: url,
			tileset: null,
			boundingSphere: TilesetManager.#convertBoundingVolumeToBoundingSphere(boundingVolume),
			cameraInsideBoundingSphere: false,
			persistant: false,
			loading: false,
		});

		return id;
	}

	static async #addPersistantTileset(url) {
		const ts = await Cesium.Cesium3DTileset.fromUrl(url, { show: false });
		const id = TilesetManager.#nextTilesetId++;

		TilesetManager.#viewer.scene.primitives.add(ts);

		TilesetManager.#tilesets.push({
			id: id,
			url: url,
			tileset: ts,
			boundingSphere: ts.boundingSphere,
			cameraInsideBoundingSphere: false,
			persistant: true,
			loading: false,
		});

		return id;
	}

	static removeTileset(tilesetId) {
		const index = TilesetManager.#tilesets.findIndex(ts => ts.id === tilesetId);

		if (index !== -1) {
			const ts = TilesetManager.#tilesets[index];

			if (ts.tileset) { // If the tileset is currently loaded, remove it from the scene
				TilesetManager.#viewer.scene.primitives.remove(ts.tileset);
			}

			TilesetManager.#tilesets.splice(index, 1);
		}
	}

	static updateTilesetsVisibility(cameraPosition) {
		const position = Cesium.Cartesian3.fromDegrees(cameraPosition.lon, cameraPosition.lat, cameraPosition.altitude);

		for (const ts of TilesetManager.#tilesets) {
			const distance = Cesium.Cartesian3.distance(position, ts.boundingSphere.center);
			const cameraInsideBoundingSphere = distance <= ts.boundingSphere.radius;

			ts.cameraInsideBoundingSphere = cameraInsideBoundingSphere;

			if (cameraInsideBoundingSphere) {
				if (ts.persistant === false) {
					if (ts.tileset || ts.loading) { continue; }
					ts.loading = true;
					TilesetManager.#loadNonPersistantTileset(ts);
				}
				else {
					ts.tileset.show = true;
				}
			}
			else {
				if (ts.persistant === false) {
					if (ts.tileset) {
						TilesetManager.#viewer.scene.primitives.remove(ts.tileset);
						ts.tileset = null;
					}
				}
				else {
					ts.tileset.show = false;
				}
			}
		}
	}

	static async #loadNonPersistantTileset(tileset) {
		try {
			const ts = await Cesium.Cesium3DTileset.fromUrl(tileset.url);

			// The camera may have moved outside the bounding sphere while the tileset was loading
			if (tileset.cameraInsideBoundingSphere) {
				TilesetManager.#viewer.scene.primitives.add(ts);
				tileset.tileset = ts;
			}
			else {
				ts.destroy();
			}
		}
		catch (err) {
			console.error(`Failed to load 3D tileset: ${tileset.url}`, err);
		}
		finally {
			tileset.loading = false;
		}
	}

	static unloadAllTilesets() {
		for (const ts of TilesetManager.#tilesets) {
			if (ts.tileset) {
				if (ts.persistant === false) {
					TilesetManager.#viewer.scene.primitives.remove(ts.tileset);
					ts.tileset = null;
				}
				else {
					ts.tileset.show = false;
				}
			}
		}
	}

	static #convertBoundingVolumeToBoundingSphere(boundingVolume) {
		if (boundingVolume.region) {
			return TilesetManager.#convertRegionToBoundingSphere(boundingVolume.region);
		}

		if (boundingVolume.box) {
			return TilesetManager.#convertBoxToBoundingSphere(boundingVolume.box);
		}

		if (boundingVolume.sphere) {
			return TilesetManager.#convertSphereToBoundingSphere(boundingVolume.sphere);
		}

		throw new Error('Unsupported 3D Tiles bounding volume.');
	}

	static #convertRegionToBoundingSphere(region) {
		const [west, south, east, north, minHeight, maxHeight] = region;
		const rectangle = Cesium.Rectangle.fromRadians(west, south, east, north);
		const minimumSphere = Cesium.BoundingSphere.fromRectangle3D(rectangle, Cesium.Ellipsoid.WGS84, minHeight);
		const maximumSphere = Cesium.BoundingSphere.fromRectangle3D(rectangle, Cesium.Ellipsoid.WGS84, maxHeight);

		return Cesium.BoundingSphere.union(minimumSphere, maximumSphere);
	}

	static #convertBoxToBoundingSphere(box) {
		const center = Cesium.Cartesian3.fromArray(box, 0);
		const halfAxes = Cesium.Matrix3.fromArray(box, 3);
		const orientedBox = new Cesium.OrientedBoundingBox(center, halfAxes);

		return Cesium.BoundingSphere.fromOrientedBoundingBox(orientedBox);
	}

	static #convertSphereToBoundingSphere(sphere) {
		const center = Cesium.Cartesian3.fromArray(sphere, 0);
		return new Cesium.BoundingSphere(center, sphere[3]);
	}
}