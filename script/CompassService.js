export class CompassService {
	static #previousHeading = 0;

	static getHeading(heading) {
		const prevHeading = CompassService.#previousHeading;
		const delta = heading - prevHeading;
		const shortestDelta = ((((delta % 360) + 540) % 360) - 180);
		const newHeading = prevHeading + shortestDelta;
		CompassService.#previousHeading = newHeading;
		return newHeading;
	}
}