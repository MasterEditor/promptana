# Plan Testów - Promptana

## 1. Wprowadzenie i Cele Testowania

### 1.1 Cel Dokumentu
Niniejszy plan testów określa strategię, zakres, metody i harmonogram testowania aplikacji Promptana - systemu do zarządzania, wykonywania i ulepszania promptów AI.

### 1.2 Cele Testowania
- **Weryfikacja funkcjonalności**: Potwierdzenie, że wszystkie wymagania funkcjonalne (FR-001 do FR-013) zostały poprawnie zaimplementowane
- **Zapewnienie jakości**: Zapewnienie wysokiej jakości kodu poprzez testy jednostkowe i end-to-end
- **Wykrycie defektów**: Identyfikacja i dokumentacja błędów przed wdrożeniem produkcyjnym
- **Weryfikacja user experience**: Potwierdzenie, że wszystkie user stories działają poprawnie end-to-end

### 1.3 Zakres Projektu
Promptana to aplikacja webowa MVP typu single-user do zarządzania promptami AI z następującymi kluczowymi funkcjonalnościami:
- Zarządzanie promptami (CRUD)
- System tagów i katalogów
- Wyszukiwanie pełnotekstowe
- Wykonywanie promptów przez OpenRouter
- Workflow ulepszania promptów (AI-driven)
- Wersjonowanie z politykami retencji
- Instrumentacja i KPI

## 2. Zakres Testów

### 2.1 Obszary Objęte Testami

#### 2.1.1 Backend API (Next.js API Routes)
- **Autentykacja** (`/api/auth/*`)
  - Rejestracja użytkownika
  - Logowanie (Google OAuth + email)
  - Wylogowanie
  - Odświeżanie sesji
  
- **Zarządzanie promptami** (`/api/prompts/*`)
  - CRUD promptów
  - Zarządzanie wersjami
  - Przywracanie wersji
  - Wykonywanie promptów
  - Workflow "Improve"
  
- **Organizacja** (`/api/catalogs/*`, `/api/tags/*`)
  - CRUD katalogów
  - CRUD tagów
  - Przypisywanie tagów do promptów
  
- **Wyszukiwanie** (`/api/search/*`)
  - Wyszukiwanie pełnotekstowe
  - Filtrowanie po tagach i katalogach
  
- **Uruchomienia** (`/api/runs/*`)
  - Historia wykonań
  - Metadane wykonań

#### 2.1.2 Warstwa Serwisowa (`src/server/`)
- `prompts-service.ts` - Logika biznesowa promptów
- `prompt-versions-service.ts` - Wersjonowanie
- `catalogs-service.ts` - Zarządzanie katalogami
- `tags-service.ts` - Zarządzanie tagami
- `runs-service.ts` - Obsługa wykonań
- `search-service.ts` - Wyszukiwanie
- `openrouter-service.ts` - Integracja z OpenRouter
- `supabase-auth.ts` - Autentykacja
- `validation.ts` - Walidacja danych
- `http-errors.ts` - Obsługa błędów

#### 2.1.3 Frontend (React Components)
- Komponenty UI (`src/components/ui/`)
- Widoki aplikacji (`src/app/(workspace)/`)
- Formularze i walidacja po stronie klienta
- Konteksty React (auth, offline, global-messages)
- Custom hooki

#### 2.1.4 Baza Danych
- Migracje schematu
- Triggery i funkcje PL/pgSQL
- Row Level Security (RLS)
- Indeksy i optymalizacja
- Wyszukiwanie pełnotekstowe (tsvector)

#### 2.1.5 Integracje Zewnętrzne
- Supabase Authentication
- OpenRouter API
- PostgreSQL (full-text search)

### 2.2 Obszary Wyłączone z Testów
- Dedykowane testy integracyjne (logika integracyjna weryfikowana w testach E2E)
- Dedykowane testy wydajnościowe (monitoring w produkcji)
- Dedykowane testy bezpieczeństwa (best practices w kodzie, weryfikacja w E2E)
- Dedykowane testy accessibility (WCAG compliance weryfikowana manualnie)
- Testy wieloużytkownikowe (MVP jest single-user)
- Testy zaawansowanych dashboardów analitycznych (nie w MVP)
- Testy migracji z innych systemów (brak takiej funkcjonalności)
- Testy na przeglądarkach starszych niż 2 lata

## 3. Typy Testów

### 3.1 Testy Jednostkowe (Unit Tests)

**Priorytet**: ★★★★★ (Wysoki)

**Narzędzia**: Jest, React Testing Library

