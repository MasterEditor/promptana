# Plan Testów - Promptana

## 1. Wprowadzenie i Cele Testowania

### 1.1 Cel Dokumentu
Niniejszy plan testów określa strategię, zakres, metody i harmonogram testowania aplikacji Promptana - systemu do zarządzania, wykonywania i ulepszania promptów AI.

### 1.2 Cele Testowania
- **Weryfikacja funkcjonalności**: Potwierdzenie, że wszystkie wymagania funkcjonalne (FR-001 do FR-013) zostały poprawnie zaimplementowane
- **Zapewnienie jakości**: Zapewnienie wysokiej jakości kodu, wydajności i bezpieczeństwa aplikacji
- **Walidacja integracji**: Weryfikacja poprawnej integracji z zewnętrznymi serwisami (Supabase Auth, OpenRouter, PostgreSQL)
- **Wykrycie defektów**: Identyfikacja i dokumentacja błędów przed wdrożeniem produkcyjnym
- **Potwierdzenie KPI**: Weryfikacja, że system spełnia określone metryki sukcesu (czas odpowiedzi < 4s, wskaźnik improve-to-save ≥ 80%)
- **Zapewnienie bezpieczeństwa**: Weryfikacja mechanizmów autentykacji, autoryzacji i zabezpieczeń przed atakami

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
- Testy wydajnościowe infrastruktury cloud (poza zakresem MVP)
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
```

**Metryki sukcesu**:
- Pokrycie kodu: ≥ 80% dla warstwy serwisowej
- Pokrycie kodu: ≥ 70% dla komponentów UI
- Wszystkie testy przechodzą w < 10s

### 3.2 Testy Integracyjne (Integration Tests)

**Priorytet**: ★★★★★ (Wysoki)

**Narzędzia**: Jest, Supertest (dla API), Testcontainers (PostgreSQL)

**Zakres**:
- API routes z rzeczywistą bazą danych testową
- Przepływ danych między warstwami (route → service → database)
- Integracja z Supabase Auth (mockowane lub testowe środowisko)
- Integracja z OpenRouter (mockowane)
- Triggery i funkcje bazodanowe
- Row Level Security policies

**Przykładowe scenariusze**:
```
AUTH-INT-001: Pełny flow rejestracji i logowania
AUTH-INT-002: Odświeżanie tokena sesji
AUTH-INT-003: Wylogowanie i invalidacja sesji

PROMPT-INT-001: Utworzenie promptu tworzy też pierwszą wersję
PROMPT-INT-002: Aktualizacja promptu tworzy nową wersję i aktualizuje current_version_id
PROMPT-INT-003: Usunięcie promptu usuwa cascade wszystkie wersje i uruchomienia
PROMPT-INT-004: Uruchomienie promptu zapisuje wynik i aktualizuje last_run_id

SEARCH-INT-001: search_vector jest automatycznie aktualizowany przez trigger
SEARCH-INT-002: Wyszukiwanie znajduje prompty po tytule, contencie i katalogu
SEARCH-INT-003: Filtrowanie po tagach działa poprawnie

RLS-INT-001: Użytkownik A nie może zobaczyć promptów użytkownika B
RLS-INT-002: Polityki RLS blokują nieautoryzowany dostęp

TAG-INT-001: Trigger sprawdza ownership przy przypisywaniu tagów
```

**Konfiguracja środowiska testowego**:
```typescript
// Użycie Testcontainers dla izolacji
- Kontener PostgreSQL z zastosowanymi migracjami
- Mock Supabase Auth z testowymi użytkownikami
- Mock OpenRouter z predefinowanymi odpowiedziami
```

**Metryki sukcesu**:
- Wszystkie krytyczne przepływy pokryte testami
- Testy wykonują się w < 60s
- 100% ścieżek API przetestowanych

### 3.3 Testy End-to-End (E2E Tests)

**Priorytet**: ★★★★☆ (Średni-Wysoki)

**Narzędzia**: Playwright

**Zakres**:
- Pełne user journey od logowania do wykonania zadania
- Testy scenariuszy opisanych w PRD (US-001 do US-030)
- Testy na różnych przeglądarkach (Chrome, Firefox, Safari)
- Testy responsive design (desktop, tablet, mobile)

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
- Testy wykonują się w < 5 minut
- Success rate ≥ 95%

### 3.4 Testy Wydajnościowe (Performance Tests)

**Priorytet**: ★★★☆☆ (Średni)

**Narzędzia**: k6, Lighthouse, WebPageTest

**Zakres**:
- Pomiar czasu odpowiedzi API
- Pomiar czasu ładowania stron
- Testy obciążeniowe (concurrent users)
- Analiza bundle size
- Analiza wydajności bazy danych (slow queries)

**Scenariusze**:
```
PERF-001: Czas odpowiedzi OpenRouter
  - Średni czas < 4s (KPI requirement)
  - 95 percentyl < 6s
  - Timeout po 10s

