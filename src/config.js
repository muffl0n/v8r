import { cosmiconfig } from "cosmiconfig";
import decamelize from "decamelize";
import { createRequire } from "module";
import path from "path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import logging from "./logging.js";

async function validateConfig(config) {
  // TODO
  return config;
}

async function getCosmiConfig() {
  const configFile = (await cosmiconfig("v8r").search()) || { config: {} };
  if (configFile.filepath) {
    logging.info(`Loaded config file from ${getRelativeFilePath(configFile)}`);
  } else {
    logging.info(`No config file found`);
  }
  const config = await validateConfig(configFile);
  return config;
}

function mergeConfigs(args, config) {
  const mergedConfig = { ...args };
  mergedConfig.cacheName = config.cacheName;
  mergedConfig.customCatalog = config.customCatalog;
  return mergedConfig;
}

function getRelativeFilePath(config) {
  return path.relative(process.cwd(), config.filepath);
}

function parseArgs(argv, config) {
  const parser = yargs(hideBin(argv));

  let command = "$0 <patterns..>";
  const patternsOpts = {
    describe:
      "One or more filenames or glob patterns describing local file or files to validate",
  };
  if (Object.keys(config.config).includes("patterns")) {
    command = "$0 [patterns..]";
    patternsOpts.default = config.config.patterns;
    patternsOpts.defaultDescription = `${JSON.stringify(
      config.config.patterns
    )} (from config file ${getRelativeFilePath(config)})`;
  }

  parser
    .command(
      command,
      "Validate local json/yaml files against schema(s)",
      (yargs) => {
        yargs.positional("patterns", patternsOpts);
      }
    )
    .version(
      // Workaround for https://github.com/yargs/yargs/issues/1934
      // TODO: remove once fixed
      createRequire(import.meta.url)("../package.json").version
    )
    .option("verbose", {
      alias: "v",
      type: "boolean",
      description: "Run with verbose logging. Can be stacked e.g: -vv -vvv",
    })
    .count("verbose")
    .option("schema", {
      alias: "s",
      type: "string",
      describe:
        "Local path or URL of a schema to validate against. " +
        "If not supplied, we will attempt to find an appropriate schema on " +
        "schemastore.org using the filename. If passed with glob pattern(s) " +
        "matching multiple files, all matching files will be validated " +
        "against this schema",
    })
    .option("catalogs", {
      type: "string",
      alias: "c",
      array: true,
      describe:
        "Local path or URL of custom catalogs to use prior to schemastore.org",
    })
    .conflicts("schema", "catalogs")
    .option("ignore-errors", {
      type: "boolean",
      default: false,
      describe:
        "Exit with code 0 even if an error was encountered. Passing this flag " +
        "means a non-zero exit code is only issued if validation could be " +
        "completed successfully and one or more files were invalid",
    })
    .option("cache-ttl", {
      type: "number",
      default: 600,
      describe:
        "Remove cached HTTP responses older than <cache-ttl> seconds old. " +
        "Passing 0 clears and disables cache completely",
    });

  for (const [key, value] of Object.entries(config.config)) {
    if (["cacheTtl", "ignoreErrors", "verbose"].includes(key)) {
      parser.default(
        decamelize(key, { separator: "-" }),
        value,
        `${value} (from config file ${getRelativeFilePath(config)})`
      );
    }
  }

  return parser.argv;
}

async function getConfig(argv) {
  const config = await getCosmiConfig();
  const args = parseArgs(argv, config);
  return mergeConfigs(args, config);
}

export { getConfig };
