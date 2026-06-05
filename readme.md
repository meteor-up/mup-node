# mup-node plugin

Deploy your Node.js apps with Meteor Up!

This plugin is under development and is missing some features.

## Getting started

First, install mup and mup-node with:

```bash
npm i -g mup mup-node
```

Second, create a config with
``bash
mup init
``

Open the config, and make the following adjustments:

For each server:
- host - Usually is the IP Address of the server
- server authentication - You can use a password or set pem to the path to a private key. If neither are set, it uses ssh-agent

In the `app` section:

- name: A unique name, with no spaces
- path: Path to the app, relative to the config.
- type: Set to `node` to let mup know that this plugin will manage the app

Add a `plugins` array with `mup-node`:

```js
module.exports = {
  // ... rest of config
  plugins: [ 'mup-node' ]
};
```

Third, setup the server. Mup will install everything needed to run the app. Run:

```bash
mup setup
```

Fourth, deploy the app. Run

```bash
mup deploy
```

Mup will upload your app, build a docker container, and run it.

## Bundling

`mup-node` copies the app's files to the server. The `.git` and `node_module` directories are ignored.Additional directories can be ignored by creating a `.mupignore` file in your app's root folder. `.mupignore` uses the same syntax as `.gitignore`.

An alternative bundling method is to use `pnpm deploy`, by setting the option `app.bundleMethod` to `pnpm-deploy` (the default is `tar`, with the behavior described above). With `pnpm deploy`, all of the npm dependencies are included in the bundle, which could cause problems for native dependencies.


## Building Image

The base image is `node:<node version>`. As long as the package.json doesn't change, the `node_modules` is cached between deploys.

You can add instructions to the Dockerfile in the config at `app.docker.buildInstructions`. For more details, look at the example in the next section.

If your package.json has a `mup:postinstall` script, it will be run after `npm install`.

## Options

`mup-node` is configured with the `app` object in your config. The available options are:

```js
module.exports = {
  app: {
    name: 'name-of-app',
    path: '../path/to/app',
    type: 'node',
    nodeVersion: '8.8.1',
    servers: {
      one: {},
      two: {}
    },
    env: {
      MONGO_URL: 'mongodb://localhost:8000',
      // Port the app is available on, defaults to 80
      PORT: 5000
    },
    // Amount of time to allow the app to start. If the app isn't running within this
    // much time, mup rolls back to the previous version. Set to -1 to disable.
    deployCheckWaitTime: 60,
    // NPM script to run when starting the app
    startScript: 'start:production',
    // How the deployment bundle is created. Can be 'tar' (default) or 'pnpm-deploy'
    bundleMethod: 'tar',
    docker: {
      args: ['--network=net'],
      networks: ['net2', 'net3'],
      // Dockerfile instructions to run before adding the app and running `npm install`
      buildInstructions: [
        // Copy some of the app's files needed for the post-install script
        'COPY ./scripts ./scripts',
        'RUN apt-get update && apt-get install libcairo2-dev libjpeg-dev libpango1.0-dev libgif-dev build-essential g++ -y',
      ],
      // Port expose from the container. This does not affect the port the app is accessed on. Default is 3000
      imagePort: 3000
    }
  },
  plugins: [ 'mup-node' ]
};
```