PERF-002: Wyszukiwanie pełnotekstowe
  - 1000 promptów: czas wyszukiwania < 500ms
  - 10000 promptów: czas wyszukiwania < 1s
  - Weryfikacja użycia indeksu GIN

PERF-003: Ładowanie listy promptów
  - 100 promptów: < 1s
  - Paginacja: 20 itemów per page
  - Infinite scroll: następna strona < 500ms

PERF-004: Bundle size
  - Initial bundle < 200KB (gzipped)
  - TTI (Time to Interactive) < 3s
  - LCP (Largest Contentful Paint) < 2.5s

PERF-005: Concurrent users
  - 10 użytkowników: średni czas odpowiedzi bez degradacji
  - 50 użytkowników: maksymalnie 2x wolniejsze odpowiedzi
```

**Metryki sukcesu**:
- OpenRouter średni czas < 4s
- Lighthouse score ≥ 90 dla Performance
- Brak slow queries (> 1s)

### 3.5 Testy Bezpieczeństwa (Security Tests)

**Priorytet**: ★★★★★ (Krytyczny)

**Narzędzia**: OWASP ZAP, npm audit, Snyk

**Zakres**:
- Testy autentykacji i autoryzacji
- Testy Row Level Security
- Analiza zależności (vulnerabilities)
- Testy injection (SQL, NoSQL, XSS)
- Testy CSRF protection
- Audyt bezpieczeństwa API keys

**Scenariusze**:
```
SEC-001: Nieautoryzowany dostęp do API
  - Wywołanie API bez tokena → 401
  - Wywołanie API z nieprawidłowym tokenem → 401
  - Dostęp do promptu innego użytkownika → 403

SEC-002: Row Level Security
  - User A tworzy prompt
  - User B próbuje odczytać prompt User A → 0 wyników
  - User B próbuje zaktualizować prompt User A → błąd

SEC-003: SQL Injection
  - Wstrzyknięcie SQL w pola tekstowe (tytuł, content)
  - Weryfikacja: parametryzowane zapytania
  - Brak wykonania złośliwego SQL

SEC-004: XSS (Cross-Site Scripting)
  - Wstrzyknięcie <script> w content promptu
  - Weryfikacja: output jest escaped
  - Skrypt nie jest wykonywany

SEC-005: OpenRouter Key Security
  - Klucz API nigdy nie jest wysyłany do klienta
  - Klucz jest bezpiecznie przechowywany (zmienne środowiskowe)
  - Brak logowania klucza w plaintext

SEC-006: Walidacja inputów
  - Content > 100000 znaków → 400 Bad Request
  - Summary > 1000 znaków → 400 Bad Request
  - Nieprawidłowy UUID → 400 Bad Request
  - Weryfikacja wszystkich field validators
```

**Metryki sukcesu**:
- Zero critical/high vulnerabilities w npm audit
- Wszystkie testy OWASP Top 10 przechodzą
- 100% endpointów API wymaga autentykacji

### 3.6 Testy Dostępności (Accessibility Tests)

**Priorytet**: ★★★☆☆ (Średni)

**Narzędzia**: axe-core, Pa11y, Lighthouse

**Zakres**:
- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader compatibility
- Kontrast kolorów
- ARIA labels

**Scenariusze**:
```
A11Y-001: Nawigacja klawiaturą
  - Wszystkie główne akcje dostępne przez Tab
  - Focus indicators są widoczne
  - Escape zamyka modalne
  - Enter/Space aktywuje buttony

A11Y-002: Screen Reader
  - Wszystkie interaktywne elementy mają labels
  - ARIA labels dla ikon
  - Alt text dla obrazów
  - Semantic HTML (nav, main, aside)

