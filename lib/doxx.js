"use strict";

var 
path = require('path'),
dir = require('../lib/dir'),
fs      = require('fs'),
mkdirp  = require('mkdirp'),
_       = require('lodash'),
marked  = require('marked'),
parse   = require('./parser'),
compile = require('./compile'),
symbols = require('./symbols'),
defaults = require('./defaults');

/**
 * Options & Defaults
 */
var ignoredDirs = defaults.ignoredDirs,
pkg = defaults.pkg,
target_extension = defaults.target_extension;

module.exports = function(options) {

	if(options.target_extension){
		target_extension = options.target_extension;
	}

	if(options.template){
		compile.tpl = fs.readFileSync(options.template).toString();
		compile.tplFileName = options.template;
	}

	if (!options.source) {
		console.error("  Error you must define a source\n");
		return showHelp();
	}
	

	var target = path.resolve(process.cwd(), options.target) || process.cwd() + '/docs',
	source = path.resolve(process.cwd(), options.source),
	ignore = options.ignore || ignoredDirs;

	//Cleanup and turn into an array the ignoredDirs
	ignore     = ignore.trim().replace(' ','').split(',');

	//Find, cleanup and validate all potential files
	var files  = dir.collectFiles(source, {ignore:ignore});


	mkdirp.sync(target);

	//Parse each file
	files = files.map(function(file) {
		var dox = parse(path.join(source, file), {});
		var targetName = file+'.'+target_extension;
		return {
			name:       file,
			targetName: targetName,
			dox:        dox,
			symbols:    symbols(dox, targetName)
		};
	});

	//Compute all symboles
	var allSymbols = files.reduce(function(m, a){
		m = m.concat(a.symbols || []);
		return m;
	}, []);

	//Get package.json 
	try{
		pkg = require(process.cwd() + '/package')
	} catch (err) {
	}

	var readme = pkg && pkg.readme 
	, readMeFile = path.resolve(process.cwd(), options.readme || (pkg && pkg.readmeFileName) || 'README.md')

	if(!readme && fs.existsSync(readMeFile)){
		readme = fs.readFileSync(readMeFile).toString()
	} else {
		console.warn(new Error('No README.md file found at ' + readMeFile))
	}

	readme = readme || (pkg && pkg.description)

	//Enable line-breaks ala github markdown
	marked.setOptions({
		breaks: true,
		smartLists: true
	})

	//Get readme data
	files.unshift({
		name:"首页",
		targetName: "index.html",
		readme: marked(readme),
		dox:[],
		symbols:[]
	});

	//Make sure the folder structure in target mirrors source
	var folders = [];

	files.forEach(function(file){
		var folder = file.targetName.substr(0, file.targetName.lastIndexOf(path.sep));

		if ((folder !== '') && (folders.indexOf(folder) === -1)) {
			folders.push(folder);
			mkdirp.sync(target + '/' + folder);
		}
	});


	//Render and write each file
	files.forEach(function(file){

		// Set each files relName in relation to where this file is in the directory tree
		files.forEach(function(f){

			// Count how deep the current file is in relation to base
			var count = file.name.split(path.sep);
			count = count === null ? 0 : count.length - 1;

			// relName is equal to targetName at the base dir
			f.relName = f.targetName;

			// For each directory in depth of current file add a ../ to the relative filename of this link
			while (count > 0) {
				f.relName = '../' + f.relName;
				count--;
			}

		});

		var title = options.title;

		if (!title) {
			title = pkg && pkg.name || 'Title Not Set'
		}

		var compileOptions = _.extend({}, file, {
			title:        title,
			allSymbols:   allSymbols,
			files:        files,
			currentName:  file.name
		});

		var compiled = compile(compileOptions);
		fs.writeFileSync(path.join(target, file.targetName), compiled);
	});


}