**Zakres**:
- Wszystkie funkcje walidacyjne (`validation.ts`)
- Funkcje pomocnicze i utility (`api-route-helpers.ts`)
- Serwisy biznesowe (izolowane, z mockowanymi zależnościami)
- Komponenty UI (rendering, props, interakcje)
- Custom hooki React
- Funkcje transformacji danych
- API routes logic (z mockowanymi zależnościami)
- Logika biznesowa (prompts, versions, tags, catalogs, runs, search)

**Przykładowe scenariusze**:
```typescript
// validation.ts
- assertUuidPathParam() zwraca poprawny UUID dla prawidłowego formatu
- assertUuidPathParam() rzuca błąd dla nieprawidłowego UUID
- Walidacja długości contentu (max 100000 znaków)
- Walidacja summary (max 1000 znaków)

// http-errors.ts
- ApiError tworzy odpowiednią strukturę błędu
- Mapowanie kodów błędów na statusy HTTP

// Komponenty UI
- Button renderuje się poprawnie z różnymi wariantami
- Input obsługuje zdarzenia onChange
- Dialog otwiera i zamyka się poprawnie

// Serwisy (z mockami)
- prompts-service: CRUD operations logic
- search-service: search query building
- openrouter-service: request formatting
```

**Metryki sukcesu**:
- Pokrycie kodu: ≥ 80% dla warstwy serwisowej
- Pokrycie kodu: ≥ 70% dla komponentów UI
- Wszystkie testy przechodzą w < 10s

### 3.2 Testy End-to-End (E2E Tests)

**Priorytet**: ★★★★★ (Wysoki)

**Narzędzia**: Playwright

**Zakres**:
- Pełne user journey od logowania do wykonania zadania
- Testy scenariuszy opisanych w PRD (US-001 do US-030)
- Testy na różnych przeglądarkach (Chrome, Firefox, WebKit)
- Integracja z rzeczywistą bazą danych i serwisami
- Row Level Security verification
- Triggery i funkcje bazodanowe
- Przepływ danych end-to-end (UI → API → Database → UI)

**Przykładowe scenariusze (według User Stories)**:

```
E2E-US-003: Utworzenie nowego promptu
  1. Zaloguj się jako użytkownik testowy
  2. Kliknij "New Prompt"
  3. Wypełnij tytuł, content, wybierz tagi i katalog
  4. Kliknij "Save"
  5. Weryfikuj: prompt pojawia się na liście
  6. Weryfikuj: wszystkie pola są poprawnie zapisane

E2E-US-009: Wykonanie promptu (Playground)
  1. Otwórz istniejący prompt
  2. Kliknij "Run"
  3. Poczekaj na odpowiedź
  4. Weryfikuj: wynik jest wyświetlony
  5. Weryfikuj: last run jest zaktualizowany
  6. Weryfikuj: czas wykonania < 4s

E2E-US-011: Workflow "Improve"
  1. Otwórz prompt
  2. Kliknij "Improve"
  3. Poczekaj na sugestie
  4. Wybierz jedną sugestię
  5. Edytuj jeśli potrzeba
  6. Zapisz jako nową wersję
  7. Weryfikuj: nowa wersja jest current
  8. Weryfikuj: event "improve_saved" został zapisany
```

**Strategie testowania**:
- Testy smoke: kluczowe ścieżki użytkownika
- Testy regresji: po każdym releasie
- Testy wizualne: snapshot testing dla kluczowych widoków

**Metryki sukcesu**:
- Wszystkie user stories (US-001 do US-030) mają testy E2E
- Testy wykonują się w < 10 minut
- Success rate ≥ 95%
- Wszystkie krytyczne przepływy integracyjne pokryte (auth, RLS, database triggers)

## 4. Scenariusze Testowe dla Kluczowych Funkcjonalności

### 4.1 Autentykacja (AUTH)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| AUTH-001 | Rejestracja nowego użytkownika przez email | Wysoki | E2E |
| AUTH-002 | Logowanie przez Google OAuth | Wysoki | E2E |
| AUTH-003 | Logowanie przez email | Wysoki | E2E |
| AUTH-004 | Wylogowanie i invalidacja sesji | Wysoki | E2E |
| AUTH-005 | Odświeżanie tokena sesji | Wysoki | E2E |
| AUTH-006 | Dostęp do chronionej strony bez logowania → redirect | Wysoki | E2E |
| AUTH-007 | Token expiration handling | Średni | E2E |

