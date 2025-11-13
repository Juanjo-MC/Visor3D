export class DeviceHeadingTracker{
	static #onHeadingChange = null;		// Callback function to which the heading will be passed
	static #orientationSensor = null;	// AbsoluteOrientationSensor instance
	static #frequency = 60;				// AbsoluteOrientationSensor frequency (Hz)
	static #filterAlpha = 0.96;			// Low pass filter Alpha
	static #previousHeading = null;

	static async start(onHeadingChange, cameraHeading){
		try{
			if (location.protocol !== 'https:'){
				window.alert('Esta función requiere HTTPS');
				return false;
			}

			DeviceHeadingTracker.#onHeadingChange = onHeadingChange;
			await DeviceHeadingTracker.#requestPermissions();
			// Set #previousHeading to the current viewer camera heading, that way the camera will start rotating from there to the curent device heading
			DeviceHeadingTracker.#previousHeading = cameraHeading;

			// Start sensor
			if ('AbsoluteOrientationSensor' in window){
				DeviceHeadingTracker.#startAbsoluteOrientationSensor();
				return true;
			}
			else if ('DeviceOrientationEvent' in window){
				DeviceHeadingTracker.#startDeviceOrientationFallback();
				return true;
			}
			else{
				window.alert('Sensores de orientación no soportados en este dispositivo.');
				DeviceHeadingTracker.#previousHeading = null;
				return false;
			}
		}
		catch (err){
			DeviceHeadingTracker.#previousHeading = null;
			throw err;
		}
	}

	static stop(){
		if (DeviceHeadingTracker.#orientationSensor){
			DeviceHeadingTracker.#orientationSensor.stop();
			DeviceHeadingTracker.#orientationSensor = null;
		}

		window.removeEventListener('deviceorientation', DeviceHeadingTracker.#handleOrientationEvent);
		window.removeEventListener('deviceorientationabsolute',DeviceHeadingTracker.#handleOrientationEvent);
		DeviceHeadingTracker.#previousHeading = null;
	}

	static async #requestPermissions(){
		try{
			if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission){
				const motionPermission = await DeviceMotionEvent.requestPermission();

				if (motionPermission !== 'granted'){
					throw new Error('Permiso de Moción denegado');
				}
			}

			if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission){
				const orientationPermission = await DeviceOrientationEvent.requestPermission();

				if (orientationPermission !== 'granted'){
					throw new Error('Permiso de Orientación denegado');
				}
			}
		}
		catch (err){
			throw err;
		}
	}

	static #startAbsoluteOrientationSensor(){
		try{
			DeviceHeadingTracker.#orientationSensor = new AbsoluteOrientationSensor({frequency: DeviceHeadingTracker.#frequency});

			DeviceHeadingTracker.#orientationSensor.addEventListener('reading', () => {
				const q = DeviceHeadingTracker.#orientationSensor.quaternion;

				if (!q){
					return;
				}

				const quaternion = {x: q[0], y: q[1], z: q[2], w: q[3]};
				let heading = Cesium.Math.toDegrees(Cesium.HeadingPitchRoll.fromQuaternion(quaternion).heading);
				heading = (heading + DeviceHeadingTracker.#getDeviceOrientationCorrection() + 360) % 360;
				const filteredHeading = DeviceHeadingTracker.#applyFilter(heading);
				DeviceHeadingTracker.#onHeadingChange(filteredHeading);
			});

			DeviceHeadingTracker.#orientationSensor.start();
		}
		catch (error){
			throw err;
		}
	}

	static #startDeviceOrientationFallback(){
		// Bind the event handler once
		DeviceHeadingTracker.#handleOrientationEvent = DeviceHeadingTracker.#handleOrientationEvent.bind(DeviceHeadingTracker);
		window.addEventListener('deviceorientationabsolute', DeviceHeadingTracker.#handleOrientationEvent, true);
		window.addEventListener('deviceorientation', DeviceHeadingTracker.#handleOrientationEvent, true);
	}

	static #handleOrientationEvent(event){
		let heading;

		if (event.webkitCompassHeading !== undefined){
			heading = event.webkitCompassHeading;
		}
		else if (event.absolute && event.alpha !== null){
			heading = 360 - event.alpha;
		}
		else if (event.alpha !== null){
			heading = 360 - event.alpha;
		}
		else{
			return;
		}

		heading = (heading + DeviceHeadingTracker.#getDeviceOrientationCorrection() + 360) % 360;
		const filteredHeading = DeviceHeadingTracker.#applyFilter(heading);
		DeviceHeadingTracker.#onHeadingChange(filteredHeading);
	}

	static #applyFilter(newHeading){
		let diff = newHeading - DeviceHeadingTracker.#previousHeading;

		if (diff > 180){
			newHeading -= 360;
		}
		else if (diff < -180){
			newHeading += 360;
		}

		DeviceHeadingTracker.#previousHeading = DeviceHeadingTracker.#filterAlpha * DeviceHeadingTracker.#previousHeading + (1 - DeviceHeadingTracker.#filterAlpha) * newHeading;
		DeviceHeadingTracker.#previousHeading = (DeviceHeadingTracker.#previousHeading + 360) % 360;
		return DeviceHeadingTracker.#previousHeading;
	}

	static #getDeviceOrientationCorrection(){
		if (window.screen?.orientation?.angle !== null){
			switch (window.screen.orientation.angle){
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