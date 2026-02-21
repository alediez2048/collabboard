import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_CATALOG,
  buildTemplateSeedSteps,
  type TemplateId,
} from '@/lib/templates/template-seeds';

function countTools(templateId: TemplateId): Record<string, number> {
  return buildTemplateSeedSteps(templateId).reduce<Record<string, number>>((acc, step) => {
    acc[step.tool] = (acc[step.tool] ?? 0) + 1;
    return acc;
  }, {});
}

describe('template seed builders', () => {
  it('exports exactly the four quick-start templates for dashboard creation', () => {
    const ids = TEMPLATE_CATALOG.map((template) => template.id);
    expect(ids).toEqual(['kanban', 'swot', 'brainstorm', 'retrospective']);
  });

  it('builds deterministic output for every template id', () => {
    TEMPLATE_CATALOG.forEach((template) => {
      const first = buildTemplateSeedSteps(template.id);
      const second = buildTemplateSeedSteps(template.id);

      expect(first).toEqual(second);
      expect(first.length).toBeGreaterThan(0);
      expect(
        first.every(
          (step) =>
            (step.tool === 'createFrame' || step.tool === 'createStickyNote')
            && typeof step.args.x === 'number'
            && typeof step.args.y === 'number',
        ),
      ).toBe(true);
    });
  });

  it('creates expected structure for SWOT and Retrospective templates', () => {
    const swotCounts = countTools('swot');
    const retrospectiveCounts = countTools('retrospective');

    expect(swotCounts.createFrame).toBe(4);
    expect(swotCounts.createStickyNote).toBe(4);
    expect(retrospectiveCounts.createFrame).toBe(3);
    expect(retrospectiveCounts.createStickyNote).toBe(3);
  });

  it('includes starter sticky notes in Kanban and Brainstorm templates', () => {
    const kanbanCounts = countTools('kanban');
    const brainstormCounts = countTools('brainstorm');

    expect(kanbanCounts.createFrame).toBe(3);
    expect(kanbanCounts.createStickyNote).toBeGreaterThanOrEqual(3);
    expect(brainstormCounts.createStickyNote).toBeGreaterThanOrEqual(8);
  });
});
