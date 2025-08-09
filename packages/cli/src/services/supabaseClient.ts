/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Config, getQwenUserEmail } from 'codec-core';
import { validateSupabaseConfig } from '../config/auth.js';

export interface UserInteraction {
  id?: string;
  user_email: string;
  qwen_account_email?: string;
  prompt_text: string;
  prompt_id: string;
  session_id: string;
  model_name?: string;
  auth_type?: string;
  input_token_count?: number;
  output_token_count?: number;
  total_token_count?: number;
  cached_token_count?: number;
  thoughts_token_count?: number;
  tool_token_count?: number;
  response_duration_ms?: number;
  interaction_timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  userEmail: string;
  enabled: boolean;
}

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private config: SupabaseConfig | null = null;
  private isInitialized = false;
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      const validationError = validateSupabaseConfig();
      if (validationError) {
        console.debug(`Supabase tracking disabled: ${validationError}`);
        return;
      }

      const url = process.env.SUPABASE_URL;
      const anonKey = process.env.SUPABASE_ANON_KEY;
      const userEmail = process.env.SUPABASE_USER_EMAIL;

      if (!url || !anonKey || !userEmail) {
        console.debug('Supabase tracking disabled: Missing required environment variables');
        return;
      }

      // Validate URL format
      try {
        new URL(url);
      } catch {
        console.warn('Supabase tracking disabled: Invalid SUPABASE_URL format');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(userEmail)) {
        console.warn('Supabase tracking disabled: Invalid SUPABASE_USER_EMAIL format');
        return;
      }

      this.config = {
        url,
        anonKey,
        userEmail,
        enabled: true,
      };

      this.client = createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'User-Agent': 'codec-cli',
          },
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });

      this.isInitialized = true;
      console.debug('Supabase client initialized successfully');
    } catch (error) {
      console.warn('Failed to initialize Supabase client:', error instanceof Error ? error.message : 'Unknown error');
      this.isInitialized = false;
      this.client = null;
      this.config = null;
    }
  }

  public isEnabled(): boolean {
    return this.isInitialized && this.config?.enabled === true;
  }

  public async logUserInteraction(
    interaction: Omit<UserInteraction, 'user_email' | 'qwen_account_email'>,
    config?: Config
  ): Promise<boolean> {
    if (!this.isEnabled() || !this.client || !this.config) {
      return false;
    }

    try {
      // Validate required fields
      if (!interaction.prompt_text || !interaction.prompt_id || !interaction.session_id) {
        console.debug('Skipping interaction log: Missing required fields');
        return false;
      }

      // Try to get Qwen account email if config is provided
      let qwenAccountEmail: string | null = null;
      if (config) {
        try {
          qwenAccountEmail = await getQwenUserEmail(config);
        } catch (error) {
          console.debug('Could not fetch Qwen user email:', error);
        }
      }

      const interactionData: UserInteraction = {
        ...interaction,
        user_email: this.config.userEmail,
        qwen_account_email: qwenAccountEmail || undefined,
        interaction_timestamp: new Date().toISOString(),
        // Ensure numeric fields are valid
        input_token_count: Number.isInteger(interaction.input_token_count) ? interaction.input_token_count : 0,
        output_token_count: Number.isInteger(interaction.output_token_count) ? interaction.output_token_count : 0,
        total_token_count: Number.isInteger(interaction.total_token_count) ? interaction.total_token_count : 0,
        cached_token_count: Number.isInteger(interaction.cached_token_count) ? interaction.cached_token_count : 0,
        thoughts_token_count: Number.isInteger(interaction.thoughts_token_count) ? interaction.thoughts_token_count : 0,
        tool_token_count: Number.isInteger(interaction.tool_token_count) ? interaction.tool_token_count : 0,
        response_duration_ms: Number.isInteger(interaction.response_duration_ms) ? interaction.response_duration_ms : undefined,
      };

      const { error } = await this.client
        .from('user_interactions')
        .insert([interactionData]);

      if (error) {
        // Log different error types with appropriate levels
        if (error.code === 'PGRST301') {
          console.debug('Supabase: Row Level Security policy violation');
        } else if (error.code === '23505') {
          console.debug('Supabase: Duplicate key violation');
        } else if (error.message.includes('network')) {
          console.debug('Supabase: Network connectivity issue');
        } else {
          console.warn('Failed to log user interaction to Supabase:', error.message);
        }
        return false;
      }

      this.retryCount = 0; // Reset retry count on success
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.debug('Error logging user interaction:', errorMessage);

      // Only retry on certain types of errors
      if (error instanceof Error && (
        error.message.includes('network') ||
        error.message.includes('timeout') ||
        error.message.includes('ECONNREFUSED') ||
        error.message.includes('ENOTFOUND')
      )) {
        return await this.retryLogInteraction(interaction);
      }

      return false;
    }
  }

  private async retryLogInteraction(interaction: Omit<UserInteraction, 'user_email'>): Promise<boolean> {
    if (this.retryCount >= this.maxRetries) {
      console.warn(`Failed to log interaction after ${this.maxRetries} retries`);
      this.retryCount = 0;
      return false;
    }

    this.retryCount++;
    console.debug(`Retrying interaction log (attempt ${this.retryCount}/${this.maxRetries})`);

    // Exponential backoff
    const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
    await new Promise(resolve => setTimeout(resolve, delay));

    return this.logUserInteraction(interaction);
  }

  public async getUserInteractions(limit = 100, offset = 0): Promise<UserInteraction[]> {
    if (!this.isEnabled() || !this.client || !this.config) {
      return [];
    }

    try {
      const { data, error } = await this.client
        .from('user_interactions')
        .select('*')
        .eq('user_email', this.config.userEmail)
        .order('interaction_timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.warn('Failed to fetch user interactions:', error.message);
        return [];
      }

      return data || [];
    } catch (error) {
      console.warn('Error fetching user interactions:', error);
      return [];
    }
  }

  public async getUserStats(): Promise<{
    totalInteractions: number;
    totalTokens: number;
    averageTokensPerInteraction: number;
    lastInteraction?: string;
  }> {
    if (!this.isEnabled() || !this.client || !this.config) {
      return {
        totalInteractions: 0,
        totalTokens: 0,
        averageTokensPerInteraction: 0,
      };
    }

    try {
      const { data, error } = await this.client
        .from('user_interactions')
        .select('total_token_count, interaction_timestamp')
        .eq('user_email', this.config.userEmail);

      if (error) {
        console.warn('Failed to fetch user stats:', error.message);
        return {
          totalInteractions: 0,
          totalTokens: 0,
          averageTokensPerInteraction: 0,
        };
      }

      const interactions = data || [];
      const totalInteractions = interactions.length;
      const totalTokens = interactions.reduce((sum, interaction) => 
        sum + (interaction.total_token_count || 0), 0);
      const averageTokensPerInteraction = totalInteractions > 0 ? totalTokens / totalInteractions : 0;
      const lastInteraction = interactions.length > 0 ? 
        Math.max(...interactions.map(i => new Date(i.interaction_timestamp).getTime())) : undefined;

      return {
        totalInteractions,
        totalTokens,
        averageTokensPerInteraction: Math.round(averageTokensPerInteraction),
        lastInteraction: lastInteraction ? new Date(lastInteraction).toISOString() : undefined,
      };
    } catch (error) {
      console.warn('Error fetching user stats:', error);
      return {
        totalInteractions: 0,
        totalTokens: 0,
        averageTokensPerInteraction: 0,
      };
    }
  }

  public async deleteUserData(): Promise<boolean> {
    if (!this.isEnabled() || !this.client || !this.config) {
      return false;
    }

    try {
      const { error } = await this.client
        .from('user_interactions')
        .delete()
        .eq('user_email', this.config.userEmail);

      if (error) {
        console.warn('Failed to delete user data:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.warn('Error deleting user data:', error);
      return false;
    }
  }

  public getConfig(): SupabaseConfig | null {
    return this.config;
  }

  public async healthCheck(): Promise<{
    isHealthy: boolean;
    error?: string;
    latencyMs?: number;
  }> {
    if (!this.isEnabled() || !this.client) {
      return {
        isHealthy: false,
        error: 'Supabase client not initialized',
      };
    }

    try {
      const startTime = Date.now();

      // Simple health check query
      const { error } = await this.client
        .from('user_interactions')
        .select('id')
        .limit(1);

      const latencyMs = Date.now() - startTime;

      if (error) {
        return {
          isHealthy: false,
          error: error.message,
          latencyMs,
        };
      }

      return {
        isHealthy: true,
        latencyMs,
      };
    } catch (error) {
      return {
        isHealthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async reconnect(): Promise<boolean> {
    console.debug('Attempting to reconnect to Supabase...');
    this.isInitialized = false;
    this.client = null;
    this.config = null;
    this.retryCount = 0;

    this.initialize();

    if (this.isInitialized) {
      const health = await this.healthCheck();
      return health.isHealthy;
    }

    return false;
  }
}

// Singleton instance
let supabaseServiceInstance: SupabaseService | null = null;

export function getSupabaseService(): SupabaseService {
  if (!supabaseServiceInstance) {
    supabaseServiceInstance = new SupabaseService();
  }
  return supabaseServiceInstance;
}
