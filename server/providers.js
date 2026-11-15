// Provider labels the IRIS production may return. The fallback label means the image has no
// AI Hub and a deterministic, non-LLM agent prepared the proposal; the gate and workflow still decide.
export const IRIS_AI_HUB = 'InterSystems IRIS AI Hub';
export const IRIS_FALLBACK = 'fallback (no AI Hub)';
export const IRIS_PROVIDERS = [IRIS_AI_HUB, IRIS_FALLBACK];
export const isIrisProvider = (value) => IRIS_PROVIDERS.includes(value);
