var joi = require('joi');

var schema = joi.object().keys({
  name: joi.string().min(1).required(),
  path: joi.string().min(1).required(),
  type: joi.string().required(),
  nodeVersion: joi.string(),
  servers: joi.object().required().pattern(
    /[/s/S]*/,
    joi.object().keys()
  ),
  env: joi.object().pattern(
    /[/s/S]*/,
    [joi.string().allow(""), joi.number(), joi.bool()]
  ),
  startScript: joi.string(),
  bundleMethod: joi.string().valid('tar', 'pnpm-deploy'),
  docker: joi.object().keys({
    args: joi.array().items(joi.string()),
    networks: joi.array().items(joi.string()),
    buildInstructions: joi.array().items(joi.string()),
    imagePort: joi.number(),
    imageName: joi.string(),
  }),
  deployCheckWaitTime: joi.number()
});

module.exports = function (config, utils) {
  var details = []

  details = utils.combineErrorDetails(
    details,
    joi.validate(config.app, schema, utils.VALIDATE_OPTIONS)
  );

  details = utils.combineErrorDetails(
    details,
    utils.serversExist(config.servers, config.app.servers)
  );

  return details;
}
