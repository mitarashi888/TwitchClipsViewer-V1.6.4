// clips_page.js

// =========================================================
// グローバル変数と定数
// =========================================================
const CLIENT_ID = 'y9cudfms3l5zbluftsf0zp1fad9wyi';
const MAX_SEARCH_HISTORY = 10;


// イベント「GTA5（MADTOWN）」の対象配信者リスト
/*
const MADTOWN_GTA5_STREAMERS = [
    'fps_shaka',
    'k4sen',
    'stylishnoob',
    'spygea',
    'obo',
    'vanilove',
    'guilty1223',
    'akamikarubi',
    'sasatikk',
    'clazycrazy'
];
*/
// ★★★★★ ここまで ★★★★★

const POPULAR_CATEGORIES = [
    // type: 'streamer_list' は指定された配信者リストから集計
    { name: '総合', id: 'overall', type: 'streamer_list', gameId: null },
    { name: '雑談', id: '509658', type: 'streamer_list', gameId: '509658' },
    // type: 'game_id' は指定されたゲームIDで全体から集計
    { name: 'VALO', id: '516575', type: 'game_id' },
    { name: 'LOL', id: '21779', type: 'game_id' },
    { name: 'Apex', id: '511224', type: 'game_id' },
    { name: 'スト6', id: '55453844', type: 'game_id' },
    { name: 'GTA5', id: '32982', type: 'game_id' },

    // ★★★★★ 以下をコメントアウト ★★★★★
    /*
    {
        name: 'イベント：GTA5（MADTOWN）',
        id: 'event_gta5_madtown',
        group: 'イベント',
        type: 'streamer_list_event', // 新しい処理を識別するためのタイプ
        gameId: '32982', // GTA5のゲームID
        streamerLogins: MADTOWN_GTA5_STREAMERS // 対象配信者リスト
    },
    */
    // ★★★★★ ここまで ★★★★★
    { name: 'イベント：FF14（the k4sen）', id: '24241', group: 'イベント' },
];

let selectedPopularCategory = 'overall'; // 初期選択は「総合」

let accessToken = '';
let favoriteClips = {};
let myChannelClipsTags = {};
let userChannelId = '';
let userDisplayName = '';
let currentView = 'channelSearch';

//【変更点】キャッシュ戦略の実装
let clipsCache = {}; // ビューごとのクリップを保存するオブジェクト
let popularClipsCache = null; // 【正】
let cachedAllClips = []; // 現在アクティブなビューのクリップを保持する作業用配列
let cachedVideoDetails = new Map();
let cachedGameDetails = new Map();
let allExistingTags = new Set();
let allExistingMyChannelTags = new Set();
let cachedClipInfo = null; // 【追加】クリップ情報タブのキャッシュ用変数

// =========================================================
// DOM要素の参照
// =========================================================
let channelNameInput, fetchClipsButton, startDateInput, endDateInput;
let sortOrderSelect, sortOrderFavoritesSelect, dateRangePresetSelect, favoriteStreamerFilterSelect;
let clipsGrid, messageElement, loadingSpinner;
let menuChannelSearch, menuFavorites, menuMyChannel, menuPopular, menuClipInfo, menuSettings;
let channelSearchSection, favoritesSection, myChannelSection, popularSection, clipInfoSection, settingsSection;
let popularDateRangeFilter, popularClipsContainer;
let popularModeNormal, popularModeEvent;
let clipUrlInput, fetchClipInfoButton;
let userChannelIdInput, userChannelMessage, saveUserChannelButton;
let settingsUserPreview, settingsUserAvatar, settingsUserDisplayName;
let channelKeywordSearchInput, favoriteKeywordSearchInput;
let gameFilterContainer, gameFilterSelect;
let favoriteGameFilterContainer, favoriteGameFilterSelect;
let favoriteTagFilterContainer, favoriteTagFilterSelect;
let exportFavoritesButton, importFavoritesButton, importFavoritesInput;
let confirmationModal, modalMessage, modalConfirmButton, modalCancelButton;
let modalConfirmCallback = null;
let searchHistoryContainer, searchHistoryItems;
let themeToggle, themeLabel;
let tutorialOverlay, tutorialPopover, tutorialTitle, tutorialDescription, tutorialProgress;
let tutorialSkip, tutorialNext, tutorialDone, showTutorialButton;
let isContextualPopoverActive = false;
let myCreationsFilterToggleChannel, myCreationsFilterToggleFavorites;
let clipDetailSection, clipDetailCardContainer, clipDetailInfoContainer, clipDetailTable, clipDetailActions;
let relatedClipsSection, relatedBroadcasterAllTime, relatedBroadcasterAllTimeGrid;
let relatedBroadcasterWeekly, relatedBroadcasterWeeklyGrid, relatedGameWeekly, relatedGameWeeklyGrid;

// Myチャンネル用DOM
let myChannelStartDateInput, myChannelEndDateInput, myChannelDateRangePresetSelect;
let myChannelKeywordSearchInput, myChannelCreatorFilter, myChannelGameFilter, myChannelTagFilter, sortOrderMyChannel;
let myChannelCreatorFilterContainer, myChannelGameFilterContainer, myChannelTagFilterContainer;
let myCreationsFilterToggleMyChannel, favoritesOnlyToggleMyChannel;
let setMyChannelToSelfCheckbox, myChannelIdInput, saveMyChannelButton, myChannelMessage;
let myChannelUserPreview, myChannelUserAvatar, myChannelUserDisplayName;
let myChannelIdDisplay, myChannelIdText, clipManagerLink;


// =========================================================
// チュートリアルとポップアップ関連
// =========================================================
const tutorialSteps = [
    {
        title: 'Twitchクリップビューアへようこそ！',
        description: 'この拡張機能はTwitchのクリップをより快適に楽しむためのツールです。簡単な使い方を順番にご紹介します。',
        target: '.header-title-wrapper'
    },
    {
        title: '1. チャンネル検索',
        description: 'ここが基本の画面です。特定の配信者のクリップを、期間やキーワードを指定して検索できます。',
        target: '#menuChannelSearch'
    },
    {
        title: '2. お気に入りクリップ',
        description: 'クリップの「★」ボタンを押すと、お気に入りがここに保存されます。あなただけのクリップ集を作りましょう。',
        target: '#menuFavorites'
    },
    {
        title: '3. Myチャンネル',
        description: '設定で指定した特定のチャンネルのクリップをまとめて表示・管理できます。配信者自身のクリップ管理や、特定のお気に入り配信者のクリップを追いかけるのに便利です。このタブ専用のタグ付け機能もあります。',
        target: '#menuMyChannel'
    },
    {
        title: '4. 人気クリップ',
        description: '今、日本のTwitchで話題のクリップをカテゴリ別にチェックできます。新しい面白いクリップに出会えるかもしれません。',
        target: '#menuPopular'
    },
    {
        title: '5. クリップ情報',
        description: 'クリップのURLやIDを直接入力して、そのクリップの詳細情報を確認できます。Twitchサイト上で「★」ボタンが表示されない場合などにご利用ください。',
        target: '#menuClipInfo'
    },
    {
        title: '6. 設定',
        description: 'ご自身のTwitchチャンネルIDを登録すると、自分が作成したクリップが分かりやすくなるなど、さらに便利になります。ぜひ設定してみてください。',
        target: '#menuSettings'
    }
];
let currentTutorialStep = 0;

function startTutorial() {
    currentTutorialStep = 0;
    tutorialOverlay.style.display = 'block';
    tutorialPopover.style.display = 'block';
    showTutorialStep(currentTutorialStep);
}

function endTutorial() {
    const highlighted = document.querySelector('.highlight-element');
    if (highlighted) {
        highlighted.classList.remove('highlight-element');
    }
    tutorialOverlay.style.display = 'none';
    tutorialPopover.style.display = 'none';
    chrome.storage.local.set({ hasShownTutorial: true });
}

function showTutorialStep(stepIndex) {
    const previouslyHighlighted = document.querySelector('.highlight-element');
    if (previouslyHighlighted) {
        previouslyHighlighted.classList.remove('highlight-element');
    }

    if (stepIndex >= tutorialSteps.length) {
        endTutorial();
        return;
    }

    const step = tutorialSteps[stepIndex];
    const targetElement = document.querySelector(step.target);

    if (!targetElement) {
        endTutorial();
        return;
    }

    targetElement.classList.add('highlight-element');
    tutorialTitle.textContent = step.title;
    tutorialDescription.textContent = step.description;
    tutorialProgress.textContent = `${stepIndex + 1} / ${tutorialSteps.length}`;
    tutorialProgress.style.display = 'block';
    tutorialSkip.style.display = 'inline-block';

    const targetRect = targetElement.getBoundingClientRect();
    const popoverRect = tutorialPopover.getBoundingClientRect();
    const popoverMargin = 15;
    let top = targetRect.bottom + popoverMargin;
    let left = targetRect.left + (targetRect.width / 2) - (popoverRect.width / 2);
    if (top + popoverRect.height > window.innerHeight) {
        top = targetRect.top - popoverRect.height - popoverMargin;
    }
    if (left < 10) left = 10;
    if (left + popoverRect.width > window.innerWidth - 10) {
        left = window.innerWidth - popoverRect.width - 10;
    }
    tutorialPopover.style.top = `${top}px`;
    tutorialPopover.style.left = `${left}px`;

    if (stepIndex === tutorialSteps.length - 1) {
        tutorialNext.style.display = 'none';
        tutorialDone.style.display = 'inline-block';
        tutorialDone.textContent = '完了';
    } else {
        tutorialNext.style.display = 'inline-block';
        tutorialDone.style.display = 'none';
    }
}


function hideContextualPopover() {
    if (!isContextualPopoverActive) return;
    tutorialOverlay.style.display = 'none';
    tutorialPopover.style.display = 'none';
    menuSettings.classList.remove('highlight-for-attention');
    tutorialDone.textContent = '完了';
    tutorialNext.style.display = 'inline-block';
    tutorialSkip.style.display = 'inline-block';
    tutorialProgress.style.display = 'block';
    tutorialOverlay.removeEventListener('click', hideContextualPopover);
    tutorialDone.removeEventListener('click', hideContextualPopover);
    isContextualPopoverActive = false;
}

function showContextualPopover(targetElement, title, description) {
    if (isContextualPopoverActive) return;
    isContextualPopoverActive = true;
    tutorialOverlay.style.display = 'block';
    tutorialPopover.style.display = 'block';
    tutorialTitle.textContent = title;
    tutorialDescription.textContent = description;
    tutorialNext.style.display = 'none';
    tutorialSkip.style.display = 'none';
    tutorialProgress.style.display = 'none';
    tutorialDone.style.display = 'inline-block';
    tutorialDone.textContent = '閉じる';

    const targetRect = targetElement.getBoundingClientRect();
    const popoverRect = tutorialPopover.getBoundingClientRect();
    const popoverMargin = 15;
    let top = targetRect.bottom + popoverMargin;
    let left = targetRect.left + (targetRect.width / 2) - (popoverRect.width / 2);

    if (top + popoverRect.height > window.innerHeight) {
        top = targetRect.top - popoverRect.height - popoverMargin;
    }
    if (left < 10) left = 10;
    if (left + popoverRect.width > window.innerWidth - 10) {
        left = window.innerWidth - popoverRect.width - 10;
    }
    tutorialPopover.style.top = `${top}px`;
    tutorialPopover.style.left = `${left}px`;

    tutorialOverlay.addEventListener('click', hideContextualPopover);
    tutorialDone.addEventListener('click', hideContextualPopover);
}



// =========================================================
// background.js にイベントログを送信するヘルパー関数
function logEvent(type, details = {}) {
    chrome.runtime.sendMessage({ action: 'logEvent', type: type, details: details });
}
// =========================================================

// =========================================================
// ヘルパー関数群
// =========================================================

//【追加】入力のデバウンス (Debounce)
/**
 * 関数が連続して呼び出された場合に、最後の呼び出しから指定時間後に一度だけ実行する関数を生成します。
 * @param {Function} func 実行を遅延させる関数
 * @param {number} delay 遅延させる時間 (ミリ秒)
 * @returns {Function} デバウンス化された新しい関数
 */
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}


function showTemporaryNotification(parentElement, text) {
    const existingNotif = parentElement.querySelector('.action-notification');
    if (existingNotif) {
        existingNotif.remove();
    }
    const notification = document.createElement('div');
    notification.className = 'action-notification';
    notification.textContent = text;
    parentElement.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentElement) {
                parentElement.removeChild(notification);
            }
        }, 300);
    }, 2000);
}

function getFormattedDateWithoutDay(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

function getFormattedDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}


function getFormattedDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatSecondsToHMS(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const pad = (num) => String(num).padStart(2, '0');
    if (h > 0) {
        return `${h}:${pad(m)}:${pad(s)}`;
    }
    return `${m}:${pad(s)}`;
}

