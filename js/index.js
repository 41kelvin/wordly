const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

const searchForm = document.getElementById('search-form');
const wordInput = document.getElementById('word-input');
const messageContainer = document.getElementById('message-container');
const resultsContainer = document.getElementById('results-container');
const favoritesGrid = document.getElementById('favorites-grid');
const favCountEl = document.getElementById('fav-count');
const themeToggle = document.getElementById('theme-toggle');

let favorites = loadFavorites();
let activeRequestController = null;

displayFavorites();
initTheme();

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = wordInput.value.trim();

  if (!query) {
    showError('Please enter a word.');
    return;
  }

  fetchDictionaryData(query);
});

// Search
async function fetchDictionaryData(word) {
  // Only the latest request should update the page.
  activeRequestController?.abort();
  const requestController = new AbortController();
  activeRequestController = requestController;
  showLoading();

  try {
    const response = await fetch(`${DICTIONARY_API_URL}${encodeURIComponent(word)}`, {
      signal: requestController.signal,
    });

    if (response.status === 404) {
      showError('We could not find that word. Check the spelling and try again.');
      return;
    }

    if (!response.ok) {
      throw new Error(`Dictionary request failed with status ${response.status}.`);
    }

    const data = await response.json();
    if (!Array.isArray(data) || !data[0] || typeof data[0] !== 'object') {
      throw new Error('The dictionary returned an unexpected response.');
    }

    displayWord(data[0]);
  } catch (error) {
    // Starting a new search aborts the previous one.
    if (error.name !== 'AbortError') {
      showError('Something went wrong while loading the definition. Please try again.');
    }
  } finally {
    if (activeRequestController === requestController) {
      activeRequestController = null;
    }
  }
}

// Results
function displayWord(entry) {
  clearMessages();
  resultsContainer.classList.remove('hidden');

  const word = typeof entry.word === 'string' && entry.word.trim()
    ? entry.word.trim()
    : 'Unknown word';
  const phoneticText = getPronunciationText(entry);
  const audioUrl = getAudioUrl(entry.phonetics);
  const isSaved = isFavorite(word);

  // API content is assigned through textContent rather than raw HTML.
  const card = document.createElement('article');
  card.className = 'card';

  const resultHeader = document.createElement('div');
  resultHeader.className = 'result-header';

  const headingGroup = document.createElement('div');
  const heading = document.createElement('h2');
  heading.className = 'result-word';
  heading.textContent = word;

  const phonetic = document.createElement('p');
  phonetic.className = 'phonetic-text';
  phonetic.textContent = phoneticText;
  headingGroup.append(heading, phonetic);

  const actions = document.createElement('div');
  actions.className = 'actions-group';

  if (audioUrl) {
    const audioButton = document.createElement('button');
    audioButton.type = 'button';
    audioButton.className = 'audio-btn';
    audioButton.setAttribute('aria-label', `Play the pronunciation of ${word}`);
    audioButton.textContent = '🔊 Pronounce';
    audioButton.addEventListener('click', () => playAudio(audioUrl));
    actions.append(audioButton);
  } else {
    const audioFallback = document.createElement('span');
    audioFallback.className = 'metadata-fallback audio-fallback';
    audioFallback.textContent = 'Audio unavailable';
    actions.append(audioFallback);
  }

  const favoriteButton = document.createElement('button');
  favoriteButton.type = 'button';
  favoriteButton.className = 'fav-action-btn';
  setFavoriteButtonState(favoriteButton, word, isSaved);
  favoriteButton.addEventListener('click', () => toggleFavorite(word, phoneticText));
  actions.append(favoriteButton);

  resultHeader.append(headingGroup, actions);
  card.append(resultHeader);

  const divider = document.createElement('hr');
  divider.className = 'divider';
  card.append(divider);

  const meaningsContainer = document.createElement('div');
  meaningsContainer.className = 'meanings-container';
  const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];

  if (meanings.length === 0) {
    const fallback = document.createElement('p');
    fallback.className = 'metadata-fallback content-fallback';
    fallback.textContent = 'No definitions are available for this word.';
    meaningsContainer.append(fallback);
  } else {
    meanings.forEach((meaning) => {
      meaningsContainer.append(createMeaningGroup(meaning));
    });
  }

  card.append(meaningsContainer);

  const sourceUrl = getFirstSafeUrl(entry.sourceUrls);
  if (sourceUrl) {
    const sourceContainer = document.createElement('div');
    sourceContainer.className = 'source-container';

    const sourceLink = document.createElement('a');
    sourceLink.href = sourceUrl;
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    sourceLink.className = 'source-link';
    sourceLink.textContent = 'Read Source Document ↗';
    sourceContainer.append(sourceLink);
    card.append(sourceContainer);
  }

  resultsContainer.replaceChildren(card);
}

