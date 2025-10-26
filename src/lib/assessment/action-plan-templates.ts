/**
 * Action Plan Templates Module
 *
 * Provides generic, product-agnostic action plan templates for each assessment class.
 * Templates follow safety-first principles with measure-before-change preconditions.
 *
 * Requirements:
 * - 3.1: Display specific next-best-action steps with 1-tap task creation
 * - 3.2: Provide 24-48 hour immediate steps and diagnostic checks
 * - 3.3: Generic guidance, no product promotion, safety guardrails
 * - 3.5: Numbered sequential steps with measure-before-change approach
 */

import type {
  AssessmentActionPlan,
  AssessmentDiagnosticCheck,
} from '@/types/assessment';

/**
 * Standard disclaimers for all action plans
 */
export const STANDARD_DISCLAIMERS = [
  'These suggestions are for educational purposes only and do not constitute professional advice.',
  'Always research and verify recommendations before making changes to your grow environment.',
];

/**
 * Standard warnings for corrective actions
 */
export const CORRECTIVE_ACTION_WARNINGS = [
  'Make changes gradually and monitor plant response over 24-48 hours.',
  'Measure environmental parameters (pH, EC, light intensity) before making adjustments.',
  'Document changes and observations to track what works for your specific setup.',
];

/**
 * Diagnostic check templates
 */
export const DIAGNOSTIC_CHECKS: Record<string, AssessmentDiagnosticCheck> = {
  ph_check: {
    id: 'ph_check',
    name: 'Check pH levels',
    instructions:
      'Measure the pH of your growing medium or nutrient solution. Optimal range is 6.0-7.0 for soil, 5.5-6.5 for hydro.',
    estimatedTimeMinutes: 5,
  },
  ec_check: {
    id: 'ec_check',
    name: 'Check EC/TDS levels',
    instructions:
      'Measure electrical conductivity (EC) or total dissolved solids (TDS) to assess nutrient concentration.',
    estimatedTimeMinutes: 5,
  },
  light_ppfd_check: {
    id: 'light_ppfd_check',
    name: 'Measure light intensity (PPFD)',
    instructions:
      'Use a PAR meter or smartphone app to measure light intensity at canopy level. Typical ranges: seedling 200-400 PPFD, veg 400-600 PPFD, flower 600-900 PPFD.',
    estimatedTimeMinutes: 10,
  },
  moisture_check: {
    id: 'moisture_check',
    name: 'Check soil moisture',
    instructions:
      'Insert finger 2-3 inches into growing medium to check moisture level. Use a moisture meter for more accuracy.',
    estimatedTimeMinutes: 3,
  },
  temperature_check: {
    id: 'temperature_check',
    name: 'Check temperature and humidity',
    instructions:
      'Measure ambient temperature and humidity. Optimal ranges: 20-28°C (68-82°F), 40-60% RH during veg, 40-50% RH during flower.',
    estimatedTimeMinutes: 5,
  },
  visual_inspection: {
    id: 'visual_inspection',
    name: 'Visual inspection',
    instructions:
      'Inspect leaves (top and bottom), stems, and growing medium for signs of pests, mold, or other issues.',
    estimatedTimeMinutes: 10,
  },
};

/**
 * Action plan template for healthy plants
 */
export const HEALTHY_TEMPLATE: AssessmentActionPlan = {
  immediateSteps: [
    {
      title: 'Continue current care routine',
      description:
        'Your plant appears healthy. Maintain your current watering, feeding, and lighting schedule.',
      timeframe: '0-24 hours',
      priority: 'low',
    },
    {
      title: 'Document current conditions',
      description:
        'Take notes on your current setup (light distance, feeding schedule, environmental conditions) to replicate success.',
      timeframe: '0-24 hours',
      priority: 'low',
      taskTemplate: {
        name: 'Document grow conditions',
        fields: {
          type: 'note',
          description: 'Record current setup and plant health status',
        },
      },
    },
  ],
  shortTermActions: [
    {
      title: 'Monitor for changes',
      description:
        'Continue regular monitoring for any signs of stress or deficiency.',
      timeframe: '24-48 hours',
      priority: 'low',
    },
  ],
  diagnosticChecks: [],
  warnings: [],
  disclaimers: STANDARD_DISCLAIMERS,
};

