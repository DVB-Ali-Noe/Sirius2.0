import { Client } from "xrpl";
import { XRPL_WS_URL } from "./constants";
import { patchCodecForXLS66 } from "./patch-codec";

patchCodecForXLS66();

let client: Client | null = null;
let connecting: Promise<Client> | null = null;

export async function getClient(): Promise<Client> {
  if (client?.isConnected()) return client;

  if (connecting) return connecting;

  connecting = (async () => {
    if (client) {
      try { await client.disconnect(); } catch {}
      client = null;
    }

    const newClient = new Client(XRPL_WS_URL, {
      connectionTimeout: 20000,
      timeout: 30000,
    });

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[xrpl] Connecting to ${XRPL_WS_URL} (attempt ${attempt}/3)...`);
        await newClient.connect();
        console.log("[xrpl] Connected");
        client = newClient;
        return newClient;
      } catch (error) {
        console.error(`[xrpl] Connection attempt ${attempt} failed:`, (error as Error).message);
        if (attempt === 3) {
          client = null;
          throw error;
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    throw new Error("Unreachable");
  })();

  return connecting;
}

export async function disconnectClient(): Promise<void> {
  if (connecting) await connecting;
  if (client?.isConnected()) {
    await client.disconnect();
    client = null;
  }
}
