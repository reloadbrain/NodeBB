'use strict';

var async = require('async');
var winston = require('winston');

var buildStart;

exports.build = function build(targets, callback) {
	buildStart = Date.now();

	var db = require('./src/database');
	var meta = require('./src/meta');
	var plugins = require('./src/plugins');
	var valid = ['js', 'clientCSS', 'acpCSS', 'tpl'];

	targets = (targets === true ? valid : targets.split(',').filter(function (target) {
		return valid.indexOf(target) !== -1;
	}));

	if (!targets) {
		winston.error('[build] No valid build targets found. Aborting.');
		return process.exit(0);
	}

	async.series([
		async.apply(db.init),
		async.apply(meta.themes.setupPaths),
		async.apply(plugins.prepareForBuild)
	], function (err) {
		if (err) {
			winston.error('[build] Encountered error preparing for build: ' + err.message);
			return process.exit(1);
		}

		exports.buildTargets(targets, callback);
	});
};

exports.buildTargets = function (targets, callback) {
	var meta = require('./src/meta');
	var startTime;
	var step = function (target, next) {
		winston.info('[build]  => Completed in ' + ((Date.now() - startTime) / 1000) + 's');
		next();
	};
	// eachSeries because it potentially(tm) runs faster on Windows this way
	async.eachSeries(targets, function (target, next) {
		switch(target) {
			case 'js':
				winston.info('[build] Building javascript');
				startTime = Date.now();
				async.series([
					async.apply(meta.js.minify, 'nodebb.min.js'),
					async.apply(meta.js.minify, 'acp.min.js')
				], step.bind(this, target, next));
				break;

			case 'clientCSS':
				winston.info('[build] Building client-side CSS');
				startTime = Date.now();
				meta.css.minify('stylesheet.css', step.bind(this, target, next));
				break;

			case 'acpCSS':
				winston.info('[build] Building admin control panel CSS');
				startTime = Date.now();
				meta.css.minify('admin.css', step.bind(this, target, next));
				break;

			case 'tpl':
				winston.info('[build] Building templates');
				startTime = Date.now();
				meta.templates.compile(step.bind(this, target, next));
				break;

			default:
				winston.warn('[build] Unknown build target: \'' + target + '\'');
				setImmediate(next);
				break;
		}
	}, function (err) {
		if (err) {
			winston.error('[build] Encountered error during build step: ' + err.message);
			return process.exit(1);
		}

		var time = (Date.now() - buildStart) / 1000;

		winston.info('[build] Asset compilation successful. Completed in ' + time + 's.');

		if (typeof callback === 'function') {
			callback();
		} else {
			process.exit(0);
		}
	});
};