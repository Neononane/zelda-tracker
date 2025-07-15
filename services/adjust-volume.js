import OBSWebSocket from "obs-websocket-js";

const obs = new OBSWebSocket();

const obsAddress = process.env.OBS_ADDRESS;
const obsPassword = process.env.OBS_PASSWORD; // e.g. "secret" if set

async function adjustVolume(sourceName, deltaPct) {
  try {
    await obs.connect(obsAddress, obsPassword);

    // Get current volume
    const { inputVolumeMul } = await obs.call("GetInputVolume", {
      inputName: sourceName
    });

    let newVolume = inputVolumeMul * (1 + deltaPct / 100);

    // Clamp between 0.0 and 10.0
    if (newVolume > 10.0) newVolume = 10.0;
    if (newVolume < 0) newVolume = 0;

    await obs.call("SetInputVolume", {
      inputName: sourceName,
      inputVolumeMul: newVolume
    });

    console.log(
      `✅ New volume for ${sourceName}: ${(newVolume * 100).toFixed(1)}%`
    );

    await obs.disconnect();
  } catch (e) {
    console.error(e);
  }
}

const args = process.argv.slice(2);

if (args.length !== 2) {
  console.log("Usage:");
  console.log("  node adjust-volume.js <sourceName> <delta>");
  console.log("    e.g. node adjust-volume.js Player1 25");
  console.log("         node adjust-volume.js Discord -30");
  process.exit(1);
}

const sourceName = args[0];
const delta = parseFloat(args[1]);

if (isNaN(delta)) {
  console.log("Delta must be a number!");
  process.exit(1);
}

adjustVolume(sourceName, delta);
