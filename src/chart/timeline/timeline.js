import { axisBottom as d3_axisBottom, axisLeft as d3_axisLeft } from 'd3-axis';
import { brushX as d3_brushX } from 'd3-brush';
import { dispatch as d3_dispatch } from 'd3-dispatch';
import { scaleTime as d3_scaleTime, scaleLinear as d3_scaleLinear } from 'd3-scale';
import { line as d3_line, area as d3_area } from 'd3-shape';

import { default as extent } from '../../model/extent';
import { default as multiExtent } from '../../model/multi-extent';
import { default as timelineBrush } from '../../controller/timeline-brush';

export default function timeline() {

	var _id = 'timeline_line_' + Date.now();

	// Margin between the main plot group and the svg border
	var _margin = { top: 10, right: 10, bottom: 20, left: 40 };

	// Height and width of the SVG element
	var _height = 100, _width = 600;

	// Render the grid?
	var _displayOptions = {
		xGrid: false,
		yGrid: false,
		points: false,
		tooltip: false
	};

	// Various configuration functions
	var _fn = {
		valueX: function(d) { return d[0]; },
		valueY: function(d) { return d[1]; },

		markerValueX: function(d) { return d[0]; },
		markerLabel: function(d) { return d[1]; },

		seriesKey: function(d) { return d.key; },
		seriesValues: function(d) { return d.values; },
		seriesLabel: function(d) { return d.label; }
	};


	// Extent configuration for x and y dimensions of plot
	var now = Date.now();
	var _extent = {
		x: extent({
			defaultValue: [ now - 60000 * 5, now ],
			getValue: function(d, i) { return _fn.valueX(d, i); }
		}),
		y: extent({
			getValue: function(d, i) { return _fn.valueY(d, i); }
		})
	};
	var _multiExtent = multiExtent().values(function(d, i) { return _fn.seriesValues(d, i); });


	// Default scales for x and y dimensions
	var _scale = {
		x: d3_scaleTime(),
		y: d3_scaleLinear()
	};


	// Default Axis definitions
	var _axis = {
		x: d3_axisBottom().scale(_scale.x),
		y: d3_axisLeft().ticks(3).scale(_scale.y),

		xGrid: d3_axisBottom().tickFormat('').tickSizeOuter(0).scale(_scale.x),
		yGrid: d3_axisLeft().tickFormat('').tickSizeOuter(0).ticks(3).scale(_scale.y)
	};


	// Storage for commonly used DOM elements
	var _element = {
		svg: undefined,

		g: {
			container: undefined,
			plots: undefined,

			xAxis: undefined,
			yAxis: undefined,
			xAxisGrid: undefined,
			yAxisGrid: undefined,

			markers: undefined,
			brush: undefined
		},

		plotClipPath: undefined,
		markerClipPath: undefined
	};


	// Line generator for the plot
	var _line = d3_line();
	_line.x(function(d, i) {
		return _scale.x(_fn.valueX(d, i));
	});
	_line.y(function(d, i) {
		return _scale.y(_fn.valueY(d, i));
	});

	// Area generator for the plot
	var _area = d3_area();
	_area.x(function(d, i) {
		return _scale.x(_fn.valueX(d, i));
	});
	_area.y1(function(d, i) {
		return _scale.y(_fn.valueY(d, i));
	});


	// Brush Management
	var _brush = timelineBrush({ brush: d3_brushX(), scale: _scale.x });
	_brush.dispatch()
		.on('end', function() { _dispatch.call('brushend', this, getBrush()); })
		.on('start', function() { _dispatch.call('brushstart', this, getBrush()); })
		.on('brush', function() { _dispatch.call('brush', this, getBrush()); });



	/**
	 * Get the current brush state in terms of the x data domain, in ms epoch time
	 */
	function getBrush() {

		// Try to get the node from the brush group selection
		var node = (null != _element.g.brush)? _element.g.brush.node() : null;

		// Get the current brush selection
		return _brush.getSelection(node);

	}


	/**
	 * Set the current brush state in terms of the x data domain
	 * @param v The new value of the brush
	 *
	 */
	function setBrush(v) {
		_brush.setSelection(_element.g.brush, v);
	}


	/**
	 * Update the state of the brush (as part of redrawing everything)
	 *
	 * The purpose of this function is to update the state of the brush to reflect changes
	 * to the rest of the chart as part of a normal update/redraw cycle. When the x extent
	 * changes, the brush needs to move to stay correctly aligned with the x axis. Normally,
	 * we are only updating the drawn position of the brush, so the brushSelection doesn't
	 * actually change. However, if the change results in the brush extending partially or
	 * wholly outside of the x extent, we might have to clip or clear the brush, which will
	 * result in brush change events being propagated.
	 *
	 * @param previousExtent The previous state of the brush extent. Must be provided to
	 *        accurately determine the extent of the brush in terms of the x data domain
	 */
	function updateBrush(previousExtent) {

		// If there was no previous extent, then there is no brush to update
		if (null != previousExtent) {

			// Derive the overall plot extent from the collection of series
			var plotExtent = _multiExtent.extent(_extent.x).getExtent(_data);

			if(null != plotExtent && Array.isArray(plotExtent) && plotExtent.length == 2) {

				// Clip extent by the full extent of the plot (this is in case we've slipped off the visible plot)
				var newExtent = [ Math.max(plotExtent[0], previousExtent[0]), Math.min(plotExtent[1], previousExtent[1]) ];
				setBrush(newExtent);

			}
			else {
				// There is no plot/data so just clear the brush
				setBrush(undefined);
			}
		}

		_element.g.brush
			.style('display', (_brush.enabled())? 'unset' : 'none')
			.call(_brush.brush());
	}


	// The dispatch object and all events
	var _dispatch = d3_dispatch('brush', 'brushstart', 'brushend', 'markerClick', 'markerMouseover', 'markerMouseout')


	// The main data array
	var _data = [];

	// Markers data
	var _markers = {
		values: []
	};


	// Chart create/init method
	function _instance() {}


	/**
	 * Initialize the chart (only called once). Performs all initial chart creation/setup
	 *
	 * @param container The container element to which to apply the chart
	 * @returns {_instance} Instance of the chart
	 */
	_instance.init = function(container) {

		// Create a container div
		_element.div = container.append('div').attr('class', 'sentio timeline');

		// Create the SVG element
		_element.svg = _element.div.append('svg');

		// Add the defs and add the clip path definition
		var defs = _element.svg.append('defs');
		_element.plotClipPath = defs.append('clipPath').attr('id', 'plot_' + _id).append('rect');
		_element.markerClipPath = defs.append('clipPath').attr('id', 'marker_' + _id).append('rect');

		// Append a container for everything
		_element.g.container = _element.svg.append('g');

		// Append the grid
		_element.g.xAxisGrid = _element.g.container.append('g').attr('class', 'x grid');
		_element.g.yAxisGrid = _element.g.container.append('g').attr('class', 'y grid');

		// Append the path group (which will have the clip path and the line path
		_element.g.plots = _element.g.container.append('g').attr('class', 'plots').attr('clip-path', 'url(#plot_' + _id + ')');

		// Append groups for the axes
		_element.g.xAxis = _element.g.container.append('g').attr('class', 'x axis');
		_element.g.yAxis = _element.g.container.append('g').attr('class', 'y axis');

		// Append a group for the markers
		_element.g.markers = _element.g.container.append('g').attr('class', 'markers').attr('clip-path', 'url(#marker_' + _id + ')');

		// Add the brush element
		_element.g.brush = _element.g.container.append('g').attr('class', 'x brush').attr('clip-path', 'url(#marker_' + _id + ')');


		_instance.resize();

		return _instance;
	};

	/*
	 * Set the _instance data
	 */
	_instance.data = function(v) {
		if (!arguments.length) { return _data; }
		_data = (null != v)? v : [];

		return _instance;
	};

	/*
	 * Set the markers data
	 */
	_instance.markers = function(v) {
		if (!arguments.length) { return _markers.values; }
		_markers.values = (null != v)? v : [];
		return _instance;
	};

	/*
	 * Updates all the elements that depend on the size of the various components
	 */
	_instance.resize = function() {

		// Need to grab the brush extent before we change anything
		var brushSelection = getBrush();


		// Resize the SVG Pane
		_element.svg.attr('width', _width).attr('height', _height);

		// Update the margins on the main draw group
		_element.g.container.attr('transform', 'translate(' + _margin.left + ',' + _margin.top + ')');


		// Resize Scales
		_scale.x.range([ 0, Math.max(0, _width - _margin.left - _margin.right) ]);
		_scale.y.range([ Math.max(0, _height - _margin.top - _margin.bottom), 0 ]);


		/**
		 * Resize clip paths
		 */

		// Plot clip path is only the plot pane
		_element.plotClipPath
			.attr('transform', 'translate(0, -1)')
			.attr('width', Math.max(0, _scale.x.range()[1]) + 2)
			.attr('height', Math.max(0, _scale.y.range()[0]) + 2);

		// Marker clip path includes top margin by default
		_element.markerClipPath
			.attr('transform', 'translate(0, -' + _margin.top + ')')
			.attr('width', Math.max(0, _width - _margin.left - _margin.right))
			.attr('height', Math.max(0, _height - _margin.bottom));


		/**
		 * Update axis and grids
		 */

		// Reset axis and grid positions
		_element.g.xAxis.attr('transform', 'translate(0,' + _scale.y.range()[0] + ')');
		_element.g.xAxisGrid.attr('transform', 'translate(0,' + _scale.y.range()[0] + ')');


		// Resize the x grid ticks
		if (_displayOptions.xGrid) {
			_axis.xGrid.tickSizeInner(-(_height - _margin.top - _margin.bottom));
		}
		else {
			_axis.xGrid.tickSizeInner(0);
		}

		// Resize the y grid ticks
		if (_displayOptions.yGrid) {
			_axis.yGrid.tickSizeInner(-(_width - _margin.left - _margin.right));
		}
		else {
			_axis.yGrid.tickSizeInner(0);
		}


		/**
		 * Update the brush
		 */

		// Resize and position the brush g element
		_element.g.brush.selectAll('rect')
			.attr('y', -1).attr('x', 0)
			.attr('width', _scale.x.range()[1])
			.attr('height', _scale.y.range()[0] + 2);

		// Resize the brush
		_brush.brush()
			.extent([ [ 0, 0 ], [ _scale.x.range()[1], _scale.y.range()[0] + 2 ] ]);

		updateBrush(brushSelection);


		return _instance;
	};


	/*
	 * Redraw the graphic
	 */
	_instance.redraw = function() {

		// Need to grab the brush extent before we change anything
		var brushSelection = getBrush();

		// Update the x domain (to the latest time window)
		_scale.x.domain(_multiExtent.extent(_extent.x).getExtent(_data));

		// Update the y domain (based on configuration and data)
		_scale.y.domain(_multiExtent.extent(_extent.y).getExtent(_data));

		// Update the plot elements
		updateAxes();
		updateLine();
		updateMarkers();
		updateBrush(brushSelection);

		return _instance;
	};

	function updateAxes() {
		if (null != _axis.x) {
			_element.g.xAxis.call(_axis.x);
		}
		if (null != _axis.xGrid && _displayOptions.xGrid) {
			_element.g.xAxisGrid.call(_axis.xGrid);
		}
		if (null != _axis.y) {
			_element.g.yAxis.call(_axis.y);
		}
		if (null != _axis.yGrid && _displayOptions.yGrid) {
			_element.g.yAxisGrid.call(_axis.yGrid);
		}
	}

	function updateLine() {

		// Join
		var plotJoin = _element.g.plots
			.selectAll('.plot')
			.data(_data, _fn.seriesKey);

		// Enter
		var plotEnter = plotJoin.enter().append('g')
			.attr('class', 'plot');

		var lineEnter = plotEnter.append('g').append('path').attr('class', function(d) { return ((d.cssClass)? d.cssClass : '') + ' line'; });
		var areaEnter = plotEnter.append('g').append('path').attr('class', function(d) { return ((d.cssClass)? d.cssClass : '') + ' area'; });

		var lineUpdate = plotJoin.select('.line');
		var areaUpdate = plotJoin.select('.area');

		// Enter + Update
		lineEnter.merge(lineUpdate).datum(_fn.seriesValues).attr('d', _line);
		areaEnter.merge(areaUpdate).datum(_fn.seriesValues).attr('d', _area.y0(_scale.y.range()[0]));

		// Exit
		var plotExit = plotJoin.exit();
		plotExit.remove();

	}

	function updateMarkers() {

		// Join
		var markerJoin = _element.g.markers
			.selectAll('.marker')
			.data(_markers.values, _fn.markerValueX);

		// Enter
		var markerEnter = markerJoin.enter().append('g')
			.attr('class', 'marker')
			.on('mouseover', function(d, i) { _dispatch.call('markerMouseover', this, d, i); })
			.on('mouseout', function(d, i) { _dispatch.call('markerMouseout', this, d, i); })
			.on('click', function(d, i) { _dispatch.call('markerClick', this, d, i); });

		var lineEnter = markerEnter.append('line');
		var textEnter = markerEnter.append('text');

		lineEnter
			.attr('y1', function(d) { return _scale.y.range()[1]; })
			.attr('y2', function(d) { return _scale.y.range()[0]; });

		textEnter
			.attr('dy', '0em')
			.attr('y', -3)
			.attr('text-anchor', 'middle')
			.text(_fn.markerValueLabel);

		// Enter + Update
		var lineUpdate = markerJoin.select('line');
		var textUpdate = markerJoin.select('text');

		lineEnter.merge(lineUpdate)
			.attr('x1', function(d, i) { return _scale.x(_fn.markerValueX(d, i)); })
			.attr('x2', function(d, i) { return _scale.x(_fn.markerValueX(d)); });

		textEnter.merge(textUpdate)
			.attr('x', function(d, i) { return _scale.x(_fn.markerValueX(d)); });

		// Exit
		markerJoin.exit().remove();

	}


	// Basic Getters/Setters
	_instance.width = function(v) {
		if (!arguments.length) { return _width; }
		_width = v;
		return _instance;
	};
	_instance.height = function(v) {
		if (!arguments.length) { return _height; }
		_height = v;
		return _instance;
	};
	_instance.margin = function(v) {
		if (!arguments.length) { return _margin; }
		_margin = v;
		return _instance;
	};
	_instance.xGrid = function(v) {
		if (!arguments.length) { return _displayOptions.xGrid; }
		_displayOptions.xGrid = v;
		return _instance;
	};
	_instance.yGrid = function(v) {
		if (!arguments.length) { return _displayOptions.yGrid; }
		_displayOptions.yGrid = v;
		return _instance;
	};
	_instance.grid = function(v) {
		_displayOptions.xGrid = _displayOptions.yGrid = v;
		return _instance;
	};

	_instance.curve = function(v) {
		if (!arguments.length) { return _line.curve(); }
		_line.curve(v);
		_area.curve(v);
		return _instance;
	};

	_instance.xAxis = function(v) {
		if (!arguments.length) { return _axis.x; }
		_axis.x = v;
		return _instance;
	};
	_instance.xGridAxis = function(v) {
		if (!arguments.length) { return _axis.xGrid; }
		_axis.xGrid = v;
		return _instance;
	};
	_instance.yAxis = function(v) {
		if (!arguments.length) { return _axis.y; }
		_axis.y = v;
		return _instance;
	};
	_instance.yGridAxis = function(v) {
		if (!arguments.length) { return _axis.yGrid; }
		_axis.yGrid = v;
		return _instance;
	};
	_instance.xScale = function(v) {
		if (!arguments.length) { return _scale.x; }
		_scale.x = v;
		if (null != _axis.x) {
			_axis.x.scale(v);
		}
		if (null != _axis.xGrid) {
			_axis.xGrid.scale(v);
		}
		if (null != _brush) {
			_brush.scale(v);
		}
		return _instance;
	};
	_instance.yScale = function(v) {
		if (!arguments.length) { return _scale.y; }
		_scale.y = v;
		if (null != _axis.y) {
			_axis.y.scale(v);
		}
		if (null != _axis.yGrid) {
			_axis.yGrid.scale(v);
		}
		return _instance;
	};
	_instance.xValue = function(v) {
		if (!arguments.length) { return _fn.valueX; }
		_fn.valueX = v;
		return _instance;
	};
	_instance.yValue = function(v) {
		if (!arguments.length) { return _fn.valueY; }
		_fn.valueY = v;
		return _instance;
	};
	_instance.yExtent = function(v) {
		if (!arguments.length) { return _extent.y; }
		_extent.y = v;
		return _instance;
	};
	_instance.xExtent = function(v) {
		if (!arguments.length) { return _extent.x; }
		_extent.x = v;
		return _instance;
	};

	_instance.seriesKey = function(v) {
		if(!arguments.length) { return _fn.seriesKey; }
		_fn.seriesKey = v;
		return _instance;
	};
	_instance.seriesLabel = function(v) {
		if(!arguments.length) { return _fn.seriesLabel; }
		_fn.seriesLabel = v;
		return _instance;
	};
	_instance.seriesValues = function(v) {
		if(!arguments.length) { return _fn.seriesValues; }
		_fn.seriesValues = v;
		return _instance;
	};
	_instance.markerXValue = function(v) {
		if (!arguments.length) { return _fn.markerValueX; }
		_fn.markerValueX = v;
		return _instance;
	};
	_instance.markerLabel = function(v) {
		if (!arguments.length) { return _fn.markerValueLabel; }
		_fn.markerValueLabel = v;
		return _instance;
	};

	_instance.dispatch = function(v) {
		if (!arguments.length) { return _dispatch; }
		return _instance;
	};
	_instance.brush = function(v) {
		if (!arguments.length) { return _brush.enabled(); }
		_brush.enabled(v);
		return _instance;
	};
	_instance.setBrush = function(v) {
		setBrush(v);
		return _instance;
	};
	_instance.getBrush = function() {
		return getBrush();
	};

	return _instance;
}