/**
 * Action plan template for unknown/OOD classifications
 */
export const UNKNOWN_TEMPLATE: AssessmentActionPlan = {
  immediateSteps: [
    {
      title: 'Retake photos with better conditions',
      description:
        'Try capturing new photos with neutral lighting, clear focus, and proper framing of affected areas.',
      timeframe: '0-24 hours',
      priority: 'high',
    },
    {
      title: 'Perform diagnostic checks',
      description:
        'Measure pH, EC, and environmental conditions to gather baseline data.',
      timeframe: '0-24 hours',
      priority: 'high',
    },
  ],
  shortTermActions: [
    {
      title: 'Consult community',
      description:
        'Share photos and details with experienced growers for additional perspectives.',
      timeframe: '24-48 hours',
      priority: 'medium',
    },
  ],
  diagnosticChecks: [
    DIAGNOSTIC_CHECKS.ph_check,
    DIAGNOSTIC_CHECKS.ec_check,
    DIAGNOSTIC_CHECKS.temperature_check,
    DIAGNOSTIC_CHECKS.visual_inspection,
  ],
  warnings: [
    'Avoid making major changes until you have more information about the issue.',
  ],
  disclaimers: STANDARD_DISCLAIMERS,
};

/**
 * Action plan template for nitrogen deficiency
 */
export const NITROGEN_DEFICIENCY_TEMPLATE: AssessmentActionPlan = {
  immediateSteps: [
    {
      title: 'Check pH and EC levels',
      description:
        'Measure pH and EC to rule out nutrient lockout before adding more nutrients.',
      timeframe: '0-24 hours',
      priority: 'high',
      taskTemplate: {
        name: 'Measure pH and EC',
        fields: {
          type: 'monitor',
          description: 'Check pH and EC levels before adjusting nutrients',
        },
      },
    },
    {
      title: 'Review feeding schedule',
      description:
        'Check when you last fed and at what strength. Nitrogen deficiency often appears in late veg or early flower.',
      timeframe: '0-24 hours',
      priority: 'high',
    },
  ],
  shortTermActions: [
    {
      title: 'Adjust nitrogen levels (if pH is correct)',
      description:
        'If pH is in range, consider increasing nitrogen-rich nutrients gradually. Start with 25% increase and monitor response.',
      timeframe: '24-48 hours',
      priority: 'high',
    },
    {
      title: 'Monitor leaf color changes',
      description:
        'Check new growth and previously affected leaves daily. Improvement should be visible within 3-5 days.',
      timeframe: '24-48 hours',
      priority: 'medium',
      taskTemplate: {
        name: 'Monitor nitrogen deficiency recovery',
        fields: {
          type: 'monitor',
          description: 'Check leaf color and new growth daily',
        },
      },
    },
  ],
  diagnosticChecks: [
    DIAGNOSTIC_CHECKS.ph_check,
    DIAGNOSTIC_CHECKS.ec_check,
    DIAGNOSTIC_CHECKS.visual_inspection,
  ],
  warnings: CORRECTIVE_ACTION_WARNINGS,
  disclaimers: STANDARD_DISCLAIMERS,
};

/**
 * Action plan template for phosphorus deficiency
 */
