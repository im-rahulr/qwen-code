/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { getSupabaseService } from './supabaseClient.js';

export interface PrivacySettings {
  supabaseTrackingEnabled: boolean;
  dataRetentionDays: number;
  trackPrompts: boolean;
  trackTokens: boolean;
  trackMetadata: boolean;
  consentGiven: boolean;
  consentDate?: string;
  lastPromptDate?: string;
}

const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  supabaseTrackingEnabled: false,
  dataRetentionDays: 90,
  trackPrompts: true,
  trackTokens: true,
  trackMetadata: true,
  consentGiven: false,
};

export class PrivacyService {
  private settingsPath: string;
  private settings: PrivacySettings;

  constructor() {
    this.settingsPath = path.join(homedir(), '.qwen', 'privacy.json');
    this.settings = this.loadSettings();
  }

  private loadSettings(): PrivacySettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const content = fs.readFileSync(this.settingsPath, 'utf-8');
        const loadedSettings = JSON.parse(content) as PrivacySettings;
        return { ...DEFAULT_PRIVACY_SETTINGS, ...loadedSettings };
      }
    } catch (error) {
      console.warn('Failed to load privacy settings:', error);
    }
    return { ...DEFAULT_PRIVACY_SETTINGS };
  }

  private saveSettings(): void {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
    } catch (error) {
      console.error('Failed to save privacy settings:', error);
    }
  }

  public getSettings(): PrivacySettings {
    return { ...this.settings };
  }

  public isTrackingEnabled(): boolean {
    return this.settings.supabaseTrackingEnabled && this.settings.consentGiven;
  }

  public shouldTrackPrompts(): boolean {
    return this.isTrackingEnabled() && this.settings.trackPrompts;
  }

  public shouldTrackTokens(): boolean {
    return this.isTrackingEnabled() && this.settings.trackTokens;
  }

  public shouldTrackMetadata(): boolean {
    return this.isTrackingEnabled() && this.settings.trackMetadata;
  }

  public giveConsent(): void {
    this.settings.consentGiven = true;
    this.settings.consentDate = new Date().toISOString();
    this.settings.supabaseTrackingEnabled = true;
    this.saveSettings();
  }

  public revokeConsent(): void {
    this.settings.consentGiven = false;
    this.settings.supabaseTrackingEnabled = false;
    this.saveSettings();
  }

  public updateSettings(newSettings: Partial<PrivacySettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.saveSettings();
  }

  public async deleteAllData(): Promise<boolean> {
    const supabaseService = getSupabaseService();
    const success = await supabaseService.deleteUserData();
    
    if (success) {
      // Reset consent after successful deletion
      this.revokeConsent();
    }
    
    return success;
  }

  public needsConsentPrompt(): boolean {
    // Show consent prompt if:
    // 1. No consent has been given yet
    // 2. Supabase is configured but tracking is disabled
    const supabaseService = getSupabaseService();
    const supabaseConfigured = supabaseService.getConfig() !== null;
    
    return supabaseConfigured && !this.settings.consentGiven;
  }

  public updateLastPromptDate(): void {
    this.settings.lastPromptDate = new Date().toISOString();
    this.saveSettings();
  }

  public getDataRetentionInfo(): {
    retentionDays: number;
    nextCleanupDate?: string;
  } {
    const retentionDays = this.settings.dataRetentionDays;
    let nextCleanupDate: string | undefined;

    if (this.settings.lastPromptDate) {
      const lastPrompt = new Date(this.settings.lastPromptDate);
      const nextCleanup = new Date(lastPrompt.getTime() + (retentionDays * 24 * 60 * 60 * 1000));
      nextCleanupDate = nextCleanup.toISOString();
    }

    return {
      retentionDays,
      nextCleanupDate,
    };
  }

  public async cleanupOldData(): Promise<number> {
    // This would require a more sophisticated query to delete old data
    // For now, we'll just return 0 as a placeholder
    // In a real implementation, you'd query Supabase for old records and delete them
    console.log('Data cleanup not yet implemented');
    return 0;
  }

  public getConsentText(): string {
    return `
Usage Tracking Consent

The CLI can track your usage to help improve the service. This includes:

${this.settings.trackPrompts ? '✓' : '✗'} Your prompts and queries
${this.settings.trackTokens ? '✓' : '✗'} Token usage statistics  
${this.settings.trackMetadata ? '✓' : '✗'} Session metadata (model, auth type, etc.)

Data retention: ${this.settings.dataRetentionDays} days

Your data will be:
- Stored securely in Supabase
- Associated with your email address
- Automatically deleted after ${this.settings.dataRetentionDays} days
- Never shared with third parties
- Deletable at any time using the /privacy command

You can change these settings or revoke consent at any time.
    `.trim();
  }

  public exportUserData(): Promise<any[]> {
    const supabaseService = getSupabaseService();
    return supabaseService.getUserInteractions(1000, 0);
  }
}

// Singleton instance
let privacyServiceInstance: PrivacyService | null = null;

export function getPrivacyService(): PrivacyService {
  if (!privacyServiceInstance) {
    privacyServiceInstance = new PrivacyService();
  }
  return privacyServiceInstance;
}
