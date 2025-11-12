export class GeolocationService{
	static #intervalId = null;

	static trackPosition(successFunction, errorFunction, options, interval = 5000){		
		navigator.geolocation.getCurrentPosition(successFunction, errorFunction, options);
		GeolocationService.#intervalId = setInterval(() => {
			navigator.geolocation.getCurrentPosition(successFunction, errorFunction, options);
		}, interval);
	}

	static stopTrackingPosition() {
		if (GeolocationService.#intervalId !== null){
			clearInterval(GeolocationService.#intervalId);
			GeolocationService.#intervalId = null;
		}
	}
}