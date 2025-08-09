/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SlashCommand, CommandKind, CommandContext } from './types.js';
import { getSupabaseService } from '../../services/supabaseClient.js';
import { getPrivacyService } from '../../services/privacyService.js';
import { getInteractionTracker } from '../../services/interactionTracker.js';
import { validateSupabaseConfig } from '../../config/auth.js';

const statsCommand: SlashCommand = {
  name: 'stats',
  description: 'Show usage statistics',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext) => {
    const supabaseService = getSupabaseService();
    const privacyService = getPrivacyService();

    // First, surface configuration issues clearly
    const configError = validateSupabaseConfig();
    if (configError) {
      return {
        type: 'message' as const,
        messageType: 'error' as const,
        content: `✗ Supabase not configured.\n\n${configError}\n\nAdd the following to your .env (in project root or %USERPROFILE%/.qwen/.env):\n\nSUPABASE_URL=https://<project>.supabase.co\nSUPABASE_ANON_KEY=...\nSUPABASE_USER_EMAIL=you@example.com`,
      };
    }

    if (!privacyService.isTrackingEnabled()) {
      return {
        type: 'message' as const,
        messageType: 'info' as const,
        content: '📊 Usage tracking is disabled.\n\nEnable tracking with `/privacy consent give` to see statistics.',
      };
    }

    try {
      const stats = await supabaseService.getUserStats();

      let message = '# 📊 Usage Statistics\n\n';
      message += `**Total Interactions:** ${stats.totalInteractions}\n`;
      message += `**Total Tokens Used:** ${stats.totalTokens.toLocaleString()}\n`;
      message += `**Average Tokens per Interaction:** ${stats.averageTokensPerInteraction}\n`;

      if (stats.lastInteraction) {
        message += `**Last Interaction:** ${new Date(stats.lastInteraction).toLocaleString()}\n`;
      }

      // Add cost estimation (rough estimate)
      const estimatedCost = (stats.totalTokens / 1000) * 0.002; // Rough estimate at $0.002 per 1K tokens
      message += `**Estimated Cost:** ~$${estimatedCost.toFixed(4)}\n`;

      return {
        type: 'message' as const,
        messageType: 'info' as const,
        content: message,
      };
    } catch (error) {
      return {
        type: 'message' as const,
        messageType: 'error' as const,
        content: `✗ Error fetching statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

const historyCommand: SlashCommand = {
  name: 'history',
  description: 'Show recent interaction history',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string) => {
    const supabaseService = getSupabaseService();
    const privacyService = getPrivacyService();
    
    if (!privacyService.isTrackingEnabled()) {
      return {
        type: 'message' as const,
        messageType: 'info' as const,
        content: '📊 Usage tracking is disabled.\n\nEnable tracking with `/privacy consent give` to see history.',
      };
    }

    const limit = parseInt(args.trim()) || 10;
    if (limit < 1 || limit > 50) {
      return {
        type: 'message' as const,
        messageType: 'error' as const,
        content: '✗ Limit must be between 1 and 50.',
      };
    }

    try {
      const interactions = await supabaseService.getUserInteractions(limit, 0);
      
      if (interactions.length === 0) {
        return {
          type: 'message' as const,
          messageType: 'info' as const,
          content: 'No interaction history found.',
        };
      }

      let message = `# 📋 Recent Interactions (${interactions.length})\n\n`;
      
      interactions.forEach((interaction, index) => {
        const date = new Date(interaction.interaction_timestamp!).toLocaleString();
        const tokens = interaction.total_token_count || 0;
        const model = interaction.model_name || 'Unknown';
        
        message += `**${index + 1}.** ${date}\n`;
        message += `   Model: ${model} | Tokens: ${tokens}\n`;
        
        if (interaction.prompt_text && interaction.prompt_text !== '[REDACTED]') {
          const preview = interaction.prompt_text.substring(0, 80);
          message += `   Prompt: ${preview}${interaction.prompt_text.length > 80 ? '...' : ''}\n`;
        }
        message += '\n';
      });

      return {
        type: 'message' as const,
        messageType: 'info' as const,
        content: message,
      };
    } catch (error) {
      return {
        type: 'message' as const,
        messageType: 'error' as const,
        content: `✗ Error fetching history: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

const queueCommand: SlashCommand = {
  name: 'queue',
  description: 'Show current tracking queue status',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext) => {
    const tracker = getInteractionTracker();
    const queueStatus = tracker.getQueueStatus();

    let message = '# 🔄 Tracking Queue Status\n\n';
    message += `**Enabled:** ${queueStatus.isEnabled ? '✓ Yes' : '✗ No'}\n`;
    message += `**Pending Interactions:** ${queueStatus.pendingCount}\n`;
    message += `**Currently Processing:** ${queueStatus.isProcessing ? 'Yes' : 'No'}\n`;

    if (queueStatus.pendingCount > 0) {
      message += '\n*Interactions are processed in batches every 5 seconds.*';
    }

    return {
      type: 'message' as const,
      messageType: 'info' as const,
      content: message,
    };
  },
};

const flushCommand: SlashCommand = {
  name: 'flush',
  description: 'Force flush pending interactions to database',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext) => {
    const tracker = getInteractionTracker();
    const queueStatus = tracker.getQueueStatus();

    if (!queueStatus.isEnabled) {
      return {
        type: 'message' as const,
        messageType: 'error' as const,
        content: '✗ Tracking is disabled.',
      };
    }

    if (queueStatus.pendingCount === 0) {
      return {
        type: 'message' as const,
        messageType: 'info' as const,
        content: '✓ No pending interactions to flush.',
      };
    }

    try {
      await tracker.flush();
      return {
        type: 'message' as const,
        messageType: 'info' as const,
        content: `✓ Flushed ${queueStatus.pendingCount} pending interactions.`,
      };
    } catch (error) {
      return {
        type: 'message' as const,
        messageType: 'error' as const,
        content: `✗ Error flushing queue: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

export const usageCommand: SlashCommand = {
  name: 'usage',
  description: 'View usage statistics and manage tracking data',
  kind: CommandKind.BUILT_IN,
  subCommands: [statsCommand, historyCommand, queueCommand, flushCommand],
  action: async (context: CommandContext, args: string) => {
    // Default action when no subcommand is provided
    return statsCommand.action!(context, args);
  },
};
