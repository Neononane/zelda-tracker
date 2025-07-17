const puppeteer = require('puppeteer');
const fs = require('fs');
const { execSync } = require('child_process');

const PID_FILE = './chromium.pid';

async function startDiscord() {
  try {
    execSync('pactl load-module module-null-sink sink_name=discord_sink', {
      stdio: 'ignore'
    });
    console.log("Virtual sink created or already exists.");
  } catch (e) {
    console.log("Could not load virtual sink:", e.message);
  }
  try {
    execSync('pactl set-default-source discord_mic');
    execSync('pactl set-source-mute discord_mic 0');
    console.log("Set default input to discord_mic and unmuted");
  } catch (e) {
    console.log("Could not set discord_mic as input", e.message);
  }

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
