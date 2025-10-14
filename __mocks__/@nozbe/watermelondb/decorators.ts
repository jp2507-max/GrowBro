// Lightweight jest mock for @nozbe/watermelondb/decorators
// Provides no-op decorator factories so model class definitions don't crash in tests.

type PropertyDecoratorFn = (target: any, key: string) => void;

function noopDecorator(): PropertyDecoratorFn {
  return function () {
    // no-op
  };
}

// Explicit function exports to avoid interop issues
export function text(_columnName?: string): PropertyDecoratorFn {
  return noopDecorator();
}

export function field(_columnName?: string): PropertyDecoratorFn {
  return noopDecorator();
}

export function date(_columnName?: string): PropertyDecoratorFn {
  return noopDecorator();
}

export function json(
  _columnName?: string,
  _sanitizer?: any
): PropertyDecoratorFn {
  return noopDecorator();
}

// readonly is used as a plain decorator without arguments
export function readonly(_target: any, _key: string): void {
  // no-op
}

// Not currently used widely, but stub for completeness
export function children(_relationName?: string): PropertyDecoratorFn {
  return noopDecorator();
}

export function relation(
  _table?: string,
  _columnName?: string
): PropertyDecoratorFn {
  return noopDecorator();
}

export default { text, field, date, json, readonly, children, relation };

// Ensure CommonJS interop for Jest/ts-jest transpilation
const __decoratorsCJS__: Record<string, unknown> = {
  text,
  field,
  date,
  json,
  readonly,
  children,
  relation,
};
// @ts-ignore
if (typeof module !== 'undefined' && (module as any).exports) {
  // @ts-ignore
  (module as any).exports = {
    __esModule: true,
    ...__decoratorsCJS__,
    default: __decoratorsCJS__,
  };
}