### 4.2 Zarządzanie Promptami (PROMPT)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| PROMPT-001 | Utworzenie nowego promptu z wszystkimi polami | Wysoki | E2E |
| PROMPT-002 | Utworzenie promptu z minimalnym zestawem pól | Wysoki | E2E |
| PROMPT-003 | Edycja istniejącego promptu | Wysoki | E2E |
| PROMPT-004 | Usunięcie promptu z potwierdzeniem | Wysoki | E2E |
| PROMPT-005 | Lista promptów z paginacją | Wysoki | E2E |
| PROMPT-006 | Sortowanie promptów (updated_at DESC) | Średni | E2E |
| PROMPT-007 | Filtrowanie po katalogu | Średni | E2E |
| PROMPT-008 | Prompt bez katalogu (catalog_id = NULL) | Średni | E2E |
| PROMPT-009 | Walidacja: tytuł jest wymagany | Wysoki | Unit |
| PROMPT-010 | Walidacja: content max 100k znaków | Wysoki | Unit |
| PROMPT-011 | Utworzenie promptu tworzy initial version | Krytyczny | E2E |
| PROMPT-012 | Aktualizacja promptu tworzy nową wersję | Krytyczny | E2E |
| PROMPT-013 | current_version_id wskazuje na najnowszą wersję | Krytyczny | E2E |

### 4.3 Wersjonowanie (VERSION)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| VER-001 | Lista wersji promptu | Wysoki | E2E |
| VER-002 | Przywrócenie starej wersji | Wysoki | E2E |
| VER-003 | Przywrócenie tworzy nową wersję (restore action) | Wysoki | E2E |
| VER-004 | Historia wersji pokazuje summary i timestamp | Średni | E2E |
| VER-005 | Version retention: pruning po 14 dniach | Średni | E2E |
| VER-006 | Version retention: pruning po 30 dniach | Średni | E2E |
| VER-007 | Version retention: "always" - brak pruning | Średni | E2E |
| VER-008 | Usunięcie promptu usuwa wszystkie wersje (cascade) | Wysoki | E2E |

### 4.4 Tagi (TAG)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| TAG-001 | Utworzenie nowego tagu | Wysoki | E2E |
| TAG-002 | Lista tagów użytkownika | Wysoki | E2E |
| TAG-003 | Przypisanie tagu do promptu | Wysoki | E2E |
| TAG-004 | Usunięcie tagu z promptu | Wysoki | E2E |
| TAG-005 | Usunięcie tagu usuwa powiązania z promptami | Wysoki | E2E |
| TAG-006 | Tag name jest unique per user (case-insensitive) | Średni | E2E |
| TAG-007 | Filtrowanie promptów po tagu | Wysoki | E2E |
| TAG-008 | Prompt może mieć wiele tagów | Średni | E2E |
| TAG-009 | Trigger sprawdza ownership przy tag assignment | Krytyczny | E2E |

### 4.5 Katalogi (CATALOG)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| CAT-001 | Utworzenie nowego katalogu | Wysoki | E2E |
| CAT-002 | Edycja katalogu | Średni | E2E |
| CAT-003 | Usunięcie pustego katalogu | Wysoki | E2E |
| CAT-004 | Usunięcie katalogu z promptami (cascade) | Wysoki | E2E |
| CAT-005 | Catalog name jest unique per user (case-insensitive) | Średni | E2E |
| CAT-006 | Przypisanie promptu do katalogu | Wysoki | E2E |
| CAT-007 | Zmiana katalogu promptu | Średni | E2E |
| CAT-008 | Usunięcie przypisania katalogu (NULL) | Średni | E2E |

### 4.6 Wyszukiwanie (SEARCH)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| SEARCH-001 | Wyszukiwanie po tytule promptu | Wysoki | E2E |
| SEARCH-002 | Wyszukiwanie po contencie promptu | Wysoki | E2E |
| SEARCH-003 | Wyszukiwanie po nazwie katalogu | Średni | E2E |
| SEARCH-004 | Wyszukiwanie po tagach | Wysoki | E2E |
| SEARCH-005 | Wyszukiwanie z wieloma słowami kluczowymi | Wysoki | E2E |
| SEARCH-006 | Wyszukiwanie phrase search (cudzysłów) | Średni | E2E |
| SEARCH-007 | Wyszukiwanie zwraca wyniki sorted by relevance | Średni | E2E |
| SEARCH-008 | Trigger aktualizuje search_vector przy CREATE | Krytyczny | E2E |
| SEARCH-009 | Trigger aktualizuje search_vector przy UPDATE | Krytyczny | E2E |
| SEARCH-010 | Empty search query zwraca wszystkie prompty | Niski | E2E |

