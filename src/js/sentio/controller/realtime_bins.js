sentio.controller.rtBins = sentio_controller_rtBins;

/*
 * Controller wrapper for the bin model. Assumes binSize is in milliseconds.
 * Every time binSize elapses, updates the lwm to keep the bins shifting.
 */
function sentio_controller_rtBins(config) {
	'use strict';

	/**
	 * Private variables
	 */
	var _config = {
		delay: 0,
		binSize: 0,
		binCount: 0
	};

	// The bins
	var _model;
	var _playing;

	/**
	 * Private Functions
	 */

	function _calculateLwm() {
		// Assume the hwm is now plus two binSize
		var hwm = Date.now() + 2*_model.size();

		// Trunc the hwm down to a round value based on the binSize
		hwm = Math.floor(hwm/_model.size()) * _model.size();

		// Derive the lwm from the hwm
		var lwm = hwm - _model.size() * _model.count();

		return lwm;
	}

	function _update() {
		if(_playing === true) {
			// need to update the lwm
			_model.lwm(_calculateLwm());

			window.setTimeout(_update, _model.size());
		}
	}

	function _play() {
		if(!_playing) {
			// Start the update loop
			_playing = true;
			_update();
		}
	}

	function _pause() {
		// Setting playing to false will pause the update loop
		_playing = false;
	}

	// create/init method
	function controller(rtConfig) {
		if(null == rtConfig || null == rtConfig.binCount || null == rtConfig.binSize) {
			throw new Error('You must provide an initial binSize and binCount');
		}

		_config.binSize = rtConfig.binSize;
		_config.binCount = rtConfig.binCount;

		if(null != rtConfig.delay) {
			_config.delay = rtConfig.delay;
		}

		_model = sentio.model.bins({
			size: _config.binSize,
			count: _config.binCount + 2,
			lwm: 0
		});
		_model.lwm(_calculateLwm());

		_play();
	}



	/**
	 * Public API
	 */

	/*
	 * Get the model bins
	 */
	controller.bins = function(v) {
		if(!arguments.length) { return _model.bins(); }
		_model.bins(v);

		return controller;
	};

	controller.play = function() {
		_play();
		return controller;
	};

	controller.pause = function() {
		_pause();
		return controller;
	};

	controller.add = function(v) {
		_model.add(v);
		return controller;
	}

	controller.clear = function() {
		_model.clear();
		return controller;
	}

	controller.binSize = function(v) {
		if(!arguments.length) { return _model.bins(); }
		_model.bins(v);

		return controller;
	}

	controller.binSize = function(v) {
		if(!arguments.length) { return _config.binSize; }

		if(Number(v) < 1) {
			throw new Error('Bin size must be a positive integer');
		}

		_config.binSize = v;
		_model.size(v);
		_model.lwm(_calculateLwm())

		return controller;
	}

	controller.binCount = function(v) {
		if(!arguments.length) { return _config.binCount; }

		if(Number(v) < 1) {
			throw new Error('Bin count must be a positive integer');
		}

		_config.binCount = v;
		_model.count(v + 2);
		_model.lwm(_calculateLwm())

		return controller;
	}

	// Initialize the layout
	controller(config);

	return controller;
}