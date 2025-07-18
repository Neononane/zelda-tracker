// OBS Troubleshooting Routes (Node.js Express)
require('dotenv').config();
const express = require('express');
const { OBSWebSocket } = require('obs-websocket-js');
const router = express.Router();

const obs = new OBSWebSocket();
let connected = false;

async function ensureConnection() {
  if (!connected) {
    await obs.connect(process.env.OBS_ADDRESS, process.env.OBS_PASSWORD);
    connected = true;
  }
}

// Get list of scenes
router.get('/scenes', async (req, res) => {
  try {
    await ensureConnection();
    const { scenes } = await obs.call('GetSceneList');
    res.json({ scenes: scenes.map(s => s.sceneName) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get list of sources in a scene, including mute state if audio
router.get('/scene-sources', async (req, res) => {
  try {
    const sceneName = req.query.scene;
    if (!sceneName) return res.status(400).json({ error: 'Missing scene parameter' });
    await ensureConnection();

    const { sceneItems } = await obs.call('GetSceneItemList', { sceneName });
    const audioKinds = ['ffmpeg_source', 'wasapi_input_capture', 'wasapi_output_capture', 'pulse_input', 'pulse_output', 'pulse_input_capture'];

    const sources = [];
    for (const item of sceneItems) {
      const { inputKind } = await obs.call('GetInputSettings', { inputName: item.sourceName }).catch(() => ({ inputKind: null }));
      let muted = null;
      if (audioKinds.includes(inputKind)) {
        try {
          const { inputMuted } = await obs.call('GetInputMute', { inputName: item.sourceName });
          muted = inputMuted;
        } catch (e) { /* skip */ }
      }
      sources.push({ name: item.sourceName, inputKind, muted });
    }

    res.json({ sources });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mute/unmute a source
router.post('/audio-mute', async (req, res) => {
  try {
    const { name, mute } = req.body;
    if (!name || typeof mute !== 'boolean') return res.status(400).json({ error: 'Missing name or mute boolean' });
    await ensureConnection();
    await obs.call('SetInputMute', { inputName: name, inputMuted: mute });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start/Stop virtual camera
router.post('/virtualcam', async (req, res) => {
  try {
    const { action } = req.body;
    if (!['start', 'stop'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
    await ensureConnection();
    if (action === 'start') await obs.call('StartVirtualCam');
    else await obs.call('StopVirtualCam');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start/Stop streaming
router.post('/stream', async (req, res) => {
  try {
    const { action } = req.body;
    if (!['start', 'stop'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
    await ensureConnection();
    if (action === 'start') await obs.call('StartStream');
    else await obs.call('StopStream');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;