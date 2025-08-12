// import * as fs from 'fs';
// import FormData from 'form-data';
// import fetch from 'node-fetch';
// import { Injectable } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import { getData, filter } from '@hydralerne/youtube-api';

// @Injectable()
// export class UploadService {
//     constructor(private configService: ConfigService) { }

//     /**
//      * Upload audio-only stream của YouTube lên Cloudinary,
//      * và trả về audioUrl dạng MP3 (dùng transform f_mp3).
//      */
//     async uploadFile(videoId: string) {
//         const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
//         const preset = this.configService.get<string>('CLOUDINARY_CLOUD_PRESET');

//         // Lấy thông tin formats từ YouTube
//         const videoData = await getData(videoId);

//         // Kiểm tra và log để debug
//         console.log('Video data structure:', JSON.stringify(videoData, null, 2));

//         // Lấy formats array từ response
//         const formats = videoData.formats || videoData;

//         if (!Array.isArray(formats)) {
//             throw new Error(`Formats không phải array: ${typeof formats}`);
//         }

//         const bestAudio = filter(formats, 'bestaudio', { minBitrate: 128000, codec: 'mp4a' });

//         if (!bestAudio || !bestAudio.url) {
//             throw new Error('Không thể lấy audio stream từ YouTube');
//         }

//         console.log('Best audio format:', bestAudio);
//         console.log('Audio URL:', bestAudio.url);

//         // Download audio file từ YouTube
//         const audioResponse = await fetch(bestAudio.url);
//         if (!audioResponse.ok) {
//             throw new Error(`Không thể download audio: ${audioResponse.status}`);
//         }

//         const formData = new FormData();

//         // Upload audio stream trực tiếp lên Cloudinary (không cần Blob)
//         formData.append('file', audioResponse.body as any, {
//             filename: `${videoId}.${bestAudio.ext || 'webm'}`,
//             contentType: bestAudio.mimeType || 'audio/webm',
//         });

//         // Unsigned upload (cần cấu hình preset trong Cloudinary)
//         formData.append('upload_preset', preset);
//         // Tùy chọn - nếu preset cho phép:
//         // formData.append('public_id', `yt_${videoId}`);
//         // formData.append('overwrite', 'true');

//         const res = await fetch(
//             `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
//             { method: 'POST', body: formData as any },
//         );

//         if (!res.ok) {
//             const text = await res.text();
//             throw new Error(`Cloudinary upload failed: ${res.status} ${text}`);
//         }

//         const json = await res.json() as {
//             secure_url: string;
//             public_id: string;
//             version: number;
//             // ... các field khác của Cloudinary
//         };

//         // Tạo URL MP3 bằng transform f_mp3 (Cloudinary sẽ transcode lần đầu và cache).
//         // Dùng version + public_id để có URL chuẩn xác:
//         const mp3Url = buildCloudinaryTransformedUrl({
//             cloudName,
//             version: json.version,
//             publicId: json.public_id,
//             format: 'mp3',
//             transform: 'f_mp3',
//         });

//         return {
//             videoId,
//             audioUrl: mp3Url,                // <-- phát ổn trên Windows/iOS/macOS/Android
//             mimeType: 'audio/mpeg',
//             sourceUrl: json.secure_url,       // webm gốc (nếu cần debug)
//             thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hq720.jpg`,
//         };
//     }

//     /**
//      * Batch nhiều videoId → mảng kết quả như trên.
//      */
//     async uploadBatch(videoIds: string[]) {
//         const results = [];
//         for (const id of videoIds) {
//             try {
//                 const one = await this.uploadFile(id);
//                 results.push(one);
//             } catch (e) {
//                 // Không làm vỡ batch: push object lỗi tối giản
//                 results.push({
//                     videoId: id,
//                     error: (e as Error).message || 'upload_failed',
//                 });
//             }
//         }
//         return results;
//     }
// }

// /**
//  * Xây Cloudinary URL với transform (vd: f_mp3).
//  * video/upload/f_mp3/v<version>/<public_id>.mp3
//  */
// function buildCloudinaryTransformedUrl(opts: {
//     cloudName: string;
//     version: number | string;
//     publicId: string; // không chứa đuôi
//     format: 'mp3' | 'ogg' | 'aac';
//     transform: string; // ví dụ 'f_mp3'
// }) {
//     const { cloudName, version, publicId, format, transform } = opts;
//     // Chú ý: public_id có thể chứa folder (vd: folder/name)
//     return `https://res.cloudinary.com/${cloudName}/video/upload/${transform}/v${version}/${publicId}.${format}`;
// }
