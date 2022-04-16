console.log("hello world!");

const log4js = require('log4js');
log4js.configure({
	appenders : {
		system : {type : 'file', filename : 'system.log'}
	},
	categories : {
		default : {appenders : ['system'], level : 'debug'},
	}
});
const logger = log4js.getLogger('system');

const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const jimp = require('jimp');

const mysql = require('mysql2/promise');

// MEMO: 設定項目はここを参考にした
// https://github.com/sidorares/node-mysql2#api-and-configuration
// https://github.com/mysqljs/mysql
const mysqlOption = {
	host: 'mysql',
	user: 'backend',
	password: 'backend',
	database: 'app',
	waitForConnections: true,
	connectionLimit: 10,
};
const pool = mysql.createPool(mysqlOption);

const mylog = (obj) => {
	const a = false;
	if (a && Array.isArray(obj)) {
		for (const e of obj) {
			logger.debug(e);
		}
		return;
	}
	logger.debug(obj);
};

const getLinkedUser = async (headers) => {
	const target = headers['x-app-key'];
	mylog(target);
	//const qs = `SELECT * FROM session WHERE value = ?`;

	const [rows] = await pool.query(`SELECT s.linked_user_id FROM session s WHERE s.value = '${target}' LIMIT 1`);

	if (rows.length !== 1) {
		mylog('セッションが見つかりませんでした。');
		return undefined;
	}
	return { user_id: rows[0].linked_user_id };
};

const filePath = 'file/';

// POST /records
// 申請情報登録
const postRecords = async (req, res) => {
	let user = await getLinkedUser(req.headers);

	if (!user) {
		res.status(401).send();
		return;
	}
	mylog(user);

	let [rows] = await pool.query( `SELECT m.group_id FROM group_member m WHERE m.user_id = ? AND m.is_primary = true LIMIT 1`, [user.user_id],);

	if (rows.length !== 1) {
		mylog('申請者のプライマリ組織の解決に失敗しました。');
		res.status(400).send();
		return;
	}

	const userPrimary = rows[0];
	mylog(userPrimary);

	const newId = uuidv4();
	const body = req.body;
	mylog(body);

	await pool.query( `INSERT INTO record
	(record_id, status, title, detail, category_id, application_group, created_by, created_at, updated_at)
	VALUES
	  (?, "open", ?, ?, ?, ?, ?, now(), now())`,
		[ newId, `${body.title}`, `${body.detail}`, body.categoryId, userPrimary.group_id, user.user_id, ],
	);

	let query = '';
	let args = []
	for (const e of body.fileIdList) {
		query += ',(?, ?, ?, now())';
		args.push([newId, `${e.fileId}`, `${e.thumbFileId}`]);
	}

	const	insertQs =  `INSERT INTO record_item_file
		(linked_record_id, linked_file_id, linked_thumbnail_file_id, created_at)
		VALUES ` + query.substr(1);
	mylog(insertQs);
	mylog(args);
	await pool.query(insertQs, args,);

	res.send({ recordId: newId });
};

