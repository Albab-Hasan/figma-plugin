// Moodboard Grabber — main thread.
// The UI does all the networking; this side only turns bytes into nodes and lays them out.

figma.showUI(__html__, { width: 500, height: 660, themeColors: true });

let session = null;

figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'begin':
      session = { nodes: [], opts: msg.options, failures: [] };
      break;

    case 'image':
      if (!session) break;
      try {
        session.nodes.push(makeImageNode(msg.bytes, msg.name));
      } catch (e) {
        session.failures.push(msg.name + ': ' + e.message);
      }
      break;

    case 'done': {
      if (!session) break;
      const { nodes, opts, failures } = session;
      session = null;
      if (!nodes.length) {
        figma.notify('No images could be placed.', { error: true });
        figma.ui.postMessage({ type: 'finished', placed: 0 });
        break;
      }
      const container = await layout(nodes, opts);
      figma.currentPage.selection = [container];
      figma.viewport.scrollAndZoomIntoView([container]);
      const note = failures.length ? ` (${failures.length} failed)` : '';
      figma.notify(`Placed ${nodes.length} image${nodes.length === 1 ? '' : 's'}${note}`);
      figma.ui.postMessage({ type: 'finished', placed: nodes.length });
      break;
    }

    case 'notify':
      figma.notify(msg.message, { error: !!msg.error });
      break;

    case 'close':
      figma.closePlugin();
      break;
  }
};

function makeImageNode(bytes, name) {
  const image = figma.createImage(bytes);
  const rect = figma.createRectangle();
  rect.name = name || 'Image';
  rect.fills = [{ type: 'IMAGE', scaleMode: 'FILL', imageHash: image.hash }];
  // Real pixel size is unknown here; getSizeAsync is async and we want this call
  // synchronous, so start square and correct the aspect ratio during layout.
  rect.resize(100, 100);
  rect.setPluginData('imageHash', image.hash);
  return rect;
}

async function layout(nodes, opts) {
  const cols = Math.max(1, opts.columns);
  const gap = Math.max(0, opts.gap);
  const colW = Math.max(1, opts.columnWidth);

  // Resolve true aspect ratios before placing anything.
  const dims = await Promise.all(
    nodes.map(async (n) => {
      const img = figma.getImageByHash(n.getPluginData('imageHash'));
      if (!img) return { width: 1, height: 1 };
      try {
        return await img.getSizeAsync();
      } catch (e) {
        return { width: 1, height: 1 };
      }
    })
  );

  return place(nodes, dims, cols, gap, colW, opts);
}

function place(nodes, dims, cols, gap, colW, opts) {
  const heights = new Array(cols).fill(0);

  nodes.forEach((node, i) => {
    const d = dims[i];
    const ratio = d.width > 0 ? d.height / d.width : 1;
    const h = Math.max(1, Math.round(colW * ratio));
    node.resize(colW, h);

    let shortest = 0;
    for (let c = 1; c < cols; c++) if (heights[c] < heights[shortest]) shortest = c;

    node.x = shortest * (colW + gap);
    node.y = heights[shortest];
    heights[shortest] += h + gap;
  });

  const totalW = cols * colW + (cols - 1) * gap;
  const totalH = Math.max(...heights) - gap;

  const center = figma.viewport.center;
  const originX = Math.round(center.x - totalW / 2);
  const originY = Math.round(center.y - totalH / 2);

  if (!opts.wrapInFrame) {
    nodes.forEach((n) => {
      n.x += originX;
      n.y += originY;
      figma.currentPage.appendChild(n);
    });
    return figma.group(nodes, figma.currentPage);
  }

  const pad = gap;
  const frame = figma.createFrame();
  frame.name = opts.frameName || 'Moodboard';
  frame.resize(totalW + pad * 2, totalH + pad * 2);
  frame.x = originX - pad;
  frame.y = originY - pad;
  frame.fills = [{ type: 'SOLID', color: { r: 0.07, g: 0.07, b: 0.08 } }];
  frame.clipsContent = false;
  nodes.forEach((n) => {
    frame.appendChild(n);
    n.x += pad;
    n.y += pad;
  });
  figma.currentPage.appendChild(frame);
  return frame;
}
