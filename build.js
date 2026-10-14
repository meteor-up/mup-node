var spawn = require('child_process').spawn;
var path = require('path');
var tar = require('tar');
var mkdirp = require('mkdirp');
var rimraf = require('rimraf');
var containsPath = require('contains-path');
var ignore = require('ignore');
var fs = require('fs');

function cleanTmp(tmpPath) {
  try {
    mkdirp.sync(tmpPath);
  } catch (e) {
    console.log(e);
  }

  rimraf.sync(path.join(tmpPath, '*'));
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    let executable = command;
    let finalArgs = args;
    const isWin = /^win/.test(process.platform);
    if (isWin) {
      // Sometimes cmd.exe is not available in the path
      // See: http://goo.gl/ADmzoD
      finalArgs = ['/c', executable].concat(args);
      executable = process.env.comspec || 'cmd.exe';
    }
    var child = spawn(executable, finalArgs, { cwd, stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });
}

function tarDirectory(srcDir, bundlePath) {
  return tar.c({
    file: bundlePath,
    cwd: srcDir,
    portable: true,
    gzip: { level: 9 }
  }, ['.']);
}

function buildWithTar(appPath, tmpPath, api, bundlePath) {
  const ig = ignore();
  const ignorePath = api.resolvePath(appPath, '.mupignore');
  if (fs.existsSync(ignorePath)) {
    ig.add(fs.readFileSync(ignorePath).toString())
  }

  return new Promise((resolve, reject) => {
    tar.c({
      file: bundlePath,
      onwarn(message, data) { console.log(message, data)},
      cwd: path.resolve(api.getBasePath(), appPath),
      portable: true,
      gzip: {
        level: 9
      },
      filter(itemPath, stat) {
        if (containsPath(itemPath, './.git')) {
          return false;
        } else if (containsPath(itemPath, './node_modules')) {
          return false;
        }

        // Since itemPath usually starts with "./", we resolve it first so it isn't relative to the cwd
        const relativePath = path.relative(appPath, path.resolve(appPath, itemPath));
        if (relativePath.length === 0) {
          return true;
        }

        const result = !ig.ignores(relativePath);

        return result;
      }
    }, ['.'], (err) => {
      if (err) {
        console.log('err bundling');
        console.log(err);
        reject(err);
      } else {
        resolve();
      }
    })
  });
}

async function buildWithPnpmDeploy(appPath, tmpPath, api, bundlePath) {
  const appDir = path.resolve(api.getBasePath(), appPath);
  const srcDir = path.join(tmpPath, 'bundle-src');

  await run('pnpm', ['deploy', '--filter', './', srcDir], appDir);
  await tarDirectory(srcDir, bundlePath);
}

module.exports = function (appPath, tmpPath, api, bundleMethod) {
  cleanTmp(tmpPath);
  var bundlePath = api.resolvePath(tmpPath, 'bundle.tar.gz');

  if (bundleMethod === 'pnpm-deploy') {
    return buildWithPnpmDeploy(appPath, tmpPath, api, bundlePath);
  }

  if (bundleMethod === 'prebuilt') {
    return tarDirectory(path.resolve(api.getBasePath(), appPath), bundlePath);
  }

  return buildWithTar(appPath, tmpPath, api, bundlePath);
}
