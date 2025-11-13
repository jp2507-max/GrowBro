/**
 * Template Adoption Service
 *
 * Handles adopting community templates and applying them to user's plants
 * with customization options.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { PlaybookStep } from '@/types/playbook';

import type { TemplateComment } from '../../api/templates/types';

export interface AdoptTemplateOptions {
  templateId: string;
  plantId: string;
  customizations?: {
    name?: string;
    adjustStartDate?: boolean;
    skipSteps?: string[];
    modifySteps?: {
      stepId: string;
      changes: Partial<{
        title: string;
        description: string;
        relativeDay: number;
        rrule: string;
      }>;
    }[];
  };
}

export interface AdoptedPlaybook {
  id: string;
  plantId: string;
  templateId: string;
  name: string;
  setup: string;
  locale: string;
  steps: PlaybookStep[];
  phaseOrder: string[];
  customized: boolean;
  adoptedAt: string;
}

export class TemplateAdoptionService {
  constructor(private supabase: SupabaseClient) {}

  private async getTemplate(templateId: string) {
    const { data: template, error: templateError } = await this.supabase
      .from('community_playbook_templates')
      .select('*')
      .eq('id', templateId)
      .is('deleted_at', null)
      .single();

    if (templateError || !template) {
      throw new Error('Template not found or has been deleted');
    }
    return template;
  }

  private async verifyPlantOwnership(plantId: string, userId: string) {
    const { data: plant, error: plantError } = await this.supabase
      .from('plants')
      .select('id, user_id')
      .eq('id', plantId)
      .eq('user_id', userId)
      .single();

    if (plantError || !plant) {
      throw new Error('Plant not found or does not belong to user');
    }
    return plant;
  }

  private applyCustomizations(
    steps: PlaybookStep[],
    customizations?: AdoptTemplateOptions['customizations']
  ) {
    let modifiedSteps = [...steps];
    let customized = false;

    if (!customizations) {
      return { steps: modifiedSteps, customized };
    }

    if (customizations.name) {
      customized = true;
    }

    if (customizations.skipSteps && customizations.skipSteps.length > 0) {
      modifiedSteps = modifiedSteps.filter(
        (step) => !customizations.skipSteps!.includes(step.id)
      );
      customized = true;
    }

    if (customizations.modifySteps && customizations.modifySteps.length > 0) {
      modifiedSteps = modifiedSteps.map((step) => {
        const modification = customizations.modifySteps!.find(
          (m) => m.stepId === step.id
        );
        if (modification) {
          customized = true;
          return { ...step, ...modification.changes };
        }
        return step;
      });
    }

    return { steps: modifiedSteps, customized };
  }

  /**
   * Adopts a community template and applies it to a plant
   *
   * @param options - Adoption options including template ID and customizations
   * @returns The adopted playbook
   */
  async adoptTemplate(options: AdoptTemplateOptions): Promise<AdoptedPlaybook> {
    const { templateId, plantId, customizations } = options;

    const template = await this.getTemplate(templateId);

    const {
      data: { user },
      error: userError,
    } = await this.supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User must be authenticated to adopt templates');
    }

    await this.verifyPlantOwnership(plantId, user.id);

    const { steps, customized } = this.applyCustomizations(
      template.steps,
      customizations
    );

    const adoptedPlaybook: AdoptedPlaybook = {
      id: crypto.randomUUID(),
      plantId,
      templateId,
      name: customizations?.name || template.name,
      setup: template.setup,
      locale: template.locale,
      steps,
      phaseOrder: template.phase_order,
      customized,
      adoptedAt: new Date().toISOString(),
    };

    await this.supabase.rpc('increment_template_adoption', {
      template_id: templateId,
    });

    return adoptedPlaybook;
  }

  /**
   * Gets adoption statistics for a template
   */
  async getAdoptionStats(templateId: string): Promise<{
    adoptionCount: number;
    ratingAverage?: number;
    ratingCount: number;
  }> {
    const { data, error } = await this.supabase
      .from('community_playbook_templates')
      .select('adoption_count, rating_average, rating_count')
      .eq('id', templateId)
      .single();

    if (error || !data) {
      return {
        adoptionCount: 0,
        ratingCount: 0,
      };
    }

    return {
      adoptionCount: data.adoption_count,
      ratingAverage: data.rating_average,
      ratingCount: data.rating_count,
    };
  }

  /**
   * Rates a template
   */
  async rateTemplate(
    templateId: string,
    rating: number,
    review?: string
  ): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const {
      data: { user },
      error: userError,
    } = await this.supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User must be authenticated to rate templates');
    }

    const { error } = await this.supabase.from('template_ratings').upsert({
      template_id: templateId,
      user_id: user.id,
      rating,
      review: review || null,
    });

    if (error) {
      throw new Error(`Failed to rate template: ${error.message}`);
    }
  }

  /**
   * Comments on a template
   */
  async commentOnTemplate(
    templateId: string,
    comment: string,
    userHandle: string
  ): Promise<void> {
    if (!comment || comment.trim().length === 0) {
      throw new Error('Comment cannot be empty');
    }

    const {
      data: { user },
      error: userError,
    } = await this.supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('User must be authenticated to comment');
    }

    const { error } = await this.supabase.from('template_comments').insert({
      template_id: templateId,
      user_id: user.id,
      user_handle: userHandle,
      comment: comment.trim(),
    });

    if (error) {
      throw new Error(`Failed to comment: ${error.message}`);
    }
  }

  /**
   * Gets comments for a template
   */
  async getTemplateComments(
    templateId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<TemplateComment[]> {
    const { limit = 20, offset = 0 } = options || {};

    const { data, error } = await this.supabase
      .from('template_comments')
      .select('*')
      .eq('template_id', templateId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to get comments: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      templateId: row.template_id,
      authorId: row.user_id,
      content: row.comment,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      userHandle: row.user_handle,
    }));
  }
}