A11Y-003: Kontrast kolorów
  - Wszystkie teksty spełniają WCAG AA (4.5:1)
  - Przyciski spełniają WCAG AA (3:1)

A11Y-004: Formularze
  - Labels powiązane z inputami
  - Error messages są ogłaszane przez screen reader
  - Required fields są oznaczone
```

**Metryki sukcesu**:
- Lighthouse Accessibility score ≥ 90
- Zero critical issues w axe-core
- Wszystkie główne funkcje dostępne z klawiatury

### 3.7 Testy Regresji (Regression Tests)

**Priorytet**: ★★★★☆ (Średni-Wysoki)

**Zakres**:
- Automatyczne testy po każdym PR
- Testy przed każdym release
- Visual regression testing (snapshot)
- Weryfikacja, że poprawki nie psują istniejącej funkcjonalności

**Strategie**:
- CI/CD pipeline z automatycznymi testami
- Branch protection rules (testy muszą przejść)
- Snapshot testing dla komponentów UI
- Database state verification

## 4. Scenariusze Testowe dla Kluczowych Funkcjonalności

### 4.1 Autentykacja (AUTH)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| AUTH-001 | Rejestracja nowego użytkownika przez email | Wysoki | E2E |
| AUTH-002 | Logowanie przez Google OAuth | Wysoki | E2E |
| AUTH-003 | Logowanie przez email | Wysoki | E2E |
| AUTH-004 | Wylogowanie i invalidacja sesji | Wysoki | Integration |
| AUTH-005 | Odświeżanie tokena sesji | Wysoki | Integration |
| AUTH-006 | Dostęp do chronionej strony bez logowania → redirect | Wysoki | E2E |
| AUTH-007 | Token expiration handling | Średni | Integration |
| AUTH-008 | Concurrent sessions (same user) | Niski | Integration |

### 4.2 Zarządzanie Promptami (PROMPT)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| PROMPT-001 | Utworzenie nowego promptu z wszystkimi polami | Wysoki | E2E |
| PROMPT-002 | Utworzenie promptu z minimalnym zestawem pól | Wysoki | Integration |
| PROMPT-003 | Edycja istniejącego promptu | Wysoki | E2E |
| PROMPT-004 | Usunięcie promptu z potwierdzeniem | Wysoki | E2E |
| PROMPT-005 | Lista promptów z paginacją | Wysoki | E2E |
| PROMPT-006 | Sortowanie promptów (updated_at DESC) | Średni | Integration |
| PROMPT-007 | Filtrowanie po katalogu | Średni | E2E |
| PROMPT-008 | Prompt bez katalogu (catalog_id = NULL) | Średni | Integration |
| PROMPT-009 | Walidacja: tytuł jest wymagany | Wysoki | Unit |
| PROMPT-010 | Walidacja: content max 100k znaków | Wysoki | Integration |
| PROMPT-011 | Utworzenie promptu tworzy initial version | Krytyczny | Integration |
| PROMPT-012 | Aktualizacja promptu tworzy nową wersję | Krytyczny | Integration |
| PROMPT-013 | current_version_id wskazuje na najnowszą wersję | Krytyczny | Integration |

### 4.3 Wersjonowanie (VERSION)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| VER-001 | Lista wersji promptu | Wysoki | E2E |
| VER-002 | Przywrócenie starej wersji | Wysoki | E2E |
| VER-003 | Przywrócenie tworzy nową wersję (restore action) | Wysoki | Integration |
| VER-004 | Historia wersji pokazuje summary i timestamp | Średni | E2E |
| VER-005 | Version retention: pruning po 14 dniach | Średni | Integration |
| VER-006 | Version retention: pruning po 30 dniach | Średni | Integration |
| VER-007 | Version retention: "always" - brak pruning | Średni | Integration |
| VER-008 | Usunięcie promptu usuwa wszystkie wersje | Wysoki | Integration |

### 4.4 Tagi (TAG)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| TAG-001 | Utworzenie nowego tagu | Wysoki | E2E |
| TAG-002 | Lista tagów użytkownika | Wysoki | Integration |
| TAG-003 | Przypisanie tagu do promptu | Wysoki | E2E |
| TAG-004 | Usunięcie tagu z promptu | Wysoki | E2E |
| TAG-005 | Usunięcie tagu usuwa powiązania z promptami | Wysoki | Integration |
| TAG-006 | Tag name jest unique per user (case-insensitive) | Średni | Integration |
| TAG-007 | Filtrowanie promptów po tagu | Wysoki | E2E |
| TAG-008 | Prompt może mieć wiele tagów | Średni | Integration |
| TAG-009 | Trigger sprawdza ownership przy tag assignment | Krytyczny | Integration |

### 4.5 Katalogi (CATALOG)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| CAT-001 | Utworzenie nowego katalogu | Wysoki | E2E |
| CAT-002 | Edycja katalogu | Średni | E2E |
| CAT-003 | Usunięcie pustego katalogu | Wysoki | E2E |
| CAT-004 | Usunięcie katalogu z promptami (cascade) | Wysoki | Integration |
| CAT-005 | Catalog name jest unique per user (case-insensitive) | Średni | Integration |
| CAT-006 | Przypisanie promptu do katalogu | Wysoki | E2E |
| CAT-007 | Zmiana katalogu promptu | Średni | E2E |
| CAT-008 | Usunięcie przypisania katalogu (NULL) | Średni | Integration |

### 4.6 Wyszukiwanie (SEARCH)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| SEARCH-001 | Wyszukiwanie po tytule promptu | Wysoki | E2E |
| SEARCH-002 | Wyszukiwanie po contencie promptu | Wysoki | E2E |
| SEARCH-003 | Wyszukiwanie po nazwie katalogu | Średni | E2E |
| SEARCH-004 | Wyszukiwanie po tagach | Wysoki | E2E |
| SEARCH-005 | Wyszukiwanie z wieloma słowami kluczowymi | Wysoki | Integration |
| SEARCH-006 | Wyszukiwanie phrase search (cudzysłów) | Średni | Integration |
| SEARCH-007 | Wyszukiwanie zwraca wyniki sorted by relevance | Średni | Integration |
| SEARCH-008 | Trigger aktualizuje search_vector przy CREATE | Krytyczny | Integration |
| SEARCH-009 | Trigger aktualizuje search_vector przy UPDATE | Krytyczny | Integration |
| SEARCH-010 | Indeks GIN jest używany (EXPLAIN ANALYZE) | Średni | Performance |
| SEARCH-011 | Empty search query zwraca wszystkie prompty | Niski | Integration |

### 4.7 Wykonywanie Promptów (RUN)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| RUN-001 | Wykonanie promptu - success | Krytyczny | E2E |
| RUN-002 | Wykonanie promptu - error handling | Krytyczny | E2E |
| RUN-003 | Wykonanie zapisuje run record | Krytyczny | Integration |
| RUN-004 | last_run_id jest aktualizowany | Wysoki | Integration |
| RUN-005 | Historia runów dla promptu | Wysoki | E2E |
| RUN-006 | Metadata: latency_ms, token_usage, model | Średni | Integration |
| RUN-007 | Status: pending → success | Średni | Integration |
| RUN-008 | Status: pending → error (z error_message) | Wysoki | Integration |
| RUN-009 | Timeout po 10s → status timeout | Średni | Integration |
| RUN-010 | Czas wykonania < 4s (P95) | Krytyczny | Performance |
| RUN-011 | OpenRouter API call (mocked) | Wysoki | Integration |
| RUN-012 | Event "run" jest zapisywany w run_events | Średni | Integration |

### 4.8 Workflow "Improve" (IMPROVE)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| IMP-001 | Click "Improve" → otrzymanie sugestii | Krytyczny | E2E |
| IMP-002 | Wybór sugestii i zapisanie jako nowa wersja | Krytyczny | E2E |
| IMP-003 | Edycja sugestii przed zapisaniem | Wysoki | E2E |
| IMP-004 | Event "improve" jest zapisywany | Średni | Integration |
| IMP-005 | Event "improve_saved" przy zapisaniu | Wysoki | Integration |
| IMP-006 | Wiele sugestii - wybór jednej | Średni | E2E |
| IMP-007 | Improve używa OpenRouter (mocked) | Wysoki | Integration |
| IMP-008 | Error handling przy improve | Wysoki | E2E |
| IMP-009 | KPI: improve_saved / improve ratio | Średni | Integration |

### 4.9 Row Level Security (RLS)

| ID | Scenariusz | Priorytet | Typ |
|----|-----------|-----------|-----|
| RLS-001 | User A nie widzi promptów User B | Krytyczny | Integration |
| RLS-002 | User A nie może edytować promptów User B | Krytyczny | Integration |
| RLS-003 | User A nie może usunąć promptów User B | Krytyczny | Integration |
| RLS-004 | Polityki RLS dla wszystkich tabel | Krytyczny | Integration |
| RLS-005 | Service role może bypass RLS | Średni | Integration |

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
- PostgreSQL: 15.x (Testcontainer)
- Przeglądarki: Chrome (latest), Firefox (latest), Webkit (latest)
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
| Test Runner | Jest | ^29.x | Testy jednostkowe i integracyjne |
| E2E Testing | Playwright | ^1.40 | Testy end-to-end |
| React Testing | React Testing Library | ^14.x | Testy komponentów React |
| API Testing | Supertest | ^6.x | Testy HTTP API |
| Mocking | MSW (Mock Service Worker) | ^2.x | Mockowanie requestów |
| Containers | Testcontainers | ^10.x | PostgreSQL dla testów |
| Coverage | Istanbul/NYC | ^15.x | Pokrycie kodu |
| Linting | ESLint | ^9.x | Analiza statyczna |
| Type Checking | TypeScript | ^5.x | Sprawdzanie typów |

### 6.2 Narzędzia Dodatkowe

| Kategoria | Narzędzie | Użycie |
|-----------|----------|--------|
| Performance | Lighthouse | Audyt wydajności i dostępności |
| Performance | k6 | Testy obciążeniowe |
| Security | npm audit | Skanowanie zależności |
| Security | OWASP ZAP | Testy penetracyjne |
| Security | Snyk | Ciągłe monitorowanie vulnerabilities |
| Accessibility | axe-core | Testy dostępności |
| Accessibility | Pa11y | Automatyczne testy WCAG |
| Visual Testing | Percy / Chromatic | Visual regression testing |
| Documentation | Storybook | Dokumentacja i testy komponentów |

### 6.3 CI/CD Pipeline

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
    - Coverage report (≥80%)
  
  integration-tests:
    - Testcontainers setup (PostgreSQL)
    - Apply migrations
    - Run integration tests
    - Teardown containers
  
  e2e-tests:
    - Playwright tests
    - 3 browsers (Chromium, Firefox, Webkit)
    - Upload test artifacts
  
  security:
    - npm audit
    - Snyk scan
  
  performance:
    - Lighthouse CI
    - Bundle size check
  
  accessibility:
    - axe-core tests
```