// GET /records/{recordId}
// 文書詳細取得
const getRecord = async (req, res) => {
	let user = await getLinkedUser(req.headers);

	if (!user) {
		res.status(401).send();
		return;
	}

	const recordId = req.params.recordId; 

	const [recordResult] = await pool.query(`SELECT * FROM record WHERE record_id = ? LIMIT 1`, [`${recordId}`]);
	mylog(recordResult);

	if (recordResult.length !== 1) {
		res.status(404).send({});
		return;
	}
	const line = recordResult[0];
	let recordInfo = {
		recordId: '',
		status: '',
		title: '',
		detail: '',
		categoryId: null,
		categoryName: '',
		applicationGroup: '',
		applicationGroupName: null,
		createdBy: null,
		createdByName: null,
		createdByPrimaryGroupName: null,
		createdAt: null,
		files: [],
	};
	recordInfo.recordId = line.record_id;
	recordInfo.status = line.status;
	recordInfo.title = line.title;
	recordInfo.detail = line.detail;
	recordInfo.categoryId = line.category_id;
	recordInfo.applicationGroup = line.application_group;
	recordInfo.createdBy = line.created_by;
	recordInfo.createdAt = line.created_at;

	const searchPrimaryGroupQs = `SELECT * FROM group_info i WHERE EXISTS 
	(SELECT m.group_id FROM group_member m
	WHERE m.user_id = ? AND m.is_primary = true AND i.group_id = m.group_id LIMIT 1) LIMIT 1`;
	const [primaryResult] = await pool.query(searchPrimaryGroupQs, [line.created_by]);
	if (primaryResult.length === 1) {
		recordInfo.createdByPrimaryGroupName = primaryResult[0].name;
	}

	const searchGroupQs = `SELECT i.name FROM group_info i WHERE i.group_id = ? LIMIT 1`;
	const [appGroupResult] = await pool.query(searchGroupQs, [line.application_group]);
	if (appGroupResult.length === 1) {
		recordInfo.applicationGroupName = appGroupResult[0].name;
	}

	const searchUserQs = `SELECT u.name FROM user u WHERE u.user_id = ? LIMIT 1`;
	const [userResult] = await pool.query(searchUserQs, [line.created_by]);
	if (userResult.length === 1) {
		recordInfo.createdByName = userResult[0].name;
	}

	const searchCategoryQs = `SELECT c.name FROM category c WHERE c.category_id = ? LIMIT 1`;
	const [categoryResult] = await pool.query(searchCategoryQs, [line.category_id]);
	if (categoryResult.length === 1) {
		recordInfo.categoryName = categoryResult[0].name;
	}

	//const searchItemQs = `SELECT * FROM record_item_file i WHERE i.linked_record_id = ? ORDER BY item_id ASC `;
	//const searchFileQs = `SELECT f.name FROM file f WHERE f.file_id = ?`;
	const searchFileNameQs = `SELECT i.item_id, f.name FROM file f LEFT JOIN record_item_file i ON f.file_id = i.linked_file_id  WHERE i.linked_record_id = ? ORDER BY i.item_id ASC`;
	const [itemResult] = await pool.query(searchFileNameQs, [`${line.record_id}`]);

	for (let i = 0; i < itemResult.length; i++) {
		const item = itemResult[i];
		recordInfo.files.push({ itemId: item.item_id, name: item.name });
	}
	mylog('itemResult');
	mylog(itemResult);

	await pool.query(
		`INSERT INTO record_last_access
	(record_id, user_id, access_time)
	VALUES
	(?, ?, now())
	ON DUPLICATE KEY UPDATE access_time = now()`,
		[`${recordId}`, `${user.user_id}`],
	);

	res.send(recordInfo);
};

