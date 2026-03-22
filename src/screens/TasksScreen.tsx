import React, { useState, useEffect } from 'react';
import { Task } from '../types';
import { CheckCircle2, Circle, Clock, AlertCircle, Plus, Trash2, X, Radio, ShieldAlert } from 'lucide-react';

interface TasksScreenProps {
  tasks: Task[];
  onAddTask: (task: Task) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
}

const CountdownTimer = ({ dueDate, completed }: { dueDate: string, completed: boolean }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (completed) {
      setTimeLeft('MISSION ACCOMPLISHED');
      return;
    }

    const calculateTimeLeft = () => {
      // Set due date to end of day if no time is specified
      const due = new Date(dueDate);
      if (due.getHours() === 0 && due.getMinutes() === 0) {
        due.setHours(23, 59, 59);
      }
      
      const difference = due.getTime() - new Date().getTime();
      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((difference / 1000 / 60) % 60);
        const seconds = Math.floor((difference / 1000) % 60);
        
        if (days > 0) {
           return `T-MINUS ${days}D ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `T-MINUS ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      }
      return 'MISSION EXPIRED';
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [dueDate, completed]);

  const isExpired = timeLeft === 'MISSION EXPIRED';
  const isAccomplished = timeLeft === 'MISSION ACCOMPLISHED';

  return (
    <span className={`font-mono text-[10px] tracking-widest ${isExpired ? 'text-red-500 animate-pulse' : isAccomplished ? 'text-green-500' : 'text-emerald-400'}`}>
      {timeLeft}
    </span>
  );
};