function parseTwitchDuration(durationStr) {
    let totalSeconds = 0;
    const hoursMatch = durationStr.match(/(\d+)h/);
    const minutesMatch = durationStr.match(/(\d+)m/);
    const secondsMatch = durationStr.match(/(\d+)s/);

    if (hoursMatch) totalSeconds += parseInt(hoursMatch[1]) * 3600;
    if (minutesMatch) totalSeconds += parseInt(minutesMatch[1]) * 60;
    if (secondsMatch) totalSeconds += parseInt(secondsMatch[1]);

    return totalSeconds;
}


function saveFavoriteClips() {
    chrome.storage.sync.set({ 'favoriteClips': favoriteClips });
}

function saveMyChannelClipsTags() {
    chrome.storage.sync.set({ 'myChannelClipsTags': myChannelClipsTags });
}


function showConfirmationModal(message, onConfirm) {
    modalMessage.textContent = message;
    modalConfirmCallback = onConfirm;
    confirmationModal.style.display = 'flex';
}

function escapeCsvField(field) {
    if (field === null || field === undefined) {
        return '';
    }
    const str = String(field);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        const escapedStr = str.replace(/"/g, '""');
        return `"${escapedStr}"`;
    }
    return str;
}

function addTagToClip(clipId, tag) {
    if (!tag || !favoriteClips[clipId]) return;
    const lowerCaseTag = tag.trim().toLowerCase();
    if (lowerCaseTag && !favoriteClips[clipId].includes(lowerCaseTag)) {
        favoriteClips[clipId].push(lowerCaseTag);
        saveFavoriteClips();
        processAndRenderClips();
    }
}

function removeTagFromClip(clipId, tag) {
    if (!tag || !favoriteClips[clipId]) return;
    const lowerCaseTag = tag.toLowerCase();
    favoriteClips[clipId] = favoriteClips[clipId].filter(t => t !== lowerCaseTag);
    saveFavoriteClips();
    processAndRenderClips();
}

function addTagToMyChannelClip(clipId, tag) {
    if (!tag) return;
    const lowerCaseTag = tag.trim().toLowerCase();
    if (!myChannelClipsTags[clipId]) {
        myChannelClipsTags[clipId] = [];
    }
    if (lowerCaseTag && !myChannelClipsTags[clipId].includes(lowerCaseTag)) {
        myChannelClipsTags[clipId].push(lowerCaseTag);
        saveMyChannelClipsTags();
        processAndRenderClips();
    }
}

function removeTagFromMyChannelClip(clipId, tag) {
    if (!tag || !myChannelClipsTags[clipId]) return;
    const lowerCaseTag = tag.toLowerCase();
    myChannelClipsTags[clipId] = myChannelClipsTags[clipId].filter(t => t !== lowerCaseTag);
    saveMyChannelClipsTags();
    processAndRenderClips();
}


function updateFavoriteTagFilter() {
    if (!favoriteTagFilterSelect || currentView !== 'favorites') return;

    const currentSelection = favoriteTagFilterSelect.value;
    allExistingTags = new Set();
    Object.values(favoriteClips).forEach(tags => {
        tags.forEach(tag => allExistingTags.add(tag));
    });

    const sortedTags = [...allExistingTags].sort((a, b) => a.localeCompare(b));

    favoriteTagFilterSelect.innerHTML = '<option value="all">すべてのタグ</option>';
    sortedTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        favoriteTagFilterSelect.appendChild(option);
    });

    favoriteTagFilterContainer.style.display = 'flex';

    if ([...favoriteTagFilterSelect.options].some(opt => opt.value === currentSelection)) {
        favoriteTagFilterSelect.value = currentSelection;
    } else {
        favoriteTagFilterSelect.value = 'all';
    }
}

function updateMyChannelTagFilter() {
    if (!myChannelTagFilter || currentView !== 'myChannel') return;

    const currentSelection = myChannelTagFilter.value;
    allExistingMyChannelTags = new Set();
    Object.values(myChannelClipsTags).forEach(tags => {
        tags.forEach(tag => allExistingMyChannelTags.add(tag));
    });

    const sortedTags = [...allExistingMyChannelTags].sort((a, b) => a.localeCompare(b));

    myChannelTagFilter.innerHTML = '<option value="all">すべてのタグ</option>';
    sortedTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        myChannelTagFilter.appendChild(option);
    });

    myChannelTagFilterContainer.style.display = 'flex';

    if ([...myChannelTagFilter.options].some(opt => opt.value === currentSelection)) {
        myChannelTagFilter.value = currentSelection;
    } else {
        myChannelTagFilter.value = 'all';
    }
}

async function getAccessToken() {
    if (accessToken) return accessToken;
    const data = await chrome.storage.local.get(['twitch_access_token']);
    if (data.twitch_access_token) {
        accessToken = data.twitch_access_token;
        return accessToken;
    }
    if (!messageElement) return null;
    messageElement.textContent = 'Twitchの認証が必要です。ポップアップウィンドウを確認してください...';
    const redirectUri = chrome.identity.getRedirectURL();
    const authUrl = new URL('https://id.twitch.tv/oauth2/authorize');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'token');
    authUrl.searchParams.append('scope', '');
    try {
        const resultUrl = await new Promise((resolve, reject) => {
            chrome.identity.launchWebAuthFlow({ url: authUrl.href, interactive: true }, (redirect_url) => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
                else if (!redirect_url) reject(new Error('認証がキャンセルされたか、ウィンドウが閉じられました。'));
                else resolve(redirect_url);
            });
        });
        const redirectedUrlObj = new URL(resultUrl);
        if (redirectedUrlObj.searchParams.has('error')) {
            throw new Error(`Twitch Auth Error: ${redirectedUrlObj.searchParams.get('error')}`);
        }
        const params = redirectedUrlObj.hash.substring(1);
        const urlParams = new URLSearchParams(params);
        const token = urlParams.get('access_token');
        if (token) {
            accessToken = token;
            await chrome.storage.local.set({ 'twitch_access_token': token });
            messageElement.textContent = '認証に成功しました。';
            return token;
        } else {
            throw new Error('リダイレクトURLにアクセストークンが含まれていませんでした。');
        }
    } catch (error) {
        console.error('Twitch認証プロセス全体でエラーが発生しました:', error);
        messageElement.textContent = `認証に失敗しました: ${error.message}`;
        return null;
    }
}

function renderClipsToContainer(clipsToRender, container, videoDetailsMap) {
    const fragment = document.createDocumentFragment();
    clipsToRender.forEach(clip => {
        const clipItem = document.createElement('div');
        clipItem.classList.add('clip-item');
        const creator = clip.creator_name.toLowerCase();
        if (userChannelId && (creator === userChannelId.toLowerCase() || (userDisplayName && creator === userDisplayName.toLowerCase()))) {
            clipItem.classList.add('my-creation');
            clipItem.title = 'あなたが作成したクリップです';
        }
        const clipLink = document.createElement('a');
        clipLink.href = clip.url;
        clipLink.target = '_blank';
        clipLink.addEventListener('click', () => {
            const clipDetailsForLog = { ...clip };
            clipDetailsForLog.game_name = clip.game_name || (clip.game_id && cachedGameDetails.has(clip.game_id) ? cachedGameDetails.get(clip.game_id) : '');
            logEvent('clip_played', { clipId: clip.id, details: clipDetailsForLog });
        });
        const thumbnailWrapper = document.createElement('div');
        thumbnailWrapper.classList.add('clip-thumbnail-wrapper');
        const thumbnail = document.createElement('img');
        thumbnail.src = clip.thumbnail_url || 'placeholder.png';
        thumbnail.alt = clip.title;
        thumbnailWrapper.appendChild(thumbnail);
        const downloadButton = document.createElement('button');
        downloadButton.classList.add('download-clip-button');
        downloadButton.title = 'クリップをダウンロード';
        downloadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;
        downloadButton.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const urlToOpen = clip.url + '#auto-click-download=true';
            chrome.tabs.create({ url: urlToOpen });
        });
        thumbnailWrapper.appendChild(downloadButton);
        const copyLinkButton = document.createElement('button');
        copyLinkButton.classList.add('copy-link-button');
        copyLinkButton.title = 'クリップのURLをコピー';
        copyLinkButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72"></path></svg>`;
        copyLinkButton.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            navigator.clipboard.writeText(clip.url).then(() => {
                const existingNotif = thumbnailWrapper.querySelector('.copy-notification');
                if (existingNotif) existingNotif.remove();
                const notification = document.createElement('div');
                notification.className = 'copy-notification';
                notification.textContent = 'クリップURLをコピーしました';
                thumbnailWrapper.appendChild(notification);
                setTimeout(() => notification.classList.add('show'), 10);
                setTimeout(() => {
                    notification.classList.remove('show');
                    setTimeout(() => { if (notification.parentElement) thumbnailWrapper.removeChild(notification); }, 300);
                }, 2000);
            });
        });
        thumbnailWrapper.appendChild(copyLinkButton);
        const favoriteButton = document.createElement('button');
        favoriteButton.classList.add('favorite-button');
        favoriteButton.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.27l-6.18 3.25L7 14.14l-5-4.87 8.91-1.01L12 2z"/></svg>`;
        const updateButtonState = (button, isFavorited) => {
            button.title = isFavorited ? 'お気に入りから解除' : 'お気に入りに追加';
            button.classList.toggle('favorited', isFavorited);
        };
        updateButtonState(favoriteButton, favoriteClips.hasOwnProperty(clip.id));
        favoriteButton.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const isCurrentlyFavorited = favoriteClips.hasOwnProperty(clip.id);
            if (isCurrentlyFavorited) {
                showConfirmationModal('このクリップをお気に入りから削除しますか？', () => {
                    chrome.runtime.sendMessage({ action: 'removeClipFromFavorites', clipId: clip.id });
                    delete favoriteClips[clip.id];
                    updateButtonState(favoriteButton, false);
                    saveFavoriteClips();
                    if (currentView === 'favorites') {
                        cachedAllClips = cachedAllClips.filter(c => c.id !== clip.id);
                        processAndRenderClips();
                    }
                });
            } else {
                const gameName = clip.game_name || (clip.game_id && cachedGameDetails.has(clip.game_id) ? cachedGameDetails.get(clip.game_id) : '');
                const clipDetails = { ...clip, game_name: gameName };
                chrome.runtime.sendMessage({ action: 'addClipToFavorites', clipDetails: clipDetails });
                favoriteClips[clip.id] = [];
                updateButtonState(favoriteButton, true);
                saveFavoriteClips();
            }
        });
        thumbnailWrapper.appendChild(favoriteButton);
        const clipInfoDiv = document.createElement('div');
        clipInfoDiv.classList.add('clip-info');
        const title = document.createElement('div');
        title.classList.add('clip-title');
        title.textContent = clip.title;
        const metadata = document.createElement('div');
        metadata.classList.add('clip-metadata');

        const gameName = clip.game_name || (clip.game_id && cachedGameDetails.has(clip.game_id) ? cachedGameDetails.get(clip.game_id) : '');
        if (gameName) {
            const gameDisplay = document.createElement('span');
            gameDisplay.textContent = `ゲーム: ${gameName}`;
            metadata.appendChild(gameDisplay);
        }

        const channelNameContainer = document.createElement('span');
        channelNameContainer.classList.add('clip-channel-name');
        channelNameContainer.style.whiteSpace = 'nowrap';
        channelNameContainer.style.cursor = 'pointer';
        channelNameContainer.title = 'この配信者の他のクリップを検索する';
        channelNameContainer.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            updateView('channelSearch');
            channelNameInput.value = clip.broadcaster_login;
            messageElement.textContent = `配信者「${clip.broadcaster_login}」が入力されました。期間などを確認し「クリップを取得」ボタンを押してください。`;
            window.scrollTo(0, 0);
        });
        const namePart = document.createElement('span');
        namePart.textContent = clip.broadcaster_name;
        namePart.style.color = 'var(--link-color)';
        namePart.style.textDecoration = 'none';
        channelNameContainer.addEventListener('mouseover', () => { namePart.style.textDecoration = 'underline'; });
        channelNameContainer.addEventListener('mouseout', () => { namePart.style.textDecoration = 'none'; });
        channelNameContainer.append('配信者: ', namePart);
        metadata.appendChild(channelNameContainer);

        const authorNameDisplay = document.createElement('span');
        authorNameDisplay.classList.add('clip-author');
        authorNameDisplay.textContent = `作成者: ${clip.creator_name}`;
        metadata.appendChild(authorNameDisplay);

        const views = document.createElement('div');
        views.classList.add('clip-views');
        views.textContent = `${clip.view_count.toLocaleString()} 回の視聴`;
        metadata.appendChild(views);

        const dateDisplay = document.createElement('span');
        dateDisplay.classList.add('clip-date-display');
        dateDisplay.textContent = `作成日: ${getFormattedDateWithoutDay(new Date(clip.created_at))}`;
        metadata.appendChild(dateDisplay);

        if (clip.video_id) {
            // 「総合」タブ用の事前取得情報(clip.vod_info)と、その他タブ用のリアルタイム取得情報(videoDetailsMap)の両方に対応
            const vodObject = clip.vod_info || videoDetailsMap.get(String(clip.video_id));
            const vodOffsetStart = Math.floor(Math.max(0, (clip.vod_offset || 0) - (clip.duration || 0)));
            const vodInfoDiv = document.createElement('div');
            vodInfoDiv.classList.add('clip-vod-info');
            if (vodObject) {
                const vodPublishedAt = new Date(vodObject.published_at);
                const vodStartDateFormatted = `${vodPublishedAt.getFullYear()}/${String(vodPublishedAt.getMonth() + 1).padStart(2, '0')}/${String(vodPublishedAt.getDate()).padStart(2, '0')}`;
                const vodLink = document.createElement('a');
                vodLink.href = `https://www.twitch.tv/videos/${clip.video_id}?t=${vodOffsetStart}s`;
                vodLink.target = '_blank';
                vodLink.title = '元配信アーカイブへ';
                vodLink.innerHTML = `元配信: ${vodObject.title}〈${vodStartDateFormatted}〉 （${formatSecondsToHMS(vodOffsetStart)}～）`;
                vodInfoDiv.appendChild(vodLink);
            } else {
                vodInfoDiv.textContent = `元配信ID: ${clip.video_id} （${formatSecondsToHMS(vodOffsetStart)}～）`;
            }
            metadata.appendChild(vodInfoDiv);
        }

        clipInfoDiv.appendChild(title);
        clipInfoDiv.appendChild(metadata);
        clipLink.appendChild(thumbnailWrapper);
        clipLink.appendChild(clipInfoDiv);
        clipItem.appendChild(clipLink);

        // ... (タグ表示のロジックは変更なし) ...

        fragment.appendChild(clipItem);
    });
    container.appendChild(fragment);
}

