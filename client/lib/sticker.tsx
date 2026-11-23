/**
 * ═══════════════════════════════════════════════════════════════════════════
 * stickers.js — Likeson Healthcare Chat
 * Powered by GIPHY SDK (same API used by WhatsApp, Slack, Instagram, FB)
 *
 * Packages required:
 *   npm i @giphy/js-fetch-api @giphy/react-components
 *
 * .env:
 *   NEXT_PUBLIC_GIPHY_API_KEY=your_web_sdk_key_here
 *   (Get free key → https://developers.giphy.com → Create App → Web SDK)
 *
 * Compatible with Message.js schema:
 *   type        : 'sticker'
 *   content     : sticker title / alt label
 *   attachments : [{ url, thumbnailUrl, mimeType: 'image/webp', ... }]
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { GiphyFetch } from '@giphy/js-fetch-api';

// ─────────────────────────────────────────────────────────────────────────────
// GIPHY CLIENT  (singleton — one instance per app)
// ─────────────────────────────────────────────────────────────────────────────

const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY || '';

if (!GIPHY_KEY && typeof window !== 'undefined') {
  console.warn(
    '[Likeson Chat] NEXT_PUBLIC_GIPHY_API_KEY is not set. ' +
    'Stickers will not load. Get a free key at https://developers.giphy.com'
  );
}

/** Single GiphyFetch instance — share across the whole app */
export const gf = new GiphyFetch(GIPHY_KEY);

// ─────────────────────────────────────────────────────────────────────────────
// STICKER CATEGORIES  (tab bar in picker UI)
// Each category maps to a GIPHY search tag.
// tag: null  → uses gf.trending() instead of gf.search()
// ─────────────────────────────────────────────────────────────────────────────

export const STICKER_CATEGORIES = [
  { id: 'trending',     label: 'Trending',     icon: '🔥', tag: null            },
  { id: 'reactions',    label: 'Reactions',    icon: '😂', tag: 'reaction'      },
  { id: 'greetings',    label: 'Greetings',    icon: '👋', tag: 'hello'         },
  { id: 'love',         label: 'Love',         icon: '❤️', tag: 'love'          },
  { id: 'funny',        label: 'Funny',        icon: '😜', tag: 'funny'         },
  { id: 'sad',          label: 'Sad',          icon: '😢', tag: 'sad'           },
  { id: 'celebrate',    label: 'Celebrate',    icon: '🎉', tag: 'celebrate'     },
  { id: 'thanks',       label: 'Thanks',       icon: '🙏', tag: 'thank you'     },
  { id: 'sorry',        label: 'Sorry',        icon: '🥺', tag: 'sorry'         },
  { id: 'good-morning', label: 'Morning',      icon: '☀️', tag: 'good morning'  },
  { id: 'good-night',   label: 'Night',        icon: '🌙', tag: 'good night'    },
  { id: 'food',         label: 'Food',         icon: '🍕', tag: 'food'          },
  { id: 'animals',      label: 'Animals',      icon: '🐶', tag: 'animals'       },
  { id: 'sports',       label: 'Sports',       icon: '⚽', tag: 'sports'        },
  { id: 'work',         label: 'Work',         icon: '💼', tag: 'work'          },
  { id: 'ok',           label: 'OK',           icon: '✅', tag: 'ok'            },
  { id: 'no',           label: 'No',           icon: '❌', tag: 'no'            },
  { id: 'yes',          label: 'Yes',          icon: '👍', tag: 'yes'           },
  { id: 'excited',      label: 'Excited',      icon: '🤩', tag: 'excited'       },
  { id: 'angry',        label: 'Angry',        icon: '😡', tag: 'angry'         },
];

// ─────────────────────────────────────────────────────────────────────────────
// GIPHY FETCH FUNCTIONS
// All return a GifsResult Promise — pass directly to @giphy/react-components Grid
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch trending stickers.
 * Use for the default "Trending" tab and initial picker load.
 *
 * @param {number} offset  - pagination offset (increments of `limit`)
 * @param {number} limit   - stickers per page (default 24)
 * @returns {Promise<GifsResult>}
 */
