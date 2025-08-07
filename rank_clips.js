const fs = require('fs');
const fetch = require('node-fetch');

// 環境変数から認証情報を取得
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

// コアなゲームリスト（固定）
const CORE_GAME_IDS = ['509658', '516575', '511224', '21779', '32982'];

// メインの非同期処理
async function main() {
    console.log('ランキングの生成を開始します...');

    // 1. Twitch APIの認証トークンを取得
    const authResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`, { method: 'POST' });
    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    // 2. 現在人気のゲームトップ30を取得
    const topGamesResponse = await fetch('https://api.twitch.tv/helix/games/top?first=30', {
        headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
    });
    const topGamesData = await topGamesResponse.json();
    const topGameIds = topGamesData.data.map(game => game.id);

    // 3. 固定リストと合体させ、重複を除外
    const gameIdsToFetch = [...new Set([...CORE_GAME_IDS, ...topGameIds])];
    console.log(`合計 ${gameIdsToFetch.length} 個のゲームカテゴリからクリップを取得します。`);

    // 4. 各ゲームの人気クリップを並行して取得
    const clipPromises = gameIdsToFetch.map(gameId =>
        fetch(`https://api.twitch.tv/helix/clips?game_id=${gameId}&first=25`, {
            headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
        })
            .then(res => res.json())
            .then(data => data.data || [])
    );
    const allClipsNested = await Promise.all(clipPromises);
    const allClips = allClipsNested.flat();

    // 5. 日本語クリップを抽出し、視聴回数順に並び替え、上位30件に絞る
    const rankedJapaneseClips = allClips
        .filter(clip => clip && clip.language === 'ja')
        .sort((a, b) => b.view_count - a.view_count)
        .slice(0, 30);

    // 6. 拡張機能で必要なデータだけに整形
    const finalData = {
        last_updated: new Date().toISOString(),
        clips: rankedJapaneseClips.map(clip => ({
            id: clip.id,
            url: clip.url,
            title: clip.title,
            broadcaster_name: clip.broadcaster_name,
            creator_name: clip.creator_name,
            view_count: clip.view_count,
            created_at: clip.created_at,
            thumbnail_url: clip.thumbnail_url,
            duration: clip.duration
        }))
    };

    // 7. 結果をJSONファイルとして `public` フォルダに保存
    if (!fs.existsSync('./public')) {
        fs.mkdirSync('./public');
    }
    fs.writeFileSync('./public/popular_clips.json', JSON.stringify(finalData, null, 2));
    console.log('ランキングファイル popular_clips.json の生成が完了しました。');
}

main().catch(console.error);