function createMeaningGroup(meaning) {
  const group = document.createElement('section');
  group.className = 'pos-group';

  const partOfSpeech = document.createElement('h3');
  partOfSpeech.className = 'pos-tag';
  partOfSpeech.textContent = typeof meaning.partOfSpeech === 'string' && meaning.partOfSpeech
    ? meaning.partOfSpeech
    : 'Word type not listed';
  group.append(partOfSpeech);

  // Keep long entries scannable.
  const definitions = Array.isArray(meaning.definitions)
    ? meaning.definitions.slice(0, 3)
    : [];

  if (definitions.length === 0) {
    const fallback = document.createElement('p');
    fallback.className = 'metadata-fallback';
    fallback.textContent = 'No definitions are listed for this word type.';
    group.append(fallback);
  } else {
    definitions.forEach((definition) => {
      const item = document.createElement('div');
      item.className = 'definition-item';

      const definitionText = document.createElement('p');
      definitionText.className = 'definition-main';
      definitionText.textContent = typeof definition.definition === 'string'
        ? definition.definition
        : 'Definition unavailable.';
      item.append(definitionText);

      if (typeof definition.example === 'string' && definition.example.trim()) {
        const example = document.createElement('p');
        example.className = 'example-text';
        example.textContent = `“${definition.example.trim()}”`;
        item.append(example);
      }

      group.append(item);
    });
  }

  // The API can provide synonyms at either level.
  const synonyms = collectSynonyms(meaning);
  const synonymsBox = document.createElement('div');
  synonymsBox.className = `synonyms-box${synonyms.length === 0 ? ' is-empty' : ''}`;

  const synonymsLabel = document.createElement('strong');
  synonymsLabel.textContent = 'Synonyms:';
  synonymsBox.append(synonymsLabel);
  synonymsBox.append(document.createTextNode(
    synonyms.length > 0 ? synonyms.slice(0, 5).join(', ') : ' None listed.',
  ));
  group.append(synonymsBox);

  return group;
}

