import type { TemplateDefinition } from '@/types/templates';

// Function type definitions for testing
export type RegisterTemplateFn = (def: TemplateDefinition) => void;
export type GetTemplateFn = (
  templateId: string
) => TemplateDefinition | undefined;
export type ListTemplatesFn = () => TemplateDefinition[];

// Minimal in-memory registry for v1; could be backed by Supabase later
const templates = new Map<string, TemplateDefinition>();

export function registerTemplate(def: TemplateDefinition): void {
  if (templates.has(def.id)) {
    throw new Error(
      `Template with ID '${def.id}' already exists. Cannot register duplicate template.`
    );
  }
  templates.set(def.id, def);
}

export function getTemplate(
  templateId: string
): TemplateDefinition | undefined {
  return templates.get(templateId);
}

export function listTemplates(): TemplateDefinition[] {
  return Array.from(templates.values());
}

// Example seed (can be replaced by actual playbooks)
registerTemplate({
  id: 'basic-watering-v1',
  name: 'Basic Watering (2 weeks)',
  description: 'Every 3 days starting day 0 at 09:00',
  steps: Array.from({ length: 5 }, (_, i) => ({
    id: `w${i}`,
    title: 'Water plants',
    description: 'Check soil moisture and water as needed',
    offsetDays: i * 3,
    timeOfDay: '09:00',
    reminderMinutesBefore: 0,
  })),
});
