# Настройка тестовой среды - Promptana

## ✅ Установленные компоненты

### Unit Testing (Jest)
- ✅ Jest ^29.7.0
- ✅ React Testing Library ^15.0.7
- ✅ @testing-library/jest-dom
- ✅ @testing-library/user-event
- ✅ jest-environment-jsdom
- ✅ @types/jest
- ✅ ts-node

### E2E Testing (Playwright)
- ✅ @playwright/test ^1.40.1
- ✅ Chromium browser (Desktop Chrome)

## 📁 Структура проекта

```
promptana/
├── jest.config.js              # Конфигурация Jest
├── jest.setup.js               # Настройка окружения для тестов
├── playwright.config.ts        # Конфигурация Playwright
├── README.testing.md           # Подробное руководство по тестированию
├── TESTING_SETUP.md           # Этот файл
├── src/
│   └── components/
│       └── ui/
│           └── __tests__/      # Юнит-тесты компонентов
│               └── button.test.tsx
└── e2e/                        # E2E тесты
    ├── example.spec.ts         # Пример базового E2E теста
    ├── example-with-fixtures.spec.ts  # Пример с фикстурами
    ├── fixtures/
    │   └── test-fixtures.ts    # Кастомные фикстуры для тестов
    └── page-objects/           # Page Object Model
        ├── BasePage.ts         # Базовый класс для страниц
        └── HomePage.ts         # Page Object для главной страницы
```

## 🚀 Доступные команды

### Unit тесты (Jest)
```bash
npm test                # Запустить все юнит-тесты
npm run test:watch      # Запустить тесты в режиме наблюдения
npm run test:coverage   # Запустить тесты с отчетом о покрытии
```

### E2E тесты (Playwright)
```bash
npm run test:e2e        # Запустить все E2E тесты
npm run test:e2e:ui     # Запустить тесты в UI режиме (рекомендуется для разработки)
npm run test:e2e:debug  # Запустить тесты в режиме отладки
npm run test:e2e:report # Показать отчет о тестах
npm run test:e2e:codegen # Генератор тестов (записывает действия)
```

## ⚙️ Конфигурация

### Jest (jest.config.js)
- **Test Environment**: jsdom (для тестирования React компонентов)
- **Setup Files**: jest.setup.js (моки Next.js, настройка таймеров)
- **Module Mapper**: `@/*` → `src/*`
- **Coverage**: Собирается из `src/` (исключая `*.d.ts`, stories, tests)
- **Ignore Patterns**: `node_modules`, `.next`, `e2e`

### Playwright (playwright.config.ts)
- **Test Directory**: `./e2e`
- **Browser**: Только Chromium (Desktop Chrome)
- **Base URL**: `http://localhost:3000`
- **Parallel Execution**: Включено
- **Retries**: 2 на CI, 0 локально
- **Web Server**: Автоматически запускает `npm run dev` перед тестами
- **Trace**: Записывается при первом повторе теста
- **Screenshots**: Только при ошибках
- **Video**: Сохраняется при ошибках

## 📝 Примеры использования

### Юнит-тест компонента
```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('should handle click', async () => {
    const handleClick = jest.fn();
    const user = userEvent.setup({ delay: null });
    
    render(<MyComponent onClick={handleClick} />);
    await user.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### E2E тест с Page Object Model
```typescript
import { test, expect } from './fixtures/test-fixtures';

test('should navigate', async ({ homePage }) => {
  await homePage.navigate();
  expect(await homePage.isOnHomePage()).toBeTruthy();
});
```

## ⚠️ Важные замечания

### React 19 Compatibility
Проект использует React 19, но Testing Library официально поддерживает только React 18. Используется флаг `--legacy-peer-deps` для установки пакетов. Это не влияет на функциональность тестов.

### Playwright Browser
Согласно правилам проекта, используется только Chromium (Desktop Chrome). Если нужно тестировать в других браузерах, обновите `playwright.config.ts`.

### Jest Setup
В `jest.setup.js` настроены:
- Fake timers (для тестирования асинхронного кода)
- Моки Next.js роутера
- Автоматическая очистка моков после каждого теста

## 🔧 Устранение неполадок

### Jest
- **Проблемы с импортами**: Проверьте `moduleNameMapper` в `jest.config.js`
- **Ошибки типов**: Убедитесь, что `@types/jest` установлен
- **Async warnings**: Используйте `await` с асинхронными операциями

### Playwright
- **Browser not found**: Запустите `npx playwright install chromium`
- **Port conflicts**: Измените `baseURL` в `playwright.config.ts`
- **Timeout errors**: Увеличьте timeout в конфиге или используйте `test.setTimeout()`

## 📚 Ресурсы

- [Jest Documentation](https://jestjs.io/)
- [Testing Library Best Practices](https://testing-library.com/docs/queries/about)
- [Playwright Documentation](https://playwright.dev/)
- [Подробное руководство](./README.testing.md)

## ✨ Best Practices

### Jest
- ✅ Используйте `describe` для группировки тестов
- ✅ Используйте `beforeEach`/`afterEach` для setup/cleanup
- ✅ Используйте специфичные матчеры
- ✅ Мокайте внешние зависимости
- ✅ Тестируйте взаимодействия пользователя через `userEvent`
- ❌ Избегайте snapshot-тестов для динамического контента

### Playwright
- ✅ Используйте Page Object Model
- ✅ Используйте browser contexts для изоляции
- ✅ Используйте локаторы (`getByRole`, `getByTestId`)
- ✅ Используйте фикстуры для переиспользования кода
- ✅ Параллельное выполнение для скорости
- ✅ Visual regression тесты с `toHaveScreenshot()`
- ✅ API тесты для бэкенда

## 🎯 Следующие шаги

1. Запустите пример юнит-теста: `npm test`
2. Запустите пример E2E теста: `npm run test:e2e:ui`
3. Изучите примеры в `src/components/ui/__tests__/` и `e2e/`
4. Начните писать тесты для вашего кода!

---

Тестовая среда готова к использованию! 🎉

