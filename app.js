const { useState, useEffect } = React;
const { createRoot } = ReactDOM;
const { MemoryRouter, Routes, Route, Link, useNavigate, useLocation } = ReactRouterDOM;

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyD3_ySeudMfXeO3lrJRIPvnqGgyMr8FVf8",
    authDomain: "chi-analytics-5336b.firebaseapp.com",
    projectId: "chi-analytics-5336b",
    storageBucket: "chi-analytics-5336b.firebasestorage.app",
    messagingSenderId: "900231721396",
    appId: "1:900231721396:web:04171620f970602a4842e1",
    measurementId: "G-H6H95H6TT3"
};

// Initialize Firebase (Compat)
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- Hooks ---

const useFirestore = (collectionName, docId, initialValue) => {
    const [data, setData] = useState(initialValue);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const docRef = db.collection(collectionName).doc(docId);

        // Initial fetch and subscription
        const unsubscribe = docRef.onSnapshot((doc) => {
            if (doc.exists) {
                setData(doc.data().content);
            } else {
                // If doc doesn't exist, try to migrate from local storage
                const legacyKey = collectionName === 'events' ? 'chi_analytics_match_events' : `chi_analytics_${collectionName}`;
                const localData = window.localStorage.getItem(legacyKey);
                if (localData) {
                    const parsed = JSON.parse(localData);
                    docRef.set({ content: parsed });
                    setData(parsed);
                } else {
                    docRef.set({ content: initialValue });
                }
            }
            setLoading(false);
        }, (error) => {
            console.error("Firestore Error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [collectionName, docId]);

    const updateData = async (newData) => {
        const valueToStore = newData instanceof Function ? newData(data) : newData;
        setData(valueToStore);
        try {
            await db.collection(collectionName).doc(docId).set({ content: valueToStore });
            // Keep local storage as backup
            window.localStorage.setItem(`chi_analytics_${collectionName}`, JSON.stringify(valueToStore));
        } catch (error) {
            console.error("Error updating Firestore:", error);
        }
    };

    return [data, updateData, loading];
};

// --- New League-Based Hooks ---

const useLeague = (leagueId) => {
    const [league, setLeague] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!leagueId) {
            setLoading(false);
            return;
        }

        const leagueRef = db.collection('leagues').doc(leagueId);
        const unsubscribe = leagueRef.onSnapshot((doc) => {
            if (doc.exists) {
                setLeague({ id: doc.id, ...doc.data() });
            } else {
                // Create default league
                const defaultLeague = {
                    name: "Mi Liga",
                    season: "2024-2025",
                    teamIds: []
                };
                leagueRef.set(defaultLeague);
                setLeague({ id: leagueId, ...defaultLeague });
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [leagueId]);

    const updateLeague = async (updates) => {
        if (!leagueId) return;
        try {
            await db.collection('leagues').doc(leagueId).update(updates);
        } catch (error) {
            console.error("Error updating league:", error);
        }
    };

    return [league, updateLeague, loading];
};

const useTeams = (leagueId) => {
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!leagueId) {
            setLoading(false);
            return;
        }

        const teamsRef = db.collection('leagues').doc(leagueId).collection('teams');
        const unsubscribe = teamsRef.onSnapshot((snapshot) => {
            const teamsData = [];
            snapshot.forEach((doc) => {
                teamsData.push({ id: doc.id, ...doc.data() });
            });
            setTeams(teamsData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [leagueId]);

    const addTeam = async (teamData) => {
        if (!leagueId) return;
        try {
            const teamRef = await db.collection('leagues').doc(leagueId).collection('teams').add({
                ...teamData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return teamRef.id;
        } catch (error) {
            console.error("Error adding team:", error);
        }
    };

    const updateTeam = async (teamId, updates) => {
        if (!leagueId) return;
        try {
            await db.collection('leagues').doc(leagueId).collection('teams').doc(teamId).update(updates);
        } catch (error) {
            console.error("Error updating team:", error);
        }
    };

    const deleteTeam = async (teamId) => {
        if (!leagueId) return;
        try {
            await db.collection('leagues').doc(leagueId).collection('teams').doc(teamId).delete();
        } catch (error) {
            console.error("Error deleting team:", error);
        }
    };

    return [teams, { addTeam, updateTeam, deleteTeam }, loading];
};

const useMatches = (leagueId) => {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!leagueId) {
            setLoading(false);
            return;
        }

        const matchesRef = db.collection('leagues').doc(leagueId).collection('matches')
            .orderBy('date', 'desc');

        const unsubscribe = matchesRef.onSnapshot((snapshot) => {
            const matchesData = [];
            snapshot.forEach((doc) => {
                matchesData.push({ id: doc.id, ...doc.data() });
            });
            setMatches(matchesData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [leagueId]);

    const addMatch = async (matchData) => {
        if (!leagueId) return;
        try {
            const matchRef = await db.collection('leagues').doc(leagueId).collection('matches').add({
                ...matchData,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            return matchRef.id;
        } catch (error) {
            console.error("Error adding match:", error);
        }
    };

    const updateMatch = async (matchId, updates) => {
        if (!leagueId) return;
        try {
            await db.collection('leagues').doc(leagueId).collection('matches').doc(matchId).update(updates);
        } catch (error) {
            console.error("Error updating match:", error);
        }
    };

    return [matches, { addMatch, updateMatch }, loading];
};

const useLocalStorage = (key, initialValue) => {
    const [storedValue, setStoredValue] = useState(() => {
        try {
            const item = window.localStorage.getItem(key);
            return item ? JSON.parse(item) : initialValue;
        } catch (error) {
            console.error(error);
            return initialValue;
        }
    });

    const setValue = (value) => {
        try {
            const valueToStore = value instanceof Function ? value(storedValue) : value;
            setStoredValue(valueToStore);
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch (error) {
            console.error(error);
        }
    };

    return [storedValue, setValue];
};

// --- Common Components ---

const NavButton = ({ to, label, icon }) => {
    const location = useLocation();
    const isActive = location.pathname === to;
    return (
        <Link
            to={to}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${isActive
                ? 'bg-primary/10 text-primary border-r-4 border-primary'
                : 'text-text-secondary hover:bg-surface-dark-light hover:text-white'
                }`}
        >
            <span className="material-symbols-outlined text-[24px]">{icon}</span>
            <span className="hidden lg:block text-sm font-medium leading-normal">{label}</span>
        </Link>
    );
};

const MainSidebar = ({ onOpenLeagueManager }) => (
    <aside className="w-20 lg:w-64 flex-shrink-0 border-r border-border-dark bg-surface-dark flex flex-col justify-between sticky top-0 h-screen overflow-y-auto transition-all duration-300 z-20">
        <div className="flex flex-col gap-6 p-4">
            <div className="flex items-center gap-3 px-2">
                <div className="bg-primary/20 p-2 rounded-lg">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: '28px' }}>sports_handball</span>
                </div>
                <div className="hidden lg:flex flex-col">
                    <h1 className="text-base text-white font-bold leading-none tracking-wide uppercase">CHI Analytics</h1>
                    <p className="text-text-secondary text-xs font-normal">Pro Analytics</p>
                </div>
            </div>
            <nav className="flex flex-col gap-2">
                <NavButton to="/dashboard" label="Lligues" icon="emoji_events" />
                <NavButton to="/teams" label="Equips" icon="groups" />
                <NavButton to="/player" label="Jugadors" icon="person" />
                <NavButton to="/match-analysis" label="Anàlisi Partit" icon="analytics" />
                <NavButton to="/integrations" label="Insights IA" icon="psychology" />
                <NavButton to="/scouting" label="Scouting" icon="smart_display" />
            </nav>

            {/* League Manager Button */}
            {onOpenLeagueManager && (
                <div className="pt-4 border-t border-white/5">
                    <button
                        onClick={onOpenLeagueManager}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all bg-gradient-to-r from-primary/20 to-purple-500/20 hover:from-primary/30 hover:to-purple-500/30 text-white border border-primary/30 hover:border-primary/50"
                    >
                        <span className="material-symbols-outlined text-[24px]">workspace_premium</span>
                        <span className="hidden lg:block text-sm font-bold leading-normal">GESTOR DE LLIGA</span>
                    </button>
                </div>
            )}
        </div>
        <div className="p-4">
            <NavButton to="/admin" label="Configuració" icon="settings" />
            <Link to="/" className="flex items-center gap-3 px-3 py-3 mt-2 rounded-lg text-text-secondary hover:bg-surface-dark-light hover:text-white transition-colors">
                <span className="material-symbols-outlined">logout</span>
                <span className="hidden lg:block text-sm font-medium">Sortir</span>
            </Link>
        </div>
    </aside>
);

// --- Component: TeamManager (Modal) ---

const TeamManager = ({ teams, onUpdateTeams, onClose }) => {
    const [importUrl, setImportUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [newPlayerName, setNewPlayerName] = useState('');
    const [newPlayerNumber, setNewPlayerNumber] = useState('');
    const [activeCategory, setActiveCategory] = useState('PLAYERS');
    const [activeTeamTab, setActiveTeamTab] = useState('myTeam');
    const [scrapingResults, setScrapingResults] = useState(null);

    const players = teams[activeTeamTab] || [];

    const handleAddPlayer = () => {
        if (!newPlayerName || !newPlayerNumber) return;
        const newPlayer = {
            id: Date.now(),
            number: parseInt(newPlayerNumber, 10),
            name: newPlayerName,
            category: activeCategory
        };
        const updated = [...players, newPlayer].sort((a, b) => a.number - b.number);
        onUpdateTeams({ ...teams, [activeTeamTab]: updated });
        setNewPlayerName('');
        setNewPlayerNumber('');
    };

    const handleRemovePlayer = (id) => {
        const updated = players.filter(p => p.id !== id);
        onUpdateTeams({ ...teams, [activeTeamTab]: updated });
    };

    const fetchHtmlSafe = async (targetUrl) => {
        try {
            const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`);
            if (res.ok) {
                const json = await res.json();
                return json.contents;
            }
        } catch (e) {
            console.error("Proxy error", e);
        }
        throw new Error("Error de connexió. Revisa la URL.");
    };

    const handleImport = async () => {
        if (!importUrl) return;
        setIsLoading(true);
        setError(null);
        setScrapingResults(null);
        try {
            const html = await fetchHtmlSafe(importUrl);
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const isRosterPage = importUrl.includes('equipo.php');
            const foundTeams = [];

            if (isRosterPage) {
                // Scrape Roster Page (e.g., https://resultadosbalonmano.isquad.es/equipo.php?...)
                const rosterTable = doc.querySelector('.tabla-plantilla');
                if (rosterTable) {
                    const rows = Array.from(rosterTable.querySelectorAll('tr'));
                    const teamData = [];
                    rows.forEach(row => {
                        const nameCell = row.querySelector('.nombres-equipos');
                        const categoryCell = row.querySelector('td.centrado:nth-child(2)');

                        if (nameCell && categoryCell) {
                            const name = nameCell.innerText.trim();
                            const catText = categoryCell.innerText.trim().toLowerCase();
                            const category = catText.includes('entrenador') || catText.includes('staff') ? 'STAFF' : 'PLAYERS';

                            teamData.push({
                                id: Math.random(),
                                number: 0, // No dorsal in this view
                                name: name,
                                category: category
                            });
                        }
                    });

                    if (teamData.length > 0) {
                        const teamTitle = doc.querySelector('h3')?.innerText.trim() || "Nova Plantilla";
                        foundTeams.push({
                            name: teamTitle,
                            players: teamData
                        });
                    }
                }
            } else {
                // Original Match Report Scraper
                const tables = Array.from(doc.querySelectorAll('table'));
                tables.forEach((table, idx) => {
                    const rows = Array.from(table.querySelectorAll('tr'));
                    const teamPlayers = [];
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 2) {
                            const num = cells[0].innerText.trim();
                            const name = cells[1].innerText.trim();
                            if (/^\d+$/.test(num) && name.length > 3 && !name.includes("TOTAL")) {
                                teamPlayers.push({
                                    id: Math.random(),
                                    number: parseInt(num, 10),
                                    name: name,
                                    category: 'PLAYERS'
                                });
                            }
                        }
                    });

                    if (teamPlayers.length > 5) {
                        let teamName = `Equip ${foundTeams.length + 1}`;
                        const prevElement = table.previousElementSibling || table.parentElement?.previousElementSibling;
                        if (prevElement && prevElement.innerText) {
                            teamName = prevElement.innerText.split('\n')[0].trim();
                        }

                        foundTeams.push({
                            name: teamName,
                            players: teamPlayers.sort((a, b) => a.number - b.number)
                        });
                    }
                });
            }

            if (foundTeams.length > 0) {
                setScrapingResults(foundTeams);
            } else {
                throw new Error("No s'han trobat dades en aquesta URL. Verifica que sigui una acta de partit o una fitxa d'equip de ISquad.");
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const applyImport = (importedPlayers, target) => {
        onUpdateTeams({ ...teams, [target]: importedPlayers });
        setScrapingResults(null);
        setImportUrl('');
        setActiveTeamTab(target);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-white">
            <div className="bg-surface-dark border border-border-dark w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-border-dark flex justify-between items-center bg-background-dark/50">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">analytics</span>
                        Advanced Team Manager
                    </h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Import Section */}
                    <div className="space-y-4 bg-primary/5 p-5 rounded-xl border border-primary/20">
                        <label className="text-xs font-bold text-primary flex items-center gap-2 tracking-widest uppercase">
                            <span className="material-symbols-outlined text-[18px]">cloud_download</span>
                            Import Match Report (ISquad / FCH)
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="https://isquad.es/partido/..."
                                className="flex-1 bg-background-dark border border-border-dark rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                                value={importUrl}
                                onChange={(e) => setImportUrl(e.target.value)}
                            />
                            <button
                                onClick={handleImport}
                                disabled={isLoading}
                                className="bg-primary hover:bg-primary/90 px-6 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {isLoading ? <span className="animate-spin text-[16px] material-symbols-outlined">sync</span> : 'Analitzar'}
                            </button>
                        </div>

                        {scrapingResults && (
                            <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <p className="text-xs font-bold text-text-secondary">S'HAN TROBAT {scrapingResults.length} EQUIPS:</p>
                                {scrapingResults.map((res, i) => (
                                    <div key={i} className="flex flex-col md:flex-row md:items-center justify-between p-3 bg-background-dark/80 rounded-lg border border-white/5 gap-3">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold truncate max-w-[200px]">{res.name}</span>
                                            <span className="text-[10px] text-text-secondary uppercase">{res.players.length} Jugadors detectats</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => applyImport(res.players, 'myTeam')}
                                                className="text-[10px] font-bold bg-primary/20 hover:bg-primary/40 text-primary border border-primary/30 px-3 py-1.5 rounded-md transition-all"
                                            >
                                                IMPORTAR COM MI EQUIP
                                            </button>
                                            <button
                                                onClick={() => applyImport(res.players, 'rivalTeam')}
                                                className="text-[10px] font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-md transition-all"
                                            >
                                                IMPORTAR COM RIVAL
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {error && <p className="text-red-400 text-xs flex items-center gap-1"><span className="material-symbols-outlined text-sm">error</span> {error}</p>}
                    </div>

                    {/* Team Selection Tabs */}
                    <div className="flex gap-4 border-b border-border-dark">
                        <button
                            onClick={() => setActiveTeamTab('myTeam')}
                            className={`pb-3 px-2 text-sm font-bold transition-all relative ${activeTeamTab === 'myTeam' ? 'text-primary' : 'text-text-secondary hover:text-white'}`}
                        >
                            EL MEU EQUIP
                            {activeTeamTab === 'myTeam' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary"></div>}
                        </button>
                        <button
                            onClick={() => setActiveTeamTab('rivalTeam')}
                            className={`pb-3 px-2 text-sm font-bold transition-all relative ${activeTeamTab === 'rivalTeam' ? 'text-red-400' : 'text-text-secondary hover:text-white'}`}
                        >
                            EQUIP RIVAL
                            {activeTeamTab === 'rivalTeam' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-400"></div>}
                        </button>
                    </div>

                    {/* Manual Management */}
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <div className="flex gap-2 p-1 bg-background-dark rounded-lg">
                                <button
                                    onClick={() => setActiveCategory('PLAYERS')}
                                    className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeCategory === 'PLAYERS' ? 'bg-surface-dark-light text-white shadow-sm' : 'text-text-secondary hover:text-white'}`}
                                >
                                    JUGADORS
                                </button>
                                <button
                                    onClick={() => setActiveCategory('STAFF')}
                                    className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${activeCategory === 'STAFF' ? 'bg-surface-dark-light text-white shadow-sm' : 'text-text-secondary hover:text-white'}`}
                                >
                                    STAFF TÈCNIC
                                </button>
                            </div>
                            <div className="flex gap-2 flex-1 min-w-[300px]">
                                <input
                                    type="number"
                                    placeholder="#"
                                    className="w-14 bg-background-dark border border-border-dark rounded-lg px-2 py-2 text-sm text-center"
                                    value={newPlayerNumber}
                                    onChange={(e) => setNewPlayerNumber(e.target.value)}
                                />
                                <input
                                    type="text"
                                    placeholder={`Afegir ${activeCategory === 'PLAYERS' ? 'jugador' : 'oficial'} manualment...`}
                                    className="flex-1 bg-background-dark border border-border-dark rounded-lg px-4 py-2 text-sm"
                                    value={newPlayerName}
                                    onChange={(e) => setNewPlayerName(e.target.value)}
                                />
                                <button
                                    onClick={handleAddPlayer}
                                    className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20 rounded-lg px-4 transition-all"
                                >
                                    <span className="material-symbols-outlined">add</span>
                                </button>
                            </div>
                        </div>

                        {/* List */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {players.map(p => (
                                <div key={p.id} className="flex items-center gap-3 bg-background-dark/40 p-3 rounded-xl border border-white/5 group hover:border-white/10 transition-all">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${activeTeamTab === 'myTeam' ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-400'}`}>
                                        {p.number}
                                    </div>
                                    <div className="flex flex-col flex-1 min-w-0">
                                        <span className="text-sm font-medium truncate">{p.name}</span>
                                        <span className="text-[10px] text-text-secondary uppercase">{p.category}</span>
                                    </div>
                                    <button
                                        onClick={() => handleRemovePlayer(p.id)}
                                        className="opacity-0 group-hover:opacity-100 text-red-500/50 hover:text-red-500 transition-all px-2"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">close</span>
                                    </button>
                                </div>
                            ))}
                        </div>
                        {players.length === 0 && (
                            <div className="py-20 text-center bg-background-dark/20 rounded-2xl border-2 border-dashed border-white/5">
                                <span className="material-symbols-outlined text-4xl opacity-10 mb-2">person_add</span>
                                <p className="text-sm text-text-secondary">No hi ha dades per aquest equip.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 border-t border-border-dark flex justify-end bg-background-dark/30 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="bg-white/5 hover:bg-white/10 text-white font-bold px-8 py-2.5 rounded-xl transition-all border border-white/10"
                    >
                        TANCAR
                    </button>
                </div>
            </div>
        </div>
    );
};

const LeagueManager = ({ leagueId, onClose }) => {
    const [league, updateLeague, loadingLeague] = useLeague(leagueId);
    const [teams, teamActions, loadingTeams] = useTeams(leagueId);
    const [activeTab, setActiveTab] = useState('teams');
    const [importUrl, setImportUrl] = useState('');
    const [isImporting, setIsImporting] = useState(false);
    const [importError, setImportError] = useState(null);

    const handleImportFromClassification = async () => {
        if (!importUrl) return;
        setIsImporting(true);
        setImportError(null);

        try {
            const html = await fetchHtmlSafe(importUrl);
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Extract teams from classification table
            const rows = Array.from(doc.querySelectorAll('table tbody tr'));
            const detectedTeams = [];

            for (const row of rows) {
                const teamLink = row.querySelector('a[href*="id_equipo"]');
                if (teamLink) {
                    const teamName = teamLink.innerText.trim();
                    const teamUrl = teamLink.href;
                    const teamIdMatch = teamUrl.match(/id_equipo=(\d+)/);

                    if (teamIdMatch) {
                        detectedTeams.push({
                            name: teamName,
                            externalId: teamIdMatch[1],
                            url: teamUrl,
                            players: [],
                            isMyTeam: false
                        });
                    }
                }
            }

            // Import all detected teams
            for (const team of detectedTeams) {
                await teamActions.addTeam(team);
            }

            setImportUrl('');
            alert(`✅ ${detectedTeams.length} equipos importados correctamente`);
        } catch (error) {
            setImportError(error.message);
        } finally {
            setIsImporting(false);
        }
    };

    const markAsMyTeam = async (teamId) => {
        // Unmark all other teams
        for (const team of teams) {
            if (team.isMyTeam && team.id !== teamId) {
                await teamActions.updateTeam(team.id, { isMyTeam: false });
            }
        }
        // Mark selected team
        await teamActions.updateTeam(teamId, { isMyTeam: true });
    };

    if (loadingLeague || loadingTeams) {
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-primary font-bold">CARREGANT LLIGA...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-white">
            <div className="bg-surface-dark border border-border-dark w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-background-dark/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">emoji_events</span>
                            Gestor de Lliga
                        </h2>
                        <p className="text-sm text-text-secondary mt-1">{league?.name || 'Mi Liga'} • {league?.season || '2024-2025'}</p>
                    </div>
                    <button onClick={onClose} className="text-text-secondary hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 px-6 pt-4 border-b border-white/5">
                    <button
                        onClick={() => setActiveTab('teams')}
                        className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-all ${activeTab === 'teams'
                            ? 'bg-primary text-white'
                            : 'bg-white/5 text-text-secondary hover:bg-white/10'
                            }`}
                    >
                        EQUIPS ({teams.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('import')}
                        className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-all ${activeTab === 'import'
                            ? 'bg-primary text-white'
                            : 'bg-white/5 text-text-secondary hover:bg-white/10'
                            }`}
                    >
                        IMPORTAR
                    </button>
                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`px-4 py-2 rounded-t-lg font-bold text-sm transition-all ${activeTab === 'settings'
                            ? 'bg-primary text-white'
                            : 'bg-white/5 text-text-secondary hover:bg-white/10'
                            }`}
                    >
                        CONFIGURACIÓ
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'teams' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {teams.map(team => (
                                <div key={team.id} className="p-4 rounded-xl bg-background-dark/50 border border-white/5 hover:border-primary/30 transition-all">
                                    <div className="flex items-start justify-between mb-3">
                                        <h3 className="font-bold text-white flex-1">{team.name}</h3>
                                        {team.isMyTeam && (
                                            <span className="px-2 py-1 bg-primary/20 text-primary text-xs font-bold rounded">
                                                MEU EQUIP
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-text-secondary mb-3">
                                        {team.players?.length || 0} jugadors
                                    </p>
                                    <div className="flex gap-2">
                                        {!team.isMyTeam && (
                                            <button
                                                onClick={() => markAsMyTeam(team.id)}
                                                className="flex-1 bg-white/5 hover:bg-primary/20 text-white text-xs font-bold py-2 rounded-lg transition-all"
                                            >
                                                MARCAR COM A MEU
                                            </button>
                                        )}
                                        <button
                                            onClick={() => teamActions.deleteTeam(team.id)}
                                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold px-3 py-2 rounded-lg transition-all"
                                        >
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {teams.length === 0 && (
                                <div className="col-span-full py-20 text-center bg-background-dark/20 rounded-2xl border-2 border-dashed border-white/5">
                                    <span className="material-symbols-outlined text-4xl opacity-10 mb-2">groups</span>
                                    <p className="text-sm text-text-secondary">No hi ha equips. Importa'ls des de la pestanya IMPORTAR.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'import' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div className="p-6 rounded-xl bg-background-dark/50 border border-white/5">
                                <h3 className="font-bold text-lg mb-4">Importació Massiva des d'ISquad</h3>
                                <p className="text-sm text-text-secondary mb-4">
                                    Enganxa l'URL d'una classificació d'ISquad per importar tots els equips automàticament.
                                </p>
                                <input
                                    type="text"
                                    placeholder="https://resultadosbalonmano.isquad.es/clasificacion.php?id=..."
                                    className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50 mb-4"
                                    value={importUrl}
                                    onChange={(e) => setImportUrl(e.target.value)}
                                />
                                {importError && (
                                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm mb-4">
                                        {importError}
                                    </div>
                                )}
                                <button
                                    onClick={handleImportFromClassification}
                                    disabled={isImporting || !importUrl}
                                    className="w-full bg-primary hover:bg-primary/90 disabled:bg-white/5 disabled:text-text-secondary text-white font-bold py-3 rounded-xl transition-all"
                                >
                                    {isImporting ? 'IMPORTANT...' : 'IMPORTAR EQUIPS'}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div className="p-6 rounded-xl bg-background-dark/50 border border-white/5">
                                <h3 className="font-bold text-lg mb-4">Configuració de la Lliga</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest block mb-2">
                                            Nom de la Lliga
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                                            value={league?.name || ''}
                                            onChange={(e) => updateLeague({ name: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-text-secondary uppercase tracking-widest block mb-2">
                                            Temporada
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                                            value={league?.season || ''}
                                            onChange={(e) => updateLeague({ season: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/5 flex justify-end bg-background-dark/30 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="bg-white/5 hover:bg-white/10 text-white font-bold px-8 py-2.5 rounded-xl transition-all border border-white/10"
                    >
                        TANCAR
                    </button>
                </div>
            </div>
        </div>
    );
};

const PlayerEditor = ({ player, onSave, onClose }) => {
    const [name, setName] = useState(player.name);
    const [number, setNumber] = useState(player.number);
    const [category, setCategory] = useState(player.category);

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-white">
            <div className="bg-surface-dark border border-border-dark w-full max-w-md rounded-2xl shadow-2xl flex flex-col">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-background-dark/50 rounded-t-2xl">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary">edit</span>
                        Editar Perfil
                    </h2>
                    <button onClick={onClose} className="text-text-secondary hover:text-white transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">Dorsal / Número</label>
                            <input
                                type="number"
                                className="bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-lg font-black text-primary outline-none focus:ring-2 focus:ring-primary/50"
                                value={number}
                                onChange={(e) => setNumber(parseInt(e.target.value, 10))}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">Nom Complet</label>
                            <input
                                type="text"
                                className="bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-bold text-text-secondary uppercase tracking-widest">Categoria</label>
                            <select
                                className="bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/50"
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                            >
                                <option value="PLAYERS">Jugador</option>
                                <option value="STAFF">Staff Tècnic</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-white/5 flex gap-3 bg-background-dark/30 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all"
                    >
                        CANCEL·LAR
                    </button>
                    <button
                        onClick={() => onSave({ ...player, name, number, category })}
                        className="flex-1 bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-primary/20"
                    >
                        GUARDAR
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Pages ---

const LandingPage = () => {
    return (
        <div className="relative flex min-h-screen w-full flex-col group/design-root">
            <header className="sticky top-0 z-50 w-full border-b border-solid border-slate-200 dark:border-[#233648] bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md">
                <div className="px-4 md:px-10 lg:px-40 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4 cursor-pointer">
                        <div className="size-8 text-primary">
                            <svg className="w-full h-full" fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                                <path d="M42.1739 20.1739L27.8261 5.82609C29.1366 7.13663 28.3989 10.1876 26.2002 13.7654C24.8538 15.9564 22.9595 18.3449 20.6522 20.6522C18.3449 22.9595 15.9564 24.8538 13.7654 26.2002C10.1876 28.3989 7.13663 29.1366 5.82609 27.8261L20.1739 42.1739C21.4845 43.4845 24.5355 42.7467 28.1133 40.548C30.3042 39.2016 32.6927 37.3073 35 35C37.3073 32.6927 39.2016 30.3042 40.548 28.1133C42.7467 24.5355 43.4845 21.4845 42.1739 20.1739Z" fill="currentColor"></path>
                            </svg>
                        </div>
                        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-tight">CHI-analytics</h2>
                    </div>
                    <div className="hidden md:flex flex-1 justify-end gap-8 items-center">
                        <nav className="flex items-center gap-9">
                            <a className="text-slate-600 dark:text-white text-sm font-medium hover:text-primary transition-colors" href="#">Funcionalitats</a>
                            <a className="text-slate-600 dark:text-white text-sm font-medium hover:text-primary transition-colors" href="#">Preus</a>
                            <a className="text-slate-600 dark:text-white text-sm font-medium hover:text-primary transition-colors" href="#">Sobre nosaltres</a>
                        </nav>
                        <div className="flex gap-2">
                            <Link to="/dashboard" className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-slate-200 dark:bg-surface-dark text-slate-900 dark:text-white text-sm font-bold hover:bg-slate-300 dark:hover:bg-[#233648] transition-all">
                                <span className="truncate">Inicia Sessió</span>
                            </Link>
                            <Link to="/dashboard" className="flex min-w-[84px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 px-4 bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
                                <span className="truncate">Sol·licita Demo</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </header>
            <main className="flex-1 w-full">
                <section className="px-4 md:px-10 lg:px-40 py-5 w-full flex justify-center">
                    <div className="w-full max-w-[1200px] flex flex-col">
                        <div className="@container">
                            <div className="py-4">
                                <div className="relative flex min-h-[560px] flex-col gap-6 overflow-hidden rounded-2xl bg-cover bg-center bg-no-repeat items-center justify-center p-8 md:p-14 text-center group" style={{ backgroundImage: 'linear-gradient(rgba(16, 25, 34, 0.7) 0%, rgba(16, 25, 34, 0.5) 50%, rgba(16, 25, 34, 0.9) 100%), url("https://lh3.googleusercontent.com/aida-public/AB6AXuCTCbBvY-i92gllQ1XRv3Gq8p6NSv8c-cK-G4BsH4rI_w05UIXhs0b4bm7YxIrknqQv6CY0Ka0p26f6kcSd8Y7CoTTIjTkBStG_DZpwhScolZVXok6yrepYlggNboAVnoygeMl1_86G9j6TvJ5N1ZHBBi-R2-85VLHxZ4Y_2nGJSqQv3nESWji-ny6zhZDbbmHwc4jNDCE83TwHE3w5y4mhsaKrEuFyUou3e5paIOReOypwxAd-FQK8yM0Mez03UKNIiNJYySS8SEyb")' }}>
                                    <div className="relative flex flex-col gap-4 max-w-[800px] z-10 animate-in fade-in zoom-in duration-700">
                                        <div className="inline-flex items-center gap-2 self-center rounded-full bg-primary/20 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary border border-primary/30 backdrop-blur-sm">
                                            <span className="material-symbols-outlined text-[16px]">verified</span>
                                            Soci Oficial d'Analítica
                                        </div>
                                        <h1 className="text-white text-4xl font-black leading-tight tracking-[-0.033em] md:text-6xl md:leading-[1.1]">
                                            El Futur de l' <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-300">Analítica d'Handbol</span> és Aquí.
                                        </h1>
                                        <h2 className="text-slate-200 text-base font-normal leading-relaxed md:text-lg max-w-[700px] mx-auto">
                                            Combina la metodologia observacional amb la IA per desbloquejar coneixements tàctics guanyadors per a equips professionals i seleccionadors nacionals.
                                        </h2>
                                    </div>
                                    <div className="relative flex flex-wrap gap-4 justify-center z-10 mt-4">
                                        <Link to="/dashboard" className="flex h-12 min-w-[140px] cursor-pointer items-center justify-center rounded-lg bg-primary px-6 text-base font-bold text-white transition-transform hover:scale-105 hover:bg-blue-600 shadow-xl shadow-blue-900/20">
                                            <span className="truncate">Comença ara</span>
                                        </Link>
                                        <button className="flex h-12 min-w-[140px] cursor-pointer items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 px-6 text-base font-bold text-white transition-colors hover:bg-white/20">
                                            <span className="flex items-center gap-2">
                                                <span className="material-symbols-outlined">play_circle</span>
                                                <span className="truncate">Veure Vídeo</span>
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
};

const DashboardPage = ({ players, onOpenLeagueManager }) => {
    return (
        <div className="flex min-h-screen w-full">
            <MainSidebar onOpenLeagueManager={onOpenLeagueManager} />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-20 border-b border-border-dark bg-background-dark/80 backdrop-blur-md sticky top-0 z-10 px-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <h2 className="hidden md:block text-xl text-white font-bold tracking-tight">Panell de Lliga</h2>
                        <div className="relative group">
                            <div className="flex items-center gap-2 bg-[#233648] px-4 py-2 rounded-lg cursor-pointer border border-transparent hover:border-slate-600 transition-colors">
                                <span className="text-sm font-medium text-white">Liga ASOBAL 23/24</span>
                                <span className="material-symbols-outlined text-slate-500" style={{ fontSize: '20px' }}>expand_more</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 flex-1 justify-end max-w-2xl">
                        <div className="hidden md:flex w-full max-w-md items-center bg-[#233648] rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                            <span className="material-symbols-outlined text-slate-400 mr-2">search</span>
                            <input className="bg-transparent border-none text-sm w-full focus:ring-0 text-white placeholder:text-slate-500 p-0" placeholder="Cercar jugadors, equips o estadístiques..." type="text" />
                        </div>
                        <button className="relative p-2 text-slate-500 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined">notifications</span>
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
                        </button>
                        <div className="h-10 w-10 rounded-full bg-slate-700 overflow-hidden border-2 border-slate-600 cursor-pointer">
                            <img alt="Profile" className="h-full w-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBeCwXn9LLcKxbBl3OBToj-T1YqCGkMbQdNbcyzY7lvmKndE4zgDOqIdxEPmw83Dnfx0oTERQ5C4ovR6EJdb5AxJ45Q0OHE-t3TqcQZa8t1B__ViSNBiF-CgpKAWAixyod36Fbl7fdMBedVeJ8L4SZ87eLqMFJs7-qsBayv-awZsl-lkaeKNB8iONgtDbCx4oDq_57oEYHaqXyRjE6nmjp2HeedhJkPrXSEwKpRFNd5jxJ-j3cgYdlRP8coEjQORxwsH7srTh4GIAkV" />
                        </div>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                    <div className="max-w-[1600px] mx-auto space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Stat Card 1 */}
                            <div className="p-5 rounded-xl bg-card-dark border border-slate-800 shadow-sm relative overflow-hidden group">
                                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <span className="material-symbols-outlined text-6xl text-white">sports_handball</span>
                                </div>
                                <div className="flex flex-col gap-1 relative z-10">
                                    <p className="text-slate-400 text-sm font-medium">Partits Jugats</p>
                                    <div className="flex items-end gap-3">
                                        <h3 className="text-3xl font-bold text-white">120</h3>
                                        <span className="text-emerald-500 text-xs font-bold mb-1.5 px-1.5 py-0.5 bg-emerald-500/10 rounded">+2.1%</span>
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-slate-800 mt-4 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary w-[45%] rounded-full"></div>
                                </div>
                            </div>
                            {/* Stat Card 2 */}
                            <div className="p-5 rounded-xl bg-card-dark border border-slate-800 shadow-sm relative overflow-hidden group">
                                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <span className="material-symbols-outlined text-6xl text-white">scoreboard</span>
                                </div>
                                <div className="flex flex-col gap-1 relative z-10">
                                    <p className="text-slate-400 text-sm font-medium">Mitjana Gols/Partit</p>
                                    <div className="flex items-end gap-3">
                                        <h3 className="text-3xl font-bold text-white">58.4</h3>
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-slate-800 mt-4 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 w-[78%] rounded-full"></div>
                                </div>
                            </div>
                            {/* Stat Card 3 */}
                            <div className="p-5 rounded-xl bg-card-dark border border-slate-800 shadow-sm relative overflow-hidden group">
                                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <span className="material-symbols-outlined text-6xl text-primary">psychology</span>
                                </div>
                                <div className="flex flex-col gap-1 relative z-10">
                                    <p className="text-slate-400 text-sm font-medium">Precisió Predicció IA</p>
                                    <div className="flex items-end gap-3">
                                        <h3 className="text-3xl font-bold text-white">89%</h3>
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-slate-800 mt-4 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 w-[89%] rounded-full"></div>
                                </div>
                            </div>
                            {/* Stat Card 4 */}
                            <div className="p-5 rounded-xl bg-card-dark border border-slate-800 shadow-sm relative overflow-hidden group">
                                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <span className="material-symbols-outlined text-6xl text-white">person_search</span>
                                </div>
                                <div className="flex flex-col gap-1 relative z-10">
                                    <p className="text-slate-400 text-sm font-medium">Jugadors Actius</p>
                                    <div className="flex items-end gap-3">
                                        <h3 className="text-3xl font-bold text-white">{players.length}</h3>
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-slate-800 mt-4 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-400 w-full rounded-full"></div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                            <div className="xl:col-span-2 bg-card-dark rounded-xl border border-slate-800 shadow-sm flex flex-col">
                                <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary">leaderboard</span>
                                        Classificació de la Lliga
                                    </h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-white">
                                        <thead className="bg-[#151e26] text-slate-500 uppercase tracking-wider text-xs">
                                            <tr>
                                                <th className="px-6 py-4 font-semibold w-16 text-center">Pos</th>
                                                <th className="px-6 py-4 font-semibold">Equip</th>
                                                <th className="px-6 py-4 font-semibold text-center">Pts</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-800">
                                            <tr className="hover:bg-[#233648] transition-colors">
                                                <td className="px-6 py-4 text-center font-bold text-emerald-500">1</td>
                                                <td className="px-6 py-4 font-medium">Barca</td>
                                                <td className="px-6 py-4 text-center font-bold text-lg">29</td>
                                            </tr>
                                            <tr className="hover:bg-[#233648] transition-colors">
                                                <td className="px-6 py-4 text-center font-bold text-emerald-500">2</td>
                                                <td className="px-6 py-4 font-medium">Bidasoa Irun</td>
                                                <td className="px-6 py-4 text-center font-bold text-lg">24</td>
                                            </tr>
                                            <tr className="hover:bg-[#233648] transition-colors">
                                                <td className="px-6 py-4 text-center font-bold text-emerald-500">3</td>
                                                <td className="px-6 py-4 font-medium">Granollers</td>
                                                <td className="px-6 py-4 text-center font-bold text-lg">22</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="bg-card-dark rounded-xl border border-slate-800 shadow-sm flex flex-col">
                                <div className="p-5 border-b border-slate-800 flex justify-between items-center">
                                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                                        <span className="material-symbols-outlined text-purple-500">stars</span>
                                        Líders PScore
                                    </h3>
                                </div>
                                <div className="p-4 flex flex-col gap-4">
                                    <Link to="/player" className="flex items-center gap-4 p-3 rounded-lg hover:bg-[#233648] transition-colors border border-transparent hover:border-slate-700">
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200">
                                            <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAgS_jQthQOnHbRyzdpgpL2oK-tIodHG3FlgzHUUOi5aYnyslYlVV4sKtq-hFpcnvo_TxmPMhh2USnW1U6rRR4qhLZAeqZi1S5zU6Wb63G6Ddg-5olBDRRcZ9Ay8X-noVSoZY_xObFL573c8X06_jLUz8YbED2oCtvj-1A43LWB0gxULCe9ldk-yM2l3cMPaSbtGBZkPKCVlcIBvPabbRbbpcufHB8PtSvTD6DrRH84q_Jkh9UIMY9HcN18ZwjtYr54Z4SsELB5pV_r" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-sm text-white">Dika Mem</h4>
                                            <p className="text-xs text-slate-500">Barca • Lateral Dret</p>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xl font-bold text-primary">9.8</span>
                                        </div>
                                    </Link>
                                    <Link to="/player" className="flex items-center gap-4 p-3 rounded-lg hover:bg-[#233648] transition-colors border border-transparent hover:border-slate-700">
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-200">
                                            <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAGDCD1qICbvrtCfca2IAHEue9e6Yk7crpSSjqJaB0J9SCFvUHkEXokIJh95jLXDE4gbOCcMKwgdtuBk2g5KuL47n8OMEOg4xSm2beiRIhND8DNu77PZENBvabJJTWO_pCp4kUpqlNDumFIAQYuATy2_Ay2gijfs2fPXFHKbkWeFDm8rWDGkZNfWhq9RHf96dQdN86ZiHzEaiiCGEYn377QtMEUi_r8TTS9n47t54BqFUjW0Tjur6cQ4zp4BmPbFCg6ixIEl9xdTBma" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-sm text-white">Aleix Gómez</h4>
                                            <p className="text-xs text-slate-500">Barca • Extrem Dret</p>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-xl font-bold text-primary">9.4</span>
                                        </div>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

const PlayerProfilePage = ({ players, onUpdatePlayers, onShowManager, onOpenLeagueManager }) => {
    const [editingPlayer, setEditingPlayer] = useState(null);

    const handleSavePlayer = (updatedPlayer) => {
        const updatedPlayers = players.map(p => p.id === updatedPlayer.id ? updatedPlayer : p);
        onUpdatePlayers(updatedPlayers);
        setEditingPlayer(null);
    };

    return (
        <div className="flex min-h-screen w-full">
            <MainSidebar onOpenLeagueManager={onOpenLeagueManager} />
            <div className="flex-1 flex flex-col min-w-0 bg-background-dark overflow-y-auto">
                <header className="flex items-center justify-between whitespace-nowrap py-3 px-6 lg:px-12 border-b border-border-dark bg-surface-dark">
                    <div className="flex items-center gap-4 text-white">
                        <h2 className="text-white text-xl font-bold">Perfil de Jugador</h2>
                    </div>
                </header>
                <div className="px-6 lg:px-20 py-8">
                    <div className="max-w-[1280px] mx-auto flex flex-col gap-8">
                        {/* Header Stats & Action */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                            <div className="flex flex-col gap-1">
                                <h1 className="text-white text-3xl font-black tracking-tight">Gestió de Jugadors</h1>
                                <p className="text-text-secondary text-base">Administra la teva plantilla i visualitza el rendiment individual.</p>
                            </div>
                            <button
                                onClick={onShowManager}
                                className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-primary/20"
                            >
                                <span className="material-symbols-outlined">person_add</span>
                                <span>GESTIONAR PLANTILLA</span>
                            </button>
                        </div>

                        {/* Player Preview */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {players.map(p => (
                                <div key={p.id} className="p-5 rounded-2xl bg-surface-card border border-white/5 hover:border-primary/30 transition-all group relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <span className="material-symbols-outlined text-6xl text-white">person</span>
                                    </div>
                                    <div className="flex flex-col gap-4 relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="size-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-xl ring-1 ring-primary/30">
                                                {p.number}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <h3 className="text-white font-bold truncate">{p.name}</h3>
                                                <p className="text-text-secondary text-xs uppercase tracking-wider">{p.category === 'STAFF' ? 'Staff Tècnic' : 'Jugador'}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setEditingPlayer(p)}
                                                className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-bold py-2 rounded-lg transition-colors border border-white/10"
                                            >
                                                PERFIL/EDITAR
                                            </button>
                                            <button className="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs font-bold py-2 rounded-lg transition-colors border border-white/10">STATS</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {players.length === 0 && (
                                <div className="col-span-full py-20 bg-surface-dark/30 rounded-3xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-center">
                                    <div className="size-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                        <span className="material-symbols-outlined text-white/20 text-4xl">group_add</span>
                                    </div>
                                    <h3 className="text-white font-bold text-lg">Encara no hi ha jugadors</h3>
                                    <p className="text-text-secondary max-w-sm mt-2 mb-6">Importa la teva plantilla des de ISquad o afegeix jugadors manualment per començar a analitzar.</p>
                                    <button
                                        onClick={onShowManager}
                                        className="text-primary text-sm font-bold hover:underline"
                                    >
                                        Començar ara →
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {editingPlayer && (
                    <PlayerEditor
                        player={editingPlayer}
                        onSave={handleSavePlayer}
                        onClose={() => setEditingPlayer(null)}
                    />
                )}
            </div>
        </div>
    )
}

const MatchAnalysisPage = ({ onOpenLeagueManager }) => {
    return (
        <div className="flex min-h-screen w-full bg-background-dark text-white font-display overflow-x-hidden">
            <MainSidebar onOpenLeagueManager={onOpenLeagueManager} />
            <div className="flex-1 flex flex-col">
                <div className="px-6 md:px-10 lg:px-20 py-5">
                    <div className="flex flex-wrap justify-between items-end gap-3 p-4 border-b border-surface-dark-light/50 pb-6 mb-4">
                        <div className="flex min-w-72 flex-col gap-3">
                            <div className="flex items-center gap-3">
                                <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">Final</span>
                                <p className="text-text-secondary text-sm font-normal leading-normal">28 de Maig, 2023 • Colònia, Alemanya</p>
                            </div>
                            <h1 className="text-white text-4xl font-black leading-tight tracking-[-0.033em]">Barça <span className="text-primary">32</span> - <span className="text-text-secondary">29</span> Kiel</h1>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-4">
                        <div className="lg:col-span-8 flex flex-col gap-6">
                            <div className="bg-surface-dark rounded-xl p-1 border border-white/5 relative overflow-hidden group">
                                <div className="absolute top-4 left-4 z-10 bg-background-dark/80 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
                                    <span className="text-xs font-bold text-white uppercase tracking-wider">Distribució de Tirs</span>
                                </div>
                                <div className="bg-[#1a2634] w-full aspect-[4/3] rounded-lg relative overflow-hidden border border-[#2a3a4d]">
                                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#92adc9 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/5 h-1/3 bg-[#233648] border-t-2 border-l-2 border-r-2 border-[#92adc9]/40 rounded-t-[100px] z-0"></div>
                                    <div className="absolute bottom-[40%] left-1/2 -translate-x-1/2 size-24 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/40 cursor-pointer">
                                        <span className="text-white font-bold text-xs">45%</span>
                                    </div>
                                    <div className="absolute bottom-[35%] right-[20%] size-16 rounded-full bg-primary/30 flex items-center justify-center border border-primary/50 cursor-pointer">
                                        <span className="text-white font-bold text-xs">22%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="lg:col-span-4">
                            <div className="bg-surface-dark rounded-xl border border-white/5 h-full flex flex-col">
                                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                                    <h3 className="text-white font-bold text-lg">Rendiment del Jugador</h3>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-background-dark sticky top-0 z-10">
                                            <tr>
                                                <th className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">Jugador</th>
                                                <th className="py-3 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">PScore</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            <tr className="group hover:bg-white/5 transition-colors cursor-pointer">
                                                <td className="py-3 px-4"><span className="text-white font-medium text-sm">Dika Mem</span></td>
                                                <td className="py-3 px-4 text-right"><span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold bg-primary text-white">8.4</span></td>
                                            </tr>
                                            <tr className="group hover:bg-white/5 transition-colors cursor-pointer">
                                                <td className="py-3 px-4"><span className="text-white font-medium text-sm">Aleix Gómez</span></td>
                                                <td className="py-3 px-4 text-right"><span className="inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-bold bg-primary/80 text-white">7.9</span></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const AdminPage = ({ onOpenLeagueManager }) => {
    return (
        <div className="flex min-h-screen w-full bg-background-dark font-display text-white">
            <MainSidebar onOpenLeagueManager={onOpenLeagueManager} />
            <div className="flex-1 flex flex-col p-8">
                <div className="flex flex-col gap-2 mb-8">
                    <h1 className="text-white text-3xl md:text-4xl font-bold tracking-tight">Gestió d'Usuaris i Rols</h1>
                    <p className="text-text-secondary text-base font-light">Administra l'accés multi-inquilí, assigna rols d'equip o selecció.</p>
                </div>
                <div className="overflow-hidden rounded-xl border border-border-dark bg-surface-dark shadow-sm">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-background-dark/50 border-b border-border-dark text-text-secondary font-medium uppercase tracking-wider text-xs">
                            <tr>
                                <th className="px-6 py-4">Usuari</th>
                                <th className="px-6 py-4">Rol Assignat</th>
                                <th className="px-6 py-4">Organització</th>
                                <th className="px-6 py-4">Estat</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            <tr className="group hover:bg-background-dark/50 transition-colors">
                                <td className="px-6 py-4 text-white font-medium">Jordi Ribera</td>
                                <td className="px-6 py-4"><span className="text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full text-xs">Seleccionador</span></td>
                                <td className="px-6 py-4 text-text-secondary">RFEBM</td>
                                <td className="px-6 py-4"><span className="text-green-400 bg-green-500/10 px-2 py-1 rounded text-xs">Actiu</span></td>
                            </tr>
                            <tr className="group hover:bg-background-dark/50 transition-colors">
                                <td className="px-6 py-4 text-white font-medium">Ana García</td>
                                <td className="px-6 py-4"><span className="text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full text-xs">Analista</span></td>
                                <td className="px-6 py-4 text-text-secondary">FC Barcelona</td>
                                <td className="px-6 py-4"><span className="text-green-400 bg-green-500/10 px-2 py-1 rounded text-xs">Actiu</span></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

const IntegrationsPage = ({ onOpenLeagueManager }) => {
    return (
        <div className="flex min-h-screen w-full bg-background-dark font-display text-white">
            <MainSidebar onOpenLeagueManager={onOpenLeagueManager} />
            <div className="flex-1 flex flex-col p-8">
                <h1 className="text-3xl font-black leading-tight tracking-[-0.033em] text-white mb-6">Centre d'Integració</h1>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <div className="flex flex-col justify-between gap-4 rounded-xl bg-surface-dark border border-surface-dark-light p-5 shadow-sm hover:border-primary/50 transition-colors group">
                        <div className="flex justify-between items-start">
                            <div className="size-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                                <span className="material-symbols-outlined text-[28px]">smart_toy</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
                                <span className="text-xs font-medium text-green-500">En viu</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <h3 className="text-lg font-bold text-white">AutoData AI</h3>
                            <p className="text-sm text-text-secondary">Seguiment Òptic i Detecció d'Events</p>
                        </div>
                    </div>
                    <div className="flex flex-col justify-between gap-4 rounded-xl bg-surface-dark border border-surface-dark-light p-5 shadow-sm hover:border-primary/50 transition-colors group">
                        <div className="flex justify-between items-start">
                            <div className="size-12 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/20">
                                <span className="material-symbols-outlined text-[28px]">sports_handball</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="flex h-2 w-2 rounded-full bg-green-500"></span>
                                <span className="text-xs font-medium text-green-500">Connectat</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <h3 className="text-lg font-bold text-white">API-Sports</h3>
                            <p className="text-sm text-text-secondary">Estadístiques Globals i Resultats</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const ScoutingPage = ({ teams, events, onUpdateEvents, onOpenLeagueManager }) => {
    const [selectedTeam, setSelectedTeam] = useState('myTeam');
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [matchTime, setMatchTime] = useState(0);

    const eventTypes = [
        { id: 'GOAL', label: 'GOL', icon: 'sports_handball', color: 'bg-green-500' },
        { id: 'MISS', label: 'FALLO', icon: 'close', color: 'bg-orange-500' },
        { id: 'SAVE', label: 'PARADA', icon: 'block', color: 'bg-blue-500' },
        { id: 'TURNOVER', label: 'PÉRDIDA', icon: 'warning', color: 'bg-red-500' },
        { id: 'STEAL', label: 'RECUPERACIÓ', icon: 'verified', color: 'bg-purple-500' },
        { id: 'PENALTY', label: '2 MIN', icon: 'schedule', color: 'bg-yellow-500' },
    ];

    const currentPlayers = teams[selectedTeam] || [];

    const logEvent = (type) => {
        const newEvent = {
            id: Date.now(),
            timestamp: matchTime,
            team: selectedTeam,
            playerId: selectedPlayer?.id || 'TEAM',
            playerNumber: selectedPlayer?.number || null,
            playerName: selectedPlayer?.name || 'Equip',
            type: type.id,
            label: type.label,
            color: type.color
        };
        onUpdateEvents([newEvent, ...events]);
        setSelectedPlayer(null); // Reset after action
    };

    const deleteEvent = (eventId) => {
        onUpdateEvents(events.filter(e => e.id !== eventId));
    };

    return (
        <div className="flex h-screen w-full bg-background-dark font-display text-white overflow-hidden">
            <MainSidebar onOpenLeagueManager={onOpenLeagueManager} />
            <div className="flex-1 flex flex-col min-w-0">
                <header className="flex items-center justify-between border-b border-border-dark px-6 py-4 bg-surface-dark shrink-0">
                    <div className="flex items-center gap-4">
                        <span className="material-symbols-outlined text-primary">sensors</span>
                        <h2 className="text-xl font-bold tracking-tight">SCRAPPING EN VIU</h2>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="bg-background-dark px-6 py-2 rounded-xl border border-border-dark font-mono text-2xl text-primary font-black shadow-inner shadow-black/50">
                            00:00
                        </div>
                        <button className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-bold transition-all flex items-center gap-2">
                            <span className="material-symbols-outlined">play_arrow</span>
                            INICIAR CRONO
                        </button>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    {/* Console Area */}
                    <main className="flex-1 overflow-y-auto p-6 space-y-8 bg-background-dark/50">
                        {/* Team & Player Selection */}
                        <div className="space-y-4">
                            <div className="flex gap-4 p-1 bg-surface-dark rounded-2xl w-fit border border-white/5">
                                <button
                                    onClick={() => { setSelectedTeam('myTeam'); setSelectedPlayer(null); }}
                                    className={`px-8 py-3 rounded-xl font-black transition-all ${selectedTeam === 'myTeam' ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-105' : 'text-text-secondary hover:text-white'}`}
                                >
                                    EL MEU EQUIP
                                </button>
                                <button
                                    onClick={() => { setSelectedTeam('rivalTeam'); setSelectedPlayer(null); }}
                                    className={`px-8 py-3 rounded-xl font-black transition-all ${selectedTeam === 'rivalTeam' ? 'bg-red-500 text-white shadow-xl shadow-red-500/20 scale-105' : 'text-text-secondary hover:text-white'}`}
                                >
                                    EQUIP RIVAL
                                </button>
                            </div>

                            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                {currentPlayers.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelectedPlayer(p)}
                                        className={`aspect-square rounded-2xl flex flex-col items-center justify-center transition-all border-2 ${selectedPlayer?.id === p.id
                                            ? (selectedTeam === 'myTeam' ? 'bg-primary border-primary ring-4 ring-primary/20' : 'bg-red-500 border-red-500 ring-4 ring-red-500/20')
                                            : 'bg-surface-dark border-white/5 hover:border-white/20'}`}
                                    >
                                        <span className="text-2xl font-black">{p.number}</span>
                                        <span className="text-[9px] font-bold uppercase truncate w-full px-1">{p.name.split(' ')[0]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Action Grid */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-text-secondary uppercase tracking-[0.2em] flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">bolt</span>
                                Accions Disponibles
                                {selectedPlayer && <span className="text-white normal-case tracking-normal bg-white/10 px-2 py-0.5 rounded ml-2">Acció per: #{selectedPlayer.number} {selectedPlayer.name}</span>}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {eventTypes.map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => logEvent(type)}
                                        className={`${type.color} hover:brightness-110 p-6 rounded-2xl flex flex-col items-center justify-center gap-3 transition-all active:scale-95 shadow-lg group`}
                                    >
                                        <span className="material-symbols-outlined text-4xl group-hover:scale-110 transition-transform">
                                            {type.icon}
                                        </span>
                                        <span className="font-black text-lg">{type.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Extra Actions */}
                        <div className="flex gap-4">
                            <button
                                onClick={() => logEvent({ id: 'TIMEOUT', label: 'T. MORT', color: 'bg-slate-700' })}
                                className="flex-1 bg-surface-dark-light hover:bg-surface-dark border border-white/5 p-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all"
                            >
                                <span className="material-symbols-outlined">timer</span>
                                TEMPS MORT
                            </button>
                            <button
                                onClick={() => { setSelectedPlayer(null); logEvent({ id: 'TECH_ERROR', label: 'E. TÈCNIC', color: 'bg-orange-900' }) }}
                                className="flex-1 bg-surface-dark-light hover:bg-surface-dark border border-white/5 p-4 rounded-xl flex items-center justify-center gap-2 font-bold transition-all"
                            >
                                <span className="material-symbols-outlined">warning</span>
                                ERROR TÈCNIC COL·LECTIU
                            </button>
                        </div>
                    </main>

                    {/* Timeline Feed */}
                    <aside className="w-80 border-l border-border-dark bg-surface-dark flex flex-col shrink-0">
                        <div className="p-5 border-b border-border-dark flex justify-between items-center bg-background-dark/30">
                            <h3 className="text-sm font-black uppercase tracking-widest text-text-secondary">Cronologia</h3>
                            <span className="text-[10px] bg-white/5 px-2 py-1 rounded text-text-secondary font-bold">{events.length} EVENTS</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {events.map(ev => (
                                <div key={ev.id} className="group flex flex-col gap-2 p-3 bg-background-dark/40 rounded-xl border border-white/5 hover:border-white/10 transition-all animate-in slide-in-from-right-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${ev.color}`}></span>
                                            <span className="text-[10px] font-black font-mono text-text-secondary">00:00</span>
                                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${ev.team === 'myTeam' ? 'bg-primary/10 text-primary' : 'bg-red-500/10 text-red-500'}`}>
                                                {ev.team === 'myTeam' ? 'LOC' : 'VIS'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => deleteEvent(ev.id)}
                                            className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-red-400 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-sm">delete</span>
                                        </button>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-xs font-black tracking-tight">{ev.label}</span>
                                        <span className="text-[10px] text-text-secondary truncate">
                                            {ev.playerNumber ? `#${ev.playerNumber} ` : ''}{ev.playerName}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            {events.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                                    <span className="material-symbols-outlined text-4xl mb-2">history</span>
                                    <p className="text-xs font-bold uppercase tracking-widest">Sense registre</p>
                                </div>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
};

const TeamsPage = ({ teams, onOpenLeagueManager }) => {
    const myTeam = teams?.myTeam || [];
    const rivalTeam = teams?.rivalTeam || [];

    return (
        <div className="flex min-h-screen w-full bg-background-dark font-display text-white">
            <MainSidebar onOpenLeagueManager={onOpenLeagueManager} />
            <div className="flex-1 flex flex-col p-8 overflow-y-auto">
                <h1 className="text-3xl md:text-4xl font-black font-display leading-tight tracking-[-0.033em] mb-6 uppercase">Cara a Cara</h1>

                <div className="w-full bg-surface-dark rounded-xl p-8 shadow-sm border border-[#233648] mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                        <div className="flex flex-col items-center md:items-start gap-4">
                            <div className="flex items-center gap-4">
                                <div className="bg-primary/20 p-2 rounded-full size-20 flex items-center justify-center text-primary font-bold text-xl ring-2 ring-primary/30">
                                    <span className="material-symbols-outlined text-4xl">sports_handball</span>
                                </div>
                                <div className="flex flex-col">
                                    <h2 className="text-xl font-bold">El Meu Equip</h2>
                                    <p className="text-text-secondary text-sm">{myTeam.length} Jugadors</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-center justify-center">
                            <div className="size-12 rounded-full bg-surface-dark-light border border-border-dark flex items-center justify-center text-white font-black italic">VS</div>
                        </div>
                        <div className="flex flex-col items-center md:items-end gap-4">
                            <div className="flex items-center flex-row-reverse gap-4 text-right">
                                <div className="bg-red-500/20 p-2 rounded-full size-20 flex items-center justify-center text-red-400 font-bold text-xl ring-2 ring-red-500/30">
                                    <span className="material-symbols-outlined text-4xl">groups</span>
                                </div>
                                <div className="flex flex-col">
                                    <h2 className="text-xl font-bold">Equip Rival</h2>
                                    <p className="text-text-secondary text-sm">{rivalTeam.length} Jugadors</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
                        <div className="p-4 bg-background-dark/50 border-b border-border-dark flex justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Plantilla Local</h3>
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{myTeam.length}</span>
                        </div>
                        <div className="p-4 grid grid-cols-1 gap-2">
                            {myTeam.slice(0, 10).map(p => (
                                <div key={p.id} className="flex justify-between items-center p-2 rounded bg-white/5 border border-white/5">
                                    <span className="text-xs font-bold text-primary w-6">{p.number}</span>
                                    <span className="flex-1 text-sm font-medium">{p.name}</span>
                                </div>
                            ))}
                            {myTeam.length === 0 && <p className="text-xs text-text-secondary text-center py-10">Sense dades</p>}
                        </div>
                    </div>
                    <div className="bg-surface-dark rounded-xl border border-border-dark overflow-hidden">
                        <div className="p-4 bg-background-dark/50 border-b border-border-dark flex justify-between">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-red-400">Plantilla Rival</h3>
                            <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">{rivalTeam.length}</span>
                        </div>
                        <div className="p-4 grid grid-cols-1 gap-2">
                            {rivalTeam.slice(0, 10).map(p => (
                                <div key={p.id} className="flex justify-between items-center p-2 rounded bg-white/5 border border-white/5">
                                    <span className="text-xs font-bold text-red-400 w-6">{p.number}</span>
                                    <span className="flex-1 text-sm font-medium">{p.name}</span>
                                </div>
                            ))}
                            {rivalTeam.length === 0 && <p className="text-xs text-text-secondary text-center py-10">Sense dades</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const App = () => {
    // Generate or retrieve a persistent session ID for this device
    const [sessionId] = useLocalStorage('chi_analytics_session_id', 'user_' + Math.random().toString(36).substr(2, 9));

    // Legacy system (still active for backward compatibility)
    const [teams, setTeams, loadingTeams] = useFirestore('teams', sessionId, { myTeam: [], rivalTeam: [] });
    const [events, setEvents, loadingEvents] = useFirestore('events', sessionId, []);
    const [showManager, setShowManager] = useState(false);

    // New league system
    const [showLeagueManager, setShowLeagueManager] = useState(false);
    const leagueId = sessionId; // Use same ID for now

    if (loadingTeams || loadingEvents) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background-dark text-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-primary font-bold animate-pulse">SINCRONITZANT AMB EL NÚVOL...</p>
                </div>
            </div>
        );
    }

    return (
        <MemoryRouter>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/dashboard" element={<DashboardPage players={teams.myTeam} onOpenLeagueManager={() => setShowLeagueManager(true)} />} />
                <Route path="/player" element={<PlayerProfilePage players={teams.myTeam} onUpdatePlayers={(updated) => setTeams({ ...teams, myTeam: updated })} onShowManager={() => setShowManager(true)} onOpenLeagueManager={() => setShowLeagueManager(true)} />} />
                <Route path="/match-analysis" element={<MatchAnalysisPage onOpenLeagueManager={() => setShowLeagueManager(true)} />} />
                <Route path="/teams" element={<TeamsPage teams={teams} onOpenLeagueManager={() => setShowLeagueManager(true)} />} />
                <Route path="/integrations" element={<IntegrationsPage onOpenLeagueManager={() => setShowLeagueManager(true)} />} />
                <Route path="/scouting" element={<ScoutingPage teams={teams} events={events} onUpdateEvents={setEvents} onOpenLeagueManager={() => setShowLeagueManager(true)} />} />
                <Route path="/admin" element={<AdminPage onOpenLeagueManager={() => setShowLeagueManager(true)} />} />
            </Routes>
            {showManager && (
                <TeamManager
                    teams={teams}
                    onUpdateTeams={setTeams}
                    onClose={() => setShowManager(false)}
                />
            )}
            {showLeagueManager && (
                <LeagueManager
                    leagueId={leagueId}
                    onClose={() => setShowLeagueManager(false)}
                />
            )}
        </MemoryRouter>
    );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
