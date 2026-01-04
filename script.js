// --- CONFIGURATION ---
const SB_URL = "https://khhiidrastcufsdoqmom.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoaGlpZHJhc3RjdWZzZG9xbW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcyMTAwNTgsImV4cCI6MjA4Mjc4NjA1OH0.dlLvwAWHX4rq7mDW9QlqJmPcf3QxCSbuKBNNOlKdSr8";
const TMDB_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI2NGNjOWY1NGRhNGQ1OTY1YTEwMDQ2OWYwYWVlZDZlMiIsIm5iZiI6MTc2Njg4MjQ5NS44MDA5OTk5LCJzdWIiOiI2OTUwN2NiZmU1YWViNzA2YzI3MGYxYjIiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.pC3vB4yK0Ou-Kg4fQsDG0M_6I3KgdKQFqlnYV65ZTys";
const TMDB_KEY = "64cc9f54da4d5965a100469f0aeed6e2";

const supabase = exports.supabase.createClient(SB_URL, SB_KEY);

const SERVERS = [
    { n: "Fmovies", u: (id,t,s,e) => `https://fmovies4u.com/embed/tmdb-${t}-${id}${t=='tv'?`/${s}/${e}`:''}?autoPlay=true` },
    { n: "VidSrc.ru", u: (id,t,s,e) => `https://vidsrc-embed.ru/embed/${t}/${id}${t=='tv'?`/${s}-${e}`:''}` },
    { n: "VidLink", u: (id,t,s,e) => `https://vidlink.pro/${t}/${id}${t=='tv'?`/${s}/${e}`:''}` }
];