export const PHOSPHORUS_DEFICIENCY_TEMPLATE: AssessmentActionPlan = {
  immediateSteps: [
    {
      title: 'Check pH levels',
      description:
        'Phosphorus uptake is pH-sensitive. Measure pH and adjust if outside optimal range (6.0-7.0 soil, 5.5-6.5 hydro).',
      timeframe: '0-24 hours',
      priority: 'high',
      taskTemplate: {
        name: 'Check and adjust pH',
        fields: {
          type: 'monitor',
          description: 'Measure pH and adjust if needed for phosphorus uptake',
        },
      },
    },
    {
      title: 'Check temperature',
      description:
        'Cold temperatures can inhibit phosphorus uptake. Ensure grow space is within optimal range (20-28°C).',
      timeframe: '0-24 hours',
      priority: 'high',
    },
  ],
  shortTermActions: [
    {
      title: 'Adjust phosphorus levels (if pH is correct)',
      description:
        'If pH and temperature are optimal, consider bloom nutrients with higher phosphorus content.',
      timeframe: '24-48 hours',
      priority: 'medium',
    },
    {
      title: 'Monitor new growth',
      description:
        'Watch for improvement in new growth and reduction of purple/dark discoloration.',
      timeframe: '24-48 hours',
      priority: 'medium',
    },
  ],
  diagnosticChecks: [
    DIAGNOSTIC_CHECKS.ph_check,
    DIAGNOSTIC_CHECKS.temperature_check,
    DIAGNOSTIC_CHECKS.visual_inspection,
  ],
  warnings: CORRECTIVE_ACTION_WARNINGS,
  disclaimers: STANDARD_DISCLAIMERS,
};

/**
 * Action plan template for potassium deficiency
 */
export const POTASSIUM_DEFICIENCY_TEMPLATE: AssessmentActionPlan = {
  immediateSteps: [
    {
      title: 'Check pH and EC levels',
      description:
        'Measure pH and EC to rule out nutrient lockout or salt buildup.',
      timeframe: '0-24 hours',
      priority: 'high',
      taskTemplate: {
        name: 'Measure pH and EC',
        fields: {
          type: 'monitor',
          description: 'Check for nutrient lockout or salt buildup',
        },
      },
    },
    {
      title: 'Inspect leaf edges and tips',
      description:
        'Document the extent of yellowing/browning at leaf edges for tracking recovery.',
      timeframe: '0-24 hours',
      priority: 'medium',
    },
  ],
  shortTermActions: [
    {
      title: 'Adjust potassium levels (if pH is correct)',
      description:
        'If pH is in range, consider bloom nutrients with higher potassium content.',
      timeframe: '24-48 hours',
      priority: 'high',
    },
    {
      title: 'Monitor leaf progression',
      description:
        'Check if browning stops spreading to new leaves. Recovery takes 5-7 days.',
      timeframe: '24-48 hours',
      priority: 'medium',
    },
  ],
  diagnosticChecks: [
    DIAGNOSTIC_CHECKS.ph_check,
    DIAGNOSTIC_CHECKS.ec_check,
    DIAGNOSTIC_CHECKS.visual_inspection,
  ],
  warnings: CORRECTIVE_ACTION_WARNINGS,
  disclaimers: STANDARD_DISCLAIMERS,
};

/**
 * Action plan template for magnesium deficiency
 */
export const MAGNESIUM_DEFICIENCY_TEMPLATE: AssessmentActionPlan = {
  immediateSteps: [
    {
      title: 'Check pH levels',
      description:
        'Magnesium uptake is pH-dependent. Measure and adjust pH if needed.',
      timeframe: '0-24 hours',
      priority: 'high',
      taskTemplate: {
        name: 'Check pH for magnesium uptake',
        fields: {
          type: 'monitor',
          description: 'Measure pH and adjust if outside optimal range',
        },
      },
    },
    {
      title: 'Inspect interveinal chlorosis pattern',
      description:
        'Document the yellowing between veins while veins remain green.',
      timeframe: '0-24 hours',
      priority: 'medium',
    },
  ],
  shortTermActions: [
    {
      title: 'Add magnesium supplement (if pH is correct)',
      description:
        'Consider Epsom salt (magnesium sulfate) as a supplement if pH is optimal.',
      timeframe: '24-48 hours',
      priority: 'high',
    },
    {
      title: 'Monitor leaf color recovery',
      description:
        'Check for greening of yellowed areas and healthy color in new growth.',
      timeframe: '24-48 hours',
      priority: 'medium',
    },
  ],
  diagnosticChecks: [
    DIAGNOSTIC_CHECKS.ph_check,
    DIAGNOSTIC_CHECKS.visual_inspection,
  ],
  warnings: CORRECTIVE_ACTION_WARNINGS,
  disclaimers: STANDARD_DISCLAIMERS,
};