### 4.7 Wykonywanie Promptów (RUN)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| RUN-001 | Wykonanie promptu - success | Krytyczny | E2E |
| RUN-002 | Wykonanie promptu - error handling | Krytyczny | E2E |
| RUN-003 | Wykonanie zapisuje run record | Krytyczny | E2E |
| RUN-004 | last_run_id jest aktualizowany | Wysoki | E2E |
| RUN-005 | Historia runów dla promptu | Wysoki | E2E |
| RUN-006 | Metadata: latency_ms, token_usage, model | Średni | E2E |
| RUN-007 | Status: pending → success | Średni | E2E |
| RUN-008 | Status: pending → error (z error_message) | Wysoki | E2E |
| RUN-009 | Timeout po 10s → status timeout | Średni | E2E |
| RUN-010 | OpenRouter API call formatting | Wysoki | Unit |
| RUN-011 | Event "run" jest zapisywany w run_events | Średni | E2E |

### 4.8 Workflow "Improve" (IMPROVE)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| IMP-001 | Click "Improve" → otrzymanie sugestii | Krytyczny | E2E |
| IMP-002 | Wybór sugestii i zapisanie jako nowa wersja | Krytyczny | E2E |
| IMP-003 | Edycja sugestii przed zapisaniem | Wysoki | E2E |
| IMP-004 | Event "improve" jest zapisywany | Średni | E2E |
| IMP-005 | Event "improve_saved" przy zapisaniu | Wysoki | E2E |
| IMP-006 | Wiele sugestii - wybór jednej | Średni | E2E |
| IMP-007 | Improve request formatting | Wysoki | Unit |
| IMP-008 | Error handling przy improve | Wysoki | E2E |
| IMP-009 | KPI: improve_saved / improve ratio | Średni | E2E |

### 4.9 Row Level Security (RLS)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| RLS-001 | User A nie widzi promptów User B | Krytyczny | E2E |
| RLS-002 | User A nie może edytować promptów User B | Krytyczny | E2E |
| RLS-003 | User A nie może usunąć promptów User B | Krytyczny | E2E |
| RLS-004 | Polityki RLS dla wszystkich tabel | Krytyczny | E2E |

## 5. Środowisko Testowe

### 5.1 Konfiguracja Środowisk

#### 5.1.1 Lokalne Środowisko Deweloperskie
```yaml
- Node.js: 20.x
- PostgreSQL: 15.x (Docker)
- Next.js: 16.0.3
- TypeScript: 5.x
```

#### 5.1.2 CI/CD Environment (GitHub Actions)
```yaml
- Node.js: 20.x
- Przeglądarki: Chrome (latest), Firefox (latest), Webkit (latest)
- PostgreSQL: dostęp do test database (dla E2E testów)
```

#### 5.1.3 Staging Environment
```yaml
- Vercel Preview Deployment
- Supabase (projekt testowy)
- Dedykowany OpenRouter API key
```

### 5.2 Dane Testowe

#### 5.2.1 Seed Data
```sql
-- Testowi użytkownicy
- test-user-1@promptana.test (z kompletnym setupem)
- test-user-2@promptana.test (do testów RLS)
- admin@promptana.test (do testów operacyjnych)

-- Przykładowe prompty
- 50 promptów z różnymi tagami i katalogami
- 20 promptów bez katalogów
- 10 promptów z historią wersji (5+ wersji każdy)
- 5 promptów z wykonaniami

-- Tagi
- 20 różnych tagów (AI, Coding, Writing, itp.)

-- Katalogi
- 10 katalogów tematycznych
```

#### 5.2.2 Generowanie Danych
```typescript
// Użycie Faker.js lub custom factory
- PromptFactory.create({ withVersions: 5, withRuns: 3 })
- TagFactory.createMany(20)
- CatalogFactory.create({ withPrompts: 10 })
```

### 5.3 Mocking Zewnętrznych Serwisów

#### 5.3.1 OpenRouter Mock
```typescript
// Mock responses dla różnych scenariuszy
- Success response (200, prawidłowy JSON)
- Error response (500, error message)
- Timeout (delay > 10s)
- Invalid API key (401)
```

#### 5.3.2 Supabase Auth Mock
```typescript
// Mock auth dla testów jednostkowych
- Valid session
- Expired session
- Invalid token
- Missing auth
```

## 6. Narzędzia do Testowania

### 6.1 Framework i Biblioteki

| Kategoria | Narzędzie | Wersja | Użycie |
|-----------|----------|--------|--------|
| Test Runner | Jest | ^29.x | Testy jednostkowe |
| E2E Testing | Playwright | ^1.40 | Testy end-to-end |
| React Testing | React Testing Library | ^14.x | Testy komponentów React |
| Mocking | MSW (Mock Service Worker) | ^2.x | Mockowanie requestów w testach unit |
| Linting | ESLint | ^9.x | Analiza statyczna |
| Type Checking | TypeScript | ^5.x | Sprawdzanie typów |

### 6.2 CI/CD Pipeline

