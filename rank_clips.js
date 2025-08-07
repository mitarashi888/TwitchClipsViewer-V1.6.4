const fs = require('fs');
const fetch = require('node-fetch');

// 環境変数から認証情報を取得
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// --- clips_page.js から持ってきた定義 ---
const FIXED_POPULAR_GAME_IDS = [
    '509658', // 雑談 (Just Chatting)
    '511224', // Apex Legends
    '516575', // VALORANT
    '27471',  // Minecraft
    '21779',  // League of Legends (LOL)
    '55453844', // ストリートファイター6 (Street Fighter 6)
    '32982',  // Grand Theft Auto V (GTA5)
    '515025', // オーバーウォッチ2
];

const POPULAR_CATEGORIES = [
    { name: '総合', id: 'overall' },
    { name: '雑談', id: '509658' },
    { name: 'VALO', id: '516575' },
    { name: 'LOL', id: '21779' },
    { name: 'Apex', id: '511224' },
    { name: 'スト6', id: '55453844' },
    { name: 'GTA5', id: '32982' },
];
// -----------------------------------------

/**
 * 指定されたゲームIDリストのクリップを取得し、ランキング化する
 * @param {string[]} gameIds - TwitchのゲームIDの配列
 * @param {number} days - 何日前までのクリップを取得するか
 * @param {string} accessToken - Twitch APIのアクセストークン
 * @returns {Promise<object[]>} ランキング化され、情報が付与されたクリップの配列
 */
async function getRankedClipsForGames(gameIds, days, accessToken) {
    console.log(`[${gameIds.join(', ')}] の過去${days}日間のクリップを取得中...`);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startedAtISO = startDate.toISOString();

    // 各ゲームIDに対して並行してAPIリクエストを送信
    const clipPromises = gameIds.map(id =>
        fetch(`https://api.twitch.tv/helix/clips?game_id=${id}&started_at=${startedAtISO}&first=100`, { // 取得件数を100に増やす
            headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
        })
            .then(res => res.ok ? res.json() : Promise.resolve({ data: [] })) // エラー時も空配列を返す
            .then(data => data.data || [])
    );

    const allClipsNested = await Promise.all(clipPromises);
    const allClips = allClipsNested.flat().filter(clip => clip && clip.language === 'ja');

    // 重複を削除し、視聴回数でソートして上位30件を取得
    const uniqueClips = [...new Map(allClips.map(item => [item['id'], item])).values()];
    const rankedClips = uniqueClips
        .sort((a, b) => b.view_count - a.view_count)
        .slice(0, 30);

    // クリップにVODとゲーム名の情報を付与する
    return await enrichClipsData(rankedClips, accessToken);
}

/**
 * クリップ配列にVOD情報とゲーム名情報を付与するヘルパー関数
 * @param {object[]} clips - クリップの配列
 * @param {string} accessToken - Twitch APIのアクセストークン
 * @returns {Promise<object[]>} 情報が付与されたクリップの配列
 */
async function enrichClipsData(clips, accessToken) {
    if (clips.length === 0) return [];

    const videoIds = [...new Set(clips.map(c => c.video_id).filter(Boolean))];
    const gameIds = [...new Set(clips.map(c => c.game_id).filter(Boolean))];

    const videoDetails = new Map();
    const gameDetails = new Map();

    const fetchPromises = [];

    // VOD情報を取得
    if (videoIds.length > 0) {
        fetchPromises.push(
            fetch(`https://api.twitch.tv/helix/videos?id=${videoIds.join('&id=')}`, {
                headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
            }).then(res => res.ok ? res.json() : null).then(data => {
                data?.data.forEach(video => videoDetails.set(video.id, video));
            })
        );
    }

    // ゲーム情報を取得
    if (gameIds.length > 0) {
        fetchPromises.push(
            fetch(`https://api.twitch.tv/helix/games?id=${gameIds.join('&id=')}`, {
                headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
            }).then(res => res.ok ? res.json() : null).then(data => {
                data?.data.forEach(game => gameDetails.set(game.id, game.name));
            })
        );
    }

    await Promise.all(fetchPromises);

    // 元のクリップ情報に付加情報をマージして返す
    return clips.map(clip => {
        const vod = videoDetails.get(clip.video_id);
        return {
            ...clip,
            game_name: gameDetails.get(clip.game_id) || '',
            vod_info: vod ? {
                title: vod.title,
                published_at: vod.published_at
            } : null
        };
    });
}


async function main() {
    console.log('ランキングの生成を開始します...');

    // 1. アプリケーションのアクセストークンを取得
    const authResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`, { method: 'POST' });
    const authData = await authResponse.json();
    if (!authData.access_token) {
        console.error('アクセストークンの取得に失敗しました。');
        return;
    }
    const accessToken = authData.access_token;
    console.log('アクセストークンを取得しました。');

    // 2. 最終的なJSONデータの構造を準備
    const finalData = {
        last_updated: new Date().toISOString(),
    };

    const periods = [
        { key: '1day', days: 1 },
        { key: '3days', days: 3 },
        { key: '1week', days: 7 }
    ];

    // 3. 全カテゴリのランキングを並行して集計
    const rankingPromises = POPULAR_CATEGORIES.map(async (category) => {
        console.log(`カテゴリ 「${category.name}」の集計を開始...`);
        finalData[category.id] = {};
        const gameIdsToFetch = category.id === 'overall' ? FIXED_POPULAR_GAME_IDS : [category.id];

        for (const period of periods) {
            const clips = await getRankedClipsForGames(gameIdsToFetch, period.days, accessToken);
            finalData[category.id][`clips_${period.key}`] = clips;
        }
        console.log(`カテゴリ 「${category.name}」の集計が完了しました。`);
    });

    await Promise.all(rankingPromises);

    // 4. publicディレクトリがなければ作成し、JSONファイルを書き出す
    if (!fs.existsSync('./public')) {
        fs.mkdirSync('./public');
    }
    fs.writeFileSync('./public/popular_clips.json', JSON.stringify(finalData, null, 2));
    console.log('ランキングファイル popular_clips.json の生成が完了しました。');
}

main().catch(error => {
    console.error("スクリプトの実行中にエラーが発生しました:", error);
    process.exit(1);
});