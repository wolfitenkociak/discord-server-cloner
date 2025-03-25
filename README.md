# Discord Server Cloner

Ten skrypt pozwala na skopiowanie całego serwera Discord wraz z kanałami, rolami i uprawnieniami do innego serwera.

## Wymagania

- Node.js 16 lub nowszy
- npm lub yarn
- Token użytkownika Discord (nie bot token)
- Dwa serwery Discord:
    - Serwer źródłowy (który chcesz skopiować)
    - Serwer docelowy (pusty serwer, do którego będą skopiowane wszystkie elementy)

## Instalacja

1. Zainstaluj zależności:

```bash
pnpm install
```

2. Skopiuj plik `.env.example` do `.env` i uzupełnij wymagane dane:

```bash
cp .env.example .env
```

Następnie edytuj plik `.env` i uzupełnij:

```
DISCORD_TOKEN=twój_token_uzytkownika
SOURCE_GUILD_ID=id_serwera_źródłowego
TARGET_GUILD_ID=id_serwera_docelowego
```

Aby uzyskać ID serwera:

1. Włącz tryb dewelopera w Discord (Ustawienia -> Zaawansowane -> Tryb dewelopera)
2. Kliknij prawym przyciskiem myszy na serwer i wybierz "Kopiuj ID"

## Jak uzyskać token Discord?

### Metoda 1 - Z konsoli przeglądarki:

1. Otwórz Discord w przeglądarce
2. Naciśnij F12 aby otworzyć narzędzia deweloperskie
3. Przejdź do zakładki "Console"
4. Wklej poniższy kod i naciśnij Enter:

```javascript
(webpackChunkdiscord_app.push([
    [""],
    {},
    (e) => {
        m = [];
        for (let c in e.c) m.push(e.c[c]);
    },
]),
m)
    .find((m) => m?.exports?.default?.getToken !== void 0)
    .exports.default.getToken();
```

### Metoda 2 - Z localStorage:

1. Otwórz Discord w przeglądarce
2. Naciśnij F12 aby otworzyć narzędzia deweloperskie
3. Przejdź do zakładki "Application" (lub "Aplikacja")
4. Rozwiń "Local Storage" po lewej stronie
5. Kliknij na "https://discord.com"
6. Znajdź klucz "token" i skopiuj jego wartość

## Użycie

Po skonfigurowaniu pliku `.env`, możesz uruchomić skrypt:

```bash
pnpm run dev
```

Skrypt automatycznie:

1. Usunie wszystkie istniejące kanały i role z serwera docelowego
2. Skopiuje wszystkie role (z wyjątkiem @everyone)
3. Skopiuje wszystkie kategorie i kanały wraz z uprawnieniami
4. Skopiuje nazwę i ikonę serwera

## Uwagi

- Upewnij się, że masz odpowiednie uprawnienia na obu serwerach
- Wszystkie istniejące kanały i role na serwerze docelowym zostaną usunięte
- Skrypt kopiuje:
    - Role (z uprawnieniami, kolorami i innymi ustawieniami)
    - Kategorie
    - Kanały tekstowe i głosowe
    - Uprawnienia dla ról i użytkowników
    - Nazwę i ikonę serwera
- @everyone rola nie jest kopiowana
