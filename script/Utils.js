import * as GeoKDBush from 'https://cdn.jsdelivr.net/npm/geokdbush@latest/+esm';

export class Utils {
	static escapeHtml(value) {
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	static async getJSONData(url) {
		const response = await Utils.#getData(url);
		return response.json();
	}

	static async getCompressedJSONData(url) {
		const response = await Utils.#getData(url);
		const json = await Utils.#decompress(response.body);
		return json;
	}

	static async #getData(url) {
		try {
			const response = await fetch(url);

			if (!response.ok) {
				throw new Error(`Response status: ${response.status}`);
			}

			return await response;
		}
		catch (err) {
			throw err;
		}
	}

	static async #decompress(inputStream) {
		const ds = new DecompressionStream('gzip');
		inputStream.pipeTo(ds.writable);
		const response = new Response(ds.readable);
		const json = await response.json();
		return json;
	}

	static isValidLatitude(lat) {
		return isNaN(lat) === false && lat >= -90 && lat <= 90
	}

	static isValidLongitude(lon) {
		return isNaN(lon) === false && lon >= -180 && lon <= 180
	}

	static distanceBetweenPoints(lat1, lon1, height1, lat2, lon2, height2) {
		const greatCircleDistance = GeoKDBush.distance(lon1, lat1, lon2, lat2) * 1000; // Convert to meters
		const heightDifference = (height2 - height1);
		return Math.hypot(greatCircleDistance, heightDifference);
	}

	static arrayDifference(a, b) {
		const bSet = new Set(b);
		return a.filter(item => !bSet.has(item));
	}

	static #directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

	static degreesToCardinalDirection(degrees) {
		const normalizedDegrees = ((degrees % 360) + 360) % 360;
		return Utils.#directions[Math.round(normalizedDegrees / 45) % 8]; // 45 -> 360° divided by 8 directions
	}
}