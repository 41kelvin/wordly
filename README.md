# Wordly

Wordly is a small, single-page dictionary for looking up definitions, examples, pronunciations, and synonyms. Favorite words are saved in the browser for later.

## Features

- Definitions, examples, synonyms, and pronunciation audio
- Favorites and theme preferences stored in `localStorage`
- Light and dark themes
- Keyboard-friendly controls and live status messages
- Clear handling for missing words and network errors

## Built With

- HTML
- Modular CSS
- Vanilla JavaScript
- Fetch API
- [Free Dictionary API](https://dictionaryapi.dev/)


## Run Locally

Clone the repository:

```bash
git clone https://github.com/41kelvin/wordly.git
cd wordly
```

Then start a local server:

Then open `http://localhost:8000` in a browser.

## Project Structure

```text
wordly/
├── index.html
├── js/
│   └── index.js
└── css/
    ├── style.css
    ├── base/
    │   ├── reset.css
    │   └── theme.css
    └── components/
        ├── favorites.css
        ├── results.css
        └── search.css
```

## Data and Privacy

Searches are sent to the Free Dictionary API. Favorite words and the selected theme are stored only in the browser's local storage.
