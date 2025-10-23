/**
 * User Data Export Service
 * Implements GDPR Art. 15 (Right to access) and Art. 20 (Right to data portability)
 */

import { supabase } from '@/lib/supabase';
import type {
  DataCategory,
  DataExportFormat,
  DataSubjectRequest,
  UserDataExport,
} from '@/types/privacy';

interface UserDataPackage {
  userId: string;
  exportedAt: Date;
  format: DataExportFormat;
  categories: Record<DataCategory, unknown>;
  metadata: {
    version: string;
    totalRecords: number;
    dateRange?: {
      from: Date;
      to: Date;
    };
  };
}

export class UserDataExportService {
  /**
   * Create a data subject access request
   */
  async createAccessRequest(
    userId: string,
    requestType: 'access' | 'portability' = 'access'
  ): Promise<DataSubjectRequest> {
    const request: DataSubjectRequest = {
      id: crypto.randomUUID(),
      userId,
      requestType,
      status: 'pending',
      requestedAt: new Date(),
      verificationToken: this.generateVerificationToken(),
    };

    const { error } = await supabase.from('data_subject_requests').insert({
      id: request.id,
      user_id: request.userId,
      request_type: request.requestType,
      status: request.status,
      requested_at: request.requestedAt.toISOString(),
      verification_token: request.verificationToken,
    });

    if (error) {
      throw new Error(`Failed to create access request: ${error.message}`);
    }

    return request;
  }

  /**
   * Verify access request with token
   */
  async verifyAccessRequest(
    requestId: string,
    verificationToken: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('data_subject_requests')
      .select('verification_token')
      .eq('id', requestId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.verification_token === verificationToken;
  }

  /**
   * Export user identity data
   */
  private async exportIdentityData(
    userId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<unknown> {
    let query = supabase
      .from('users')
      .select('id, email, display_name, created_at, updated_at')
      .eq('id', userId);

    if (dateRange) {
      query = query
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());
    }

    const { data, error } = await query.single();

    if (error) {
      console.error('Error exporting identity data:', error);
      return null;
    }

    return data;
  }

  /**
   * Export user content data
   */
  private async exportContentData(
    userId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<unknown> {
    // Export posts
    let postsQuery = supabase
      .from('posts')
      .select(
        'id, content, created_at, updated_at, likes_count, comments_count'
      )
      .eq('user_id', userId);

    if (dateRange) {
      postsQuery = postsQuery
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());
    }

    const { data: posts, error: postsError } = await postsQuery;

    // Export comments
    let commentsQuery = supabase
      .from('comments')
      .select('id, content, post_id, created_at, updated_at')
      .eq('user_id', userId);

    if (dateRange) {
      commentsQuery = commentsQuery
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());
    }

    const { data: comments, error: commentsError } = await commentsQuery;

    if (postsError || commentsError) {
      console.error(
        'Error exporting content data:',
        postsError || commentsError
      );
    }

    return {
      posts: posts || [],
      comments: comments || [],
    };
  }

  /**
   * Export user moderation data
   */
  private async exportModerationData(
    userId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<unknown> {
    // Export reports submitted by user
    let reportsQuery = supabase
      .from('content_reports')
      .select('id, report_type, explanation, status, created_at')
      .eq('reporter_id', userId);

    if (dateRange) {
      reportsQuery = reportsQuery
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());
    }

    const { data: reports, error: reportsError } = await reportsQuery;

    // Export moderation decisions affecting user
    let decisionsQuery = supabase
      .from('moderation_decisions')
      .select('id, action, reasoning, created_at')
      .eq('target_user_id', userId);

    if (dateRange) {
      decisionsQuery = decisionsQuery
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());
    }

    const { data: decisions, error: decisionsError } = await decisionsQuery;

    // Export appeals
    let appealsQuery = supabase
      .from('appeals')
      .select('id, appeal_type, status, submitted_at, resolved_at')
      .eq('user_id', userId);

    if (dateRange) {
      appealsQuery = appealsQuery
        .gte('submitted_at', dateRange.from.toISOString())
        .lte('submitted_at', dateRange.to.toISOString());
    }

    const { data: appeals, error: appealsError } = await appealsQuery;

    if (reportsError || decisionsError || appealsError) {
      console.error(
        'Error exporting moderation data:',
        reportsError || decisionsError || appealsError
      );
    }

