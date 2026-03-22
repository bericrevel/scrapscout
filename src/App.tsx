import { useState, useEffect } from 'react';
import { Map as MapIcon, Camera, Package, User, Calendar as CalendarIcon, CheckSquare, TrendingUp, Loader2, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MapScreen from './screens/MapScreen';
import ScanScreen from './screens/ScanScreen';
import InventoryScreen from './screens/InventoryScreen';
import ProfileScreen from './screens/ProfileScreen';
import CalendarScreen from './screens/CalendarScreen';
import TasksScreen from './screens/TasksScreen';
import MarketScreen from './screens/MarketScreen';
import ChatScreen from './screens/ChatScreen';
import PaywallScreen from './screens/PaywallScreen';
import LoginScreen from './screens/LoginScreen';
import { playSound, vibrate } from './utils/feedback';
import { ScannedItem, Task } from './types';
import { useFirebase } from './components/FirebaseProvider';
import { db, collection, query, where, onSnapshot, doc, setDoc, getDoc, updateDoc, deleteDoc, OperationType, handleFirestoreError } from './firebase';

type Tab = 'map' | 'scan' | 'inventory' | 'tasks' | 'calendar' | 'market' | 'chat' | 'profile';

export default function App() {
  const { user, loading, isAuthReady } = useFirebase();
  const [activeTab, setActiveTab] = useState<Tab>('map');
  const [inventory, setInventory] = useState<ScannedItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // Global Settings State
  const [legalMode, setLegalMode] = useState<'legal_only' | 'permission_hunter' | 'all'>('legal_only');
  const [searchRadius, setSearchRadius] = useState<number>(65);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<'inactive' | 'pro' | 'founder'>('inactive');

  // Sync User Settings
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const userDocRef = doc(db, 'users', user.uid);
    
    // Initial fetch or create
    getDoc(userDocRef).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLegalMode(data.legalMode || 'legal_only');
        setSearchRadius(data.searchRadius || 65);
        setNotificationsEnabled(data.notificationsEnabled ?? true);
        setSubscriptionStatus(data.subscriptionStatus || 'inactive');
      } else {
        // Create initial profile
        const initialData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: user.email === 'bericrevel@gmail.com' ? 'admin' : 'user',
          legalMode: 'legal_only',
          searchRadius: 65,
          notificationsEnabled: true,
          subscriptionStatus: 'inactive',
          createdAt: new Date().toISOString()
        };
        setDoc(userDocRef, initialData).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
      }
    }).catch(err => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));

    // Real-time sync for settings
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLegalMode(data.legalMode);
        setSearchRadius(data.searchRadius);
        setNotificationsEnabled(data.notificationsEnabled);
        setSubscriptionStatus(data.subscriptionStatus);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Sync Inventory
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const q = query(collection(db, 'inventory'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ScannedItem));
      setInventory(items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'inventory'));

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // Sync Tasks
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const q = query(collection(db, 'tasks'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
      setTasks(taskList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'tasks'));

    return () => unsubscribe();
  }, [user, isAuthReady]);

  // NOTE: Subscription status is updated server-side via Stripe webhook -> Firestore.
  // We only handle UI navigation here, never write subscriptionStatus client-side.
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    if (queryParams.get('success') || queryParams.get('canceled')) {
      setActiveTab('profile');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleAddItem = async (item: ScannedItem) => {
    if (!user) return;
    try {
      const newItem = { ...item, uid: user.uid };
      await setDoc(doc(db, 'inventory', item.id), newItem);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `inventory/${item.id}`);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'inventory', itemId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `inventory/${itemId}`);
    }
  };

  const handleAddTask = async (task: Task) => {
    if (!user) return;
    try {
      const newTask = { ...task, uid: user.uid };
      await setDoc(doc(db, 'tasks', task.id), newTask);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tasks/${task.id}`);
    }
  };

  const handleToggleTask = async (id: string) => {
    if (!user) return;
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    try {
      await updateDoc(doc(db, 'tasks', id), { completed: !task.completed });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tasks/${id}`);
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tasks/${id}`);
    }
  };

  const handleUpdateSettings = async (updates: Partial<{ legalMode: any, searchRadius: number, notificationsEnabled: boolean }>) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full bg-[#050505] flex items-center justify-center">
        <Loader2 className="text-emerald-500 animate-spin" size={48} />
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  const tabs = [
    { id: 'map', label: 'Map', icon: MapIcon },
    { id: 'calendar', label: 'Calendar', icon: CalendarIcon },
    { id: 'scan', label: 'Scan', icon: Camera },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'market', label: 'Market', icon: TrendingUp },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'profile', label: 'Profile', icon: User },
  ] as const;

  const handleTabChange = (tabId: Tab) => {
    if (activeTab !== tabId) {
      playSound('click');
      vibrate(50);
      setActiveTab(tabId);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#050505] text-zinc-50 font-sans overflow-hidden selection:bg-emerald-500/30">
      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden bg-[#050505]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 w-full h-full"
          >
            {activeTab === 'map' && <MapScreen legalMode={legalMode} setLegalMode={(mode) => handleUpdateSettings({ legalMode: mode })} subscriptionStatus={subscriptionStatus} searchRadius={searchRadius} />}
            {activeTab === 'calendar' && (subscriptionStatus === 'inactive' ? <PaywallScreen featureName="Temporal Log" onClose={() => setActiveTab('map')} /> : <CalendarScreen legalMode={legalMode} searchRadius={searchRadius} />)}
            {activeTab === 'scan' && <ScanScreen onSaveItem={handleAddItem} />}
            {activeTab === 'inventory' && <InventoryScreen items={inventory} subscriptionStatus={subscriptionStatus} onDeleteItem={handleDeleteItem} />}
            {activeTab === 'chat' && <ChatScreen />}
            {activeTab === 'tasks' && <TasksScreen tasks={tasks} onAddTask={handleAddTask} onToggleTask={handleToggleTask} onDeleteTask={handleDeleteTask} />}
            {activeTab === 'market' && (subscriptionStatus === 'inactive' ? <PaywallScreen featureName="Market Watch" onClose={() => setActiveTab('map')} /> : <MarketScreen subscriptionStatus={subscriptionStatus} items={inventory} />)}
            {activeTab === 'profile' && (
              <ProfileScreen 
                legalMode={legalMode} 
                setLegalMode={(mode) => handleUpdateSettings({ legalMode: mode })}
                searchRadius={searchRadius}
                setSearchRadius={(radius) => handleUpdateSettings({ searchRadius: radius })}
                notificationsEnabled={notificationsEnabled}
                setNotificationsEnabled={(enabled) => handleUpdateSettings({ notificationsEnabled: enabled })}
                subscriptionStatus={subscriptionStatus}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Floating Glassmorphic Bottom Navigation */}
      <div className="absolute bottom-6 left-0 right-0 px-4 z-50 pointer-events-none flex justify-center">
        <nav className="pointer-events-auto bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-full flex justify-around items-center p-1.5 shadow-2xl shadow-emerald-900/20 max-w-md w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as Tab)}
                className={`relative flex flex-col items-center justify-center w-14 h-14 transition-colors duration-300 rounded-full ${
                  isActive ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="active-tab-indicator"
                    className="absolute inset-0 bg-emerald-500/10 border border-emerald-500/20 rounded-full"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                {subscriptionStatus === 'founder' && tab.id === 'profile' && (
                  <div className="absolute -top-1 -right-1 bg-purple-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-lg border border-purple-400 z-10">
                    F
                  </div>
                )}
              <Icon size={20} className={`z-10 transition-transform duration-300 ${isActive ? 'scale-110 stroke-[2.5px]' : 'stroke-2'}`} />
                <span className={`text-[9px] mt-1 tracking-wider z-10 transition-all duration-300 ${isActive ? 'font-medium opacity-100' : 'opacity-0 h-0 overflow-hidden'}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
