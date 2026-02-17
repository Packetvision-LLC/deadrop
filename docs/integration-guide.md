# Deadrop Integration Guide

This guide explains how to integrate Deadrop into your OpenClaw agent workflows for reliable inter-agent communication.

## Communication Protocol

### Primary: sessions_send → Fallback: Deadrop

The recommended pattern is to try `sessions_send` first, then fall back to Deadrop for reliability:

```bash
# Try direct session communication first
if ! sessions_send "agent:target:discord:channel:123" "Task complete" --timeoutSeconds 30; then
    # Fallback to Deadrop for reliable delivery
    deadrop send --to target --from $(whoami) --subject "Task Status" --body "Task complete"
fi
```

### ACK Convention

When agents receive actionable messages, they should acknowledge with a standardized ACK:

```bash
# Recipient checks messages
deadrop check --agent cody
# Output shows: [123] From: larry, Subject: "Deploy Request"...

# Send ACK with reference to original message ID
deadrop send --to larry --from cody --subject "ACK:123" --body "Acknowledged, starting deploy"
```

## Integration Patterns

### Agent Startup/Heartbeat

Add message checking to your agent's regular workflow:

```bash
#!/bin/bash
# In your agent's heartbeat or task loop
deadrop check --agent $(whoami)

# Act on any messages found
# Your message processing logic here
```

### Sub-Agent Communication

Sub-agents can use Deadrop when `sessions_send` isn't available:

```bash
# Sub-agent reports completion
deadrop send --to parent-agent --from sub-agent-id --subject "Task Complete" --body "Analysis finished, results in /tmp/analysis.json"

# Parent agent checks for sub-agent updates
deadrop check --agent parent-agent
```

### Cross-Session Coordination

Coordinate work between different agent sessions:

```bash
# Agent A hands off work to Agent B
deadrop send --to cody --from larry --subject "Handoff: PROJ-123" --body "Please take over Jira ticket PROJ-123, requirements in shared doc"

# Agent B acknowledges and takes over
deadrop send --to larry --from cody --subject "ACK: PROJ-123" --body "Taking over PROJ-123, will update when complete"
```

## Message Types

### Status Updates
- **Subject**: Brief status description
- **Body**: Detailed status with context
- **ACK**: Not usually required

### Task Requests
- **Subject**: "Request: [task description]"  
- **Body**: Detailed requirements and deadlines
- **ACK**: Required - "ACK:[msg_id] - [status]"

### Alerts/Notifications
- **Subject**: "Alert: [issue]"
- **Body**: Problem description and urgency
- **ACK**: Required for critical alerts

### Handoffs
- **Subject**: "Handoff: [item/ticket/task]"
- **Body**: Context, current status, next steps
- **ACK**: Required - confirms ownership transfer

## Error Handling

### Message Delivery Failures
Deadrop is designed to be highly reliable, but handle edge cases:

```bash
if ! deadrop send --to target --from source --body "message"; then
    echo "❌ Critical: Deadrop send failed - manual intervention required"
    # Log to external system, alert human operator, etc.
fi
```

### Database Corruption
If SQLite database becomes corrupted:

```bash
# Check if database is accessible
if ! deadrop inbox --agent test-agent 2>/dev/null; then
    echo "⚠️  Database issue detected - reinitializing"
    # Backup existing database if possible
    mv ~/.openclaw/workspace/deadrop.sqlite ~/.openclaw/workspace/deadrop.sqlite.backup
    # Next deadrop command will recreate database
fi
```

### Cleanup Old Messages

Deadrop doesn't automatically clean up old messages. Add periodic cleanup:

```bash
#!/bin/bash
# Clean up messages older than 30 days
sqlite3 ~/.openclaw/workspace/deadrop.sqlite "DELETE FROM messages WHERE timestamp < datetime('now', '-30 days');"
```

## Best Practices

### 1. Use Descriptive Subjects
```bash
# Good
deadrop send --to cody --from larry --subject "Deploy Status: Kraken production" --body "..."

# Bad  
deadrop send --to cody --from larry --subject "Update" --body "..."
```

### 2. Include Context in Body
```bash
# Include relevant context for async communication
deadrop send --to cody --from larry --subject "Bug Fix Request" --body "GitHub issue #123 - login timeout error affecting 15% of users. Priority: High. Assigned to you in Jira."
```

### 3. Use Consistent Agent Names
Ensure agent names are consistent across your OpenClaw deployment:
- `larry` (not `Larry` or `agent-larry`)
- `cody` (not `Cody-dev` or `cody-main`)

### 4. Monitor Message Queues
Add monitoring for unread message counts:

```bash
# Check for old unread messages
unread_count=$(deadrop inbox --agent $(whoami) --unread 2>/dev/null | grep -c "●" || echo "0")
if [ "$unread_count" -gt 10 ]; then
    echo "⚠️  High unread message count: $unread_count"
fi
```

### 5. Batch Message Processing
Check messages at natural breakpoints, not continuously:

```bash
# Good - check at task boundaries
complete_task
deadrop check --agent $(whoami)
start_next_task

# Bad - checking too frequently creates noise
while true; do
    deadrop check --agent $(whoami)
    sleep 30
done
```

## Troubleshooting

### Messages Not Appearing
1. Check agent name consistency
2. Verify database permissions
3. Check for SQLite locking issues

### Performance Issues
1. Clean up old messages periodically
2. Monitor database size
3. Consider message retention policies

### Integration Problems
1. Test with simple messages first
2. Check for special characters in messages
3. Verify JSON escaping in automated tools

## Migration from sessions_send

If you're migrating from direct `sessions_send` usage:

1. **Identify Critical Communications**: Start with messages that frequently timeout
2. **Add Fallback Logic**: Implement sessions_send → Deadrop fallback pattern
3. **Update Message Checking**: Add `deadrop check` to agent workflows
4. **Test Thoroughly**: Verify message delivery in various scenarios
5. **Monitor**: Watch for any missed messages during transition

This approach ensures reliable inter-agent communication while maintaining the performance benefits of direct session communication when possible.