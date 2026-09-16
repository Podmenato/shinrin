import { query } from '$app/server';
import { listAllModelOptions } from '#lib/server/modelProviders/providerRegistry.js';

/** Every provider's currently selectable models, grouped by provider — see listAllModelOptions. */
export const getModelOptions = query(listAllModelOptions);
