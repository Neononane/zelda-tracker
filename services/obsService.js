import OBSWebSocket from 'obs-websocket-js';

const obs = new OBSWebSocket();

let connected = false;

export async function connectOBS() {
  if (connected) return;
  await obs.connect('ws://172.178.55.207:4455', 'z1randomizer');
  connected = true;
  console.log("Connected to OBS");
}

export async function startStreaming() {
  await connectOBS();

  await obs.call('StartStreaming');
  console.log("Streaming started.");
}

export async function stopStreaming() {
  await connectOBS();

  await obs.call('StopStreaming');
  console.log("Streaming stopped.");
}
