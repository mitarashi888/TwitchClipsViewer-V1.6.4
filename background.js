// background.js

const ANALYTICS_ENDPOINT = 'https://asia-northeast1-my-extension-analytics.cloudfunctions.net/log';
let userId = null;
let eventQueue = [];

// ユーザーIDを初期化し、保存されていたイベントキューを読み込む
chrome.storage.local.get(['userId', 'eventQueue'], (data) => {
    if (data.userId) {
        userId = data.userId;
    } else {
        userId = self.crypto.randomUUID();
        chrome.storage.local.set({ userId: userId });
    }

    if (data.eventQueue && Array.isArray(data.eventQueue)) {
        eventQueue = data.eventQueue;
    }
});

// イベントを記録する関数
function logAnalyticsEvent(type, details) {
    if (!userId) return;
    const event = { userId: userId, type: type, timestamp: new Date().toISOString(), details: details };
    eventQueue.push(event);
    chrome.storage.local.set({ eventQueue: eventQueue });
}

// 定期的にデータをサーバーに送信する
chrome.alarms.create('sendAnalytics', { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'sendAnalytics' && eventQueue.length > 0) {
        sendAnalyticsData();
    }
});

function sendAnalyticsData() {
    if (eventQueue.length === 0) return;
    const dataToSend = [...eventQueue];
    fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
    })
        .then(response => {
            if (!response.ok) {
                console.error('Failed to send analytics data. Data will be retried later.');
            } else {
                eventQueue.splice(0, dataToSend.length);
                chrome.storage.local.set({ eventQueue: eventQueue });
            }
        })
        .catch(error => console.error('Error sending analytics data:', error));
}

// 拡張機能のアイコンをクリックしたときの動作
chrome.action.onClicked.addListener(() => {
    logAnalyticsEvent('action_clicked', {});
    openClipsPage();
});

// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    switch (request.action) {
        case "getTwitchAccessToken":
            chrome.storage.local.get(['twitch_access_token'], (data) => {
                sendResponse({ token: data.twitch_access_token || null });
            });
            // このケースは非同期なので return true が必要
            return true;

        // ★★★★★ 以下を追加 ★★★★★
        case "openUrl":
            chrome.tabs.create({ url: request.url });
            break;
        // ★★★★★ ここまで ★★★★★

        case "openClipsPage":
            openClipsPage(request.channel);
            // 返信しないので return true は不要
            break;

        case "downloadClip":
            logAnalyticsEvent('clip_download_requested', {
                clip_url: request.url,
                details: request.clipDetails,
                from: sender.tab ? 'content_script' : 'clips_page'
            });
            chrome.downloads.download({
                url: request.url,
                filename: request.filename
            });
            if (sendResponse) sendResponse({ success: true });
            // このケースは同期的（または返信が不要）なので return true は不要
            break;

        case "addClipToFavorites":
            logAnalyticsEvent('favorite_added', { clipId: request.clipDetails.id, details: request.clipDetails, from: sender.tab ? 'content_script' : 'clips_page' });
            chrome.storage.sync.get({ favoriteClips: {} }, (data) => {
                const favorites = data.favoriteClips;
                const clipId = request.clipDetails.id;
                // タグを保存する配列を初期化
                if (!favorites[clipId]) {
                    favorites[clipId] = [];
                }
                chrome.storage.sync.set({ favoriteClips: favorites }, () => {
                    sendResponse({ success: true });
                });
            });
            // このケースは非同期なので return true が必要
            return true;

        case "removeClipFromFavorites":
            logAnalyticsEvent('favorite_removed', { clipId: request.clipId, from: sender.tab ? 'content_script' : 'clips_page' });
            chrome.storage.sync.get({ favoriteClips: {} }, (data) => {
                const favorites = data.favoriteClips;
                delete favorites[request.clipId];
                chrome.storage.sync.set({ favoriteClips: favorites }, () => {
                    sendResponse({ success: true });
                });
            });
            // このケースは非同期なので return true が必要
            return true;

        case "logEvent":
            logAnalyticsEvent(request.type, request.details);
            // 返信しないので return true は不要
            break;
    }
    // ★問題だった最後の return true; を削除
});

// クリップビューアのページを開く関数
function openClipsPage(channelName = null) {
    let url = chrome.runtime.getURL("clips_page.html");
    if (channelName) {
        url += `?channel=${encodeURIComponent(channelName)}`;
    }
    chrome.tabs.create({ url: url });
}

// 拡張機能がインストールまたはアップデートされたときに実行されるリスナー
chrome.runtime.onInstalled.addListener((details) => {
    // details.reason には 'install', 'update', 'chrome_update' などが入る
    if (details.reason === 'update') {
        // アップデートの場合、チュートリアル表示済みフラグを削除する
        chrome.storage.local.remove('hasShownTutorial', () => {
            console.log('アップデートを検出したため、チュートリアルの表示履歴をリセットしました。');
            logAnalyticsEvent('tutorial_reset_on_update', {
                previousVersion: details.previousVersion,
                currentVersion: chrome.runtime.getManifest().version
            });
        });
    } else if (details.reason === 'install') {
        logAnalyticsEvent('extension_installed', {
            version: chrome.runtime.getManifest().version
        });
    }
});