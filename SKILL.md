# Deadrop Skill

Inter-agent message queue with SQLite persistence.

## Description

Reliable agent-to-agent messaging system that eliminates `sessions_send` timeouts. Messages persist in SQLite until read, enabling asynchronous communication patterns.

## Commands

### deadrop send
Send a message to another agent.

**Usage:**
```bash
deadrop send --to <agent> --from <agent> [--subject <subject>] --body <body>
```

**Parameters:**
- `--to` (required): Recipient agent name
- `--from` (required): Sender agent name  
- `--subject` (optional): Message subject
- `--body` (required): Message content

**Example:**
```bash
deadrop send --to cody --from larry --subject "Deploy Update" --body "Production deploy complete"
```

### deadrop check
Check for new messages and mark them as read.

**Usage:**
```bash
deadrop check --agent <agent>
```

**Parameters:**
- `--agent` (required): Agent name to check messages for

**Example:**
```bash
deadrop check --agent cody
```

### deadrop inbox  
List messages in agent's inbox.

**Usage:**
```bash
deadrop inbox --agent <agent> [--unread]
```

**Parameters:**
- `--agent` (required): Agent name to show inbox for
- `--unread` (optional): Show only unread messages

**Example:**
```bash
# Show all messages
deadrop inbox --agent cody

# Show only unread
deadrop inbox --agent cody --unread
```

## Installation

1. Clone repository
2. Run `npm install` 
3. Run `npm link` (optional, for global access)

## Database

Messages stored in `~/.openclaw/workspace/deadrop.sqlite`

## Integration Pattern

Replace timeout-prone `sessions_send` calls:

**Before:**
```bash
sessions_send "agent:target:..." "message" --timeoutSeconds 60
```

**After:**
```bash
deadrop send --to target --from source --body "message"
```

Recipients check on their schedule:
```bash
deadrop check --agent target
```

## Use Cases

- Task completion notifications
- Status updates between agents
- Async coordination messages
- Backup communication when sessions_send fails

## Benefits

- **No timeouts**: Messages persist until read
- **No lost messages**: SQLite durability 
- **Simple integration**: Drop-in CLI replacement
- **Cross-session compatibility**: Works in sub-agents
- **Message history**: Full inbox with timestamps