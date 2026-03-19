'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { useStatuses } from '@/context/StatusContext';
import { 
  getTask, updateTask, getMembers, getLabels, 
  getSubtasks, createSubtask, updateSubtask, deleteSubtask,
  getActivity, createComment 
} from '@/lib/api';
import { formatDate, formatRelative, dueDateStatus } from '@/utils/date';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList
} from '@/components/ui/command';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  AlertTriangle, Calendar as CalendarIcon, Clock, Check, X, 
  ChevronRight, MessageSquare, ListTodo, Trash2, Send, Plus
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";

const PRIORITY_CFG = {
  low: { label: 'Low', dot: 'bg-green-500' },
  medium: { label: 'Medium', dot: 'bg-amber-400' },
  high: { label: 'High', dot: 'bg-red-500' },
};

export default function TaskDetailModal() {
  const { activeWorkspace, activeTaskId, closeTask } = useApp();
  const { statuses } = useStatuses();
  
  const [task, setTask] = useState(null);
  const [members, setMembers] = useState([]);
  const [labels, setLabels] = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newComment, setNewComment] = useState('');
  const [saveState, setSaveState] = useState(''); // '' | 'saving' | 'saved'

  // Ref for debouncing description
  const descTimeoutRef = useRef(null);

  // Fetch all data on open
  useEffect(() => {
    if (!activeTaskId || !activeWorkspace) {
      setTask(null);
      setSubtasks([]);
      setActivities([]);
      setTitle('');
      setDescription('');
      return;
    }
    
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [tRes, sRes, aRes] = await Promise.all([
          getTask(activeWorkspace.id, activeTaskId),
          getSubtasks(activeWorkspace.id, activeTaskId),
          getActivity(activeWorkspace.id, activeTaskId)
        ]);
        
        if (active) {
          if (tRes.data) {
            setTask(tRes.data);
            setTitle(tRes.data.title || '');
            setDescription(tRes.data.description || '');
          }
          setSubtasks(sRes.data || []);
          setActivities(aRes.data || []);
        }
      } catch (err) {
        console.error('Failed to load task details', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    
    // Also load workspace members + labels once if not loaded
    const loadWorkspaceMetadata = async () => {
      try {
        if (members.length === 0) {
          const m = await getMembers(activeWorkspace.id);
          setMembers(m || []);
        }
        if (labels.length === 0) {
          const l = await getLabels(activeWorkspace.id);
          setLabels(l || []);
        }
      } catch (err) {
        console.error('Failed to load metadata', err);
      }
    };

    load();
    loadWorkspaceMetadata();

    return () => { active = false; };
  }, [activeTaskId, activeWorkspace]);

  const patchTask = async (data) => {
    if (!task || !activeWorkspace) return;
    setSaveState('saving');
    try {
      const res = await updateTask(activeWorkspace.id, task.id, data);
      setTask(res.data);
      setSaveState('saved');
      setTimeout(() => setSaveState(''), 2000);
      // Refresh activity after a patch
      getActivity(activeWorkspace.id, task.id).then(a => setActivities(a.data || []));
    } catch (err) {
      console.error('Failed to patch task', err);
      setSaveState('');
    }
  };

  const handleTitleBlur = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(task?.title || '');
      return;
    }
    if (trimmed !== task?.title) {
      patchTask({ title: trimmed });
    }
  };

  const handleDescChange = (e) => {
    const val = e.target.value;
    setDescription(val);
    
    if (descTimeoutRef.current) clearTimeout(descTimeoutRef.current);
    descTimeoutRef.current = setTimeout(() => {
      if (val.trim() !== (task?.description || '').trim()) {
        patchTask({ description: val.trim() });
      }
    }, 800);
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim() || !activeWorkspace) return;
    try {
      const res = await createSubtask(activeWorkspace.id, task.id, { title: newSubtaskTitle.trim() });
      setSubtasks([...subtasks, res.data].sort((a,b) => a.position - b.position));
      setNewSubtaskTitle('');
    } catch (err) {
      console.error('Failed to add subtask', err);
    }
  };

  const toggleSubtask = async (s) => {
    try {
      const res = await updateSubtask(activeWorkspace.id, task.id, s.id, { is_done: !s.is_done });
      setSubtasks(subtasks.map(item => item.id === s.id ? res.data : item));
    } catch (err) {
      console.error('Failed to toggle subtask', err);
    }
  };

  const removeSubtask = async (subtaskId) => {
    try {
      await deleteSubtask(activeWorkspace.id, task.id, subtaskId);
      setSubtasks(subtasks.filter(s => s.id !== subtaskId));
    } catch (err) {
      console.error('Failed to delete subtask', err);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !activeWorkspace) return;
    try {
      const res = await createComment(activeWorkspace.id, task.id, newComment.trim());
      setActivities([res.data, ...activities]);
      setNewComment('');
    } catch (err) {
      console.error('Failed to post comment', err);
    }
  };

  if (!activeTaskId) return null;

  const completedSubtasks = subtasks.filter(s => s.is_done).length;
  const progress = subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0;

  return (
    <Dialog open={!!activeTaskId} onOpenChange={(open) => !open && closeTask()}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden bg-[#fafaf8] border-[#e4e4e0] max-h-[90vh] flex flex-col">
        
        {/* Top Header Bar */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-[#e4e4e0] bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
              <span className="hover:text-violet-600 cursor-pointer">{activeWorkspace?.name}</span>
              <ChevronRight size={12} />
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-50 border border-gray-100 rounded text-gray-700">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: task?.status?.color }} />
                {task?.status?.name}
              </div>
            </div>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex items-center gap-2">
              <Select value={task?.priority || ''} onValueChange={(v) => patchTask({ priority: v })}>
                <SelectTrigger className="h-7 text-[11px] font-semibold border-none bg-transparent hover:bg-gray-50 shadow-none px-2 uppercase tracking-tight focus:ring-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_CFG[task?.priority]?.dot || 'bg-gray-400'}`} />
                    <SelectValue />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low Priority</SelectItem>
                  <SelectItem value="medium">Medium Priority</SelectItem>
                  <SelectItem value="high">High Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {saveState === 'saving' && <span className="text-[11px] text-gray-400">Saving...</span>}
              {saveState === 'saved' && <span className="text-[11px] text-green-600 flex items-center gap-1"><Check size={12}/> Saved</span>}
            </div>
            <button onClick={closeTask} className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Layout Body */}
        <div className="flex-1 overflow-hidden flex bg-white">
          
          {/* Main Panel (Left) */}
          <div className="flex-1 overflow-y-auto px-10 py-8 custom-scrollbar">
            <div className="max-w-2xl mx-auto">
              {/* Title Section */}
              <div className="mb-6">
                 <Input
                   value={title}
                   onChange={(e) => setTitle(e.target.value)}
                   onBlur={handleTitleBlur}
                   onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                   placeholder="Task title"
                   className="text-2xl font-bold text-gray-900 border-none shadow-none focus-visible:ring-0 px-0 h-auto bg-transparent placeholder:text-gray-300"
                 />
              </div>

              {/* Description Section */}
              <div className="mb-10">
                <div className="flex items-center gap-2 text-gray-400 mb-2">
                  <MessageSquare size={14} />
                  <span className="text-xs font-semibold uppercase tracking-wider">Description</span>
                </div>
                <Textarea
                  value={description}
                  onChange={handleDescChange}
                  placeholder="Add a detailed description..."
                  className="w-full resize-none text-[14px] leading-relaxed text-gray-700 placeholder:text-gray-400 border-none shadow-none focus-visible:ring-0 px-0 min-h-[120px] bg-transparent"
                />
              </div>

              {/* Subtasks Section */}
              <div className="mb-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-gray-400">
                    <ListTodo size={14} />
                    <span className="text-xs font-semibold uppercase tracking-wider">Subtasks</span>
                  </div>
                  {subtasks.length > 0 && (
                    <span className="text-[11px] font-medium text-gray-500">
                      {completedSubtasks}/{subtasks.length} ({Math.round(progress)}%)
                    </span>
                  )}
                </div>

                {subtasks.length > 0 && (
                  <Progress value={progress} className="h-1.5 mb-4 bg-gray-100" />
                )}

                <div className="space-y-1 mb-4">
                  {subtasks.map(s => (
                    <div key={s.id} className="group flex items-center gap-3 py-1.5 px-2 hover:bg-gray-50 rounded-lg transition-colors">
                      <button 
                        onClick={() => toggleSubtask(s)}
                        className={`flex-shrink-0 w-4 h-4 rounded border transition-colors flex items-center justify-center
                          ${s.is_done ? 'bg-violet-500 border-violet-500 text-white' : 'border-gray-300 hover:border-violet-400'}`}
                      >
                        {s.is_done && <Check size={10} />}
                      </button>
                      <span className={`text-sm flex-1 ${s.is_done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                        {s.title}
                      </span>
                      <button 
                        onClick={() => removeSubtask(s.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Plus size={14} className="text-gray-400" />
                  <Input 
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddSubtask()}
                    placeholder="Add a subtask..."
                    className="flex-1 h-8 text-sm border-none shadow-none focus-visible:ring-0 px-0 bg-transparent"
                  />
                  {newSubtaskTitle && (
                    <Button size="sm" onClick={handleAddSubtask} className="h-7 text-xs px-3 bg-violet-600 hover:bg-violet-700">Add</Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Side Panel (Right) */}
          <div className="w-[320px] bg-[#fafaf8] border-l border-[#e4e4e0] overflow-y-auto flex flex-col custom-scrollbar">
            
            {/* Properties */}
            <div className="p-6 border-b border-[#e4e4e0]">
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Properties</h3>
              <div className="space-y-4">
                
                {/* Status Selection */}
                <div className="flex items-center justify-between group">
                  <span className="text-[13px] text-gray-500">Status</span>
                  <Select value={task?.status_id || ''} onValueChange={(v) => patchTask({ status_id: v })}>
                    <SelectTrigger className="h-8 w-44 text-xs bg-white border-[#e4e4e0] shadow-sm hover:border-violet-300 transition-colors">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: task?.status?.color }} />
                        <span className="truncate">{task?.status?.name || 'Select status…'}</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Assignee */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-500">Assignee</span>
                  <Popover>
                    <PopoverTrigger className="flex h-8 w-40 items-center justify-between px-2 text-xs bg-white border border-[#e4e4e0] rounded-md shadow-sm hover:border-violet-300 transition-colors group">
                      {task?.assignee ? (
                        <div className="flex items-center gap-2 truncate">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={task.assignee.avatar_url} />
                            <AvatarFallback className="text-[8px] bg-violet-100 text-violet-700 uppercase">{task.assignee.name?.[0] || 'U'}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{task.assignee.name || task.assignee.email}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">No assignee</span>
                      )}
                    </PopoverTrigger>
                    <PopoverContent className="w-[220px] p-0" align="end">
                      <Command className="bg-white">
                        <CommandInput placeholder="Search team..." className="h-9 text-xs" />
                        <CommandList>
                          <CommandEmpty>No one found</CommandEmpty>
                          <CommandGroup>
                            <CommandItem onSelect={() => patchTask({ assignee_id: 'unassign' })} className="text-xs py-2">
                              <X size={12} className="mr-2 text-gray-400" /> Unassign
                            </CommandItem>
                            {members.map(m => (
                              <CommandItem key={m.id} onSelect={() => patchTask({ assignee_id: m.id })} className="text-xs py-2">
                                <Avatar className="h-5 w-5 mr-2">
                                  <AvatarImage src={m.avatar_url} />
                                  <AvatarFallback className="text-[10px] uppercase font-bold text-violet-700 bg-violet-100">{m.name?.[0]}</AvatarFallback>
                                </Avatar>
                                {m.name || m.email}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Due Date */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-500">Due Date</span>
                  <Popover>
                    <PopoverTrigger className={`flex h-8 w-40 items-center gap-2 px-2 text-xs bg-white border rounded-md shadow-sm hover:border-violet-300 transition-colors
                      ${dueDateStatus(task?.due_date) === 'overdue' ? 'border-red-200 text-red-600 bg-red-50' : 'border-[#e4e4e0] text-gray-700'}`}>
                      {dueDateStatus(task?.due_date) === 'overdue' ? <AlertTriangle size={12} /> : <CalendarIcon size={12} className="text-gray-400" />}
                      {task?.due_date ? formatDate(task.due_date) : <span className="text-gray-400">Set date...</span>}
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={task?.due_date ? new Date(task.due_date) : undefined}
                        onSelect={(d) => {
                          const formatted = d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : null;
                          patchTask({ due_date: formatted });
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Label Selection */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-gray-500">Label</span>
                  <Popover>
                    <PopoverTrigger className="flex h-8 w-40 items-center justify-between px-2 text-xs bg-white border border-[#e4e4e0] rounded-md shadow-sm hover:border-violet-300 transition-colors">
                      {task?.label ? (
                        <span className="truncate bg-violet-50 text-violet-700 px-2 py-0.5 rounded font-medium border border-violet-100">{task.label}</span>
                      ) : (
                        <span className="text-gray-400 italic">No label</span>
                      )}
                    </PopoverTrigger>
                    <PopoverContent className="w-[220px] p-0" align="end">
                       <Command className="bg-white">
                        <CommandInput 
                          placeholder="Search or add label..." 
                          className="h-9 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.value) {
                              patchTask({ label: e.target.value });
                              // Simple way to close popover
                              document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                            }
                          }}
                        />
                        <CommandList>
                          <CommandEmpty className="text-[11px] p-4 text-gray-400">Press Enter to create this label</CommandEmpty>
                          <CommandGroup>
                             <CommandItem onSelect={() => patchTask({ label: null })} className="text-xs py-2 text-gray-400">
                               <X size={12} className="mr-2" /> Remove Label
                             </CommandItem>
                             {labels.map(l => (
                               <CommandItem key={l} onSelect={() => patchTask({ label: l })} className="text-xs py-2">
                                 {l}
                               </CommandItem>
                             ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

              </div>
            </div>

            {/* Activity Feed */}
            <div className="flex-1 flex flex-col min-h-0 bg-gray-50/50">
              <div className="p-6 pb-2 border-b border-[#e4e4e0] bg-[#fafaf8]">
                <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Activity Feed</h3>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar grayscale-[0.2]">
                {activities.map(a => (
                  <div key={a.id} className="flex gap-3 animate-in fade-in duration-300">
                    <Avatar className="h-7 w-7 mt-0.5">
                      <AvatarImage src={a.user_avatar} />
                      <AvatarFallback className="text-[9px] bg-violet-100 text-violet-700 uppercase font-black">{a.user_name?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-gray-700 truncate">{a.user_name || 'System'}</span>
                        <span className="text-[10px] text-gray-400 whitespace-nowrap">{formatRelative(a.created_at)}</span>
                      </div>
                      <div className={`text-[13px] leading-relaxed ${a.type === 'comment' ? 'text-gray-700 bg-white p-2.5 rounded-lg border border-[#e4e4e0] shadow-sm' : 'text-gray-400 italic'}`}>
                        {a.type === 'system' ? (
                          <span>
                            {a.content}
                            {a.before_value && (
                              <span className="mx-1 font-medium text-gray-500">
                                {a.before_value} → {a.after_value}
                              </span>
                            )}
                          </span>
                        ) : (
                          a.content
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <div className="text-center py-10">
                    <Clock size={20} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-[11px] text-gray-400 font-medium">No activity yet</p>
                  </div>
                )}
              </div>

              {/* Comment Input Sticky at Bottom of Side Panel */}
              <div className="p-4 bg-white border-t border-[#e4e4e0] shrink-0">
                <div className="relative group">
                  <Textarea 
                    placeholder="Write a comment..." 
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleAddComment();
                      }
                    }}
                    className="w-full min-h-[40px] max-h-[120px] text-xs py-2 pr-10 border-[#e4e4e0] focus-visible:ring-violet-300 transition-all resize-none shadow-sm"
                  />
                  <button 
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="absolute right-2 bottom-2 p-1.5 text-gray-300 hover:text-violet-600 disabled:hover:text-gray-300 transition-colors"
                  >
                    <Send size={14} />
                  </button>
                </div>
                <div className="mt-2 flex justify-between items-center px-1">
                  <span className="text-[10px] text-gray-400">Ctrl+Enter to post</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
