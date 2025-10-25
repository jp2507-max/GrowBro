import {
  getAllAssessmentClasses,
  getAssessmentClass,
  getClassCategory,
  getClassDisplayName,
  getClassesByCategory,
  getNutrientDeficiencyClasses,
  getPestAndPathogenClasses,
  getStressConditionClasses,
  getUnknownClass,
  isOodClass,
  isValidClassId,
} from '../assessment-classes';

describe('assessment-classes', () => {
  describe('getAssessmentClass', () => {
    test('returns class record for valid ID', () => {
      const healthyClass = getAssessmentClass('healthy');

      expect(healthyClass.id).toBe('healthy');
      expect(healthyClass.name).toBe('Healthy');
      expect(healthyClass.category).toBe('healthy');
      expect(healthyClass.isOod).toBe(false);
      expect(healthyClass.description).toBeTruthy();
      expect(Array.isArray(healthyClass.visualCues)).toBe(true);
    });

    test('returns nitrogen deficiency class', () => {
      const nitrogenClass = getAssessmentClass('nitrogen_deficiency');

      expect(nitrogenClass.id).toBe('nitrogen_deficiency');
      expect(nitrogenClass.name).toBe('Nitrogen deficiency');
      expect(nitrogenClass.category).toBe('nutrient');
      expect(nitrogenClass.isOod).toBe(false);
    });

    test('throws error for invalid class ID', () => {
      expect(() => getAssessmentClass('invalid_class')).toThrow(
        'Assessment class not found: invalid_class'
      );
    });

    test('includes action template structure', () => {
      const classRecord = getAssessmentClass('healthy');

      expect(classRecord.actionTemplate).toBeDefined();
      expect(Array.isArray(classRecord.actionTemplate.immediateSteps)).toBe(
        true
      );
      expect(Array.isArray(classRecord.actionTemplate.shortTermActions)).toBe(
        true
      );
      expect(Array.isArray(classRecord.actionTemplate.diagnosticChecks)).toBe(
        true
      );
      expect(Array.isArray(classRecord.actionTemplate.warnings)).toBe(true);
      expect(Array.isArray(classRecord.actionTemplate.disclaimers)).toBe(true);
    });
  });

  describe('getUnknownClass', () => {
    test('returns Unknown/OOD class', () => {
      const unknownClass = getUnknownClass();

      expect(unknownClass.id).toBe('unknown');
      expect(unknownClass.name).toBe('Unknown / Out-of-Distribution');
      expect(unknownClass.category).toBe('unknown');
      expect(unknownClass.isOod).toBe(true);
    });
  });

  describe('getAllAssessmentClasses', () => {
    test('returns all 12 canonical classes', () => {
      const allClasses = getAllAssessmentClasses();

      expect(allClasses).toHaveLength(12);
      expect(allClasses.map((c) => c.id)).toContain('healthy');
      expect(allClasses.map((c) => c.id)).toContain('unknown');
      expect(allClasses.map((c) => c.id)).toContain('nitrogen_deficiency');
      expect(allClasses.map((c) => c.id)).toContain('spider_mites');
      expect(allClasses.map((c) => c.id)).toContain('powdery_mildew');
    });

    test('each class has required fields', () => {
      const allClasses = getAllAssessmentClasses();

      allClasses.forEach((classRecord) => {
        expect(classRecord.id).toBeTruthy();
        expect(classRecord.name).toBeTruthy();
        expect(classRecord.category).toBeTruthy();
        expect(typeof classRecord.isOod).toBe('boolean');
        expect(classRecord.actionTemplate).toBeDefined();
      });
    });
  });

  describe('getClassesByCategory', () => {
    test('returns nutrient deficiency classes', () => {
      const nutrientClasses = getClassesByCategory('nutrient');

      expect(nutrientClasses.length).toBeGreaterThan(0);
      expect(nutrientClasses.every((c) => c.category === 'nutrient')).toBe(
        true
      );
      expect(nutrientClasses.map((c) => c.id)).toContain('nitrogen_deficiency');
      expect(nutrientClasses.map((c) => c.id)).toContain(
        'phosphorus_deficiency'
      );
    });

    test('returns stress condition classes', () => {
      const stressClasses = getClassesByCategory('stress');

      expect(stressClasses.length).toBeGreaterThan(0);
      expect(stressClasses.every((c) => c.category === 'stress')).toBe(true);
      expect(stressClasses.map((c) => c.id)).toContain('overwatering');
      expect(stressClasses.map((c) => c.id)).toContain('underwatering');
    });

    test('returns pest classes', () => {
      const pestClasses = getClassesByCategory('pest');

      expect(pestClasses.length).toBeGreaterThan(0);
      expect(pestClasses.every((c) => c.category === 'pest')).toBe(true);
      expect(pestClasses.map((c) => c.id)).toContain('spider_mites');
    });

    test('returns pathogen classes', () => {
      const pathogenClasses = getClassesByCategory('pathogen');

      expect(pathogenClasses.length).toBeGreaterThan(0);
      expect(pathogenClasses.every((c) => c.category === 'pathogen')).toBe(
        true
      );
      expect(pathogenClasses.map((c) => c.id)).toContain('powdery_mildew');
    });

    test('returns empty array for non-existent category', () => {
      const classes = getClassesByCategory('non_existent');
      expect(classes).toEqual([]);
    });
  });

  describe('isValidClassId', () => {
    test('returns true for valid class IDs', () => {
      expect(isValidClassId('healthy')).toBe(true);
      expect(isValidClassId('unknown')).toBe(true);
      expect(isValidClassId('nitrogen_deficiency')).toBe(true);
      expect(isValidClassId('spider_mites')).toBe(true);
    });

    test('returns false for invalid class IDs', () => {
      expect(isValidClassId('invalid_class')).toBe(false);
      expect(isValidClassId('')).toBe(false);
      expect(isValidClassId('Healthy')).toBe(false); // Case-sensitive
    });
  });

  describe('isOodClass', () => {
    test('returns true for Unknown class', () => {
      expect(isOodClass('unknown')).toBe(true);
    });

    test('returns false for non-OOD classes', () => {
      expect(isOodClass('healthy')).toBe(false);
      expect(isOodClass('nitrogen_deficiency')).toBe(false);
      expect(isOodClass('spider_mites')).toBe(false);
    });

    test('returns false for invalid class ID', () => {
      expect(isOodClass('invalid_class')).toBe(false);
    });
  });

  describe('getClassDisplayName', () => {
    test('returns display name for valid class', () => {
      expect(getClassDisplayName('healthy')).toBe('Healthy');
      expect(getClassDisplayName('nitrogen_deficiency')).toBe(
        'Nitrogen deficiency'
      );
      expect(getClassDisplayName('spider_mites')).toBe('Spider mites (pest)');
    });

    test('returns Unknown for invalid class', () => {
      expect(getClassDisplayName('invalid_class')).toBe('Unknown');
    });
  });

  describe('getClassCategory', () => {
    test('returns category for valid class', () => {
      expect(getClassCategory('healthy')).toBe('healthy');
      expect(getClassCategory('nitrogen_deficiency')).toBe('nutrient');
      expect(getClassCategory('overwatering')).toBe('stress');
      expect(getClassCategory('spider_mites')).toBe('pest');
      expect(getClassCategory('powdery_mildew')).toBe('pathogen');
    });

    test('returns unknown for invalid class', () => {
      expect(getClassCategory('invalid_class')).toBe('unknown');
    });
  });

  describe('getNutrientDeficiencyClasses', () => {
    test('returns all nutrient deficiency classes', () => {
      const nutrientClasses = getNutrientDeficiencyClasses();

      expect(nutrientClasses.length).toBe(5);
      expect(nutrientClasses.every((c) => c.category === 'nutrient')).toBe(
        true
      );
      expect(nutrientClasses.map((c) => c.id)).toContain('nitrogen_deficiency');
      expect(nutrientClasses.map((c) => c.id)).toContain(
        'phosphorus_deficiency'
      );
      expect(nutrientClasses.map((c) => c.id)).toContain(
        'potassium_deficiency'
      );
      expect(nutrientClasses.map((c) => c.id)).toContain(
        'magnesium_deficiency'
      );
      expect(nutrientClasses.map((c) => c.id)).toContain('calcium_deficiency');
    });
  });

  describe('getStressConditionClasses', () => {
    test('returns all stress condition classes', () => {
      const stressClasses = getStressConditionClasses();

      expect(stressClasses.length).toBe(3);
      expect(stressClasses.every((c) => c.category === 'stress')).toBe(true);
      expect(stressClasses.map((c) => c.id)).toContain('overwatering');
      expect(stressClasses.map((c) => c.id)).toContain('underwatering');
      expect(stressClasses.map((c) => c.id)).toContain('light_burn');
    });
  });

  describe('getPestAndPathogenClasses', () => {
    test('returns all pest and pathogen classes', () => {
      const pestPathogenClasses = getPestAndPathogenClasses();

      expect(pestPathogenClasses.length).toBe(2);
      expect(pestPathogenClasses.map((c) => c.id)).toContain('spider_mites');
      expect(pestPathogenClasses.map((c) => c.id)).toContain('powdery_mildew');
    });

    test('includes both pest and pathogen categories', () => {
      const pestPathogenClasses = getPestAndPathogenClasses();
      const categories = pestPathogenClasses.map((c) => c.category);

      expect(categories).toContain('pest');
      expect(categories).toContain('pathogen');
    });
  });

  describe('visual cues', () => {
    test('healthy class has visual cues', () => {
      const healthyClass = getAssessmentClass('healthy');
      expect(healthyClass.visualCues.length).toBeGreaterThan(0);
      expect(healthyClass.visualCues).toContain('Vibrant green color');
    });

    test('nutrient deficiency classes have visual cues', () => {
      const nitrogenClass = getAssessmentClass('nitrogen_deficiency');
      expect(nitrogenClass.visualCues.length).toBeGreaterThan(0);
      expect(
        nitrogenClass.visualCues.some((cue) => cue.includes('Yellow'))
      ).toBe(true);
    });

    test('pest classes have visual cues', () => {
      const spiderMitesClass = getAssessmentClass('spider_mites');
      expect(spiderMitesClass.visualCues.length).toBeGreaterThan(0);
      expect(spiderMitesClass.visualCues).toContain('Webbing');
    });
  });

  describe('descriptions', () => {
    test('all classes have descriptions', () => {
      const allClasses = getAllAssessmentClasses();

      allClasses.forEach((classRecord) => {
        if (classRecord.id !== 'unknown') {
          expect(classRecord.description).toBeTruthy();
          expect(classRecord.description.length).toBeGreaterThan(10);
        }
      });
    });

    test('descriptions are informative', () => {
      const nitrogenClass = getAssessmentClass('nitrogen_deficiency');
      expect(nitrogenClass.description.toLowerCase()).toContain('nitrogen');
      expect(nitrogenClass.description.toLowerCase()).toContain('yellow');

      const spiderMitesClass = getAssessmentClass('spider_mites');
      expect(spiderMitesClass.description.toLowerCase()).toContain('spider');
      expect(spiderMitesClass.description.toLowerCase()).toContain('mite');
    });
  });
});
