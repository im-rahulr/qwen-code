# Supabase Integration for CLI Usage Tracking

This document describes the Supabase integration that enables comprehensive usage tracking for the CLI application.

## Overview

The Supabase integration provides:
- **User interaction tracking**: Records every user prompt and response
- **Dual user identification**: Tracks both configured user email and authenticated Qwen account email
- **Token usage monitoring**: Tracks input/output token consumption
- **Privacy controls**: User consent management and data retention policies
- **Usage analytics**: Statistics and insights into CLI usage patterns
- **Data management**: Export and deletion capabilities

## User Identification

The system tracks two types of user identification:

1. **Configured User Email** (`user_email`): Set via the `SUPABASE_USER_EMAIL` environment variable. This is used for Supabase identification and analytics grouping.

2. **Qwen Account Email** (`qwen_account_email`): Automatically extracted from the authenticated Qwen OAuth account when available. This provides tracking of the actual authenticated user.

This dual approach allows for:
- **Analytics flexibility**: Group data by configured email for organizational tracking
- **User accountability**: Track actual authenticated users for security and usage patterns
- **Migration support**: Maintain existing analytics while adding authenticated user tracking

## Setup and Configuration

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_USER_EMAIL=your-email@example.com
```

### 2. Database Schema

The integration uses a `user_interactions` table with the following schema:

```sql
CREATE TABLE user_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  qwen_account_email TEXT,
  prompt_text TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  model_name TEXT,
  auth_type TEXT,
  input_token_count INTEGER DEFAULT 0,
  output_token_count INTEGER DEFAULT 0,
  total_token_count INTEGER DEFAULT 0,
  cached_token_count INTEGER DEFAULT 0,
  thoughts_token_count INTEGER DEFAULT 0,
  tool_token_count INTEGER DEFAULT 0,
  response_duration_ms INTEGER,
  interaction_timestamp TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Key Fields

- **`user_email`**: Configured user email from `SUPABASE_USER_EMAIL` environment variable (required)
- **`qwen_account_email`**: Authenticated Qwen account email (optional, populated when user is authenticated via Qwen OAuth)
- **`prompt_text`**: The user's input prompt
- **`prompt_id`**: Unique identifier for tracking prompt-response pairs
- **`session_id`**: CLI session identifier for grouping related interactions
- **Token fields**: Detailed breakdown of token usage (input, output, cached, thoughts, tools)
- **`response_duration_ms`**: Time taken to generate the response
- **`metadata`**: Additional context and debugging information

### 3. Row Level Security (RLS)

The table includes RLS policies to ensure data security:

```sql
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

-- Policies allow all operations for now since we're using anon key
-- In production, implement proper user authentication
```

## Usage

### Privacy Commands

The CLI provides comprehensive privacy management through the `/privacy` command:

```bash
# View current privacy status
/privacy status

# Give consent for tracking
/privacy consent give

# Revoke consent
/privacy consent revoke

# Delete all stored data
/privacy delete confirm

# Configure tracking settings
/privacy config prompts true
/privacy config tokens false
/privacy config retention 30
```

### Usage Statistics

View usage statistics with the `/usage` command:

```bash
# View overall statistics
/usage stats

# View recent interaction history
/usage history 20

# Check tracking queue status
/usage queue

# Force flush pending interactions
/usage flush
```

## Privacy and Consent

### Consent Management

- **Automatic prompts**: Users are prompted for consent when Supabase is configured
- **Granular controls**: Separate settings for prompts, tokens, and metadata
- **Data retention**: Configurable retention periods (1-365 days)
- **Easy revocation**: Consent can be revoked at any time

### Data Collection

When enabled, the system tracks:

- ✅ **User prompts**: Full text of user queries (if consent given)
- ✅ **Token usage**: Input/output/cached token counts
- ✅ **Session metadata**: Model used, authentication type, timestamps
- ✅ **Response metrics**: Duration, success/failure status

### Privacy Settings

```typescript
interface PrivacySettings {
  supabaseTrackingEnabled: boolean;
  dataRetentionDays: number;        // 1-365 days
  trackPrompts: boolean;            // Include prompt text
  trackTokens: boolean;             // Include token counts
  trackMetadata: boolean;           // Include session metadata
  consentGiven: boolean;
  consentDate?: string;
}
```

## Architecture

### Core Components

1. **SupabaseService**: Manages database connections and operations
2. **InteractionTracker**: Handles asynchronous interaction logging
3. **PrivacyService**: Manages consent and privacy settings
4. **ConsentManager**: Handles consent prompts and user notifications
5. **EnhancedLogger**: Integrates with existing telemetry system

### Data Flow

```
User Prompt → Enhanced Logger → Interaction Tracker → Privacy Filter → Supabase Service → Database
```

### Error Handling

- **Graceful degradation**: CLI continues to function if Supabase is unavailable
- **Retry logic**: Automatic retries for network-related failures
- **Health checks**: Regular connectivity monitoring
- **Fallback mechanisms**: Local queuing when database is unreachable

## Configuration Options

### Settings File

Privacy settings are stored in `~/.qwen/privacy.json`:

```json
{
  "supabaseTrackingEnabled": true,
  "dataRetentionDays": 90,
  "trackPrompts": true,
  "trackTokens": true,
  "trackMetadata": true,
  "consentGiven": true,
  "consentDate": "2025-01-01T00:00:00.000Z"
}
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_ANON_KEY` | Anonymous access key | Yes |
| `SUPABASE_USER_EMAIL` | User identifier for data association | Yes |

## Security Considerations

### Data Protection

- **Encryption in transit**: All data transmitted over HTTPS
- **Row Level Security**: Database-level access controls
- **User isolation**: Data associated with user email addresses
- **Minimal permissions**: Anonymous key with limited access

### Privacy Compliance

- **Explicit consent**: Users must explicitly opt-in to tracking
- **Data minimization**: Only necessary data is collected
- **Right to deletion**: Users can delete all their data
- **Transparency**: Clear information about what data is collected

## Troubleshooting

### Common Issues

1. **Tracking not working**
   - Check environment variables are set correctly
   - Verify Supabase URL and key are valid
   - Ensure consent has been given: `/privacy consent give`

2. **Database connection errors**
   - Check network connectivity
   - Verify Supabase project is active
   - Check health status: `/usage queue`

3. **Permission errors**
   - Verify RLS policies are correctly configured
   - Check anonymous key permissions

### Debug Commands

```bash
# Check configuration status
/privacy status

# View queue status
/usage queue

# Test database connectivity
/usage stats
```

## Development

### Testing

Run the test suite:

```bash
npm test src/services/supabaseClient.test.ts
npm test src/services/interactionTracker.test.ts
```

### Local Development

For local development, you can use a local Supabase instance:

```bash
# Start local Supabase
npx supabase start

# Set environment variables
export SUPABASE_URL=http://localhost:54321
export SUPABASE_ANON_KEY=your-local-anon-key
export SUPABASE_USER_EMAIL=dev@example.com
```

## Support

For issues related to the Supabase integration:

1. Check the troubleshooting section above
2. Review the privacy settings: `/privacy status`
3. Check the queue status: `/usage queue`
4. Review the logs for error messages