## 7. Harmonogram Testów

### 7.1 Faza 1: Przygotowanie (Tydzień 1-2)

**Działania**:
- [ ] Setup środowiska testowego
- [ ] Konfiguracja Jest + React Testing Library
- [ ] Konfiguracja Playwright
- [ ] Setup Testcontainers
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

**Cel pokrycia**: ≥80% dla testowanych modułów

**Odpowiedzialni**: Frontend Developer, Backend Developer

**Deliverables**:
- ~100-150 testów jednostkowych
- Coverage report

### 7.3 Faza 3: Testy Integracyjne (Tydzień 3-5)

**Priorytet 1 (Tydzień 3-4)**: Krytyczne ścieżki
- [ ] Auth integration tests (AUTH-INT-001 do 003)
- [ ] Prompt CRUD integration tests (PROMPT-INT-001 do 004)
- [ ] RLS integration tests (RLS-INT-001 do 002)
- [ ] Search integration tests (SEARCH-INT-001 do 003)

**Priorytet 2 (Tydzień 4-5)**: Pozostałe
- [ ] Tag integration tests
- [ ] Catalog integration tests
- [ ] Version integration tests
- [ ] Run integration tests

**Odpowiedzialni**: Backend Developer, QA Engineer

**Deliverables**:
- ~80-100 testów integracyjnych
- Dokumentacja testowanych scenariuszy

