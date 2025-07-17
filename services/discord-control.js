const puppeteer = require('puppeteer');
const fs = require('fs');
const { execSync, exec } = require('child_process');
const { ensurePulseAudioHeadless } = require('./audio-setup');


const PID_FILE = './chromium.pid';

const { execSync } = require("child_process");

async function setupAudioRouting() {
  try {
    execSync('pulseaudio --check || pulseaudio --start');
    console.log('✅ PulseAudio session started or already running.');
  } catch (err) {
    console.error('❌ Failed to start PulseAudio:', err.message);
  }

  await new Promise(resolve => setTimeout(resolve, 1000));

  function loadOrReuseModule(command, checkText) {
    try {
      const result = execSync('pactl list short modules').toString();
      const exists = result.split('\n').some(line => line.includes(checkText));
      if (!exists) {
        const moduleId = execSync(command).toString().trim();
        console.log(`✅ Loaded module: ${checkText} (ID ${moduleId})`);
      } else {
        console.log(`ℹ️ Module ${checkText} already loaded.`);
      }
    } catch (err) {
      console.error(`❌ Failed to load module ${checkText}:`, err.message);
    }
  }

  loadOrReuseModule(
    'pactl load-module module-null-sink sink_name=obs_mix_out',
    'obs_mix_out'
  );

  loadOrReuseModule(
    'pactl load-module module-virtual-source source_name=discord_mic master=obs_mix_out.monitor',
    'discord_mic'
  );

  try {
    execSync('pactl set-default-source discord_mic');
    execSync('pactl set-source-mute discord_mic 0');
    console.log('✅ Set discord_mic as default input and unmuted.');
  } catch (err) {
    console.error('❌ Failed to set discord_mic as default source:', err.message);
  }

  loadOrReuseModule(
    'pactl load-module module-null-sink sink_name=discord_sink',
    'discord_sink'
  );
}


async function startDiscord() {
  
   await ensurePulseAudioHeadless();
  

  const browser = await puppeteer.launch({
    headless: false,
    env: {
      ...process.env,
      PULSE_SINK: 'discord_sink'
    },
    args: [
      '--no-sandbox',
      '--use-fake-ui-for-media-stream'
    ]
  });

  const page = await browser.newPage();

  await page.goto('https://discord.com/login', { waitUntil: 'networkidle0' });
  await page.type('input[name="email"]', process.env.DISCORD_USERNAME);
  await page.type('input[name="password"]', process.env.DISCORD_PASSWORD);

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
  ]);

  console.log("Logged in.");

  await page.goto('https://discord.com/channels/1384629482610102473/1384629483205820541', {
    waitUntil: 'networkidle0'
  });

  console.log("Channel loaded.");
  await page.waitForSelector('#app-mount');
  await new Promise(resolve => setTimeout(resolve, 5000));

  let disconnectButton = null;
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('Disconnect')) {
      disconnectButton = btn;
      break;
    }
  }

  if (disconnectButton) {
    console.log("Already connected to voice.");
  } else {
    console.log("Looking for Join Voice...");

    let joinButton = null;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Join Voice')) {
        joinButton = btn;
        break;
      }
    }

    if (joinButton) {
      console.log("Clicking Join Voice...");
      await joinButton.click();
      await new Promise(resolve => setTimeout(resolve, 5000));

      console.log("Looking for Turn On Camera button...");
      const videoButton = await page.$('button[aria-label="Turn On Camera"]');

      if (videoButton) {
        console.log("Clicking Turn On Camera...");
        await videoButton.click();
        console.log("Camera should now be enabled in Discord.");
      } else {
        console.log("Could not find Turn On Camera button.");
        await page.screenshot({ path: 'no_video_button.png' });
      }
    } else {
      console.log("No Join Voice button found!");
      await page.screenshot({ path: 'no_join_button.png' });
    }
  }

  const pid = browser.process().pid;
  fs.writeFileSync(PID_FILE, pid.toString(), 'utf-8');
  console.log(`Chromium PID saved: ${pid}`);
  console.log("Virtual camera started.");
}

function stopDiscord() {
  if (!fs.existsSync(PID_FILE)) {
    console.log('No PID file found. Is Chromium running?');
    return;
  }

  const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8'), 10);

  try {
    process.kill(pid, 'SIGTERM');
    console.log(`Chromium process ${pid} terminated.`);
  } catch (err) {
    console.error(`Failed to kill process ${pid}:`, err.message);
  }

  fs.unlinkSync(PID_FILE);
}

module.exports = {
  startDiscord,
  stopDiscord
};
