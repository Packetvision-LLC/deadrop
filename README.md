# Deadrop - Inter-Agent Message Queue

SQLite-backed message queue for reliable agent-to-agent communication. Solves session_send timeout issues by providing persistent message storage that agents can check on their own schedule.

## Features

- **Persistent messages**: No more lost messages due to timeouts
- **Simple CLI interface**: Easy integration into agent workflows  
- **SQLite backend**: Lightweight, reliable, no daemon required
- **Cross-agent compatibility**: Works from any agent or sub-agent
- **Atomic operations**: Safe for concurrent access

## Installation

```bash
npm install
npm link  # Makes `deadrop` available globally
```

## Usage

### Send a message
```bash
deadrop send --to cody --from larry --subject "Task Update" --body "Kraken deployment is complete"
```

### Check for new messages (marks as read)
```bash
deadrop check --agent cody
```

### View inbox
```bash
# All messages
deadrop inbox --agent cody

# Unread only
deadrop inbox --agent cody --unread
```

## Database Location

By default, messages are stored in `~/.openclaw/workspace/deadrop.sqlite`.

To use a custom location, set the `DEADROP_DB` environment variable:

```bash
# In your .env or shell profile
export DEADROP_DB=/path/to/your/deadrop.sqlite
```

The directory will be created automatically if it doesn't exist.

## Schema

```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME
);
```

## Integration

Add to agent workflows:
1. **Send**: Use `deadrop send` instead of `sessions_send` for important messages
2. **Check**: Add `deadrop check --agent {name}` to heartbeat/task boundaries  
3. **Inbox**: Periodic `deadrop inbox --agent {name}` for message history

## Example Workflow

```bash
# Larry sends update to Cody
deadrop send --to cody --from larry --subject "Deploy Status" --body "Production deploy successful"

# Cody checks messages during next task
deadrop check --agent cody
# Output: 📬 1 new message(s): [1] From: larry...

# Review message history
deadrop inbox --agent cody
```

This eliminates the need to retry failed `sessions_send` calls and ensures no important inter-agent communication is lost.