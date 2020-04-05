import { debug as coreDebug, error as coreError, getInput, setFailed } from '@actions/core';
import { safeLoad } from 'js-yaml';
import { readFileSync } from 'fs';
import { which } from '@actions/io';
import { exec } from '@actions/exec';

import { GalaxyConfig } from './types';
import { Collection } from './Collection';
import { ExitCodes } from './enums';
import { validateSync } from 'class-validator';

try {
  const apiKey = getInput('api_key', { required: true });
  const galaxy_config_file = getInput('galaxy_config_file') || process.env.INPUT_GALAXY_API_KEY!;
  const galaxy_config: GalaxyConfig = safeLoad(readFileSync(galaxy_config_file, 'utf8'));

  const collection = new Collection(galaxy_config, apiKey);

  const validationErrors = validateSync(collection);
  if (validationErrors.length > 0) {
    const errorMessages = validationErrors.map(error => error.constraints);
    errorMessages.forEach(error => coreError(JSON.stringify(error)));
    setFailed(
      'This action encountered validation failures. Inspect the output for all validation errors.',
    );
    process.exit(ExitCodes.ValidationFailed);
  }

  coreDebug(`Building collection ${collection}`);
  collection
    .publish(which, exec)
    .then(() => coreDebug(`Successfully published ${collection} to Ansible Galaxy.`))
    .catch(({ message }: Error) => {
      setFailed(message);
      process.exit(ExitCodes.DeployFailed);
    });
} catch (error) {
  setFailed(error.message);
}