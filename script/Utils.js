export class Utils{
	static async getJSONData(url){
		const response = await Utils.#getData(url);

		if (response !== null){
			return response.json();
		}

		return null;
	}

	static async getCompressedJSONData(url){
		const response = await Utils.#getData(url);

		if (response !== null){
			const json = await Utils.#decompress(response.body);
			return json;
		}

		return null;
	}

	static async #getData(url){
		try{
			const response = await fetch(url);

			if (!response.ok){
				throw new Error('Response status: ' + response.status);
			}

			return await response;
		}
		catch (err){
			return null;
		}
	}

	static async #decompress(inputStream){
		const ds = new DecompressionStream('gzip');
		inputStream.pipeTo(ds.writable);
		const response = new Response(ds.readable);
		const json = await response.json();
		return json;
	}

	static getQueryStringValue(parameterName){
		return new URL(document.URL).searchParams.get(parameterName)
	}

	static isValidLatitude(lat){
		return isNaN(lat) === false && lat >= -90 && lat <= 90
	}

	static isValidLongitude(lon){
		return isNaN(lon) === false && lon >= -180 && lon <= 180
	}

	static arrayDifference(a, b){
		const aSet = new Set(a);
		const bSet = new Set(b);
		return Array.from(aSet.difference(bSet));
	}
}