// GET /record-views/tomeActive
// 自分宛一覧
const tomeActive = async (req, res) => {
	let user = await getLinkedUser(req.headers);
	if (!user) {
		res.status(401).send();
		return;
	}

	let offset = Number(req.query.offset);
	let limit = Number(req.query.limit);

	if (Number.isNaN(offset) || Number.isNaN(limit)) {
		offset = 0;
		limit = 10;
	}

	const searchMyGroupQs = `SELECT * FROM group_member WHERE user_id = ?`;
	const [myGroupResult] = await pool.query(searchMyGroupQs, [user.user_id]);
	mylog(myGroupResult);

	const targetCategoryAppGroupList = [];

	for (let i = 0; i < myGroupResult.length; i++) {
		const groupId = myGroupResult[i].group_id;
		mylog(groupId);

		const searchTargetQs = `SELECT c.category_id, c.application_group FROM category_group c WHERE c.group_id = ?`;
		const [targetResult] = await pool.query(searchTargetQs, [groupId]);
		for (let j = 0; j < targetResult.length; j++) {
			const targetLine = targetResult[j];
			mylog(targetLine);

			targetCategoryAppGroupList.push({
				categoryId: targetLine.category_id,
				applicationGroup: targetLine.application_group,
			});
		}
	}

	let searchRecordQs =
		'SELECT * FROM record WHERE status = "open" and (category_id, application_group) in (';
	let recordCountQs =
		'SELECT count(*) FROM record WHERE status = "open" and (category_id, application_group) in (';
	const param = [];

	for (let i = 0; i < targetCategoryAppGroupList.length; i++) {
		if (i !== 0) {
			searchRecordQs += ', (?, ?)';
			recordCountQs += ', (?, ?)';
		} else {
			searchRecordQs += ' (?, ?)';
			recordCountQs += ' (?, ?)';
		}
		param.push(targetCategoryAppGroupList[i].categoryId);
		param.push(targetCategoryAppGroupList[i].applicationGroup);
	}
	searchRecordQs += ' ) ORDER BY updated_at DESC , record_id  limit ? offset ?';
	recordCountQs += ' )';
	param.push(limit);
	param.push(offset);
	mylog(searchRecordQs);
	mylog(param);

	const [recordResult] = await pool.query(searchRecordQs, param);
	mylog(recordResult);

	const items = Array(recordResult.length);
	let count = 0;

	const searchUserQs = 'SELECT * FROM user WHERE user_id = ?';
	const searchGroupQs = 'SELECT * FROM group_info WHERE group_id = ?';
	const searchThumbQs =
		'SELECT * FROM record_item_file WHERE linked_record_id = ? ORDER BY item_id ASC  limit 1';
	const countQs = 'SELECT count(*) FROM record_comment WHERE linked_record_id = ?';
	const searchLastQs = 'SELECT * FROM record_last_access WHERE user_id = ? and record_id = ?';

	for (let i = 0; i < recordResult.length; i++) {
		const resObj = {
			recordId: null,
			title: '',
			applicationGroup: null,
			applicationGroupName: null,
			createdBy: null,
			createdByName: null,
			createAt: '',
			commentCount: 0,
			isUnConfirmed: true,
			thumbNailItemId: null,
			updatedAt: '',
		};

		const line = recordResult[i];
		mylog(line);
		const recordId = recordResult[i].record_id;
		const createdBy = line.created_by;
		const applicationGroup = line.application_group;
		const updatedAt = line.updated_at;
		let createdByName = null;
		let applicationGroupName = null;
		let thumbNailItemId = null;
		let commentCount = 0;
		let isUnConfirmed = true;

		const [userResult] = await pool.query(searchUserQs, [createdBy]);
		if (userResult.length === 1) {
			createdByName = userResult[0].name;
		}

		const [groupResult] = await pool.query(searchGroupQs, [applicationGroup]);
		if (groupResult.length === 1) {
			applicationGroupName = groupResult[0].name;
		}

		const [itemResult] = await pool.query(searchThumbQs, [recordId]);
		if (itemResult.length === 1) {
			thumbNailItemId = itemResult[0].item_id;
		}

		const [countResult] = await pool.query(countQs, [recordId]);
		if (countResult.length === 1) {
			commentCount = countResult[0]['count(*)'];
		}

		const [lastResult] = await pool.query(searchLastQs, [user.user_id, recordId]);
		if (lastResult.length === 1) {
			mylog(updatedAt);
			const updatedAtNum = Date.parse(updatedAt);
			const accessTimeNum = Date.parse(lastResult[0].access_time);
			if (updatedAtNum <= accessTimeNum) {
				isUnConfirmed = false;
			}
		}

		resObj.recordId = recordId;
		resObj.title = line.title;
		resObj.applicationGroup = applicationGroup;
		resObj.applicationGroupName = applicationGroupName;
		resObj.createdBy = createdBy;
		resObj.createdByName = createdByName;
		resObj.createAt = line.created_at;
		resObj.commentCount = commentCount;
		resObj.isUnConfirmed = isUnConfirmed;
		resObj.thumbNailItemId = thumbNailItemId;
		resObj.updatedAt = updatedAt;

		items[i] = resObj;
	}

	const [recordCountResult] = await pool.query(recordCountQs, param);
	if (recordCountResult.length === 1) {
		count = recordCountResult[0]['count(*)'];
	}

	res.send({ count: count, items: items });
};

