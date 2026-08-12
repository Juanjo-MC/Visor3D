export class TrackFollower {
    constructor(viewer) {
        this.viewer = viewer;
        this._removeListener = null;
        this._trackerEntity = null;
    }

    /**
     * Follows a DataSource track with a smooth transition.
     */
    async followTrack(dataSource, options = {}) {
        const {
            speed = 0.05,
            heightOffset = 40,
            backwardOffset = -100,
            pitch = -15,
            flyDuration = 3.0
        } = options;

        this.stop();

        const trackEntity = dataSource.entities.values.find(e => Cesium.defined(e.polyline));
        if (!trackEntity) throw new Error("No polyline found in DataSource.");

        const positions = trackEntity.polyline.positions.getValue(this.viewer.clock.currentTime);
        if (!positions || positions.length < 2) return;

        const { sampledPosition, startTime, stopTime } = this._createSampledPosition(positions, speed);

        this._trackerEntity = this.viewer.entities.add({
            position: sampledPosition,
            orientation: new Cesium.VelocityOrientationProperty(sampledPosition)
        });

        // Setup Clock range
        this.viewer.clock.startTime = startTime.clone();
        this.viewer.clock.stopTime = stopTime.clone();
        this.viewer.clock.currentTime = startTime.clone();
        this.viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
        this.viewer.clock.shouldAnimate = false; 

        // Initial transition
        await this._flyToStart(sampledPosition, startTime, flyDuration, { backwardOffset, heightOffset, pitch });

        this.viewer.clock.shouldAnimate = true;
        this._attachListener(backwardOffset, heightOffset, pitch);
    }

    /**
     * Pauses the track follow animation.
     */
    pause() {
        this.viewer.clock.shouldAnimate = false;
    }

    /**
     * Resumes the track follow animation.
     */
    resume() {
        if (this._trackerEntity) {
            this.viewer.clock.shouldAnimate = true;
        }
    }

    /**
     * Returns true if the animation is currently paused.
     */
    get isPaused() {
        return !this.viewer.clock.shouldAnimate;
    }

    /**
     * Stops tracking, cleans up listeners and entities, and resets camera.
     */
    stop() {
        this.pause();
        if (this._removeListener) {
            this._removeListener();
            this._removeListener = null;
        }
        if (this._trackerEntity) {
            this.viewer.entities.remove(this._trackerEntity);
            this._trackerEntity = null;
        }
        // Reset the camera transform so user can control it freely again
        this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    }

    // --- Private Helper Methods ---

    _createSampledPosition(positions, speed) {
        const sampledPosition = new Cesium.SampledPositionProperty();
        const startTime = Cesium.JulianDate.now();
        let runningTime = startTime.clone();

        sampledPosition.addSample(runningTime, positions[0]);

        for (let i = 1; i < positions.length; i++) {
            const distance = Cesium.Cartesian3.distance(positions[i - 1], positions[i]);
            runningTime = Cesium.JulianDate.addSeconds(runningTime, distance / speed, new Cesium.JulianDate());
            sampledPosition.addSample(runningTime, positions[i]);
        }

        sampledPosition.setInterpolationOptions({
            interpolationDegree: 3,
            interpolationAlgorithm: Cesium.HermitePolynomialApproximation
        });

        return { sampledPosition, startTime, stopTime: runningTime };
    }

    async _flyToStart(property, time, duration, offsets) {
        const startPos = property.getValue(time);
        if (!startPos) return;

        return this.viewer.camera.flyTo({
            destination: Cesium.Cartesian3.add(
                startPos, 
                new Cesium.Cartesian3(offsets.backwardOffset, 0, offsets.heightOffset), 
                new Cesium.Cartesian3()
            ),
            orientation: {
                pitch: Cesium.Math.toRadians(offsets.pitch),
                heading: 0
            },
            duration: duration
        });
    }

    _attachListener(x, y, z) {
        const cameraOffset = new Cesium.Cartesian3(x, y, z);
        
        this._removeListener = this.viewer.scene.preRender.addEventListener((scene, time) => {
            if (!this._trackerEntity) return;

            const pos = this._trackerEntity.position.getValue(time);
            const ori = this._trackerEntity.orientation.getValue(time);

            if (pos && ori) {
                const transform = Cesium.Matrix4.fromRotationTranslation(
                    Cesium.Matrix3.fromQuaternion(ori),
                    pos
                );
                this.viewer.camera.lookAtTransform(transform, cameraOffset);
            }
        });
    }
}