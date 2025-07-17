const { OBSWebSocket } = require('obs-websocket-js');

const obs = new OBSWebSocket();

// --- Get args ---
const [sceneName, muteBool] = process.argv.slice(2);
const shouldMute = muteBool === 'true';

const SOURCE_NAME = 'Mic/Aux 2'; // or whatever your Discord input source is named in OBS

async function run() {
  try {
    await obs.connect(process.env.OBS_ADDRESS, process.env.OBS_PASSWORD);

    // Get the scene item ID for the source in the given scene
    const { sceneItems } = await obs.call('GetSceneItemList', {
      sceneName
    });

    const micItem = sceneItems.find(item => item.sourceName === SOURCE_NAME);
    if (!micItem) {
      throw new Error(`Source "${SOURCE_NAME}" not found in scene "${sceneName}"`);
    }

    await obs.call('SetSceneItemEnabled', {
      sceneName,
      sceneItemId: micItem.sceneItemId,
      sceneItemEnabled: !shouldMute
    });

    console.log(`${shouldMute ? 'Muted' : 'Unmuted'} "${SOURCE_NAME}" in scene "${sceneName}"`);

    await obs.disconnect();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
