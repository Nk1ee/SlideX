import { createValTownRendererHandler } from '../../src/integrations/valtownRenderer.js';

type DenoEnvironment = {
  env: {
    get(name: string): string | undefined;
  };
};

function readEnvironment(name: string): string | undefined {
  const deno = (globalThis as typeof globalThis & { Deno?: DenoEnvironment }).Deno;
  return deno?.env.get(name);
}

export default createValTownRendererHandler({ readEnvironment });