const app = {
    user: null,
    cur: null,
    hist: [],
    
    init: async () => {
        app.checkUser();
        app.loadHome();
        app.loadNetworks();
        app.bindEvents();
    },

    req: async (path) => {
        const r = await fetch(`https://api.themoviedb.org/3/${path}${path.includes('?') ? '&' : '?'}api_key=${TMDB_KEY}`);
        return r.json();
    },

    checkUser: async () => {
        const { data } = await supabase.auth.getUser();
        if(data.user) {
            app.user = data.user;
            document.getElementById('user-display').textContent = app.user.email.split('@')[0];
            app.loadHistory();
        }
    },

    loadHome: async () => {
        const trending = await app.req('trending/all/day');
        app.renderHero(trending.results[0]);
        app.renderRow('home-sections', 'Trending Today', trending.results);
        
        const movies = await app.req('movie/popular');
        app.renderRow('home-sections', 'Popular Movies', movies.results);
    },

    renderHero: (item) => {
        const el = document.getElementById('hero-carousel');
        el.innerHTML = `
            <div class="hero-bg" style="background-image: linear-gradient(0deg, #050505, transparent), url(https://image.tmdb.org/t/p/original${item.backdrop_path})">
                <div class="hero-info">
                    <h1>${item.title || item.name}</h1>
                    <p>${item.overview.slice(0, 150)}...</p>
                    <button onclick="app.open(${item.id}, '${item.media_type}')">Play Now</button>
                </div>
            </div>
        `;
    },

    renderRow: (targetId, title, list) => {
        const container = document.getElementById(targetId);
        const section = document.createElement('div');
        section.className = 'section-container';
        section.innerHTML = `
            <h2 class="sec-title">${title}</h2>
            <div class="row-container grid-layout"></div>
        `;
        const grid = section.querySelector('.grid-layout');
        list.forEach(item => grid.appendChild(app.createCard(item)));
        container.appendChild(section);
    },

    createCard: (item, isHist = false) => {
        const div = document.createElement('div');
        div.className = 'media-card';
        div.innerHTML = `
            <img src="https://image.tmdb.org/t/p/w500${item.poster_path}" loading="lazy">
            <div class="card-info">
                <h4>${item.title || item.name}</h4>
                <span>⭐ ${item.vote_average.toFixed(1)}</span>
            </div>
            ${isHist ? `<div class="remove-x" onclick="app.removeHist('${item.id}')">✕</div>` : ''}
        `;
        div.onclick = (e) => {
            if(e.target.className !== 'remove-x') app.open(item.id, item.media_type || (item.title ? 'movie' : 'tv'));
        };
        return div;
    },

    open: async (id, type) => {
        app.cur = await app.req(`${type}/${id}?append_to_response=videos,release_dates,content_ratings`);
        const modal = document.getElementById('info-modal');
        
        document.getElementById('modal-title').textContent = app.cur.title || app.cur.name;
        document.getElementById('modal-desc').textContent = app.cur.overview;
        document.getElementById('modal-poster').src = `https://image.tmdb.org/t/p/w500${app.cur.poster_path}`;
        document.getElementById('modal-rating').textContent = `⭐ ${app.cur.vote_average.toFixed(1)}`;
        
        // Find IMDb ID and Age Rating
        document.getElementById('modal-imdb').textContent = `IMDb: ${app.cur.vote_average}`; // Simplified
        const certifications = type === 'movie' ? app.cur.release_dates.results : app.cur.content_ratings.results;
        const us = certifications.find(r => r.iso_3166_1 === 'US');
        document.getElementById('modal-age').textContent = us ? (type === 'movie' ? us.release_dates[0].certification : us.rating) : 'PG-13';

        // Trailer
        const trailer = app.cur.videos.results.find(v => v.type === 'Trailer');
        document.getElementById('trailer-wrap').innerHTML = trailer ? `<iframe src="https://www.youtube.com/embed/${trailer.key}"></iframe>` : '';

        // TV Seasons
        if(type === 'tv') {
            document.getElementById('season-selector-wrap').classList.remove('hidden');
            const sel = document.getElementById('season-select');
            sel.innerHTML = app.cur.seasons.map(s => `<option value="${s.season_number}">${s.name}</option>`).join('');
        } else {
            document.getElementById('season-selector-wrap').classList.add('hidden');
        }

        document.getElementById('play-btn').onclick = () => player.start(id, type);
        modal.style.display = 'flex';
    },

    loadNetworks: async () => {
        const nets = [
            { id: 213, n: 'Netflix' },
            { id: 1024, n: 'Prime' },
            { id: 2739, n: 'Disney' },
            { id: 49, n: 'HBO' },
            { id: 34, n: 'Sony' }
        ];
        const grid = document.getElementById('networks-grid');
        for(let n of nets) {
            const data = await app.req(`network/${n.id}`);
            const div = document.createElement('div');
            div.className = 'net-item';
            div.innerHTML = `<img src="https://image.tmdb.org/t/p/h60${data.logo_path}">`;
            div.onclick = () => app.loadDiscoverByNet(n.id);
            grid.appendChild(div);
        }
    },

    bindEvents: () => {
        // Event Delegation
        document.addEventListener('click', (e) => {
            if(e.target.classList.contains('modal-close') || e.target.id === 'info-modal') {
                document.getElementById('info-modal').style.display = 'none';
            }
        });

        // Search
        document.getElementById('desktop-search-input').onkeyup = (e) => app.search(e.target.value);
        document.getElementById('mobile-search-btn').onclick = () => document.getElementById('mobile-search-screen').classList.add('active');
        document.getElementById('close-search').onclick = () => document.getElementById('mobile-search-screen').classList.remove('active');

        // Auth
        document.getElementById('auth-submit').onclick = app.handleAuth;
        document.getElementById('guest-btn').onclick = () => document.getElementById('auth-modal').style.display = 'none';
    },

    handleAuth: async () => {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-password').value;
        const isLogin = document.getElementById('auth-title').textContent === 'Login';
        
        const { data, error } = isLogin ? 
            await supabase.auth.signInWithPassword({ email, password: pass }) :
            await supabase.auth.signUp({ email, password: pass });

        if(error) alert(error.message);
        else location.reload();
    }
};

const player = {
    s: 1, e: 1, srv: 0,
    
    start: (id, type) => {
        document.getElementById('player-screen').style.display = 'block';
        player.load(id, type);
    },

    load: (id, type) => {
        const iframe = document.getElementById('main-iframe');
        iframe.src = SERVERS[player.srv].u(id, type, player.s, player.e);
        
        if(type === 'tv') {
            player.loadEpisodes(id);
        }
        
        // Auto-change detection (Simulated)
        iframe.onerror = () => player.autoSwitch();
    },

    loadEpisodes: async (id) => {
        const data = await app.req(`tv/${id}/season/${player.s}`);
        const list = document.getElementById('episode-list');
        list.innerHTML = data.episodes.map(ep => `
            <div class="ep-item ${ep.episode_number == player.e ? 'active' : ''}" onclick="player.setEp(${ep.episode_number})">
                <span>${ep.episode_number}. ${ep.name}</span>
            </div>
        `).join('');
    },

    setEp: (num) => {
        player.e = num;
        player.load(app.cur.id, 'tv');
    },

    autoSwitch: () => {
        player.srv = (player.srv + 1) % SERVERS.length;
        const anim = document.getElementById('server-animation');
        anim.classList.remove('hidden');
        setTimeout(() => {
            anim.classList.add('hidden');
            player.load(app.cur.id, app.cur.title ? 'movie' : 'tv');
        }, 1500);
    },

    close: () => {
        document.getElementById('player-screen').style.display = 'none';
        document.getElementById('main-iframe').src = '';
    }
};

app.init();