/**
 * Action plan template for calcium deficiency
 */
export const CALCIUM_DEFICIENCY_TEMPLATE: AssessmentActionPlan = {
  immediateSteps: [
    {
      title: 'Check pH and humidity',
      description:
        'Calcium uptake requires proper pH and adequate transpiration. Measure pH and check humidity levels.',
      timeframe: '0-24 hours',
      priority: 'high',
      taskTemplate: {
        name: 'Check pH and humidity',
        fields: {
          type: 'monitor',
          description: 'Measure pH and humidity for calcium uptake',
        },
      },
    },
    {
      title: 'Inspect new growth',
      description:
        'Document brown spots and tip burn on newest leaves and growing tips.',
      timeframe: '0-24 hours',
      priority: 'high',
    },
  ],
  shortTermActions: [
    {
      title: 'Improve air circulation',
      description:
        'Ensure adequate airflow to promote transpiration and calcium transport.',
      timeframe: '24-48 hours',
      priority: 'high',
    },
    {
      title: 'Add calcium supplement (if pH is correct)',
      description:
        'Consider cal-mag supplement if pH and humidity are optimal.',
      timeframe: '24-48 hours',
      priority: 'medium',
    },
  ],
  diagnosticChecks: [
    DIAGNOSTIC_CHECKS.ph_check,
    DIAGNOSTIC_CHECKS.temperature_check,
    DIAGNOSTIC_CHECKS.visual_inspection,
  ],
  warnings: CORRECTIVE_ACTION_WARNINGS,
  disclaimers: STANDARD_DISCLAIMERS,
};

/**
 * Action plan template for overwatering
 */
export const OVERWATERING_TEMPLATE: AssessmentActionPlan = {
  immediateSteps: [
    {
      title: 'Check soil moisture',
      description:
        'Assess how wet the growing medium is. Stop watering immediately if soil is saturated.',
      timeframe: '0-24 hours',
      priority: 'high',
      taskTemplate: {
        name: 'Check soil moisture level',
        fields: {
          type: 'monitor',
          description: 'Assess moisture and stop watering if saturated',
        },
      },
    },
    {
      title: 'Improve drainage',
      description:
        'Ensure drainage holes are clear and container has proper drainage.',
      timeframe: '0-24 hours',
      priority: 'high',
    },
  ],
  shortTermActions: [
    {
      title: 'Let soil dry partially',
      description:
        'Allow top 2-3 inches of soil to dry before next watering. May take 3-5 days depending on conditions.',
      timeframe: '24-48 hours',
      priority: 'high',
    },
    {
      title: 'Adjust watering schedule',
      description:
        'Water less frequently and use the "lift test" (pot weight) to determine when to water.',
      timeframe: '24-48 hours',
      priority: 'high',
      taskTemplate: {
        name: 'Adjust watering schedule',
        fields: {
          type: 'water',
          description: 'Water only when top 2-3 inches are dry',
        },
      },
    },
  ],
  diagnosticChecks: [
    DIAGNOSTIC_CHECKS.moisture_check,
    DIAGNOSTIC_CHECKS.visual_inspection,
  ],
  warnings: [
    'Overwatering can lead to root rot. Act quickly but avoid overcompensating by underwatering.',
    'If roots smell foul or appear brown/slimy, root rot may have started. Consider transplanting to fresh medium.',
  ],
  disclaimers: STANDARD_DISCLAIMERS,
};

/**
 * Action plan template for underwatering
 */
