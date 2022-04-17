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
ALTER TABLE `record` ADD INDEX `created_at_index` (`created_at` DESC);
ALTER TABLE `record` ADD INDEX `updated_at_index` (`updated_at` DESC);

ALTER TABLE `record_comment` ADD INDEX `comment_id_index` (`comment_id`);
ALTER TABLE `record_comment` ADD INDEX `record_id_index` (`linked_record_id`);
ALTER TABLE `record_comment` ADD INDEX `created_by_index` (`created_by`);
ALTER TABLE `record_comment` ADD INDEX `created_at_index` (`created_at` DESC);

ALTER TABLE `record_item_file` ADD INDEX `item_id_index` (`item_id`);
ALTER TABLE `record_item_file` ADD INDEX `record_id_index` (`linked_record_id`);
ALTER TABLE `record_item_file` ADD INDEX `file_id_index` (`linked_file_id`);
ALTER TABLE `record_item_file` ADD INDEX `thumb_id_index` (`linked_thumbnail_file_id`);
ALTER TABLE `record_item_file` ADD INDEX `created_at_index` (`created_at` DESC);

ALTER TABLE `record_last_access` ADD INDEX `record_id_index` (`record_id`);
ALTER TABLE `record_last_access` ADD INDEX `user_id_index` (`user_id`);
-- ALTER TABLE `record_last_access` ADD INDEX `access_time_index` (`access_time`);

ALTER TABLE `session` ADD INDEX `session_id_index` (`session_id`);
ALTER TABLE `session` ADD INDEX `value_index` (`value`);
ALTER TABLE `session` ADD INDEX `user_id_index` (`linked_user_id`);
ALTER TABLE `session` ADD INDEX `created_at_index` (`created_at` DESC);

ALTER TABLE `user` ADD INDEX `user_id_index` (`user_id`);
