const yts = require('yt-search');

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node search.js <query>");
    process.exit(1);
  }
  const query = args.join(' ');
  try {
    const searchResult = await yts(query);
    const videos = searchResult && searchResult.videos ? searchResult.videos.slice(0, 5) : [];
    const results = videos.map(video => ({
      title: video.title,
      uploader: video.author ? video.author.name : 'Bilinmeyen Kanal',
      url: video.url,
      id: video.videoId
    }));
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err.message || err);
    process.exit(2);
  }
}

main();
