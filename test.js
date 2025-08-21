import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function getAudioUrl(videoId) {
    try {
        // Gọi yt-dlp để lấy direct URL stream
        const { stdout } = await execAsync(
            `yt-dlp -f 140 -g https://www.youtube.com/watch?v=${videoId}`
        );
        const url = stdout.trim();

        return {
            url,
            itag: 140,
            mimeType: 'audio/mp4; codecs="mp4a.40.2"',
        };
    } catch (err) {
        console.error('yt-dlp error:', err);
        throw new Error('Không lấy được audio stream URL');
    }
}

// Test
getAudioUrl('dQw4w9WgXcQ').then(console.log).catch(console.error);
