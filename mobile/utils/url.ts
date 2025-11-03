import { API_BASE } from '../constants/API';

export const DEFAULT_AVATAR = require('../assets/default-avatar.png');

const API_ORIGIN = API_BASE.replace(/\/?api\/?$/, '');

const isAbsoluteUrl = (value: string) => /^https?:\/\//i.test(value);

const coerceToString = (value: unknown): string | null => {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
};

export const resolveRemoteUrl = (value?: string | null | unknown): string | null => {
  if (!value) {
    return null;
  }

  const coerced = coerceToString(value);
  if (!coerced) {
    return null;
  }

  const trimmed = coerced.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  if (isAbsoluteUrl(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return `${API_ORIGIN}${trimmed}`;
  }

  return `${API_ORIGIN}/${trimmed}`;
};

export const resolveMediaUrls = (values?: unknown): string[] => {
  if (typeof values === 'string') {
    const single = resolveRemoteUrl(values);
    return single ? [single] : [];
  }

  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((item) => resolveRemoteUrl(item))
    .filter((item): item is string => Boolean(item));
};
