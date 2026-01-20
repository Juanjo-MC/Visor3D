export class DeviceHeadingTracker {
	static #onHeadingChange = null;		// Callback that receives the updated heading
	static #orientationSensor = null;	// Active AbsoluteOrientationSensor instance
	static #frequency = 60;				// Sampling frequency for the AbsoluteOrientationSensor (Hz)
	static #filterAlpha = 0.96;			// Alpha coefficient for the low-pass filter
	static #previousHeading = null;

	static async start(onHeadingChange, cameraHeading) {
		try {
			if (location.protocol !== 'https:') {
				throw new Error('This functionality requires HTTPS');
			}

			DeviceHeadingTracker.#onHeadingChange = onHeadingChange;
			await DeviceHeadingTracker.#requestPermissions();
			// Set #previousHeading to the camera’s current heading to start the rotation from the correct angle
			DeviceHeadingTracker.#previousHeading = cameraHeading;

			if ('AbsoluteOrientationSensor' in window) {
				DeviceHeadingTracker.#startAbsoluteOrientationSensor();
			}
			else if ('DeviceOrientationEvent' in window) {
				DeviceHeadingTracker.#startDeviceOrientationFallback();
			}
			else {
				throw new Error('Orientation sensor not supported on this device');
			}
		}
		catch (err) {
			DeviceHeadingTracker.#previousHeading = null;
			throw err;
		}
	}

	static stop() {
		if (DeviceHeadingTracker.#orientationSensor) {
			DeviceHeadingTracker.#orientationSensor.stop();
			DeviceHeadingTracker.#orientationSensor = null;
		}

		window.removeEventListener('deviceorientation', DeviceHeadingTracker.#handleOrientationEvent, true);
		DeviceHeadingTracker.#onHeadingChange = null;
		DeviceHeadingTracker.#previousHeading = null;
	}

	static async #requestPermissions() {
		if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
			const orientationPermission = await DeviceOrientationEvent.requestPermission();

			if (orientationPermission !== 'granted') {
				throw new Error('Orientation sensor permission denied');
			}
		}
	}

/* 	static #startAbsoluteOrientationSensor() {
		DeviceHeadingTracker.#orientationSensor = new AbsoluteOrientationSensor({frequency: DeviceHeadingTracker.#frequency});

		DeviceHeadingTracker.#orientationSensor.addEventListener('reading', () => {
			const q = DeviceHeadingTracker.#orientationSensor.quaternion;

			if (!q) {
				return;
			}

			const quaternion = {x: q[0], y: q[1], z: q[2], w: q[3]};
			let heading = Cesium.Math.toDegrees(Cesium.HeadingPitchRoll.fromQuaternion(quaternion).heading);
			heading = (heading + DeviceHeadingTracker.#getDeviceOrientationCorrection() + 360) % 360;
			const filteredHeading = DeviceHeadingTracker.#applyFilter(heading);
			DeviceHeadingTracker.#onHeadingChange(filteredHeading);
		});

		DeviceHeadingTracker.#orientationSensor.start();
	} */

	static #startAbsoluteOrientationSensor() {
		DeviceHeadingTracker.#orientationSensor = new AbsoluteOrientationSensor({frequency: DeviceHeadingTracker.#frequency});

		DeviceHeadingTracker.#orientationSensor.addEventListener('reading', () => {
			const q = DeviceHeadingTracker.#orientationSensor.quaternion;

			if (!q) {
				return;
			}

			// 1. Convert sensor quaternion to Cesium Quaternion
			const cesiumQ = new Cesium.Quaternion(q[0], q[1], q[2], q[3]);

			// 2. Create a rotation matrix from the quaternion
			const matrix = Cesium.Matrix3.fromQuaternion(cesiumQ);

			// 3. Get the 'direction' vector (the Y-axis of the phone, pointing out the top)
			// In the AbsoluteOrientationSensor frame, -Z is usually forward.
			// For mobile "Compass" style, we often want the Y-axis (top of phone).
			const direction = new Cesium.Cartesian3();
			Cesium.Matrix3.getColumn(matrix, 1, direction); // Column 1 is the Y-axis

			// 4. Calculate heading based on the direction vector's projection
			// on the horizontal plane. This avoids the 180-flip at the zenith.
			let heading = Math.atan2(direction.x, direction.y);
			heading = Cesium.Math.toDegrees(heading);

			// 5. Apply correction and filter
			heading = (heading + DeviceHeadingTracker.#getDeviceOrientationCorrection() + 360) % 360;
			const filteredHeading = DeviceHeadingTracker.#applyFilter(heading);
			DeviceHeadingTracker.#onHeadingChange(filteredHeading);
		});

		DeviceHeadingTracker.#orientationSensor.start();
	}

	static #startDeviceOrientationFallback() {
		window.addEventListener('deviceorientation', DeviceHeadingTracker.#handleOrientationEvent, true);
	}

	static #handleOrientationEvent(event) {
		let heading;

		if (event.webkitCompassHeading !== undefined) {
			heading = event.webkitCompassHeading;
		}
		else if (event.absolute && event.alpha !== null) {
			heading = 360 - event.alpha;
		}
		else if (event.alpha !== null) {
			heading = 360 - event.alpha;
		}
		else {
			return;
		}

		heading = (heading + DeviceHeadingTracker.#getDeviceOrientationCorrection() + 360) % 360;
		const filteredHeading = DeviceHeadingTracker.#applyFilter(heading);
		DeviceHeadingTracker.#onHeadingChange(filteredHeading);
	}

	static #applyFilter(newHeading) {
		let diff = newHeading - DeviceHeadingTracker.#previousHeading;

		if (diff > 180) {
			newHeading -= 360;
		}
		else if (diff < -180) {
			newHeading += 360;
		}

		DeviceHeadingTracker.#previousHeading = DeviceHeadingTracker.#filterAlpha * DeviceHeadingTracker.#previousHeading + (1 - DeviceHeadingTracker.#filterAlpha) * newHeading;
		DeviceHeadingTracker.#previousHeading = (DeviceHeadingTracker.#previousHeading + 360) % 360;
		return DeviceHeadingTracker.#previousHeading;
	}

	static #getDeviceOrientationCorrection() {
		if (window.screen?.orientation?.angle !== null) {
			switch (window.screen.orientation.angle) {
				case 90:
					return 90;
				case 270:
					return -90;
				case 0:
				case 180:
				default:
					return 0;
			}
		}

		return 0;
	}
}