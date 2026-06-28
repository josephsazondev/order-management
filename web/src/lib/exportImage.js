// Dependency-free DOM → PNG export.
//
// Approach: deep-clone the target node, inline every computed style onto the clone (so it
// renders with no external CSS), embed <img> sources as data URLs, wrap it in an SVG
// <foreignObject>, then rasterize that SVG through an <img> onto a <canvas>. This avoids
// third-party rasterizers (html-to-image et al.) that scan/fetch the page's stylesheets and
// hang in some environments.
//
// Caveat: an SVG loaded as an image runs in "secure static mode" — it cannot load external
// resources. So images must be inlined as data URLs first; any image we can't fetch (e.g. a
// cross-origin logo without CORS headers) is dropped, and we report how many were dropped.

const XHTML_NS = 'http://www.w3.org/1999/xhtml';

function copyComputedStyle(src, dst) {
  const cs = window.getComputedStyle(src);
  let cssText = '';
  for (let i = 0; i < cs.length; i++) {
    const prop = cs[i];
    cssText += `${prop}:${cs.getPropertyValue(prop)};`;
  }
  dst.style.cssText = cssText;
  const sKids = src.children;
  const dKids = dst.children;
  for (let i = 0; i < sKids.length; i++) {
    if (dKids[i]) copyComputedStyle(sKids[i], dKids[i]);
  }
}

async function urlToDataUrl(url) {
  const res = await fetch(url, { mode: 'cors', cache: 'no-cache' });
  if (!res.ok) throw new Error('fetch failed: ' + res.status);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

// Replace every <img> in the clone with a data-URL src. Returns the count we had to drop.
async function embedImages(srcNode, cloneNode, timeoutMs) {
  const srcImgs = srcNode.querySelectorAll('img');
  const cloneImgs = cloneNode.querySelectorAll('img');
  let dropped = 0;
  for (let i = 0; i < srcImgs.length; i++) {
    const cloneImg = cloneImgs[i];
    if (!cloneImg) continue;
    const url = srcImgs[i].currentSrc || srcImgs[i].src;
    if (!url || url.startsWith('data:')) continue;
    try {
      const dataUrl = await Promise.race([
        urlToDataUrl(url),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
      ]);
      cloneImg.setAttribute('src', dataUrl);
    } catch (e) {
      cloneImg.remove();
      dropped += 1;
    }
  }
  return dropped;
}

// Rasterize `node` to a PNG data URL. Returns { dataUrl, droppedImages }.
export async function nodeToPng(node, { pixelRatio = 2, background = '#ffffff', imageTimeoutMs = 5000 } = {}) {
  const rect = node.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);

  const clone = node.cloneNode(true);
  copyComputedStyle(node, clone);
  const droppedImages = await embedImages(node, clone, imageTimeoutMs);

  clone.setAttribute('xmlns', XHTML_NS);
  clone.style.margin = '0';
  const serialized = new XMLSerializer().serializeToString(clone);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject x="0" y="0" width="100%" height="100%">${serialized}</foreignObject></svg>`;
  const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

  const dataUrl = await new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => reject(new Error('render timeout')), 10000);
    img.onload = () => {
      clearTimeout(timer);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = width * pixelRatio;
        canvas.height = height * pixelRatio;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(pixelRatio, pixelRatio);
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => { clearTimeout(timer); reject(new Error('Could not rasterize the invoice.')); };
    img.src = svgUrl;
  });

  return { dataUrl, droppedImages };
}