export const fetchTrendingStickers = (offset = 0, limit = 24) =>
  gf.trending({ type: 'stickers', offset, limit, rating: 'g' });

/**
 * Search stickers by keyword.
 * Use for all category tabs and the search input.
 *
 * @param {string} query   - e.g. 'happy', 'hello', 'love'
 * @param {number} offset
 * @param {number} limit
 * @returns {Promise<GifsResult>}
 */
export const fetchStickersByQuery = (query, offset = 0, limit = 24) =>
  gf.search(query, { type: 'stickers', offset, limit, rating: 'g', lang: 'en' });

/**
 * Fetch stickers for a specific category tab.
 * Automatically uses trending() for the 'trending' tab, search() for all others.
 *
 * @param {string} categoryId  - matches STICKER_CATEGORIES[].id
 * @param {number} offset
 * @param {number} limit
 * @returns {Promise<GifsResult>}
 */
export const fetchStickersByCategory = (categoryId, offset = 0, limit = 24) => {
  const category = STICKER_CATEGORIES.find(c => c.id === categoryId);
  if (!category || category.tag === null) return fetchTrendingStickers(offset, limit);
  return fetchStickersByQuery(category.tag, offset, limit);
};

/**
 * Fetch a single random sticker.
 * Great for "Surprise Me" / random sticker button.
 *
 * @param {string} [tag]  - optional tag to constrain randomness (e.g. 'happy')
 * @returns {Promise<RandomGifResult>}
 */
export const fetchRandomSticker = (tag = '') =>
  gf.random({ type: 'stickers', tag, rating: 'g' });

/**
 * Fetch GIPHY's animated emoji stickers.
 * Fully animated versions of standard emoji — perfect for the emoji tab.
 *
 * @param {number} offset
 * @param {number} limit
 * @returns {Promise<GifsResult>}
 */
export const fetchAnimatedEmoji = (offset = 0, limit = 48) =>
  gf.emoji({ offset, limit });

/**
 * Fetch stickers related to a given GIPHY gif id.
 * Use on long-press / "More like this" in the picker.
 *
 * @param {string} gifId
 * @param {number} offset
 * @param {number} limit
 * @returns {Promise<GifsResult>}
 */
export const fetchRelatedStickers = (gifId, offset = 0, limit = 12) =>
  gf.related(gifId, { type: 'stickers', offset, limit });

// ─────────────────────────────────────────────────────────────────────────────
// IGif → Message attachment converter
// Converts a GIPHY IGif object into the shape expected by
// POST /api/chat/conversations/:id/messages  (Message.js attachmentSchema)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the best available sticker URL from a GIPHY IGif object.
 * GIPHY recommends WEBP for stickers — smallest file, best quality, transparent bg.
 *
 * Priority: fixed_height.webp → fixed_height.url → downsized.url → original.url
 *
 * @param {import('@giphy/js-types').IGif} gif
 * @returns {{ url: string, thumbnailUrl: string, width: number, height: number }}
 */
export function extractStickerUrls(gif) {
  const images = gif.images;

  const url =
    images?.fixed_height?.webp      ||
    images?.fixed_height?.url        ||
    images?.downsized?.url           ||
    images?.original?.url            ||
    '';

  const thumbnailUrl =
    images?.fixed_height_small?.webp ||
    images?.fixed_height_small?.url  ||
    images?.preview?.url             ||
    url;

  const width  = Number(images?.fixed_height?.width  || images?.original?.width  || 0);
  const height = Number(images?.fixed_height?.height || images?.original?.height || 0);

  return { url, thumbnailUrl, width, height };
}

/**
 * Build the full message payload for sending a sticker via the chat API.
 * Pass the returned object directly to Redux sendMessage thunk
 * or POST /api/chat/conversations/:id/messages.
 *
 * @param {string}                          conversationId
 * @param {import('@giphy/js-types').IGif}  gif            - IGif from GIPHY SDK
 * @param {string|null}                     [replyTo]      - optional parent message _id
 * @returns {{
 *   conversationId: string,
 *   type: 'sticker',
 *   content: string,
 *   attachments: Array,
 *   replyTo: string|null
 * }}
 */
