/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupabaseService, UserInteraction } from './supabaseClient.js';

// Mock Supabase client
const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  select: mockSelect,
  delete: mockDelete,
  eq: vi.fn(() => ({
    order: vi.fn(() => ({
      range: vi.fn(() => ({ data: [], error: null })),
    })),
    delete: mockDelete,
  })),
  order: vi.fn(() => ({
    range: vi.fn(() => ({ data: [], error: null })),
  })),
  range: vi.fn(() => ({ data: [], error: null })),
}));

const mockCreateClient = vi.fn(() => ({
  from: mockFrom,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

// Mock auth validation
vi.mock('../config/auth.js', () => ({
  validateSupabaseConfig: vi.fn(() => null),
}));

describe('SupabaseService', () => {
  let service: SupabaseService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_USER_EMAIL = 'test@example.com';
    
    vi.clearAllMocks();
    service = new SupabaseService();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('initialization', () => {
    it('should initialize successfully with valid environment variables', () => {
      expect(service.isEnabled()).toBe(true);
      expect(mockCreateClient).toHaveBeenCalledWith(
        'https://test.supabase.co',
        'test-anon-key',
        expect.objectContaining({
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      );
    });

    it('should not initialize with missing environment variables', () => {
      delete process.env.SUPABASE_URL;
      const newService = new SupabaseService();
      expect(newService.isEnabled()).toBe(false);
    });

    it('should not initialize with invalid URL', () => {
      process.env.SUPABASE_URL = 'invalid-url';
      const newService = new SupabaseService();
      expect(newService.isEnabled()).toBe(false);
    });

    it('should not initialize with invalid email', () => {
      process.env.SUPABASE_USER_EMAIL = 'invalid-email';
      const newService = new SupabaseService();
      expect(newService.isEnabled()).toBe(false);
    });
  });

  describe('logUserInteraction', () => {
    const mockInteraction: Omit<UserInteraction, 'user_email'> = {
      prompt_text: 'Test prompt',
      prompt_id: 'test-prompt-id',
      session_id: 'test-session-id',
      model_name: 'test-model',
      input_token_count: 10,
      output_token_count: 20,
      total_token_count: 30,
    };

    it('should log interaction successfully', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const result = await service.logUserInteraction(mockInteraction);

      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('user_interactions');
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          ...mockInteraction,
          user_email: 'test@example.com',
          interaction_timestamp: expect.any(String),
        }),
      ]);
    });

    it('should handle database errors gracefully', async () => {
      mockInsert.mockResolvedValue({ error: { message: 'Database error' } });

      const result = await service.logUserInteraction(mockInteraction);

      expect(result).toBe(false);
    });

    it('should validate required fields', async () => {
      const invalidInteraction = {
        ...mockInteraction,
        prompt_text: '',
      };

      const result = await service.logUserInteraction(invalidInteraction);

      expect(result).toBe(false);
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should sanitize numeric fields', async () => {
      mockInsert.mockResolvedValue({ error: null });

      const interactionWithInvalidNumbers = {
        ...mockInteraction,
        input_token_count: NaN,
        output_token_count: 'invalid' as any,
      };

      await service.logUserInteraction(interactionWithInvalidNumbers);

      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          input_token_count: 0,
          output_token_count: 0,
        }),
      ]);
    });
  });

  describe('getUserStats', () => {
    it('should return user statistics', async () => {
      const mockData = [
        { total_token_count: 100, interaction_timestamp: '2023-01-01T00:00:00Z' },
        { total_token_count: 200, interaction_timestamp: '2023-01-02T00:00:00Z' },
      ];

      mockSelect.mockReturnValue({
        eq: vi.fn(() => ({ data: mockData, error: null })),
      });

      const stats = await service.getUserStats();

      expect(stats).toEqual({
        totalInteractions: 2,
        totalTokens: 300,
        averageTokensPerInteraction: 150,
        lastInteraction: expect.any(String),
      });
    });

    it('should handle empty data', async () => {
      mockSelect.mockReturnValue({
        eq: vi.fn(() => ({ data: [], error: null })),
      });

      const stats = await service.getUserStats();

      expect(stats).toEqual({
        totalInteractions: 0,
        totalTokens: 0,
        averageTokensPerInteraction: 0,
      });
    });
  });

  describe('healthCheck', () => {
    it('should return healthy status when database is accessible', async () => {
      mockSelect.mockReturnValue({
        limit: vi.fn(() => ({ error: null })),
      });

      const health = await service.healthCheck();

      expect(health.isHealthy).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return unhealthy status when database is not accessible', async () => {
      mockSelect.mockReturnValue({
        limit: vi.fn(() => ({ error: { message: 'Connection failed' } })),
      });

      const health = await service.healthCheck();

      expect(health.isHealthy).toBe(false);
      expect(health.error).toBe('Connection failed');
    });
  });

  describe('deleteUserData', () => {
    it('should delete user data successfully', async () => {
      mockDelete.mockResolvedValue({ error: null });

      const result = await service.deleteUserData();

      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('user_interactions');
    });

    it('should handle deletion errors', async () => {
      mockDelete.mockResolvedValue({ error: { message: 'Deletion failed' } });

      const result = await service.deleteUserData();

      expect(result).toBe(false);
    });
  });
});
