var handlers = require('./command-handlers');
var validator = require('./validate.js');

function onlyNodeEnabled(commandName) {
  return function (api) {
    var appConfig = api.getConfig().app;

    if (appConfig && appConfig.type === 'node') {
      return api.runCommand(commandName);
    }
  }
}

function setDefault(obj, path, value) {
  var position = obj;

  path.reduce((position, property, index) => {
    if (index === path.length - 1) {
      if (typeof position[property] === 'undefined') {
        position[property] = value;
      }
    } else {
      position[property] = position[property] || {};

      return position[property];
    }
  }, obj);

  return obj;
}

module.exports = {
  name: 'node',
  description: 'Deploy node.js apps',
  commands: {
    setup: {
      description: 'Setup node.js',
      handler: handlers.setup
    },
    deploy: {
      description: 'Deploy app',
      handler: handlers.deploy
    },
    reconfig: {
      description: 'Reconfig app',
      handler: handlers.reconfig
    },
    start: {
      description: 'Start app',
      handler: handlers.start
    },
    stop: {
      description: 'Stop app',
      handler: handlers.stop
    },
    logs: {
      description: 'View app\'s logs',
      handler: handlers.logs
    },
    destroy: {
      description: 'Remove app from server',
      handler: handlers.destroy,
      builder(subYargs) {
        return subYargs.option('force', {
          description: 'forces app to be removed',
          boolean: true
        });
      }
    },
    // hidden commands
    build: {
      description: false,
      handler: handlers.build
    },
    push: {
      description: false,
      handler: handlers.push
    },
    debug: {
      name: 'debug [server]',
      description: 'Debug the meteor app',
      builder(yargs) {
        yargs.strict(false);
      },
      handler: handlers.debugApp
    }
  },
  hooks: {
    'post.default.setup': onlyNodeEnabled('node.setup'),
    'post.default.reconfig': onlyNodeEnabled('node.reconfig'),
    'post.default.deploy': onlyNodeEnabled('node.deploy'),
    'post.default.logs': onlyNodeEnabled('node.logs'),
    'post.default.start': onlyNodeEnabled('node.start'),
    'post.default.stop': onlyNodeEnabled('node.stop')
  },
  prepareConfig(config) {
    var appConfig = config.app;

    if (!appConfig || appConfig.type !== 'node') {
      return config;
    }


    setDefault(appConfig, ['env', 'NODE_ENV'], 'production');
    setDefault(appConfig, ['env', 'PORT'], 80);

    setDefault(appConfig, ['docker', 'buildInstructions'], []);

    setDefault(appConfig, ['startScript'], 'start');
    setDefault(appConfig, ['nodeVersion'], 'latest');
    setDefault(appConfig, ['deployCheckWaitTime'], 60);
    setDefault(appConfig, ['bundleMethod'], 'tar');

    return config;
  },
  validate: {
    app(config, utils) {
      if (config.app && config.app.type === 'node') {
        return validator(config, utils);
      }
      return [];
    }
  }
}