export function buildStickerMessagePayload(conversationId, gif, replyTo = null) {
  const { url, thumbnailUrl, width, height } = extractStickerUrls(gif);

  return {
    conversationId,
    type:    'sticker',
    content: gif.title || gif.slug || 'sticker',
    attachments: [
      {
        url,
        thumbnailUrl,
        originalName: `${gif.id}.webp`,
        mimeType:     'image/webp',
        size:         0,
        width,
        height,
      },
    ],
    replyTo,
    // Preserve GIPHY ID for analytics pingbacks (GIPHY ToS requirement)
    _giphyMeta: { id: gif.id, url: gif.url },
  };
}

/**
 * Send the GIPHY analytics pingback after a user selects or sends a sticker.
 * ⚠️  REQUIRED by GIPHY Terms of Service.
 * Fire-and-forget — never awaited in the critical path.
 *
 * @param {import('@giphy/js-types').IGif} gif
 * @param {'click'|'send'|'view'} action
 */
export function sendGiphyAnalytics(gif, action = 'send') {
  try {
    const analyticsUrl = gif?.analytics?.[action]?.url;
    if (analyticsUrl) fetch(analyticsUrl).catch(() => {});
  } catch {
    // Never throw — non-critical side effect
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EMOJI CATEGORIES  (50+ real Unicode emoji for message reactions)
// Maps to Message.reactions[]: { user, emoji, reactedAt }
// ─────────────────────────────────────────────────────────────────────────────

export const EMOJI_CATEGORIES = [
  {
    id:     'quick',
    label:  'Quick React',
    icon:   '⚡',
    // These 8 appear in the message hover toolbar (WhatsApp-style quick react)
    emojis: ['👍','❤️','😂','😮','😢','😡','🙏','🔥'],
  },
  {
    id:     'smileys',
    label:  'Smileys',
    icon:   '😀',
    emojis: [
      '😀','😃','😄','😁','😆','😅','🤣','😂',
      '🙂','🙃','😉','😊','😇','🥰','😍','🤩',
      '😘','😗','😚','😙','🥲','😋','😛','😜',
      '🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡',
      '🤐','🤨','😐','😑','😶','🫥','😏','😒',
      '🙄','😬','🤥','😌','😔','😪','🤤','😴',
    ],
  },
  {
    id:     'expressions',
    label:  'Expressions',
    icon:   '😢',
    emojis: [
      '😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶',
      '🥴','😵','😵‍💫','🤯','🤠','🥳','🥸','😎',
      '🤓','🧐','😕','🫤','😟','🙁','☹️','😮',
      '😯','😲','😳','🥺','🫣','😦','😧','😨',
      '😰','😥','😢','😭','😱','😖','😣','😞',
      '😓','😩','😫','🥱','😤','😠','😡','🤬',
      '😈','👿','💀','☠️','💩','🤡','👹','👺',
      '👻','👽','👾','🤖',
    ],
  },
  {
    id:     'gestures',
    label:  'Gestures',
    icon:   '👋',
    emojis: [
      '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳',
      '🫴','🫷','🫸','👌','🤌','🤏','✌️','🤞',
      '🫰','🤟','🤘','🤙','👈','👉','👆','🖕',
      '👇','☝️','🫵','👍','👎','✊','👊','🤛',
      '🤜','👏','🙌','🫶','👐','🤲','🤝','🙏',
      '✍️','💅','🤳','💪','🦾',
    ],
  },
  {
    id:     'people',
    label:  'People',
    icon:   '🧑',
    emojis: [
      '🧑','👶','🧒','👦','👧','👱','👨','🧔',
      '👩','🧓','👴','👵','🙍','🙎','🙅','🙆',
      '💁','🙋','🧏','🙇','🤦','🤷','👮','🕵️',
      '💂','🥷','👷','🤴','👸','👳','👲','🧕',
      '🤵','👰','🤰','🤱','👼','🎅','🤶','🦸',
      '🦹','🧙','🧚','🧛','🧜','🧝','🧞','🧟',
    ],
  },
  {
    id:     'hearts',
    label:  'Hearts',
    icon:   '❤️',
    emojis: [
      '❤️','🧡','💛','💚','💙','💜','🖤','🤍',
      '🤎','❤️‍🔥','❤️‍🩹','💔','❣️','💕','💞','💓',
      '💗','💖','💘','💝','💟','♥️','💌','💋','🫦',
    ],
  },
  {
    id:     'symbols',
    label:  'Symbols',
    icon:   '💯',
    emojis: [
      '💯','✅','❌','❎','⭕','🔴','🟠','🟡',
      '🟢','🔵','🟣','⚫','⚪','🔶','🔷','🔸',
      '🔹','🔺','🔻','💠','‼️','⁉️','❓','❔',
      '❕','❗','🔔','🔕','🎵','🎶','💤','♻️',
      '🔞','📵','🚫','⛔','🆘','🆒','🆕','🆓',
      '🆙','🆗','🔝','🔛','🔜','🔚','🏳️','🏴',
    ],
  },
  {
    id:     'activities',
    label:  'Activities',
    icon:   '🎉',
    emojis: [
      '🎉','🎊','🎈','🎁','🎀','🏆','🥇','🥈',
      '🥉','🏅','🎖️','🎗️','🎫','🎟️','🎪','🤹',
      '🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁',
      '🪘','🎷','🎺','🎸','🪕','🎻','🎲','♟️',
      '🎯','🎳','🎮','🎰','🧩','🪆','🪅','🧸',
    ],
  },
  {
    id:     'food',
    label:  'Food',
    icon:   '🍕',
    emojis: [
      '🍕','🍔','🌮','🌯','🍣','🍜','🍛','🍲',
      '🥗','🍱','🍤','🦐','🦑','🦞','🦀','🍰',
      '🎂','🍩','🍪','🍫','🍬','🍭','🧁','☕',
      '🍵','🧃','🥤','🍺','🍻','🥂','🍾','🍎',
      '🍊','🍋','🍇','🍓','🫐','🍑','🥭','🍌',
    ],
  },
  {
    id:     'animals',
    label:  'Animals',
    icon:   '🐶',
    emojis: [
      '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼',
      '🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈',
      '🙉','🙊','🐔','🦆','🦅','🦉','🦇','🐺',
      '🐴','🦄','🐝','🦋','🐛','🐞','🦎','🐊',
      '🦕','🦖','🐙','🦑','🦐','🦞','🦀','🐡',
      '🐠','🐟','🐬','🐳','🦈','🐅','🐆','🦓',
    ],
  },
  {
    id:     'travel',
    label:  'Travel',
    icon:   '✈️',
    emojis: [
      '✈️','🚀','🛸','🚁','🚂','🚗','🚕','🏎️',
      '🚑','🚒','🚓','🛺','🏍️','🛵','🚲','🛴',
      '🌍','🌎','🌏','🗺️','🏔️','🏖️','🏜️','🏕️',
      '🌋','🗼','🏯','🏰','🗽','🗿','🎡','🎢',
    ],
  },
];

// Flat deduplicated emoji list for search use
export const ALL_EMOJIS = [...new Set(EMOJI_CATEGORIES.flatMap(c => c.emojis))];

// 8-emoji quick toolbar shown on message long-press / hover (WhatsApp-style)
export const QUICK_REACTIONS = EMOJI_CATEGORIES.find(c => c.id === 'quick')?.emojis ?? [];

// ─────────────────────────────────────────────────────────────────────────────
// EMOJI HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export const getEmojiCategory = (id) =>
  EMOJI_CATEGORIES.find(c => c.id === id) ?? null;

/**
 * Build the payload for POST /api/chat/messages/:id/react
 *
 * @param {string} messageId
 * @param {string} conversationId
 * @param {string} emoji   e.g. '👍'
 */
export const buildReactionPayload = (messageId, conversationId, emoji) => ({
  messageId,
  conversationId,
  emoji,
});

// ─────────────────────────────────────────────────────────────────────────────
// STATS (handy for debugging)
// ─────────────────────────────────────────────────────────────────────────────

export const STICKER_STATS = {
  stickerCategories: STICKER_CATEGORIES.length,
  emojiCategories:   EMOJI_CATEGORIES.length,
  totalUniqueEmojis: ALL_EMOJIS.length,
  quickReactions:    QUICK_REACTIONS.length,
  provider:          'GIPHY SDK (@giphy/js-fetch-api)',
};

  