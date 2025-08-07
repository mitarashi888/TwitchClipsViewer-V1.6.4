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

    // ★★★★★ 以下、ゲーム名取得の処理を追加 ★★★★★
    const gameIds = [...new Set(allClips.map(clip => clip.game_id).filter(Boolean))];
    const gameDetails = new Map();
    if (gameIds.length > 0) {
        const gameChunks = [];
        for (let i = 0; i < gameIds.length; i += 100) {
            gameChunks.push(gameIds.slice(i, i + 100));
        }
        for (const chunk of gameChunks) {
            const gameIdsParam = chunk.map(id => `id=${id}`).join('&');
            const gamesResponse = await fetch(`https://api.twitch.tv/helix/games?${gameIdsParam}`, {
                headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` }
            });
            if (gamesResponse.ok) {
                const gamesData = await gamesResponse.json();
                gamesData.data.forEach(game => gameDetails.set(game.id, game.name));
            }
        }
    }

    const rankedClips = allClips
        .sort((a, b) => b.view_count - a.view_count)
        .slice(0, 30);

    return rankedClips.map(clip => ({
        id: clip.id,
        url: clip.url,
        title: clip.title,
        broadcaster_name: clip.broadcaster_name,
        creator_name: clip.creator_name,
        view_count: clip.view_count,
        created_at: clip.created_at,
        thumbnail_url: clip.thumbnail_url,
        duration: clip.duration,
        video_id: clip.video_id,
        vod_offset: clip.vod_offset,
        game_name: gameDetails.get(clip.game_id) || '' // ゲーム名を追加
    }));
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