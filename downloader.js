const { Innertube } = require('youtubei.js');
const fs = require('fs');
const { Readable } = require('stream');

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
    
    console.log(`[DOWNLOAD] Fetching info for Video ID: ${videoId} using client: TV`);
    const info = await yt.getInfo(videoId, { client: 'TV' });
    
    console.log(`[DOWNLOAD] Downloading audio...`);
    const stream = await info.download({
      type: 'audio',
      quality: 'best'
    });
    
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
