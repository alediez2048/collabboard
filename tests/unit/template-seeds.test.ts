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
  it('exports all quick-start templates for dashboard creation', () => {
    const ids = TEMPLATE_CATALOG.map((template) => template.id);
    expect(ids).toEqual(['kanban', 'swot', 'lean_canvas', 'retrospective', 'roadmap', 'eisenhower']);
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
    expect(swotCounts.createStickyNote).toBe(12);
    expect(retrospectiveCounts.createFrame).toBe(3);
    expect(retrospectiveCounts.createStickyNote).toBe(9);
  });

  it('includes starter sticky notes in Kanban template and seeded sections in Lean Canvas', () => {
    const kanbanCounts = countTools('kanban');
    const leanCanvasCounts = countTools('lean_canvas');
    const leanCanvasSteps = buildTemplateSeedSteps('lean_canvas');
    const leanCanvasFrames = leanCanvasSteps.filter((step) => step.tool === 'createFrame');
    const leanCanvasStickies = leanCanvasSteps.filter((step) => step.tool === 'createStickyNote');
    const leanCanvasFrameTitles = leanCanvasFrames.map((step) => String(step.args.title ?? ''));

    expect(kanbanCounts.createFrame).toBe(3);
    expect(kanbanCounts.createStickyNote).toBeGreaterThanOrEqual(3);
    expect(leanCanvasCounts.createFrame).toBe(11);
    expect(leanCanvasCounts.createStickyNote).toBe(11);
    expect(leanCanvasFrameTitles).toEqual(
      expect.arrayContaining([
        'Problem',
        'Existing Alternatives',
        'Solution',
        'Key Metrics',
        'Unique Value Proposition',
        'Unfair Advantage',
        'Channels',
        'Customer Segments',
        'Early Adopters',
        'Cost Structure',
        'Revenue Streams',
      ]),
    );
    expect(
      leanCanvasFrames.every((frame) =>
        leanCanvasStickies.some((sticky) =>
          Number(sticky.args.x) >= Number(frame.args.x)
          && Number(sticky.args.x) < Number(frame.args.x) + Number(frame.args.width)
          && Number(sticky.args.y) >= Number(frame.args.y)
          && Number(sticky.args.y) < Number(frame.args.y) + Number(frame.args.height),
        ),
      ),
    ).toBe(true);
  });
});
