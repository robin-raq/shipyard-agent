import { describe, it, expect } from 'vitest';
import { snakeToCamel, camelToSnake, keysToCamel, keysToSnake } from '../caseTransform';

describe('caseTransform', () => {
  describe('snakeToCamel', () => {
    it('converts snake_case to camelCase', () => {
      expect(snakeToCamel('created_at')).toBe('createdAt');
      expect(snakeToCamel('user_id')).toBe('userId');
      expect(snakeToCamel('program_id')).toBe('programId');
    });

    it('handles strings without underscores', () => {
      expect(snakeToCamel('name')).toBe('name');
      expect(snakeToCamel('id')).toBe('id');
    });

    it('handles multiple underscores', () => {
      expect(snakeToCamel('this_is_a_test')).toBe('thisIsATest');
    });
  });

  describe('camelToSnake', () => {
    it('converts camelCase to snake_case', () => {
      expect(camelToSnake('createdAt')).toBe('created_at');
      expect(camelToSnake('userId')).toBe('user_id');
      expect(camelToSnake('programId')).toBe('program_id');
    });

    it('handles strings without capitals', () => {
      expect(camelToSnake('name')).toBe('name');
      expect(camelToSnake('id')).toBe('id');
    });

    it('handles multiple capitals', () => {
      expect(camelToSnake('thisIsATest')).toBe('this_is_a_test');
    });
  });

  describe('keysToCamel', () => {
    it('converts object keys from snake_case to camelCase', () => {
      const input = {
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
        user_id: 123,
      };
      const expected = {
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
        userId: 123,
      };
      expect(keysToCamel(input)).toEqual(expected);
    });

    it('handles nested objects', () => {
      const input = {
        user_id: 1,
        user_data: {
          first_name: 'John',
          last_name: 'Doe',
        },
      };
      const expected = {
        userId: 1,
        userData: {
          firstName: 'John',
          lastName: 'Doe',
        },
      };
      expect(keysToCamel(input)).toEqual(expected);
    });

    it('handles arrays', () => {
      const input = [
        { created_at: '2024-01-01', user_id: 1 },
        { created_at: '2024-01-02', user_id: 2 },
      ];
      const expected = [
        { createdAt: '2024-01-01', userId: 1 },
        { createdAt: '2024-01-02', userId: 2 },
      ];
      expect(keysToCamel(input)).toEqual(expected);
    });

    it('handles null and undefined', () => {
      expect(keysToCamel(null)).toBe(null);
      expect(keysToCamel(undefined)).toBe(undefined);
    });

    it('handles primitive values', () => {
      expect(keysToCamel('string')).toBe('string');
      expect(keysToCamel(123)).toBe(123);
      expect(keysToCamel(true)).toBe(true);
    });
  });

  describe('keysToSnake', () => {
    it('converts object keys from camelCase to snake_case', () => {
      const input = {
        createdAt: '2024-01-01',
        updatedAt: '2024-01-02',
        userId: 123,
      };
      const expected = {
        created_at: '2024-01-01',
        updated_at: '2024-01-02',
        user_id: 123,
      };
      expect(keysToSnake(input)).toEqual(expected);
    });

    it('handles nested objects', () => {
      const input = {
        userId: 1,
        userData: {
          firstName: 'John',
          lastName: 'Doe',
        },
      };
      const expected = {
        user_id: 1,
        user_data: {
          first_name: 'John',
          last_name: 'Doe',
        },
      };
      expect(keysToSnake(input)).toEqual(expected);
    });

    it('handles arrays', () => {
      const input = [
        { createdAt: '2024-01-01', userId: 1 },
        { createdAt: '2024-01-02', userId: 2 },
      ];
      const expected = [
        { created_at: '2024-01-01', user_id: 1 },
        { created_at: '2024-01-02', user_id: 2 },
      ];
      expect(keysToSnake(input)).toEqual(expected);
    });
  });
});
