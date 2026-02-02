import React from 'react';
import { 
  Home, Users, Cpu, Activity, Settings, Circle, HelpCircle, 
  FileText, MessageSquare, Shield, Clock, HardDrive, List
} from 'lucide-react';

export const ICON_KEYS = [
  'Home', 'Users', 'Cpu', 'Activity', 'Settings', 'HelpCircle', 
  'FileText', 'MessageSquare', 'Shield', 'Clock', 'HardDrive', 'List'
];

export const getIcon = (iconName?: string, size: number = 16) => {
  if (!iconName) return <Circle size={size} />; // Default dot icon for submenus

  switch (iconName) {
    case 'Home': return <Home size={size} />;
    case 'Users': return <Users size={size} />;
    case 'Cpu': return <Cpu size={size} />;
    case 'Activity': return <Activity size={size} />;
    case 'Settings': return <Settings size={size} />;
    case 'HelpCircle': return <HelpCircle size={size} />;
    case 'FileText': return <FileText size={size} />;
    case 'MessageSquare': return <MessageSquare size={size} />;
    case 'Shield': return <Shield size={size} />;
    case 'Clock': return <Clock size={size} />;
    case 'HardDrive': return <HardDrive size={size} />;
    case 'List': return <List size={size} />;
    default: return <Circle size={size} />;
  }
};