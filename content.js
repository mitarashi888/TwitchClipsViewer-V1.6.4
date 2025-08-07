// content.js

const CLIENT_ID = 'y9cudfms3l5zbluftsf0zp1fad9wyi';

/**
 * Copies a clip's URL to the clipboard by simulating clicks.
 * @param {HTMLElement} row The clip row element.
 * @returns {Promise<string|null>} The copied clip URL or null if failed.
 */
async function getClipUrlByCopy(row) {
    const shareButton = row.querySelector('button[aria-label$="を共有"]');
    if (!shareButton) return null;

    let capturedUrl = null;
    const originalWriteText = navigator.clipboard.writeText;
    navigator.clipboard.writeText = (text) => {
        capturedUrl = text;
        return Promise.resolve();
    };

    try {
        shareButton.click();

        let copyLinkButton = null;
        for (let i = 0; i < 20; i++) {
            copyLinkButton = Array.from(document.querySelectorAll('button div'))
                .find(el => el.textContent === 'リンクをコピー')?.parentElement;
            if (copyLinkButton) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!copyLinkButton) {
            throw new Error("Copy Link button not found.");
        }

        copyLinkButton.click();

        await new Promise(resolve => setTimeout(resolve, 50));

        // Close the share menu if it's still open
        const closeButton = document.querySelector('[aria-label="閉じる"]');
        if (closeButton) {
            closeButton.click();
        } else {
            // As a fallback, click the share button again if no generic close button is found
            shareButton.click();
        }

        return capturedUrl;

    } catch (error) {
        console.error("Failed to get clip URL via copy simulation:", error);
        return null;
    } finally {
        navigator.clipboard.writeText = originalWriteText;
    }
}


/**
 * クリップのダウンロード処理を実行するコア関数
 */
