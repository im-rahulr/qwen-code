/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getPrivacyService } from './privacyService.js';
import { getSupabaseService } from './supabaseClient.js';

export interface ConsentPromptResult {
  shouldShow: boolean;
  message?: string;
}

export class ConsentManager {
  private privacyService = getPrivacyService();
  private supabaseService = getSupabaseService();
  private hasShownPromptThisSession = false;

  /**
   * Check if consent prompt should be shown
   */
  public shouldShowConsentPrompt(): ConsentPromptResult {
    // Don't show if already shown this session
    if (this.hasShownPromptThisSession) {
      return { shouldShow: false };
    }

    // Don't show if Supabase is not configured
    const config = this.supabaseService.getConfig();
    if (!config) {
      return { shouldShow: false };
    }

    // Don't show if consent already given
    if (this.privacyService.isTrackingEnabled()) {
      return { shouldShow: false };
    }

    // Show if Supabase is configured but no consent given
    if (this.privacyService.needsConsentPrompt()) {
      this.hasShownPromptThisSession = true;
      return {
        shouldShow: true,
        message: this.generateConsentMessage(),
      };
    }

    return { shouldShow: false };
  }

  private generateConsentMessage(): string {
    const consentText = this.privacyService.getConsentText();
    
    return `
🔒 **Usage Tracking Available**

${consentText}

**Commands:**
- \`/privacy consent give\` - Enable tracking
- \`/privacy consent revoke\` - Disable tracking  
- \`/privacy status\` - View current settings
- \`/usage stats\` - View usage statistics (after enabling)

*This prompt will only be shown once per session.*
    `.trim();
  }

  /**
   * Mark that consent prompt has been shown this session
   */
  public markPromptShown(): void {
    this.hasShownPromptThisSession = true;
  }

  /**
   * Reset session state (for testing or new sessions)
   */
  public resetSession(): void {
    this.hasShownPromptThisSession = false;
  }

  /**
   * Get a quick status message for the CLI
   */
  public getQuickStatus(): string {
    const config = this.supabaseService.getConfig();
    const isEnabled = this.privacyService.isTrackingEnabled();
    
    if (!config) {
      return '';
    }

    if (isEnabled) {
      return '📊 Usage tracking: Enabled';
    } else {
      return '📊 Usage tracking: Available (use /privacy to configure)';
    }
  }

  /**
   * Check if user should be reminded about tracking
   */
  public shouldShowReminder(): boolean {
    const config = this.supabaseService.getConfig();
    if (!config) return false;

    const settings = this.privacyService.getSettings();
    
    // Show reminder if:
    // 1. Supabase is configured
    // 2. No consent given
    // 3. Haven't shown prompt this session
    return !settings.consentGiven && !this.hasShownPromptThisSession;
  }
}

// Singleton instance
let consentManagerInstance: ConsentManager | null = null;

export function getConsentManager(): ConsentManager {
  if (!consentManagerInstance) {
    consentManagerInstance = new ConsentManager();
  }
  return consentManagerInstance;
}
