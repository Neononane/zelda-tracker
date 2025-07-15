import OBSWebSocket from "obs-websocket-js";

const obs = new OBSWebSocket();

const obsAddress = process.env.OBS_ADDRESS;
const obsPassword = process.env.OBS_PASSWORD;

async function switchAudio(selectedPlayerName) {
  try {
    await obs.connect(obsAddress, obsPassword);

    const { inputs } = await obs.call("GetInputList");

    for (const input of inputs) {
      // Only attempt to mute audio-capable sources
      if (!(
        input.inputKind.includes("ffmpeg_source") ||
        input.inputKind.includes("media_source") ||
        input.inputKind.includes("browser_source")
      )) {
        continue;
      }

      let shouldMute = true;

      if (input.inputName === "Discord") {
        shouldMute = false; // always keep Discord on
      } else if (input.inputName === selectedPlayerName) {
        shouldMute = false;
      }

      await obs.call("SetInputMute", {
        inputName: input.inputName,
        inputMuted: shouldMute
      });
    }

    console.log(`✅ Audio switched to ${selectedPlayerName} (Discord remains on)`);

    await obs.disconnect();
  } catch (e) {
    console.error(e);
  }
}

// handle command-line args
const args = process.argv.slice(2);

if (args.length !== 1) {
  console.log("Usage: node switch-audio.js <sourceName>");
  process.exit(1);
}

const target = args[0];

switchAudio(target);
