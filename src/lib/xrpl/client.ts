import { Client } from "xrpl";

const DEVNET_URL = "wss://s.devnet.rippletest.net:51233";

let client: Client | null = null;

export async function getClient(): Promise<Client> {
  if (client?.isConnected()) return client;

  client = new Client(DEVNET_URL);
  await client.connect();
  return client;
}

export async function disconnectClient(): Promise<void> {
  if (client?.isConnected()) {
    await client.disconnect();
    client = null;
  }
}
