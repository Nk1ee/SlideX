import { createValTownRendererHandler } from './src/integrations/valtownRenderer.js';

function readEnvironment(name: string): string | undefined {
  return Deno.env.get(name);
}

export default createValTownRendererHandler({ readEnvironment });
