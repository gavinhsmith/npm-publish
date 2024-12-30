import os from "node:os";

import * as errors from "./errors.js";
import type { PackageManifest } from "./read-manifest.js";
import {
  ACCESS_PUBLIC,
  ACCESS_RESTRICTED,
  STRATEGY_UPGRADE,
  STRATEGY_ALL,
  type Access,
  type Strategy,
  type Options,
  type Logger,
} from "./options.js";

const REGISTRY_NPM = "https://registry.npmjs.org/";
export const TAG_LATEST = "latest";

/** Normalized and sanitized auth, publish, and runtime configurations. */
export interface NormalizedOptions {
  registry: URL;
  token: string;
  tag: ConfigValue<string>;
  access: ConfigValue<Access | undefined>;
  provenance: ConfigValue<boolean>;
  ignoreScripts: ConfigValue<boolean>;
  dryRun: ConfigValue<boolean>;
  strategy: ConfigValue<Strategy>;
  logger: Logger | undefined;
  temporaryDirectory: string;
}

/** A config value, and whether that value differs from default. */
export interface ConfigValue<TValue> {
  value: TValue;
  isDefault: boolean;
}

/**
 * Normalizes and sanitizes options, and fills-in any default values.
 *
 * @param manifest Package metadata from package.json.
 * @param options User-input options.
 * @returns Validated auth and publish configuration.
 */
export function normalizeOptions(
  manifest: PackageManifest,
  options: Options
): NormalizedOptions {
  // Set to default values immediatly, will be updated.

  let defaultTag = TAG_LATEST;
  let defaultRegistry = REGISTRY_NPM;
  let defaultAccess = manifest.scope === undefined ? ACCESS_PUBLIC : undefined;
  let defaultProvenance = false;

  // Only process manifest if forceCommandLineOptions = false.
  if (
    options.forceCommandLineOptions == undefined ||
    !options.forceCommandLineOptions
  ) {
    defaultTag = manifest.publishConfig?.tag ?? defaultTag;
    defaultRegistry = manifest.publishConfig?.registry ?? defaultRegistry;
    defaultAccess = manifest.publishConfig?.access ?? defaultAccess;
    defaultProvenance = manifest.publishConfig?.provenance ?? defaultProvenance;
  }

  return {
    token: validateToken(options.token),
    registry: validateRegistry(options.registry ?? defaultRegistry),
    tag: setValue(options.tag, defaultTag, validateTag),
    access: setValue(options.access, defaultAccess, validateAccess),
    provenance: setValue(options.provenance, defaultProvenance, Boolean),
    ignoreScripts: setValue(options.ignoreScripts, true, Boolean),
    dryRun: setValue(options.dryRun, false, Boolean),
    strategy: setValue(options.strategy, STRATEGY_ALL, validateStrategy),
    logger: options.logger,
    temporaryDirectory: options.temporaryDirectory ?? os.tmpdir(),
  };
}

const setValue = <TValue>(
  value: unknown,
  defaultValue: unknown,
  validate: (value: unknown) => TValue
): ConfigValue<TValue> => ({
  value: validate(value ?? defaultValue),
  isDefault: value === undefined,
});

const validateToken = (value: unknown): string => {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new errors.InvalidTokenError();
};

const validateRegistry = (value: unknown): URL => {
  try {
    return new URL(value as string | URL);
  } catch {
    throw new errors.InvalidRegistryUrlError(value);
  }
};

const validateTag = (value: unknown): string => {
  if (typeof value === "string") {
    const trimmedValue = value.trim();
    const encodedValue = encodeURIComponent(trimmedValue);

    if (trimmedValue.length > 0 && trimmedValue === encodedValue) {
      return value;
    }
  }

  throw new errors.InvalidTagError(value);
};

const validateAccess = (value: unknown): Access | undefined => {
  if (
    value === undefined ||
    value === ACCESS_PUBLIC ||
    value === ACCESS_RESTRICTED
  ) {
    return value;
  }

  throw new errors.InvalidAccessError(value);
};

const validateStrategy = (value: unknown): Strategy => {
  if (value === STRATEGY_ALL || value === STRATEGY_UPGRADE) {
    return value;
  }

  throw new errors.InvalidStrategyError(value);
};
