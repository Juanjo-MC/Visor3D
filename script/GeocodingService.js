export class GeocodingService{

	// CartoCiudad documentation
	// https://www.idee.es/resources/documentos/Cartociudad/CartoCiudad_ServiciosWeb.pdf

	static #BASE_URL = 'https://www.cartociudad.es/geocoder/api/geocoder/';

	static async getCandidates(searchTerm){
		const url = GeocodingService.#BASE_URL + 'candidates?q=' + encodeURIComponent(searchTerm.trim());
		return await GeocodingService.#getJSONData(url);
	}

	static async find(id, type){
		const url = GeocodingService.#BASE_URL + 'find?id=' + id + '&type=' + type;
		const result = await GeocodingService.#getJSONData(url);
		result.fullAddress = GeocodingService.#getFullAddress(result);
		return result;
	}

	static #getFullAddress(geocoderResult){
		const numeroPortal = geocoderResult.portalNumber !== null ? geocoderResult.portalNumber : '';
		const extension = geocoderResult.extension !== null ? geocoderResult.extension : '';
		return (geocoderResult.address + ' ' + numeroPortal + ' ' + extension).trim();
	}

	static getHtml(geocoderResult, altitude){
		let html = '<a href="geo:' + geocoderResult.lat.toFixed(6) + ',' + geocoderResult.lng.toFixed(6) + '">' + '<strong>Latitud</strong>: ' + geocoderResult.lat.toFixed(6) + '</a><br><br>';
		html += '<a href="geo:' + geocoderResult.lat.toFixed(6) + ',' + geocoderResult.lng.toFixed(6) + '">' + '<strong>Longitud</strong>: ' + geocoderResult.lng.toFixed(6) + '</a>';

		if (altitude){
			html += '<br><br><strong>Altitud MDT05 (m)</strong>: ' + altitude.toFixed(0);
		}

		if (geocoderResult.tip_via !== null){
			html += '<br><br><strong>Tipo de vía</strong>: ' + geocoderResult.tip_via;
		}

		if (geocoderResult.poblacion !== null){
			html += '<br><br><strong>Población</strong>: ' + geocoderResult.poblacion;
		}

		if (geocoderResult.muni !== null){
			html += '<br><br><strong>Municipio</strong>: ' + geocoderResult.muni;
		}

		if (geocoderResult.province !== null){
			html += '<br><br><strong>Provincia</strong>: ' + geocoderResult.province;
		}

		if (geocoderResult.comunidadAutonoma !== null){
			html += '<br><br><strong>Comunidad Autónoma</strong>: ' + geocoderResult.comunidadAutonoma;
		}

		if (geocoderResult.refCatastral !== null){
			html += '<br><br><strong>Referencia catastral</strong>: ' + geocoderResult.refCatastral;
		}

		return html;
	}

	static async #getJSONData(url){
		try{
			const response = await fetch(url);

			if (!response.ok){
				throw new Error('Response status: ' + response.status);
			}

			const json = await response.json();
			return json;
		}
		catch (err){
			throw err;
		}
	}
}