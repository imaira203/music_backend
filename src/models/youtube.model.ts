export interface VideoInfo {
    id: string;
    title: string;
    artist?: string;
    duration?: string;
    thumbnailUrl?: string;
    videoId: string;
    formats?: any[];
    adaptiveFormats?: any[];
}

export interface AudioStream {
    videoId: string;
    audioUrl: string;
    artist: string;
    title: string;
    thumbnailUrl: string;
    quality?: number;
    mimeType?: string;
    contentLength?: string;
    expires: string;
}

export interface SearchResult {
    id: string;
    title: string;
    artist?: string;
    duration?: string;
    thumbnailUrl?: string;
    videoId: string;
}

export interface PlaylistInfo {
    id: string;
    title: string;
    thumbnailUrl?: string;
    videoCount?: number;
    songs: SearchResult[];
}

export interface VideoInfoWithAudio extends VideoInfo {
    audioStream: AudioStream;
}
