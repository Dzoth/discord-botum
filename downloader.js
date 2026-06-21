const { Innertube, Platform } = require('youtubei.js');
const fs = require('fs');
const { Readable } = require('stream');

// Provide the custom JavaScript evaluator to resolve deciphering failures in Node
Platform.shim.eval = (data, env) => {
  const code = typeof data === 'string' ? data : data.output;
  return new Function(...Object.keys(env), code)(...Object.values(env));
};

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error("Usage: node downloader.js <videoId> <outputPath>");
    process.exit(1);
  }
  
  const videoId = args[0];
  const outputPath = args[1];
  
  try {
    console.log(`[DOWNLOAD] Initializing Innertube...`);
    const yt = await Innertube.create();
    
    let info = null;
    let stream = null;
    let success = false;
    let lastError = null;
    
    // Try multiple clients in order
    const clients = ['TV', 'WEB', 'ANDROID'];
    
    for (const client of clients) {
      try {
        console.log(`[DOWNLOAD] Attempting Video ID: ${videoId} using client: ${client}`);
        info = await yt.getInfo(videoId, { client });
        stream = await info.download({
          type: 'audio',
          quality: 'best'
        });
        success = true;
        console.log(`[DOWNLOAD] Stream obtained successfully with client: ${client}`);
        break;
      } catch (err) {
        lastError = err;
        console.error(`[DOWNLOAD] Client ${client} failed: ${err.message || err}`);
      }
    }
    
    if (!success) {
      throw lastError || new Error("All clients failed to download stream");
    }
    
    const nodeStream = Readable.fromWeb(stream);
    const writeStream = fs.createWriteStream(outputPath);
    
    await new Promise((resolve, reject) => {
      nodeStream.pipe(writeStream);
      nodeStream.on('error', (err) => reject(err));
      writeStream.on('error', (err) => reject(err));
      writeStream.on('finish', () => resolve());
    });
    
    console.log(`[DOWNLOAD] Success: Saved to ${outputPath}`);
    process.exit(0);
  } catch (err) {
    console.error(`[DOWNLOAD] Error:`, err.message || err);
    process.exit(2);
  }
}

main();
