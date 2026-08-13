import Rcon from "rcon-srcds";
import { config } from "./config";
import { audit } from "./audit";
import { parsePlayers, parsePlugins, parseStatus } from "./parse";
import type { DashboardData } from "./types";

class RconService {
  private client: Rcon | null = null;
  private connecting: Promise<Rcon> | null = null;
  private commandQueue: Promise<void> = Promise.resolve();

  private async getClient() {
    if (this.client?.isConnected() && this.client.isAuthenticated())
      return this.client;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const client = new Rcon({
        host: config.RCON_HOST,
        port: config.RCON_PORT,
        encoding: "utf8",
        timeout: 2500,
      });
      const authenticated = await client.authenticate(config.RCON_PASSWORD);
      if (!authenticated) throw new Error("RCON authentication failed");
      this.client = client;
      return client;
    })();
    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async executeNow(command: string) {
    const client = await this.getClient();
    const started = Date.now();
    try {
      const result = await client.execute(command);
      const response = typeof result === "string" ? result : "";
      await audit("command", {
        command,
        response: response.slice(0, 2000),
        latencyMs: Date.now() - started,
      });
      return response;
    } catch (error) {
      this.client = null;
      await audit("command_error", {
        command,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  execute(command: string) {
    const result = this.commandQueue.then(() => this.executeNow(command));
    this.commandQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async dashboard(): Promise<DashboardData> {
    const started = Date.now();
    try {
      const statusRaw = await this.execute("status");
      // Keep commands sequential because Source RCON responses may arrive in
      // multiple packets and some clients cannot safely multiplex them.
      const pluginsRaw = await this.execute("css_plugins list");
      const metaVersionRaw = await this.execute("meta version");
      const metaPluginsRaw = await this.execute("meta list");
      const metaRaw = `${metaVersionRaw}\n${metaPluginsRaw}`;
      return {
        connected: true,
        latencyMs: Date.now() - started,
        status: parseStatus(statusRaw),
        players: parsePlayers(statusRaw),
        plugins: parsePlugins(pluginsRaw),
        meta: metaRaw,
      };
    } catch (error) {
      return {
        connected: false,
        latencyMs: null,
        status: null,
        players: [],
        plugins: [],
        meta: "",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const rcon = new RconService();
