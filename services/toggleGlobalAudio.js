const { OBSWebSocket } = require('obs-websocket-js');
const obs = new OBSWebSocket();

// CLI args: deviceName and true/false to mute/unmute
const [deviceName, muteFlag] = process.argv.slice(2);
const mute = muteFlag === 'true';

async function run() {
  try {
    await obs.connect(process.env.OBS_ADDRESS); // add password if required

    await obs.call('SetInputMute', {
      inputName: deviceName,
      inputMuted: mute
    });

    console.log(`${mute ? 'Muted' : 'Unmuted'} device "${deviceName}"`);
    await obs.disconnect();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
