'use strict';

let
	glob = require('glob'),
	gulp = require('gulp'),
	gulpLoadPlugins = require('gulp-load-plugins'),
	rollup = require('rollup-stream'),
	runSequence = require('run-sequence'),
	source = require('vinyl-source-stream'),
	buffer = require('vinyl-buffer'),

	plugins = gulpLoadPlugins(),
	pkg = require('./package.json'),
	assets = require('./config/assets');


// Banner to append to generated files
let bannerString = '/*! ' + pkg.name + '-' + pkg.version + ' - ' + pkg.copyright + '*/'


/**
 * Validation Tasks
 */

gulp.task('validate-js', () => {

	return gulp.src(assets.src.js)

		// ESLint
		.pipe(plugins.eslint())
		.pipe(plugins.eslint.format())
		.pipe(plugins.eslint.failAfterError());

});


/**
 * Build
 */

gulp.task('build-js', () => {

	return rollup({
			entry: assets.src.js,
			format: 'umd',
			moduleName: pkg.artifactName,
			sourceMap: true,
			banner: bannerString
		})
		.pipe(source(assets.src.js))
		.pipe(buffer())
		.pipe(plugins.rename(pkg.artifactName + '.js'))
		.pipe(gulp.dest(assets.dist.dir))

		// Uglify
		.pipe(plugins.filter(pkg.artifactName + '.js'))
		.pipe(plugins.uglify({ preserveComments: 'license' }))
		.pipe(plugins.rename(pkg.artifactName + '.min.js'))
		.pipe(gulp.dest(assets.dist.dir));

});

gulp.task('build-css', () => {

	// Generate a list of the sources in a deterministic manner
	let sourceArr = [];
	assets.src.sass.forEach((f) => {
		sourceArr = sourceArr.concat(glob.sync(f).sort());
	});

	return gulp.src(sourceArr)

		// Lint the Sass
		.pipe(plugins.sassLint({
			formatter: 'stylish',
			rules: require('./config/sasslint.conf.js')
		}))
		.pipe(plugins.sassLint.format())
		.pipe(plugins.sassLint.failAfterError())

		// Compile and concat the sass (w/sourcemaps)
		.pipe(plugins.sourcemaps.init())
			.pipe(plugins.sass())
			.pipe(plugins.concat(pkg.artifactName + '.css'))
			.pipe(plugins.insert.prepend(bannerString))
		.pipe(plugins.sourcemaps.write('.'))
		.pipe(gulp.dest(assets.dist.dir))

		// Clean the CSS
		.pipe(plugins.filter(assets.dist.dir + '/' + pkg.artifactName + '.css'))
		.pipe(plugins.cleanCss())
		.pipe(plugins.rename(pkg.artifactName + '.min.css'))
		.pipe(gulp.dest(assets.dist.dir));

});

// Tests
gulp.task('build-tests', () => {

	// Generate a list of the test sources in a deterministic manner
	let sourceArr = [ ];
	assets.tests.js.forEach((f) => {
		sourceArr = sourceArr.concat(glob.sync(f).sort());
	});

	return gulp.src(sourceArr)

		// ESLint
		.pipe(plugins.eslint())
		.pipe(plugins.eslint.format())
		.pipe(plugins.eslint.failAfterError())

		// Concat
		.pipe(plugins.concat(pkg.artifactName + '-tests.js'))
		.pipe(gulp.dest(assets.dist.dir));

});

// Run Tests
gulp.task('run-tests', () => {
	return gulp.src('test/runner.html')
		.pipe(plugins.mochaPhantomjs());
});


/**
 * --------------------------
 * Main Tasks
 * --------------------------
 */

gulp.task('build', (done) => { runSequence('validate-js', [ 'build-css', 'build-tests', 'build-js' ], done); } );
gulp.task('test', (done) => { runSequence('build', 'run-tests', done); } );

// Default task builds and tests
gulp.task('default', [ 'test' ]);
