# Automated Inbox Checking Setup

This guide explains how to set up automated Deadrop inbox checking using OpenClaw's cron system.

## Quick Setup

### 1. Generate Cron Configuration
```bash
# Generate config for 10-minute intervals (default)
deadrop setup-cron --agent cody

# Or customize the interval
deadrop setup-cron --agent cody --interval 5  # Check every 5 minutes
```

This outputs OpenClaw cron job JSON that you can copy and use.

### 2. Add to OpenClaw
Copy the JSON output and use it with OpenClaw's cron API:

```bash
# Method 1: Direct API call
cron add --job '{"enabled":true,"name":"Deadrop Inbox Check - cody",...}'

# Method 2: Save to file and load
echo '{"enabled":true,...}' > cron-deadrop.json
cron add --job "$(cat cron-deadrop.json)"
```

### 3. Verify Setup
```bash
# List cron jobs to confirm
cron list

# Should show "Deadrop Inbox Check - cody" in the list
```

## Configuration Options

### Interval Settings
```bash
# Every 5 minutes (for high-frequency communication)
deadrop setup-cron --agent cody --interval 5

# Every 30 minutes (for low-frequency monitoring) 
deadrop setup-cron --agent cody --interval 30

# Every hour (for periodic batch processing)
deadrop setup-cron --agent cody --interval 60
```

### Multiple Agents
Set up monitoring for multiple agents:

```bash
# Setup for each agent
deadrop setup-cron --agent larry --interval 10
deadrop setup-cron --agent cody --interval 10  
deadrop setup-cron --agent scout --interval 15
```

## Sample Configurations

### High-Frequency Agent (Development)
```json
{
  "enabled": true,
  "name": "Deadrop Inbox Check - cody",
  "payload": {
    "kind": "systemEvent", 
    "text": "deadrop check --agent cody"
  },
  "schedule": {
    "everyMs": 300000,
    "kind": "every"
  },
  "sessionTarget": "main"
}
```

### Low-Frequency Agent (Monitoring)
```json
{
  "enabled": true,
  "name": "Deadrop Inbox Check - scout", 
  "payload": {
    "kind": "systemEvent",
    "text": "deadrop check --agent scout"
  },
  "schedule": {
    "everyMs": 1800000,
    "kind": "every" 
  },
  "sessionTarget": "main"
}
```

## Advanced Setup

### Conditional Checking
Create more sophisticated inbox checking with custom logic:

```bash
# Create a wrapper script
cat > ~/.openclaw/scripts/smart-deadrop-check.sh << 'EOF'
#!/bin/bash
AGENT="$1"

# Only check during business hours
current_hour=$(date +%H)
if [ "$current_hour" -ge 9 ] && [ "$current_hour" -le 17 ]; then
    deadrop check --agent "$AGENT"
else
    # Off-hours: only check if urgent messages (check count without marking read)
    urgent_count=$(deadrop inbox --agent "$AGENT" --unread 2>/dev/null | grep -i "urgent\|critical\|alert" | wc -l)
    if [ "$urgent_count" -gt 0 ]; then
        echo "🚨 $urgent_count urgent messages found off-hours"
        deadrop check --agent "$AGENT"
    fi
fi
EOF

chmod +x ~/.openclaw/scripts/smart-deadrop-check.sh
```

Then use in cron:
```json
{
  "enabled": true,
  "name": "Smart Deadrop Check - cody",
  "payload": {
    "kind": "systemEvent",
    "text": "~/.openclaw/scripts/smart-deadrop-check.sh cody"
  },
  "schedule": {
    "everyMs": 600000,
    "kind": "every"
  },
  "sessionTarget": "main"
}
```

### Batch Processing
Process messages in batches with custom handling:

```bash
cat > ~/.openclaw/scripts/batch-message-processor.sh << 'EOF'
#!/bin/bash
AGENT="$1"

# Check for messages but don't output if none
messages=$(deadrop inbox --agent "$AGENT" --unread 2>/dev/null)
if echo "$messages" | grep -q "●"; then
    echo "📬 Processing batch messages for $AGENT"
    
    # Mark as read and process  
    deadrop check --agent "$AGENT" | while read -r line; do
        # Custom processing logic here
        if echo "$line" | grep -q "Priority: High"; then
            echo "🚨 High priority message detected"
            # Additional handling for urgent messages
        fi
    done
else
    # Silent if no messages (avoid HEARTBEAT_OK spam)
    echo "HEARTBEAT_OK"
fi
EOF
```

## Management Commands

### Disable Automated Checking
```bash
# List jobs to find the job ID
cron list

# Disable the specific job
cron update --jobId <job-id> --patch '{"enabled": false}'
```

### Remove Automated Checking
```bash
deadrop remove-cron --agent cody
# Follow the displayed instructions to remove via cron API
```

### Update Check Interval
```bash
# Update existing job interval
cron update --jobId <job-id> --patch '{"schedule": {"everyMs": 900000, "kind": "every"}}'  # 15 minutes
```

## Monitoring and Troubleshooting

### Check Cron Job Status
```bash
# List all cron jobs with status
cron list

# Get details of specific job
cron runs --jobId <job-id> --limit 5
```

### Verify Message Processing
```bash
# Check if messages are being processed
deadrop inbox --agent cody | head -10

# Look for recent read timestamps
deadrop inbox --agent cody | grep "Read:"
```

### Debug Failed Executions
```bash
# Check recent job runs for errors
cron runs --jobId <job-id> --limit 10

# Look for failed systemEvents in OpenClaw logs
tail -f ~/.openclaw/logs/gateway.log | grep "deadrop check"
```

## Best Practices

### 1. Choose Appropriate Intervals
- **Active development agents**: 5-10 minutes
- **Monitoring agents**: 15-30 minutes  
- **Background agents**: 30-60 minutes

### 2. Avoid Over-Checking
Too frequent checking can create noise in logs:

```bash
# Good: Reasonable intervals
deadrop setup-cron --agent cody --interval 10

# Bad: Excessive checking
deadrop setup-cron --agent cody --interval 1  # Every minute is too much
```

### 3. Use Descriptive Names
```json
{
  "name": "Deadrop Inbox Check - cody (dev work)",
  "name": "Deadrop Inbox Check - scout (monitoring)",  
  "name": "Deadrop Inbox Check - larry (management)"
}
```

### 4. Monitor Resource Usage
```bash
# Check database size growth
ls -lah ~/.openclaw/workspace/deadrop.sqlite

# Clean up old messages periodically (separate cron job)
sqlite3 ~/.openclaw/workspace/deadrop.sqlite "DELETE FROM messages WHERE timestamp < datetime('now', '-7 days');"
```

### 5. Graceful Degradation
Ensure your agents can still function if Deadrop checking fails:

```bash
# In your cron job payload
deadrop check --agent cody 2>/dev/null || echo "⚠️ Deadrop check failed - continuing normally"
```

## Integration with Agent Workflows

### AGENTS.md Integration
Add to your AGENTS.md file:

```markdown
## Automated Message Checking

Deadrop inbox is checked every 10 minutes via cron job.
Manual check: `deadrop check --agent cody`

### On Message Receipt
1. Process actionable messages immediately
2. Send ACK for important messages  
3. Update relevant tickets/docs
4. Continue with current task
```

### Heartbeat Integration
If using manual heartbeats, integrate message checking:

```bash
# In HEARTBEAT.md or heartbeat scripts
echo "Checking inter-agent messages..."
deadrop check --agent $(whoami)
echo "Heartbeat complete"
```

This ensures reliable message delivery while maintaining efficient agent workflows.