export const UNDERWATERING_TEMPLATE: AssessmentActionPlan = {
  immediateSteps: [
    {
      title: 'Water thoroughly',
      description:
        'Water until runoff appears from drainage holes. Ensure entire root zone is moistened.',
      timeframe: '0-24 hours',
      priority: 'high',
      taskTemplate: {
        name: 'Water plant thoroughly',
        fields: {
          type: 'water',
          description: 'Water until runoff, ensure full root zone coverage',
        },
      },
    },
    {
      title: 'Check drainage and soil',
      description:
        'Ensure water is being absorbed and not running off due to hydrophobic soil.',
      timeframe: '0-24 hours',
      priority: 'high',
    },
  ],
  shortTermActions: [
    {
      title: 'Establish consistent watering schedule',
      description:
        'Water when top 1-2 inches of soil are dry. Use calendar reminders to maintain consistency.',
      timeframe: '24-48 hours',
      priority: 'high',
      taskTemplate: {
        name: 'Set up watering schedule',
        fields: {
          type: 'water',
          description: 'Water when top 1-2 inches are dry',
        },
      },
    },
    {
      title: 'Monitor recovery',
      description:
        'Leaves should perk up within 24 hours. If not, check for root damage.',
      timeframe: '24-48 hours',
      priority: 'medium',
    },
  ],
  diagnosticChecks: [
    DIAGNOSTIC_CHECKS.moisture_check,
    DIAGNOSTIC_CHECKS.visual_inspection,
  ],
  warnings: [
    'Avoid overcompensating with too much water. Resume normal schedule after initial recovery watering.',
  ],
  disclaimers: STANDARD_DISCLAIMERS,
};

/**
 * Action plan template for light burn
 */
export const LIGHT_BURN_TEMPLATE: AssessmentActionPlan = {
  immediateSteps: [
    {
      title: 'Measure light intensity',
      description:
        'Use PAR meter or app to measure PPFD at canopy level. Compare to recommended ranges for your growth stage.',
      timeframe: '0-24 hours',
      priority: 'high',
      taskTemplate: {
        name: 'Measure light intensity (PPFD)',
        fields: {
          type: 'monitor',
          description: 'Measure PPFD at canopy level',
        },
      },
    },
    {
      title: 'Increase light distance',
      description:
        'Raise lights 6-12 inches higher or reduce intensity if using dimmable lights.',
      timeframe: '0-24 hours',
      priority: 'high',
      taskTemplate: {
        name: 'Adjust light height',
        fields: {
          type: 'custom',
          description: 'Raise lights 6-12 inches or reduce intensity',
        },
      },
    },
  ],
  shortTermActions: [
    {
      title: 'Monitor canopy temperature',
      description:
        'Check temperature at canopy level. Should not exceed 28°C (82°F).',
      timeframe: '24-48 hours',
      priority: 'high',
    },
    {
      title: 'Watch for recovery',
      description:
        "Bleached leaves won't recover, but new growth should be healthy green.",
      timeframe: '24-48 hours',
      priority: 'medium',
    },
  ],
  diagnosticChecks: [
    DIAGNOSTIC_CHECKS.light_ppfd_check,
    DIAGNOSTIC_CHECKS.temperature_check,
    DIAGNOSTIC_CHECKS.visual_inspection,
  ],
  warnings: [
    'Light burn damage is permanent on affected leaves. Focus on protecting new growth.',
  ],
  disclaimers: STANDARD_DISCLAIMERS,
};

/**
 * Action plan template for spider mites
 */
export const SPIDER_MITES_TEMPLATE: AssessmentActionPlan = {
  immediateSteps: [
    {
      title: 'Isolate affected plant',
      description:
        'Move plant away from others to prevent spread. Spider mites spread quickly.',
      timeframe: '0-24 hours',
      priority: 'high',
      taskTemplate: {
        name: 'Isolate plant from others',
        fields: {
          type: 'custom',
          description: 'Quarantine to prevent mite spread',
        },
      },
    },
    {
      title: 'Inspect all plants',
      description:
        'Check undersides of leaves on all nearby plants for mites or webbing.',
      timeframe: '0-24 hours',
      priority: 'high',
    },
  ],
  shortTermActions: [
    {
      title: 'Begin treatment protocol',
      description:
        'Research and apply appropriate pest management methods. Multiple treatments will be needed.',
      timeframe: '24-48 hours',
      priority: 'high',
    },
    {
      title: 'Improve environmental conditions',
      description:
        'Increase humidity (50-60%) and improve air circulation. Mites thrive in hot, dry conditions.',
      timeframe: '24-48 hours',
      priority: 'high',
    },
  ],
  diagnosticChecks: [
    DIAGNOSTIC_CHECKS.visual_inspection,
    DIAGNOSTIC_CHECKS.temperature_check,
  ],
  warnings: [
    'Spider mites reproduce rapidly. Act quickly and be persistent with treatment.',
    'Inspect plants daily during treatment. Multiple applications over 2-3 weeks are typically needed.',
  ],
  disclaimers: STANDARD_DISCLAIMERS,
};

