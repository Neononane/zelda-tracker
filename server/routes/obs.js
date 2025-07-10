const express = require("express");
const fs = require("fs").promises;
const path = require("path");
const { OBSWebSocket } = require("obs-websocket-js");

const router = express.Router();

const sourceMap = {
  player1: 'Player1',
  player2: 'Player2',
  player3: 'Player3',
  player4: 'Player4',
};

router.get("/screenshot", async (req, res) => {
  const source = req.query.source;

  const obsSourceName = sourceMap[source?.toLowerCase()];

  if (!obsSourceName) {
    return res.status(400).json({ error: "Missing ?source query parameter" });
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

  const obs = new OBSWebSocket();

  try {
    await obs.connect(
      process.env.OBS_ADDRESS,
      process.env.OBS_PASSWORD || undefined
    );

    const { currentProgramSceneName } = await obs.call(
      "GetCurrentProgramScene"
    );

    const { sceneItems } = await obs.call("GetSceneItemList", {
      sceneName: currentProgramSceneName
    });

    const item = sceneItems.find(
      (i) => i.sourceName === source
    );

    if (!item) {
      return res
        .status(404)
        .json({ error: `Source ${source} not found in scene` });
    }

    const sceneItemId = item.sceneItemId;

    const { sceneItemTransform } = await obs.call("GetSceneItemTransform", {
      sceneName: currentProgramSceneName,
      sceneItemId
    });

    const transform = sceneItemTransform.sceneItemTransform;

    const origWidth = sceneItemTransform.sourceWidth;
    const origHeight = sceneItemTransform.sourceHeight;

    if (!origWidth || !origHeight) {
      return res
        .status(500)
        .json({ error: "Could not determine source dimensions" });
    }

    const boundingBoxWidth = 561;
    const boundingBoxHeight = 461;

    const scaleX = origWidth / boundingBoxWidth;
    const scaleY = origHeight / boundingBoxHeight;

    const trueCropX = crop.x * scaleX;
    const trueCropY = crop.y * scaleY;
    const trueCropWidth = crop.width * scaleX;
    const trueCropHeight = crop.height * scaleY;
 

    const cropLeft = Math.round(trueCropX);
    const cropTop = Math.round(trueCropY);
    const cropRight = Math.max(
      0,
      Math.round(origWidth - (trueCropX + trueCropWidth))
    );
    const cropBottom = Math.max(
      0,
      Math.round(origHeight - (trueCropY + trueCropHeight))
    );

    console.log({
      origWidth,
      origHeight,
      cropLeft,
      cropTop,
      cropRight,
      cropBottom
    });

    await obs.call("SetSceneItemTransform", {
      sceneName: currentProgramSceneName,
      sceneItemId,
      sceneItemTransform: {
        cropTop,
        cropBottom,
        cropLeft,
        cropRight
      }
    });

    console.log(`Crop applied for ${source}`);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  } finally {
    obs.disconnect();
  }
});

module.exports = router;
