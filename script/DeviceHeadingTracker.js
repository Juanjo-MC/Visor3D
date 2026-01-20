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

			// Cesium quaternion
			const quat = new Cesium.Quaternion(q[0], q[1], q[2], q[3]);
			const rotationMatrix = Cesium.Matrix3.fromQuaternion(quat);

			// Device forward (-Z) and up (+Y) vectors in device space
			const deviceForward = new Cesium.Cartesian3(0, 0, -1);
			const deviceUp = new Cesium.Cartesian3(0, 1, 0);

			// Rotate into world space
			const forwardWorld = Cesium.Matrix3.multiplyByVector(
				rotationMatrix,
				deviceForward,
				new Cesium.Cartesian3()
			);

			const upWorld = Cesium.Matrix3.multiplyByVector(
				rotationMatrix,
				deviceUp,
				new Cesium.Cartesian3()
			);

			// Gravity vector (points down)
			const gravity = Cesium.Cartesian3.negate(
				Cesium.Cartesian3.normalize(upWorld, upWorld),
				upWorld
			);

			/*
			* Build horizontal basis:
			* east  = gravity × forward
			* north = east × gravity
			*/
			const east = Cesium.Cartesian3.cross(gravity, forwardWorld, new Cesium.Cartesian3());

			if (Cesium.Cartesian3.magnitudeSquared(east) < 1e-6) {
				return;
			}

			Cesium.Cartesian3.normalize(east, east);
			const north = Cesium.Cartesian3.cross(east, gravity, new Cesium.Cartesian3());
			Cesium.Cartesian3.normalize(north, north);

			// Project forward onto horizontal plane
			const forwardHorizontal = Cesium.Cartesian3.subtract(
				forwardWorld,
				Cesium.Cartesian3.multiplyByScalar(
					gravity,
					Cesium.Cartesian3.dot(forwardWorld, gravity),
					new Cesium.Cartesian3()
				),
				new Cesium.Cartesian3()
			);

			if (Cesium.Cartesian3.magnitudeSquared(forwardHorizontal) < 1e-6) {
				return;
			}

			Cesium.Cartesian3.normalize(forwardHorizontal, forwardHorizontal);

			// Heading from horizontal frame
			let heading = Math.atan2(
				Cesium.Cartesian3.dot(forwardHorizontal, east),
				Cesium.Cartesian3.dot(forwardHorizontal, north)
			);

			heading = Cesium.Math.toDegrees(heading);
			heading = (heading + 360) % 360;
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