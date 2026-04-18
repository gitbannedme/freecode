import React from "react";
import { 
  Folder, 
  Eye, 
  EyeOff, 
  Copy, 
  Settings, 
  Pencil, 
  Trash2, 
  X, 
  Search, 
  Plus, 
  Save 
} from "lucide-react";

const ICON_SIZE = 14;

export const FolderIcon = () => <Folder size={ICON_SIZE} />;
export const EyeIcon = () => <Eye size={ICON_SIZE} />;
export const EyeOffIcon = () => <EyeOff size={ICON_SIZE} />;
export const CopyIcon = () => <Copy size={ICON_SIZE} />;
export const GearIcon = () => <Settings size={ICON_SIZE} />;
export const EditIcon = () => <Pencil size={ICON_SIZE} />;
export const TrashIcon = () => <Trash2 size={ICON_SIZE} />;
export const XIcon = () => <X size={ICON_SIZE} />;
export const SearchIcon = () => <Search size={ICON_SIZE} />;
export const PlusIcon = () => <Plus size={16} />;
export const SaveIcon = () => <Save size={ICON_SIZE} />;
