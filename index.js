import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
const { createHmac } = await import('node:crypto');

dotenv.config();

const connection = await mysql.createConnection({
	host: process.env.DATABASE_HOST,
	port: process.env.DATABASE_PORT,
	user: process.env.DATABASE_USER,
	password: process.env.DATABASE_PASSWORD,
	database: process.env.DATABASE_NAME
});

connection.on('error', console.log);

const closeConnection = () => {
	connection.end();
	process.exit();
}

// get cli args
var args = process.argv.slice(2);

// check for username
if (!args || !args.length || !args[0]) {
	console.log('User name argument required.');
	closeConnection();
}

let username = args[0];

// check if username is taken
let [usernameResults] = await connection.execute(
	`
	SELECT * FROM user
	WHERE user_name = ?
	`,
	[username]
);

// found existing user
if (
	usernameResults.length &&
	usernameResults[0].user_id &&
	usernameResults[0].user_name === username
) {
	console.log(`User name '${username}' is taken.`);
} else {
	// create a new user and api_key
	let [newUser] = await connection.execute(
		`
		INSERT INTO user (user_name)
		VALUES (?)
		`,
		[username]
	);

	let user_id = newUser.insertId;

	// create new hash and insert new api_key row
	const rawApiKey = uuidv4();
	const hash = createHmac('sha256', rawApiKey)
		.update(process.env.API_KEY_SALT)
		.digest('hex');

	let [newApiKeyRow] = await connection.execute(
		`
		INSERT INTO api_key (
			api_key_user_id,
			api_key_value,
			api_key_usage_count,
			api_key_disabled
		)
		VALUES (?,?,?,?)
		`,
		[user_id, hash, 0, 0]
	);

	console.log(`New user '${username}' created. Your API key is: ${rawApiKey}`);
}

closeConnection();