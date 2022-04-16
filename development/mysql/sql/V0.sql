CREATE TABLE `user` (
    `user_id` bigint NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(32) NOT NULL,
    `kana` VARCHAR(32) NOT NULL,
    PRIMARY KEY (`user_id`)
);

CREATE TABLE `group_info` (
    `group_id` bigint NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(32) NOT NULL,
    `kana` VARCHAR(32) NOT NULL,
    PRIMARY KEY (`group_id`)
);

CREATE TABLE `group_member` (
    `group_id` bigint NOT NULL,
    `user_id` bigint NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (`group_id`, `user_id`)
);

CREATE TABLE `record` (
    `record_id` VARCHAR(64) NOT NULL,
    `status` VARCHAR(16) NOT NULL,
    `title` VARCHAR(128) NOT NULL,
    `detail` VARCHAR(512) NOT NULL,
    `category_id` bigint NOT NULL,
    `application_group` bigint NOT NULL,
    `created_by` bigint NOT NULL,
    `created_at` TIMESTAMP NOT NULL,
    `updated_at` TIMESTAMP NOT NULL,
    PRIMARY KEY (`record_id`)
);

CREATE TABLE `record_item_file` (
    `item_id` bigint NOT NULL AUTO_INCREMENT,
    `linked_record_id` VARCHAR(64) NOT NULL,
    `linked_file_id` VARCHAR(64) NOT NULL,
    `linked_thumbnail_file_id` VARCHAR(64) NOT NULL,
    `created_at` TIMESTAMP NOT NULL,
    PRIMARY KEY (`item_id`)
);

CREATE TABLE `record_last_access` (
    `record_id` VARCHAR(64) NOT NULL,
    `user_id` bigint NOT NULL,
    `access_time` TIMESTAMP NOT NULL,
    PRIMARY KEY (`record_id`, `user_id`)
);

CREATE TABLE `record_comment` (
    `comment_id` bigint NOT NULL AUTO_INCREMENT,
    `linked_record_id` VARCHAR(64) NOT NULL,
    `value` VARCHAR(512) NOT NULL,
    `created_by` bigint NOT NULL,
    `created_at` TIMESTAMP NOT NULL,
    PRIMARY KEY (`comment_id`)
);

CREATE TABLE `category` (
    `category_id` bigint NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(32) NOT NULL,
    PRIMARY KEY (`category_id`)
);

CREATE TABLE `category_group` (
    `group_id` bigint NOT NULL,
    `category_id` bigint NOT NULL,
    `application_group` bigint NOT NULL,
    PRIMARY KEY (`group_id`,`category_id`, `application_group`)
);

CREATE TABLE `session` (
    `session_id` bigint NOT NULL AUTO_INCREMENT,
    `value` VARCHAR(256) NOT NULL,
    `linked_user_id` bigint NOT NULL,
    `created_at` TIMESTAMP NOT NULL,
    PRIMARY KEY (`session_id`)
);

CREATE TABLE `file` (
    `file_id` VARCHAR(64) NOT NULL,
    `path` VARCHAR(1024) NOT NULL,
    `name` VARCHAR(256) NOT NULL,
    PRIMARY KEY (`file_id`)
);

ALTER TABLE `category_group` ADD INDEX `application_group_index` (`application_group`);
ALTER TABLE `category_group` ADD INDEX `group_id_index` (`group_id`);

ALTER TABLE `file` ADD INDEX `file_id_index` (`file_id`);
-- ALTER TABLE `file` ADD INDEX `path_index` (`path`);

ALTER TABLE `group_info` ADD INDEX `group_id_index` (`group_id`);

ALTER TABLE `group_member` ADD INDEX `group_id_index` (`group_id`);
ALTER TABLE `group_member` ADD INDEX `user_id_index` (`user_id`);

ALTER TABLE `record` ADD INDEX `record_id_index` (`record_id`);
ALTER TABLE `record` ADD INDEX `category_id_index` (`category_id`);
ALTER TABLE `record` ADD INDEX `application_group_index` (`application_group`);
ALTER TABLE `record` ADD INDEX `created_by_index` (`created_by`);
ALTER TABLE `record` ADD INDEX `created_at_index` (`created_at`);
ALTER TABLE `record` ADD INDEX `updated_at_index` (`updated_at`);

ALTER TABLE `record_comment` ADD INDEX `comment_id_index` (`comment_id`);
ALTER TABLE `record_comment` ADD INDEX `record_id_index` (`linked_record_id`);
ALTER TABLE `record_comment` ADD INDEX `created_by_index` (`created_by`);
ALTER TABLE `record_comment` ADD INDEX `created_at_index` (`created_at`);

ALTER TABLE `record_item_file` ADD INDEX `item_id_index` (`item_id`);
ALTER TABLE `record_item_file` ADD INDEX `record_id_index` (`linked_record_id`);
ALTER TABLE `record_item_file` ADD INDEX `file_id_index` (`linked_file_id`);
ALTER TABLE `record_item_file` ADD INDEX `thumb_id_index` (`linked_thumbnail_file_id`);
ALTER TABLE `record_item_file` ADD INDEX `created_at_index` (`created_at`);

ALTER TABLE `record_last_access` ADD INDEX `record_id_index` (`record_id`);
ALTER TABLE `record_last_access` ADD INDEX `user_id_index` (`user_id`);
ALTER TABLE `record_last_access` ADD INDEX `access_time_index` (`access_time`);

ALTER TABLE `session` ADD INDEX `session_id_index` (`session_id`);
ALTER TABLE `session` ADD INDEX `value_index` (`value`);
ALTER TABLE `session` ADD INDEX `user_id_index` (`linked_user_id`);
ALTER TABLE `session` ADD INDEX `created_at_index` (`created_at`);

ALTER TABLE `user` ADD INDEX `user_id_index` (`user_id`);

