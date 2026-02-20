# Deadrop Integration Guide

## Overview

Deadrop provides a SQLite-backed message queue for reliable inter-agent communication in OpenClaw deployments. It serves as a fallback mechanism when direct agent-to-agent communication via `sessions_send` fails or is unreliable.

This guide covers the communication protocol, integration patterns, and best practices for using Deadrop in your agent workflows.

## Communication Protocol

Deadrop implements a simple message queue pattern optimized for agent communication:

1. **Primary Communication**: Always attempt direct communication first using `sessions_send`
2. **Fallback Pattern**: If direct communication fails, use Deadrop as a reliable message queue
3. **Acknowledgment**: Recipients should send ACK messages to confirm receipt
4. **Inbox Polling**: Agents check their inbox periodically or via cron automation

### Fallback Pattern Implementation

```javascript
// Recommended integration pattern
async function reliableAgentMessage(targetAgent, message) {
  try {
    // Attempt direct communication first (faster, real-time)
    await sessions_send({
      sessionKey: `agent:${targetAgent}:discord:channel:123456`,
      message: message,
      timeoutSeconds: 15
    });
    console.log(`✓ Direct message sent to ${targetAgent}`);
  } catch (error) {
    console.log(`⚠ Direct send failed, using Deadrop fallback`);
    
    // Fallback to Deadrop for reliable delivery
    await exec(`deadrop send --to ${targetAgent} --from ${currentAgent} --body "${message}"`);
    console.log(`✓ Fallback message queued for ${targetAgent}`);
  }
}
```

### Message Structure

Deadrop messages support the following fields:

- **from_agent**: Sender agent name (required)
- **to_agent**: Recipient agent name (required) 
- **subject**: Optional message subject for categorization
- **body**: Message content (required)
- **timestamp**: Automatically set to current timestamp

## ACK Convention

To ensure reliable communication, recipients should send acknowledgment messages when processing Deadrop messages.

### ACK Subject Format

Use the format `ACK:<message_id>` for acknowledgment subjects:

```bash
# When processing message ID 42
deadrop send --to sender_agent --from recipient_agent --subject "ACK:42" --body "Message received and processed"
```

### ACK Implementation Example

```javascript
// Agent inbox checking with ACK
async function processInbox(agentName) {
  const messages = await checkInbox(agentName);
  
  for (const msg of messages) {
    try {
      // Process the message
      await processMessage(msg);
      
      // Send acknowledgment
      await exec(`deadrop send --to ${msg.from_agent} --from ${agentName} --subject "ACK:${msg.id}" --body "Processed successfully"`);
      
    } catch (error) {
      // Send error ACK
      await exec(`deadrop send --to ${msg.from_agent} --from ${agentName} --subject "ACK:${msg.id}" --body "Processing failed: ${error.message}"`);
    }
  }
}
```

## Agent Naming Conventions

Use consistent agent names across OpenClaw and Deadrop:

- **ralph** - Autonomous coding agent
- **cody** - Development manager agent  
- **scout** - Information gathering agent
- **penny** - Financial tracking agent
- **sage** - Knowledge management agent
- **larry** - Team orchestrator agent

### Agent Discovery Pattern

```javascript
// Check if agent is available via sessions_send first
const availableAgents = ['ralph', 'cody', 'scout', 'penny'];

async function findAvailableAgent(requiredSkill) {
  for (const agent of availableAgents) {
    try {
      await sessions_send({
        sessionKey: `agent:${agent}:discord:channel:123456`,
        message: 'ping',
        timeoutSeconds: 5
      });
      return agent; // Agent responded
    } catch (error) {
      // Try next agent or use Deadrop
      continue;
    }
  }
  
  // No agents responded, use Deadrop to queue request
  await exec(`deadrop send --to ralph --from orchestrator --subject "Task Request" --body "Need agent for: ${requiredSkill}"`);
}
```

## Error Handling and Retry Logic

Implement robust error handling for reliable agent communication:

```javascript
async function robustSend(target, message, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Try direct communication
      await sessions_send({
        sessionKey: `agent:${target}:discord:channel:123456`,
        message: message,
        timeoutSeconds: 10
      });
      return 'direct';
      
    } catch (directError) {
      console.log(`Attempt ${attempt}: Direct send failed`);
      
      try {
        // Fallback to Deadrop
        await exec(`deadrop send --to ${target} --from ${currentAgent} --body "${message}"`);
        return 'queued';
        
      } catch (queueError) {
        if (attempt === maxRetries) {
          throw new Error(`All ${maxRetries} attempts failed`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}
```

## Integration with OpenClaw Workflows

### Session Spawning with Deadrop Fallback

