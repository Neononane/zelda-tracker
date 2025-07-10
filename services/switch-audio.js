import OBSWebSocket from "obs-websocket-js";

const obs = new OBSWebSocket();

// Change if your websocket address/password differ
const obsAddress = "ws://127.0.0.1:4455";
const obsPassword = ""; // set your password if required

/**
 * Switches audio to a single source
 */
async function switchAudio(toSource) {
  try {
    await obs.connect(obsAddress, obsPassword);

    // Get list of ALL audio inputs
    const { inputs } = await obs.call("GetInputList");

    // Filter to those with audio enabled
    const audioInputs = inputs.filter(
      (i) => i.inputKind && i.inputKind.includes("ffmpeg_source") || i.inputKind.includes("media_source") || i.inputKind.includes("browser_source")
    );

    console.log("All detected audio-capable sources:");
    console.table(audioInputs.map(x => ({
      name: x.inputName,
      kind: x.inputKind
    })));

    for (const input of audioInputs) {
      const isTarget = input.inputName === toSource;

      await obs.call("SetInputMute", {
        inputName: input.inputName,
        inputMuted: !isTarget,
      });

      console.log(
        `Audio ${isTarget ? "UNmuted" : "Muted"} for: ${input.inputName}`
      );
    }

    console.log(`✅ Audio switched to ONLY ${toSource}`);

    await obs.disconnect();
  } catch (e) {
    console.error(e);
  }
}

// Parse CLI arg
const sourceName = process.argv[2];

if (!sourceName) {
  console.log("Usage: node switch-audio.js <SourceName>");
  process.exit(1);
}

switchAudio(sourceName);
