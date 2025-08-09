/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config } from 'codec-core';
import { getSupabaseService, UserInteraction } from './supabaseClient.js';
import { getPrivacyService } from './privacyService.js';

export interface TrackingData {
  promptText: string;
  promptId: string;
  sessionId: string;
  modelName?: string;
  authType?: string;
  inputTokenCount?: number;
  outputTokenCount?: number;
  totalTokenCount?: number;
  cachedTokenCount?: number;
  thoughtsTokenCount?: number;
  toolTokenCount?: number;
  responseDurationMs?: number;
  metadata?: Record<string, unknown>;
  config?: Config;
}

export class InteractionTracker {
  private supabaseService = getSupabaseService();
  private privacyService = getPrivacyService();
  private pendingInteractions: TrackingData[] = [];
  private isProcessing = false;
  private batchSize = 10;
  private flushInterval = 5000; // 5 seconds
  private flushTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startBatchProcessor();
    this.setupGracefulShutdown();
  }

  /**
   * Track a user interaction asynchronously
   */
  public async trackInteraction(data: TrackingData): Promise<void> {
    // Check privacy settings before tracking
    if (!this.privacyService.isTrackingEnabled()) {
      return;
    }

    // Filter data based on privacy settings
    const filteredData: TrackingData = {
      ...data,
      promptText: this.privacyService.shouldTrackPrompts() ? data.promptText : '[REDACTED]',
      inputTokenCount: this.privacyService.shouldTrackTokens() ? data.inputTokenCount : undefined,
      outputTokenCount: this.privacyService.shouldTrackTokens() ? data.outputTokenCount : undefined,
      totalTokenCount: this.privacyService.shouldTrackTokens() ? data.totalTokenCount : undefined,
      cachedTokenCount: this.privacyService.shouldTrackTokens() ? data.cachedTokenCount : undefined,
      thoughtsTokenCount: this.privacyService.shouldTrackTokens() ? data.thoughtsTokenCount : undefined,
      toolTokenCount: this.privacyService.shouldTrackTokens() ? data.toolTokenCount : undefined,
      metadata: this.privacyService.shouldTrackMetadata() ? data.metadata : undefined,
    };

    // Add to pending queue for batch processing
    this.pendingInteractions.push(filteredData);

    // Update last prompt date for privacy tracking
    this.privacyService.updateLastPromptDate();

    // If we have enough interactions, process immediately
    if (this.pendingInteractions.length >= this.batchSize) {
      this.processPendingInteractions();
    }
  }

  /**
   * Track a user prompt with basic information
   */
  public async trackUserPrompt(
    config: Config,
    promptText: string,
    promptId: string,
    promptLength: number,
    authType?: string,
  ): Promise<void> {
    if (!this.supabaseService.isEnabled()) {
      return;
    }

    const trackingData: TrackingData = {
      promptText,
      promptId,
      sessionId: config.getSessionId(),
      modelName: config.getModel(),
      authType,
      inputTokenCount: promptLength,
      metadata: {
        promptLength,
        timestamp: new Date().toISOString(),
      },
      config,
    };

    await this.trackInteraction(trackingData);
  }

  /**
   * Update an existing interaction with response data
   */
  public async updateInteractionWithResponse(
    promptId: string,
    responseData: {
      outputTokenCount?: number;
      totalTokenCount?: number;
      cachedTokenCount?: number;
      thoughtsTokenCount?: number;
      toolTokenCount?: number;
      responseDurationMs?: number;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    if (!this.supabaseService.isEnabled()) {
      return;
    }

    // Find pending interaction with matching promptId
    const pendingIndex = this.pendingInteractions.findIndex(
      interaction => interaction.promptId === promptId
    );

    if (pendingIndex !== -1) {
      // Update pending interaction
      const existingInteraction = this.pendingInteractions[pendingIndex];
      this.pendingInteractions[pendingIndex] = {
        ...existingInteraction,
        ...responseData,
        metadata: {
          ...existingInteraction.metadata,
          ...responseData.metadata,
        },
      };
    } else {
      // If not in pending queue, it might have already been processed
      // In this case, we could implement an update mechanism, but for now
      // we'll just log a warning
      console.debug(`Could not find pending interaction with promptId: ${promptId}`);
    }
  }

  /**
   * Process pending interactions in batches
   */
  private async processPendingInteractions(): Promise<void> {
    if (this.isProcessing || this.pendingInteractions.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const batch = this.pendingInteractions.splice(0, this.batchSize);
      
      // Process each interaction asynchronously without blocking
      const promises = batch.map(async (data) => {
        try {
          const interaction: Omit<UserInteraction, 'user_email'> = {
            prompt_text: data.promptText,
            prompt_id: data.promptId,
            session_id: data.sessionId,
            model_name: data.modelName,
            auth_type: data.authType,
            input_token_count: data.inputTokenCount,
            output_token_count: data.outputTokenCount,
            total_token_count: data.totalTokenCount,
            cached_token_count: data.cachedTokenCount,
            thoughts_token_count: data.thoughtsTokenCount,
            tool_token_count: data.toolTokenCount,
            response_duration_ms: data.responseDurationMs,
            metadata: data.metadata,
          };

          await this.supabaseService.logUserInteraction(interaction, data.config);
        } catch (error) {
          console.warn('Failed to log interaction:', error);
          // Re-add failed interaction to queue for retry
          this.pendingInteractions.unshift(data);
        }
      });

      await Promise.allSettled(promises);
    } catch (error) {
      console.warn('Error processing interaction batch:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start the batch processor timer
   */
  private startBatchProcessor(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      this.processPendingInteractions();
    }, this.flushInterval);
  }

  /**
   * Flush all pending interactions immediately
   */
  public async flush(): Promise<void> {
    while (this.pendingInteractions.length > 0 && !this.isProcessing) {
      await this.processPendingInteractions();
    }
  }

  /**
   * Setup graceful shutdown to flush pending interactions
   */
  private setupGracefulShutdown(): void {
    const shutdown = async () => {
      console.debug('Flushing pending interactions before shutdown...');
      if (this.flushTimer) {
        clearInterval(this.flushTimer);
      }
      await this.flush();
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    process.on('exit', shutdown);
  }

  /**
   * Get current queue status
   */
  public getQueueStatus(): {
    pendingCount: number;
    isProcessing: boolean;
    isEnabled: boolean;
  } {
    return {
      pendingCount: this.pendingInteractions.length,
      isProcessing: this.isProcessing,
      isEnabled: this.supabaseService.isEnabled(),
    };
  }
}

// Singleton instance
let interactionTrackerInstance: InteractionTracker | null = null;

export function getInteractionTracker(): InteractionTracker {
  if (!interactionTrackerInstance) {
    interactionTrackerInstance = new InteractionTracker();
  }
  return interactionTrackerInstance;
}
