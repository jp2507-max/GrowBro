import {
  ConfidenceSource,
  DiagnosticConfidenceFlag,
  IssueSeverity,
  IssueType,
  type Recommendation,
} from '@/lib/nutrient-engine/types';

import {
  type AiDiagnosticHypothesis,
  evaluateAndPersistDiagnostic,
} from './diagnostic-service';

const mockEvaluateDiagnosticRules = jest.fn();

const mockWrite = jest.fn();
const mockGet = jest.fn();

jest.mock('@/lib/watermelon', () => ({
  database: {
    write: (...args: unknown[]) => mockWrite(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: (column: string, comparison: unknown) => ({ column, comparison }),
    gte: (value: number) => ({ operator: 'gte', value }),
    sortBy: (column: string, direction: { direction: string }) => ({
      column,
      direction,
    }),
    desc: { direction: 'desc' },
  },
}));

jest.mock('@/lib/watermelon-models/diagnostic-result', () => ({
  DiagnosticResultModel: { table: 'diagnostic_results_v2' },
}));

jest.mock('@/lib/watermelon-models/ph-ec-reading', () => ({
  PhEcReadingModel: { table: 'ph_ec_readings_v2' },
}));

const { DiagnosticResultModel } = jest.requireMock(
  '@/lib/watermelon-models/diagnostic-result'
) as {
  DiagnosticResultModel: { table: string };
};

const { PhEcReadingModel } = jest.requireMock(
  '@/lib/watermelon-models/ph-ec-reading'
) as {
  PhEcReadingModel: { table: string };
};

jest.mock('@/lib/nutrient-engine/utils/diagnostic-rules', () => ({
  evaluateDiagnosticRules: (...args: unknown[]) =>
    mockEvaluateDiagnosticRules(
      ...(args as Parameters<typeof mockEvaluateDiagnosticRules>)
    ),
  RULE_CONFIDENCE_THRESHOLD: 0.7,
}));

describe('evaluateAndPersistDiagnostic', () => {
  const fixedNow = 1_700_000_000_000;
  const savedRecords: any[] = [];
  let mockPhReadings: any[] = [];

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
    savedRecords.length = 0;
    mockPhReadings = [];

    mockWrite.mockImplementation(
      async (action: () => Promise<unknown> | unknown) => action()
    );

    mockGet.mockImplementation((table: string) => {
      if (table === DiagnosticResultModel.table) {
        return {
          create: (creator: (record: any) => void) => {
            const baseRecord: any = {
              id: `diag-${savedRecords.length + 1}`,
              createdAt: new Date(fixedNow),
              updatedAt: new Date(fixedNow),
            };
            creator(baseRecord);
            savedRecords.push({ ...baseRecord });
            return baseRecord;
          },
        };
      }

      if (table === PhEcReadingModel.table) {
        return {
          query: () => ({
            fetch: jest.fn().mockResolvedValue(mockPhReadings),
          }),
        };
      }

      throw new Error(`Unexpected table lookup: ${table}`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockEvaluateDiagnosticRules.mockReset();
    mockWrite.mockReset();
    mockGet.mockReset();
  });

  const baseRuleRecommendations: Recommendation[] = [
    {
      action: 'nutrient.diagnostics.actions._n__d_e_f_i_c_i_e_n_c_y__f_e_e_d',
      description: 'nutrient.diagnostics.recommendations.nitrogen_feed',
      priority: 1,
      code: 'N_DEFICIENCY_FEED',
    },
  ];

  function buildAiHypothesis(
    overrides: Partial<AiDiagnosticHypothesis> = {}
  ): AiDiagnosticHypothesis {
    return {
      classification: {
        type: IssueType.TOXICITY,
        severity: IssueSeverity.SEVERE,
        nutrient: 'P',
        likelyCauses: ['ai.cause'],
      },
      confidence: 0.86,
      recommendations: [
        {
          action: 'nutrient.diagnostics.actions._t_o_x_i_c_i_t_y__d_i_l_u_t_e',
          description: 'nutrient.diagnostics.recommendations.dilute_reservoir',
          priority: 1,
          code: 'TOXICITY_DILUTE',
        },
      ],
      rationale: ['ai.rationale'],
      inputReadingIds: ['ai-reading'],
      ...overrides,
    };
  }

  test('prefers AI hypothesis above override threshold while retaining rule metadata', async () => {
    mockEvaluateDiagnosticRules.mockReturnValue({
      issue: {
        type: IssueType.DEFICIENCY,
        severity: IssueSeverity.MODERATE,
        nutrient: 'N',
        likelyCauses: ['rule.cause'],
      },
      nutrientCode: 'N',
      confidence: 0.74,
      recommendations: baseRuleRecommendations,
      rationale: ['rule.rationale'],
      disclaimerKeys: [],
      confidenceFlags: [],
      needsSecondOpinion: false,
      supportingReadingIds: ['rule-reading'],
    });

    const result = await evaluateAndPersistDiagnostic({
      plantId: 'plant-1',
      symptoms: [],
      aiHypothesis: buildAiHypothesis({ confidence: 0.91 }),
    });

    expect(result).not.toBeNull();
    expect(result?.aiOverride).toBe(true);
    expect(result?.rulesBased).toBe(true);
    expect(result?.confidenceSource).toBe(ConfidenceSource.AI);
    expect(result?.confidence).toBe(0.91);
    expect(result?.classification.type).toBe(IssueType.TOXICITY);
    expect(result?.confidenceFlags).not.toContain(
      DiagnosticConfidenceFlag.AI_ONLY_GUIDANCE
    );
    expect(result?.recommendations).toHaveLength(2);
    const codes = result?.recommendations.map((rec) => rec.code);
    expect(codes).toEqual(
      expect.arrayContaining(['TOXICITY_DILUTE', 'N_DEFICIENCY_FEED'])
    );
  });

  test('falls back to hybrid output when AI is below threshold', async () => {
    mockEvaluateDiagnosticRules.mockReturnValue({
      issue: {
        type: IssueType.DEFICIENCY,
        severity: IssueSeverity.MODERATE,
        nutrient: 'N',
        likelyCauses: ['rule.cause'],
      },
      nutrientCode: 'N',
      confidence: 0.74,
      recommendations: baseRuleRecommendations,
      rationale: ['rule.rationale'],
      disclaimerKeys: [],
      confidenceFlags: [],
      needsSecondOpinion: false,
      supportingReadingIds: ['rule-reading'],
    });

    const result = await evaluateAndPersistDiagnostic({
      plantId: 'plant-2',
      symptoms: [],
      aiHypothesis: buildAiHypothesis({
        confidence: 0.61,
        rationale: ['ai.lowConfidence'],
      }),
    });

    expect(result).not.toBeNull();
    expect(result?.aiOverride).toBe(false);
    expect(result?.confidenceSource).toBe(ConfidenceSource.HYBRID);
    expect(result?.confidenceFlags).toContain(
      DiagnosticConfidenceFlag.AI_LOW_CONFIDENCE
    );
    expect(result?.rationale).toEqual(
      expect.arrayContaining([
        'rule.rationale',
        'ai.lowConfidence',
        'nutrient.diagnostics.rationale.ai_below_threshold',
      ])
    );
    expect(result?.disclaimerKeys).toContain(
      'nutrient.diagnostics.disclaimers.low_confidence'
    );
  });

  test('adds fidelity warning when only AI guidance is available', async () => {
    mockEvaluateDiagnosticRules.mockReturnValue(null);

    const result = await evaluateAndPersistDiagnostic({
      plantId: 'plant-3',
      symptoms: [],
      aiHypothesis: buildAiHypothesis({ confidence: 0.83 }),
    });

    expect(result).not.toBeNull();
    expect(result?.rulesBased).toBe(false);
    expect(result?.confidenceSource).toBe(ConfidenceSource.AI);
    expect(result?.confidenceFlags).toContain(
      DiagnosticConfidenceFlag.AI_ONLY_GUIDANCE
    );
    expect(result?.disclaimerKeys).toContain(
      'nutrient.diagnostics.disclaimers.ai_only_primary'
    );
  });

  test('sets needsSecondOpinion flag when confidence below threshold', async () => {
    mockEvaluateDiagnosticRules.mockReturnValue({
      issue: {
        type: IssueType.DEFICIENCY,
        severity: IssueSeverity.MODERATE,
        nutrient: 'N',
        likelyCauses: ['rule.cause'],
      },
      nutrientCode: 'N',
      confidence: 0.65,
      recommendations: baseRuleRecommendations,
      rationale: ['rule.rationale'],
      disclaimerKeys: [],
      confidenceFlags: [],
      needsSecondOpinion: false,
      supportingReadingIds: ['rule-reading'],
    });

    const result = await evaluateAndPersistDiagnostic({
      plantId: 'plant-4',
      symptoms: [],
    });

    expect(result).not.toBeNull();
    expect(result?.confidence).toBe(0.65);
    expect(result?.needsSecondOpinion).toBe(true);
    expect(result?.disclaimerKeys).toContain(
      'nutrient.diagnostics.disclaimers.consider_second_opinion'
    );
  });

  test('handles very low confidence scenario', async () => {
    mockEvaluateDiagnosticRules.mockReturnValue({
      issue: {
        type: IssueType.DEFICIENCY,
        severity: IssueSeverity.MILD,
        nutrient: 'K',
        likelyCauses: ['rule.weak'],
      },
      nutrientCode: 'K',
      confidence: 0.42,
      recommendations: baseRuleRecommendations,
      rationale: ['rule.uncertain'],
      disclaimerKeys: [],
      confidenceFlags: [],
      needsSecondOpinion: false,
      supportingReadingIds: [],
    });

    const result = await evaluateAndPersistDiagnostic({
      plantId: 'plant-5',
      symptoms: [],
    });

    expect(result).not.toBeNull();
    expect(result?.confidence).toBe(0.42);
    expect(result?.needsSecondOpinion).toBe(true);
    expect(result?.disclaimerKeys).toContain(
      'nutrient.diagnostics.disclaimers.low_confidence'
    );
    expect(result?.disclaimerKeys).toContain(
      'nutrient.diagnostics.disclaimers.consider_second_opinion'
    );
  });
});
