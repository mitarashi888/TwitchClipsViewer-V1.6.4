const fs = require('fs');
const fetch = require('node-fetch');

// 環境変数から認証情報を取得
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

const API_REQUEST_DELAY = 100; // APIリクエスト間の待機時間(ミリ秒)
const CLIPS_PER_PAGE = 100;

// 人気クリップのカテゴリ定義
const POPULAR_CATEGORIES = [
    { name: '総合', id: 'overall', type: 'language', value: 'ja' }, // 日本語のクリップ全体
    { name: '雑談', id: '509658', type: 'game_id' },
    { name: 'VALO', id: '516575', type: 'game_id' },
    { name: 'LOL', id: '21779', type: 'game_id' },
    { name: 'Apex', id: '511224', type: 'game_id' },
    { name: 'スト6', id: '55453844', type: 'game_id' },
    { name: 'GTA5', id: '32982', type: 'game_id' },
    { name: 'イベント：FF14（the k4sen）', id: '19619', type: 'game_id' } // FF14の正しいIDに変更
];

/**
 * Twitch APIからクリップを取得する汎用関数
 * @param {string} accessToken - Twitch APIアクセストークン
 * @param {number} days - 取得する期間（日数）
 * @param {object} params - APIリクエストのクエリパラメータ
 * @returns {Promise<Array>} クリップの配列
 */
async function getClips(accessToken, days, params) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startedAtISO = startDate.toISOString();

    let allClips = [];
    let cursor = null;
    let hasNextPage = true;
    const maxPages = 5; // 取得するページ数を5ページ（最大500件）に制限
    let currentPage = 0;

    while (hasNextPage && currentPage < maxPages) {
        let url = new URL('https://api.twitch.tv/helix/clips');
        url.searchParams.append('started_at', startedAtISO);
        url.searchParams.append('first', CLIPS_PER_PAGE);
        for (const key in params) {
            url.searchParams.append(key, params[key]);
        }
        if (cursor) {
            url.searchParams.append('after', cursor);
        }

        try {
            await new Promise(resolve => setTimeout(resolve, API_REQUEST_DELAY));
            const response = await fetch(url.href, {
                headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
            });
            if (!response.ok) {
                console.error(`API Error: ${response.status} for params:`, params);
                break;
            }
            const data = await response.json();
            if (data.data && data.data.length > 0) {
                allClips.push(...data.data);
            }
            cursor = data.pagination?.cursor;
            if (!cursor) {
                hasNextPage = false;
            }
        } catch (error) {
            console.error('Fetch error:', error);
            break;
        }
        currentPage++;
    }
    // 日本語のクリップのみをフィルタリング
    return allClips.filter(clip => clip && clip.language === 'ja');
}

/**
 * メイン処理
 */
async function main() {
    console.log('ランキングの生成を開始します...');
    const authResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`, { method: 'POST' });
    const authData = await authResponse.json();
    if (!authData.access_token) {
        console.error('アクセストークンの取得に失敗しました。');
        return;
    }
    const accessToken = authData.access_token;
    console.log('アクセストークンを取得しました。');

    const finalData = { last_updated: new Date().toISOString() };
    const today = new Date();

    for (const category of POPULAR_CATEGORIES) {
        console.log(`カテゴリ 「${category.name}」の集計を開始...`);
        finalData[category.id] = {};

        // 最初に30日分のクリップを一度だけまとめて取得
        console.log(`  - 過去30日分のクリップを取得中...`);
        let params = {};
        if (category.type === 'game_id') {
            params.game_id = category.id;
        } else if (category.type === 'language') {
            params.language = category.value;
        }

        const monthlyClips = await getClips(accessToken, 30, params);
        console.log(`  - ${monthlyClips.length}件のクリップを取得しました。`);

        // --- 集計期間の定義 ---
        const periods = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            const key = date.toISOString().slice(0, 10); // YYYY-MM-DD
            periods.push({ key });
        }
        periods.push({ key: '1week' });
        periods.push({ key: '1month' });

        // 取得したデータを使いまわして、各期間のデータを作成
        for (const period of periods) {
            let filteredClips = [];
            if (period.key.includes('-')) { // 日別データ
                filteredClips = monthlyClips.filter(c => c.created_at.startsWith(period.key));
            } else if (period.key === '1week') {
                const weekAgo = new Date();
                weekAgo.setDate(today.getDate() - 7);
                filteredClips = monthlyClips.filter(c => new Date(c.created_at) >= weekAgo);
            } else if (period.key === '1month') {
                filteredClips = monthlyClips;
            }

            finalData[category.id][`clips_${period.key}`] = filteredClips
                .sort((a, b) => b.view_count - a.view_count)
                .slice(0, 30); // 上位30件に絞る
        }
        console.log(`カテゴリ 「${category.name}」の集計が完了しました。`);
    }

    if (!fs.existsSync('./public')) {
        fs.mkdirSync('./public');
    }
    fs.writeFileSync('./public/popular_clips.json', JSON.stringify(finalData, null, 2));
    console.log('ランキングファイル popular_clips.json の生成が完了しました。');
}

main().catch(error => {
    console.error("スクリプトの実行中に致命的なエラーが発生しました:", error);
    process.exit(1);
});