    return {
      reports: reports || [],
      decisions: decisions || [],
      appeals: appeals || [],
    };
  }

  /**
   * Export user behavioral data (anonymized)
   */
  private async exportBehavioralData(
    userId: string,
    dateRange?: { from: Date; to: Date }
  ): Promise<unknown> {
    // Export anonymized activity logs
    let activityQuery = supabase
      .from('user_activity')
      .select('action_type, timestamp')
      .eq('user_id', userId);

    if (dateRange) {
      activityQuery = activityQuery
        .gte('timestamp', dateRange.from.toISOString())
        .lte('timestamp', dateRange.to.toISOString());
    }

    const { data, error } = await activityQuery;

    if (error) {
      console.error('Error exporting behavioral data:', error);
      return null;
    }

    // Anonymize by removing identifiers
    return (data || []).map((activity) => ({
      action_type: activity.action_type,
      timestamp: activity.timestamp,
    }));
  }

  /**
   * Export all user data
   */
  async exportUserData(
    exportRequest: UserDataExport
  ): Promise<UserDataPackage> {
    const { userId, format, includeCategories, dateRange } = exportRequest;

    const dataPackage: UserDataPackage = {
      userId,
      exportedAt: new Date(),
      format,
      categories: {} as Record<DataCategory, unknown>,
      metadata: {
        version: '1.0.0',
        totalRecords: 0,
        dateRange,
      },
    };

    // Export each requested category
    for (const category of includeCategories) {
      try {
        let categoryData: unknown = null;

        switch (category) {
          case 'identity':
            categoryData = await this.exportIdentityData(userId, dateRange);
            break;
          case 'content':
            categoryData = await this.exportContentData(userId, dateRange);
            break;
          case 'moderation':
            categoryData = await this.exportModerationData(userId, dateRange);
            break;
          case 'behavioral':
            categoryData = await this.exportBehavioralData(userId, dateRange);
            break;
          default:
            console.warn(`Unsupported data category: ${category}`);
        }

        if (categoryData) {
          dataPackage.categories[category] = categoryData;
          dataPackage.metadata.totalRecords++;
        }
      } catch (error) {
        console.error(`Error exporting category ${category}:`, error);
      }
    }

    return dataPackage;
  }

  /**
   * Format data package for export
   */
  async formatDataPackage(
    dataPackage: UserDataPackage,
    format: DataExportFormat
  ): Promise<string | Buffer> {
    switch (format) {
      case 'json':
        return JSON.stringify(dataPackage, null, 2);

      case 'csv':
        return this.convertToCSV(dataPackage);

      case 'xml':
        return this.convertToXML(dataPackage);

      case 'pdf':
        throw new Error('PDF export not yet implemented');

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Convert data package to CSV format
   */
  private convertToCSV(dataPackage: UserDataPackage): string {
    const lines: string[] = [];

    // Add metadata header
    lines.push('# User Data Export');
    lines.push(`# User ID: ${dataPackage.userId}`);
    lines.push(`# Exported At: ${dataPackage.exportedAt.toISOString()}`);
    lines.push('');

    // Convert each category to CSV
    for (const [category, data] of Object.entries(dataPackage.categories)) {
      lines.push(`# Category: ${category}`);

      if (Array.isArray(data)) {
        if (data.length > 0) {
          // Get headers from first object
          const headers = Object.keys(data[0]);
          lines.push(headers.join(','));

          // Add data rows
          for (const row of data) {
            const values = headers.map((header) => {
              const value = (row as Record<string, unknown>)[header];
              return typeof value === 'string' ? `"${value}"` : String(value);
            });
            lines.push(values.join(','));
          }
        }
      } else if (typeof data === 'object' && data !== null) {
        // Handle nested objects
        lines.push(JSON.stringify(data));
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Convert data package to XML format
   */
  private convertToXML(dataPackage: UserDataPackage): string {
    const lines: string[] = [];

    lines.push('<?xml version="1.0" encoding="UTF-8"?>');
    lines.push('<UserDataExport>');
    lines.push(`  <UserId>${dataPackage.userId}</UserId>`);
    lines.push(
      `  <ExportedAt>${dataPackage.exportedAt.toISOString()}</ExportedAt>`
    );
    lines.push(`  <Format>${dataPackage.format}</Format>`);
    lines.push('  <Categories>');

    for (const [category, data] of Object.entries(dataPackage.categories)) {
      lines.push(`    <Category name="${category}">`);
      lines.push(`      <![CDATA[${JSON.stringify(data, null, 2)}]]>`);
      lines.push('    </Category>');
    }

    lines.push('  </Categories>');
    lines.push('</UserDataExport>');

    return lines.join('\n');
  }

  /**
   * Complete an access request with export URL
   */
  async completeAccessRequest(
    requestId: string,
    exportUrl: string
  ): Promise<void> {
    const { error } = await supabase
      .from('data_subject_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        export_url: exportUrl,
      })
      .eq('id', requestId);

    if (error) {
      throw new Error(`Failed to complete access request: ${error.message}`);
    }
  }

  /**
   * Generate verification token
   */
  private generateVerificationToken(): string {
    return crypto.randomUUID();
  }

  /**
   * Get access request status
   */
  async getAccessRequestStatus(
    requestId: string
  ): Promise<DataSubjectRequest | null> {
    const { data, error } = await supabase
      .from('data_subject_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      requestType: data.request_type,
      status: data.status,
      requestedAt: new Date(data.requested_at),
      completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
      rejectionReason: data.rejection_reason,
      exportUrl: data.export_url,
      verificationToken: data.verification_token,
      metadata: data.metadata,
    };
  }
}

// Export singleton instance
export const userDataExportService = new UserDataExportService();
