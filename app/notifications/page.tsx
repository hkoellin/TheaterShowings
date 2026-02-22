'use client';

import { useState, useEffect, useCallback } from 'react';

interface Preference {
  id?: string;
  type: 'director' | 'film' | 'actor';
  value: string;
}

interface Subscriber {
  id: string;
  email: string;
  name: string | null;
  active: boolean;
  preferences: Preference[];
}

interface ShowtimeResult {
  id: string;
  film: string;
  theater: string;
  date: string;
  time: string;
  ticketUrl: string;
  description?: string;
  allTimes?: string[];
}

interface MatchedFilm {
  film: string;
  matchedBy: string; // e.g. "director: Sean Baker"
  showtimes: ShowtimeResult[];
}

const PREF_TYPES = [
  { value: 'director' as const, label: 'Director', placeholder: 'e.g., Martin Scorsese' },
  { value: 'film' as const, label: 'Film Title', placeholder: 'e.g., Taxi Driver' },
  { value: 'actor' as const, label: 'Actor', placeholder: 'e.g., Robert De Niro' },
];

const PREF_COLORS: Record<string, string> = {
  director: 'bg-purple-50 text-purple-700 border-purple-200',
  film: 'bg-blue-50 text-blue-700 border-blue-200',
  actor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

/** Client-side matching — same logic as lib/matcher.ts */
function findClientMatches(showtimes: ShowtimeResult[], preferences: Preference[]): MatchedFilm[] {
  // Map: film name → { matchedBy set, showtimes[] }
  const filmMap = new Map<string, { matchedBy: Set<string>; showtimes: ShowtimeResult[] }>();

  for (const st of showtimes) {
    const filmLower = st.film.toLowerCase();
    const descLower = (st.description || '').toLowerCase();
    const combined = `${filmLower} ${descLower}`;

    for (const pref of preferences) {
      const valueLower = pref.value.toLowerCase();
      let matched = false;

      switch (pref.type) {
        case 'film':
          matched = filmLower.includes(valueLower);
          break;
        case 'director':
          matched = combined.includes(valueLower);
          break;
        case 'actor':
          matched = descLower.includes(valueLower);
          break;
      }

      if (matched) {
        const key = st.film;
        if (!filmMap.has(key)) {
          filmMap.set(key, { matchedBy: new Set(), showtimes: [] });
        }
        const entry = filmMap.get(key)!;
        entry.matchedBy.add(`${pref.type}: ${pref.value}`);
        // Avoid duplicate showtime entries (same id)
        if (!entry.showtimes.some(s => s.id === st.id)) {
          entry.showtimes.push(st);
        }
      }
    }
  }

  return Array.from(filmMap.entries()).map(([film, data]) => ({
    film,
    matchedBy: Array.from(data.matchedBy).join(', '),
    showtimes: data.showtimes.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)),
  }));
}

