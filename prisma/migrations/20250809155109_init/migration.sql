-- CreateTable
CREATE TABLE `Song` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `duration` INTEGER NULL,
    `audioUrl` TEXT NOT NULL,
    `thumbnailUrl` TEXT NULL,
    `description` TEXT NULL,
    `genre` VARCHAR(191) NULL,

    UNIQUE INDEX `Song_id_key`(`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
