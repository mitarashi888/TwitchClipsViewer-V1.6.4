const fs = require('fs');
const fetch = require('node-fetch');

const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

const TARGET_STREAMER_LOGINS = [
    'euriece', 'evinmotv', 'exalbio_2434', 'fantasista_jp', 'fenio_twitch',
    'fmlch', 'foxrabbit', 'fps__saku', 'fps_shaka', 'franciscoow'
];

async function getRankedClipsForPeriod(broadcasterIds, days, accessToken) {
    console.log(`過去${days}日間のクリップを取得中...`);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startedAtISO = startDate.toISOString();

    const clipPromises = broadcasterIds.map(id =>
        fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${id}&started_at=${startedAtISO}&first=20`, {
            headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
        }).then(res => res.json()).then(data => data.data || [])
    );

    const allClipsNested = await Promise.all(clipPromises);
    const allClips = allClipsNested.flat().filter(clip => clip && clip.language === 'ja');

    const rankedClips = allClips
        .sort((a, b) => b.view_count - a.view_count)
        .slice(0, 30);

    // ★★★★★ 以下、VOD情報とゲーム名取得の処理を追加 ★★★★★
    const videoIds = [...new Set(rankedClips.map(c => c.video_id).filter(Boolean))];
    const gameIds = [...new Set(rankedClips.map(c => c.game_id).filter(Boolean))];

    const videoDetails = new Map();
    const gameDetails = new Map();

    // VOD情報を並行して取得
    if (videoIds.length > 0) {
        const videoResponse = await fetch(`https://api.twitch.tv/helix/videos?id=${videoIds.join('&id=')}`, {
            headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
        });
        if (videoResponse.ok) {
            const videoData = await videoResponse.json();
            videoData.data.forEach(video => videoDetails.set(video.id, video));
        }
    }

    // ゲーム情報を並行して取得
    if (gameIds.length > 0) {
        const gamesResponse = await fetch(`https://api.twitch.tv/helix/games?id=${gameIds.join('&id=')}`, {
            headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
        });
        if (gamesResponse.ok) {
            const gamesData = await gamesResponse.json();
            gamesData.data.forEach(game => gameDetails.set(game.id, game.name));
        }
    }

    return rankedClips.map(clip => {
        const vod = videoDetails.get(clip.video_id);
        return {
            ...clip, // 元のクリップ情報をすべて含める
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
    const authResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`, { method: 'POST' });
    const authData = await authResponse.json();
    const accessToken = authData.access_token;

    const userLoginsParam = TARGET_STREAMER_LOGINS.map(login => `login=${login}`).join('&');
    const usersResponse = await fetch(`https://api.twitch.tv/helix/users?${userLoginsParam}`, {
        headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
    });
    const usersData = await usersResponse.json();
    const broadcasterIds = usersData.data.map(user => user.id);
    console.log(`${broadcasterIds.length}名の配信者IDを取得しました。`);

    const [clips1day, clips3days, clips1week] = await Promise.all([
        getRankedClipsForPeriod(broadcasterIds, 1, accessToken),
        getRankedClipsForPeriod(broadcasterIds, 3, accessToken),
        getRankedClipsForPeriod(broadcasterIds, 7, accessToken)
    ]);

    const finalData = {
        last_updated: new Date().toISOString(),
        clips_1day: clips1day,
        clips_3days: clips3days,
        clips_1week: clips1week
    };

    if (!fs.existsSync('./public')) fs.mkdirSync('./public');
    fs.writeFileSync('./public/popular_clips.json', JSON.stringify(finalData, null, 2));
    console.log('ランキングファイル popular_clips.json の生成が完了しました。');
}

main().catch(console.error);