```yaml
name: Test Pipeline
on: [push, pull_request]

jobs:
  lint:
    - ESLint
    - TypeScript type check
    - Prettier format check
  
  unit-tests:
    - Jest unit tests
    - Coverage report
  
  e2e-tests:
    - Playwright tests
    - 3 browsers (Chromium, Firefox, Webkit)
    - Upload test artifacts
```

## 7. Harmonogram Testów

### 7.1 Faza 1: Przygotowanie (Tydzień 1)

**Działania**:
- [ ] Setup środowiska testowego
- [ ] Konfiguracja Jest + React Testing Library
- [ ] Konfiguracja Playwright
- [ ] Przygotowanie danych testowych (seeds)
- [ ] Implementacja mocków (OpenRouter, Supabase Auth)
- [ ] Setup CI/CD pipeline

**Odpowiedzialni**: QA Engineer, DevOps Engineer

**Deliverables**:
- Działające środowisko testowe
- CI/CD pipeline z podstawowymi testami
- Dokumentacja setup'u

### 7.2 Faza 2: Testy Jednostkowe (Tydzień 2-3)

**Działania**:
- [ ] Testy walidacji (`validation.ts`)
- [ ] Testy http-errors (`http-errors.ts`)
- [ ] Testy komponentów UI (Button, Input, Dialog, etc.)
- [ ] Testy custom hooków
- [ ] Testy utility functions
- [ ] Testy serwisów (z mockowanymi zależnościami)

**Cel pokrycia**: ≥80% dla warstwy serwisowej, ≥70% dla komponentów UI

**Odpowiedzialni**: Frontend Developer, Backend Developer

**Deliverables**:
- ~100-150 testów jednostkowych
- Coverage report

### 7.3 Faza 3: Testy E2E (Tydzień 4-6)

**Tydzień 4-5**: Implementacja testów
- [ ] E2E dla wszystkich User Stories (US-001 do US-030)
- [ ] Happy paths
- [ ] Error scenarios
- [ ] Edge cases
- [ ] RLS verification
- [ ] Database triggers verification

**Tydzień 6**: Stabilizacja i flaky tests
- [ ] Naprawa niestabilnych testów
- [ ] Optymalizacja czasu wykonania
- [ ] Retry strategies

**Odpowiedzialni**: QA Engineer, Frontend Developer

**Deliverables**:
- ~30-40 testów E2E
- Test report z coverage wszystkich user stories

### 7.4 Faza 4: Release (Tydzień 7)

**Działania**:
- [ ] Pełny test suite run
- [ ] Bug fixing
- [ ] Re-testing
- [ ] Sign-off

**Kryteria akceptacji**:
- Wszystkie testy krytyczne (P0) przechodzą
- 0 blokerów
- ≤ 2 high priority bugs
- Coverage targets osiągnięte

**Odpowiedzialni**: Cały zespół

**Deliverables**:
- Final test report
- Known issues list
- Release notes

### 7.5 Continuous Testing (Post-Release)

**Działania cykliczne**:
- Testy smoke po każdym deploymencie
- Unit i E2E tests przy każdym PR
- Monitoring production dla performance i errors

## 8. Kryteria Akceptacji Testów

### 8.1 Kryteria Ilościowe

| Metryka | Target | Źródło |
|---------|--------|--------|
| Code Coverage - Services | ≥ 80% | Jest Coverage Report |
| Code Coverage - Components | ≥ 70% | Jest Coverage Report |
| Code Coverage - Overall | ≥ 75% | Jest Coverage Report |
| Test Success Rate | ≥ 95% | CI/CD Pipeline |
| E2E Test Coverage | 100% User Stories | Manual Tracking |
| Critical Bugs | 0 | Bug Tracker |
| High Priority Bugs | ≤ 2 | Bug Tracker |
| Medium Priority Bugs | ≤ 5 | Bug Tracker |

### 8.2 Kryteria Jakościowe

**Testy Jednostkowe**:
- ✅ Wszystkie funkcje utility są pokryte
- ✅ Wszystkie walidatory są pokryte
- ✅ Edge cases są testowane
- ✅ Error handling jest testowany
- ✅ Logika biznesowa serwisów jest przetestowana (z mockami)

**Testy E2E**:
- ✅ Wszystkie user stories (US-001 do US-030) mają testy
- ✅ Happy paths są pokryte
- ✅ Error scenarios są pokryte
- ✅ Edge cases są pokryte
- ✅ Row Level Security działa poprawnie
- ✅ Triggery bazodanowe działają poprawnie
- ✅ Cascading deletes działają poprawnie
- ✅ Wszystkie API endpoints są weryfikowane end-to-end

### 8.3 Definition of Done (DoD) dla Testów

