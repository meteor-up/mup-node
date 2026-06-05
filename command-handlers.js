var builder = require('./build');
var random = require('random-seed');
var uuid = require('uuid');
var os = require('os');
var path = require('path');
var utils = require('./utils');

function tmpBuildPath(appPath, api) {
  var rand = random.create(appPath);
  var uuidNumbers = [];
  for (var i = 0; i < 16; i++) {
    uuidNumbers.push(rand(255));
  }

  return api.resolvePath(
    os.tmpdir(),
    `mup-node-${uuid.v4({ random: uuidNumbers })}`
  );
}

module.exports = {
  setup(api, nodemiral) {
    var appConfig = api.getConfig().app;

    if (!appConfig) {
      console.error('error: no configs found for app');
      process.exit(1);
    }

    var list = nodemiral.taskList('Setup App');

    list.executeScript('Setup Environment', {
      script: api.resolvePath(__dirname, 'assets/setup.sh'),
      vars: {
        name: appConfig.name
      }
    });

    var sessions = api.getSessions(['app']);

    return api.runTaskList(list, sessions, { verbose: api.verbose });
  },
  build(api) {
    var appConfig = api.getConfig().app;

    return builder(appConfig.path, tmpBuildPath(appConfig.path, api), api, appConfig.bundleMethod);
  },
  push(api, nodemiral) {
    var {
      app: appConfig,
      privateDockerRegistry
    } = api.getConfig();
    var tmpPath = tmpBuildPath(appConfig.path, api);
    var list = nodemiral.taskList('Pushing App');
    var sessions = api.getSessions(['app']);
    var npmScripts = utils.npmScripts(api, appConfig.path);
    var postInstallScript = 'mup:postinstall' in npmScripts;
    var startScript = 'start' in npmScripts;
    var packageLock = utils.hasPackageLock(api, appConfig.path);

    if (!startScript) {
      console.log('package.json is missing start script.');
    }

    list.copy('Pushing App bundle to the Server', {
      src: path.resolve(tmpPath, 'bundle.tar.gz'),
      dest: `/opt/${appConfig.name}/tmp/bundle.tar.gz`,
      progressBar: true
    });

    list.executeScript('Build Image', {
      script: api.resolvePath(__dirname, 'assets/build-image.sh'),
      vars: {
        appName: appConfig.name,
        nodeVersion: appConfig.nodeVersion,
        env: appConfig.env,
        startScript: appConfig.startScript,
        buildInstructions: appConfig.docker.buildInstructions,
        postInstallScript: postInstallScript,
        packageLock,
        prebuiltDependencies: appConfig.bundleMethod === 'pnpm-deploy',
        privateRegistry: privateDockerRegistry,
        imagePrefix: utils.getImagePrefix(privateDockerRegistry),
        imageName: utils.getImageName(appConfig)
      }
    });

    return api.runTaskList(list, sessions, {
      series: true,
      verbose: api.verbose,
    });
  },
  reconfig(api, nodemiral) {
    var list = nodemiral.taskList('Configuring App');
    var {
      servers,
      app: appConfig,
      privateDockerRegistry,
    } = api.getConfig();

    var env = appConfig.env;
    var publishedPort = env.PORT || 80;
    var exposedPort = appConfig.docker.imagePort || 3000;

    env.PORT = exposedPort;

    const hostVars = {};

    Object.keys(appConfig.servers).forEach(key => {
      if (appConfig.servers[key].env) {
        const host = servers[key].host;
        hostVars[host] = {
          env: {
            ...appConfig.servers[key].env,
          }
        };
      }
    });

    list.copy('Sending Environment Variables', {
      src: api.resolvePath(__dirname, 'assets/env.list'),
      dest: `/opt/${appConfig.name}/config/env.list`,
      hostVars,
      vars: {
        env: env,
        appName: appConfig.name
      }
    });

    list.copy('Sending Start Script', {
      src: api.resolvePath(__dirname, 'assets/start.sh'),
      dest: `/opt/${appConfig.name}/config/start.sh`,
      vars: {
        appName: appConfig.name,
        docker: appConfig.docker,
        proxyConfig: api.getConfig().proxy,
        exposedPort: exposedPort,
        publishedPort: publishedPort,
        privateRegistry: privateDockerRegistry,
        imagePrefix: utils.getImagePrefix(privateDockerRegistry),
        imageName: utils.getImageName(appConfig)
      }
    })

    var sessions = api.getSessions(['app']);

    return api.runTaskList(list, sessions, {
      series: true,
      verbose: api.verbose
    }).then(() => api.runCommand('node.start'))
  },
  deploy(api) {
    return api.runCommand('node.build')
      .then(() => api.runCommand('node.push'))
      .then(() => api.runCommand('node.reconfig'));
  },
  start(api, nodemiral) {
    var {
      app: appConfig,
      privateDockerRegistry,
    } = api.getConfig();
    var list = nodemiral.taskList('Start App');

    list.executeScript('Starting the app', {
      script: api.resolvePath(__dirname, 'assets/run-start.sh'),
      vars: {
        appName: appConfig.name
      }
    });

    if (appConfig.deployCheckWaitTime !== -1) {
      list.executeScript('Verifying Deployment', {
        script: api.resolvePath(__dirname, 'assets/deploy-check.sh'),
        vars: {
          deployCheckWaitTime: appConfig.deployCheckWaitTime,
          appName: appConfig.name,
          deployCheckPort: appConfig.docker.imagePort || 3000,
          imageName: utils.getImageName(appConfig),
          imagePrefix: utils.getImagePrefix(privateDockerRegistry),
          privateRegistry: privateDockerRegistry
        }
      })
    }

    var sessions = api.getSessions(['app']);

    return api.runTaskList(list, sessions, { verbose: api.verbose, series: true });
  },
  stop(api, nodemiral) {
    const appConfig = api.getConfig().app;
    const sessions = api.getSessions(['app']);
    const list = nodemiral.taskList('Stop Meteor');

    list.executeScript('Stop Meteor', {
      script: api.resolvePath(__dirname, 'assets/stop.sh'),
      vars: {
        appName: appConfig.name
      }
    });

    return api.runTaskList(list, sessions, { verbose: api.verbose });
  },
  async destroy(api, nodemiral) {
    const config = api.getConfig();
    const options = api.getOptions();

    if (!options.force) {
      console.error('The destroy command completely removes the app from the server');
      console.error('If you are sure you want to continue, use the `--force` option');
      process.exit(1);
    } else {
      console.log('The app will be completely removed from the server.');
      console.log('Waiting 5 seconds in case you want to cancel by pressing ctr + c');
      await new Promise(resolve => setTimeout(resolve, 1000 * 5));
    }

    const list = nodemiral.taskList('Destroy App');
    const sessions = api.getSessions(['app']);

    if (api.swarmEnabled()) {
      console.error('Destroying app when using swarm is not implemented');
      process.exit(1);
    }

    list.executeScript('Stop App', {
      script: api.resolvePath(__dirname, 'assets/stop.sh'),
      vars: {
        appName: config.app.name
      }
    });

    list.executeScript('Destroy App', {
      script: api.resolvePath(__dirname, 'assets/destroy.sh'),
      vars: {
        name: config.app.name
      }
    });

    return api.runTaskList(list, sessions, {
      series: true,
      verbose: api.verbose
    });
  },
  logs(api) {
    var appConfig = api.getConfig().app;
    var args = api.getArgs();
    if (args[0] === 'node') {
      args.shift();
    }

    var sessions = api.getSessions(['app']);

    return api.getDockerLogs(appConfig.name, sessions, args);
  },
  async debugApp(api) {
    const {
      servers,
      app
    } = api.getConfig();
    let serverOption = api.getArgs()[2];

    // Check how many sessions are enabled. Usually is all servers,
    // but can be reduced by the `--servers` option
    const enabledSessions = api.getSessions(['app'])
      .filter(session => session);

    if (!(serverOption in app.servers)) {
      if (enabledSessions.length === 1) {
        const selectedHost = enabledSessions[0]._host;
        serverOption = Object.keys(app.servers).find(
          name => servers[name].host === selectedHost
        );
      } else {
        console.log('mup node debug <server>');
        console.log('Available servers are:\n', Object.keys(app.servers).join('\n '));
        process.exitCode = 1;

        return;
      }
    }

    const server = servers[serverOption];
    console.log(`Setting up to debug app running on ${serverOption}`);

    const {
      output
    } = await api.runSSHCommand(server, `docker exec -t ${app.name} sh -c 'kill -s USR1 $(pidof -s node)'`);

    // normally is blank, but if something went wrong
    // it will have the error message
    console.log(output);

    const {
      output: startOutput
    } = await api.runSSHCommand(server, `sudo docker rm -f node-debug; sudo docker run -d --name node-debug --network=container:${app.name} alpine/socat TCP-LISTEN:9228,fork TCP:127.0.0.1:9229`);
    if (api.getVerbose()) {
      console.log('output from starting node-debug', startOutput);
    }

    const {
      output: ipAddress
    } = await api.runSSHCommand(server, `sudo docker inspect --format="{{ range .NetworkSettings.Networks }} {{.IPAddress }} {{ end }}" ${app.name} | head -n 1`);

    if (api.getVerbose()) {
      console.log('container address', ipAddress);
    }

    const {
      output: startOutput2
    } = await api.runSSHCommand(server, `sudo docker rm -f node-debug-2; sudo docker run -d --name node-debug-2 -p 9227:9227 alpine/socat TCP-LISTEN:9227,fork TCP:${ipAddress.trim()}:9228`);

    if (api.getVerbose()) {
      console.log('output from starting node-debug-2', startOutput2);
    }

    let loggedConnection = false;

    api.forwardPort({
      server,
      localAddress: '0.0.0.0',
      localPort: 9229,
      remoteAddress: '127.0.0.1',
      remotePort: 9227,
      onError(error) {
        console.error(error);
      },
      onReady() {
        console.log('Connected to server');
        console.log('');
        console.log('Debugger listening on ws://127.0.0.1:9229');
        console.log('');
        console.log('To debug:');
        console.log('1. Open chrome://inspect in Chrome');
        console.log('2. Select "Open dedicated DevTools for Node"');
        console.log('3. Wait a minute while it connects and loads the app.');
        console.log('   When it is ready, the app\'s files will appear in the Sources tab');
        console.log('');
        console.log('Warning: Do not use breakpoints when debugging a production server.');
        console.log('They will pause your server when hit.');
        console.log('Use logpoints or something else that does not pause the server');
        console.log('');
        console.log('The debugger will be enabled until the next time the app is restarted,');
        console.log('though only accessible while this command is running');
      },
      onConnection() {
        if (!loggedConnection) {
          // It isn't guaranteed the debugger is connected, but not many
          // other tools will try to connect to port 9229.
          console.log('');
          console.log('Detected by debugger');
          loggedConnection = true;
        }
      }
    });
  }
}
