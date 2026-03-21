export class GeolocationService {
	static #trackingActive = false;
	static #timeoutId = null;

	static trackPosition(successFunction, errorFunction, options, interval = 5000) {
		GeolocationService.stopTrackingPosition();
		GeolocationService.#trackingActive = true;

		const requestPosition = () => {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					if (!GeolocationService.#trackingActive) {
						return;
					}

					successFunction(position);

					if (GeolocationService.#trackingActive) {
						GeolocationService.#timeoutId = setTimeout(requestPosition, interval);
					}
				},
				(error) => {
					if (!GeolocationService.#trackingActive) {
						return;
					}

					errorFunction(error);

					if (GeolocationService.#trackingActive) {
						GeolocationService.#timeoutId = setTimeout(requestPosition, interval);
					}
				},
				options
			);
		};

		requestPosition();
	}

	static stopTrackingPosition() {
		GeolocationService.#trackingActive = false;

		if (GeolocationService.#timeoutId !== null) {
			clearTimeout(GeolocationService.#timeoutId);
			GeolocationService.#timeoutId = null;
		}
	}
}