Test jest uznany za "Done" gdy:
1. ✅ Test case jest napisany zgodnie ze standardem
2. ✅ Test przechodzi w lokalnym środowisku
3. ✅ Test przechodzi w CI/CD
4. ✅ Test jest deterministyczny (nie flaky)
5. ✅ Test ma jasny opis i assertion messages
6. ✅ Test jest zrecenzowany przez przynajmniej jedną osobę
7. ✅ Test jest udokumentowany (jeśli complex)

## 9. Role i Odpowiedzialności

### 9.1 QA Engineer (Lead Tester)

**Odpowiedzialności**:
- Tworzenie i utrzymanie planu testów
- Koordynacja działań testowych
- Implementacja testów E2E (Playwright)
- Raportowanie błędów i śledzenie progress
- Review test coverage
- Weryfikacja kryteriów akceptacji
- Finalna akceptacja przed release

**Deliverables**:
- Test plan
- Test cases documentation
- Test reports (daily, weekly, release)
- Bug reports
- E2E test automation scripts

### 9.2 Frontend Developer

**Odpowiedzialności**:
- Testy jednostkowe komponentów React
- Testy custom hooków
- Wsparcie przy testach E2E (selektory, test IDs)
- Naprawa bugów frontendowych
- Review testów frontendowych

**Deliverables**:
- Unit tests dla komponentów
- Komponenty z data-testid attributes
- Bug fixes

### 9.3 Backend Developer

**Odpowiedzialności**:
- Testy jednostkowe serwisów (z mockowanymi zależnościami)
- Testy jednostkowe walidatorów
- Testy jednostkowe utility functions
- Naprawa bugów backendowych
- Review testów backendowych

**Deliverables**:
- Unit tests dla serwisów
- Unit tests dla walidatorów
- Bug fixes

### 9.4 DevOps Engineer

**Odpowiedzialności**:
- Setup CI/CD pipeline
- Setup środowisk testowych (staging)
- Monitorowanie czasu wykonania testów
- Automatyzacja deploymentów

**Deliverables**:
- CI/CD pipeline configuration
- Staging environment
- Monitoring dashboards

### 9.5 Tech Lead / Architect

**Odpowiedzialności**:
- Review architektury testów
- Decyzje techniczne dotyczące testowania
- Review pull requestów z testami
- Mentoring zespołu
- Priorytetyzacja test cases
- Approvals przed release

**Deliverables**:
- Architectural decisions
- Code reviews
- Technical guidance

### 9.6 Product Owner

**Odpowiedzialności**:
- Definiowanie acceptance criteria
- Priorytetyzacja user stories
- Weryfikacja, że testy pokrywają business requirements
- Akceptacja release kandidatów
- Decyzje o go/no-go

**Deliverables**:
- User stories z acceptance criteria
- Priority decisions
- Release approvals

## 10. Procedury Raportowania Błędów

### 10.1 Klasyfikacja Błędów

#### Severity Levels

**P0 - Critical (Blocker)**:
- Aplikacja nie działa (crash)
- Brak możliwości logowania
- Utrata danych
- Krytyczna luka bezpieczeństwa
- Brak możliwości wykonania core functionality

**Reakcja**: Natychmiastowa, fix w ciągu 24h

**P1 - High**:
- Główna funkcjonalność nie działa prawidłowo
- Brak workaround
- Znaczący wpływ na user experience
- Poważny problem wydajnościowy

**Reakcja**: Fix w ciągu 2-3 dni

**P2 - Medium**:
- Funkcjonalność działa, ale z problemami
- Istnieje workaround
- Wpływ na część użytkowników
- Problemy kosmetyczne w krytycznych miejscach

**Reakcja**: Fix w ciągu 1-2 tygodni

**P3 - Low**:
- Drobne problemy kosmetyczne
- Edge cases
- Suggestions for improvement
- Dokumentacja

**Reakcja**: Fix w następnym sprincie lub później

### 10.2 Szablon Bug Report

