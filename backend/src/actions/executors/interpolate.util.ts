import { ExecutionContext } from './action-executor.interface';

/**
 * Resolves a dot-separated path against an ExecutionContext object.
 * Returns an empty string if the path does not exist.
 */
export function resolveContextPath(
  path: string,
  context: ExecutionContext,
): unknown {
  const keys = path.trim().split('.');
  let value: unknown = context;
  for (const key of keys) {
    if (value && typeof value === 'object') {
      value = (value as Record<string, unknown>)[key];
    } else {
      return '';
    }
  }
  return value;
}

/**
 * Replaces all {{path.to.value}} placeholders in a template string
 * with values resolved from the execution context.
 */
export function interpolate(
  template: string,
  context: ExecutionContext,
): string {
  if (!template) return template ?? '';
  return template.replace(/\{\{(.+?)\}\}/g, (_match, path: string) => {
    const value = resolveContextPath(path, context);
    return typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
  });
}
