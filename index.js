const { Client } = require('discord.js-selfbot-v13');
const { Manager } = require('erela.js');
const express = require('express');

const TOKEN = process.env.TOKEN;
const LAVALINK_HOST = process.env.LAVALINK_HOST;
const LAVALINK_PORT = process.env.LAVALINK_PORT;
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD;

const client = new Client();
let manager;

client.on('ready', () => {
  console.log(`${client.user.username} is online`);

  manager = new Manager({
    nodes: [
      {
        host: LAVALINK_HOST,
        port: Number(LAVALINK_PORT),
        password: LAVALINK_PASSWORD,
        secure: false,
      },
    ],
    send: (id, payload) => {
      const guild = client.guilds.cache.get(id);
      if (guild) guild.shard.send(payload);
    },
  });

  manager.init(client.user.id);
});

client.on('raw', (d) => manager.updateVoiceState(d));

client.on('messageCreate', async (msg) => {
  if (!msg.content.startsWith('!')) return;
  const args = msg.content.slice(1).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();
  const player = manager.players.get(msg.guild?.id);

  if (cmd === 'play') {
    const search = args.join(' ');
    if (!search) return msg.reply('❌ Provide a song name or URL.');

    const res = await manager.search(search, msg.author);
    if (!res.tracks.length) return msg.reply('❌ No results found.');

    const voiceChannel = msg.member.voice.channel;
    if (!voiceChannel) return msg.reply('❌ You must be in a voice channel.');

    const newPlayer = manager.create({
      guild: msg.guild.id,
      voiceChannel: voiceChannel.id,
      textChannel: msg.channel.id,
    });

    newPlayer.connect();
    newPlayer.queue.add(res.tracks[0]);
    if (!newPlayer.playing && !newPlayer.paused) newPlayer.play();

    msg.reply(`🎶 Queued: **${res.tracks[0].title}**`);
  }

  if (!player) return;

  switch (cmd) {
    case 'pause':
      if (player.paused) return msg.reply('⏸️ Already paused.');
      player.pause(true);
      return msg.reply('⏸️ Paused.');

    case 'resume':
      if (!player.paused) return msg.reply('▶️ Already playing.');
      player.pause(false);
      return msg.reply('▶️ Resumed.');

    case 'skip':
      player.stop();
      return msg.reply('⏭️ Skipped.');

    case 'stop':
      player.destroy();
      return msg.reply('⏹️ Stopped and disconnected.');

    case 'loop':
      player.setTrackRepeat(!player.trackRepeat);
      return msg.reply(player.trackRepeat ? '🔁 Loop enabled.' : '➡️ Loop disabled.');

    case 'queue':
      if (!player.queue.length) return msg.reply('📭 Queue is empty.');
      const queueMsg = player.queue
        .slice(0, 10)
        .map((track, i) => `${i + 1}. **${track.title}**`)
        .join('\n');
      return msg.reply(`🎶 Current Queue:\n${queueMsg}`);

    case 'np':
      return msg.reply(`🎧 Now Playing: **${player.queue.current?.title || 'Nothing'}**`);

    case 'clear':
      player.queue.clear();
      return msg.reply('🧹 Queue cleared.');
  }
});

// Keep Glitch alive
const app = express();
app.get('/', (req, res) => res.send('Bot is running.'));
app.listen(3000, () => console.log('Web server ready'));

client.login(TOKEN);
