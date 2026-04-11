import { Client } from "xrpl";
import { DEVNET_WS_URL } from "./constants";

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

    const newClient = new Client(DEVNET_WS_URL);
    try {
      await newClient.connect();
      client = newClient;
      return newClient;
    } catch (error) {
      client = null;
      throw error;
    } finally {
      connecting = null;
    }
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
