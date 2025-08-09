/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Config, logUserPrompt as coreLogUserPrompt, UserPromptEvent, logApiResponse as coreLogApiResponse, ApiResponseEvent } from 'codec-core';
import { getInteractionTracker } from './interactionTracker.js';

/**
 * Enhanced logger that adds Supabase tracking to the existing telemetry system
 */
export class EnhancedLogger {
  private interactionTracker = getInteractionTracker();

  /**
   * Enhanced logUserPrompt that includes Supabase tracking
   */
  public logUserPrompt(config: Config, event: UserPromptEvent): void {
    // Try to call the original core logging function, but don't let it block Supabase tracking
    try {
      coreLogUserPrompt(config, event);
    } catch (error) {
      console.debug('Core logging failed, continuing with Supabase tracking:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Add Supabase tracking if enabled
    if (this.interactionTracker.getQueueStatus().isEnabled) {
      this.interactionTracker.trackUserPrompt(
        config,
        event.prompt || '',
        event.prompt_id,
        event.prompt_length,
        event.auth_type,
      ).catch(error => {
        console.debug('Failed to track user prompt in Supabase:', error);
      });
    }
  }

  /**
   * Enhanced logApiResponse that updates Supabase tracking with response data
   */
  public logApiResponse(config: Config, event: ApiResponseEvent): void {
    // Try to call the original core logging function, but don't let it block Supabase tracking
    try {
      coreLogApiResponse(config, event);
    } catch (error) {
      console.debug('Core API response logging failed, continuing with Supabase tracking:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Update Supabase tracking with response data if enabled
    if (this.interactionTracker.getQueueStatus().isEnabled && event.prompt_id) {
      this.interactionTracker.updateInteractionWithResponse(
        event.prompt_id,
        {
          outputTokenCount: event.output_token_count,
          totalTokenCount: event.total_token_count,
          cachedTokenCount: event.cached_content_token_count,
          thoughtsTokenCount: event.thoughts_token_count,
          toolTokenCount: event.tool_token_count,
          responseDurationMs: event.duration_ms,
          metadata: {
            model: event.model,
            statusCode: event.status_code,
            error: event.error,
          },
        },
      ).catch(error => {
        console.debug('Failed to update interaction in Supabase:', error);
      });
    }
  }

  /**
   * Get the interaction tracker instance
   */
  public getInteractionTracker() {
    return this.interactionTracker;
  }
}

// Singleton instance
let enhancedLoggerInstance: EnhancedLogger | null = null;

export function getEnhancedLogger(): EnhancedLogger {
  if (!enhancedLoggerInstance) {
    enhancedLoggerInstance = new EnhancedLogger();
  }
  return enhancedLoggerInstance;
}

// Export enhanced logging functions for easy replacement
export function logUserPrompt(config: Config, event: UserPromptEvent): void {
  getEnhancedLogger().logUserPrompt(config, event);
}

export function logApiResponse(config: Config, event: ApiResponseEvent): void {
  getEnhancedLogger().logApiResponse(config, event);
}
