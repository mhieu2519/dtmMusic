
const { 
  Client, 
  GatewayIntentBits, 
  ActionRowBuilder, 
  AttachmentBuilder,  
  ButtonBuilder, 
  ButtonStyle, 
  MessageFlags, 
  StringSelectMenuBuilder ,

  } = require("discord.js");

const keepAlive = require("./server");
require("dotenv").config();

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates, // Để xử lý âm thanh
  ],
});

const { handleMusicCommand } = require("./music/music");
const { Player } = require('discord-player');
const { YoutubeiExtractor } = require('discord-player-youtubei'); // Import YoutubeiExtractor
const { SpotifyExtractor } = require('@discord-player/extractor'); // Import SpotifyExtractor
const ffmpegPath = require('ffmpeg-static'); // Import ffmpeg-static
const playdl = require("play-dl");
// Cấu hình Discord Player
const player = new Player(bot,{
    ytdlOptions: {
      quality: 'highestaudio',
     filter: 'audioonly',
        highWaterMark: 1 << 25 // 32Mb
    },
  //skipFFmpeg: true, // Báo cho discord-player biết bạn sẽ cung cấp FFmpeg
    connectionTimeout: 60000 // Tăng thời gian chờ kết nối (ví dụ: 60 giây)
}
);

// Hoặc nếu bạn muốn thiết lập cho tất cả các extractor (cách này an toàn hơn nếu không chắc chắn)
 player.options.ffmpeg = { ffmpegPath: ffmpegPath };
// Đăng ký các extractor
// YoutubeiExtractor cho YouTube (thay thế YoutubeExtractor cũ)
//player.extractors.register(YoutubeiExtractor, {});

// Đăng ký play-dl extractor
//player.extractors.register(playdl.generateExtractor(), {});
//player.use(playdl); // CHỈ THÊM DÒNG NÀYs

// Đăng ký play-dl như một extractor thông thường
player.extractors.register({
    name: 'play-dl-custom', // Đặt một tên duy nhất
    async search(query, context) {
        try {
            // Kiểm tra nếu query là một URL được play-dl hỗ trợ
            if (playdl.yt_validate(query.query) === 'video' || playdl.yt_validate(query.query) === 'playlist' || playdl.sp_validate(query.query) === 'track' || playdl.sp_validate(query.query) === 'album' || playdl.sp_validate(query.query) === 'playlist') {
                const data = await playdl.search(query.query, {
                    limit: 1, // Chỉ lấy 1 kết quả cho video/track đơn
                    source: { youtube: 1, spotify: 1 } // Tìm kiếm trên cả YouTube và Spotify
                });
                return {
                    tracks: data.map(result => player.createTrack(result, context.data)),
                    playlist: data[0]?.type === 'playlist' ? player.createPlaylist(data[0], context.data) : null
                };
            }

            // Nếu không phải URL, thử tìm kiếm chung trên YouTube
            const data = await playdl.search(query.query, {
                limit: 1,
                type: 'video' // Mặc định tìm kiếm video YouTube
            });
            return {
                tracks: data.map(result => player.createTrack(result, context.data)),
                playlist: null
            };
        } catch (error) {
            console.error(`Lỗi trong play-dl search extractor: ${error.message}`);
            return { tracks: [], playlist: null };
        }
    },
    async stream(track, context) {
        try {
            // Đảm bảo rằng track.url không phải là một URL rỗng hoặc không hợp lệ
            if (!track.url) throw new Error('Track URL is missing.');
            const stream = await playdl.stream(track.url);
            return stream.stream; // play-dl.stream trả về một object, ta cần thuộc tính stream
        } catch (error) {
            console.error(`Lỗi trong play-dl stream extractor cho track ${track.title}: ${error.message}`);
            throw new Error(`Không thể tạo stream cho bài hát này: ${error.message}`);
        }
    },
    validate: (query) => {
        // Xác nhận rằng extractor này có thể xử lý query
        return true; // Để nó luôn cố gắng xử lý các query
        // Hoặc kiểm tra cụ thể hơn nếu muốn:
        // return playdl.yt_validate(query) === 'video' || playdl.sp_validate(query) === 'track';
    }
}, {
    priority: 1 // Đặt ưu tiên cao nhất cho extractor này
});
// Đăng ký YoutubeiExtractor cho YouTube
// SpotifyExtractor cho Spotify
player.extractors.register(SpotifyExtractor, {
    client_id: process.env.SPOTIFY_CLIENT_ID,
    client_secret: process.env.SPOTIFY_CLIENT_SECRET,
    // Bạn có thể thêm các tùy chọn khác nếu cần, ví dụ: concurrency
});

const { useMainPlayer } = require('discord-player');

