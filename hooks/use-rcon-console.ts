"use client";

import { useCallback, useState } from "react";
import { useApiRequest } from "@/hooks/use-api-request";
import { ApiError } from "@/lib/api-client";

type CommandResponse = {
  response?: string;
  error?: string;
  requiresConfirmation?: boolean;
};

function confirmationPayload(error: unknown) {
  if (!(error instanceof ApiError) || error.status !== 409) return false;
  const payload = error.payload;
  return Boolean(
    payload &&
      typeof payload === "object" &&
      "requiresConfirmation" in payload &&
      payload.requiresConfirmation,
  );
}

export function useRconConsole(onExecuted: () => void | Promise<void>) {
  const request = useApiRequest();
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState("$ 已连接到 RCON\n");
  const [confirmCommand, setConfirmCommand] = useState<string | null>(null);

  const sendCommand = useCallback(
    async (value: string, confirmed = false) => {
      const cmd = value.trim();
      if (!cmd) return;
      setCommand("");
      try {
        const body = await request<CommandResponse>("/api/command", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ command: cmd, confirm: confirmed }),
        });
        setOutput((old) => `${old}\n$ ${cmd}\n${body.response ?? ""}`);
        await onExecuted();
      } catch (error) {
        if (confirmationPayload(error)) {
          setConfirmCommand(cmd);
          return;
        }
        setOutput(
          (old) =>
            `${old}\n$ ${cmd}\n${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    [onExecuted, request],
  );

  return {
    command,
    setCommand,
    output,
    sendCommand,
    confirmCommand,
    cancelConfirmation: () => setConfirmCommand(null),
    confirmExecution: () => {
      if (!confirmCommand) return;
      const value = confirmCommand;
      setConfirmCommand(null);
      void sendCommand(value, true);
    },
  };
}
