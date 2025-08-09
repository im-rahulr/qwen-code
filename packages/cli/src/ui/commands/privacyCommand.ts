/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { SlashCommand, CommandKind, CommandContext } from './types.js';
import { getPrivacyService } from '../../services/privacyService.js';
import { getSupabaseService } from '../../services/supabaseClient.js';
import { getInteractionTracker } from '../../services/interactionTracker.js';

const showStatusCommand: SlashCommand = {
  name: 'status',
  description: 'Show current privacy and tracking status',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext) => {
    const privacyService = getPrivacyService();
    const supabaseService = getSupabaseService();
    const tracker = getInteractionTracker();

    const settings = privacyService.getSettings();
    const config = supabaseService.getConfig();
    const queueStatus = tracker.getQueueStatus();
    const retentionInfo = privacyService.getDataRetentionInfo();

    let status = '# Privacy & Tracking Status\n\n';

    status += `**Supabase Configuration:** ${config ? '✓ Configured' : '✗ Not configured'}\n`;
    status += `**User Email:** ${config?.userEmail || 'Not set'}\n`;
    status += `**Tracking Enabled:** ${privacyService.isTrackingEnabled() ? '✓ Yes' : '✗ No'}\n`;
    status += `**Consent Given:** ${settings.consentGiven ? '✓ Yes' : '✗ No'}\n`;

    if (settings.consentDate) {
      status += `**Consent Date:** ${new Date(settings.consentDate).toLocaleDateString()}\n`;
    }

    status += '\n## Tracking Settings\n\n';
    status += `**Track Prompts:** ${settings.trackPrompts ? '✓ Yes' : '✗ No'}\n`;
    status += `**Track Tokens:** ${settings.trackTokens ? '✓ Yes' : '✗ No'}\n`;
    status += `**Track Metadata:** ${settings.trackMetadata ? '✓ Yes' : '✗ No'}\n`;
    status += `**Data Retention:** ${settings.dataRetentionDays} days\n`;

    if (retentionInfo.nextCleanupDate) {
      status += `**Next Cleanup:** ${new Date(retentionInfo.nextCleanupDate).toLocaleDateString()}\n`;
    }

    status += '\n## Current Session\n\n';
    status += `**Pending Interactions:** ${queueStatus.pendingCount}\n`;
    status += `**Processing:** ${queueStatus.isProcessing ? 'Yes' : 'No'}\n`;

    return {
      type: 'message' as const,
      messageType: 'info' as const,
      content: status,
    };
  },
};

const consentCommand: SlashCommand = {
  name: 'consent',
  description: 'Give or revoke consent for usage tracking',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string) => {
    const privacyService = getPrivacyService();
    const action = args.trim().toLowerCase();

    if (action === 'give' || action === 'yes' || action === 'enable') {
      privacyService.giveConsent();
      return {
        type: 'message' as const,
        messageType: 'info' as const,
        content: '✓ Consent given. Usage tracking is now enabled.\n\nYou can revoke consent at any time using `/privacy consent revoke`.',
      };
    } else if (action === 'revoke' || action === 'no' || action === 'disable') {
      privacyService.revokeConsent();
      return {
        type: 'message' as const,
        messageType: 'info' as const,
        content: '✓ Consent revoked. Usage tracking is now disabled.\n\nYour existing data remains stored. Use `/privacy delete` to remove it.',
      };
    } else {
      const settings = privacyService.getSettings();
      const consentText = privacyService.getConsentText();

      return {
        type: 'message' as const,
        messageType: 'info' as const,
        content: `${consentText}\n\n**Current Status:** ${settings.consentGiven ? 'Consent given' : 'No consent'}\n\nUse \`/privacy consent give\` to enable tracking or \`/privacy consent revoke\` to disable it.`,
      };
    }
  },
};

const deleteCommand: SlashCommand = {
  name: 'delete',
  description: 'Delete all stored usage data',
  kind: CommandKind.BUILT_IN,
  action: async (context: CommandContext, args: string) => {
    const privacyService = getPrivacyService();
    const confirm = args.trim().toLowerCase();

    if (confirm !== 'confirm') {
      return {
        type: 'message' as const,
        messageType: 'info' as const,
        content: '⚠️  **Warning:** This will permanently delete all your stored usage data.\n\nThis action cannot be undone. Use `/privacy delete confirm` to proceed.',
      };
    }

    try {
      const success = await privacyService.deleteAllData();

      if (success) {
        return {
          type: 'message' as const,
          messageType: 'info' as const,
          content: '✓ All usage data has been deleted successfully.\n\nTracking consent has been revoked. You can re-enable tracking using `/privacy consent give`.',
        };
      } else {
        return {
          type: 'message' as const,
          messageType: 'error' as const,
          content: '✗ Failed to delete usage data. Please check your connection and try again.',
        };
      }
    } catch (error) {
      return {
        type: 'message' as const,
        messageType: 'error' as const,
        content: `✗ Error deleting data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  },
};

export const privacyCommand: SlashCommand = {
  name: 'privacy',
  description: 'Manage privacy settings and usage data',
  kind: CommandKind.BUILT_IN,
  subCommands: [showStatusCommand, consentCommand, deleteCommand],
  action: async (context: CommandContext, args: string) => {
    // Default action when no subcommand is provided
    return showStatusCommand.action!(context, args);
  },
};