// Gắn play-dl vào hàm onBeforeCreateStream
//const { DefaultExtractors } = require('@discord-player/extractor');
 //player.extractors.loadMulti(DefaultExtractors);

player.events.on('playerStart', (queue, track) => {
  console.log(`▶️ Bắt đầu phát: ${track.title}`);
});

player.on('playerStart', (queue, track) => {
  console.log(`🎵 Now playing: ${track.title}`);
});

// Gắn `play-dl` vào onBeforeCreateStream
player.on('onBeforeCreateStream', async (track, source, _queue) => {
  if (track.source === 'youtube') {
    const stream = await playdl.stream(track.url, {
      quality: 2, // chất lượng cao
    });
    return stream.stream;
  }
});


console.log("✅ FFmpeg static path:", ffmpegPath);
// --- Xử lý các sự kiện của Discord Player ---
player.events.on('error', (queue, error) => {
  console.error(`❌ [error] Lỗi phát nhạc trong guild ${queue.guild.name}:`, error);
});

player.events.on('playerError', (queue, error) => {
  console.error(`❌ [playerError] Lỗi trình phát trong guild ${queue.guild.name}:`, error);
});

player.events.on('connectionError', (queue, error) => {
  console.error(`❌ [connectionError] Kết nối voice lỗi ở ${queue.guild.name}:`, error);
});

player.on('error', (queue, error) => {
    console.error(`Lỗi trong hàng đợi của ${queue?.guild?.name || 'unknown'}: ${error.message}`);
    if (queue?.metadata?.channel) {
        queue.metadata.channel.send(`❌ Đã xảy ra lỗi: ${error.message}`).catch(console.error);
    }
});

player.on('playerError', (queue, error) => {
    console.error(`Lỗi phát nhạc: ${error.message}`);
    if (queue?.metadata?.channel) {
        queue.metadata.channel.send(`⚠️ Lỗi khi phát bài hát: ${error.message}`).catch(console.error);
    }
});

player.on('nodeError', (queue, error) => {
    console.error(`Lỗi Node trong hàng đợi của ${queue?.guild?.name || 'unknown'}: ${error.message}`);
    if (queue?.metadata?.channel) {
        queue.metadata.channel.send(`💥 Lỗi hệ thống khi phát nhạc: ${error.message}`).catch(console.error);
    }
});

player.on('connectionError', (queue, error) => {
    console.error(`Lỗi kết nối voice trong hàng đợi của ${queue?.guild?.name || 'unknown'}: ${error.message}`);
    if (queue?.metadata?.channel) {
        queue.metadata.channel.send(`🚫 Lỗi kết nối tới kênh thoại: ${error.message}`).catch(console.error);
    }
});

player.on('trackStart', (queue, track) => {
    if (queue?.metadata?.channel) {
        queue.metadata.channel.send(`🎶 Đang phát: **[${track.title}](${track.url})** của **${track.author}**`);
    }
});

player.on('trackAdd', (queue, track) => {
    if (queue?.metadata?.channel) {
        queue.metadata.channel.send(`✅ Đã thêm bài hát: **[${track.title}](${track.url})** vào hàng đợi.`);
    }
});

player.on('tracksAdd', (queue, tracks) => {
    if (queue?.metadata?.channel) {
        queue.metadata.channel.send(`➕ Đã thêm ${tracks.length} bài hát vào hàng đợi.`);
    }
});

player.on('queueEnd', (queue) => {
    if (queue?.metadata?.channel) {
        queue.metadata.channel.send('📭 Hàng đợi phát nhạc đã kết thúc.');
    }
});

player.on('emptyQueue', (queue) => {
    if (queue?.metadata?.channel) {
        queue.metadata.channel.send('📪 Không còn bài hát nào trong hàng đợi. Bot sẽ rời kênh thoại.');
    }
});

player.on('disconnect', (queue) => {
    if (queue?.metadata?.channel) {
        queue.metadata.channel.send('❎ Bot đã bị ngắt kết nối khỏi kênh thoại.');
    }
});

// (Tuỳ chọn) Log debug chi tiết khi cần tracking lỗi sâu hơn
// player.on('debug', (queue, message) => {
//     console.debug(`DEBUG - ${queue.guild.name}: ${message}`);
// });
// --- Kết thúc cấu hình Discord Player ---

// Command "/" schedule
bot.on("interactionCreate", async (interaction) => {

  if (interaction.isCommand()){
    switch (interaction.commandName) {
      case "music": {
       await handleMusicCommand(interaction, player);
        break; 
      }

    }}});


bot.once("ready", async () => {
console.log("✅ Bot is now online!");
scheduleMessages(bot);

});


keepAlive()
bot.login(process.env.DISCORD_TOKEN) // Sử dụng token từ biến môi trường
  .catch((err) => console.error("❌ Login failed:", err));