### 7.4 Faza 4: Testy E2E (Tydzień 5-7)

**Tydzień 5-6**: Implementacja testów
- [ ] E2E dla wszystkich User Stories (US-001 do US-030)
- [ ] Happy paths
- [ ] Error scenarios
- [ ] Edge cases

**Tydzień 7**: Stabilizacja i flaky tests
- [ ] Naprawa niestabilnych testów
- [ ] Optymalizacja czasu wykonania
- [ ] Retry strategies

**Odpowiedzialni**: QA Engineer, Frontend Developer

**Deliverables**:
- ~30-40 testów E2E
- Test report z coverage wszystkich user stories

### 7.5 Faza 5: Testy Specjalistyczne (Tydzień 7-8)

**Działania równoległe**:
- [ ] Performance testing (k6, Lighthouse)
- [ ] Security testing (OWASP ZAP, npm audit)
- [ ] Accessibility testing (axe-core, Pa11y)
- [ ] Visual regression testing

**Odpowiedzialni**: QA Engineer, Security Engineer (konsultacja)

**Deliverables**:
- Performance report
- Security audit report
- Accessibility compliance report
- Visual regression baseline

### 7.6 Faza 6: Regresja i Release (Tydzień 8-9)

**Działania**:
- [ ] Pełny regression test suite
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

