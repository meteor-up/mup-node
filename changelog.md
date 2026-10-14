## 0.10.0 October 14, 2026
- Add `prebuilt` bundle method

## 0.9.0 June 4, 2026

- Add `bundleMethod` option. Can be set to `pnpm-deploy` to bundle the app with `pnpm deploy` 

## 0.8.2 April 20, 2022

- Update tar

## 0.8.1 July 7, 2021

- Allow overriding env for specific servers, similar to how mup does it for Meteor apps

## 0.8.0 October 23, 2020

- Add `mup node debug` command. This lets you connect your local Node dev tools, for example those in Chrome, to your Node app running on the server.

## 0.7.1 May 6, 2020

- Support load balancing with Mup 1.5

## 0.7.0 March 23, 2020

- Adds support for the `privateDockerRegistry` option
- Adds `mup node destroy` command to remove app from the servers

## 0.6.0 July 5, 2019

- `.mupignore` file can be used to exclude files and folders from being bundled
- Add `app.docker.imagePort` option, which works the same as in Meteor Up for meteor apps
- Remove validation warning for empty environment variables
- Fix plugin modifying config when app type was not 'node'

## 0.5.0 August 23, 2018

- **Breaking Change** Environment variables from config are set when building the docker image. Due to this, dev dependencies will no longer be installed by default.
- Copy package-lock.json into the docker container before installing dependencies
- Update instructions to include adding `mup-node` to the array of plugins

## 0.4.0 April 2, 2018

- Allow disabling Verifying Deployment
- Show warning when package.json is missing a start script
- Fix start task succeeding despite errors starting the container

## 0.3.0 - March 9, 2018

- Run the npm script `mup:postinstall` when building the image, if it exists

## 0.2.1 - March 7, 2018

- Fix setting default value for `docker.buildInstructions`

## 0.2.0 - March 7, 2018

- Add options to customize image
- Show defaults in config when `mup validate --show` is run
