export class CompassService{
	static #previousHeading = 0;

	static getHeading(heading){
		// Adapted from https://stackoverflow.com/questions/19618745/css3-rotate-transition-doesnt-take-shortest-way

		let prevHeading = CompassService.#previousHeading;
		let prevMod = ((prevHeading % 360) + 360) % 360; // Normalize to [0, 360)

		// Detect wrap around and adjust for shortest rotation direction
		if (prevMod < 180 && heading > prevMod + 180){
			prevHeading -= 360;
		}
		else if (prevMod >= 180 && heading < prevMod - 180){
			prevHeading += 360;
		}

		const newHeading = prevHeading + heading - prevMod;
		CompassService.#previousHeading = newHeading;
		return newHeading;
	}
}