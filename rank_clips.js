const fs = require('fs');
const fetch = require('node-fetch');

// 環境変数から認証情報を取得
const CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

const API_REQUEST_DELAY = 100;
const CLIPS_PER_STREAMER = 25;
const MAX_CLIPS_TO_FETCH_PER_GAME = 1000;
const CLIPS_PER_PAGE = 100;

// --- ハイブリッド方式のための新しいカテゴリ定義 ---
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
];

// --- userlist.txt から読み込んだ配信者リスト ---
const TARGET_STREAMER_LOGINS = [
    '0range117', '2_nsnn_4', '417majika', '456_hesiko', '4rmy_o', '963noah', 'absol_dayo', 'acomingzz', 'acqua_0316', 'ade3_3',
    'ai_hongo_', 'ajak0n', 'ajakany', 'akamikarubi', 'akarindao', 'akirosenthal_hololive', 'alelu', 'alfrea', 'alphaazur', 'amakipururu',
    'amal_3rd', 'amamiyakokoro_', 'amanogawaneru', 'amaui0915', 'amauta_sau', 'amemiyanazuna', 'amokoamano', 'ansansniper', 'anzu_o0',
    'aoi_sakura3', 'apexerpinky', 'arikendebu', 'arsalmal', 'asaonokeitora_', 'ashi3re', 'assarisyoko1', 'asumisena', 'ateliersage',
    'bacter1a_', 'bakumatsu_shishi', 'banda_chosuke', 'barukodayo', 'batora324', 'bellmona', 'bijusan', 'bobsappaim0304', 'bonchan0311',
    'broooockwt', 'cag_fenritti', 'ceros127', 'cinotmagopono', 'clay_0920', 'clutch_fii', 'colon56n_stpr', 'consome01', 'contami999',
    'cr_amatsuki', 'cr_arisakaaa', 'cr_rion', 'cr_vanilla', 'cr_wokka', 'crazyraccoonyy', 'crowfps__', 'crtopioxd', 'curihara0807',
    'daigothebeastv', 'darkmasuotv', 'darkzelk', 'darumaisgod', 'dasoku_aniki', 'datte_masamune', 'day1lol', 'dayodayo_dayo', 'dep_ow',
    'detonator_robin', 'dexyuku', 'dizzymizlizy', 'dj___shige', 'dj_foy_foxx', 'dkomusubi', 'dmf_kyochan', 'dttodot', 'e36_kimitosu',
    'emtsmaru', 'enako_chan', 'entych', 'euriece', 'evinmotv', 'exalbio_2434', 'fantasista_jp', 'fenio_twitch', 'fmlch', 'foxrabbit',
    'fps__saku', 'fps_shaka', 'franciscoow', 'ftyaaaan', 'fuwaminato2434', 'gachikun0423', 'gackt_n', 'genzin', 'gero_kinjo', 'go1channel',
    'gocchanmikey', 'gokigennanamechan', 'gon_vl', 'gotsukishima', 'gpbadkyo', 'guguttemy', 'guilty1223', 'gutitubo', 'haitani0904',
    'hanazawanako', 'hanjoudesu', 'haruglory', 'hatsukaneru', 'hatsume', 'henyathegenius', 'hestiahappiness', 'hiiragitsurugi', 'hijirimelaeria',
    'hikakin', 'hinanotachiba7', 'hinas3', 'hinataa8_', 'honey__sena', 'hutoon', 'hyoutarou086', 'iam_xq', 'ibaraki_ninja', 'ibrahimtv_2434',
    'ikoma_dogura', 'im_mittiii', 'indegnasen0706', 'iq200yukaf', 'itazan0429', 'japanesekoreanug', 'jasper7se', 'junior27015', 'k4sen',
    'kagasumire', 'kagura0mea', 'kakeru_fgc', 'kaminariqpi', 'kamito_jp', 'kanae_2434', 'kanegon1', 'kanotic_', 'kanseru_tyan', 'kashi_neko',
    'kato_junichi0817', 'kawaii_club_0809', 'kawase56', 'keiichi', 'kenki521', 'kentsumeshi_heyoo', 'kettuncyukyuhei', 'killin9hit', 'kinapoppo',
    'kintokiwt', 'kiramekieve', 'kiriyanwt', 'kiruma_ch', 'kohaku_uru', 'kohanalam_game', 'kokagetsumugi', 'kokujintv', 'kolu_pen', 'kosuke_saiore',
    'krrnbot', 'ksonsouchou', 'kun_stream', 'kyoyu_shiroya', 'laplusdarknesss_hololive', 'lauren_iroas2434', 'lazvell', 'leondaihyou',
    'leotukuyomi', 'lible_ace3', 'light_starboy', 'lilimaruriri', 'lisahanabusa', 'lunaria39', 'lykq8don', 'm1ko_d4yo', 'm2_kento_heluan',
    'mago2dgod', 'maimaittv', 'makaino_ririmu', 'makiba7', 'mansayasama', 'maronnv', 'marunnn_', 'marutake_a', 'masato_wtnb', 'maufinvl',
    'megsa_n', 'meiy_vl', 'meltonff', 'meltstera', 'met_komori', 'michaaam', 'middleeetv', 'midorokun', 'mikami_kon', 'million4771',
    'minami_tette', 'minasernz', 'minyaseptember', 'miradayoo', 'misacorin', 'mmafu_', 'moe_iori', 'mokouliszt1', 'momochoco', 'momomi5871',
    'mondo2244', 'moritakacola', 'mother3rd', 'muchi_chan', 'mukai_fps', 'murakamisuigun', 'mushamaru_', 'myakkomyako', 'nacho_dayo',
    'nagisatty', 'nakamuwt', 'nakiriayame_hololive', 'naohiro21_twitch', 'naru0419045', 'natsuiromatsuri_hololive', 'natsume_sennsei', 'nazunakaga',
    'nekoko88', 'nemo_good', 'nenemaru220', 'nerumerotwitch', 'neth3', 'nico_ov', 'nigongo25', 'ninja_inui', 'ninzintabemasu', 'nishimura_honoka',
    'niu_yozuna', 'nniru', 'nukomaro2020', 'o72nonibitashi', 'obormentv', 'okinawapex', 'oniyadayo', 'ottiki', 'ow_pepper', 'ow_uruca', 'p1kt',
    'peintooon', 'penko_channel', 'petit2434', 'pira_real', 'pondelinp', 'puioff', 'r_k7den', 'r_u_u_', 'rader', 'rainbrain', 'ralph_mp3',
    'ram_ch0p', 'ramuneshiranami', 'ramuzuqun', 'ran_hinokuma', 'rappinttv', 'ras_sama', 'rassya12', 'reika_kyochannel', 'reitathefps',
    'ren_kisaragi__', 'riitama_', 'rio_taro', 'rosecpin9', 'sabu_iko', 'sakonoko_game', 'sakuramiko_hololive', 'sanninshow_3ns', 'sara_hoshikawa',
    'sasatikk', 'satuking_', 'sayakayamamoto__714', 'selly55', 'seoldam99', 'shao_babitan', 'sharkenwt', 'shibuyahal', 'shinjifromjapanxd',
    'shinomiya_runa', 'shinoriiiiiin', 'shirayuki_reid', 'shiro_manta', 'shirona_shizuku', 'shishidoakari', 'shizurintv', 'shobosuke',
    'shomaru7', 'shuto_fgc', 'sinigami184', 'sirry_twich', 'smile_wt', 'solionzi', 'soraposhich', 'sovault', 'sps_renjiro', 'spygea', 'sqla',
    'stansmith_jp', 'stray_whitecat_', 'stylishnoob4', 'sudetakin', 'sugarock_jp', 'sugarz3ro', 'sumomo_x', 'surugamonkey0113', 'sutanmi',
    'suzucharo', 'suzukinoriaki', 'suzune_rabbit', 'syaruru3', 'syoji_2525', 'syouta_fps', 'ta1yo_tv', 'tachikawabr', 'taidaaaa_', 'takagitv',
    'takayaspecial', 'takejfps', 'takera0628', 'takoko_vtuber', 'tallemi_ella', 'tamamochi_kazuyo', 'tamatthi', 'tanukana_', 'tanukininja',
    'tarakotbtb', 'tea_pacman', 'tem__pura', 'ten_amagi', 'tennn', 'tentei_forte', 'thefuudo', 'titiseadmin', 'tkch_taisyou', 'tokidoki77',
    'tokoyamitowa_holo', 'tomo0723sw', 'tonakaito_hendy', 'tonbocub', 'tororo_vtuber', 'toru_2434', 'toto02033', 'tototmix', 'touka3210',
    'tqq999_', 'tttcheekyttt', 'turuokamonohashi', 'urs_toko', 'uruhaichinose', 'usa_miharu', 'usamirito', 'utaimeika', 'utonyan', 'utu_twich',
    'varvalian', 'vipjapan0619', 'vodkavdk', 'wakiwaki612', 'xhalli4x', 'xnfri', 'xxbetty96', 'yamatonjp', 'yaritaiji', 'yocchanyocchan',
    'yochuco', 'yohdazo', 'yoichi_0v0', 'yoshinama222', 'yue_san', 'yufuna', 'yukihanalamy_hololive', 'yukiofps14', 'yumesaki_hipopo',
    'yunocy', 'yuseafn', 'yutapongo', 'yuyu_tekken', 'yuyuta0702', 'zackdnerrr', 'zackraystream', 'zagou281', 'zennakukinn', 'zepher',
    'zerost_s', 'zetyou2', 'zozomuzomu'
];

