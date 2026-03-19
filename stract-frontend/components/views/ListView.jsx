'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useApp } from '@/context/AppContext';
import { getTasks, deleteTask } from '@/lib/api';
import { useStatuses } from '@/context/StatusContext';
import { useRealtime } from '@/hooks/useRealtime';
import { formatDate, dueDateStatus } from '@/utils/date';
import {
  Trash2, AlertTriangle, Calendar as CalendarIcon,
  ArrowUpDown, ChevronRight, ChevronDown
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const PRIORITY_CFG = {
  low: { label: 'Low', dot: 'bg-green-500' },
  medium: { label: 'Medium', dot: 'bg-amber-400' },
  high: { label: 'High', dot: 'bg-red-500' },
};



export default function ListView() {
  const { activeWorkspace, activeProject, openTask } = useApp();
  const { statuses } = useStatuses();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Sort state
  const [sortCol, setSortCol] = useState('position');
  const [sortDesc, setSortDesc] = useState(false);
  
  // Group state
  const [isGrouped, setIsGrouped] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const mutationInFlightRef = useRef(false);

  const load = useCallback(async () => {
    if (!activeWorkspace?.id || !activeProject?.id) return;
    setLoading(true);
    try {
      const res = await getTasks(activeWorkspace.id, activeProject.id);
      setTasks(res.data || []);
    } catch (err) {
      console.error('Failed to load tasks', err);
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id, activeProject?.id]);

  useEffect(() => { load(); }, [load]);

  useRealtime((event, isSelf) => {
    if (!isSelf) load();
  }, mutationInFlightRef);

  const handleDelete = async (e, taskId) => {
    e.stopPropagation();
    if (!activeWorkspace?.id) return;
    
    const prev = [...tasks];
    setTasks(tasks.filter(t => t.id !== taskId));
    mutationInFlightRef.current = true;
    try {
      await deleteTask(activeWorkspace.id, taskId);
    } catch (err) {
      console.error('Failed to delete', err);
      setTasks(prev); // Revert
    } finally {
      setTimeout(() => { mutationInFlightRef.current = false; }, 500);
    }
  };

  const toggleSort = (col) => {
    if (sortCol === col) {
      if (sortDesc) { setSortCol('position'); setSortDesc(false); } // reset
      else setSortDesc(true); // desc
    } else {
      setSortCol(col);
      setSortDesc(false); // asc
    }
  };

  const toggleGroup = (status) => {
    setCollapsedGroups(prev => ({ ...prev, [status]: !prev[status] }));
  };

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortCol === 'status') {
        const aName = a.status?.name || '';
        const bName = b.status?.name || '';
        cmp = aName.localeCompare(bName);
      }
      else if (sortCol === 'priority') {
        const pMap = { low: 1, medium: 2, high: 3 };
        cmp = (pMap[a.priority] || 0) - (pMap[b.priority] || 0);
      }
      else if (sortCol === 'due_date') {
        if (!a.due_date && !b.due_date) cmp = 0;
        else if (!a.due_date) cmp = 1; // nulls last
        else if (!b.due_date) cmp = -1;
        else cmp = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      else {
        // default position
        cmp = a.position - b.position;
      }
      return sortDesc ? -cmp : cmp;
    });
  }, [tasks, sortCol, sortDesc]);


  const groupedTasks = useMemo(() => {
    if (!isGrouped) return { all: sortedTasks };
    // Initialize groups based on project statuses
    const groups = {};
    statuses.forEach(s => { groups[s.id] = []; });
    
    // Sort tasks into groups
    sortedTasks.forEach(t => {
      const sId = t.status_id || t.status?.id;
      if (groups[sId]) groups[sId].push(t);
      else {
        // Handle case where status_id might not match (fallback to first group or skip)
        const firstId = statuses[0]?.id;
        if (firstId && groups[firstId]) groups[firstId].push(t);
      }
    });
    return groups;
  }, [sortedTasks, isGrouped, statuses]);


  if (loading && tasks.length === 0) {
    return <div className="max-w-6xl mx-auto px-6 py-8"><div className="h-40 bg-gray-100 rounded-lg animate-pulse" /></div>;
  }

  const renderSortIcon = (col) => {
    if (sortCol !== col) return <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-50 transition-opacity ml-1" />;
    return <ArrowUpDown size={12} className={`opacity-100 ml-1 transition-transform ${sortDesc ? 'rotate-180' : ''}`} />;
  };

  const renderRow = (t) => (
    <div 
      key={t.id} 
      onClick={() => openTask(t.id)}
      className="group flex items-center h-10 border-b border-[#f0f0ee] hover:bg-[#fafaf8] cursor-pointer text-sm"
    >
      <div className="flex-1 min-w-0 px-4 flex items-center gap-2">
        <span className="font-medium text-gray-800 truncate">{t.title}</span>
      </div>
      
      <div className="w-[120px] px-2">
        <Badge 
          variant="secondary" 
          className="font-medium bg-gray-50 border-gray-100"
          style={t.status?.color ? { 
            backgroundColor: `${t.status.color}15`, 
            color: t.status.color, 
            borderColor: `${t.status.color}30` 
          } : {}}
        >
          {t.status?.name || 'Unknown'}
        </Badge>
      </div>
      
      <div className="w-[100px] px-2 flex items-center gap-1.5">
        <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_CFG[t.priority]?.dot || 'bg-gray-400'}`} />
        <span className="text-gray-600 capitalize text-xs">{t.priority}</span>
      </div>
      
      <div className="w-[120px] px-2 flex items-center">
        {t.assignee_id ? (
          <div className="flex items-center gap-1.5 overflow-hidden">
            <Avatar className="h-5 w-5 border border-[#e4e4e0] shrink-0">
               <AvatarImage src={t.assignee?.avatar_url} />
               <AvatarFallback className="text-[10px] bg-violet-100 text-violet-600 font-semibold">{t.assignee?.name?.[0] || 'U'}</AvatarFallback>
            </Avatar>
            <span className="text-xs text-gray-600 truncate">{t.assignee?.name?.split(' ')[0] || 'Assigned'}</span>
          </div>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </div>
      
      <div className="w-[100px] px-2">
         {t.label ? (
           <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200 truncate inline-block max-w-[85px]">{t.label}</span>
         ) : (
           <span className="text-gray-400 text-xs">—</span>
         )}
      </div>
      
      <div className="w-[110px] px-2">
        {t.due_date ? (
          <div className={`flex items-center gap-1 text-xs ${dueDateStatus(t.due_date) === 'overdue' ? 'text-red-600 font-medium' : dueDateStatus(t.due_date) === 'today' ? 'text-amber-600 font-medium' : 'text-gray-600'}`}>
            {dueDateStatus(t.due_date) === 'overdue' ? <AlertTriangle size={11} /> : <CalendarIcon size={11} />}
            {formatDate(t.due_date)}
          </div>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        )}
      </div>
      
      <div className="w-[40px] px-2 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={(e) => handleDelete(e, t.id)}
          className="h-6 w-6 inline-flex items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-6 pb-12">
      
      {/* Active project header & Toggle */}
      <div className="pt-1 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {activeProject && (
            <>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: activeProject.color }} />
              <span className="text-sm font-medium text-[#4a4a45]">{activeProject.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsGrouped(!isGrouped)}
            className={`h-8 text-xs ${isGrouped ? 'bg-gray-100 border-gray-300 shadow-inner' : 'bg-white'}`}
          >
            Group by status
          </Button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center border rounded-xl border-dashed border-[#dcdcd8] bg-white">
          <h3 className="text-base font-semibold text-gray-900">No tasks yet</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4 max-w-sm">
            Add your first task to get started tracking your work in this project.
          </p>
          <Button onClick={() => window.location.href = '/'}>Go to Board to Add</Button>
        </div>
      ) : (
        <div className="bg-white border border-[#e4e4e0] rounded-xl overflow-hidden shadow-sm">
          {/* Header row */}
          <div className="flex items-center h-10 border-b border-[#e4e4e0] bg-[#fafaf8] text-xs font-semibold text-gray-500 uppercase tracking-wider select-none">
            <div className="flex-1 px-4 flex items-center cursor-pointer group hover:text-gray-800" onClick={() => toggleSort('title')}>
              Title {renderSortIcon('title')}
            </div>
            
            <div className="w-[120px] px-2 flex items-center cursor-pointer group hover:text-gray-800" onClick={() => toggleSort('status')}>
              Status {renderSortIcon('status')}
            </div>
            
            <div className="w-[100px] px-2 flex items-center cursor-pointer group hover:text-gray-800" onClick={() => toggleSort('priority')}>
              Priority {renderSortIcon('priority')}
            </div>
            
            <div className="w-[120px] px-2">Assignee</div>
            <div className="w-[100px] px-2">Label</div>
            
            <div className="w-[110px] px-2 flex items-center cursor-pointer group hover:text-gray-800" onClick={() => toggleSort('due_date')}>
              Due Date {renderSortIcon('due_date')}
            </div>
            
            <div className="w-[40px] px-2"></div>
          </div>
          
          {/* Rows */}
          <div className="flex flex-col">
            {isGrouped ? (
              statuses.map(status => {
                const groupTasks = groupedTasks[status.id] || [];
                if (!groupTasks.length) return null;
                const isCollapsed = collapsedGroups[status.id];
                return (
                  <div key={status.id}>
                    {/* Subhead */}
                    <div 
                      className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-[#f0f0ee] cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleGroup(status.id)}
                    >
                      {isCollapsed ? <ChevronRight size={14} className="text-gray-400"/> : <ChevronDown size={14} className="text-gray-400"/>}
                      <span className="text-xs font-semibold text-gray-700 tracking-wide uppercase">{status.name}</span>
                      <span className="text-xs text-gray-400">{groupTasks.length}</span>
                    </div>
                    {/* Group tasks */}
                    {!isCollapsed && groupTasks.map(t => renderRow(t))}
                  </div>
                );
              })
            ) : (
              groupedTasks.all.map(t => renderRow(t))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