// GET /record-views/allActive
// 全件一覧
const allActive = async (req, res) => {
	let user = await getLinkedUser(req.headers);

	if (!user) {
		res.status(401).send();
		return;
	}

	let offset = Number(req.query.offset);
	let limit = Number(req.query.limit);

	if (Number.isNaN(offset) || Number.isNaN(limit)) {
		offset = 0;
		limit = 10;
	}

	const searchRecordQs = `SELECT * FROM record WHERE status = "open" ORDER BY updated_at DESC , record_id ASC  limit ? offset ?`;

	const [recordResult] = await pool.query(searchRecordQs, [limit, offset]);
	mylog(recordResult);

	const items = Array(recordResult.length);
	let count = 0;

	const searchUserQs = 'SELECT * FROM user WHERE user_id = ?';
	const searchGroupQs = 'SELECT * FROM group_info WHERE group_id = ?';
	const searchThumbQs =
		'SELECT * FROM record_item_file WHERE linked_record_id = ? ORDER BY item_id ASC  limit 1';
	const countQs = 'SELECT count(*) FROM record_comment WHERE linked_record_id = ?';
	const searchLastQs = 'SELECT * FROM record_last_access WHERE user_id = ? and record_id = ?';

	for (let i = 0; i < recordResult.length; i++) {
		const resObj = {
			recordId: null,
			title: '',
			applicationGroup: null,
			applicationGroupName: null,
			createdBy: null,
			createdByName: null,
			createAt: '',
			commentCount: 0,
			isUnConfirmed: true,
			thumbNailItemId: null,
			updatedAt: '',
		};

		const line = recordResult[i];
		mylog(line);
		const recordId = recordResult[i].record_id;
		const createdBy = line.created_by;
		const applicationGroup = line.application_group;
		const updatedAt = line.updated_at;
		let createdByName = null;
		let applicationGroupName = null;
		let thumbNailItemId = null;
		let commentCount = 0;
		let isUnConfirmed = true;

		const [userResult] = await pool.query(searchUserQs, [createdBy]);
		if (userResult.length === 1) {
			createdByName = userResult[0].name;
		}

		const [groupResult] = await pool.query(searchGroupQs, [applicationGroup]);
		if (groupResult.length === 1) {
			applicationGroupName = groupResult[0].name;
		}

		const [itemResult] = await pool.query(searchThumbQs, [recordId]);
		if (itemResult.length === 1) {
			thumbNailItemId = itemResult[0].item_id;
		}

		const [countResult] = await pool.query(countQs, [recordId]);
		if (countResult.length === 1) {
			commentCount = countResult[0]['count(*)'];
		}

		const [lastResult] = await pool.query(searchLastQs, [user.user_id, recordId]);
		if (lastResult.length === 1) {
			mylog(updatedAt);
			const updatedAtNum = Date.parse(updatedAt);
			const accessTimeNum = Date.parse(lastResult[0].access_time);
			if (updatedAtNum <= accessTimeNum) {
				isUnConfirmed = false;
			}
		}

		resObj.recordId = recordId;
		resObj.title = line.title;
		resObj.applicationGroup = applicationGroup;
		resObj.applicationGroupName = applicationGroupName;
		resObj.createdBy = createdBy;
		resObj.createdByName = createdByName;
		resObj.createAt = line.created_at;
		resObj.commentCount = commentCount;
		resObj.isUnConfirmed = isUnConfirmed;
		resObj.thumbNailItemId = thumbNailItemId;
		resObj.updatedAt = updatedAt;

		items[i] = resObj;
	}

	const recordCountQs = 'SELECT count(*) FROM record WHERE status = "open"';

	const [recordCountResult] = await pool.query(recordCountQs);
	if (recordCountResult.length === 1) {
		count = recordCountResult[0]['count(*)'];
	}

	res.send({ count: count, items: items });
};

