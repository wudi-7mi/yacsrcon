import "server-only";
import { z } from "zod";
import { runAdminHelper } from "./admin-config.ts";
import { parsePlugins } from "./parse.ts";
import { buildPluginCenter } from "./plugin-catalog.ts";
import { rcon } from "./rcon.ts";

const directoriesSchema = z.object({
  active: z.array(z.string()),
  disabled: z.array(z.string()),
});

export async function readPluginCenter() {
  const [{ stdout }, runtime] = await Promise.all([
    runAdminHelper("plugins"),
    rcon.executeInternal("css_plugins list").then(parsePlugins),
  ]);
  return buildPluginCenter(directoriesSchema.parse(JSON.parse(stdout)), runtime);
}
