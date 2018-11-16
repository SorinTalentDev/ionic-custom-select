let gulp = require('gulp'),
  childProcess = require('child_process'),
  _ = require('lodash'),
  uglify = require('gulp-uglify-es').default,
  rename = require('gulp-rename'),
  jsonEditor = require('gulp-json-editor'),
  fs = require('fs'),
  sass = require('gulp-sass');

let packageJson = JSON.parse(fs.readFileSync('./package.json')),
  paths = {
    gulp: 'node_modules/gulp/bin/gulp.js',
    ngPackagr: 'node_modules/ng-packagr/cli/main.js',
    images: {
      root: 'images/'
    },
    src: {
      css: `src/app/components/${packageJson.name}/${packageJson.name}.component.scss`
    },
    dist: {
      root: 'dist/',
      package: 'dist/package.json',
      bundles: {
        root: 'dist/bundles/',
        file: `dist/bundles/${packageJson.name}.umd.js`,
        mapFile: `dist/bundles/${packageJson.name}.umd.js.map`,
        minFile: `${packageJson.name}.umd.min.js`
      },
      esm5: {
        root: 'dist/esm5/',
        file: `dist/esm5/${packageJson.name}.js`,
        minFile: `${packageJson.name}.min.js`
      },
      esm2015: {
        root: 'dist/esm2015/',
        file: `dist/esm2015/${packageJson.name}.js`,
        minFile: `${packageJson.name}.min.js`
      }
    }
  };

function executeCommand(command, parameters) {
  if (command === 'gulp') {
    command = paths.gulp;
  } else if (command === 'ng-packagr') {
    command = paths.ngPackagr;
  }

  var _parameters = _.cloneDeep(parameters);
  _parameters.unshift(command);

  childProcess.spawnSync('node', _parameters, { stdio: 'inherit' });
}

function copyCss() {
  return Promise.all([
    new Promise(function (resolve, reject) {
      // Copy original SCSS file to "module" folder from package.json.
      // That's where Ionic will be looking for it.
      fs.createReadStream(paths.src.css).pipe(
        fs.createWriteStream(`${paths.dist.esm5.root}${packageJson.name}.component.scss`)
          .on('error', reject)
          .on('close', resolve)
      );
    }),
    new Promise(function (resolve, reject) {
      gulp.src(paths.src.css)
        // This is to create a minified CSS file in order to use in StackBlitz demos.
        // The minified file isn't required for component to work.
        .pipe(sass({
          outputStyle: 'compressed'
        }))
        .pipe(rename(`${packageJson.name}.component.min.css`))
        .pipe(gulp.dest(paths.dist.esm5.root))
        .on('error', reject)
        .on('end', resolve);
    })
  ]);
}

function copyImages() {
  return new Promise(function (resolve, reject) {
    gulp.src(`${paths.images.root}**/*`)
      .pipe(gulp.dest(`${paths.dist.root}${paths.images.root}`))
      .on('error', reject)
      .on('end', resolve);
  });
}

function minifyJS() {
  // Minify files.
  return Promise.all([
    new Promise(function (resolve, reject) {
      gulp.src(paths.dist.esm5.file)
        .pipe(uglify())
        .on('error', reject)
        .pipe(rename(paths.dist.esm5.minFile))
        .pipe(gulp.dest(paths.dist.esm5.root))
        .on('error', reject)
        .on('end', resolve);
    }),
    new Promise(function (resolve, reject) {
      gulp.src(paths.dist.esm2015.file)
        .pipe(uglify())
        .on('error', reject)
        .pipe(rename(paths.dist.esm2015.minFile))
        .pipe(gulp.dest(paths.dist.esm2015.root))
        .on('error', reject)
        .on('end', resolve);
    })
  ]).then(function () {
    // Remove source files.
    fs.unlinkSync(paths.dist.bundles.file);
    fs.unlinkSync(paths.dist.bundles.mapFile);
    fs.unlinkSync(paths.dist.esm5.file);
    fs.unlinkSync(paths.dist.esm2015.file);
  });
}

function modifyPackageJson() {
  return new Promise(function (resolve, reject) {
    gulp.src(paths.dist.package)
      .pipe(jsonEditor(function (json) {
        json.main = `bundles/${paths.dist.bundles.minFile}`;
        json.module = `esm5/${paths.dist.esm5.minFile}`;
        json.es2015 = `esm2015/${paths.dist.esm2015.minFile}`;
        delete json.cordova;
        delete json.devDependencies;
        delete json.dependencies;
        return json;
      }))
      .pipe(gulp.dest(paths.dist.root))
      .on('error', reject)
      .on('end', resolve);
  });
}

gulp.task('build', function () {
  executeCommand('ng-packagr', ['-p', 'ng-package.json']);

  minifyJS().then(function () {
    modifyPackageJson().then(function () {
      copyCss().then(function () {
        copyImages().then(function () {
          // Remove archive created by ng-packagr.
          fs.unlinkSync('dist.tgz');
        });
      });
    });
  });
});

gulp.task('default', ['build']);