// GET /record-views/allClosed
// クローズ一覧
const allClosed = async (req, res) => {
	let user = await getLinkedUser(req.headers);

	if (!user) {
		res.status(401).send();
		return;
	}

	let offset = Number(req.query.offset);
	let limit = Number(req.query.limit);

	if (Number.isNaN(offset) || Number.isNaN(limit)) {
		offset = 0;
		limit = 10;
	}

	const searchRecordQs = `SELECT * FROM record WHERE status = "closed" ORDER BY updated_at DESC , record_id ASC  limit ? offset ?`;

	const [recordResult] = await pool.query(searchRecordQs, [limit, offset]);
	mylog(recordResult);

	const items = Array(recordResult.length);
	let count = 0;

	const searchUserQs = 'SELECT * FROM user WHERE user_id = ?';
	const searchGroupQs = 'SELECT * FROM group_info WHERE group_id = ?';
	const searchThumbQs =
		'SELECT * FROM record_item_file WHERE linked_record_id = ? ORDER BY item_id ASC  limit 1';
	const countQs = 'SELECT count(*) FROM record_comment WHERE linked_record_id = ?';
	const searchLastQs = 'SELECT * FROM record_last_access WHERE user_id = ? and record_id = ?';

	for (let i = 0; i < recordResult.length; i++) {
		const resObj = {
			recordId: null,
			title: '',
			applicationGroup: null,
			applicationGroupName: null,
			createdBy: null,
			createdByName: null,
			createAt: '',
			commentCount: 0,
			isUnConfirmed: true,
			thumbNailItemId: null,
			updatedAt: '',
		};

		const line = recordResult[i];
		mylog(line);
		const recordId = recordResult[i].record_id;
		const createdBy = line.created_by;
		const applicationGroup = line.application_group;
		const updatedAt = line.updated_at;
		let createdByName = null;
		let applicationGroupName = null;
		let thumbNailItemId = null;
		let commentCount = 0;
		let isUnConfirmed = true;

		const [userResult] = await pool.query(searchUserQs, [createdBy]);
		if (userResult.length === 1) {
			createdByName = userResult[0].name;
		}

		const [groupResult] = await pool.query(searchGroupQs, [applicationGroup]);
		if (groupResult.length === 1) {
			applicationGroupName = groupResult[0].name;
		}

		const [itemResult] = await pool.query(searchThumbQs, [recordId]);
		if (itemResult.length === 1) {
			thumbNailItemId = itemResult[0].item_id;
		}

		const [countResult] = await pool.query(countQs, [recordId]);
		if (countResult.length === 1) {
			commentCount = countResult[0]['count(*)'];
		}

		const [lastResult] = await pool.query(searchLastQs, [user.user_id, recordId]);
		if (lastResult.length === 1) {
			mylog(updatedAt);
			const updatedAtNum = Date.parse(updatedAt);
			const accessTimeNum = Date.parse(lastResult[0].access_time);
			if (updatedAtNum <= accessTimeNum) {
				isUnConfirmed = false;
			}
		}

		resObj.recordId = recordId;
		resObj.title = line.title;
		resObj.applicationGroup = applicationGroup;
		resObj.applicationGroupName = applicationGroupName;
		resObj.createdBy = createdBy;
		resObj.createdByName = createdByName;
		resObj.createAt = line.created_at;
		resObj.commentCount = commentCount;
		resObj.isUnConfirmed = isUnConfirmed;
		resObj.thumbNailItemId = thumbNailItemId;
		resObj.updatedAt = updatedAt;

		items[i] = resObj;
	}

	const recordCountQs = 'SELECT count(*) FROM record WHERE status = "closed"';

	const [recordCountResult] = await pool.query(recordCountQs);
	if (recordCountResult.length === 1) {
		count = recordCountResult[0]['count(*)'];
	}

	res.send({ count: count, items: items });
};

