'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { getTask, updateTask, getMembers, getLabels } from '@/lib/api';
import { formatDate, formatRelative, dueDateStatus } from '@/utils/date';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
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
import { AlertTriangle, Calendar as CalendarIcon, Clock, Check, X } from 'lucide-react';

const PRIORITY_CFG = {
  low: { label: 'Low', dot: 'bg-green-500' },
  medium: { label: 'Medium', dot: 'bg-amber-400' },
  high: { label: 'High', dot: 'bg-red-500' },
};

const STATUS_CFG = {
  'todo': { label: 'Todo' },
  'in-progress': { label: 'In Progress' },
  'done': { label: 'Done' },
};

export default function TaskDetailModal() {
  const { activeWorkspace, activeTaskId, closeTask } = useApp();
  
  const [task, setTask] = useState(null);
  const [members, setMembers] = useState([]);
  const [labels, setLabels] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saveState, setSaveState] = useState(''); // '' | 'saving' | 'saved'

  // Ref for debouncing description
  const descTimeoutRef = useRef(null);

  // Fetch task on open
  useEffect(() => {
    if (!activeTaskId || !activeWorkspace) {
      setTask(null);
      setTitle('');
      setDescription('');
      return;
    }
    
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const t = await getTask(activeWorkspace.id, activeTaskId);
        if (active && t.data) {
          setTask(t.data);
          setTitle(t.data.title || '');
          setDescription(t.data.description || '');
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

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
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
  
  const handlePropChange = (field, value) => {
    if (task && task[field] !== value) {
      patchTask({ [field]: value });
    }
  };

  if (!activeTaskId) return null;

  return (
    <Dialog open={!!activeTaskId} onOpenChange={(open) => !open && closeTask()}>
      <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden bg-[#fafaf8] border-[#e4e4e0]">
        
        {/* Header Badges */}
        <div className="px-6 pt-5 pb-3 flex items-center justify-between border-b border-[#e4e4e0] bg-white">
           <div className="flex gap-2 items-center">
             {task?.label && (
               <span className="text-xs font-semibold px-2 py-0.5 bg-violet-100 text-violet-700 rounded border border-violet-200 uppercase tracking-wide">
                 {task.label}
               </span>
             )}
             {task?.priority && (
               <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-700 rounded border border-gray-200 flex items-center gap-1.5 capitalize">
                 <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_CFG[task.priority]?.dot}`} />
                 {PRIORITY_CFG[task.priority]?.label}
               </span>
             )}
           </div>
           
           <div className="flex items-center gap-3">
             {saveState === 'saving' && <span className="text-xs text-gray-400">Saving...</span>}
             {saveState === 'saved' && <span className="text-xs text-green-600 flex items-center gap-1"><Check size={12}/> Saved</span>}
           </div>
        </div>

        {/* Main Content */}
        {loading ? (
          <div className="p-10 flex justify-center text-sm text-gray-500">Loading task...</div>
        ) : task ? (
          <div className="flex bg-white min-h-[500px]">
            {/* Left Col: Editor */}
            <div className="flex-1 flex flex-col border-r border-[#e4e4e0] px-6 py-6 pb-20">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                placeholder="Task title"
                className="text-xl font-semibold text-gray-900 border-none shadow-none focus-visible:ring-0 px-0 h-10 mb-6 bg-transparent placeholder:text-gray-300"
              />
              
              <div className="flex-1">
                <Textarea
                  value={description}
                  onChange={handleDescChange}
                  placeholder="Add a description..."
                  className="w-full resize-none text-sm text-gray-700 placeholder:text-gray-400 border-none shadow-none focus-visible:ring-0 px-0 min-h-[300px] bg-transparent"
                />
              </div>
            </div>

            {/* Right Col: Properties */}
            <div className="w-[280px] bg-[#fafaf8] px-5 py-6 flex flex-col gap-5 overflow-y-auto">
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Properties</h3>
                
                <div className="flex flex-col gap-3">
                  
                  {/* Status */}
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 w-24">Status</span>
                    <div className="flex-1">
                      <Select value={task.status} onValueChange={(v) => handlePropChange('status', v)}>
                        <SelectTrigger className="h-8 text-xs bg-white border-[#e4e4e0]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">Todo</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 w-24">Priority</span>
                    <div className="flex-1">
                      <Select value={task.priority} onValueChange={(v) => handlePropChange('priority', v)}>
                        <SelectTrigger className="h-8 text-xs bg-white border-[#e4e4e0]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">
                            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"/>Low</div>
                          </SelectItem>
                          <SelectItem value="medium">
                            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-amber-400 rounded-full"/>Medium</div>
                          </SelectItem>
                          <SelectItem value="high">
                            <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-500 rounded-full"/>High</div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  {/* Assignee */}
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 w-24">Assignee</span>
                    <div className="flex-1">
                      <Popover>
                        <PopoverTrigger className="flex w-full items-center justify-between h-8 px-2 text-xs bg-white border border-[#e4e4e0] rounded-md hover:bg-gray-50 overflow-hidden outline-none transition-colors">
                           {task.assignee ? (
                             <div className="flex items-center gap-1.5 flex-1 min-w-0">
                               <Avatar className="h-4 w-4">
                                 <AvatarImage src={task.assignee.avatar_url} />
                                 <AvatarFallback className="text-[9px]">{task.assignee.name?.[0] || task.assignee.email[0]}</AvatarFallback>
                               </Avatar>
                               <span className="truncate">{task.assignee.name || task.assignee.email}</span>
                             </div>
                           ) : (
                             <span className="text-gray-400">Unassigned</span>
                           )}
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search members..." className="text-xs h-8" />
                            <CommandList>
                              <CommandEmpty>No members found</CommandEmpty>
                              <CommandGroup>
                                <CommandItem 
                                  value="unassign"
                                  onSelect={() => {
                                    handlePropChange('assignee_id', 'unassign');
                                    // Popover should close automatically if not, we can force it
                                  }} 
                                  className="text-xs items-center gap-2"
                                >
                                  <div className="h-5 w-5 rounded-full border border-dashed border-gray-300 flex items-center justify-center text-gray-400">✕</div>
                                  Unassign
                                </CommandItem>
                                {members.map((m) => (
                                  <CommandItem 
                                    key={m.id} 
                                    value={m.id}
                                    onSelect={(currentValue) => {
                                      handlePropChange('assignee_id', currentValue);
                                    }} 
                                    className="text-xs items-center gap-2"
                                  >
                                    <Avatar className="h-5 w-5">
                                      <AvatarImage src={m.avatar_url} />
                                      <AvatarFallback className="text-[10px]">{m.name?.[0] || m.email[0]}</AvatarFallback>
                                    </Avatar>
                                    <span className="truncate flex-1">{m.name || m.email}</span>
                                    {task.assignee_id === m.id && <Check className="h-3 w-3 ml-auto text-violet-600" />}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Label */}
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 w-24">Label</span>
                    <div className="flex-1">
                      <Popover>
                        <PopoverTrigger className="flex w-full items-center justify-between h-8 px-2 text-xs bg-white border border-[#e4e4e0] rounded-md hover:bg-gray-50 outline-none transition-colors">
                           {task.label ? (
                             <span className="truncate">{task.label}</span>
                           ) : (
                             <span className="text-gray-400">Add label...</span>
                           )}
                        </PopoverTrigger>
                        <PopoverContent className="w-[200px] p-0" align="start">
                          <Command>
                            <CommandInput 
                              placeholder="Search or add label..." 
                              className="text-xs h-8" 
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.target.value) {
                                  handlePropChange('label', e.target.value);
                                  document.body.click(); // Close popover workaround
                                }
                              }}
                            />
                            <CommandList>
                              <CommandEmpty className="px-2 py-2 text-xs text-gray-500">Press Enter to create this label</CommandEmpty>
                              <CommandGroup>
                                {labels.map((l) => (
                                  <CommandItem key={l} onSelect={() => handlePropChange('label', l)} className="text-xs">
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

                  {/* Start Date */}
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 w-24">Start Date</span>
                    <div className="flex-1">
                      <Popover>
                        <PopoverTrigger className="flex w-full items-center gap-1.5 h-8 px-2 text-xs bg-white border border-[#e4e4e0] rounded-md hover:bg-gray-50 outline-none transition-colors">
                           <CalendarIcon size={13} className="text-gray-400" />
                           {task.start_date ? formatDate(task.start_date) : <span className="text-gray-400">Select...</span>}
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={task.start_date ? new Date(task.start_date) : undefined}
                            onSelect={(d) => {
                              // We format locally. Add timezone offset so YYYY-MM-DD comes out correctly
                              const formatted = d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : null;
                              handlePropChange('start_date', formatted);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 w-24">Due Date</span>
                    <div className="flex-1">
                      <Popover>
                        <PopoverTrigger className={`flex w-full items-center gap-1.5 h-8 px-2 text-xs bg-white border rounded-md hover:bg-gray-50 outline-none transition-colors
                          ${dueDateStatus(task.due_date) === 'overdue' ? 'border-red-200 text-red-600 bg-red-50' : 
                            dueDateStatus(task.due_date) === 'today' ? 'border-amber-200 text-amber-600 bg-amber-50' : 'border-[#e4e4e0] text-gray-700'}`}>
                           {dueDateStatus(task.due_date) === 'overdue' ? <AlertTriangle size={13} /> : <CalendarIcon size={13} />}
                           {task.due_date ? formatDate(task.due_date) : <span className="text-gray-400 text-gray-400">Select...</span>}
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={task.due_date ? new Date(task.due_date) : undefined}
                            onSelect={(d) => {
                              const formatted = d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0] : null;
                              handlePropChange('due_date', formatted);
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {/* Created Info */}
                  <div className="flex items-center mt-2 pt-4 border-t border-[#e4e4e0]">
                    <span className="text-xs text-gray-500 w-24">Created</span>
                    <span className="flex-1 text-xs text-gray-600">{formatDate(task.created_at)}</span>
                  </div>

                </div>
              </div>

              {/* Activity Section Placeholder */}
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Activity</h3>
                <div className="text-xs text-gray-400 flex items-center gap-2 italic">
                   <Clock size={12}/> No activity yet.
                </div>
              </div>

            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