/**
 * 【タイプ1】配信者リストからクリップを取得し、ランキング化する関数
 */
async function getRankedClipsForStreamers(broadcasterIds, days, accessToken, gameId = null) {
    // この関数は前回のコードから変更なし
    console.log(`[${broadcasterIds.length}名の配信者]のクリップを取得中 (期間: ${days}日, ゲームID: ${gameId || '全て'})`);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startedAtISO = startDate.toISOString();
    const clipPromises = broadcasterIds.map(async (id) => {
        let url = `https://api.twitch.tv/helix/clips?broadcaster_id=${id}&started_at=${startedAtISO}&first=${CLIPS_PER_STREAMER}`;
        if (gameId) url += `&game_id=${gameId}`;
        await new Promise(resolve => setTimeout(resolve, API_REQUEST_DELAY));
        try {
            const response = await fetch(url, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` } });
            if (!response.ok) return [];
            const data = await response.json();
            return data.data || [];
        } catch (error) { return []; }
    });
    const allClipsNested = await Promise.all(clipPromises);
    const allClips = allClipsNested.flat().filter(clip => clip && clip.language === 'ja');
    const uniqueClips = [...new Map(allClips.map(item => [item.id, item])).values()];
    const rankedClips = uniqueClips.sort((a, b) => b.view_count - a.view_count).slice(0, 30);
    return await enrichClipsData(rankedClips, accessToken);
}

/**
 * 【タイプ2】ゲームIDでクリップを取得し、ランキング化する関数
 */
async function getRankedClipsByGameId(gameId, days, accessToken) {
    console.log(`[ゲームID: ${gameId}] のクリップを取得中 (期間: ${days}日, 最大${MAX_CLIPS_TO_FETCH_PER_GAME}件)`);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startedAtISO = startDate.toISOString();
    let clipsForGame = [];
    let cursor = null;
    let hasNextPage = true;
    while (hasNextPage && clipsForGame.length < MAX_CLIPS_TO_FETCH_PER_GAME) {
        let url = `https://api.twitch.tv/helix/clips?game_id=${gameId}&started_at=${startedAtISO}&first=${CLIPS_PER_PAGE}`;
        if (cursor) url += `&after=${cursor}`;
        try {
            const response = await fetch(url, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` } });
            if (!response.ok) break;
            const data = await response.json();
            if (data.data && data.data.length > 0) clipsForGame.push(...data.data);
            cursor = data.pagination && data.pagination.cursor ? data.pagination.cursor : null;
            if (!cursor) hasNextPage = false;
            await new Promise(resolve => setTimeout(resolve, API_REQUEST_DELAY));
        } catch (error) { break; }
    }
    const allClips = clipsForGame.filter(clip => clip && clip.language === 'ja');
    const uniqueClips = [...new Map(allClips.map(item => [item.id, item])).values()];
    const rankedClips = uniqueClips.sort((a, b) => b.view_count - a.view_count).slice(0, 30);
    return await enrichClipsData(rankedClips, accessToken);
}


async function getBroadcasterIds(logins, accessToken) {
    // この関数は前回のコードから変更なし
    const allIds = [];
    const loginChunks = [];
    for (let i = 0; i < logins.length; i += 100) loginChunks.push(logins.slice(i, i + 100));
    for (const chunk of loginChunks) {
        const loginParams = chunk.map(login => `login=${encodeURIComponent(login)}`).join('&');
        try {
            const response = await fetch(`https://api.twitch.tv/helix/users?${loginParams}`, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` } });
            if (response.ok) {
                const data = await response.json();
                allIds.push(...data.data.map(user => user.id));
            }
        } catch (error) { console.error('Failed to fetch user IDs:', error); }
    }
    console.log(`${logins.length}名のログイン名から${allIds.length}件の配信者IDを取得しました。`);
    return allIds;
}

async function enrichClipsData(clips, accessToken) {
    // この関数は変更なし
    if (clips.length === 0) return [];
    const videoIds = [...new Set(clips.map(c => c.video_id).filter(Boolean))];
    const gameIds = [...new Set(clips.map(c => c.game_id).filter(Boolean))];
    const videoDetails = new Map();
    const gameDetails = new Map();
    const fetchPromises = [];
    if (videoIds.length > 0) {
        fetchPromises.push(
            fetch(`https://api.twitch.tv/helix/videos?id=${videoIds.join('&id=')}`, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` } }).then(res => res.ok ? res.json() : null).then(data => data?.data.forEach(video => videoDetails.set(video.id, video)))
        );
    }
    if (gameIds.length > 0) {
        fetchPromises.push(
            fetch(`https://api.twitch.tv/helix/games?id=${gameIds.join('&id=')}`, { headers: { 'Client-ID': CLIENT_ID, 'Authorization': `Bearer ${accessToken}` } }).then(res => res.ok ? res.json() : null).then(data => data?.data.forEach(game => gameDetails.set(game.id, game.name)))
        );
    }
    await Promise.all(fetchPromises);
    return clips.map(clip => {
        const vod = videoDetails.get(clip.video_id);
        return { ...clip, game_name: gameDetails.get(clip.game_id) || '', vod_info: vod ? { title: vod.title, published_at: vod.published_at } : null };
    });
}

async function main() {
    console.log('ランキングの生成を開始します...');
    const authResponse = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&grant_type=client_credentials`, { method: 'POST' });
    const authData = await authResponse.json();
    if (!authData.access_token) { console.error('アクセストークンの取得に失敗しました。'); return; }
    const accessToken = authData.access_token;
    console.log('アクセストークンを取得しました。');

    // streamer_listタイプのカテゴリで使う配信者IDを一度だけ取得
    const broadcasterIds = await getBroadcasterIds(TARGET_STREAMER_LOGINS, accessToken);

    const finalData = { last_updated: new Date().toISOString() };
    const periods = [{ key: '1day', days: 1 }, { key: '3days', days: 3 }, { key: '1week', days: 7 }];

    for (const category of POPULAR_CATEGORIES) {
        console.log(`カテゴリ 「${category.name}」(${category.type}) の集計を開始...`);
        finalData[category.id] = {};
        for (const period of periods) {
            let clips = [];
            // ★★★ カテゴリのタイプに応じて呼び出す関数を切り替える ★★★
            if (category.type === 'streamer_list') {
                clips = await getRankedClipsForStreamers(broadcasterIds, period.days, accessToken, category.gameId);
            } else if (category.type === 'game_id') {
                clips = await getRankedClipsByGameId(category.id, period.days, accessToken);
            }
            finalData[category.id][`clips_${period.key}`] = clips;
        }
        console.log(`カテゴリ 「${category.name}」の集計が完了しました。`);
    }

    if (!fs.existsSync('./public')) fs.mkdirSync('./public');
    fs.writeFileSync('./public/popular_clips.json', JSON.stringify(finalData, null, 2));
    console.log('ランキングファイル popular_clips.json の生成が完了しました。');
}

main().catch(error => {
    console.error("スクリプトの実行中にエラーが発生しました:", error);
    process.exit(1);
});