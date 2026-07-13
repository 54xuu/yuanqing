import packageJson from '../package.json';

/** Semver from package.json, e.g. "1.8" */
export const APP_VERSION = packageJson.version;

/** UI label shown next to the logo, e.g. "v1.8" */
export const APP_VERSION_LABEL = `v${packageJson.version}`;