// GET /record-views/mineActive
// 自分が申請一覧
const mineActive = async (req, res) => {
	let user = await getLinkedUser(req.headers);

	if (!user) {
		res.status(401).send();
		return;
	}

	let offset = Number(req.query.offset);
	let limit = Number(req.query.limit);

	if (Number.isNaN(offset) || Number.isNaN(limit)) {
		offset = 0;
		limit = 10;
	}

	const searchRecordQs = `SELECT * FROM record WHERE created_by = ? and status = "open" ORDER BY updated_at DESC , record_id ASC  limit ? offset ?`;

	const [recordResult] = await pool.query(searchRecordQs, [user.user_id, limit, offset]);
	mylog(recordResult);

	const items = Array(recordResult.length);
	let count = 0;

	const searchUserQs = 'SELECT * FROM user WHERE user_id = ?';
	const searchGroupQs = 'SELECT * FROM group_info WHERE group_id = ?';
	const searchThumbQs =
		'SELECT * FROM record_item_file WHERE linked_record_id = ? ORDER BY item_id ASC  limit 1';
	const countQs = 'SELECT count(*) FROM record_comment WHERE linked_record_id = ?';
	const searchLastQs = 'SELECT * FROM record_last_access WHERE user_id = ? and record_id = ?';

	for (let i = 0; i < recordResult.length; i++) {
		const resObj = {
			recordId: null,
			title: '',
			applicationGroup: null,
			applicationGroupName: null,
			createdBy: null,
			createdByName: null,
			createAt: '',
			commentCount: 0,
			isUnConfirmed: true,
			thumbNailItemId: null,
			updatedAt: '',
		};

		const line = recordResult[i];
		mylog(line);
		const recordId = recordResult[i].record_id;
		const createdBy = line.created_by;
		const applicationGroup = line.application_group;
		const updatedAt = line.updated_at;
		let createdByName = null;
		let applicationGroupName = null;
		let thumbNailItemId = null;
		let commentCount = 0;
		let isUnConfirmed = true;

		const [userResult] = await pool.query(searchUserQs, [createdBy]);
		if (userResult.length === 1) {
			createdByName = userResult[0].name;
		}

		const [groupResult] = await pool.query(searchGroupQs, [applicationGroup]);
		if (groupResult.length === 1) {
			applicationGroupName = groupResult[0].name;
		}

		const [itemResult] = await pool.query(searchThumbQs, [recordId]);
		if (itemResult.length === 1) {
			thumbNailItemId = itemResult[0].item_id;
		}

		const [countResult] = await pool.query(countQs, [recordId]);
		if (countResult.length === 1) {
			commentCount = countResult[0]['count(*)'];
		}

		const [lastResult] = await pool.query(searchLastQs, [user.user_id, recordId]);
		if (lastResult.length === 1) {
			mylog(updatedAt);
			const updatedAtNum = Date.parse(updatedAt);
			const accessTimeNum = Date.parse(lastResult[0].access_time);
			if (updatedAtNum <= accessTimeNum) {
				isUnConfirmed = false;
			}
		}

		resObj.recordId = recordId;
		resObj.title = line.title;
		resObj.applicationGroup = applicationGroup;
		resObj.applicationGroupName = applicationGroupName;
		resObj.createdBy = createdBy;
		resObj.createdByName = createdByName;
		resObj.createAt = line.created_at;
		resObj.commentCount = commentCount;
		resObj.isUnConfirmed = isUnConfirmed;
		resObj.thumbNailItemId = thumbNailItemId;
		resObj.updatedAt = updatedAt;

		items[i] = resObj;
	}

	const recordCountQs = 'SELECT count(*) FROM record WHERE created_by = ? and status = "open"';

	const [recordCountResult] = await pool.query(recordCountQs, [user.user_id]);
	if (recordCountResult.length === 1) {
		count = recordCountResult[0]['count(*)'];
	}

	res.send({ count: count, items: items });
};