### 7.7 Continuous Testing (Post-Release)

**Działania cykliczne**:
- Testy smoke po każdym deploymencie
- Regression tests przy każdym PR
- Weekly security scans
- Monthly performance audits
- Quarterly accessibility audits

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

**Testy Integracyjne**:
- ✅ Wszystkie API endpoints są pokryte
- ✅ Wszystkie triggery bazodanowe są przetestowane
- ✅ Row Level Security działa poprawnie
- ✅ Cascading deletes działają poprawnie

**Testy E2E**:
- ✅ Wszystkie user stories (US-001 do US-030) mają testy
- ✅ Happy paths są pokryte
- ✅ Error scenarios są pokryte
- ✅ Edge cases są pokryte

**Performance**:
- ✅ OpenRouter średni czas odpowiedzi < 4s
- ✅ Search < 1s dla 10k promptów
- ✅ Page load time < 3s (TTI)
- ✅ Lighthouse Performance score ≥ 90

**Security**:
- ✅ Wszystkie endpointy wymagają auth
- ✅ RLS blokuje cross-user access
- ✅ npm audit: 0 critical/high vulnerabilities
- ✅ Input validation blokuje injection

**Accessibility**:
- ✅ WCAG 2.1 AA compliance
- ✅ Keyboard navigation działa
- ✅ Screen reader compatibility
- ✅ Lighthouse Accessibility score ≥ 90

### 8.3 Definition of Done (DoD) dla Testów

Test jest uznany za "Done" gdy:
1. ✅ Test case jest napisany zgodnie ze standardem
2. ✅ Test przechodzi w lokalnym środowisku
3. ✅ Test przechodzi w CI/CD
4. ✅ Test jest deterministyczny (nie flaky)
5. ✅ Test ma jasny opis i assertion messages
6. ✅ Test jest zrecenzowany przez przynajmniej jedną osobę
7. ✅ Test jest udokumentowany (jeśli complex)
8. ✅ Test jest dodany do regression suite

## 9. Role i Odpowiedzialności

### 9.1 QA Engineer (Lead Tester)

**Odpowiedzialności**:
- Tworzenie i utrzymanie planu testów
- Koordynacja działań testowych
- Implementacja testów E2E (Playwright)
- Implementacja testów integracyjnych
- Raportowanie błędów i śledzenie progress
- Review test coverage
- Weryfikacja kryteriów akceptacji
- Finalna akceptacja przed release

**Deliverables**:
- Test plan
- Test cases documentation
- Test reports (daily, weekly, release)
- Bug reports
- Test automation scripts

### 9.2 Frontend Developer

**Odpowiedzialności**:
- Testy jednostkowe komponentów React
- Testy custom hooków
- Wsparcie przy testach E2E (selektory, test IDs)
- Naprawa bugów frontendowych
- Review testów frontendowych
- Optymalizacja wydajności frontendu

**Deliverables**:
- Unit tests dla komponentów
- Komponenty z data-testid attributes
- Bug fixes
- Performance optimizations

### 9.3 Backend Developer

**Odpowiedzialności**:
- Testy jednostkowe serwisów
- Testy jednostkowe walidatorów
- Testy integracyjne API routes
- Testy integracyjne bazy danych
- Naprawa bugów backendowych
- Review testów backendowych
- Optymalizacja zapytań SQL

**Deliverables**:
- Unit tests dla serwisów
- Integration tests dla API
- Database tests (triggers, RLS)
- Bug fixes
- Database optimizations

### 9.4 DevOps Engineer

