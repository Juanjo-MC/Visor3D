export class Utils {
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

	static getQueryStringValue(parameterName) {
		return new URL(document.URL).searchParams.get(parameterName)
	}

	static isValidLatitude(lat) {
		return isNaN(lat) === false && lat >= -90 && lat <= 90
	}

	static isValidLongitude(lon) {
		return isNaN(lon) === false && lon >= -180 && lon <= 180
	}

	static arrayDifference(a, b) {
		const aSet = new Set(a);
		const bSet = new Set(b);
		return Array.from(aSet.difference(bSet));
	}

	static degreesToCardinalDirection(degrees) {
		const normalizedDegrees = ((degrees % 360) + 360) % 360;
		const directions = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
		const index = Math.floor(((normalizedDegrees + 22.5) % 360) / 45);
		return directions[index];
	}
}