/**
 * Action plan template for powdery mildew
 */
export const POWDERY_MILDEW_TEMPLATE: AssessmentActionPlan = {
  immediateSteps: [
    {
      title: 'Isolate affected plant',
      description:
        'Move plant away from others. Powdery mildew spreads via airborne spores.',
      timeframe: '0-24 hours',
      priority: 'high',
      taskTemplate: {
        name: 'Isolate affected plant',
        fields: {
          type: 'custom',
          description: 'Quarantine to prevent spore spread',
        },
      },
    },
    {
      title: 'Improve air circulation',
      description:
        'Increase airflow with fans. Remove any leaves touching each other or surfaces.',
      timeframe: '0-24 hours',
      priority: 'high',
    },
  ],
  shortTermActions: [
    {
      title: 'Reduce humidity',
      description:
        'Lower humidity to 40-50% or below. Powdery mildew thrives in high humidity with poor airflow.',
      timeframe: '24-48 hours',
      priority: 'high',
    },
    {
      title: 'Begin treatment protocol',
      description:
        'Research and apply appropriate fungal management methods. Consistent treatment is key.',
      timeframe: '24-48 hours',
      priority: 'high',
    },
  ],
  diagnosticChecks: [
    DIAGNOSTIC_CHECKS.visual_inspection,
    DIAGNOSTIC_CHECKS.temperature_check,
  ],
  warnings: [
    'Powdery mildew can spread rapidly. Remove heavily infected leaves and dispose of them outside grow area.',
    'Monitor all plants daily. Spores can remain dormant and reappear if conditions favor them.',
  ],
  disclaimers: STANDARD_DISCLAIMERS,
};

/**
 * Get action plan template by class ID
 *
 * @param classId - Assessment class identifier
 * @returns Action plan template for the class
 */
export function getActionPlanTemplate(classId: string): AssessmentActionPlan {
  const templates: Record<string, AssessmentActionPlan> = {
    healthy: HEALTHY_TEMPLATE,
    unknown: UNKNOWN_TEMPLATE,
    nitrogen_deficiency: NITROGEN_DEFICIENCY_TEMPLATE,
    phosphorus_deficiency: PHOSPHORUS_DEFICIENCY_TEMPLATE,
    potassium_deficiency: POTASSIUM_DEFICIENCY_TEMPLATE,
    magnesium_deficiency: MAGNESIUM_DEFICIENCY_TEMPLATE,
    calcium_deficiency: CALCIUM_DEFICIENCY_TEMPLATE,
    overwatering: OVERWATERING_TEMPLATE,
    underwatering: UNDERWATERING_TEMPLATE,
    light_burn: LIGHT_BURN_TEMPLATE,
    spider_mites: SPIDER_MITES_TEMPLATE,
    powdery_mildew: POWDERY_MILDEW_TEMPLATE,
  };

  return templates[classId] ?? UNKNOWN_TEMPLATE;
}

/**
 * Check if a class has a specific template (not using unknown fallback)
 *
 * @param classId - Assessment class identifier
 * @returns True if class has a dedicated template
 */
export function hasActionPlanTemplate(classId: string): boolean {
  const templateIds = [
    'healthy',
    'nitrogen_deficiency',
    'phosphorus_deficiency',
    'potassium_deficiency',
    'magnesium_deficiency',
    'calcium_deficiency',
    'overwatering',
    'underwatering',
    'light_burn',
    'spider_mites',
    'powdery_mildew',
  ];

  return templateIds.includes(classId);
}
