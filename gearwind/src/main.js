import { Engine } from './engine.js';

const params = new URLSearchParams(location.search);
const sceneName = params.get('scene') || 'game';

const canvas = document.getElementById('screen');
const engine = new Engine(canvas);
window.__engine = engine;

try {
  const mod = await import(`./scenes/${sceneName}.js`);
  await engine.setScene(mod.default ? new mod.default() : mod.scene);
} catch (err) {
  console.error('Failed to load scene', sceneName, err);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#200';
  ctx.fillRect(0, 0, 256, 224);
  ctx.fillStyle = '#f88';
  ctx.font = '8px monospace';
  ctx.fillText(`scene load error: ${sceneName}`, 8, 16);
  String(err.stack || err).split('\n').slice(0, 8).forEach((l, i) => {
    ctx.fillText(l.slice(0, 50), 8, 32 + i * 10);
  });
  window.__sceneReady = true;
  window.__sceneError = String(err);
}

if (!params.has('paused')) engine.start();
