#!/usr/bin/env node

const { Command } = require('commander');
const path = require('path');
const os = require('os');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const program = new Command();
const DB_PATH = process.env.DEADROP_DB || path.join(os.homedir(), '.openclaw', 'workspace', 'deadrop.sqlite');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
function initDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Create messages table if it doesn't exist
      db.run(`
        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          from_agent TEXT NOT NULL,
          to_agent TEXT NOT NULL,
          subject TEXT,
          body TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          read_at DATETIME
        )
      `, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(db);
        }
      });
    });
  });
}

// Send a message
async function sendMessage(to, from, subject, body) {
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO messages (from_agent, to_agent, subject, body)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run([from, to, subject, body], function(err) {
      if (err) {
        reject(err);
      } else {
        console.log(`✓ Message sent to ${to} (ID: ${this.lastID})`);
        resolve(this.lastID);
      }
      stmt.finalize();
      db.close();
    });
  });
}

// Check unread messages for an agent and mark as read
async function checkMessages(agent) {
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    // Get unread messages
    db.all(`
      SELECT * FROM messages 
      WHERE to_agent = ? AND read_at IS NULL 
      ORDER BY timestamp ASC
    `, [agent], (err, messages) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (messages.length === 0) {
        console.log('📭 No new messages');
        db.close();
        resolve([]);
        return;
      }
      
      // Mark messages as read
      const messageIds = messages.map(m => m.id);
      const placeholders = messageIds.map(() => '?').join(',');
      
      db.run(`
        UPDATE messages 
        SET read_at = CURRENT_TIMESTAMP 
        WHERE id IN (${placeholders})
      `, messageIds, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`📬 ${messages.length} new message(s):`);
          messages.forEach(msg => {
            console.log(`\n[${msg.id}] From: ${msg.from_agent}`);
            if (msg.subject) console.log(`Subject: ${msg.subject}`);
            console.log(`Time: ${msg.timestamp}`);
            console.log(`Message: ${msg.body}`);
            console.log('---');
          });
          resolve(messages);
        }
        db.close();
      });
    });
  });
}

// List messages in inbox
async function showInbox(agent, unreadOnly = false) {
  const db = await initDatabase();
  
  return new Promise((resolve, reject) => {
    let query = `SELECT * FROM messages WHERE to_agent = ?`;
    let params = [agent];
    
    if (unreadOnly) {
      query += ` AND read_at IS NULL`;
    }
    
    query += ` ORDER BY timestamp DESC`;
    
    db.all(query, params, (err, messages) => {
      if (err) {
        reject(err);
        return;
      }
      
      if (messages.length === 0) {
        console.log(unreadOnly ? '📭 No unread messages' : '📭 Empty inbox');
        db.close();
        resolve([]);
        return;
      }
      
      const unreadCount = messages.filter(m => !m.read_at).length;
      console.log(`📬 Inbox for ${agent} (${messages.length} total, ${unreadCount} unread):`);
      
      messages.forEach(msg => {
        const status = msg.read_at ? '✓' : '●';
        console.log(`\n[${msg.id}] ${status} From: ${msg.from_agent}`);
        if (msg.subject) console.log(`Subject: ${msg.subject}`);
        console.log(`Time: ${msg.timestamp}`);
        if (msg.read_at) console.log(`Read: ${msg.read_at}`);
        console.log(`Message: ${msg.body}`);
        console.log('---');
      });
      
      resolve(messages);
      db.close();
    });
  });
}

// CLI Commands
program
  .name('deadrop')
  .description('SQLite-backed message queue for reliable agent-to-agent communication')
  .version('1.0.0');

program
  .command('send')
  .description('Send a message to another agent')
  .requiredOption('--to <agent>', 'recipient agent name')
  .requiredOption('--from <agent>', 'sender agent name')
  .option('--subject <subject>', 'message subject')
  .requiredOption('--body <body>', 'message body')
  .action(async (options) => {
    try {
      await sendMessage(options.to, options.from, options.subject, options.body);
    } catch (error) {
      console.error('❌ Error sending message:', error.message);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Check for new messages and mark them as read')
  .requiredOption('--agent <agent>', 'agent name to check messages for')
  .action(async (options) => {
    try {
      await checkMessages(options.agent);
    } catch (error) {
      console.error('❌ Error checking messages:', error.message);
      process.exit(1);
    }
  });

program
  .command('inbox')
  .description('List all messages in inbox')
  .requiredOption('--agent <agent>', 'agent name to show inbox for')
  .option('--unread', 'show only unread messages')
  .action(async (options) => {
    try {
      await showInbox(options.agent, options.unread);
    } catch (error) {
      console.error('❌ Error showing inbox:', error.message);
      process.exit(1);
    }
  });

program
  .command('setup-cron')
  .description('Generate OpenClaw cron job configuration for automated inbox checking')
  .requiredOption('--agent <name>', 'agent name for inbox monitoring')
  .option('--interval <minutes>', 'polling interval in minutes (default: 10)', '10')
  .action((options) => {
    try {
      // Validate agent name
      if (!options.agent || options.agent.trim() === '') {
        console.error('Error: Agent name cannot be empty');
        console.error('Please provide a valid agent name (e.g., ralph, cody, scout)');
        process.exit(1);
      }

      // Validate and parse interval
      const interval = parseInt(options.interval);
      if (isNaN(interval)) {
        console.error('Error: Interval must be a positive number (minutes)');
        console.error('Example: deadrop setup-cron --agent ralph --interval 15');
        process.exit(1);
      }

      if (interval <= 0) {
        console.error('Error: Interval must be a positive number greater than 0');
        console.error('Example: deadrop setup-cron --agent ralph --interval 15');
        process.exit(1);
      }

      // Generate cron configuration JSON
      const cronConfig = {
        action: 'create',
        type: 'cron',
        agent: options.agent.trim(),
        command: `deadrop check --agent ${options.agent.trim()}`,
        interval: `${interval}m`,
        description: `Deadrop inbox checking for agent ${options.agent.trim()}`,
        enabled: true
      };

      console.log(JSON.stringify(cronConfig, null, 2));
    } catch (error) {
      console.error('❌ Error generating cron configuration:', error.message);
      process.exit(1);
    }
  });

program
  .command('remove-cron')
  .description('Generate OpenClaw cron job removal configuration')
  .requiredOption('--agent <name>', 'agent name to stop monitoring')
  .action((options) => {
    try {
      // Validate agent name
      if (!options.agent || options.agent.trim() === '') {
        console.error('Error: Agent name cannot be empty');
        console.error('Please provide a valid agent name (e.g., ralph, cody, scout)');
        process.exit(1);
      }

      // Generate cron removal configuration JSON
      const cronConfig = {
        action: 'delete',
        type: 'cron',
        agent: options.agent.trim(),
        pattern: `deadrop check --agent ${options.agent.trim()}`,
        description: `Remove Deadrop cron job for agent ${options.agent.trim()}`
      };

      console.log(JSON.stringify(cronConfig, null, 2));
    } catch (error) {
      console.error('❌ Error generating cron removal configuration:', error.message);
      process.exit(1);
    }
  });

program.parse();