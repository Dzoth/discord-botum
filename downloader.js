const { Innertube, Platform } = require('youtubei.js');
const fs = require('fs');
const { Readable } = require('stream');

// Provide the custom JavaScript evaluator to resolve deciphering failures in Node
Platform.shim.eval = async (data) => {
  return new Function(data.output)();
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
        
        // Pipe and consume the stream inside the loop to verify it works
        const nodeStream = Readable.fromWeb(stream);
        const writeStream = fs.createWriteStream(outputPath);
        
        await new Promise((resolve, reject) => {
          nodeStream.pipe(writeStream);
          nodeStream.on('error', (err) => reject(err));
          writeStream.on('error', (err) => reject(err));
          writeStream.on('finish', () => resolve());
        });
        
        success = true;
        console.log(`[DOWNLOAD] Saved to ${outputPath} using client: ${client}`);
        break;
      } catch (err) {
        lastError = err;
        console.error(`[DOWNLOAD] Client ${client} failed: ${err.message || err}`);
        // Clean up partial output file if it exists
        if (fs.existsSync(outputPath)) {
          try { fs.unlinkSync(outputPath); } catch (e) {}
        }
      }
    }
    
    if (!success) {
      throw lastError || new Error("All clients failed to download stream");
    }
    
    process.exit(0);
  } catch (err) {
    console.error(`[DOWNLOAD] Error:`, err.message || err);
    process.exit(2);
  }
}

main();