function renderClips(clipsToRender, videoDetailsMap) {
    if (!clipsGrid || !messageElement) return;

    if (clipsToRender.length === 0) {
        clipsGrid.innerHTML = '';
        if (currentView === 'clipInfo') return;

        let msg = '指定された条件に一致するクリップは見つかりませんでした。';
        if (currentView === 'favorites') msg = 'お気に入りのクリップがありません。';
        else if (currentView === 'myChannel' && messageElement.textContent === '') msg = '期間を選択するとクリップが自動で読み込まれます。';

        if (!messageElement.textContent.includes('見つかりませんでした')) {
            messageElement.textContent = msg;
        }
        return;
    }

    clipsGrid.innerHTML = '';
    renderClipsToContainer(clipsToRender, clipsGrid, videoDetailsMap);
    messageElement.textContent = `${clipsToRender.length}件のクリップを表示中。`;
}


function updateFavoriteStreamerFilter() {
    if (!favoriteStreamerFilterSelect || currentView !== 'favorites') return;
    const currentSelection = favoriteStreamerFilterSelect.value;
    const streamerNames = [...new Set(cachedAllClips.map(clip => clip.broadcaster_name))].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    favoriteStreamerFilterSelect.innerHTML = '<option value="all">すべての配信者</option>';
    streamerNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        favoriteStreamerFilterSelect.appendChild(option);
    });
    favoriteStreamerFilterSelect.value = [...favoriteStreamerFilterSelect.options].some(opt => opt.value === currentSelection) ? currentSelection : 'all';
}

function updateMyChannelCreatorFilter() {
    if (!myChannelCreatorFilter || currentView !== 'myChannel') return;
    const currentSelection = myChannelCreatorFilter.value;
    const creatorNames = [...new Set(cachedAllClips.map(clip => clip.creator_name))].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    if (creatorNames.length > 0) {
        myChannelCreatorFilterContainer.style.display = 'flex';
        myChannelCreatorFilter.innerHTML = '<option value="all">すべての作成者</option>';
        creatorNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            myChannelCreatorFilter.appendChild(option);
        });
        myChannelCreatorFilter.value = [...myChannelCreatorFilter.options].some(opt => opt.value === currentSelection) ? currentSelection : 'all';
    } else {
        myChannelCreatorFilterContainer.style.display = 'none';
    }
}


function populateGameFilter(selectElement, gameIds) {
    const currentSelection = selectElement.value;
    selectElement.innerHTML = '<option value="all">すべてのゲーム</option>';
    gameIds.sort((a, b) => (cachedGameDetails.get(a) || '').localeCompare(cachedGameDetails.get(b) || ''))
        .forEach(id => {
            if (cachedGameDetails.has(id)) {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = cachedGameDetails.get(id);
                selectElement.appendChild(option);
            }
        });
    selectElement.value = [...selectElement.options].some(opt => opt.value === currentSelection) ? currentSelection : 'all';
}

async function updateGameFilter(clips) {
    const uniqueGameIds = [...new Set(clips.map(clip => clip.game_id).filter(id => id && id !== '0'))];
    let targetContainer, targetSelect;
    switch (currentView) {
        case 'channelSearch': [targetContainer, targetSelect] = [gameFilterContainer, gameFilterSelect]; break;
        case 'favorites': [targetContainer, targetSelect] = [favoriteGameFilterContainer, favoriteGameFilterSelect]; break;
        case 'myChannel': [targetContainer, targetSelect] = [myChannelGameFilterContainer, myChannelGameFilter]; break;
        default: return;
    }
    if (!targetContainer) return;
    if (uniqueGameIds.length === 0) {
        targetContainer.style.display = 'none';
        return;
    }
    await fetchAndCacheGameDetails(uniqueGameIds);
    populateGameFilter(targetSelect, uniqueGameIds);
    targetContainer.style.display = 'flex';
}

async function fetchAndCacheGameDetails(gameIds) {
    const idsToFetch = gameIds.filter(id => id && !cachedGameDetails.has(id));
    if (idsToFetch.length > 0) {
        const token = await getAccessToken();
        if (!token) return;
        const idChunks = [];
        for (let i = 0; i < idsToFetch.length; i += 100) idChunks.push(idsToFetch.slice(i, i + 100));
        for (const chunk of idChunks) {
            const gameIdsParam = chunk.map(id => `id=${id}`).join('&');
            try {
                const response = await fetch(`https://api.twitch.tv/helix/games?${gameIdsParam}`, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` } });
                if (!response.ok) {
                    const err = new Error('API Error: Game Fetch');
                    err.status = response.status;
                    throw err;
                };
                const data = await response.json();
                if (data.data) data.data.forEach(game => cachedGameDetails.set(game.id, game.name));
            } catch (error) { console.error('Error fetching game details:', error); }
        }
    }
}

async function fetchAndCacheVideoDetailsForClips(clips) {
    const videoDetails = new Map();
    if (!accessToken) accessToken = await getAccessToken();
    if (!accessToken) return videoDetails;

    const videoIds = [...new Set(clips.map(c => c.video_id).filter(Boolean))];
    if (videoIds.length === 0) return videoDetails;

    for (let i = 0; i < videoIds.length; i += 100) {
        const chunk = videoIds.slice(i, i + 100);
        const videoIdsParam = chunk.map(id => `id=${id}`).join('&');
        try {
            const videoResponse = await fetch(`https://api.twitch.tv/helix/videos?${videoIdsParam}`, {
                headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
            });
            if (videoResponse.ok) {
                const videoData = await videoResponse.json();
                videoData.data?.forEach(video => videoDetails.set(video.id, video));
            }
        } catch (error) {
            console.error('Error fetching VOD details:', error);
        }
    }
    return videoDetails;
}

function processAndRenderClips() {
    if (!messageElement || ['clipInfo', 'popular'].includes(currentView)) return;

    let clipsToProcess = [...cachedAllClips];
    let selectedSortOrder = '';
    let keyword = '';

    if (currentView === 'channelSearch') {
        selectedSortOrder = sortOrderSelect.value;
        keyword = channelKeywordSearchInput.value.toLowerCase().trim();
        if (gameFilterSelect.value !== 'all') clipsToProcess = clipsToProcess.filter(clip => clip.game_id === gameFilterSelect.value);
        if (myCreationsFilterToggleChannel.checked && userChannelId) clipsToProcess = clipsToProcess.filter(clip => clip.creator_name.toLowerCase() === userChannelId.toLowerCase() || (userDisplayName && clip.creator_name.toLowerCase() === userDisplayName.toLowerCase()));
    } else if (currentView === 'favorites') {
        selectedSortOrder = sortOrderFavoritesSelect.value;
        keyword = favoriteKeywordSearchInput.value.toLowerCase().trim();
        updateFavoriteStreamerFilter();
        if (favoriteStreamerFilterSelect.value !== 'all') clipsToProcess = clipsToProcess.filter(clip => clip.broadcaster_name === favoriteStreamerFilterSelect.value);
        if (myCreationsFilterToggleFavorites.checked && userChannelId) clipsToProcess = clipsToProcess.filter(clip => clip.creator_name.toLowerCase() === userChannelId.toLowerCase() || (userDisplayName && clip.creator_name.toLowerCase() === userDisplayName.toLowerCase()));
        if (favoriteGameFilterSelect.value !== 'all') clipsToProcess = clipsToProcess.filter(clip => clip.game_id === favoriteGameFilterSelect.value);
        updateFavoriteTagFilter();
        updateTagDatalist('existing-tags-list', allExistingTags);
        if (favoriteTagFilterSelect.value !== 'all') clipsToProcess = clipsToProcess.filter(clip => favoriteClips[clip.id]?.includes(favoriteTagFilterSelect.value));
    } else if (currentView === 'myChannel') {
        selectedSortOrder = sortOrderMyChannel.value;
        keyword = myChannelKeywordSearchInput.value.toLowerCase().trim();
        if (favoritesOnlyToggleMyChannel.checked) clipsToProcess = clipsToProcess.filter(clip => favoriteClips.hasOwnProperty(clip.id));
        updateMyChannelCreatorFilter();
        if (myChannelCreatorFilter.value !== 'all') clipsToProcess = clipsToProcess.filter(clip => clip.creator_name === myChannelCreatorFilter.value);
        if (myChannelGameFilter.value !== 'all') clipsToProcess = clipsToProcess.filter(clip => clip.game_id === myChannelGameFilter.value);
        if (myCreationsFilterToggleMyChannel.checked && userChannelId) clipsToProcess = clipsToProcess.filter(clip => clip.creator_name.toLowerCase() === userChannelId.toLowerCase() || (userDisplayName && clip.creator_name.toLowerCase() === userDisplayName.toLowerCase()));
        updateMyChannelTagFilter();
        updateTagDatalist('existing-my-channel-tags-list', allExistingMyChannelTags);
        if (myChannelTagFilter.value !== 'all') clipsToProcess = clipsToProcess.filter(clip => myChannelClipsTags[clip.id]?.includes(myChannelTagFilter.value));
    }

    if (keyword) clipsToProcess = clipsToProcess.filter(clip => clip.title.toLowerCase().includes(keyword) || clip.creator_name.toLowerCase().includes(keyword));

    if (selectedSortOrder === 'views') {
        clipsToProcess.sort((a, b) => b.view_count - a.view_count);
    } else {
        clipsToProcess.sort((a, b) => {
            const getClipEffectiveTimestamp = clip => cachedVideoDetails.get(clip.video_id) && typeof clip.vod_offset === 'number' ? new Date(cachedVideoDetails.get(clip.video_id).created_at).getTime() + (clip.vod_offset * 1000) : new Date(clip.created_at).getTime();
            return (getClipEffectiveTimestamp(a) - getClipEffectiveTimestamp(b)) * (selectedSortOrder === 'newest' ? -1 : 1);
        });
    }

    renderClips(clipsToProcess, cachedVideoDetails);
}


function updateTagDatalist(datalistId, tagsSet) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) return;
    const sortedTags = [...tagsSet].sort((a, b) => a.localeCompare(b));
    datalist.innerHTML = '';
    sortedTags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        datalist.appendChild(option);
    });
}


async function loadAndRenderSearchHistory() {
    if (!searchHistoryItems || !searchHistoryContainer) return;
    const { searchHistory = [] } = await chrome.storage.local.get('searchHistory');
    searchHistoryItems.innerHTML = '';
    if (searchHistory.length > 0) {
        searchHistoryContainer.style.display = 'flex';
        searchHistory.forEach(channel => {
            const item = document.createElement('button');
            item.className = 'history-item';
            item.textContent = channel;
            item.addEventListener('click', () => { channelNameInput.value = channel; });
            searchHistoryItems.appendChild(item);
        });
    } else {
        searchHistoryContainer.style.display = 'none';
    }
}