export default function NotificationsPage() {
  // Lookup state
  const [lookupEmail, setLookupEmail] = useState('');
  const [subscriber, setSubscriber] = useState<Subscriber | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [newPrefType, setNewPrefType] = useState<'director' | 'film' | 'actor'>('director');
  const [newPrefValue, setNewPrefValue] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Matches state
  const [matches, setMatches] = useState<MatchedFilm[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);

  // Fetch showtimes and run matching against current preferences
  const fetchMatches = useCallback(async (prefs: Preference[]) => {
    if (prefs.length === 0) {
      setMatches([]);
      return;
    }
    setMatchesLoading(true);
    try {
      const res = await fetch('/api/showtimes');
      if (res.ok) {
        const data = await res.json();
        const found = findClientMatches(data.showtimes, prefs);
        setMatches(found);
      }
    } catch {
      console.error('Failed to fetch showtimes for matching');
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  // Check URL for email param (from notification email links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const emailParam = params.get('email');
    if (emailParam) {
      setLookupEmail(emailParam);
    }
  }, []);

  // Auto-lookup when email param is present
  const handleLookup = useCallback(async (emailToLookup: string) => {
    if (!emailToLookup) return;
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/subscribers?email=${encodeURIComponent(emailToLookup)}`);
      if (res.ok) {
        const data = await res.json();
        setSubscriber(data.subscriber);
        setEmail(data.subscriber.email);
        setName(data.subscriber.name || '');
        const prefs = data.subscriber.preferences.map((p: Preference) => ({
          type: p.type,
          value: p.value,
        }));
        setPreferences(prefs);
        setIsNewUser(false);
        // Auto-fetch matching showtimes
        fetchMatches(prefs);
      } else if (res.status === 404) {
        setSubscriber(null);
        setEmail(emailToLookup);
        setName('');
        setPreferences([]);
        setIsNewUser(true);
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to look up subscriber' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (lookupEmail) {
      handleLookup(lookupEmail);
    }
  }, [lookupEmail, handleLookup]);

  const addPreference = () => {
    if (!newPrefValue.trim()) return;
    // Don't add duplicates
    if (preferences.some(p => p.type === newPrefType && p.value.toLowerCase() === newPrefValue.trim().toLowerCase())) {
      setMessage({ type: 'error', text: 'This preference already exists' });
      return;
    }
    setPreferences([...preferences, { type: newPrefType, value: newPrefValue.trim() }]);
    setNewPrefValue('');
  };

  const removePreference = (index: number) => {
    setPreferences(preferences.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || preferences.length === 0) {
      setMessage({ type: 'error', text: 'Email and at least one preference are required' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      if (subscriber) {
        // Update existing subscriber
        const res = await fetch(`/api/subscribers/${subscriber.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name || null, preferences }),
        });
        if (res.ok) {
          const data = await res.json();
          setSubscriber(data.subscriber);
          setMessage({ type: 'success', text: 'Preferences updated!' });
          // Refresh matching showtimes
          fetchMatches(preferences);
        } else {
          setMessage({ type: 'error', text: 'Failed to update preferences' });
        }
      } else {
        // Create new subscriber
        const res = await fetch('/api/subscribers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name: name || null, preferences }),
        });
        if (res.ok) {
          const data = await res.json();
          setSubscriber(data.subscriber);
          setIsNewUser(false);
          setMessage({ type: 'success', text: 'Subscribed! You\'ll get notified when matching films are showing.' });
          // Fetch matching showtimes for the new subscriber
          fetchMatches(preferences);
        } else {
          const data = await res.json();
          setMessage({ type: 'error', text: data.error || 'Failed to subscribe' });
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!subscriber) return;
    if (!confirm('Are you sure you want to unsubscribe?')) return;

    setLoading(true);
    try {
      await fetch(`/api/subscribers/${subscriber.id}`, { method: 'DELETE' });
      setSubscriber(null);
      setEmail('');
      setName('');
      setPreferences([]);
      setMatches([]);
      setLookupEmail('');
      setIsNewUser(false);
      setMessage({ type: 'success', text: 'You\'ve been unsubscribed.' });
    } catch {
      setMessage({ type: 'error', text: 'Failed to unsubscribe' });
    } finally {
      setLoading(false);
    }
  };

  // Initial state: ask for email
  const showLookup = !subscriber && !isNewUser;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-6 flex items-center justify-between">
          <div>
            <a href="/" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">← Back to showtimes</a>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Notifications</h1>
            <p className="text-sm text-gray-500 mt-1">
              Get emailed when your favorite directors, films, or actors are showing in NYC.
            </p>
          </div>
          <span className="text-3xl">🔔</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Message banner */}
        {message && (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}

        {/* Step 1: Email lookup */}
        {showLookup && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Enter your email</h2>
            <p className="text-sm text-gray-500 mb-4">
              We&apos;ll check if you already have a profile, or create a new one.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); handleLookup(lookupEmail); }} className="flex gap-3">
              <input
                type="email"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Profile form */}
        {(subscriber || isNewUser) && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email & Name */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                {subscriber ? 'Your Profile' : 'Create Profile'}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    readOnly={!!subscriber}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm ${
                      subscriber ? 'bg-gray-50 text-gray-500' : 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name (optional)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Preferences */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Preferences</h2>
              <p className="text-sm text-gray-500 mb-4">
                Add directors, film titles, or actors you want to be notified about.
              </p>

              {/* Current preferences */}
              {preferences.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {preferences.map((pref, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${PREF_COLORS[pref.type]}`}
                    >
                      <span className="text-xs opacity-70">{pref.type}:</span>
                      {pref.value}
                      <button
                        type="button"
                        onClick={() => removePreference(i)}
                        className="ml-1 hover:opacity-70 transition-opacity"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Add preference */}
              <div className="flex gap-2">
                <select
                  value={newPrefType}
                  onChange={(e) => setNewPrefType(e.target.value as 'director' | 'film' | 'actor')}
                  className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {PREF_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newPrefValue}
                  onChange={(e) => setNewPrefValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPreference(); }}}
                  placeholder={PREF_TYPES.find(t => t.value === newPrefType)?.placeholder}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={addPreference}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                type="submit"
                disabled={loading || preferences.length === 0}
                className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Saving...' : subscriber ? 'Update Preferences' : 'Subscribe'}
              </button>

              {subscriber && (
                <button
                  type="button"
                  onClick={handleUnsubscribe}
                  className="text-sm text-red-600 hover:text-red-700 transition-colors"
                >
                  Unsubscribe
                </button>
              )}
            </div>
          </form>
        )}

        {/* Matching Showtimes */}
        {(subscriber || isNewUser) && preferences.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Matching Showtimes</h2>
                <p className="text-sm text-gray-500 mt-0.5">Current NYC showings that match your preferences</p>
              </div>
              {!matchesLoading && matches.length > 0 && (
                <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                  {matches.length} film{matches.length !== 1 ? 's' : ''} found
                </span>
              )}
            </div>

            {matchesLoading ? (
              <div className="py-8 text-center">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
                <p className="text-sm text-gray-500 mt-3">Searching theaters...</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-2xl mb-2">🎬</p>
                <p className="text-sm text-gray-500">
                  {subscriber
                    ? 'No current showings match your preferences. We\'ll email you when something comes up!'
                    : 'Save your preferences to see matching showtimes.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {matches.map((match) => (
                  <div key={match.film} className="border border-gray-100 rounded-lg overflow-hidden">
                    {/* Film header */}
                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-900">{match.film}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Matched by {match.matchedBy}</p>
                    </div>
                    {/* Showtime rows */}
                    <div className="divide-y divide-gray-50">
                      {match.showtimes.map((st) => (
                        <div key={st.id} className="px-4 py-2.5 flex items-center justify-between text-sm hover:bg-gray-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-gray-900 font-medium w-24">
                              {new Date(st.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                            <span className="text-gray-600">{st.allTimes ? st.allTimes.join(', ') : st.time}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500 text-xs">{st.theater}</span>
                            {st.ticketUrl && (
                              <a
                                href={st.ticketUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                              >
                                Tickets →
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* How it works */}
        <div className="mt-12 text-center">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">How it works</h3>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-2xl mb-2">✍️</div>
              <p className="text-sm text-gray-600">Add your favorite directors, films, or actors</p>
            </div>
            <div>
              <div className="text-2xl mb-2">🔍</div>
              <p className="text-sm text-gray-600">We check NYC theater schedules daily</p>
            </div>
            <div>
              <div className="text-2xl mb-2">📧</div>
              <p className="text-sm text-gray-600">Get emailed when there&apos;s a match</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