**Odpowiedzialności**:
- Setup CI/CD pipeline
- Konfiguracja Testcontainers
- Setup środowisk testowych (staging)
- Monitorowanie performance testów
- Automatyzacja deploymentów
- Setup narzędzi security scanning

**Deliverables**:
- CI/CD pipeline configuration
- Testcontainers setup
- Staging environment
- Monitoring dashboards
- Security scanning integration

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

# Tylko integration tests
npm run test:integration

# Tylko E2E tests
npm run test:e2e

# Z coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Specific test file
npm test -- prompts-service.test.ts

# Update snapshots
npm test -- -u
```

#### Docker dla Testów

```bash
# Start test containers
docker-compose -f docker-compose.test.yml up -d

# Run migrations
npm run migrate:test

# Seed test data
npm run seed:test

# Stop test containers
docker-compose -f docker-compose.test.yml down -v
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
- [ ] All unit tests pass (≥80% coverage)
- [ ] All integration tests pass
- [ ] All E2E tests pass (all browsers)
- [ ] No flaky tests
- [ ] Performance tests pass (OpenRouter < 4s)
- [ ] Security scan clean (npm audit)
- [ ] Accessibility tests pass (Lighthouse ≥90)

### Functionality
- [ ] All user stories (US-001 to US-030) verified
- [ ] Authentication flow works
- [ ] Prompt CRUD works
- [ ] Search works
- [ ] Run prompt works
- [ ] Improve workflow works
- [ ] Version management works

### Database
- [ ] All migrations applied successfully
- [ ] Seed data loads correctly
- [ ] RLS policies working
- [ ] Triggers functioning
- [ ] Indexes created

### Security
- [ ] All API endpoints require auth
- [ ] RLS tested and working
- [ ] No exposed secrets in code
- [ ] HTTPS enforced
- [ ] Input validation working

### Performance
- [ ] Bundle size < 200KB (gzipped)
- [ ] Page load < 3s
- [ ] OpenRouter calls < 4s (P95)
- [ ] Search queries < 1s
- [ ] No memory leaks

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
- [ ] Monitoring configured

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

1. **Security & Authentication** (P0)
   - Row Level Security
   - API authentication
   - Input validation
   - OpenRouter key security

2. **Core Functionality** (P0)
   - Prompt CRUD
   - Run prompt
   - Improve workflow

3. **Data Integrity** (P0)
   - Versioning
   - Cascade deletes
   - Database triggers
   - Search vector updates

4. **User Experience** (P1)
   - Search functionality
   - Tags and catalogs
   - Error handling
   - Performance (< 4s OpenRouter)

5. **Quality Assurance** (P1)
   - Code coverage ≥ 80%
   - E2E coverage 100% user stories
   - Regression prevention

### 12.2 Success Criteria

Ten plan testów będzie uznany za sukces, gdy:

✅ **Jakość**:
- Zero P0 bugs w produkcji przez pierwszy miesiąc
- Test coverage ≥ 80% dla krytycznych modułów
- 100% user stories pokrytych testami E2E

✅ **Wydajność**:
- OpenRouter średni czas odpowiedzi < 4s
- Page load time < 3s
- Search latency < 1s dla 10k promptów

✅ **Bezpieczeństwo**:
- Zero critical/high security vulnerabilities
- RLS działa poprawnie (verified)
- Wszystkie endpointy chronione auth

✅ **KPI**:
- Improve-to-save rate ≥ 80%
- Prompt trial rate ≥ 70%
- OpenRouter error rate < 5%

✅ **Proces**:
- CI/CD pipeline fully automated
- Test execution time < 10 min (total)
- Bug MTTR: P0 < 24h, P1 < 72h

### 12.3 Continuous Improvement

Po wdrożeniu MVP, plan testów będzie ciągle ulepszany poprzez:

- **Retrospektywy**: Cotygodniowa analiza co działa, a co nie
- **Metrics Review**: Miesięczna analiza metryk testowych
- **Test Maintenance**: Regularne czyszczenie i refactoring testów
- **New Test Cases**: Dodawanie testów dla nowych bugów (regression prevention)
- **Performance Optimization**: Ciągła optymalizacja czasu wykonania testów
- **Tool Evaluation**: Kwartalna ocena nowych narzędzi testowych

---

**Dokument stworzony**: 8 grudnia 2024  
**Wersja**: 1.0  
**Status**: Draft for Review  
**Następna aktualizacja**: Po implementacji Fazy 1

