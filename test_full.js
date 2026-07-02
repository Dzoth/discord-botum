const { Innertube, Platform } = require('youtubei.js');
const { Readable } = require('stream');

Platform.shim.eval = async (data) => {
  return new Function(data.output)();
};

async function testClient(clientType) {
  try {
    console.log(`\n--- Testing download with client: ${clientType} ---`);
    const yt = await Innertube.create();
    const videoId = 'YNIl8-eNWfQ'; // LVBEL C5 ABV
    
    const info = await yt.getInfo(videoId, { client: clientType });
    const stream = await info.download({
      type: 'audio',
      quality: 'best'
    });
    
    const nodeStream = Readable.fromWeb(stream);
    
    return new Promise((resolve) => {
      let bytesRead = 0;
      let resolved = false;
      
      nodeStream.on('data', (chunk) => {
        bytesRead += chunk.length;
        if (bytesRead >= 102400 && !resolved) { // Read 100KB
          resolved = true;
          console.log(`  Success! Read ${bytesRead} bytes.`);
          nodeStream.destroy();
          resolve(true);
        }
      });
      
      nodeStream.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          console.error(`  Failed during download:`, err.message || err);
          resolve(false);
        }
      });
      
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.log(`  Timeout waiting for data.`);
          nodeStream.destroy();
          resolve(false);
        }
      }, 5000);
    });
  } catch (err) {
    console.error(`  Failed during initialization/info:`, err.message || err);
    return false;
  }
}

async function run() {
  const clients = ['TV', 'WEB', 'MWEB', 'ANDROID', 'IOS'];
  const results = {};
  for (const client of clients) {
    results[client] = await testClient(client);
  }
  console.log("\nSummary of results:", results);
  process.exit(0);
}

run();