async function performClipDownload() {
    try {
        const findVideoPromise = new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 20;
            const intervalId = setInterval(() => {
                const videoElement = document.querySelector('video');
                if (videoElement && videoElement.src && videoElement.src.startsWith('https://')) {
                    clearInterval(intervalId);
                    resolve(videoElement);
                    return;
                }
                attempts++;
                if (attempts >= maxAttempts) {
                    clearInterval(intervalId);
                    reject(new Error("時間内に動画プレイヤーを見つけられませんでした。"));
                }
            }, 500);
        });

        const videoElement = await findVideoPromise;
        const videoUrl = videoElement.src;

        const slugRegex = /(?:clips\.twitch\.tv\/|twitch\.tv\/(?:\w+)\/clip\/)([a-zA-Z0-9_-]+)/;
        const match = window.location.href.match(slugRegex);
        if (!match || !match[1]) throw new Error("URLからクリップIDを抽出できませんでした。");
        const currentClipId = match[1];

        const tokenResponse = await chrome.runtime.sendMessage({ action: 'getTwitchAccessToken' });
        if (!tokenResponse || !tokenResponse.token) throw new Error("Twitchのアクセストークンを取得できませんでした。");
        const accessToken = tokenResponse.token;

        const clipDetails = await fetchClipDetails(currentClipId, accessToken);

        let broadcasterName, clipTitle;
        if (clipDetails) {
            broadcasterName = clipDetails.broadcaster_name;
            clipTitle = clipDetails.title;
        } else {
            console.warn("[Twitch Clip Viewer] APIでのクリップ情報取得に失敗。ページの見た目から情報を取得します。");
            const getText = (selectors) => {
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element) return element.textContent.trim();
                }
                return '';
            };
            clipTitle = getText(['h2[data-a-target="clp-clip-title"]', '.tw-font-size-3.tw-semibold']) || 'clip';
            broadcasterName = getText(['a[data-a-target="stream-title"] .tw-title', '.channel-info-content a .tw-title']) || 'streamer';
        }

        const safeTitle = clipTitle.replace(/[\/\\?%*:|"<>]/g, '-');
        const safeBroadcaster = broadcasterName.replace(/[\/\\?%*:|"<>]/g, '-');
        const filename = `${safeBroadcaster}_${safeTitle}_clip.mp4`;

        chrome.runtime.sendMessage({ action: 'downloadClip', url: videoUrl, filename: filename, clipDetails: clipDetails });

    } catch (error) {
        console.error('[Twitch Clip Viewer] Download failed:', error.message);
        alert(`クリップのダウンロードに失敗しました。\n理由: ${error.message}`);
    }
}

(function () {
    if (window.location.hash === '#auto-click-download=true') {
        history.replaceState(null, document.title, window.location.pathname + window.location.search);
        setTimeout(() => {
            performClipDownload();
        }, 3000);
    }
})();

const observer = new MutationObserver(() => {
    injectTopButton();
    injectChannelButton();
    injectClipPageButton();
    injectDashboardButton();
    injectClipManagerFavoriteButton();
    injectExpandedClipManagerFavoriteButton();
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});

async function fetchClipDetails(clipId, token) {
    if (!token) {
        console.error("Twitch API token is not available.");
        return null;
    }
    const API_URL = `https://api.twitch.tv/helix/clips?id=${clipId}`;
    try {
        const response = await fetch(API_URL, {
            headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            console.error(`Twitch API Error: ${response.status}`);
            return null;
        }
        const data = await response.json();
        return data.data[0] || null;
    } catch (error) {
        console.error("Error fetching clip details:", error);
        return null;
    }
}

function injectTopButton() {
    if (document.getElementById('clip-viewer-top-btn')) return;
    const searchBarContainer = document.querySelector('[data-a-target="tray-search-input"]');
    if (searchBarContainer) {
        const buttonWrapper = document.createElement('div');
        buttonWrapper.id = 'clip-viewer-top-btn';
        buttonWrapper.className = 'custom-twitch-button top-button';
        buttonWrapper.title = 'Twitch クリップビューアを開く';
        const iconUrl = chrome.runtime.getURL("icons/icon48.png");
        buttonWrapper.innerHTML = `<img src="${iconUrl}" alt="Clips">`;
        buttonWrapper.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            chrome.runtime.sendMessage({ action: 'openClipsPage' });
        };
        searchBarContainer.appendChild(buttonWrapper);
    }
}

function injectDashboardButton() {
    if (document.getElementById('clip-viewer-dashboard-btn')) return;
    const searchBarContainer = document.querySelector('input[placeholder^="ダッシュボード検索"]')?.closest('.tw-combo-input');
    if (searchBarContainer) {
        const buttonWrapper = document.createElement('div');
        buttonWrapper.id = 'clip-viewer-dashboard-btn';
        buttonWrapper.className = 'custom-twitch-button top-button';
        buttonWrapper.title = 'Twitch クリップビューアを開く';
        buttonWrapper.style.marginLeft = "1rem";
        const iconUrl = chrome.runtime.getURL("icons/icon48.png");
        buttonWrapper.innerHTML = `<img src="${iconUrl}" alt="Clips">`;
        buttonWrapper.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            chrome.runtime.sendMessage({ action: 'openClipsPage' });
        };
        searchBarContainer.appendChild(buttonWrapper);
    }
}

/**
 * クリップマネージャーの行にお気に入りボタンを挿入するメイン関数
 * 折りたたまれた行も展開された行も、ここを通過する
 */
function injectClipManagerFavoriteButton() {
    // すべてのクリップ行を対象にする
    const clipRows = document.querySelectorAll('div[role="row"]');

    clipRows.forEach(row => {
        const shareButton = row.querySelector('button[aria-label$="を共有"]');
        if (!shareButton) return; // シェアボタンがなければ処理しない

        const parent = shareButton.parentElement;
        if (!parent) return;

        // 既にボタンがあれば、何もしない（これが重要）
        if (parent.querySelector('.clip-manager-fav-button')) {
            return;
        }

        let key = null;
        const thumbnail = row.querySelector('img.clips-manager-table__source-preview-thumbnail--sSbKb');
        if (thumbnail && thumbnail.src.includes('thumbnails-prod')) {
            const slugMatch = thumbnail.src.match(/thumbnails-prod\/([^/]+)/);
            if (slugMatch && slugMatch[1]) {
                key = slugMatch[1];
            }
        }

        parent.style.display = 'flex';
        parent.style.alignItems = 'center';

        const favoriteButton = document.createElement('button');
        favoriteButton.className = 'custom-twitch-button clip-manager-fav-button';
        favoriteButton.innerHTML = '★';

        if (key) {
            // --- IDが取得できたクリップの処理 ---
            const clipId = key;
            const updateButtonState = (isFavorited) => {
                favoriteButton.dataset.favorited = isFavorited;
                favoriteButton.title = isFavorited ? 'お気に入りから削除' : 'お気に入りに追加';
                favoriteButton.style.color = isFavorited ? 'gold' : '#efeff1';
                favoriteButton.style.backgroundColor = isFavorited ? '#9147ff' : '#53535f';
            };

            chrome.storage.sync.get({ favoriteClips: {} }, (data) => {
                updateButtonState(data.favoriteClips.hasOwnProperty(clipId));
            });

            favoriteButton.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isCurrentlyFavorited = favoriteButton.dataset.favorited === 'true';

                if (isCurrentlyFavorited) {
                    if (window.confirm('このクリップをお気に入りから削除しますか？')) {
                        chrome.runtime.sendMessage({ action: 'removeClipFromFavorites', clipId: clipId }, (response) => {
                            if (response?.success) updateButtonState(false);
                        });
                    }
                } else {
                    const tokenResponse = await new Promise(resolve => chrome.runtime.sendMessage({ action: 'getTwitchAccessToken' }, resolve));
                    if (!tokenResponse.token) { alert('Twitch認証が必要です。'); return; }
                    const clipDetails = await fetchClipDetails(clipId, tokenResponse.token);
                    if (!clipDetails) { alert('APIからクリップ情報の取得に失敗しました。'); return; }
                    let gameName = '';
                    if (clipDetails.game_id) {
                        try {
                            const gameDetailsResponse = await fetch(`https://api.twitch.tv/helix/games?id=${clipDetails.game_id}`, {
                                headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${tokenResponse.token}` }
                            });
                            if (gameDetailsResponse.ok) {
                                const gameData = await gameDetailsResponse.json();
                                gameName = (gameData.data && gameData.data.length > 0) ? gameData.data[0].name : '';
                            }
                        } catch (error) { console.error('Error fetching game details:', error); }
                    }
                    chrome.runtime.sendMessage({
                        action: 'addClipToFavorites',
                        clipDetails: { ...clipDetails, game_name: gameName }
                    }, (res) => {
                        if (res?.success) updateButtonState(true);
                    });
                }
            };
        } else {
            // --- IDが取得できなかったクリップの処理 ---
            favoriteButton.title = 'このクリップは古い形式のため、ボタンでお気に入り登録できません。\nクリップのURLをコピーし、クリップビューアの「クリップ情報」機能をお使いください';
            favoriteButton.style.color = '#a9a9a9'; // グレーアウト
            favoriteButton.style.cursor = 'help';
            favoriteButton.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                alert('このクリップは古い形式のため、ボタンでお気に入り登録できません。\n\nお手数ですが、クリップのURLをコピーし、クリップビューアの「クリップ情報」機能をお使いください。');
            };
        }

        parent.insertBefore(favoriteButton, shareButton);
    });
}

function injectExpandedClipManagerFavoriteButton() {
    const expandedRows = document.querySelectorAll('.clips-manager-table__expanded-row:not([data-fav-row-processed="true"])');

    expandedRows.forEach(expandedRow => {
        expandedRow.dataset.favRowProcessed = 'true';

        const clipLink = expandedRow.querySelector('a[aria-label^="チャンネルページでクリップ"]');
        if (!clipLink || !clipLink.href) return;

        const slugRegex = /clip\/([a-zA-Z0-9_-]+)/;
        const match = clipLink.href.match(slugRegex);
        if (!match || !match[1]) return;
        const clipId = match[1];

        const shareButton = expandedRow.querySelector('button[aria-label$="を共有"]');
        if (!shareButton) return;
        const parent = shareButton.parentElement;
        if (!parent || parent.querySelector('.clip-manager-fav-button')) return;

        parent.style.display = 'flex';
        parent.style.alignItems = 'center';

        const favoriteButton = document.createElement('button');
        favoriteButton.className = 'custom-twitch-button clip-manager-fav-button';
        favoriteButton.innerHTML = '★';

        const updateButtonState = (isFavorited) => {
            favoriteButton.dataset.favorited = isFavorited;
            favoriteButton.title = isFavorited ? 'お気に入りから削除' : 'お気に入りに追加';
            favoriteButton.style.color = isFavorited ? 'gold' : '#efeff1';
            favoriteButton.style.backgroundColor = isFavorited ? '#9147ff' : '#53535f';
        };

        chrome.storage.sync.get({ favoriteClips: {} }, (data) => {
            updateButtonState(data.favoriteClips.hasOwnProperty(clipId));
        });

        favoriteButton.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isCurrentlyFavorited = favoriteButton.dataset.favorited === 'true';

            if (isCurrentlyFavorited) {
                if (window.confirm('このクリップをお気に入りから削除しますか？')) {
                    chrome.runtime.sendMessage({ action: 'removeClipFromFavorites', clipId: clipId }, (response) => {
                        if (response?.success) updateButtonState(false);
                    });
                }
            } else {
                const tokenResponse = await new Promise(resolve => chrome.runtime.sendMessage({ action: 'getTwitchAccessToken' }, resolve));
                if (!tokenResponse.token) { alert('Twitch認証が必要です。'); return; }
                const clipDetails = await fetchClipDetails(clipId, tokenResponse.token);
                if (!clipDetails) { alert('APIからクリップ情報の取得に失敗しました。'); return; }
                let gameName = '';
                if (clipDetails.game_id) {
                    try {
                        const gameDetailsResponse = await fetch(`https://api.twitch.tv/helix/games?id=${clipDetails.game_id}`, {
                            headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${tokenResponse.token}` }
                        });
                        if (gameDetailsResponse.ok) {
                            const gameData = await gameDetailsResponse.json();
                            gameName = (gameData.data && gameData.data.length > 0) ? gameData.data[0].name : '';
                        }
                    } catch (error) { console.error('Error fetching game details:', error); }
                }
                chrome.runtime.sendMessage({
                    action: 'addClipToFavorites',
                    clipDetails: { ...clipDetails, game_name: gameName }
                }, (res) => {
                    if (res?.success) updateButtonState(true);
                });
            }
        };

        parent.insertBefore(favoriteButton, shareButton);
    });
}


function injectChannelButton() {
    if (document.getElementById('clip-viewer-channel-btn')) return;
    const streamerNameH1 = document.querySelector('.channel-info-content h1.tw-title');
    if (streamerNameH1?.parentElement?.parentElement) {
        const layoutContainer = streamerNameH1.parentElement.parentElement;
        layoutContainer.style.display = 'flex';
        layoutContainer.style.alignItems = 'center';
        const button = document.createElement('button');
        button.id = 'clip-viewer-channel-btn';
        button.className = 'custom-twitch-button channel-button';
        button.textContent = 'クリップビューア';
        button.style.marginLeft = '1rem';
        button.onclick = (e) => {
            e.preventDefault(); e.stopPropagation();
            const channelName = window.location.pathname.split('/')[1];
            chrome.runtime.sendMessage({ action: 'openClipsPage', channel: channelName });
        };
        layoutContainer.appendChild(button);
    }
}

function injectClipPageButton() {
    if (document.getElementById('clip-viewer-fav-wrapper')) return;

    const isCreatePage = window.location.pathname.startsWith('/create/');
    const isClipPage = window.location.pathname.includes('/clip/') || window.location.hostname.includes('clips.twitch.tv');

    if (!isCreatePage && !isClipPage) return;

    let anchorElement = document.querySelector('[data-test-selector="clips-watch-full-button"]') ||
        Array.from(document.querySelectorAll('[data-a-target="tw-core-button-label-text"]')).find(el => el.textContent === '編集')?.closest('a, button');

    if (!anchorElement && window.location.hostname.includes('clips.twitch.tv')) {
        anchorElement = document.querySelector('.player-controls__right-group > div:last-child') ||
            document.querySelector('button[aria-label="クリップを報告"]') ||
            document.querySelector('a[aria-label="共有"]');
    }

    if (!anchorElement && isCreatePage) {
        anchorElement = document.querySelector('button[data-a-target="social-share-button"]');
    }

    if (!anchorElement) return;

    const container = anchorElement.parentElement;
    if (container) {
        container.style.display = 'flex';
        container.style.flexDirection = 'row';
        container.style.alignItems = 'center';
    }

    const downloadButton = document.createElement('button');
    downloadButton.id = 'clip-viewer-download-btn';
    downloadButton.className = 'custom-twitch-button clip-page-download-button';
    downloadButton.title = 'クリップをダウンロード';
    downloadButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`;

    downloadButton.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isCreatePage) {
            const readonlyInput = document.querySelector('input[data-a-target="tw-input"][readonly]');
            if (readonlyInput && readonlyInput.value) {
                const urlToOpen = readonlyInput.value + '#auto-click-download=true';
                chrome.runtime.sendMessage({ action: 'openUrl', url: urlToOpen });
            } else {
                alert('クリップのURLが見つかりませんでした。');
            }
        } else {
            performClipDownload();
        }
    };

    const downloadWrapper = document.createElement('div');
    downloadWrapper.id = 'clip-viewer-download-wrapper';
    downloadWrapper.className = 'clip-viewer-download-wrapper';
    downloadWrapper.appendChild(downloadButton);

    const favoriteButton = document.createElement('button');
    favoriteButton.id = 'clip-viewer-fav-btn';
    favoriteButton.className = 'custom-twitch-button clip-page-fav-button';
    favoriteButton.innerHTML = '★';

    let currentClipId = null;
    if (isCreatePage) {
        const readonlyInput = document.querySelector('input[data-a-target="tw-input"][readonly]');
        if (readonlyInput && readonlyInput.value.includes('/clip/')) {
            const match = readonlyInput.value.match(/\/clip\/([a-zA-Z0-9_-]+)/);
            currentClipId = match ? match[1] : null;
        }
    } else {
        const slugRegex = /(?:clips\.twitch\.tv\/|twitch\.tv\/(?:\w+)\/clip\/)([a-zA-Z0-9_-]+)/;
        const match = window.location.href.match(slugRegex);
        currentClipId = match ? match[1] : null;
    }

    if (currentClipId) {
        chrome.storage.sync.get({ favoriteClips: {} }, (data) => {
            const favorites = data.favoriteClips;
            const isFavorited = favorites.hasOwnProperty(currentClipId);
            favoriteButton.dataset.favorited = isFavorited;
            favoriteButton.title = isFavorited ? 'お気に入りから削除' : 'お気に入りに追加';
        });

        favoriteButton.onclick = async (e) => {
            e.preventDefault(); e.stopPropagation();
            const isCurrentlyFavorited = favoriteButton.dataset.favorited === 'true';

            if (isCurrentlyFavorited) {
                if (window.confirm('このクリップをお気に入りから削除しますか？')) {
                    chrome.runtime.sendMessage({ action: 'removeClipFromFavorites', clipId: currentClipId }, (response) => {
                        if (response?.success) {
                            favoriteButton.dataset.favorited = 'false';
                            favoriteButton.title = 'お気に入りに追加';
                        }
                    });
                }
            } else {
                const response = await new Promise(resolve => {
                    chrome.runtime.sendMessage({ action: 'getTwitchAccessToken' }, resolve);
                });

                if (!response.token) {
                    alert('Twitch認証が必要です。拡張機能のページを開いて認証を完了してください。');
                    return;
                }

                const clipDetails = await fetchClipDetails(currentClipId, response.token);
                if (!clipDetails) {
                    alert('クリップ情報の取得に失敗しました。');
                    return;
                }

                let gameName = '';
                if (clipDetails.game_id) {
                    const gameDetailsResponse = await fetch(`https://api.twitch.tv/helix/games?id=${clipDetails.game_id}`, {
                        headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${response.token}` }
                    });
                    const gameData = await gameDetailsResponse.json();
                    gameName = (gameData.data && gameData.data.length > 0) ? gameData.data[0].name : '';
                }

                chrome.runtime.sendMessage({
                    action: 'addClipToFavorites',
                    clipDetails: { ...clipDetails, game_name: gameName }
                }, (res) => {
                    if (res?.success) {
                        favoriteButton.dataset.favorited = 'true';
                        favoriteButton.title = 'お気に入りから削除';
                    }
                });
            }
        };
    }

    const favoriteWrapper = document.createElement('div');
    favoriteWrapper.id = 'clip-viewer-fav-wrapper';
    favoriteWrapper.className = 'clip-viewer-fav-wrapper';
    favoriteWrapper.appendChild(favoriteButton);

    if (!document.getElementById('clip-viewer-download-wrapper')) {
        container.insertBefore(downloadWrapper, anchorElement);
    }
    if (!document.getElementById('clip-viewer-fav-wrapper')) {
        container.insertBefore(favoriteWrapper, anchorElement);
    }
}