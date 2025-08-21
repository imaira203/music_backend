import { Innertube } from 'youtubei.js';

async function getAudioUrl(videoId) {
    const yt = await Innertube.create();
    const info = await yt.getInfo(videoId);

    // Chọn định dạng audio (ví dụ mp4a 128k – itag phổ biến & tương đương format 140)
    const format = info.chooseFormat({ quality: 'highestaudio' });

    // URL stream đã giải mã:
    return format?.url;
}

getAudioUrl('oLMKcI-VNzc')
    .then(url => {
        if (url) console.log('Audio stream URL:', url);
        else console.error('Không tìm thấy format audio');
    })
    .catch(console.error);
