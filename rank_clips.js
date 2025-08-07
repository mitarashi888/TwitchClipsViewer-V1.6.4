const fs = require('fs');
const fetch = require('node-fetch');

// 環境変数から認証情報を取得
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// ★★★★★ 対象となる配信者のリスト ★★★★★
const TARGET_STREAMER_LOGINS = [
    'euriece', 'evinmotv', 'exalbio_2434', 'fantasista_jp', 'fenio_twitch',
    'fmlch', 'foxrabbit', 'fps__saku', 'fps_shaka', 'franciscoow'
];

/**
 * 指定された期間と配信者リストに基づいて人気クリップを取得・整形する関数
 * @param {string[]} broadcasterIds - 配信者のIDリスト
 * @param {number} days - 遡る日数 (1, 3, 7など)
 * @param {string} accessToken - Twitch APIのアクセストークン
 * @returns {Promise<object[]>} 整形済みのクリップデータ配列
 */
async function getRankedClipsForPeriod(broadcasterIds, days, accessToken) {
    console.log(`過去${days}日間のクリップを取得中...`);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startedAtISO = startDate.toISOString();

    // 各配信者から人気クリップを並行して取得 (上位20件を取得して後でまとめる)
    const clipPromises = broadcasterIds.map(id =>
        fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${id}&started_at=${startedAtISO}&first=20`, {
            headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
        })
            .then(res => res.json())
            .then(data => data.data || [])
    );
    const allClipsNested = await Promise.all(clipPromises);
    const allClips = allClipsNested.flat();

    // 日本語クリップを抽出し、視聴回数順に並び替え、上位30件に絞る
    const rankedClips = allClips
        .filter(clip => clip && clip.language === 'ja')
        .sort((a, b) => b.view_count - a.view_count)
        .slice(0, 30);

    // 拡張機能で必要なデータだけに整形して返す
    return rankedClips.map(clip => ({
        id: clip.id,
        url: clip.url,
        title: clip.title,
        broadcaster_name: clip.broadcaster_name,
        creator_name: clip.creator_name,
        view_count: clip.view_count,
        created_at: clip.created_at,
        thumbnail_url: clip.thumbnail_url,
        duration: clip.duration
    }));
}

// メインの非同期処理
async function main() {
    console.log('ランキングの生成を開始します...');

    // 1. Twitch APIの認証トークンを取得
    const authResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`, { method: 'POST' });
    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // 2. 配信者名リストをユーザーIDリストに変換
    const userLoginsParam = TARGET_STREAMER_LOGINS.map(login => `login=${login}`).join('&');
    const usersResponse = await fetch(`https://api.twitch.tv/helix/users?${userLoginsParam}`, {
        headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
    });
    const usersData = await usersResponse.json();
    const broadcasterIds = usersData.data.map(user => user.id);
    console.log(`${broadcasterIds.length}名の配信者IDを取得しました。`);

    // 3. 1日、3日、1週間の各期間でランキングを生成
    const [clips1day, clips3days, clips1week] = await Promise.all([
        getRankedClipsForPeriod(broadcasterIds, 1, accessToken),
        getRankedClipsForPeriod(broadcasterIds, 3, accessToken),
        getRankedClipsForPeriod(broadcasterIds, 7, accessToken)
    ]);

    // 4. 最終的なデータを1つのオブジェクトにまとめる
    const finalData = {
        last_updated: new Date().toISOString(),
        clips_1day: clips1day,
        clips_3days: clips3days,
        clips_1week: clips1week
    };

    // 5. 結果をJSONファイルとして `public` フォルダに保存
    if (!fs.existsSync('./public')) {
        fs.mkdirSync('./public');
    }
    fs.writeFileSync('./public/popular_clips.json', JSON.stringify(finalData, null, 2));
    console.log('ランキングファイル popular_clips.json の生成が完了しました。');
}

main().catch(console.error);