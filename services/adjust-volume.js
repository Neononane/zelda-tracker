import OBSWebSocket from "obs-websocket-js";

const obs = new OBSWebSocket();

const obsAddress = process.env.OBS_ADDRESS;
const obsPassword = process.env.OBS_PASSWORD; // e.g. "secret" if set

// default step when using "up" or "down"
const defaultStepPct = 10; // = 10%

async function adjustVolume(argument) {
  try {
    await obs.connect(obsAddress, obsPassword);

    // Get list of all inputs
    const { inputs } = await obs.call("GetInputList");

    // Find the single unmuted audio source
    let activeInput = null;

    for (const input of inputs) {
      const { inputMuted } = await obs.call("GetInputMute", {
        inputName: input.inputName,
      });

      if (!inputMuted) {
        activeInput = input;
        break;
      }
    }

    if (!activeInput) {
      console.log("❌ No active audio source found!");
      await obs.disconnect();
      return;
    }

    console.log(` Active audio source: ${activeInput.inputName}`);

    // Get current volume multiplier (0.0 to 10.0)
    const { inputVolumeMul } = await obs.call("GetInputVolume", {
      inputName: activeInput.inputName,
    });

    let newVolume = inputVolumeMul;

    let stepPct = 0;

    if (argument === "up") {
      stepPct = defaultStepPct;
    } else if (argument === "down") {
      stepPct = -defaultStepPct;
    } else if (!isNaN(parseFloat(argument))) {
      stepPct = parseFloat(argument);
    } else {
      console.log("Invalid argument. Use up, down, or a numeric percentage.");
      await obs.disconnect();
      return;
    }

    const multiplier = 1 + (stepPct / 100);

    newVolume = inputVolumeMul * multiplier;

    // clamp
    if (newVolume > 10.0) newVolume = 10.0;
    if (newVolume < 0) newVolume = 0;

    await obs.call("SetInputVolume", {
      inputName: activeInput.inputName,
      inputVolumeMul: newVolume,
    });

    console.log(
      `✅ New volume for ${activeInput.inputName}: ${(newVolume * 100).toFixed(1)}%`
    );

    await obs.disconnect();
  } catch (e) {
    console.error(e);
  }
}

// Parse CLI arg
const arg = process.argv[2];

if (!arg) {
  console.log("Usage:");
  console.log("  node adjust-volume.js up");
  console.log("  node adjust-volume.js down");
  console.log("  node adjust-volume.js <percentage>");
  console.log("    e.g. node adjust-volume.js 25");
  console.log("         node adjust-volume.js -30");
  process.exit(1);
}

adjustVolume(arg);
