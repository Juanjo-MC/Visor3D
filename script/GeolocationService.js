export class GeolocationService {
	static #trackingActive = false;
	static #timeoutId = null;

	static trackPosition(successFunction, errorFunction, options, interval = 5000) {
		GeolocationService.stopTrackingPosition();
		GeolocationService.#trackingActive = true;

		const runPoll = () => {
			navigator.geolocation.getCurrentPosition(
				(position) => {
					if (!GeolocationService.#trackingActive) {
						return;
					}

					successFunction(position);

					if (GeolocationService.#trackingActive) {
						GeolocationService.#timeoutId = setTimeout(runPoll, interval);
					}
				},
				(error) => errorFunction(error),
				options
			);
		};

		runPoll();
	}

	static stopTrackingPosition() {
		GeolocationService.#trackingActive = false;

		if (GeolocationService.#timeoutId !== null) {
			clearTimeout(GeolocationService.#timeoutId);
			GeolocationService.#timeoutId = null;
		}
	}
}