async function updateSearchHistory(channelName) {
    let { searchHistory = [] } = await chrome.storage.local.get('searchHistory');
    const filteredHistory = searchHistory.filter(item => item.toLowerCase() !== channelName.toLowerCase());
    filteredHistory.unshift(channelName);
    const newHistory = filteredHistory.slice(0, MAX_SEARCH_HISTORY);
    await chrome.storage.local.set({ searchHistory: newHistory });
    loadAndRenderSearchHistory();
}

async function fetchClips() {
    if (!['channelSearch', 'favorites', 'myChannel'].includes(currentView)) return;
    if (!messageElement || !clipsGrid) return;

    loadingSpinner.style.display = 'flex';
    const intendedView = currentView;
    clipsGrid.innerHTML = '';
    cachedAllClips = [];
    messageElement.textContent = '';


    try {
        const token = await getAccessToken();
        if (!token) { messageElement.textContent = 'Twitch認証が必要です。'; return; }

        let allClips = [];
        const delayBetweenRequests = 200;

        if (intendedView === 'favorites') {
            const favoriteClipIds = Object.keys(favoriteClips);
            logEvent('fetch_clips_favorites', { count: favoriteClipIds.length, sortOrder: sortOrderFavoritesSelect.value });
            if (favoriteClipIds.length === 0) {
                messageElement.textContent = 'お気に入りのクリップがありません。';
                updateGameFilter([]);
                updateFavoriteTagFilter();
                processAndRenderClips();
                return;
            }
            messageElement.textContent = 'お気に入りクリップを取得中...';
            allClips = await fetchClipsByIds(favoriteClipIds, token);

        } else { // 'channelSearch' or 'myChannel'
            let channelLogin, startDate, endDate;
            if (intendedView === 'channelSearch') {
                channelLogin = channelNameInput.value.trim();
                startDate = startDateInput.value;
                endDate = endDateInput.value;
                logEvent('fetch_clips_channel', { channel: channelLogin, startDate, endDate, sortOrder: sortOrderSelect.value });
            } else {
                const settings = await chrome.storage.sync.get(['isMyChannelSelf', 'myChannelId', 'userChannelId']);
                channelLogin = settings.isMyChannelSelf ? settings.userChannelId : settings.myChannelId;
                startDate = myChannelStartDateInput.value;
                endDate = myChannelEndDateInput.value;
                logEvent('fetch_clips_mychannel', { channel: channelLogin, startDate, endDate, sortOrder: sortOrderMyChannel.value });
            }

            if (!channelLogin) {
                const msg = intendedView === 'channelSearch' ? 'チャンネルIDを入力してください。' : '「設定」タブでMyチャンネルに表示するチャンネルIDを設定してください。';
                messageElement.textContent = msg;
                return;
            }

            messageElement.textContent = `チャンネル「${channelLogin}」の情報を取得中...`;
            const usersResponse = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(channelLogin)}`, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` } });
            if (!usersResponse.ok) {
                const err = new Error('API Error: User Fetch');
                err.status = usersResponse.status;
                throw err;
            }
            const usersData = await usersResponse.json();
            if (!usersData.data || usersData.data.length === 0) {
                messageElement.textContent = `チャンネル「${channelLogin}」は見つかりませんでした。`;
                return;
            }
            const user = usersData.data[0];

            if (intendedView === 'channelSearch') await updateSearchHistory(channelLogin);

            let channelClips = [];
            let cursor = null;
            const maxClipsToFetch = 1000;
            do {
                messageElement.textContent = `クリップを取得中: ${channelLogin} (${channelClips.length}件...)`;
                let url = `https://api.twitch.tv/helix/clips?broadcaster_id=${user.id}&first=100`;
                if (cursor) url += `&after=${cursor}`;
                if (startDate) {
                    const startOfDay = new Date(startDate);
                    startOfDay.setHours(0, 0, 0, 0); // JSTの日の始まり
                    url += `&started_at=${startOfDay.toISOString()}`;
                }
                if (endDate) {
                    const endOfDay = new Date(endDate);
                    endOfDay.setHours(23, 59, 59, 999); // JSTの日の終わり
                    url += `&ended_at=${endOfDay.toISOString()}`;
                }
                const clipsResponse = await fetch(url, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` } });
                if (!clipsResponse.ok) {
                    const err = new Error('API Error: Clips Fetch');
                    err.status = clipsResponse.status;
                    throw err;
                }
                const clipsData = await clipsResponse.json();
                if (clipsData.data && clipsData.data.length > 0) {
                    channelClips = channelClips.concat(clipsData.data);
                    cursor = clipsData.pagination.cursor;
                } else {
                    cursor = null;
                }
                if (channelClips.length >= maxClipsToFetch || !cursor) break;
                await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
            } while (cursor);

            let importantClipIds = new Set();
            if (currentView === 'myChannel') {
                importantClipIds = new Set(Object.keys(myChannelClipsTags));
            }
            const fetchedClipIds = new Set(channelClips.map(c => c.id));
            const missingImportantIds = [...importantClipIds].filter(id => !fetchedClipIds.has(id));
            if (missingImportantIds.length > 0) {
                const missingClips = await fetchClipsByIds(missingImportantIds, token);
                channelClips.push(...missingClips);
            }

            // APIからのレスポンスをさらにクライアントサイドでフィルタリングする
            // APIの`started_at`と`ended_at`は時々不正確なため、念のため行う
            allClips = channelClips.filter(clip => {
                const clipDate = new Date(clip.created_at);
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0); // JSTの日の始まり
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // JSTの日の終わり
                return clipDate >= start && clipDate <= end;
            });
        }

        if (currentView !== intendedView) return;

        messageElement.textContent = 'VOD情報を取得中...';
        const uniqueVideoIds = [...new Set(allClips.map(clip => clip.video_id).filter(id => id))];
        const videoDetails = new Map();
        if (uniqueVideoIds.length > 0) {
            const videoIdChunks = [];
            for (let i = 0; i < uniqueVideoIds.length; i += 100) videoIdChunks.push(uniqueVideoIds.slice(i, i + 100));
            for (const chunk of videoIdChunks) {
                const videoIdsParam = chunk.map(id => `id=${id}`).join('&');
                const videoUrl = `https://api.twitch.tv/helix/videos?${videoIdsParam}`;
                const videoResponse = await fetch(videoUrl, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` } });
                if (!videoResponse.ok) {
                    const err = new Error('API Error: Video Fetch');
                    err.status = videoResponse.status;
                    // Don't throw here, just log, as VOD info is not critical
                    console.error(err);
                    continue;
                }
                const videoData = await videoResponse.json();
                if (videoData.data) videoData.data.forEach(video => videoDetails.set(video.id, video));
                await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
            }
        }

        if (currentView === intendedView) {
            const uniqueClips = [...new Map(allClips.map(item => [item['id'], item])).values()];


            let cacheKey = intendedView;
            const channelLogin = channelNameInput.value.trim().toLowerCase();
            if (intendedView === 'channelSearch') {
                cacheKey = `channel_${channelLogin}`;
            } else if (intendedView === 'myChannel') {
                const settings = await chrome.storage.sync.get(['isMyChannelSelf', 'myChannelId', 'userChannelId']);
                const myChannelLogin = (settings.isMyChannelSelf ? settings.userChannelId : settings.myChannelId) || '';
                cacheKey = `mychannel_${myChannelLogin.toLowerCase()}`;
            }

            // お気に入りは揮発性が高いため、ここではキャッシュしない
            if (intendedView !== 'favorites') {
                clipsCache[cacheKey] = uniqueClips;
            }

            cachedAllClips = uniqueClips;
            cachedVideoDetails = videoDetails;
            await updateGameFilter(allClips);
            processAndRenderClips();
        }
    } catch (error) {

        console.error('Error fetching clips:', error);

        let errorMessage = 'クリップの取得中に不明なエラーが発生しました。';
        if (error.status) {
            switch (error.status) {
                case 401:
                    errorMessage = 'Twitch認証の有効期限が切れました。ページを再読み込みするか、拡張機能アイコンをクリックし直して再認証してください。';
                    accessToken = '';
                    chrome.storage.local.remove('twitch_access_token');
                    break;
                case 404:
                    errorMessage = '指定されたチャンネルまたはクリップが見つかりませんでした。';
                    break;
                case 429:
                    errorMessage = 'Twitch APIへのリクエストが多すぎます。少し時間をおいてから再試行してください。';
                    break;
                case 500:
                case 502:
                case 503:
                    errorMessage = 'Twitchサーバーで一時的な問題が発生しているようです。時間をおいてから再試行してください。';
                    break;
                default:
                    errorMessage = `サーバーから予期せぬエラーが返されました。(コード: ${error.status})`;
            }
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage = 'ネットワーク接続に問題があるようです。インターネット接続を確認してください。';
        }

        messageElement.textContent = errorMessage;
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

async function fetchClipsByIds(clipIds, token) {
    let fetchedClips = [];
    const idChunks = [];
    for (let i = 0; i < clipIds.length; i += 100) {
        idChunks.push(clipIds.slice(i, i + 100));
    }
    for (const chunk of idChunks) {
        const clipIdsParam = chunk.map(id => `id=${id}`).join('&');
        const url = `https://api.twitch.tv/helix/clips?${clipIdsParam}`;
        const response = await fetch(url, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` } });
        if (!response.ok) continue;
        const data = await response.json();
        if (data.data) fetchedClips = fetchedClips.concat(data.data);
    }
    return fetchedClips;
}

function displayClipInfo(clip, videoDetails, inputUrl) {
    messageElement.textContent = 'クリップ情報を表示します。';
    clipUrlInput.value = inputUrl;
    clipDetailCardContainer.innerHTML = '';
    renderClipsToContainer([clip], clipDetailCardContainer, videoDetails);

    const tbody = clipDetailTable.querySelector('tbody');
    tbody.innerHTML = '';
    const addRow = (label, value) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${label}</td><td>${value}</td>`;
        tbody.appendChild(tr);
    };
    const addHeaderRow = (title) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<th colspan="2" class="detail-table-header">${title}</th>`;
        tbody.appendChild(tr);
    };



    addHeaderRow('クリップの情報');
    addRow('タイトル', clip.title);
    if (clip.game_id && cachedGameDetails.has(clip.game_id)) addRow('ゲーム', cachedGameDetails.get(clip.game_id));

    // 「配信者」行をプログラムで生成
    const broadcasterRow = document.createElement('tr');
    broadcasterRow.innerHTML = `<td>配信者</td>`;
    const broadcasterTd = document.createElement('td');
    const broadcasterLink = document.createElement('a');
    broadcasterLink.href = `https://twitch.tv/${clip.broadcaster_name}`; // 元のリンク先は残す
    broadcasterLink.target = '_blank'; // 新しいタブで開く設定
    broadcasterLink.textContent = clip.broadcaster_name;
    broadcasterLink.title = '他のクリップを検索する'; // ① ホバー時のツールチップ
    broadcasterLink.style.cursor = 'pointer';
    broadcasterLink.addEventListener('click', (e) => {
        e.preventDefault(); // ② リンクを新しいタブで開く標準の動作をキャンセル
        updateView('channelSearch'); // 「チャンネル検索」タブに移動
        channelNameInput.value = clip.broadcaster_name; // 配信者IDを自動入力
        messageElement.textContent = `配信者「${clip.broadcaster_name}」のクリップ検索ができます。期間などを確認し「クリップを取得」ボタンを押してください。`;
        window.scrollTo(0, 0); // ページ最上部にスクロール
    });
    broadcasterTd.appendChild(broadcasterLink);
    broadcasterRow.appendChild(broadcasterTd);
    tbody.appendChild(broadcasterRow);

    addRow('作成者', `<a href="https://twitch.tv/${clip.creator_name}" target="_blank">${clip.creator_name}</a>`);
    addRow('視聴回数', `${clip.view_count.toLocaleString()} 回`);
    addRow('クリップ作成日時', getFormattedDateTime(new Date(clip.created_at)) + ' (JST)');

    addHeaderRow('元配信の情報');
    if (clip.video_id && videoDetails.has(clip.video_id)) {
        const vod = videoDetails.get(clip.video_id);
        const vodStartTime = new Date(vod.created_at);
        const vodDurationInSeconds = parseTwitchDuration(vod.duration);
        const vodEndTime = new Date(vodStartTime.getTime() + vodDurationInSeconds * 1000);
        const clipStartOffsetInSeconds = Math.floor(Math.max(0, clip.vod_offset - clip.duration));
        const clipEventTime = new Date(vodStartTime.getTime() + clipStartOffsetInSeconds * 1000);
        const formattedStartTime = getFormattedDateTime(vodStartTime).split(' ')[1];
        const formattedEndTime = getFormattedDateTime(vodEndTime).split(' ')[1];

        // 「配信タイトル」行をプログラムで生成
        const vodTitleRow = document.createElement('tr');
        vodTitleRow.innerHTML = `<td>配信タイトル</td>`;
        const vodTitleTd = document.createElement('td');
        const vodTitleLink = document.createElement('a');
        vodTitleLink.href = vod.url;
        vodTitleLink.target = '_blank';
        vodTitleLink.textContent = vod.title;
        vodTitleLink.title = '元配信アーカイブへ'; // ③ ホバー時のツールチップ
        vodTitleTd.appendChild(vodTitleLink);
        vodTitleRow.appendChild(vodTitleTd);
        tbody.appendChild(vodTitleRow);

        addRow('配信日', `${getFormattedDateWithoutDay(vodStartTime)} ${formattedStartTime} 〜 ${formattedEndTime} (JST)`);
        addRow('配信の長さ', formatSecondsToHMS(vodDurationInSeconds));

        // 「クリップ箇所」行をプログラムで生成
        const clipTimestampRow = document.createElement('tr');
        clipTimestampRow.innerHTML = `<td>クリップ箇所</td>`;
        const clipTimestampTd = document.createElement('td');
        const clipTimestampLink = document.createElement('a');
        clipTimestampLink.href = `${vod.url}?t=${clipStartOffsetInSeconds}s`;
        clipTimestampLink.target = '_blank';
        clipTimestampLink.textContent = `元配信 ${formatSecondsToHMS(clipStartOffsetInSeconds)}～`;
        clipTimestampLink.title = '元配信アーカイブへ'; // ④ ホバー時のツールチップ
        clipTimestampTd.appendChild(clipTimestampLink);
        clipTimestampRow.appendChild(clipTimestampTd);
        tbody.appendChild(clipTimestampRow);

        addRow('配信内での時刻', getFormattedDateTime(clipEventTime) + ' (JST)');
    } else {
        addRow('情報', '元配信のデータが見つかりませんでした。');
    }


    clipDetailActions.innerHTML = '';
    const createButton = (id, text, handler) => {
        const btn = document.createElement('button');
        btn.id = id;
        btn.textContent = text;
        btn.addEventListener('click', handler);
        clipDetailActions.appendChild(btn);
    };
    createButton('copyClipUrlBtn', 'クリップURLをコピー', () => navigator.clipboard.writeText(clip.url).then(() => showTemporaryNotification(clipDetailActions, 'クリップURLをコピー！')));
    createButton('copyEmbedTagBtn', '埋め込みタグをコピー', () => navigator.clipboard.writeText(`<iframe src="${clip.embed_url}&parent=${window.location.hostname}" frameborder="0" allowfullscreen="true" scrolling="no" height="378" width="620"></iframe>`).then(() => showTemporaryNotification(clipDetailActions, '埋め込みタグをコピー！')));
    createButton('shareOnTwitterClipBtn', 'Xで共有', () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${clip.title} - ${clip.broadcaster_name}のクリップ`)}&url=${encodeURIComponent(clip.url)}`, '_blank'));
    clipDetailSection.style.display = 'block';
    fetchRelatedClips(clip.broadcaster_id, clip.game_id);
}

// 【変更】表示処理を共通関数に切り出し、結果をキャッシュするよう修正
async function fetchSingleClipInfo() {
    if (!messageElement || !clipUrlInput) return;
    const input = clipUrlInput.value.trim();
    if (!input) { messageElement.textContent = 'クリップのURLまたはIDを入力してください。'; return; }
    logEvent('fetch_single_clip', { input: input });

    const slugRegex = /(?:clips\.twitch\.tv\/|twitch\.tv\/(?:\w+)\/clip\/)([a-zA-Z0-9_-]+)/;
    const match = input.match(slugRegex);
    let clipId;
    if (match && match[1]) { clipId = match[1]; }
    else if (/^[a-zA-Z0-9_-]+$/.test(input)) { clipId = input; }
    else { messageElement.textContent = '無効なTwitchクリップURLまたはIDです。'; clipDetailSection.style.display = 'none'; return; }

    loadingSpinner.style.display = 'flex';
    messageElement.textContent = 'クリップ情報を取得中...';
    clipDetailSection.style.display = 'none';
    cachedClipInfo = null; // 新しい検索の開始時にキャッシュをクリア

    try {
        const token = await getAccessToken();
        if (!token) { messageElement.textContent = 'Twitch認証が必要です。'; return; }

        const response = await fetch(`https://api.twitch.tv/helix/clips?id=${clipId}`, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` } });
        if (!response.ok) {
            const err = new Error(`API Error: Single Clip Fetch`);
            err.status = response.status;
            throw err;
        }
        const clipData = await response.json();
        if (!clipData.data || clipData.data.length === 0) { messageElement.textContent = 'クリップが見つかりませんでした。'; return; }

        const clip = clipData.data[0];
        const [videoDetails, _] = await Promise.all([
            (async () => {
                if (!clip.video_id) return new Map();
                const videoResponse = await fetch(`https://api.twitch.tv/helix/videos?id=${clip.video_id}`, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` } });
                if (!videoResponse.ok) return new Map();
                const videoData = await videoResponse.json();
                const map = new Map();
                if (videoData.data && videoData.data.length > 0) map.set(videoData.data[0].id, videoData.data[0]);
                return map;
            })(),
            fetchAndCacheGameDetails([clip.game_id].filter(id => id))
        ]);

        // 共通の表示関数を呼び出す
        displayClipInfo(clip, videoDetails, input);

        // 取得した情報をキャッシュに保存
        cachedClipInfo = { clip, videoDetails, input };

    } catch (error) {
        console.error('Error fetching single clip info:', error);
        let errorMessage = 'クリップ情報の取得中に不明なエラーが発生しました。';
        if (error.status) {
            // ... (エラーメッセージ処理は省略) ...
        }
        messageElement.textContent = errorMessage;
        clipDetailSection.style.display = 'none';
        cachedClipInfo = null; // エラー発生時もキャッシュをクリア
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

async function fetchRelatedClips(broadcasterId, gameId) {
    relatedBroadcasterAllTime.style.display = 'none';
    relatedBroadcasterWeekly.style.display = 'none';
    relatedGameWeekly.style.display = 'none';
    relatedBroadcasterAllTimeGrid.innerHTML = '';
    relatedBroadcasterWeeklyGrid.innerHTML = '';
    relatedGameWeeklyGrid.innerHTML = '';

    const token = await getAccessToken();
    if (!token) return;

    try {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const startedAtWeekly = oneWeekAgo.toISOString();

        const fetchClipsBy = async (param, value, period = 'all') => {
            if (!value) return [];
            let url = `https://api.twitch.tv/helix/clips?${param}=${value}&first=6&language=ja`;
            if (period === 'weekly') url += `&started_at=${startedAtWeekly}`;
            const response = await fetch(url, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` } });
            if (!response.ok) return [];
            const data = await response.json();
            return (data.data || []).sort((a, b) => b.view_count - a.view_count);
        };

        const [broadcasterClipsAllTime, broadcasterClipsWeekly, gameClipsWeekly] = await Promise.all([
            fetchClipsBy('broadcaster_id', broadcasterId, 'all'),
            fetchClipsBy('broadcaster_id', broadcasterId, 'weekly'),
            fetchClipsBy('game_id', gameId, 'weekly')
        ]);

        const allRelatedClips = [...broadcasterClipsAllTime, ...broadcasterClipsWeekly, ...gameClipsWeekly];
        const uniqueVideoIds = [...new Set(allRelatedClips.map(clip => clip.video_id).filter(id => id))];
        await fetchAndCacheGameDetails([...new Set(allRelatedClips.map(c => c.game_id).filter(id => id))]);

        const videoDetails = new Map();
        if (uniqueVideoIds.length > 0) {
            const videoIdChunks = [];
            for (let i = 0; i < uniqueVideoIds.length; i += 100) videoIdChunks.push(uniqueVideoIds.slice(i, i + 100));
            for (const chunk of videoIdChunks) {
                const videoIdsParam = chunk.map(id => `id=${id}`).join('&');
                const videoResponse = await fetch(`https://api.twitch.tv/helix/videos?${videoIdsParam}`, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` } });
                if (videoResponse.ok) {
                    const videoData = await videoResponse.json();
                    if (videoData.data) videoData.data.forEach(video => videoDetails.set(video.id, video));
                }
            }
        }

        if (broadcasterClipsAllTime.length > 0) {
            relatedBroadcasterAllTime.style.display = 'block';
            renderClipsToContainer(broadcasterClipsAllTime, relatedBroadcasterAllTimeGrid, videoDetails);
        }
        if (broadcasterClipsWeekly.length > 0) {
            relatedBroadcasterWeekly.style.display = 'block';
            renderClipsToContainer(broadcasterClipsWeekly, relatedBroadcasterWeeklyGrid, videoDetails);
        }
        if (gameClipsWeekly.length > 0) {
            relatedGameWeekly.style.display = 'block';
            renderClipsToContainer(gameClipsWeekly, relatedGameWeeklyGrid, videoDetails);
        }

    } catch (error) {
        console.error('Error fetching related clips:', error);
    }
}

/**
 * キャッシュまたはAPIから取得した人気クリップのデータを基にHTMLを生成・表示する
 * @param {Array} results - カテゴリごとのクリップ情報を含む配列
 * @param {Map} videoDetails - VOD情報のMap
 */

async function fetchPopularClips() {
    // 既にキャッシュがあれば何もしないで表示処理を呼ぶ
    if (popularClipsCache) {
        renderPopularClipsFromCache();
        return;
    }

    loadingSpinner.style.display = 'flex';
    messageElement.textContent = `人気クリップのリストを読み込み中...`;

    try {
        // ※注意: このURLはあなたの環境に合わせて修正が必要な場合があります
        const response = await fetch('https://mitarashi888.github.io/TwitchClipsViewer-V1.6.4/popular_clips.json');

        if (!response.ok) {
            throw new Error(`ランキングファイルの読み込みに失敗しました (ステータス: ${response.status})`);
        }
        popularClipsCache = await response.json();
        logEvent('popular_clips_json_loaded');

        // 読み込み完了後、キャッシュから表示
        renderPopularClipsFromCache();

    } catch (error) {
        console.error('popular_clips.jsonの取得中にエラーが発生しました:', error);
        messageElement.textContent = '人気クリップのリスト読み込みに失敗しました。';
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

/**
 * キャッシュされた人気クリップデータから、選択されたカテゴリと期間のクリップを表示する
 */
async function renderPopularClipsFromCache() {
    if (!popularClipsCache) {
        fetchPopularClips(); // キャッシュがなければ取得を試みる
        return;
    }

    const popularClipsGrid = document.getElementById('popularClipsGrid');
    popularClipsGrid.innerHTML = '';

    // アクティブなボタンから期間キーを取得
    const activeButton = document.querySelector('#popularDateRangeButtons button.active');
    if (!activeButton) return;
    const dateRangeKey = activeButton.dataset.key;

    const categoryData = popularClipsCache[selectedPopularCategory];
    const clipsToShow = categoryData ? categoryData[`clips_${dateRangeKey}`] : [];

    if (clipsToShow.length > 0) {
        messageElement.textContent = `人気クリップ ${clipsToShow.length}件を表示中 (最終更新: ${getFormattedDateTime(new Date(popularClipsCache.last_updated))})`;

        await fetchAndCacheGameDetails([...new Set(clipsToShow.map(c => c.game_id).filter(id => id))]);
        const videoDetails = await fetchAndCacheVideoDetailsForClips(clipsToShow);
        renderClips(clipsToShow, videoDetails);

    } else {
        messageElement.textContent = 'このカテゴリの人気クリップはありません。';
    }
}

/**
 * 人気クリップタブの期間選択ボタンを動的に生成し、イベントリスナーを設定する
 */
function initializePopularDateButtons() {
    const container = document.getElementById('popularDateRangeButtons');
    if (!container) return;

    container.innerHTML = '';
    const today = new Date();
    const buttons = [];

    // 日別ボタン (今日 + 過去6日)
    for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        const label = (i === 0) ? `今日` : `${month}/${day}`;
        const key = `${year}-${month}-${day}`;
        buttons.push({ label: label, key: key });
    }

    // 週・月ボタン
    buttons.push({ label: '過去1週間', key: '1week', default: true });
    buttons.push({ label: '過去1ヶ月間', key: '1month' });

    buttons.forEach(btnInfo => {
        const button = document.createElement('button');
        button.textContent = btnInfo.label;
        button.dataset.key = btnInfo.key; // JSONのキーをデータ属性に設定

        if (btnInfo.default) button.classList.add('active');

        button.addEventListener('click', () => {
            container.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            renderPopularClipsFromCache(); // クリックでキャッシュから再表示
        });
        container.appendChild(button);
    });
}

async function updateMyChannelIdDisplay() {
    const data = await chrome.storage.sync.get(['myChannelId', 'myChannelDisplayName', 'userChannelId', 'userDisplayName', 'isMyChannelSelf']);

    let myChText = '<strong>Myチャンネル:</strong> 未設定 （設定タブでチャンネルIDの登録をしてください）';
    if (data.isMyChannelSelf && data.userChannelId) {
        myChText = `<strong>Myチャンネル:</strong> ${data.userDisplayName} (${data.userChannelId}) (自身のチャンネル)`;
    } else if (data.myChannelId) {
        myChText = `<strong>Myチャンネル:</strong> ${data.myChannelDisplayName} (${data.myChannelId})`;
    }

    let selfIdText = '<strong>自身のチャンネル:</strong> 未設定 （設定タブでチャンネルIDの登録をしてください）';
    if (data.userChannelId) {
        selfIdText = `<strong>自身のチャンネル:</strong> ${data.userDisplayName} (${data.userChannelId})`;
    }

    myChannelIdText.innerHTML = `${myChText} / ${selfIdText}`;

    // クリップマネージャーボタンのロジック
    if (data.userChannelId) {
        clipManagerLink.href = `https://dashboard.twitch.tv/u/${data.userChannelId}/content/clips/channel`;
        clipManagerLink.style.display = 'inline-block';
        clipManagerLink.onclick = null; // 以前のイベントリスナーを削除
    } else {
        clipManagerLink.href = '#';
        clipManagerLink.style.display = 'inline-block';
        clipManagerLink.onclick = (e) => {
            e.preventDefault();
            showContextualPopover(clipManagerLink, '自身のチャンネルID登録が必要です', 'クリップマネージャーを開くには、まず「設定」タブでご自身のTwitchチャンネルIDを登録してください。');
        };
    }
}


async function updateMyChannelPreview() {
    const data = await chrome.storage.sync.get(['userChannelId', 'userDisplayName', 'userAvatarUrl', 'isMyChannelSelf', 'myChannelId', 'myChannelDisplayName', 'myChannelAvatarUrl']);
    if (data.isMyChannelSelf && data.userChannelId) {
        myChannelUserAvatar.src = data.userAvatarUrl;
        myChannelUserDisplayName.textContent = data.userDisplayName;
        myChannelUserPreview.style.display = 'flex';
    } else if (!data.isMyChannelSelf && data.myChannelId) {
        myChannelUserAvatar.src = data.myChannelAvatarUrl;
        myChannelUserDisplayName.textContent = data.myChannelDisplayName;
        myChannelUserPreview.style.display = 'flex';
    } else {
        myChannelUserPreview.style.display = 'none';
    }
}

//【追加】設定が未完了の場合にカードをハイライトする関数
async function checkAndHighlightSettings() {
    const selfChannelCard = document.getElementById('selfChannelSettingsCard');
    const myChannelCard = document.getElementById('myChannelSettingsCard');

    if (!selfChannelCard || !myChannelCard) return;

    const data = await chrome.storage.sync.get(['userChannelId', 'isMyChannelSelf', 'myChannelId']);

    // ① 自身のTwitchチャンネルIDが設定されているかチェック
    if (data.userChannelId) {
        selfChannelCard.classList.remove('highlight-setting-card');
    } else {
        selfChannelCard.classList.add('highlight-setting-card');
    }

    // ② Myチャンネルが設定されているかチェック
    //   (「自身をMyチャンネルに設定」がオン AND 自身のIDが設定済み) OR (手動でMyチャンネルIDが設定済み)
    const isMyChannelConfigured = (data.isMyChannelSelf && data.userChannelId) || (!data.isMyChannelSelf && data.myChannelId);
    if (isMyChannelConfigured) {
        myChannelCard.classList.remove('highlight-setting-card');
    } else {
        myChannelCard.classList.add('highlight-setting-card');
    }
}


//【変更点】キャッシュ戦略: キャッシュを読み込むロジックを実装
async function updateView(view) {
    logEvent('view_changed', { view: view });
    currentView = view;
    chrome.storage.sync.set({ 'currentView': view });

    document.querySelectorAll('.main-nav a').forEach(a => a.classList.remove('active'));
    document.getElementById(`menu${view.charAt(0).toUpperCase() + view.slice(1)}`).classList.add('active');

    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById(`${view}Section`).classList.add('active');

    clipDetailSection.style.display = 'none';
    const showClipGrid = ['channelSearch', 'favorites', 'myChannel'].includes(view);
    messageElement.style.display = 'block';
    clipsGrid.style.display = showClipGrid ? 'grid' : 'none';

    if (view === 'myChannel') {
        updateMyChannelIdDisplay();
    }

    if (clipsGrid) clipsGrid.innerHTML = '';
    messageElement.textContent = '';

    let cacheKey = view;
    let channelLoginForCache = '';
    if (view === 'channelSearch') {
        channelLoginForCache = channelNameInput.value.trim().toLowerCase();
        cacheKey = `channel_${channelLoginForCache}`;
    } else if (view === 'myChannel') {
        const settings = await chrome.storage.sync.get(['isMyChannelSelf', 'myChannelId', 'userChannelId']);
        channelLoginForCache = ((settings.isMyChannelSelf ? settings.userChannelId : settings.myChannelId) || '').toLowerCase();
        cacheKey = `mychannel_${channelLoginForCache}`;
    }

    // favorites 以外で、有効なキャッシュキーがあり、キャッシュが存在する場合
    if (view !== 'favorites' && channelLoginForCache && clipsCache[cacheKey]) {
        cachedAllClips = clipsCache[cacheKey];
        messageElement.textContent = `キャッシュから ${cachedAllClips.length} 件のクリップを読み込みました。`;
        processAndRenderClips();
    } else {
        // キャッシュがないか、favorites タブの場合
        cachedAllClips = [];
        switch (view) {
            case 'channelSearch':
                messageElement.textContent = 'チャンネルIDを入力してクリップを取得してください。';
                loadAndRenderSearchHistory();
                break;
            case 'favorites':
                fetchClips();
                break;
            case 'myChannel':
                const settings = await chrome.storage.sync.get(['isMyChannelSelf', 'myChannelId', 'userChannelId']);
                const isMyChannelReady = (settings.isMyChannelSelf && settings.userChannelId) || (!settings.isMyChannelSelf && settings.myChannelId);
                if (!isMyChannelReady) {
                    messageElement.textContent = 'Myチャンネルを使用するには、まず設定タブでチャンネルIDを登録してください。';
                    menuSettings.classList.add('highlight-for-attention');
                    showContextualPopover(menuSettings, 'Myチャンネル設定が必要です', '「Myチャンネル」機能を使うには、まずご自身のチャンネルID、または表示したい特定のチャンネルIDを設定してください。');
                } else {
                    messageElement.textContent = '期間を選択するとクリップが自動で読み込まれます。';
                    fetchClips();
                }
                break;
            case 'popular':
                fetchPopularClips();
                break;
            case 'clipInfo':
                if (cachedClipInfo) {
                    // キャッシュがあれば、それを使って表示を復元
                    messageElement.textContent = 'キャッシュからクリップ情報を復元しました。';
                    displayClipInfo(cachedClipInfo.clip, cachedClipInfo.videoDetails, cachedClipInfo.input);
                } else {
                    // キャッシュがなければ初期状態を表示
                    messageElement.textContent = 'クリップのURLまたはIDを入力して情報を取得してください。';
                    clipDetailSection.style.display = 'none';
                }
                break;
            case 'settings':
                messageElement.style.display = 'none';
                checkAndHighlightSettings();
                break;
        }
    }
}


// =========================================================
// DOMContentLoaded イベントリスナー
// =========================================================
document.addEventListener('DOMContentLoaded', () => {

    logEvent('page_loaded');

    // DOM要素の取得
    const datalist = document.createElement('datalist');
    datalist.id = 'existing-tags-list';
    document.body.appendChild(datalist);
    const myChannelDatalist = document.createElement('datalist');
    myChannelDatalist.id = 'existing-my-channel-tags-list';
    document.body.appendChild(myChannelDatalist);

    channelNameInput = document.getElementById('channelName');
    fetchClipsButton = document.getElementById('fetchClips');
    startDateInput = document.getElementById('startDate');
    endDateInput = document.getElementById('endDate');
    sortOrderSelect = document.getElementById('sortOrder');
    sortOrderFavoritesSelect = document.getElementById('sortOrderFavorites');
    dateRangePresetSelect = document.getElementById('dateRangePreset');
    favoriteStreamerFilterSelect = document.getElementById('favoriteStreamerFilter');
    clipsGrid = document.getElementById('clipsGrid');
    messageElement = document.getElementById('message');
    loadingSpinner = document.getElementById('loadingSpinner');

    menuChannelSearch = document.getElementById('menuChannelSearch');
    menuFavorites = document.getElementById('menuFavorites');
    menuMyChannel = document.getElementById('menuMyChannel');
    menuPopular = document.getElementById('menuPopular');
    menuClipInfo = document.getElementById('menuClipInfo');
    menuSettings = document.getElementById('menuSettings');

    channelSearchSection = document.getElementById('channelSearchSection');
    favoritesSection = document.getElementById('favoritesSection');
    myChannelSection = document.getElementById('myChannelSection');
    popularSection = document.getElementById('popularSection');
    clipInfoSection = document.getElementById('clipInfoSection');
    settingsSection = document.getElementById('settingsSection');

    popularClipsContainer = document.getElementById('popularClipsContainer');

    clipUrlInput = document.getElementById('clipUrlInput');
    fetchClipInfoButton = document.getElementById('fetchClipInfoButton');

    channelKeywordSearchInput = document.getElementById('channelKeywordSearch');
    favoriteKeywordSearchInput = document.getElementById('favoriteKeywordSearch');
    gameFilterContainer = document.getElementById('gameFilterContainer');
    gameFilterSelect = document.getElementById('gameFilter');
    favoriteGameFilterContainer = document.getElementById('favoriteGameFilterContainer');
    favoriteGameFilterSelect = document.getElementById('favoriteGameFilter');
    favoriteTagFilterContainer = document.getElementById('favoriteTagFilterContainer');
    favoriteTagFilterSelect = document.getElementById('favoriteTagFilter');
    myCreationsFilterToggleChannel = document.getElementById('myCreationsFilterToggleChannel');
    myCreationsFilterToggleFavorites = document.getElementById('myCreationsFilterToggleFavorites');

    userChannelIdInput = document.getElementById('userChannelIdInput');
    saveUserChannelButton = document.getElementById('saveUserChannelButton');
    userChannelMessage = document.getElementById('userChannelMessage');
    settingsUserPreview = document.getElementById('settingsUserPreview');
    settingsUserAvatar = document.getElementById('settingsUserAvatar');
    settingsUserDisplayName = document.getElementById('settingsUserDisplayName');

    exportFavoritesButton = document.getElementById('exportFavoritesButton');
    importFavoritesButton = document.getElementById('importFavoritesButton');
    importFavoritesInput = document.getElementById('importFavoritesInput');

    confirmationModal = document.getElementById('confirmationModal');
    modalMessage = document.getElementById('modalMessage');
    modalConfirmButton = document.getElementById('modalConfirmButton');
    modalCancelButton = document.getElementById('modalCancelButton');

    searchHistoryContainer = document.getElementById('searchHistoryContainer');
    searchHistoryItems = document.getElementById('searchHistoryItems');
    themeToggle = document.getElementById('theme-toggle');
    themeLabel = document.getElementById('theme-label');

    tutorialOverlay = document.getElementById('tutorialOverlay');
    tutorialPopover = document.getElementById('tutorialPopover');
    tutorialTitle = document.getElementById('tutorialTitle');
    tutorialDescription = document.getElementById('tutorialDescription');
    tutorialProgress = document.getElementById('tutorialProgress');
    tutorialSkip = document.getElementById('tutorialSkip');
    tutorialNext = document.getElementById('tutorialNext');
    tutorialDone = document.getElementById('tutorialDone');
    showTutorialButton = document.getElementById('showTutorialButton');

    clipDetailSection = document.getElementById('clipDetailSection');
    clipDetailCardContainer = document.getElementById('clipDetailCardContainer');
    clipDetailInfoContainer = document.getElementById('clipDetailInfoContainer');
    clipDetailTable = document.getElementById('clipDetailTable');
    clipDetailActions = document.getElementById('clipDetailActions');
    relatedClipsSection = document.getElementById('relatedClipsSection');
    relatedBroadcasterAllTime = document.getElementById('relatedBroadcasterAllTime');
    relatedBroadcasterAllTimeGrid = document.getElementById('relatedBroadcasterAllTimeGrid');
    relatedBroadcasterWeekly = document.getElementById('relatedBroadcasterWeekly');
    relatedBroadcasterWeeklyGrid = document.getElementById('relatedBroadcasterWeeklyGrid');
    relatedGameWeekly = document.getElementById('relatedGameWeekly');
    relatedGameWeeklyGrid = document.getElementById('relatedGameWeeklyGrid');

    myChannelStartDateInput = document.getElementById('myChannelStartDate');
    myChannelEndDateInput = document.getElementById('myChannelEndDate');
    myChannelDateRangePresetSelect = document.getElementById('myChannelDateRangePreset');
    myChannelKeywordSearchInput = document.getElementById('myChannelKeywordSearch');
    myChannelCreatorFilter = document.getElementById('myChannelCreatorFilter');
    myChannelGameFilter = document.getElementById('myChannelGameFilter');
    myChannelTagFilter = document.getElementById('myChannelTagFilter');
    sortOrderMyChannel = document.getElementById('sortOrderMyChannel');
    myChannelCreatorFilterContainer = document.getElementById('myChannelCreatorFilterContainer');
    myChannelGameFilterContainer = document.getElementById('myChannelGameFilterContainer');
    myChannelTagFilterContainer = document.getElementById('myChannelTagFilterContainer');
    myCreationsFilterToggleMyChannel = document.getElementById('myCreationsFilterToggleMyChannel');
    favoritesOnlyToggleMyChannel = document.getElementById('favoritesOnlyToggleMyChannel');
    setMyChannelToSelfCheckbox = document.getElementById('setMyChannelToSelf');
    myChannelIdInput = document.getElementById('myChannelIdInput');
    saveMyChannelButton = document.getElementById('saveMyChannelButton');
    myChannelMessage = document.getElementById('myChannelMessage');
    myChannelUserPreview = document.getElementById('myChannelUserPreview');
    myChannelUserAvatar = document.getElementById('myChannelUserAvatar');
    myChannelUserDisplayName = document.getElementById('myChannelUserDisplayName');
    myChannelIdDisplay = document.getElementById('myChannelIdDisplay');
    myChannelIdText = document.getElementById('myChannelIdText');
    clipManagerLink = document.getElementById('clipManagerLink');

    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 6);
    startDateInput.value = getFormattedDate(oneWeekAgo);
    endDateInput.value = getFormattedDate(today);
    myChannelStartDateInput.value = getFormattedDate(oneWeekAgo);
    myChannelEndDateInput.value = getFormattedDate(today);
    dateRangePresetSelect.value = '1week';
    myChannelDateRangePresetSelect.value = '1week';

    chrome.storage.sync.get([
        'twitchSortOrder', 'twitchSortOrderFavorites', 'sortOrderMyChannel',
        'favoriteClips', 'myChannelClipsTags',
        'currentView', 'userChannelId', 'userDisplayName', 'userAvatarUrl', 'theme',
        'isMyChannelSelf', 'myChannelId', 'myChannelDisplayName', 'myChannelAvatarUrl'
    ], async (data) => {
        sortOrderSelect.value = data.twitchSortOrder || 'newest';
        sortOrderFavoritesSelect.value = data.twitchSortOrderFavorites || 'newest';
        sortOrderMyChannel.value = data.sortOrderMyChannel || 'newest';
        favoriteClips = data.favoriteClips || {};
        myChannelClipsTags = data.myChannelClipsTags || {};
        userChannelId = data.userChannelId || '';
        userDisplayName = data.userDisplayName || '';
        if (userChannelId) {
            userChannelIdInput.value = userChannelId;
            settingsUserAvatar.src = data.userAvatarUrl;
            settingsUserDisplayName.textContent = userDisplayName;
            settingsUserPreview.style.display = 'flex';
        }

        setMyChannelToSelfCheckbox.checked = !!data.isMyChannelSelf;
        myChannelIdInput.disabled = setMyChannelToSelfCheckbox.checked;
        if (setMyChannelToSelfCheckbox.checked) {
            myChannelIdInput.value = userChannelId;
        } else {
            myChannelIdInput.value = data.myChannelId || '';
        }

        updateMyChannelPreview();


        if (data.theme === 'light') {
            document.body.classList.add('light-theme');
            themeToggle.checked = true;
            themeLabel.textContent = 'ライトモード';
        }

        const lastView = data.currentView || 'channelSearch';
        updateView(lastView);

        const urlParams = new URLSearchParams(window.location.search);
        const channelFromUrl = urlParams.get('channel');
        if (channelFromUrl) {
            updateView('channelSearch');
            channelNameInput.value = channelFromUrl;
            fetchClips();
        }
        checkAndHighlightSettings();
    });

    chrome.storage.local.get('hasShownTutorial', (data) => { if (!data.hasShownTutorial) setTimeout(startTutorial, 500); });

    menuChannelSearch.addEventListener('click', (e) => { e.preventDefault(); updateView('channelSearch'); });
    menuFavorites.addEventListener('click', (e) => { e.preventDefault(); updateView('favorites'); });
    menuMyChannel.addEventListener('click', (e) => { e.preventDefault(); updateView('myChannel'); });
    menuPopular.addEventListener('click', (e) => { e.preventDefault(); updateView('popular'); });
    menuClipInfo.addEventListener('click', (e) => { e.preventDefault(); updateView('clipInfo'); });
    menuSettings.addEventListener('click', (e) => { e.preventDefault(); updateView('settings'); });

    initializePopularDateButtons();

    const popularCategoryButtonsContainer = document.getElementById('popularCategoryButtons');
    popularCategoryButtonsContainer.innerHTML = '';
    let currentGroup = null;
    let groupWrapper = null;

    POPULAR_CATEGORIES.forEach(category => {
        if (category.group !== currentGroup) {
            currentGroup = category.group;
            groupWrapper = document.createElement('div');
            groupWrapper.classList.add('popular-category-group');
            popularCategoryButtonsContainer.appendChild(groupWrapper);
        }

        const button = document.createElement('button');
        button.textContent = category.name;
        button.dataset.categoryId = category.id;
        if (category.id === selectedPopularCategory) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            selectedPopularCategory = category.id;
            document.querySelectorAll('.popular-category-buttons button').forEach(btn => {
                btn.classList.remove('active');
            });
            button.classList.add('active');

            // キャッシュから表示を試みる
            renderPopularClipsFromCache();
        });
        groupWrapper.appendChild(button);
    });

    fetchClipsButton.addEventListener('click', fetchClips);
    fetchClipInfoButton.addEventListener('click', fetchSingleClipInfo);

    const showMessage = (element, text, duration = 3000) => {
        element.textContent = text;
        if (duration > 0) setTimeout(() => { element.textContent = ''; }, duration);
    };

    saveUserChannelButton.addEventListener('click', async () => {
        const newChannelId = userChannelIdInput.value.trim();
        showMessage(userChannelMessage, '保存中...', 0);
        if (!newChannelId) {
            await chrome.storage.sync.remove(['userChannelId', 'userDisplayName', 'userAvatarUrl']);
            userChannelId = '';
            userDisplayName = '';
            userChannelIdInput.value = '';
            settingsUserPreview.style.display = 'none';
            if (setMyChannelToSelfCheckbox.checked) myChannelIdInput.value = '';
            showMessage(userChannelMessage, '自身のチャンネルIDを削除しました。');
            updateMyChannelPreview();
            updateMyChannelIdDisplay();
            logEvent('user_channel_id_removed'); // 削除イベントをログに記録
            checkAndHighlightSettings();
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(newChannelId)) {
            showMessage(userChannelMessage, 'エラー: 無効なチャンネルID形式です。');
            return;
        }

        loadingSpinner.style.display = 'flex';
        try {
            const token = await getAccessToken();
            if (!token) { showMessage(userChannelMessage, 'エラー: Twitch APIに接続できません。'); return; }
            const userResponse = await fetch(`https://api.twitch.tv/helix/users?login=${newChannelId}`, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` } });
            const userData = await userResponse.json();
            if (!userData.data || userData.data.length === 0) {
                showMessage(userChannelMessage, 'エラー: チャンネルが見つかりません。');
                return;
            }

            const twitchUser = userData.data[0];
            userChannelId = twitchUser.login;
            userDisplayName = twitchUser.display_name;
            await chrome.storage.sync.set({ userChannelId: userChannelId, userDisplayName: userDisplayName, userAvatarUrl: twitchUser.profile_image_url });

            userChannelIdInput.value = userChannelId;
            settingsUserAvatar.src = twitchUser.profile_image_url;
            settingsUserDisplayName.textContent = userDisplayName;
            settingsUserPreview.style.display = 'flex';
            if (setMyChannelToSelfCheckbox.checked) myChannelIdInput.value = userChannelId;

            showMessage(userChannelMessage, `設定を保存しました: ${userDisplayName}`);
            logEvent('user_channel_id_saved', { channelId: twitchUser.login, displayName: twitchUser.display_name });
            await updateMyChannelPreview();
            await updateMyChannelIdDisplay();
            checkAndHighlightSettings();

        } catch (error) {
            console.error('Error saving user channel:', error);
            showMessage(userChannelMessage, 'エラー: 保存中に問題が発生しました。');
        } finally {
            loadingSpinner.style.display = 'none';
        }
    });

    saveMyChannelButton.addEventListener('click', async () => {
        // チェックボックスがオンの場合は、チェック時のイベントで自動保存済みのため、このボタンは何もしない
        if (setMyChannelToSelfCheckbox.checked) {
            showMessage(myChannelMessage, '「自身のチャンネルをMyチャンネルに設定」が有効です。設定は自動で保存されています。');
            return;
        }

        // 以下はチェックボックスがオフ（手動入力モード）の場合の処理
        const myChannelId = myChannelIdInput.value.trim();
        showMessage(myChannelMessage, '保存中...', 0);

        if (!myChannelId) {
            await chrome.storage.sync.remove(['myChannelId', 'myChannelDisplayName', 'myChannelAvatarUrl']);
            await chrome.storage.sync.set({ isMyChannelSelf: false });
            showMessage(myChannelMessage, 'Myチャンネル設定を削除しました。');
            logEvent('my_channel_id_removed'); // 削除イベントをログに記録
            await updateMyChannelIdDisplay();
            await updateMyChannelPreview();
            checkAndHighlightSettings();
            return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(myChannelId)) {
            showMessage(myChannelMessage, 'エラー: 無効なチャンネルID形式です。');
            return;
        }

        loadingSpinner.style.display = 'flex';
        try {
            const token = await getAccessToken();
            if (!token) { showMessage(myChannelMessage, 'エラー: Twitch APIに接続できません。'); return; }
            const userResponse = await fetch(`https://api.twitch.tv/helix/users?login=${myChannelId}`, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` } });
            const userData = await userResponse.json();
            if (!userData.data || userData.data.length === 0) {
                showMessage(myChannelMessage, 'エラー: チャンネルが見つかりません。');
                return;
            }
            const twitchUser = userData.data[0];
            await chrome.storage.sync.set({
                isMyChannelSelf: false,
                myChannelId: twitchUser.login,
                myChannelDisplayName: twitchUser.display_name,
                myChannelAvatarUrl: twitchUser.profile_image_url
            });

            myChannelIdInput.value = twitchUser.login;
            showMessage(myChannelMessage, `Myチャンネルを設定しました: ${twitchUser.display_name}`);
            logEvent('my_channel_id_saved', { channelId: twitchUser.login, displayName: twitchUser.display_name });
            await updateMyChannelIdDisplay();
            await updateMyChannelPreview();
            checkAndHighlightSettings();
        } catch (error) {
            console.error('Error saving My channel:', error);
            showMessage(myChannelMessage, 'エラー: 保存中に問題が発生しました。');
        } finally {
            loadingSpinner.style.display = 'none';
        }
    });

    // 「自身のチャンネルをMyチャンネルに設定」チェックボックスのイベントリスナーを修正
    setMyChannelToSelfCheckbox.addEventListener('change', async () => {
        const isChecked = setMyChannelToSelfCheckbox.checked;
        myChannelIdInput.disabled = isChecked;
        showMessage(myChannelMessage, '設定を適用中...', 0);

        if (isChecked) {
            // チェックが入った時の処理：自身のチャンネルIDをMyチャンネルとして自動保存
            const { userChannelId: selfId, userDisplayName: selfDisplayName } = await chrome.storage.sync.get(['userChannelId', 'userDisplayName']);
            if (!selfId) {
                // 自身のチャンネルIDが未設定の場合はエラーを表示し、チェックを元に戻す
                setMyChannelToSelfCheckbox.checked = false;
                myChannelIdInput.disabled = false;
                showMessage(myChannelMessage, '先に「① 自身のTwitchチャンネルID」を保存してください。');
                return;
            }

            myChannelIdInput.value = selfId;
            await chrome.storage.sync.set({
                isMyChannelSelf: true,
                // isMyChannelSelf が true の場合、以下の項目は不要なので空にする
                myChannelId: '',
                myChannelDisplayName: '',
                myChannelAvatarUrl: ''
            });
            showMessage(myChannelMessage, '自身のチャンネルをMyチャンネルに設定しました。');
            logEvent('my_channel_set_to_self', { channelId: selfId, displayName: selfDisplayName });
        } else {
            // チェックが外れた時の処理：手動入力モードに戻す
            await chrome.storage.sync.set({ isMyChannelSelf: false });
            const { myChannelId } = await chrome.storage.sync.get('myChannelId');
            myChannelIdInput.value = myChannelId || '';
            showMessage(myChannelMessage, 'Myチャンネルを手動設定モードに切り替えました。');
            logEvent('my_channel_set_to_manual');
        }

        // プレビューと表示を更新
        await updateMyChannelPreview();
        await updateMyChannelIdDisplay();
        checkAndHighlightSettings();
    });

    //【変更点】入力のデバウンス (Debounce)
    const debouncedFetchClipsForMyChannel = debounce(() => {
        if (currentView === 'myChannel') {
            fetchClips();
        }
    }, 800);

    [myChannelStartDateInput, myChannelEndDateInput, myChannelDateRangePresetSelect].forEach(el => {
        el.addEventListener('change', debouncedFetchClipsForMyChannel);
    });


    const setupDatePresetListener = (presetSelect, startInput, endInput) => {
        presetSelect.addEventListener('change', () => {
            const preset = presetSelect.value;
            const today = new Date();
            let newStartDate = new Date();
            if (preset !== 'custom') {
                if (preset === 'today') { }
                else if (preset === '3days') newStartDate.setDate(today.getDate() - 2);
                else if (preset === '1week') newStartDate.setDate(today.getDate() - 6);
                else if (preset === '1month') newStartDate.setMonth(today.getMonth() - 1);
                else if (preset === '3months') newStartDate.setMonth(today.getMonth() - 3);
                else if (preset === '6months') newStartDate.setMonth(today.getMonth() - 6);
                else if (preset === '1year') newStartDate.setFullYear(today.getFullYear() - 1);
                else if (preset === 'alltime') newStartDate = new Date('2015-01-01T00:00:00Z');
                startInput.value = getFormattedDate(newStartDate);
                endInput.value = getFormattedDate(today);

                // MyChannel の場合、プリセット変更でもデバウンスされたフェッチをトリガー
                if (presetSelect.id === 'myChannelDateRangePreset') {
                    debouncedFetchClipsForMyChannel();
                }
            }
        });
    };
    setupDatePresetListener(dateRangePresetSelect, startDateInput, endDateInput);
    setupDatePresetListener(myChannelDateRangePresetSelect, myChannelStartDateInput, myChannelEndDateInput);

    const setCustomPreset = (presetSelect) => () => { presetSelect.value = 'custom'; };
    [startDateInput, endDateInput].forEach(el => el.addEventListener('change', setCustomPreset(dateRangePresetSelect)));
    [myChannelStartDateInput, myChannelEndDateInput].forEach(el => el.addEventListener('change', setCustomPreset(myChannelDateRangePresetSelect)));

    const addFilterListeners = () => {
        const filters = [
            { el: sortOrderSelect, storageKey: 'twitchSortOrder', view: 'channelSearch' },
            { el: sortOrderFavoritesSelect, storageKey: 'twitchSortOrderFavorites', view: 'favorites' },
            { el: sortOrderMyChannel, storageKey: 'sortOrderMyChannel', view: 'myChannel' },
            { el: favoriteStreamerFilterSelect, view: 'favorites' },
            { el: myChannelCreatorFilter, view: 'myChannel' },
            { el: favoriteTagFilterSelect, view: 'favorites' },
            { el: myChannelTagFilter, view: 'myChannel' },
            { el: channelKeywordSearchInput, view: 'channelSearch', event: 'input' },
            { el: favoriteKeywordSearchInput, view: 'favorites', event: 'input' },
            { el: myChannelKeywordSearchInput, view: 'myChannel', event: 'input' },
            { el: gameFilterSelect, view: 'channelSearch' },
            { el: favoriteGameFilterSelect, view: 'favorites' },
            { el: myChannelGameFilter, view: 'myChannel' },
            { el: favoritesOnlyToggleMyChannel, view: 'myChannel' },
        ];
        filters.forEach(filter => {
            if (filter.el) {
                filter.el.addEventListener(filter.event || 'change', () => {
                    if (filter.storageKey) chrome.storage.sync.set({ [filter.storageKey]: filter.el.value });
                    logEvent('filter_applied', { view: filter.view, value: filter.el.value });
                    if (cachedAllClips.length > 0) processAndRenderClips();
                });
            }
        });
    };
    addFilterListeners();


    const myCreationsToggleHandler = (event) => {
        const toggle = event.target;
        if (toggle.checked && !userChannelId) {
            toggle.checked = false;
            menuSettings.classList.add('highlight-for-attention');
            showContextualPopover(toggle, 'チャンネルIDの登録が必要です', '「自分が作成したクリップ」で絞り込むには、まず「設定」タブでご自身のTwitchチャンネルIDを登録してください。');
        } else {
            const view = toggle.id.includes('Channel') ? 'channelSearch' : toggle.id.includes('Favorites') ? 'favorites' : 'myChannel';
            logEvent('filter_applied', { view: view, value: toggle.checked });
            processAndRenderClips();
        }
    };
    [myCreationsFilterToggleChannel, myCreationsFilterToggleFavorites, myCreationsFilterToggleMyChannel].forEach(el => el.addEventListener('change', myCreationsToggleHandler));

    themeToggle.addEventListener('change', () => {
        const isLight = themeToggle.checked;
        document.body.classList.toggle('light-theme', isLight);
        themeLabel.textContent = isLight ? 'ライトモード' : 'ダークモード';
        chrome.storage.sync.set({ theme: isLight ? 'light' : 'dark' });
        logEvent('theme_changed', { theme: isLight ? 'light' : 'dark' });
    });

    exportFavoritesButton.addEventListener('click', () => {
        if (Object.keys(favoriteClips).length === 0) { alert('エクスポートするお気に入りがありません。'); return; }
        if (currentView !== 'favorites' || cachedAllClips.length === 0) { alert('まず「お気に入りクリップ」タブでクリップ一覧を読み込んでください。'); return; }
        const headers = ['clip_id', 'title', 'url', 'creator_name', 'broadcaster_name', 'view_count', 'created_at', 'game_name', 'tags'];
        const favoritedClipsData = cachedAllClips.filter(clip => favoriteClips.hasOwnProperty(clip.id));
        const csvRows = [headers.join(',')];
        favoritedClipsData.forEach(clip => {
            const gameName = clip.game_id && cachedGameDetails.has(clip.game_id) ? cachedGameDetails.get(clip.game_id) : '';
            const tags = favoriteClips[clip.id] ? favoriteClips[clip.id].join(';') : '';
            csvRows.push([clip.id, clip.title, clip.url, clip.creator_name, clip.broadcaster_name, clip.view_count, clip.created_at, gameName, tags].map(escapeCsvField).join(','));
        });
        const csvContent = '\uFEFF' + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `twitch_clips_viewer_favorites_${getFormattedDate(new Date())}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    });

    importFavoritesButton.addEventListener('click', () => importFavoritesInput.click());
    importFavoritesInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const rows = e.target.result.split(/\r?\n/).map(row => row.trim()).filter(row => row);
                if (rows.length < 2) throw new Error('ファイルが空か、形式が不正です。');
                const header = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
                const idIndex = header.indexOf('clip_id');
                const tagsIndex = header.indexOf('tags');
                if (idIndex === -1) throw new Error('ヘッダーに "clip_id" が見つかりません。');
                let newCount = 0;
                for (let i = 1; i < rows.length; i++) {
                    const columns = [];
                    const regex = /(?:"([^"]*(?:""[^"]*)*)"|([^,]*))(,|$)/g;
                    let match;
                    while ((match = regex.exec(rows[i]))) {
                        columns.push(match[1] ? match[1].replace(/""/g, '"') : match[2]);
                        if (match[3] === '') break;
                    }
                    const clipId = columns[idIndex];
                    if (clipId) {
                        const tags = tagsIndex !== -1 && columns[tagsIndex] ? columns[tagsIndex].split(';').map(t => t.trim().toLowerCase()).filter(Boolean) : [];
                        if (!favoriteClips[clipId]) newCount++;
                        const existingTags = new Set(favoriteClips[clipId] || []);
                        tags.forEach(t => existingTags.add(t));
                        favoriteClips[clipId] = [...existingTags];
                    }
                }
                saveFavoriteClips();
                alert(`${newCount} 件の新しいクリップをインポートしました。`);
                if (currentView === 'favorites') fetchClips();
            } catch (error) {
                alert('ファイルの読み込みに失敗しました。\n' + error.message);
            } finally {
                importFavoritesInput.value = '';
            }
        };
        reader.readAsText(file, 'UTF-8');
    });

    confirmationModal.addEventListener('click', (e) => {
        if (e.target.id === 'modalConfirmButton' && modalConfirmCallback) modalConfirmCallback();
        if (['modalConfirmButton', 'modalCancelButton', 'confirmationModal'].includes(e.target.id)) {
            confirmationModal.style.display = 'none';
            modalConfirmCallback = null;
        }
    });

    tutorialNext.addEventListener('click', () => { currentTutorialStep++; showTutorialStep(currentTutorialStep); });
    tutorialDone.addEventListener('click', () => isContextualPopoverActive ? hideContextualPopover() : endTutorial());
    tutorialSkip.addEventListener('click', endTutorial);
    showTutorialButton.addEventListener('click', () => { updateView('channelSearch'); setTimeout(startTutorial, 100); });

    const shareOnTwitterBtn = document.getElementById('shareOnTwitterBtn');
    if (shareOnTwitterBtn) {
        shareOnTwitterBtn.addEventListener('click', () => {
            const storeUrl = 'https://chromewebstore.google.com/detail/twitch%E3%82%AF%E3%83%AA%E3%83%83%E3%83%97%E3%83%93%E3%83%A5%E3%83%BC%E3%82%A2/kfjgbhjokopbpabnlgncnadgdminocfc';
            const tweetText = 'Twitchのクリップ検索やお気に入り登録ができる拡張機能「Twitchクリップビューア」が便利！\n\n#Twitchクリップビューア\n';
            const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(storeUrl)}`;
            window.open(twitterIntentUrl, '_blank', 'noopener,noreferrer');
            logEvent("share_on_twitter", { from: 'settings_page' });
        });
    }
});