```javascript
async function spawnTaskWithFallback(task, targetAgent = 'ralph') {
  try {
    // Try spawning directly
    const result = await sessions_spawn({
      task: task,
      agentId: targetAgent,
      timeoutSeconds: 300
    });
    return result;
    
  } catch (spawnError) {
    // Fallback: queue task via Deadrop
    const taskMessage = JSON.stringify({
      type: 'spawn_request',
      task: task,
      requestedBy: 'orchestrator',
      timestamp: new Date().toISOString()
    });
    
    await exec(`deadrop send --to ${targetAgent} --from orchestrator --subject "SPAWN_REQUEST" --body "${taskMessage}"`);
    
    return {
      status: 'queued',
      message: 'Task queued via Deadrop - agent will process when available'
    };
  }
}
```

### Heartbeat Pattern with Deadrop

```javascript
// Agent heartbeat via Deadrop when sessions_send unavailable
async function sendHeartbeat(agentName) {
  const heartbeat = {
    agent: agentName,
    status: 'active',
    lastTask: getLastTaskInfo(),
    timestamp: new Date().toISOString()
  };
  
  try {
    // Try direct heartbeat first
    await sessions_send({
      sessionKey: 'agent:main:discord:channel:123456',
      message: `Heartbeat: ${JSON.stringify(heartbeat)}`,
      timeoutSeconds: 5
    });
  } catch (error) {
    // Fallback to Deadrop
    await exec(`deadrop send --to orchestrator --from ${agentName} --subject "HEARTBEAT" --body "${JSON.stringify(heartbeat)}"`);
  }
}
```

## Common Integration Patterns

### 1. Task Distribution

```javascript
// Distribute tasks to available agents
async function distributeTask(task, preferredAgent) {
  const message = `TASK: ${task}`;
  
  // Try preferred agent first
  if (preferredAgent) {
    const result = await robustSend(preferredAgent, message);
    if (result) return preferredAgent;
  }
  
  // Round-robin to other agents
  const agents = ['ralph', 'cody', 'scout'].filter(a => a !== preferredAgent);
  for (const agent of agents) {
    const result = await robustSend(agent, message);
    if (result === 'direct') return agent;
  }
  
  // All agents offline, queue to primary
  await exec(`deadrop send --to ralph --from orchestrator --subject "QUEUED_TASK" --body "${message}"`);
  return 'queued';
}
```

### 2. Status Checking

```javascript
// Check agent status via inbox polling
async function checkAgentStatus(agentName) {
  try {
    // Direct status check
    const response = await sessions_send({
      sessionKey: `agent:${agentName}:discord:channel:123456`,
      message: 'STATUS',
      timeoutSeconds: 10
    });
    return 'online';
    
  } catch (error) {
    // Check Deadrop inbox for recent activity
    const output = await exec(`deadrop inbox --agent orchestrator --unread`);
    const hasRecentMessage = output.includes(`From: ${agentName}`);
    
    return hasRecentMessage ? 'active' : 'offline';
  }
}
```

### 3. Cross-Agent Coordination

```javascript
// Coordinate multi-agent workflow
async function coordinateWorkflow(workflow) {
  const participants = workflow.agents;
  const coordinator = 'orchestrator';
  
  // Notify all agents about workflow
  for (const agent of participants) {
    const notification = {
      workflowId: workflow.id,
      role: workflow.roles[agent],
      dependencies: workflow.dependencies[agent] || [],
      coordinator: coordinator
    };
    
    await robustSend(agent, `WORKFLOW_START: ${JSON.stringify(notification)}`);
  }
  
  // Monitor progress via Deadrop
  const progressChecker = setInterval(async () => {
    await exec(`deadrop check --agent ${coordinator}`);
    // Process workflow updates from agent messages
  }, 30000); // Check every 30 seconds
  
  return progressChecker;
}
```

## Best Practices

1. **Always Try Direct First**: Use sessions_send before falling back to Deadrop
2. **Implement Timeouts**: Set reasonable timeouts for direct communication attempts
3. **Use ACK Pattern**: Send acknowledgments for important messages
4. **Monitor Inbox**: Set up automated inbox checking via cron (see [Cron Setup Guide](cron-setup.md))
5. **Handle Errors Gracefully**: Implement retry logic with exponential backoff
6. **Use Consistent Naming**: Follow established agent naming conventions
7. **Structure Messages**: Use JSON for complex message payloads
8. **Log Everything**: Keep detailed logs for debugging communication issues

## Troubleshooting

### Common Issues

**Messages Not Being Delivered**
- Check agent names for typos
- Verify database permissions and path
- Ensure recipient is checking their inbox

**Direct Communication Failing**
- Verify session keys are correct
- Check network connectivity
- Confirm target agent is running and responsive

**ACK Messages Not Working**
- Verify ACK subject format: `ACK:<message_id>`
- Check that original sender is monitoring their inbox
- Ensure ACK messages aren't being filtered

## Next Steps

- Set up automated inbox checking using the [Cron Setup Guide](cron-setup.md)
- Review the main [README.md](../README.md) for installation and basic usage
- Check the CLI help: `deadrop --help` for all available commands