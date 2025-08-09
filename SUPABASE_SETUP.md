# Supabase Usage Tracking Setup Guide

This guide walks you through setting up Supabase database connectivity for CLI usage tracking.

## Quick Start

1. **Set up Supabase project** (if not already done)
2. **Configure environment variables**
3. **Give consent for tracking**
4. **Start using the CLI with tracking enabled**

## Detailed Setup

### Step 1: Supabase Project Setup

The CLI is already configured to work with the existing Supabase project:
- **Project ID**: `ycxceefjouwuzxxsdxmt`
- **Project Name**: `codecraft-cli-analytics`
- **Region**: `us-east-1`

The database schema has already been created with the required table and security policies.

### Step 2: Environment Variables

Create or update your `.env` file in the project root with:

```bash
# Supabase Configuration for Usage Tracking
SUPABASE_URL=https://ycxceefjouwuzxxsdxmt.supabase.co
SUPABASE_ANON_KEY=your-anonymous-key-here
SUPABASE_USER_EMAIL=your-email@example.com
```

**Important**: Replace `your-anonymous-key-here` with the actual anonymous key from your Supabase project, and `your-email@example.com` with your email address.

### Step 3: Get Your Supabase Keys

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select the `codecraft-cli-analytics` project
3. Go to **Settings** → **API**
4. Copy the **anon/public** key
5. The **Project URL** should be: `https://ycxceefjouwuzxxsdxmt.supabase.co`

### Step 4: Enable Tracking

Once the environment variables are set:

1. **Start the CLI** - You'll see a consent prompt if Supabase is configured
2. **Give consent**: Run `/privacy consent give`
3. **Verify setup**: Run `/privacy status` to confirm tracking is enabled

## Usage Commands

### Privacy Management

```bash
# View current status
/privacy status

# Give consent for tracking
/privacy consent give

# Revoke consent
/privacy consent revoke

# Configure what to track
/privacy config prompts true    # Track prompt text
/privacy config tokens true     # Track token usage
/privacy config metadata true   # Track session metadata
/privacy config retention 90    # Set retention to 90 days

# Delete all your data
/privacy delete confirm
```

### Usage Statistics

```bash
# View your usage statistics
/usage stats

# View recent interaction history
/usage history 10

# Check tracking queue status
/usage queue

# Force flush pending data
/usage flush
```

## What Gets Tracked

When tracking is enabled, the CLI records:

### Always Tracked
- **Session ID**: Unique identifier for each CLI session
- **Prompt ID**: Unique identifier for each user prompt
- **Timestamp**: When the interaction occurred
- **User Email**: Your email address (for data association)

### Configurable Tracking
- **Prompt Text**: The actual text of your prompts (default: enabled)
- **Token Counts**: Input/output/cached token usage (default: enabled)
- **Metadata**: Model used, auth type, response duration (default: enabled)

### Privacy Controls
- **Data Retention**: Automatically delete data after specified days (default: 90 days)
- **Granular Control**: Enable/disable tracking for different data types
- **Easy Deletion**: Delete all your data at any time

## Data Security

### Protection Measures
- ✅ **Encryption in Transit**: All data sent over HTTPS
- ✅ **Row Level Security**: Database-level access controls
- ✅ **User Isolation**: Your data is isolated by email address
- ✅ **Minimal Permissions**: Anonymous key with limited database access

### Privacy Compliance
- ✅ **Explicit Consent**: You must opt-in to enable tracking
- ✅ **Transparency**: Clear information about what's collected
- ✅ **Right to Deletion**: Delete your data anytime
- ✅ **Data Minimization**: Only necessary data is collected

## Troubleshooting

### Common Issues

**1. "Supabase tracking disabled: Missing required environment variables"**
- Check that all three environment variables are set in your `.env` file
- Verify the `.env` file is in the correct location (project root)

**2. "Supabase tracking disabled: Invalid SUPABASE_URL format"**
- Ensure the URL starts with `https://` and is properly formatted
- Use: `https://ycxceefjouwuzxxsdxmt.supabase.co`

**3. "Supabase tracking disabled: Invalid SUPABASE_USER_EMAIL format"**
- Ensure your email address is properly formatted
- Example: `user@example.com`

**4. No tracking data appears**
- Check consent status: `/privacy status`
- Give consent if needed: `/privacy consent give`
- Verify queue status: `/usage queue`

### Debug Steps

1. **Check configuration**:
   ```bash
   /privacy status
   ```

2. **Verify environment variables**:
   ```bash
   echo $SUPABASE_URL
   echo $SUPABASE_USER_EMAIL
   # Don't echo the API key for security
   ```

3. **Test connectivity**:
   ```bash
   /usage stats
   ```

4. **Check queue status**:
   ```bash
   /usage queue
   ```

## Example .env File

```bash
# Supabase Configuration
SUPABASE_URL=https://ycxceefjouwuzxxsdxmt.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_USER_EMAIL=john.doe@example.com

# Other CLI configuration (if any)
GEMINI_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key
```

## Getting Help

If you encounter issues:

1. **Check this troubleshooting guide**
2. **Review the detailed documentation**: `docs/SUPABASE_INTEGRATION.md`
3. **Check CLI status**: `/privacy status` and `/usage queue`
4. **Look for error messages** in the CLI output

## Benefits of Usage Tracking

With tracking enabled, you can:

- 📊 **Monitor token usage** and optimize your prompts
- 📈 **Track productivity** and CLI usage patterns  
- 💰 **Estimate costs** based on token consumption
- 🔍 **Review interaction history** for reference
- 📋 **Export your data** for analysis

The tracking helps improve the CLI and provides valuable insights into your usage patterns while maintaining full privacy control.
