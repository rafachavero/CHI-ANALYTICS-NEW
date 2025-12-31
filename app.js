const { useState, useEffect, useContext } = React;
const { createRoot } = ReactDOM;
const { HashRouter, Routes, Route, Link, useNavigate, useLocation, Navigate } = ReactRouterDOM;

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyBUBTIdO30dXl0no_FqLLhYWiME7khzvz8",
    authDomain: "chi-analytics-new.firebaseapp.com",
    projectId: "chi-analytics-new",
    storageBucket: "chi-analytics-new.firebasestorage.app",
    messagingSenderId: "335712522840",
    appId: "1:335712522840:web:da0397ef4fba4e996c302d",
    measurementId: "G-1W60H2L7PD"
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

// --- Authentication Context ---

const AuthContext = React.createContext();

const useAuth = () => useContext(AuthContext);

const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState(null); // 'admin' or 'user'

    useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged(async (user) => {
            setCurrentUser(user);

            if (user) {
                // Get user role from Firestore
                try {
                    // Safety check: ensure db is available before trying to use it
                    if (db) {
                        const userDoc = await db.collection('users').doc(user.uid).get();
                        if (userDoc.exists) {
                            setUserRole(userDoc.data().role);
                        } else {
                            setUserRole('user');
                        }
                    } else {
                        console.warn("Firestore not initialized, defaulting to user role");
                        setUserRole('user');
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                    // Critical fix: don't crash, just default to 'user'role so app can load
                    setUserRole('user');
                }
            } else {
                setUserRole(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const signup = (email, password) => {
        return firebase.auth().createUserWithEmailAndPassword(email, password);
    };

    const login = (email, password) => {
        return firebase.auth().signInWithEmailAndPassword(email, password);
    };

    const logout = () => {
        return firebase.auth().signOut();
    };

    const value = {
        currentUser,
        userRole,
        signup,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div className="flex items-center justify-center min-h-screen bg-background-dark text-white">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-xs text-text-secondary uppercase tracking-widest">Iniciant Sessió...</p>
                    </div>
                </div>
            ) : children}
        </AuthContext.Provider>
    );
};

// --- Auth Components ---

const LoginPage = () => {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setError('');
            setLoading(true);
            await login(email, password);
            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            setError('Error al iniciar sessió. Verifica les teves credencials.');
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface-dark p-8 rounded-2xl border border-border-dark shadow-2xl">
                <div className="text-center mb-8">
                    <span className="material-symbols-outlined text-primary text-5xl mb-4">sports_handball</span>
                    <h2 className="text-2xl font-bold text-white">Benvingut a CHI Analytics</h2>
                    <p className="text-text-secondary mt-2">Inicia sessió per continuar</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-6 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary/50"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Contrasenya</label>
                        <input
                            type="password"
                            required
                            className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary/50"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all mt-4"
                    >
                        {loading ? 'Carregant...' : 'INICIAR SESSIÓ'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-text-secondary">
                    No tens compte?{' '}
                    <Link to="/signup" className="text-primary hover:text-white font-bold transition-colors">
                        Registra't aquí
                    </Link>
                </div>
            </div>
        </div>
    );
};

const SignupPage = () => {
    const { signup } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            return setError('Les contrasenyes no coincideixen');
        }

        if (password.length < 6) {
            return setError('La contrasenya ha de tenir almenys 6 caràcters');
        }

        try {
            setError('');
            setLoading(true);
            const userCredential = await signup(email, password);

            // Create user profile in Firestore
            await db.collection('users').doc(userCredential.user.uid).set({
                email: email,
                role: 'user', // Default role
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            setError('Error al crear el compte: ' + err.message);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-background-dark flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface-dark p-8 rounded-2xl border border-border-dark shadow-2xl">
                <div className="text-center mb-8">
                    <span className="material-symbols-outlined text-primary text-5xl mb-4">person_add</span>
                    <h2 className="text-2xl font-bold text-white">Crear Compte</h2>
                    <p className="text-text-secondary mt-2">Uneix-te a CHI Analytics</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-sm mb-6 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Email</label>
                        <input
                            type="email"
                            required
                            className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary/50"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Contrasenya</label>
                        <input
                            type="password"
                            required
                            className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary/50"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Confirmar Contrasenya</label>
                        <input
                            type="password"
                            required
                            className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary/50"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all mt-4"
                    >
                        {loading ? 'Creant compte...' : 'REGISTRAR-SE'}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-text-secondary">
                    Ja tens compte?{' '}
                    <Link to="/login" className="text-primary hover:text-white font-bold transition-colors">
                        Inicia sessió
                    </Link>
                </div>
            </div>
        </div>
    );
};

const ProtectedRoute = ({ children }) => {
    const { currentUser } = useAuth();
    if (!currentUser) {
        return <Navigate to="/login" />;
    }
    return children;
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

const MainSidebar = ({ onOpenLeagueManager }) => {
    const { currentUser, userRole, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async (e) => {
        e.preventDefault();
        try {
            await logout();
            navigate('/login');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    return (
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
                {currentUser && userRole === 'admin' && (
                    <NavButton to="/admin" label="Admin Panel" icon="admin_panel_settings" />
                )}

                {currentUser && (
                    <div className="hidden lg:block px-3 py-2 mb-2 text-xs text-text-secondary truncate border-t border-white/5 mt-2 pt-4">
                        <div className="font-bold text-white">Usuari Connectat</div>
                        <div className="truncate" title={currentUser.email}>{currentUser.email}</div>
                    </div>
                )}

                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-3 mt-2 rounded-lg text-text-secondary hover:bg-surface-dark-light hover:text-white transition-colors text-left"
                >
                    <span className="material-symbols-outlined">logout</span>
                    <span className="hidden lg:block text-sm font-medium">Sortir</span>
                </button>
            </div>
        </aside>
    );
};

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

            // Extract phase/group information from page title
            const pageTitle = doc.querySelector('h4, .competition-title, h3');
            let phaseName = 'General';
            let groupName = null;

            if (pageTitle) {
                const titleText = pageTitle.innerText.trim();
                // Example: "LLIGA CATALANA OR SÈNIOR MASCULINA - PRIMERA FASE - B"
                const phaseMatch = titleText.match(/PRIMERA FASE|SEGUNDA FASE|FASE \d+/i);
                const groupMatch = titleText.match(/- ([AB])\s*$/i);

                if (phaseMatch) {
                    phaseName = phaseMatch[0];
                }
                if (groupMatch) {
                    groupName = `Grup ${groupMatch[1].toUpperCase()}`;
                }
            }

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
                            isMyTeam: false,
                            phase: phaseName,
                            group: groupName
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
                                        <div className="flex-1">
                                            <h3 className="font-bold text-white mb-1">{team.name}</h3>
                                            {(team.phase || team.group) && (
                                                <div className="flex gap-1 flex-wrap">
                                                    {team.phase && (
                                                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 text-xs font-bold rounded border border-purple-500/20">
                                                            {team.phase}
                                                        </span>
                                                    )}
                                                    {team.group && (
                                                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-xs font-bold rounded border border-blue-500/20">
                                                            {team.group}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
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

const DashboardPage = ({ players, events = [], onOpenLeagueManager }) => {
    // Calculate simple stats from events
    const goals = events.filter(e => e.type === 'GOAL' && e.team === 'myTeam').length;
    const matchesPlayed = new Set(events.map(e => new Date(e.id).toDateString())).size || 0; // Rough estimate or 0
    // Mock AI stat for now as we don't have it
    const aiPrecision = events.length > 0 ? "89%" : "-";

    return (
        <div className="flex min-h-screen w-full">
            <MainSidebar onOpenLeagueManager={onOpenLeagueManager} />
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-20 border-b border-border-dark bg-background-dark/80 backdrop-blur-md sticky top-0 z-10 px-6 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <h2 className="hidden md:block text-xl text-white font-bold tracking-tight">Panell de Lliga</h2>
                        <div className="relative group">
                            <div className="flex items-center gap-2 bg-[#233648] px-4 py-2 rounded-lg cursor-pointer border border-transparent hover:border-slate-600 transition-colors">
                                <span className="text-sm font-medium text-white">Temporada Actual</span>
                            </div>
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
                                    <p className="text-slate-400 text-sm font-medium">Gols Totals</p>
                                    <div className="flex items-end gap-3">
                                        <h3 className="text-3xl font-bold text-white">{goals}</h3>
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-slate-800 mt-4 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary w-full rounded-full" style={{ width: `${Math.min(goals, 100)}%` }}></div>
                                </div>
                            </div>
                            {/* Stat Card 2 */}
                            <div className="p-5 rounded-xl bg-card-dark border border-slate-800 shadow-sm relative overflow-hidden group">
                                <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <span className="material-symbols-outlined text-6xl text-white">scoreboard</span>
                                </div>
                                <div className="flex flex-col gap-1 relative z-10">
                                    <p className="text-slate-400 text-sm font-medium">Events Registrats</p>
                                    <div className="flex items-end gap-3">
                                        <h3 className="text-3xl font-bold text-white">{events.length}</h3>
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-slate-800 mt-4 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 w-full rounded-full" style={{ width: `${Math.min(events.length, 100)}%` }}></div>
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
                                        <h3 className="text-3xl font-bold text-white">{aiPrecision}</h3>
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
                                        <h3 className="text-3xl font-bold text-white">{players?.length || 0}</h3>
                                    </div>
                                </div>
                                <div className="h-1 w-full bg-slate-800 mt-4 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-400 w-full rounded-full"></div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="bg-card-dark rounded-xl border border-slate-800 shadow-sm flex flex-col p-8 text-center items-center justify-center min-h-[300px]">
                                <span className="material-symbols-outlined text-6xl text-slate-700 mb-4">leaderboard</span>
                                <h3 className="text-xl font-bold text-white mb-2">Classificació de la Lliga</h3>
                                <p className="text-slate-500 max-w-sm">
                                    Encara no hi ha dades suficients per generar la classificació. Comença a registrar partits!
                                </p>
                            </div>
                            <div className="bg-card-dark rounded-xl border border-slate-800 shadow-sm flex flex-col p-8 text-center items-center justify-center min-h-[300px]">
                                <span className="material-symbols-outlined text-6xl text-slate-700 mb-4">stars</span>
                                <h3 className="text-xl font-bold text-white mb-2">Líders PScore</h3>
                                <p className="text-slate-500 max-w-sm">
                                    Els millors jugadors apareixeran aquí mesura que avancis en la temporada.
                                </p>
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
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[80vh]">
                <div className="bg-surface-dark p-8 rounded-2xl border border-white/5 max-w-lg mb-8">
                    <span className="material-symbols-outlined text-6xl text-primary mb-4 opacity-50">analytics</span>
                    <h1 className="text-3xl font-black mb-4">Anàlisi de Partit</h1>
                    <p className="text-text-secondary mb-6">
                        Selecciona un partit des del Panell o comença un nou scouting per veure les estadístiques detallades aquí.
                    </p>
                    <button
                        onClick={() => window.location.hash = '#/scouting'}
                        className="bg-primary hover:bg-primary/90 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-primary/20"
                    >
                        COMENÇAR SCOUTING
                    </button>
                </div>
            </div>
        </div>
    )
}

const AdminPage = ({ onOpenLeagueManager }) => {
    const { currentUser, userRole } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    // Create User Form State
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserRole, setNewUserRole] = useState('user');
    const [createLoading, setCreateLoading] = useState(false);

    useEffect(() => {
        const fetchUsers = async () => {
            if (userRole !== 'admin') {
                setLoading(false);
                return;
            }
            try {
                const snapshot = await db.collection('users').orderBy('createdAt', 'desc').get();
                setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            } catch (error) {
                console.error("Error fetching users:", error);
            }
            setLoading(false);
        };

        fetchUsers();
    }, [userRole]);

    const toggleRole = async (userId, currentRole) => {
        if (userId === currentUser.uid) {
            alert("No pots canviar el teu propi rol.");
            return;
        }
        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        try {
            await db.collection('users').doc(userId).update({ role: newRole });
            setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
        } catch (error) {
            console.error("Error updating role:", error);
            alert("Error al actualitzar el rol.");
        }
    };

    const deleteUser = async (userId) => {
        if (userId === currentUser.uid) {
            alert("No pots eliminar el teu propi usuari.");
            return;
        }
        if (!window.confirm("Estàs segur de que vols eliminar aquest usuari? Aquesta acció no es pot desfer.")) {
            return;
        }
        try {
            await db.collection('users').doc(userId).delete();
            setUsers(users.filter(u => u.id !== userId));
        } catch (error) {
            console.error("Error deleting user:", error);
            alert("Error al eliminar l'usuari de la base de dades.");
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setCreateLoading(true);

        // Secondary App Workaround to avoid logging out the admin
        let secondaryApp = null;
        try {
            const secondaryAppName = "secondaryApp-" + Date.now();
            secondaryApp = firebase.initializeApp(firebaseConfig, secondaryAppName);

            // Create user in Auth
            const userCredential = await secondaryApp.auth().createUserWithEmailAndPassword(newUserEmail, newUserPassword);

            // Create user in Firestore (using main app's db connection)
            const newUser = {
                email: newUserEmail,
                role: newUserRole,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('users').doc(userCredential.user.uid).set(newUser);

            // Update local state
            setUsers([{ id: userCredential.user.uid, ...newUser }, ...users]);

            // Cleanup
            setShowCreateModal(false);
            setNewUserEmail('');
            setNewUserPassword('');
            setNewUserRole('user');
            alert("Usuari creat correctament!");

        } catch (error) {
            console.error("Error creating user:", error);
            alert("Error al crear usuari: " + error.message);
        } finally {
            if (secondaryApp) secondaryApp.delete();
            setCreateLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen w-full bg-background-dark font-display text-white items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-text-secondary">Verificant permisos...</p>
                </div>
            </div>
        );
    }

    if (userRole !== 'admin') {
        return (
            <div className="flex min-h-screen w-full bg-background-dark font-display text-white">
                <MainSidebar onOpenLeagueManager={onOpenLeagueManager} />
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="bg-red-500/10 p-6 rounded-full border border-red-500/20 mb-6">
                        <span className="material-symbols-outlined text-red-500 text-6xl">lock</span>
                    </div>
                    <h1 className="text-3xl font-bold mb-2">Accés Restringit</h1>
                    <p className="text-text-secondary max-w-md">
                        Aquesta àrea està reservada per a administradors. Contacta amb el suport tècnic si creus que això és un error.
                    </p>
                    <p className="mt-4 text-xs text-text-secondary font-mono bg-black/30 px-3 py-1 rounded">
                        ID: {currentUser?.uid}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full bg-background-dark font-display text-white">
            <MainSidebar onOpenLeagueManager={onOpenLeagueManager} />
            <div className="flex-1 flex flex-col p-8 overflow-y-auto">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-white text-3xl md:text-4xl font-bold tracking-tight">Gestió d'Usuaris</h1>
                        <p className="text-text-secondary text-base font-light">
                            Administra els usuaris registrats i els seus permisos d'accés.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-lg shadow-primary/20"
                    >
                        <span className="material-symbols-outlined">person_add</span>
                        Nou Usuari
                    </button>
                </div>

                <div className="overflow-hidden rounded-xl border border-border-dark bg-surface-dark shadow-sm">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-background-dark/50 border-b border-border-dark text-text-secondary font-medium uppercase tracking-wider text-xs">
                            <tr>
                                <th className="px-6 py-4">Usuari</th>
                                <th className="px-6 py-4">Data Registre</th>
                                <th className="px-6 py-4">Rol</th>
                                <th className="px-6 py-4 text-right">Accions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {users.map(user => (
                                <tr key={user.id} className="group hover:bg-background-dark/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-white font-medium">{user.email}</span>
                                            <span className="text-xs text-text-secondary font-mono">{user.id}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-text-secondary">
                                        {user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString() : 'Desconegut'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.role === 'admin'
                                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                            }`}>
                                            {user.role === 'admin' ? 'ADMINISTRADOR' : 'USUARI'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex gap-2 justify-end">
                                            <button
                                                onClick={() => toggleRole(user.id, user.role)}
                                                className="p-2 hover:bg-white/10 rounded-lg text-text-secondary hover:text-white transition-colors"
                                                title="Canviar Rol"
                                                disabled={user.id === currentUser.uid}
                                            >
                                                <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
                                            </button>
                                            <button
                                                onClick={() => deleteUser(user.id)}
                                                className="p-2 hover:bg-red-500/10 rounded-lg text-text-secondary hover:text-red-400 transition-colors"
                                                title="Eliminar Usuari"
                                                disabled={user.id === currentUser.uid}
                                            >
                                                <span className="material-symbols-outlined text-[20px]">delete</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-text-secondary">
                                        No s'han trobat usuaris
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-12 pt-8 border-t border-red-500/20">
                    <h2 className="text-red-400 text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="material-symbols-outlined">warning</span>
                        Zona de Perill
                    </h2>
                    <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-6 flex flex-col md:flex-row justify-between items-center gap-6">
                        <div>
                            <h3 className="text-white font-bold mb-1">Esborrar Totes les Dades</h3>
                            <p className="text-text-secondary text-sm">
                                Aquesta acció eliminarà tots els equips, jugadors i events registrats en aquesta sessió.
                                <br />
                                <span className="font-mono text-xs opacity-70">Session ID: {localStorage.getItem('chi_analytics_session_id')}</span>
                            </p>
                        </div>
                        <button
                            onClick={async () => {
                                if (confirm("ESTÀS SEGUR? Això esborrarà TOTES les dades de l'equip i events actuals. No es pot desfer.")) {
                                    try {
                                        const sessionId = localStorage.getItem('chi_analytics_session_id');
                                        if (sessionId) {
                                            await db.collection('teams').doc(sessionId).delete();
                                            await db.collection('events').doc(sessionId).delete();
                                            // Optional: reload to refresh app state
                                            window.location.reload();
                                        }
                                    } catch (e) {
                                        alert("Error: " + e.message);
                                    }
                                }
                            }}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-red-500/20 whitespace-nowrap"
                        >
                            RESET DATABASE
                        </button>
                    </div>
                </div>



                {/* Create User Modal */}
                {
                    showCreateModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                            <div className="bg-surface-dark border border-border-dark w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
                                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-background-dark/50">
                                    <h2 className="text-xl font-bold text-white">Nou Usuari</h2>
                                    <button onClick={() => setShowCreateModal(false)} className="text-text-secondary hover:text-white">
                                        <span className="material-symbols-outlined">close</span>
                                    </button>
                                </div>
                                <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Email</label>
                                        <input
                                            type="email"
                                            required
                                            className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary/50"
                                            value={newUserEmail}
                                            onChange={(e) => setNewUserEmail(e.target.value)}
                                            placeholder="usuari@exemple.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Contrasenya</label>
                                        <input
                                            type="password"
                                            required
                                            className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary/50"
                                            value={newUserPassword}
                                            onChange={(e) => setNewUserPassword(e.target.value)}
                                            placeholder="Mínim 6 caràcters"
                                            minLength={6}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-text-secondary uppercase tracking-widest mb-2">Rol Inicial</label>
                                        <select
                                            className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary/50"
                                            value={newUserRole}
                                            onChange={(e) => setNewUserRole(e.target.value)}
                                        >
                                            <option value="user">Usuari (Estàndard)</option>
                                            <option value="admin">Administrador (Total)</option>
                                        </select>
                                    </div>

                                    <div className="pt-4 flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowCreateModal(false)}
                                            className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-xl transition-all"
                                        >
                                            Cancel·lar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={createLoading}
                                            className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            {createLoading && <span className="material-symbols-outlined animate-spin text-sm">sync</span>}
                                            Crear Usuari
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )
                }
            </div>
        </div>
    );
};

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
        <HashRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/dashboard" element={<ProtectedRoute><DashboardPage players={teams.myTeam} events={events} onOpenLeagueManager={() => setShowLeagueManager(true)} /></ProtectedRoute>} />
                    <Route path="/player" element={<ProtectedRoute><PlayerProfilePage players={teams.myTeam} onUpdatePlayers={(updated) => setTeams({ ...teams, myTeam: updated })} onShowManager={() => setShowManager(true)} onOpenLeagueManager={() => setShowLeagueManager(true)} /></ProtectedRoute>} />
                    <Route path="/match-analysis" element={<ProtectedRoute><MatchAnalysisPage onOpenLeagueManager={() => setShowLeagueManager(true)} /></ProtectedRoute>} />
                    <Route path="/teams" element={<ProtectedRoute><TeamsPage teams={teams} onOpenLeagueManager={() => setShowLeagueManager(true)} /></ProtectedRoute>} />
                    <Route path="/integrations" element={<ProtectedRoute><IntegrationsPage onOpenLeagueManager={() => setShowLeagueManager(true)} /></ProtectedRoute>} />
                    <Route path="/scouting" element={<ProtectedRoute><ScoutingPage teams={teams} events={events} onUpdateEvents={setEvents} onOpenLeagueManager={() => setShowLeagueManager(true)} /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute><AdminPage onOpenLeagueManager={() => setShowLeagueManager(true)} /></ProtectedRoute>} />
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
            </AuthProvider>
        </HashRouter>
    );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
