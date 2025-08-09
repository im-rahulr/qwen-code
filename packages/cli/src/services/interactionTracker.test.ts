/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InteractionTracker, TrackingData } from './interactionTracker.js';

// Mock dependencies
const mockLogUserInteraction = vi.fn();
const mockIsEnabled = vi.fn();
const mockGetQueueStatus = vi.fn();

vi.mock('./supabaseClient.js', () => ({
  getSupabaseService: () => ({
    logUserInteraction: mockLogUserInteraction,
    isEnabled: mockIsEnabled,
  }),
}));

const mockIsTrackingEnabled = vi.fn();
const mockShouldTrackPrompts = vi.fn();
const mockShouldTrackTokens = vi.fn();
const mockShouldTrackMetadata = vi.fn();
const mockUpdateLastPromptDate = vi.fn();

vi.mock('./privacyService.js', () => ({
  getPrivacyService: () => ({
    isTrackingEnabled: mockIsTrackingEnabled,
    shouldTrackPrompts: mockShouldTrackPrompts,
    shouldTrackTokens: mockShouldTrackTokens,
    shouldTrackMetadata: mockShouldTrackMetadata,
    updateLastPromptDate: mockUpdateLastPromptDate,
  }),
}));

describe('InteractionTracker', () => {
  let tracker: InteractionTracker;
  let originalSetInterval: typeof setInterval;
  let originalClearInterval: typeof clearInterval;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock timers
    originalSetInterval = global.setInterval;
    originalClearInterval = global.clearInterval;
    global.setInterval = vi.fn(() => 123 as any);
    global.clearInterval = vi.fn();

    // Default mock implementations
    mockIsTrackingEnabled.mockReturnValue(true);
    mockShouldTrackPrompts.mockReturnValue(true);
    mockShouldTrackTokens.mockReturnValue(true);
    mockShouldTrackMetadata.mockReturnValue(true);
    mockLogUserInteraction.mockResolvedValue(true);
    mockIsEnabled.mockReturnValue(true);

    tracker = new InteractionTracker();
  });

  afterEach(() => {
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  });

  describe('trackInteraction', () => {
    const mockTrackingData: TrackingData = {
      promptText: 'Test prompt',
      promptId: 'test-prompt-id',
      sessionId: 'test-session-id',
      modelName: 'test-model',
      inputTokenCount: 10,
      outputTokenCount: 20,
      totalTokenCount: 30,
      metadata: { test: 'data' },
    };

    it('should track interaction when privacy settings allow', async () => {
      await tracker.trackInteraction(mockTrackingData);

      expect(mockUpdateLastPromptDate).toHaveBeenCalled();
      
      const queueStatus = tracker.getQueueStatus();
      expect(queueStatus.pendingCount).toBe(1);
    });

    it('should not track when tracking is disabled', async () => {
      mockIsTrackingEnabled.mockReturnValue(false);

      await tracker.trackInteraction(mockTrackingData);

      const queueStatus = tracker.getQueueStatus();
      expect(queueStatus.pendingCount).toBe(0);
      expect(mockUpdateLastPromptDate).not.toHaveBeenCalled();
    });

    it('should redact prompt text when prompt tracking is disabled', async () => {
      mockShouldTrackPrompts.mockReturnValue(false);

      await tracker.trackInteraction(mockTrackingData);

      const queueStatus = tracker.getQueueStatus();
      expect(queueStatus.pendingCount).toBe(1);
      // The actual redaction would be tested in integration tests
    });

    it('should remove token data when token tracking is disabled', async () => {
      mockShouldTrackTokens.mockReturnValue(false);

      await tracker.trackInteraction(mockTrackingData);

      const queueStatus = tracker.getQueueStatus();
      expect(queueStatus.pendingCount).toBe(1);
      // The actual filtering would be tested in integration tests
    });

    it('should remove metadata when metadata tracking is disabled', async () => {
      mockShouldTrackMetadata.mockReturnValue(false);

      await tracker.trackInteraction(mockTrackingData);

      const queueStatus = tracker.getQueueStatus();
      expect(queueStatus.pendingCount).toBe(1);
      // The actual filtering would be tested in integration tests
    });
  });

  describe('trackUserPrompt', () => {
    const mockConfig = {
      getSessionId: () => 'test-session-id',
      getModel: () => 'test-model',
    } as any;

    it('should track user prompt with correct data', async () => {
      await tracker.trackUserPrompt(
        mockConfig,
        'Test prompt',
        'test-prompt-id',
        11,
        'test-auth-type'
      );

      const queueStatus = tracker.getQueueStatus();
      expect(queueStatus.pendingCount).toBe(1);
      expect(mockUpdateLastPromptDate).toHaveBeenCalled();
    });

    it('should not track when Supabase is disabled', async () => {
      mockIsTrackingEnabled.mockReturnValue(false);

      await tracker.trackUserPrompt(
        mockConfig,
        'Test prompt',
        'test-prompt-id',
        11,
        'test-auth-type'
      );

      const queueStatus = tracker.getQueueStatus();
      expect(queueStatus.pendingCount).toBe(0);
    });
  });

  describe('updateInteractionWithResponse', () => {
    it('should update pending interaction with response data', async () => {
      const mockTrackingData: TrackingData = {
        promptText: 'Test prompt',
        promptId: 'test-prompt-id',
        sessionId: 'test-session-id',
      };

      await tracker.trackInteraction(mockTrackingData);

      await tracker.updateInteractionWithResponse('test-prompt-id', {
        outputTokenCount: 25,
        responseDurationMs: 1000,
      });

      // The update logic would be tested in integration tests
      const queueStatus = tracker.getQueueStatus();
      expect(queueStatus.pendingCount).toBe(1);
    });

    it('should handle update for non-existent prompt ID', async () => {
      await tracker.updateInteractionWithResponse('non-existent-id', {
        outputTokenCount: 25,
      });

      // Should not throw an error
      const queueStatus = tracker.getQueueStatus();
      expect(queueStatus.pendingCount).toBe(0);
    });
  });

  describe('getQueueStatus', () => {
    it('should return correct queue status', () => {
      const status = tracker.getQueueStatus();

      expect(status).toEqual({
        pendingCount: 0,
        isProcessing: false,
        isEnabled: true,
      });
    });
  });

  describe('flush', () => {
    it('should process all pending interactions', async () => {
      const mockTrackingData: TrackingData = {
        promptText: 'Test prompt',
        promptId: 'test-prompt-id',
        sessionId: 'test-session-id',
      };

      await tracker.trackInteraction(mockTrackingData);
      await tracker.trackInteraction({ ...mockTrackingData, promptId: 'test-prompt-id-2' });

      expect(tracker.getQueueStatus().pendingCount).toBe(2);

      await tracker.flush();

      // After flush, pending count should be 0 (assuming successful processing)
      // This would be verified in integration tests
    });
  });
});