initializePopularDateButtons();

// ファイルの末尾など、関数の外側に追加
/**
 * 人気クリップタブの期間選択ボタンを動的に生成し、イベントリスナーを設定する
 */
/**
 * 人気クリップタブの期間選択ボタンを動的に生成し、イベントリスナーを設定する
 */
function initializePopularDateButtons() {
    const container = document.getElementById('popularDateRangeButtons');
    if (!container) return;

    container.innerHTML = ''; // コンテナを初期化
    const today = new Date();
    const buttons = [];

    // 「今日」ボタン
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    buttons.push({
        label: `今日 (${today.getMonth() + 1}/${today.getDate()})`,
        startDate: todayStart.toISOString(),
        endDate: today.toISOString(),
    });

    // 過去6日間のボタン
    for (let i = 1; i <= 6; i++) {
        const date = new Date();
        date.setDate(today.getDate() - i);
        const dateStart = new Date(date);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);
        buttons.push({
            label: `${date.getMonth() + 1}/${date.getDate()}`,
            startDate: dateStart.toISOString(),
            endDate: dateEnd.toISOString(),
        });
    }

    // 「過去1週間」ボタン
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    buttons.push({
        label: '過去1週間',
        startDate: oneWeekAgo.toISOString(),
        endDate: today.toISOString(),
        default: true // デフォルト選択
    });

    // 「過去1ヶ月間」ボタン
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);
    buttons.push({
        label: '過去1ヶ月間',
        startDate: oneMonthAgo.toISOString(),
        endDate: today.toISOString(),
    });

    buttons.forEach(btnInfo => {
        const button = document.createElement('button');
        button.textContent = btnInfo.label;
        button.dataset.startDate = btnInfo.startDate;
        button.dataset.endDate = btnInfo.endDate;

        if (btnInfo.default) button.classList.add('active');

        button.addEventListener('click', () => {
            container.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            fetchPopularClips(); // クリックで再取得
        });
        container.appendChild(button);
    });
}