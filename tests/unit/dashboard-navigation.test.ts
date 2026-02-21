import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_SECTIONS,
  getDashboardSectionMeta,
  parseDashboardSearchQuery,
  parseDashboardSection,
  type DashboardSection,
} from '@/lib/dashboard/navigation';

describe('dashboard navigation helpers', () => {
  it('accepts known section values from URL params', () => {
    expect(parseDashboardSection('home')).toBe('home');
    expect(parseDashboardSection('recent')).toBe('recent');
    expect(parseDashboardSection('starred')).toBe('starred');
  });

  it('falls back to home for unknown, missing, or empty values', () => {
    expect(parseDashboardSection('')).toBe('home');
    expect(parseDashboardSection('invalid')).toBe('home');
    expect(parseDashboardSection(undefined)).toBe('home');
  });

  it('uses the first string when query param is an array', () => {
    expect(parseDashboardSection(['recent', 'home'])).toBe('recent');
    expect(parseDashboardSection(['invalid', 'home'])).toBe('home');
  });

  it('normalizes dashboard search query values', () => {
    expect(parseDashboardSearchQuery(undefined)).toBe('');
    expect(parseDashboardSearchQuery('')).toBe('');
    expect(parseDashboardSearchQuery('   ')).toBe('');
    expect(parseDashboardSearchQuery('  Product  ')).toBe('Product');
    expect(parseDashboardSearchQuery([' Roadmap ', 'Ignored'])).toBe('Roadmap');
  });

  it('exports all expected sections and metadata', () => {
    const expectedSections: DashboardSection[] = ['home', 'recent', 'starred'];
    expect(DASHBOARD_SECTIONS).toEqual(expectedSections);

    expectedSections.forEach((section) => {
      const meta = getDashboardSectionMeta(section);
      expect(meta.title.length).toBeGreaterThan(0);
      expect(meta.emptyStateTitle.length).toBeGreaterThan(0);
      expect(meta.emptyStateDescription.length).toBeGreaterThan(0);
    });
  });
});