// PUT records/{recordId}
// 申請更新
const updateRecord = async (req, res) => {
	let user = await getLinkedUser(req.headers);

	if (!user) {
		res.status(401).send();
		return;
	}

	const recordId = req.params.recordId;
	const status = req.body.status;

	await pool.query(`UPDATE record SET status = ? WHERE record_id = ?`, [
		`${status}`,
		`${recordId}`,
	]);

	res.send({});
};

// GET records/{recordId}/comments
// コメントの取得
const getComments = async (req, res) => {
	let user = await getLinkedUser(req.headers);

	if (!user) {
		res.status(401).send();
		return;
	}

	const recordId = req.params.recordId;

	const commentQs = `SELECT * FROM record_comment WHERE linked_record_id = ? ORDER BY created_at DESC `;

	const [commentResult] = await pool.query(commentQs, [`${recordId}`]);
	mylog(commentResult);

	const commentList = Array(commentResult.length);

	const searchPrimaryGroupQs = `SELECT * FROM group_member WHERE user_id = ? and is_primary = true`;
	const searchUserQs = `SELECT * FROM user WHERE user_id = ?`;
	const searchGroupQs = `SELECT * FROM group_info WHERE group_id = ?`;
	for (let i = 0; i < commentResult.length; i++) {
		let commentInfo = {
			commentId: '',
			value: '',
			createdBy: null,
			createdByName: null,
			createdByPrimaryGroupName: null,
			createdAt: null,
		};
		const line = commentResult[i];

		const [primaryResult] = await pool.query(searchPrimaryGroupQs, [line.created_by]);
		if (primaryResult.length === 1) {
			const primaryGroupId = primaryResult[0].group_id;

			const [groupResult] = await pool.query(searchGroupQs, [primaryGroupId]);
			if (groupResult.length === 1) {
				commentInfo.createdByPrimaryGroupName = groupResult[0].name;
			}
		}

		const [userResult] = await pool.query(searchUserQs, [line.created_by]);
		if (userResult.length === 1) {
			commentInfo.createdByName = userResult[0].name;
		}

		commentInfo.commentId = line.comment_id;
		commentInfo.value = line.value;
		commentInfo.createdBy = line.created_by;
		commentInfo.createdAt = line.created_at;

		commentList[i] = commentInfo;
	}

	for (const row of commentList) {
		mylog(row);
	}

	res.send({ items: commentList });
};

// POST records/{recordId}/comments
// コメントの投稿
const postComments = async (req, res) => {
	let user = await getLinkedUser(req.headers);

	if (!user) {
		res.status(401).send();
		return;
	}

	const recordId = req.params.recordId;
	const value = req.body.value;

	await pool.query(
		` INSERT INTO record_comment
	(linked_record_id, value, created_by, created_at)
	VALUES (?,?,?, now());`,
		[`${recordId}`, `${value}`, user.user_id],
	);

	await pool.query(
		` UPDATE record SET updated_at = now() WHERE record_id = ?;`,
		[`${recordId}`],
	);

	res.send({});
};

// GET categories/
// カテゴリーの取得
const getCategories = async (req, res) => {
	let user = await getLinkedUser(req.headers);

	if (!user) {
		res.status(401).send();
		return;
	}

	const [rows] = await pool.query(`SELECT name, category_id FROM category`);

	const items = {};

	for (let i = 0; i < rows.length; i++) {
		items[`${rows[i]['category_id']}`] = { name: rows[i].name };
	}

	res.send({ items });
};