function collectSynonyms(meaning) {
  const meaningSynonyms = Array.isArray(meaning.synonyms) ? meaning.synonyms : [];
  const definitionSynonyms = Array.isArray(meaning.definitions)
    ? meaning.definitions.flatMap((definition) => (
      Array.isArray(definition.synonyms) ? definition.synonyms : []
    ))
    : [];
  const seen = new Set();

  return [...meaningSynonyms, ...definitionSynonyms].filter((synonym) => {
    if (typeof synonym !== 'string' || !synonym.trim()) return false;
    const key = synonym.trim().toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((synonym) => synonym.trim());
}

function getPronunciationText(entry) {
  if (typeof entry.phonetic === 'string' && entry.phonetic.trim()) {
    return entry.phonetic.trim();
  }

  const phoneticEntry = Array.isArray(entry.phonetics)
    ? entry.phonetics.find((item) => typeof item.text === 'string' && item.text.trim())
    : null;
  return phoneticEntry ? phoneticEntry.text.trim() : 'Pronunciation unavailable.';
}

function getAudioUrl(phonetics) {
  if (!Array.isArray(phonetics)) return null;
  const audioEntry = phonetics.find((item) => typeof item.audio === 'string' && item.audio.trim());
  return audioEntry ? getSafeUrl(audioEntry.audio) : null;
}

function getFirstSafeUrl(urls) {
  if (!Array.isArray(urls)) return null;
  for (const url of urls) {
    const safeUrl = getSafeUrl(url);
    if (safeUrl) return safeUrl;
  }
  return null;
}

function getSafeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const url = new URL(value.trim(), DICTIONARY_API_URL);
    // Reject javascript: and other non-web protocols.
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

// Favorites
function loadFavorites() {
  const storedFavorites = getStorageItem('wordly_favorites');
  if (!storedFavorites) return [];

  try {
    const parsedFavorites = JSON.parse(storedFavorites);
    if (!Array.isArray(parsedFavorites)) return [];

    return parsedFavorites
      .filter((favorite) => favorite && typeof favorite.word === 'string' && favorite.word.trim())
      .map((favorite) => ({
        word: favorite.word.trim(),
        phonetic: typeof favorite.phonetic === 'string' ? favorite.phonetic : '',
      }));
  } catch {
    return [];
  }
}

function toggleFavorite(word, phonetic) {
  const index = favorites.findIndex(
    (favorite) => favorite.word.toLocaleLowerCase() === word.toLocaleLowerCase(),
  );

  if (index > -1) {
    favorites.splice(index, 1);
  } else {
    favorites.push({ word, phonetic });
  }

  if (!setStorageItem('wordly_favorites', JSON.stringify(favorites))) {
    showError('Your favorite could not be saved in this browser.');
  }

  displayFavorites();
  const favoriteButton = resultsContainer.querySelector('.fav-action-btn');
  const displayedWord = resultsContainer.querySelector('.result-word')?.textContent.trim();
  if (favoriteButton && displayedWord) {
    setFavoriteButtonState(favoriteButton, displayedWord, isFavorite(displayedWord));
  }
}

function isFavorite(word) {
  return favorites.some(
    (favorite) => favorite.word.toLocaleLowerCase() === word.toLocaleLowerCase(),
  );
}

function setFavoriteButtonState(button, word, saved) {
  button.classList.toggle('active', saved);
  button.setAttribute('aria-pressed', String(saved));
  button.setAttribute('aria-label', `${saved ? 'Remove' : 'Save'} ${word} ${saved ? 'from' : 'to'} favorites`);
  button.textContent = saved ? '★ Saved' : '☆ Save';
}

function displayFavorites() {
  favCountEl.textContent = favorites.length;

  if (favorites.length === 0) {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';

    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = 'No favorite words saved yet.';
    emptyState.append(emptyMessage);
    favoritesGrid.replaceChildren(emptyState);
    return;
  }

  const cards = favorites.map((favorite) => {
    const card = document.createElement('div');
    card.className = 'fav-card';

    const searchButton = document.createElement('button');
    searchButton.type = 'button';
    searchButton.className = 'fav-card-content';
    searchButton.setAttribute('aria-label', `Search for ${favorite.word}`);
    searchButton.addEventListener('click', () => executeSearch(favorite.word));

    const word = document.createElement('span');
    word.className = 'fav-word';
    word.textContent = favorite.word;

    const phonetic = document.createElement('span');
    phonetic.className = 'fav-phonetic';
    phonetic.textContent = favorite.phonetic || 'Pronunciation unavailable.';
    searchButton.append(word, phonetic);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'fav-remove-btn';
    removeButton.setAttribute('aria-label', `Remove ${favorite.word} from favorites`);
    removeButton.textContent = '×';
    removeButton.addEventListener('click', () => toggleFavorite(favorite.word, favorite.phonetic));

    card.append(searchButton, removeButton);
    return card;
  });

  favoritesGrid.replaceChildren(...cards);
}

function executeSearch(word) {
  wordInput.value = word;
  fetchDictionaryData(word);
}

// Status messages
function showLoading() {
  resultsContainer.classList.add('hidden');
  const loader = document.createElement('div');
  loader.className = 'spinner-loader';
  loader.textContent = 'Looking up definitions...';
  messageContainer.replaceChildren(loader);
}

function showError(message) {
  resultsContainer.classList.add('hidden');
  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.setAttribute('role', 'alert');
  banner.textContent = message;
  messageContainer.replaceChildren(banner);
}

function clearMessages() {
  messageContainer.replaceChildren();
}

async function playAudio(url) {
  try {
    await new Audio(url).play();
  } catch {
    showError('Audio playback is restricted or unavailable.');
  }
}

// Theme
function initTheme() {
  const savedTheme = getStorageItem('wordly_theme');
  const theme = savedTheme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeButton(theme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    setStorageItem('wordly_theme', newTheme);
    updateThemeButton(newTheme);
  });
}

function updateThemeButton(theme) {
  const isDark = theme === 'dark';
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} display mode`);
}

function getStorageItem(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setStorageItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
