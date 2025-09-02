import {
  getTemplate,
  listTemplates,
  registerTemplate,
} from '@/lib/template-registry';
import type { TemplateDefinition } from '@/types/templates';

describe('TemplateRegistry', () => {
  const testTemplate: TemplateDefinition = {
    id: 'test-template',
    name: 'Test Template',
    description: 'A template for testing',
    steps: [
      {
        id: 'step1',
        title: 'Test Step',
        description: 'A test step',
        offsetDays: 0,
        timeOfDay: '09:00',
        reminderMinutesBefore: 0,
      },
    ],
  };

  beforeEach(() => {
    // Clear any existing templates for clean test state
    // Note: This is a simple approach; in a real app you might want to expose a clear method
  });

  test('registerTemplate adds a new template successfully', () => {
    const uniqueTemplate = { ...testTemplate, id: 'unique-template' };
    expect(() => registerTemplate(uniqueTemplate)).not.toThrow();
    expect(getTemplate(uniqueTemplate.id)).toEqual(uniqueTemplate);
  });

  test('registerTemplate throws error when registering duplicate template ID', () => {
    const duplicateTemplate = { ...testTemplate, id: 'duplicate-template' };

    // First registration should succeed
    expect(() => registerTemplate(duplicateTemplate)).not.toThrow();

    // Second registration with same ID should throw
    expect(() => registerTemplate(duplicateTemplate)).toThrow(
      "Template with ID 'duplicate-template' already exists. Cannot register duplicate template."
    );
  });

  test('getTemplate returns undefined for non-existent template', () => {
    expect(getTemplate('non-existent')).toBeUndefined();
  });

  test('listTemplates returns all registered templates', () => {
    const template1 = { ...testTemplate, id: 'list-test-1' };
    const template2 = { ...testTemplate, id: 'list-test-2' };

    registerTemplate(template1);
    registerTemplate(template2);

    const templates = listTemplates();
    expect(templates).toContain(template1);
    expect(templates).toContain(template2);
    expect(templates.length).toBeGreaterThanOrEqual(2);
  });
});
