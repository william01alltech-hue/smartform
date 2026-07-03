const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'app_data.sqlite');
const db = new Database(dbPath);

const row = db.prepare('SELECT data FROM tokens WHERE token = ?').get('william_master_token');
if (row) {
    const data = JSON.parse(row.data);
    data.subscriptionPlan = 'enterprise_20';
    data.subscriptionExpiresAt = new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000).toISOString(); // 10 years
    
    db.prepare('UPDATE tokens SET data = ? WHERE token = ?').run(JSON.stringify(data), 'william_master_token');
    console.log("Account william_master_token upgraded to enterprise_20 successfully!");
} else {
    console.log("Account william_master_token not found in local db!");
}