```markdown
# BUG-XXX: [Krótki tytuł]

## Podstawowe Informacje
- **Severity**: P0 / P1 / P2 / P3
- **Status**: New / In Progress / Fixed / Verified / Closed
- **Reporter**: [Imię]
- **Assigned to**: [Imię]
- **Found in**: [Build/Commit hash]
- **Environment**: Dev / Staging / Production

## Opis
[Jasny i zwięzły opis problemu]

## Kroki do Reprodukcji
1. Zaloguj się jako test-user-1@promptana.test
2. Przejdź do /prompts/new
3. Wypełnij formularz
4. Kliknij "Save"
5. Obserwuj błąd

## Oczekiwane Zachowanie
[Co powinno się wydarzyć]

## Aktualne Zachowanie
[Co się dzieje]

## Screenshots/Recordings
[Załącz jeśli możliwe]

## Logi/Error Messages
```
[Treść błędu z konsoli/logów]
```

## Środowisko
- OS: Windows 10 / macOS 14 / Ubuntu 22.04
- Browser: Chrome 120 / Firefox 121 / Safari 17
- Node version: 20.10.0
- Commit hash: abc123def456

## Dodatkowe Informacje
- Test case ID: E2E-US-003
- Related issues: BUG-XXX, BUG-YYY
- Workaround: [Jeśli istnieje]

## Root Cause Analysis (wypełnia developer)
[Analiza przyczyny problemu]

## Fix Description
[Opis implementacji poprawki]

## Verification Steps
[Kroki do weryfikacji, że bug jest naprawiony]
```

### 10.3 Workflow Zarządzania Błędami

```
1. Discovery
   ↓
2. Triage (QA + Tech Lead)
   - Assign severity
   - Assign owner
   - Set priority
   ↓
3. Fix (Developer)
   - Implement fix
   - Write test case
   - Create PR
   ↓
4. Code Review (Tech Lead)
   - Review code
   - Review tests
   - Approve/Request changes
   ↓
5. Verification (QA)
   - Test in dev environment
   - Verify fix works
   - Check no regression
   ↓
6. Deployment (DevOps)
   - Deploy to staging
   - Run full test suite
   - Monitor
   ↓
7. Closure (QA)
   - Update bug status
   - Document resolution
```

### 10.4 Narzędzia

**Bug Tracking**: GitHub Issues z custom labels

**Labels**:
- `bug`: Ogólny bug
- `P0-critical`, `P1-high`, `P2-medium`, `P3-low`: Severity
- `frontend`, `backend`, `database`, `integration`: Komponenty
- `security`, `performance`, `accessibility`: Specjalne kategorie
- `regression`: Bug wprowadzony w nowej wersji
- `needs-triage`: Wymaga oceny
- `in-progress`, `needs-verification`, `verified`: Status

**Communication**:
- Slack channel: #bugs-and-issues
- Daily standup: Status update krytycznych bugów
- Bug review meeting: Cotygodniowa sesja triażu

### 10.5 Metryki Błędów

**Śledzone metryki**:
- Total bugs found (per week)
- Bugs by severity
- Bugs by component (frontend/backend/database)
- Mean Time To Resolve (MTTR)
- Bug reopen rate
- Bugs found in production vs testing
- Test escape rate (bugs found by users)

**Cele**:
- MTTR dla P0: < 24h
- MTTR dla P1: < 72h
- Bug reopen rate: < 10%
- Test escape rate: < 5%

### 10.6 Polityka Hotfix

**Kryteria dla hotfix** (pominięcie normalnego release cycle):
- P0 bug w produkcji
- Krytyczna luka bezpieczeństwa
- Utrata danych
- Aplikacja nie działa dla większości użytkowników

**Proces hotfix**:
1. Natychmiastowa eskalacja do Tech Lead
2. Utworzenie hotfix branch z production
3. Minimalna zmiana kodu (tylko fix)
4. Express testing (smoke tests + specific bug verification)
5. Direct deployment do produkcji
6. Post-mortem w ciągu 24h

---

## 11. Załączniki

### 11.1 Test Data Examples

#### Example Test User
```json
{
  "email": "test-user-1@promptana.test",
  "password": "Test123!@#",
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Example Prompt
```json
{
  "id": "650e8400-e29b-41d4-a716-446655440001",
  "title": "Test Prompt for E2E",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "catalog_id": "750e8400-e29b-41d4-a716-446655440002",
  "current_version_id": "850e8400-e29b-41d4-a716-446655440003",
  "created_at": "2024-12-01T10:00:00Z",
  "updated_at": "2024-12-01T10:00:00Z"
}
```

#### Example Prompt Version
```json
{
  "id": "850e8400-e29b-41d4-a716-446655440003",
  "prompt_id": "650e8400-e29b-41d4-a716-446655440001",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Test Prompt for E2E",
  "content": "You are a helpful assistant. Please help me with...",
  "summary": "Initial version",
  "created_by": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2024-12-01T10:00:00Z"
}
```

### 11.2 Przydatne Komendy

#### Uruchamianie Testów Lokalnie

```bash
# Wszystkie testy
npm test

# Tylko unit tests
npm run test:unit

# Tylko E2E tests
npm run test:e2e

# Z coverage (unit tests)
npm run test:coverage

# Watch mode (unit tests)
npm run test:watch

# Specific test file
npm test -- prompts-service.test.ts

# Update snapshots
npm test -- -u

