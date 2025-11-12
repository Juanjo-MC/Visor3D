import KDBush from 'https://cdn.jsdelivr.net/npm/kdbush/+esm';
import * as GeoKDBush from 'https://cdn.jsdelivr.net/npm/geokdbush@latest/+esm';

export class POIFinder{
	static #poisList = [];
	static #poisIndex = [];

	static initialize(poisList){
		POIFinder.#poisList = poisList;
		POIFinder.#poisIndex = POIFinder.#buildPOIsIndex(POIFinder.#poisList);
	}

	static #buildPOIsIndex(poisList){
		const idx = new KDBush(poisList.length, 10);
		poisList.forEach(poi => idx.add(poi.lon, poi.lat));
		return idx.finish();
	}

	static findNearestPOI(lat, lon, searchRadius){
		return GeoKDBush.around(POIFinder.#poisIndex, lon, lat, 1, searchRadius).map(i => POIFinder.#poisList[i])[0];
	}

	static findPOIsAround(lat, lon, searchRadius, maxResults = Infinity){
		return GeoKDBush.around(POIFinder.#poisIndex, lon, lat, maxResults, searchRadius).map(i => POIFinder.#poisList[i]);
	}
}