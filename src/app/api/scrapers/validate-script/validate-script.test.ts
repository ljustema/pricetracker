import { test, expect, request } from '@playwright/test';
import type { ValidationLog } from '@/lib/services/scraper-types';

const apiUrl = 'http://localhost:3000/api/scrapers/validate-script'; // Adjust port if needed

test.describe('Python Script Validation API', () => {
  test('should validate a correct Python script successfully', async ({}) => {
    const context = await request.newContext();
    const response = await context.post(apiUrl, {
      data: {
        scraper_type: 'python',
        scriptContent: `
def hello():
    print("Hello, world!")

hello()
        `.trim()
      }
    });
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.valid).toBe(true);
    expect(result.error).toBeFalsy();
    if (result.logs) {
      const hasErrors = result.logs.some((log: ValidationLog) => log.lvl === 'ERROR');
      expect(hasErrors).toBeFalsy();
    }
  });

  test('should detect syntax errors in Python script', async ({}) => {
    const context = await request.newContext();
    const response = await context.post(apiUrl, {
      data: {
        scraper_type: 'python',
        scriptContent: `
def broken_func(
    print("Missing closing parenthesis and colon")
        `.trim()
      }
    });
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
    expect(typeof result.error).toBe('string');
    expect(result.error.toLowerCase()).toContain('syntax');
    if (result.logs) {
      const hasErrorLog = result.logs.some((log: ValidationLog) => log.lvl === 'ERROR');
      expect(hasErrorLog).toBeTruthy();
    }
  });

  test('should capture lint warnings in Python script', async ({}) => {
    const context = await request.newContext();
    const response = await context.post(apiUrl, {
      data: {
        scraper_type: 'python',
        scriptContent: `
def foo():
  print(  "bad indentation and double spaces" )
        `.trim()
      }
    });
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    // Lint warnings should not fail validation
    expect(result.valid).toBe(true);
    if (result.logs) {
      const hasWarnOrError = result.logs.some((log: ValidationLog) =>
        log.lvl === 'WARN' || log.lvl === 'ERROR'
      );
      expect(hasWarnOrError).toBeTruthy();
    }
  });
});