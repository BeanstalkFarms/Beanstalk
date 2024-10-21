import { EnvDexSettings } from ".";

export const DevSettings: EnvDexSettings = {
  PRODUCTION: false,
  WELLS_ORIGIN_BLOCK: parseInt(import.meta.env.VITE_WELLS_ORIGIN_BLOCK) || 17977922,
  LOAD_HISTORY_FROM_GRAPH: !!parseInt(import.meta.env.VITE_LOAD_HISTORY_FROM_GRAPH) || false
};
