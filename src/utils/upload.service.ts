import * as fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ytdl from '@distube/ytdl-core';

@Injectable()
export class UploadService {
    constructor(private configService: ConfigService) { }

    async uploadFile(videoId: string) {
        const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
        const preset = this.configService.get<string>('CLOUDINARY_CLOUD_PRESET');

        const formData = new FormData();
        formData.append('file', ytdl(videoId, { filter: 'audioonly', quality: 'highestaudio' }), `${videoId}.aac`);
        formData.append('upload_preset', preset);

        const res = await fetch(
            `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
            { method: 'POST', body: formData }
        );

        return await res.json();
    }
}