# E2E w trybie headed (z widoczną przeglądarką)
npm run test:e2e -- --headed

# E2E dla konkretnej przeglądarki
npm run test:e2e -- --project=chromium
```

### 11.3 Checklist Pre-Release

```markdown
## Release Checklist - v1.0.0

### Code Quality
- [ ] All linters pass (ESLint, Prettier)
- [ ] TypeScript compilation successful (no errors)
- [ ] No console.log or debug statements
- [ ] Code reviewed and approved

### Tests
- [ ] All unit tests pass (≥80% coverage dla serwisów, ≥70% dla UI)
- [ ] All E2E tests pass (all browsers: Chromium, Firefox, WebKit)
- [ ] No flaky tests
- [ ] Test execution time < 10 minutes total

### Functionality (E2E Verified)
- [ ] All user stories (US-001 to US-030) verified
- [ ] Authentication flow works (Google OAuth + email)
- [ ] Prompt CRUD works
- [ ] Search works (full-text)
- [ ] Run prompt works
- [ ] Improve workflow works
- [ ] Version management works
- [ ] Tags and catalogs work
- [ ] RLS policies verified (multi-user isolation)
- [ ] Database triggers functioning
- [ ] Cascade deletes working

### Documentation
- [ ] README updated
- [ ] API documentation current
- [ ] CHANGELOG updated
- [ ] Known issues documented

### Deployment
- [ ] Environment variables configured
- [ ] Staging deployment successful
- [ ] Smoke tests on staging pass
- [ ] Rollback plan documented

### Sign-off
- [ ] QA Engineer approval
- [ ] Tech Lead approval
- [ ] Product Owner approval

**Release Date**: _______________
**Release Manager**: _______________
```

---

## 12. Podsumowanie i Priorytetyzacja

### 12.1 Kluczowe Priorytety Testowania

**Unit Tests (P0)**:
- Wszystkie funkcje walidacyjne i utility
- Logika biznesowa serwisów (z mockowanymi zależnościami)
- Komponenty UI React
- Custom hooki
- Coverage ≥ 80% dla serwisów, ≥ 70% dla UI

**E2E Tests (P0)**:
1. **Security & Authentication**
   - Row Level Security (multi-user isolation)
   - API authentication (Google OAuth + email)
   - Autoryzacja dostępu do zasobów

2. **Core Functionality**
   - Prompt CRUD (pełny cykl życia)
   - Run prompt (wykonywanie przez OpenRouter)
   - Improve workflow (AI-driven ulepszanie)

3. **Data Integrity**
   - Wersjonowanie (tworzenie, przywracanie)
   - Cascade deletes
   - Database triggers (search_vector, ownership)
   - Input validation end-to-end

4. **User Experience**
   - Search functionality (full-text)
   - Tags and catalogs (organizacja)
   - Error handling (user-friendly messages)
   - 100% user stories pokryte testami E2E

### 12.2 Success Criteria

Ten plan testów będzie uznany za sukces, gdy:

✅ **Jakość Kodu**:
- Zero P0 bugs w produkcji przez pierwszy miesiąc
- Test coverage ≥ 80% dla warstwy serwisowej (unit tests)
- Test coverage ≥ 70% dla komponentów UI (unit tests)
- 100% user stories pokrytych testami E2E

✅ **Funkcjonalność**:
- Wszystkie krytyczne przepływy działają (verified przez E2E)
- RLS działa poprawnie (verified przez E2E)
- Wszystkie endpointy chronione auth (verified przez E2E)
- Database triggers działają poprawnie (verified przez E2E)

✅ **Proces**:
- CI/CD pipeline fully automated
- Test execution time < 10 min (total)
- Bug MTTR: P0 < 24h, P1 < 72h
- Test success rate ≥ 95%

### 12.3 Continuous Improvement

Po wdrożeniu MVP, plan testów będzie ciągle ulepszany poprzez:

- **Retrospektywy**: Cotygodniowa analiza co działa, a co nie
- **Metrics Review**: Miesięczna analiza metryk testowych (coverage, success rate, execution time)
- **Test Maintenance**: Regularne czyszczenie i refactoring testów
- **New Test Cases**: Dodawanie testów dla nowych bugów (regression prevention)
- **Test Optimization**: Ciągła optymalizacja czasu wykonania testów (unit < 10s, E2E < 10min)
- **Tool Evaluation**: Kwartalna ocena nowych narzędzi testowych

---

**Dokument stworzony**: 8 grudnia 2024  
**Ostatnia aktualizacja**: 8 grudnia 2024  
**Wersja**: 2.0  
**Status**: Simplified (Unit + E2E only)  
**Następna aktualizacja**: Po implementacji Fazy 1

