require('dotenv').config();
const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const OBSWebSocket = require("obs-websocket-js").default;
const obs = new OBSWebSocket();
const { getMapping } = require("../lib/obsMappings");
const util = require("util");
const execAsync = util.promisify(require("child_process").exec);

const router = express.Router();

const sourceMap = {
  player1: 'Player1',
  player2: 'Player2',
  player3: 'Player3',
  player4: 'Player4',
};

router.get("/screenshot", async (req, res) => {
  const { source, raceId } = req.query;

  if (!source || !raceId) {
    return res.status(400).json({ error: "Missing source or raceId parameter." });
  }

  const obsSourceName = sourceMap[source?.toLowerCase()];

  if (!obsSourceName) {
    return res.status(400).json({ error: `Source ${source} not mapped for race ${raceId}` });
  }

  const obs = new OBSWebSocket();

  try {
    await obs.connect(
      process.env.OBS_ADDRESS,
      process.env.OBS_PASSWORD || undefined
    );

    const response = await obs.call("GetSourceScreenshot", {
      sourceName: obsSourceName,
      imageFormat: "jpg",
      imageWidth: 640,
      imageHeight: 360
    });

    const base64Data = response.imageData.split(",")[1];

    const screenshotPath = path.join(
      "public",
      "screenshots",
      `${source}.jpg`
    );

    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    await fs.writeFile(screenshotPath, base64Data, "base64");

    console.log(`Screenshot saved: ${screenshotPath}`);

    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally {
    obs.disconnect();
  }
});

router.post("/set-crop", express.json(), async (req, res) => {
  const { source, crop } = req.body;

  if (!source || !crop) {
    return res.status(400).json({ error: "Missing source or crop data" });
  }
  const obsSourceName = sourceMap[source.toLowerCase()] || source;
  const obs = new OBSWebSocket();

  try {
    await obs.connect(
      process.env.OBS_ADDRESS,
      process.env.OBS_PASSWORD || undefined
    );
    console.log("I connected to the OBS websocket for cropping")
    //const currentProgramScene = await obs.call("GetCurrentProgramScene");
    //const targetScene = currentProgramScene.sceneName;
    const targetScene = "Scene";
    console.log("value of targetScene:",targetScene);
    const { sceneItems } = await obs.call("GetSceneItemList", { sceneName: targetScene });


    const item = sceneItems.find(i => i.sourceName === obsSourceName);

    if (!item) {
      return res
        .status(404)
        .json({ error: `Source ${source} not found in scene` });
    }

    const sceneItemId = item.sceneItemId;

    const { sceneItemTransform } = await obs.call("GetSceneItemTransform", {
      sceneName: targetScene,
      sceneItemId
    });
    console.log("Below is the scene item transform");
    console.log(sceneItemTransform);

    const origWidth = sceneItemTransform.sourceWidth;
    const origHeight = sceneItemTransform.sourceHeight;

    if (!origWidth || !origHeight) {
      return res
        .status(500)
        .json({ error: "Could not determine source dimensions" });
    }

    const boundsWidth = sceneItemTransform.boundsWidth;
    const boundsHeight = sceneItemTransform.boundsHeight;

    const screenshotWidth = 640;
    const screenshotHeight = 360;

    // Compute scaling from screenshot → bounds box
    const scaleScreenshotX = boundsWidth / screenshotWidth;
    const scaleScreenshotY = boundsHeight / screenshotHeight;

    // Compute scaling from bounds box → original source
    const scaleToSourceX = origWidth / boundsWidth;
    const scaleToSourceY = origHeight / boundsHeight;

    // Compose them into one factor
    const totalScaleX = scaleScreenshotX * scaleToSourceX;
    const totalScaleY = scaleScreenshotY * scaleToSourceY;

    // Calculate true crop rectangle in source pixels
    let trueCropX = crop.x * totalScaleX;
    let trueCropY = crop.y * totalScaleY;
    let trueCropWidth = crop.width * totalScaleX;
    let trueCropHeight = crop.height * totalScaleY;

    // Clamp
    trueCropX = Math.max(0, Math.min(trueCropX, origWidth));
    trueCropY = Math.max(0, Math.min(trueCropY, origHeight));
    trueCropWidth = Math.max(0, Math.min(trueCropWidth, origWidth - trueCropX));
    trueCropHeight = Math.max(0, Math.min(trueCropHeight, origHeight - trueCropY));

    // Compute crop edges
    const cropLeft = Math.round(trueCropX);
    const cropTop = Math.round(trueCropY);
    const cropRight = Math.round(origWidth - (trueCropX + trueCropWidth));
    const cropBottom = Math.round(origHeight - (trueCropY + trueCropHeight));


    console.log({
      origWidth,
      origHeight,
      cropLeft,
      cropTop,
      cropRight,
      cropBottom
    });

    console.log({
      origWidth,
      origHeight,
      boundsWidth,
      boundsHeight,
      crop,
      trueCropX,
      trueCropY,
      trueCropWidth,
      trueCropHeight,
      cropLeft,
      cropTop,
      cropRight,
      cropBottom
    });

    console.log("About to send transform:", {
      cropTop,
      cropBottom,
      cropLeft,
      cropRight,
      sceneItemId: item.sceneItemId,
      sceneName: targetScene
    });
    const version = await obs.call("GetVersion");
    console.log("OBS WebSocket version:", version);

    await obs.call("SetSceneItemTransform", {
      sceneName: targetScene,
      sceneItemId: item.sceneItemId,
      sceneItemTransform: { cropTop, cropBottom, cropLeft, cropRight}
    });
    await obs.call("SetSceneItemEnabled", {
      sceneName: targetScene,
      sceneItemId: item.sceneItemId,
      sceneItemEnabled: false
    });

    await obs.call("SetSceneItemEnabled", {
      sceneName: targetScene,
      sceneItemId: item.sceneItemId,
      sceneItemEnabled: true
    });
    console.log('This is the target scene:', targetScene);
    console.log('This is the scene item:', item);
    const result = await obs.call("GetSceneItemTransform", {
      sceneName: targetScene,
      sceneItemId: item.sceneItemId,
    });
    console.log("Transform after set:", result);

    console.log(`Crop applied for ${obsSourceName}`);
    return res.json({ success: true });
  } catch (err) {
    console.error("Crop error:", err);
    return res.status(500).json({ error: err.message });
  } finally {
    obs.disconnect();
  }
});

router.post('/go-live', async (req, res) => {
  try {
    await obs.connect(process.env.OBS_ADDRESS, process.env.OBS_PASSWORD);
    
    await obs.call('TriggerStudioModeTransition');

    await obs.disconnect();
/*     console.log("🚀 Enabling microphone...");
    await execAsync(`node ./services/toggleGlobalAudio.js "Mic/Aux 2" false`); */
    res.json({ success: true });
  } catch (err) {
    console.error('Error triggering Studio Mode transition:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
