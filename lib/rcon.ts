import Rcon from "rcon-srcds";
import { config } from "./config.ts";
import { audit } from "./audit.ts";
import { parsePlayers, parsePlugins, parseStatus } from "./parse.ts";
import type { DashboardData } from "./types.ts";
import { withTimeout } from "./timeout.ts";

type RconClient = {
  authenticate(password: string): Promise<boolean>;
  execute(command: string): Promise<string | boolean>;
  isConnected(): boolean;
  isAuthenticated(): boolean;
  connected: boolean;
  authenticated: boolean;
  connection?: { destroy(): void };
};

type RconServiceOptions = {
  createClient?: () => RconClient;
  timeoutMs?: number;
  auditEvent?: typeof audit;
};

export class RconService {
  private client: RconClient | null = null;
  private connecting: Promise<RconClient> | null = null;
  private commandQueue: Promise<void> = Promise.resolve();
  private readonly createClient: () => RconClient;
  private readonly timeoutMs: number;
  private readonly auditEvent: typeof audit;

  constructor(options: RconServiceOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? config.RCON_TIMEOUT_MS;
    this.auditEvent = options.auditEvent ?? audit;
    this.createClient =
      options.createClient ??
      (() =>
        new Rcon({
          host: config.RCON_HOST,
          port: config.RCON_PORT,
          encoding: "utf8",
          timeout: this.timeoutMs,
        }));
  }

  private discardClient(client: RconClient) {
    if (this.client === client) this.client = null;
    client.authenticated = false;
    client.connected = false;
    client.connection?.destroy();
  }

  private async recordAudit(action: string, detail: Record<string, unknown>) {
    try {
      await this.auditEvent(action, detail);
    } catch (error) {
      console.error("Audit callback failed:", error);
    }
  }

  private async getClient() {
    if (this.client?.isConnected() && this.client.isAuthenticated())
      return this.client;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const client = this.createClient();
      try {
        const authenticated = await withTimeout(
          client.authenticate(config.RCON_PASSWORD),
          this.timeoutMs,
          "RCON authentication",
          () => this.discardClient(client),
        );
        if (!authenticated) throw new Error("RCON authentication failed");
        this.client = client;
        return client;
      } catch (error) {
        this.discardClient(client);
        throw error;
      }
    })();
    try {
      return await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  private async executeNow(command: string, recordAudit: boolean) {
    const client = await this.getClient();
    const started = Date.now();
    try {
      const result = await withTimeout(
        client.execute(command),
        this.timeoutMs,
        `RCON command ${command.split(/\s+/, 1)[0]}`,
        () => this.discardClient(client),
      );
      const response = typeof result === "string" ? result : "";
      if (recordAudit) {
        void this.recordAudit("command", {
          command,
          response: response.slice(0, 2000),
          latencyMs: Date.now() - started,
        });
      }
      return response;
    } catch (error) {
      this.discardClient(client);
      if (recordAudit) {
        void this.recordAudit("command_error", {
          command,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  execute(command: string) {
    return this.enqueue(command, true);
  }

  executeInternal(command: string) {
    return this.enqueue(command, false);
  }

  private enqueue(command: string, recordAudit: boolean) {
    const result = this.commandQueue.then(() =>
      this.executeNow(command, recordAudit),
    );
    this.commandQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async players() {
    return parsePlayers(await this.executeInternal("status"));
  }

  async dashboard(): Promise<DashboardData> {
    const started = Date.now();
    try {
      const statusRaw = await this.executeInternal("status");
      // Keep commands sequential because Source RCON responses may arrive in
      // multiple packets and some clients cannot safely multiplex them.
      const pluginsRaw = await this.executeInternal("css_plugins list");
      const metaVersionRaw = await this.executeInternal("meta version");
      const metaPluginsRaw = await this.executeInternal("meta list");
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