export default function TasksScreen({ tasks, onAddTask, onToggleTask, onDeleteTask }: TasksScreenProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [transmissionText, setTransmissionText] = useState('');

  useEffect(() => {
    const text = "SECURE CHANNEL OPENED. AWAITING DIRECTIVES...";
    let i = 0;
    const interval = setInterval(() => {
      setTransmissionText(text.substring(0, i));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const handleAdd = () => {
    if (!newTaskTitle.trim()) return;
    
    const task: Task = {
      id: Math.random().toString(36).substring(7),
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim(),
      dueDate: newTaskDueDate || undefined,
      priority: newTaskPriority,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    
    onAddTask(task);
    setIsAdding(false);
    setNewTaskTitle('');
    setNewTaskDesc('');
    setNewTaskDueDate('');
    setNewTaskPriority('medium');
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-950/30 border-red-500/30 shadow-sm';
      case 'medium': return 'text-amber-400 bg-amber-950/30 border-amber-500/30 shadow-sm';
      case 'low': return 'text-emerald-400 bg-emerald-950/30 border-emerald-500/30 shadow-sm';
      default: return 'text-zinc-400 bg-zinc-950 border-zinc-800';
    }
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="flex flex-col h-full bg-zinc-950 font-sans relative">
      <div className="bg-zinc-950/60 backdrop-blur-2xl px-6 pt-10 pb-6 shadow-[0_4px_30px_rgba(0,0,0,0.5)] border-b border-white/5 z-10 sticky top-0 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-zinc-50 to-zinc-400 tracking-widest uppercase flex items-center gap-3 font-display drop-shadow-sm">
            <Radio className="text-emerald-400 animate-pulse drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" size={28} />
            Directives
          </h1>
          <p className="text-[10px] text-emerald-400/80 mt-1.5 tracking-widest h-3 font-mono drop-shadow-[0_0_2px_rgba(16,185,129,0.5)]">{transmissionText}</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-emerald-500/10 text-emerald-400 p-3 rounded-2xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:bg-emerald-500/20 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:scale-105 transition-all active:scale-95"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5 hide-scrollbar relative z-0">
        {/* Background ambient glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 bg-emerald-500/5 blur-[100px] pointer-events-none" />
        
        {sortedTasks.length === 0 && !isAdding ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-5 relative z-10">
            <div className="w-20 h-20 bg-zinc-900/50 backdrop-blur-md border border-white/5 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.05)] animate-float">
              <CheckCircle2 size={40} className="text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            </div>
            <p className="text-xl font-bold tracking-[0.2em] uppercase font-display text-zinc-400 animate-pulse drop-shadow-sm">No Active Bounties</p>
            <p className="text-xs font-mono text-zinc-600 tracking-widest">Awaiting new transmissions.</p>
          </div>
        ) : (
          sortedTasks.map((task, index) => (
            <div 
              key={task.id} 
              className={`relative rounded-3xl p-5 border transition-all duration-500 animate-float backdrop-blur-md group ${
                task.completed 
                  ? 'opacity-40 border-white/5 bg-zinc-950/40 grayscale-[50%]' 
                  : 'border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.3)] bg-zinc-900/60 hover:border-emerald-500/30 hover:shadow-[0_0_30px_rgba(16,185,129,0.15)] hover:-translate-y-1'
              }`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Scanline overlay */}
              <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(16,185,129,0.02)_50%)] bg-[length:100%_4px] pointer-events-none rounded-3xl" />
              
              {/* Hover glow effect */}
              {!task.completed && (
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/0 via-transparent to-emerald-500/0 group-hover:from-emerald-500/5 group-hover:to-transparent rounded-3xl transition-colors duration-500 pointer-events-none" />
              )}
              
              <div className="flex items-start gap-4 relative z-10">
                <button 
                  onClick={() => onToggleTask(task.id)}
                  className="mt-1 flex-shrink-0 relative"
                >
                  {task.completed ? (
                    <CheckCircle2 size={28} className="text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                  ) : (
                    <>
                      <Circle size={28} className="text-zinc-600 group-hover:text-emerald-500/50 transition-colors" />
                      <div className="absolute inset-0 rounded-full border border-emerald-400/0 group-hover:border-emerald-400/50 scale-150 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300" />
                    </>
                  )}
                </button>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-3">
                    <h3 className={`font-bold text-lg truncate tracking-widest font-display uppercase transition-colors ${task.completed ? 'line-through text-zinc-500' : 'text-zinc-100 group-hover:text-emerald-50'}`}>
                      {task.title}
                    </h3>
                    {task.dueDate && (
                      <div className={`border px-2.5 py-1.5 rounded-lg flex items-center gap-2 shrink-0 backdrop-blur-md transition-colors ${task.completed ? 'bg-zinc-950/50 border-white/5' : 'bg-zinc-950/80 border-white/10 group-hover:border-emerald-500/20'}`}>
                        <Clock size={12} className={task.completed ? 'text-zinc-600' : 'text-emerald-400'} />
                        <CountdownTimer dueDate={task.dueDate} completed={task.completed} />
                      </div>
                    )}
                  </div>
                  
                  {task.description && (
                    <p className={`text-xs mt-2.5 line-clamp-2 font-mono leading-relaxed transition-colors ${task.completed ? 'text-zinc-600' : 'text-zinc-400 group-hover:text-zinc-300'}`}>
                      {task.description}
                    </p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-2.5 mt-4">
                    <span className={`text-[9px] px-2.5 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 uppercase tracking-widest font-mono backdrop-blur-md ${getPriorityColor(task.priority)}`}>
                      <AlertCircle size={12} />
                      {task.priority} PRIORITY
                    </span>
                  </div>
                </div>
                
                <button 
                  onClick={() => onDeleteTask(task.id)}
                  className="text-zinc-600 hover:text-red-400 p-2 rounded-xl hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isAdding && (
        <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-xl flex items-end sm:items-center justify-center p-0 sm:p-4 perspective-1000">
          <div className="bg-zinc-950/90 w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-white/10 animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-8 sm:fade-in duration-300 relative overflow-hidden">
            {/* Matrix Background Effect */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-emerald-500/10 blur-[50px] pointer-events-none" />
            
            <div className="flex justify-between items-center mb-6 relative z-10">
              <h2 className="text-base font-bold text-emerald-400 flex items-center gap-2.5 tracking-[0.2em] uppercase font-display drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">
                <ShieldAlert size={20} className="text-emerald-400" />
                New Directive
              </h2>
              <button onClick={() => setIsAdding(false)} className="text-zinc-500 hover:text-emerald-400 bg-zinc-900/80 border border-white/5 rounded-full p-2 transition-all hover:bg-zinc-800 hover:border-emerald-500/30">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-5 relative z-10">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-[0.2em] font-mono">Target / Objective</label>
                <input 
                  type="text" 
                  value={newTaskTitle}
                  onChange={e => setNewTaskTitle(e.target.value)}
                  placeholder="ENTER DIRECTIVE..."
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none transition-all font-mono text-sm shadow-inner"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-[0.2em] font-mono">Intel (Optional)</label>
                <textarea 
                  value={newTaskDesc}
                  onChange={e => setNewTaskDesc(e.target.value)}
                  placeholder="ADDITIONAL DATA..."
                  rows={3}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none resize-none transition-all font-mono text-sm shadow-inner"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-[0.2em] font-mono">Deadline</label>
                  <input 
                    type="date" 
                    value={newTaskDueDate}
                    onChange={e => setNewTaskDueDate(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-zinc-100 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none transition-all font-mono text-sm shadow-inner [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-[0.2em] font-mono">Priority Level</label>
                  <select 
                    value={newTaskPriority}
                    onChange={e => setNewTaskPriority(e.target.value as any)}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-zinc-100 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 outline-none transition-all font-mono text-sm shadow-inner appearance-none"
                  >
                    <option value="low">LOW</option>
                    <option value="medium">MEDIUM</option>
                    <option value="high">HIGH</option>
                  </select>
                </div>
              </div>
              
              <button 
                onClick={handleAdd}
                disabled={!newTaskTitle.trim()}
                className="w-full bg-emerald-500/10 text-emerald-400 font-bold py-4 rounded-xl border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] hover:bg-emerald-500/20 hover:shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 uppercase tracking-[0.2em] text-xs active:scale-[0.98]"
              >
                Transmit Directive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