// POST files/
// ファイルのアップロード
const postFiles = async (req, res) => {
	let user = await getLinkedUser(req.headers);

	if (!user) {
		res.status(401).send();
		return;
	}

	const base64Data = req.body.data;
	mylog(base64Data);

	const name = req.body.name;

	const newId = uuidv4();
	const newThumbId = uuidv4();

	const binary = Buffer.from(base64Data, 'base64');

	fs.writeFileSync(`${filePath}${newId}_${name}`, binary);

	const image = await jimp.read(fs.readFileSync(`${filePath}${newId}_${name}`));
	mylog(image.bitmap.width);
	mylog(image.bitmap.height);

	const size = image.bitmap.width < image.bitmap.height ? image.bitmap.width : image.bitmap.height;
	await image.cover(size, size);

	await image.writeAsync(`${filePath}${newThumbId}_thumb_${name}`);

	await pool.query(
		`INSERT INTO file (file_id, path, name)
		VALUES (?, ?, ?)`,
		[`${newId}`, `${filePath}${newId}_${name}`, `${name}`],
	);
	await pool.query(
		`INSERT INTO file (file_id, path, name)
		VALUES (?, ?, ?)`,
		[`${newThumbId}`, `${filePath}${newThumbId}_thumb_${name}`, `thumb_${name}`],
	);

	res.send({ fileId: newId, thumbFileId: newThumbId });
};

// GET records/{recordId}/files/{itemId}
// 添付ファイルのダウンロード
const getRecordItemFile = async (req, res) => {
	let user = await getLinkedUser(req.headers);

	if (!user) {
		res.status(401).send();
		return;
	}

	const recordId = req.params.recordId;
	mylog(recordId);
	const itemId = Number(req.params.itemId);
	mylog(itemId);

	const [rows] = await pool.query(
		`SELECT f.name, f.path FROM record_item_file r
	inner join file f
	on
	r.linked_record_id = ?
	and
	r.item_id = ?
	and
	r.linked_file_id = f.file_id`,
		[`${recordId}`, `${itemId}`],
	);

	if (rows.length !== 1) {
		res.status(404).send({});
		return;
	}
	mylog(rows[0]);

	const fileInfo = rows[0];

	const data = fs.readFileSync(fileInfo.path);
	const base64 = data.toString('base64');
	mylog(base64);

	res.send({ data: base64, name: fileInfo.name });
};

// GET records/{recordId}/files/{itemId}/thumbnail
// 添付ファイルのサムネイルダウンロード
const getRecordItemFileThumbnail = async (req, res) => {
	let user = await getLinkedUser(req.headers);

	if (!user) {
		res.status(401).send();
		return;
	}

	const recordId = req.params.recordId;
	mylog(recordId);
	const itemId = Number(req.params.itemId);
	mylog(itemId);

	const [rows] = await pool.query(
		`SELECT f.name, f.path FROM record_item_file r
	inner join file f
	on
	r.linked_record_id = ?
	and
	r.item_id = ?
	and
	r.linked_thumbnail_file_id = f.file_id`,
		[`${recordId}`, `${itemId}`],
	);

	if (rows.length !== 1) {
		res.status(404).send({});
		return;
	}
	mylog(rows[0]);

	const fileInfo = rows[0];

	const data = fs.readFileSync(fileInfo.path);
	const base64 = data.toString('base64');
	mylog(base64);

	res.send({ data: base64, name: fileInfo.name });
};

module.exports = {
	postRecords,
	getRecord,
	tomeActive,
	allActive,
	allClosed,
	mineActive,
	updateRecord,
	getComments,
	postComments,
	getCategories,
	postFiles,
	getRecordItemFile,
	getRecordItemFileThumbnail,
};
