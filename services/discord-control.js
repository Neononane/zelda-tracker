const puppeteer = require('puppeteer');
const fs = require('fs');
const { ensurePulseAudioHeadless } = require('./audio-setup');


const PID_FILE = './chromium.pid';

const { execSync } = require("child_process");


async function startDiscord() {
  console.log("🚀 Starting Discord automation...");

  // Optional: Start PulseAudio (uncomment if needed)
  // await ensurePulseAudioHeadless();

  const browser = await puppeteer.launch({
    headless: false, // Set to true only if you have everything working
    env: {
      ...process.env,
      PULSE_SINK: 'discord_sink',
      PULSE_SOURCE: 'obs_mix_out.monitor'
    },
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--use-fake-ui-for-media-stream',
      '--disable-features=IsolateOrigins,site-per-process'
    ]
  });

  const page = await browser.newPage();

  // Optional: log failed network requests
  page.on('requestfailed', request => {
    console.log(`❌ Request failed: ${request.url()} — ${request.failure().errorText}`);
  });

  try {
    await page.goto('https://discord.com/login', {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    // Wait for the email field to appear
    await page.waitForSelector('input[name="email"]', { timeout: 60000 });

    await page.type('input[name="email"]', process.env.DISCORD_USERNAME);
    await page.type('input[name="password"]', process.env.DISCORD_PASSWORD);

    await Promise.all([
        page.click('button[type="submit"]'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
    ]);
    console.log("✅ Logged in.");

    await page.goto('https://discord.com/channels/1384629482610102473/1384629483205820541', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    console.log("✅ Channel loaded.");

    await page.waitForSelector('#app-mount', { timeout: 60000 });
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
      console.log("🔊 Already connected to voice.");
    } else {
      console.log("🔍 Looking for Join Voice...");

      let joinButton = null;
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text.includes('Join Voice')) {
          joinButton = btn;
          break;
        }
      }

      if (joinButton) {
        console.log("🎤 Clicking Join Voice...");
        await joinButton.click();
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log("🎥 Looking for Turn On Camera button...");
        const videoButton = await page.$('button[aria-label="Turn On Camera"]');
        if (videoButton) {
          console.log("📸 Clicking Turn On Camera...");
          await videoButton.click();
        } else {
          console.warn("⚠️ Could not find Turn On Camera button.");
          await page.screenshot({ path: 'no_video_button.png' });
        }

        // Optionally try to open settings and set audio input (fragile - can break easily)
        // You may want to comment this out unless verified
        /*
        await page.click('button[aria-label="User Settings"]');
        await page.click('div:has-text("Voice & Video")');
        await page.select('#input-device-dropdown', 'Remapped Monitor of discord_sink');
        */
      } else {
        console.warn("⚠️ No Join Voice button found!");
        await page.screenshot({ path: 'no_join_button.png' });
      }
    }

    const pid = browser.process().pid;
    fs.writeFileSync(PID_FILE, pid.toString(), 'utf-8');
    console.log(`✅ Chromium PID saved: ${pid}`);
    console.log("🎥 Virtual camera started.");
  } catch (err) {
    console.error("❌ Discord automation failed:", err);
    await page.screenshot({ path: 'discord_error.png' });
    await browser.close();
  }
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
