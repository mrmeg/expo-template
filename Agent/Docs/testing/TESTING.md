# Testing Guidelines

A comprehensive guide to testing React Native / Expo applications. This document covers unit, integration, and E2E testing patterns that can be applied across projects.

## Table of Contents

1. [Test Stack Overview](#test-stack-overview)
2. [Project Structure](#project-structure)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [E2E Testing with Playwright](#e2e-testing-with-playwright)
6. [Mocking Strategies](#mocking-strategies)
7. [Test Fixtures & Factories](#test-fixtures--factories)
8. [Best Practices](#best-practices)
9. [CI/CD Integration](#cicd-integration)

---

## Test Stack Overview

### Core Dependencies

```json
{
  "devDependencies": {
    "jest": "*",
    "jest-expo": "*",
    "@testing-library/react-native": "*",
    "@types/jest": "*",
    "@playwright/test": "*"
  }
}
```

### Test Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "jest --watchAll",
    "test:ci": "jest --ci --coverage --maxWorkers=2",
    "test:coverage": "jest --coverage",
    "test:unit": "jest --testPathPattern='__tests__/.*\\.test\\.(ts|tsx)$'",
    "test:integration": "jest --testPathPattern='app/api/__tests__'",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed"
  }
}
```

---

## Project Structure

```
/test
  /mocks                        # Reusable mock implementations
    /db.ts                      # Mock database layer
    /cognito.ts                 # Mock authentication
    /[service].ts               # Mock external services
  /fixtures                     # Test data factories
    /employees.ts               # Employee data factory
    /store-settings.ts          # Configuration data
    /[domain]-items.ts          # Domain-specific data
  /utils
    /render.tsx                 # Custom render with providers
    /api-helpers.ts             # API route testing utilities
  /setup.ts                     # Jest setup file

/client
  /components/ui/__tests__      # UI component tests
  /stores/__tests__             # Zustand store tests
  /hooks/__tests__              # Custom hook tests

/server
  /auth/__tests__               # Authentication logic tests
  /services/[name]/__tests__    # Service layer tests

/app/api/__tests__              # API route integration tests

/e2e
  /tests/*.spec.ts              # Playwright test files
  /pages/*.page.ts              # Page Object Models
  playwright.config.ts          # Playwright configuration
```

---

## Unit Testing

### Zustand Store Testing

Test stores by directly manipulating state and verifying behavior:

```typescript
import { useMyStore } from '../myStore';

describe('useMyStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useMyStore.setState({ items: [], isLoading: false });
  });

  it('adds item to store', () => {
    useMyStore.getState().addItem({ id: '1', name: 'Test' });

    expect(useMyStore.getState().items).toHaveLength(1);
  });

  it('handles async operations', async () => {
    // Mock API before calling action
    mockApiPost.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });

    await useMyStore.getState().fetchData();

    expect(useMyStore.getState().data).toBe('test');
    expect(useMyStore.getState().isLoading).toBe(false);
  });
});
```

### Component Testing with @testing-library/react-native

```typescript
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button text="Click me" />);
    expect(screen.getByText('Click me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<Button text="Press" onPress={onPress} />);

    fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled when loading', () => {
    const onPress = jest.fn();
    render(<Button text="Loading" loading onPress={onPress} />);

    fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });
});
```

### Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react-native';
import { useCounter } from '../useCounter';

describe('useCounter', () => {
  it('increments count', () => {
    const { result } = renderHook(() => useCounter());

    act(() => {
      result.current.increment();
    });

    expect(result.current.count).toBe(1);
  });
});
```

---

## Integration Testing

### API Route Testing

Create helpers for testing API routes:

```typescript
// test/utils/api-helpers.ts

export function createRequest(url: string, options = {}) {
  const { method = 'GET', body, authenticated = true } = options;

  if (authenticated) {
    setMockAuthenticatedUser(testUsers.admin);
  }

  return new Request(`http://localhost:8081${url}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authenticated ? { Authorization: 'Bearer mock-token' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function createPostRequest(url: string, body: unknown, options = {}) {
  return createRequest(url, { ...options, method: 'POST', body });
}
```

Testing API routes:

```typescript
import { GET, POST } from '../index+api';
import { createGetRequest, createPostRequest } from '@/test/utils/api-helpers';

describe('GET /api/employees', () => {
  beforeEach(() => {
    resetMocks();
    seedMockDatabase({ employees: testEmployees });
  });

  it('returns employees when authenticated', async () => {
    const request = createGetRequest('/api/employees');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.employees).toHaveLength(5);
  });

  it('returns 401 when unauthenticated', async () => {
    const request = createGetRequest('/api/employees', { authenticated: false });

    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
```

---

## E2E Testing with Playwright

### Configuration

```typescript
// e2e/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8081',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run start:web',
    url: 'http://localhost:8081',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Page Object Models

```typescript
// e2e/pages/auth.page.ts
import { Page, expect } from '@playwright/test';

export class AuthPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-button"]');
  }

  async expectLoggedIn() {
    await expect(this.page).toHaveURL('/');
  }
}
```

### E2E Test Example

```typescript
// e2e/tests/auth.spec.ts
import { test, expect } from '@playwright/test';
import { AuthPage } from '../pages/auth.page';

test.describe('Authentication', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('user can log in', async () => {
    await authPage.login('test@example.com', 'password123');
    await authPage.expectLoggedIn();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await authPage.login('wrong@example.com', 'wrong');
    await expect(page.getByText('Invalid credentials')).toBeVisible();
  });
});
```

---

## Mocking Strategies

### Database Mocking

```typescript
// test/mocks/db.ts

interface MockDatabaseState {
  users: User[];
  employees: Employee[];
}

let mockState: MockDatabaseState = {
  users: [],
  employees: [],
};

export function resetMockDatabase() {
  mockState = { users: [], employees: [] };
}

export function seedMockDatabase(data: Partial<MockDatabaseState>) {
  if (data.users) mockState.users = [...data.users];
  if (data.employees) mockState.employees = [...data.employees];
}

export const mockDb = {
  select: () => ({ from: (table) => createMockQueryBuilder(table) }),
  insert: (table) => ({ values: (data) => ({ returning: () => Promise.resolve([data]) }) }),
  // ... other methods
};
```

### External Service Mocking

```typescript
// test/mocks/fastbound.ts

let methodCalls: MethodCall[] = [];
let shouldThrowError: string | null = null;

export function resetFastBoundMock() {
  methodCalls = [];
  shouldThrowError = null;
}

export function setFastBoundError(error: string | null) {
  shouldThrowError = error;
}

export function getFastBoundMethodCalls() {
  return methodCalls;
}

export class MockFastBoundClient {
  async getItems() {
    methodCalls.push({ method: 'getItems', args: [], timestamp: new Date() });
    if (shouldThrowError) throw new Error(shouldThrowError);
    return { items: [], records: 0 };
  }
}
```

### Authentication Mocking

```typescript
// test/mocks/cognito.ts

let mockUser: CognitoUser | null = null;

export function setMockAuthenticatedUser(user: CognitoUser | null) {
  mockUser = user;
}

export async function mockAuthenticateRequest(): Promise<CognitoUser | null> {
  return mockUser;
}

export const testUsers = {
  admin: { sub: 'admin-123', email: 'admin@test.com', username: 'admin' },
  cashier: { sub: 'cashier-456', email: 'cashier@test.com', username: 'cashier' },
};
```

---

## Test Fixtures & Factories

### Factory Pattern

```typescript
// test/fixtures/employees.ts

export function createEmployee(overrides: Partial<Employee> = {}): Employee {
  const id = overrides.id || crypto.randomUUID();
  return {
    id,
    email: overrides.email || `employee-${id}@test.com`,
    firstName: overrides.firstName || 'Test',
    lastName: overrides.lastName || 'Employee',
    role: overrides.role || 'cashier',
    isActive: overrides.isActive ?? true,
    ...overrides,
  };
}

export const testEmployees = {
  admin: createEmployee({ role: 'admin', email: 'admin@test.com' }),
  cashier: createEmployee({ role: 'cashier', email: 'cashier@test.com' }),
  inactive: createEmployee({ isActive: false }),
};

export function createEmployeeBatch(count: number): Employee[] {
  return Array.from({ length: count }, (_, i) =>
    createEmployee({ email: `batch-${i}@test.com` })
  );
}
```

---

## Best Practices

### 1. Test Naming Convention

```typescript
describe('ComponentName', () => {
  describe('MethodName or behavior', () => {
    it('should do specific thing when condition', () => {});
    it('returns expected value for edge case', () => {});
    it('throws error when invalid input', () => {});
  });
});
```

### 2. AAA Pattern (Arrange, Act, Assert)

```typescript
it('creates a new employee', async () => {
  // Arrange
  const employeeData = { firstName: 'John', lastName: 'Doe', email: 'john@test.com' };
  mockApiPost.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(employeeData) });

  // Act
  const result = await store.getState().createEmployee(employeeData);

  // Assert
  expect(result.firstName).toBe('John');
  expect(mockApiPost).toHaveBeenCalledWith('/api/employees', employeeData);
});
```

### 3. Isolation

- Reset all mocks in `beforeEach`
- Each test should be independent
- Don't rely on test execution order

### 4. Test Real Behavior

```typescript
// ❌ Bad: Testing implementation details
it('calls setState with correct value', () => {
  const setStateSpy = jest.spyOn(store, 'setState');
  store.getState().addItem(item);
  expect(setStateSpy).toHaveBeenCalledWith({ items: [item] });
});

// ✅ Good: Testing observable behavior
it('adds item to store', () => {
  store.getState().addItem(item);
  expect(store.getState().items).toContain(item);
});
```

### 5. Error Handling

```typescript
it('handles API errors gracefully', async () => {
  mockApiGet.mockRejectedValueOnce(new Error('Network error'));

  await store.getState().loadData();

  expect(store.getState().error).toBe('Network error');
  expect(store.getState().isLoading).toBe(false);
});
```

### 6. Async Testing

```typescript
// Use async/await
it('loads data asynchronously', async () => {
  mockApiGet.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });

  await store.getState().loadData();

  expect(store.getState().data).toEqual(data);
});

// Or use waitFor for timing-dependent tests
it('shows success message', async () => {
  render(<MyComponent />);
  fireEvent.press(screen.getByText('Submit'));

  await waitFor(() => {
    expect(screen.getByText('Success')).toBeTruthy();
  });
});
```

### 7. What NOT to Test

- Third-party library internals
- Implementation details (private methods, internal state)
- Simple getters/setters with no logic
- Framework code (React's useState, etc.)

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run tsc

      - name: Lint
        run: npm run lint

      - name: Unit & Integration Tests
        run: npm run test:ci

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: false

  e2e:
    runs-on: ubuntu-latest
    needs: test

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npm run test:e2e

      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

---

## Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  collectCoverageFrom: [
    'client/**/*.{ts,tsx}',
    'server/**/*.ts',
    'app/**/*.{ts,tsx}',
    '!**/__tests__/**',
    '!**/node_modules/**',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
};
```

---

## Summary

| Test Type | Tool | Purpose |
|-----------|------|---------|
| Unit | Jest + RTL | Individual components, stores, utilities |
| Integration | Jest | API routes, service interactions |
| E2E | Playwright | Full user flows in browser |

**Coverage Goals:**
- Start without thresholds to build a baseline
- Aim for 70-80% coverage on critical business logic
- Focus on behavior, not line coverage

**Testing Priority:**
1. Business-critical flows (auth, transactions)
2. Error handling paths
3. Edge cases in utilities
4. UI component behavior
