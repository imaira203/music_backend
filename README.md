<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

# Music Backend

Backend API cho ứng dụng music sử dụng NestJS và YouTube Music API.

## Cài đặt

```bash
npm install
```

## Chạy ứng dụng

```bash
# Development
npm run start:dev

# Production
npm run start:prod
```

## API Routes

### YouTube API Routes

#### 1. Lấy thông tin video
```http
GET /youtube/video/:videoId
```

**Ví dụ:**
```http
GET /youtube/video/dQw4w9WgXcQ
```

**Response:**
```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "artist": "Rick Astley",
  "duration": "212",
  "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/sddefault.jpg",
  "videoId": "dQw4w9WgXcQ",
  "formats": [],
  "adaptiveFormats": []
}
```

#### 2. Lấy URL stream audio
```http
GET /youtube/audio/:videoId?quality=medium
```

**Parameters:**
- `quality`: `low` | `medium` | `high` (default: `medium`)

**Ví dụ:**
```http
GET /youtube/audio/dQw4w9WgXcQ?quality=high
```

**Response:**
```json
{
  "videoId": "dQw4w9WgXcQ",
  "audioUrl": "https://...",
  "quality": 128000,
  "mimeType": "audio/mp4",
  "contentLength": "3400000",
  "expires": "2024-01-01T12:00:00.000Z"
}
```

#### 3. Stream audio trực tiếp
```http
GET /youtube/stream/:videoId?quality=medium
```

**Ví dụ:**
```http
GET /youtube/stream/dQw4w9WgXcQ?quality=medium
```

**Response:** Audio stream trực tiếp

#### 4. Lấy danh sách video đề xuất
```http
GET /youtube/related/:videoId?limit=20
```

**Parameters:**
- `limit`: Số lượng video (default: 20)

**Ví dụ:**
```http
GET /youtube/related/dQw4w9WgXcQ?limit=10
```

#### 5. Tìm kiếm video
```http
GET /youtube/search?q=query&limit=20
```

**Parameters:**
- `q`: Từ khóa tìm kiếm (required)
- `limit`: Số lượng kết quả (default: 20)

**Ví dụ:**
```http
GET /youtube/search?q=never gonna give you up&limit=5
```

#### 6. Lấy playlist
```http
GET /youtube/playlist/:playlistId
```

**Ví dụ:**
```http
GET /youtube/playlist/PLbpi6ZahtOH6BlwajRGYqrXeqReWmvO4s
```

#### 7. Lấy thông tin video và audio stream cùng lúc
```http
GET /youtube/info/:videoId?quality=medium
```

**Ví dụ:**
```http
GET /youtube/info/dQw4w9WgXcQ?quality=high
```

**Response:**
```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up",
  "artist": "Rick Astley",
  "duration": "212",
  "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/sddefault.jpg",
  "videoId": "dQw4w9WgXcQ",
  "formats": [],
  "adaptiveFormats": [],
  "audioStream": {
    "videoId": "dQw4w9WgXcQ",
    "audioUrl": "https://...",
    "quality": 128000,
    "mimeType": "audio/mp4",
    "contentLength": "3400000",
    "expires": "2024-01-01T12:00:00.000Z"
  }
}
```

### Songs API Routes

#### 1. Lấy trang chủ
```http
GET /songs/home
```

#### 2. Lấy danh sách bài hát yêu thích
```http
GET /songs/liked
```

#### 3. Thích bài hát
```http
POST /songs/:id/like
```

#### 4. Bỏ thích bài hát
```http
POST /songs/:id/unlike
```

## Cấu trúc dự án

```
src/
├── models/
│   ├── song.model.ts
│   └── youtube.model.ts
├── songs/
│   ├── songs.controller.ts
│   ├── songs.service.ts
│   └── songs.module.ts
├── youtube/
│   ├── youtube.controller.ts
│   ├── youtube.service.ts
│   └── youtube.module.ts
├── app.controller.ts
├── app.service.ts
├── app.module.ts
└── main.ts
```

## Tính năng

- ✅ Lấy thông tin video từ YouTube
- ✅ Tạo URL stream audio
- ✅ Stream audio trực tiếp
- ✅ Tìm kiếm video
- ✅ Lấy danh sách đề xuất
- ✅ Lấy playlist
- ✅ Cache dữ liệu
- ✅ TypeScript support
- ✅ Error handling
- ✅ CORS support

## Lưu ý

- Audio stream URLs có thời hạn 6 giờ
- Cache được sử dụng để tối ưu hiệu suất
- Tất cả API routes đều hỗ trợ CORS
- Quality levels: `low` (≤64kbps), `medium` (64-128kbps), `high` (≥128kbps)
